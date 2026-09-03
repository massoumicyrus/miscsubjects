import { buildNowIso, buildSinceIso } from './build_time.js';
// Honest ledger hygiene — bad info stays; secrets get scrubbed with a tombstone trail.

const SECRET_PATTERNS = [
  { id: "terminal_key_hex", re: /\b[a-f0-9]{64}\b/gi, label: "64-char hex secret" },
  { id: "x_terminal_key_header", re: /x-terminal-key\s*[:=]\s*['"]?[^\s'"]{8,}/gi, label: "x-terminal-key" },
  { id: "bearer_token", re: /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/g, label: "Bearer token" },
  { id: "xai_key", re: /\bxai-[A-Za-z0-9]{20,}\b/g, label: "xAI API key" },
  { id: "openai_sk", re: /\bsk-[A-Za-z0-9]{20,}\b/g, label: "OpenAI-style key" },
  { id: "cf_api_token", re: /\bcfat_[A-Za-z0-9._-]{20,}\b/g, label: "Cloudflare API token" },
  { id: "env_assignment", re: /(TERMINAL_KEY|GROK_API_KEY|OPENAI_API_KEY|API_KEY)\s*=\s*['"]?[^\s'"]{8,}/gi, label: "env secret assignment" },
];

const REDACT_PLACEHOLDER = "[REDACTED:secret-leak]";

export const ACTIVE_CLAIM_STATUSES = new Set(["active", "downweighted"]);

export function isActiveClaim(c) {
  const st = String(c?.status || "active");
  return ACTIVE_CLAIM_STATUSES.has(st);
}

/** Scan text for likely secrets — returns non-reversible fingerprints only in reports. */
export function detectSecrets(text) {
  const s = String(text || "");
  const hits = [];
  for (const p of SECRET_PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags);
    let m;
    while ((m = re.exec(s)) !== null) {
      const raw = m[0];
      hits.push({
        type: p.id,
        label: p.label,
        index: m.index,
        length: raw.length,
        fingerprint: raw.slice(0, 4) + "…" + raw.slice(-4),
      });
    }
  }
  return hits;
}

export function scrubString(text) {
  let out = String(text || "");
  let hits = 0;
  for (const p of SECRET_PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags);
    const before = out;
    out = out.replace(re, REDACT_PLACEHOLDER);
    if (out !== before) hits++;
  }
  return { text: out, redactions: hits };
}

/** Walk article meta + body; redact secrets; append scrub_events tombstone. */
export function scrubArticleContent(meta, body, opts = {}) {
  const ts = buildNowIso();
  const actor = opts.actor || "scrub";
  const channel = opts.channel || "protocol/scrub";
  const fields = [];
  let totalHits = 0;

  function touch(path, value) {
    if (typeof value !== "string" || !value) return value;
    const det = detectSecrets(value);
    if (!det.length) return value;
    const { text, redactions } = scrubString(value);
    totalHits += det.length;
    fields.push({ path, hits: det.length, types: [...new Set(det.map((h) => h.type))] });
    return text;
  }

  const m = { ...meta };
  const newBody = touch("body", body || "");

  if (Array.isArray(m.claims)) {
    m.claims = m.claims.map((c, i) => {
      const nc = { ...c };
      nc.text = touch("claims[" + i + "].text", nc.text);
      if (nc.why_material) nc.why_material = touch("claims[" + i + "].why_material", nc.why_material);
      if (nc.posted_by?.rationale)
        nc.posted_by = {
          ...nc.posted_by,
          rationale: touch("claims[" + i + "].posted_by.rationale", nc.posted_by.rationale),
        };
      return nc;
    });
  }
  if (Array.isArray(m.sources)) {
    m.sources = m.sources.map((s, i) => {
      const ns = { ...s };
      ns.quote = touch("sources[" + i + "].quote", ns.quote);
      ns.summary = touch("sources[" + i + "].summary", ns.summary);
      ns.title = touch("sources[" + i + "].title", ns.title);
      ns.url = touch("sources[" + i + "].url", ns.url);
      return ns;
    });
  }
  if (Array.isArray(m.provenance)) {
    m.provenance = m.provenance.map((p, i) => {
      const np = { ...p };
      np.prompt = touch("provenance[" + i + "].prompt", np.prompt);
      np.input = touch("provenance[" + i + "].input", np.input);
      np.response = touch("provenance[" + i + "].response", np.response);
      return np;
    });
  }

  const scrub_events = Array.isArray(m.scrub_events) ? [...m.scrub_events] : [];
  if (totalHits > 0) {
    scrub_events.push({
      id: "scrub_" + scrub_events.length,
      ts,
      actor,
      channel,
      total_hits: totalHits,
      fields,
      note: "Secrets redacted in place — original bytes not recoverable from public ledger; event retained for audit.",
    });
    m.scrub_events = scrub_events;
  }

  return {
    meta: m,
    body: newBody,
    scrubbed: totalHits > 0,
    total_hits: totalHits,
    fields,
    scrub_event: totalHits > 0 ? scrub_events[scrub_events.length - 1] : null,
  };
}

/** Retract a claim — stays on ledger, excluded from active topology. */
export function retractClaimInMeta(meta, claimId, opts = {}) {
  const ts = buildNowIso();
  const claims = Array.isArray(meta.claims) ? meta.claims.map((c) => ({ ...c })) : [];
  const target = claims.find((c) => c.id === claimId);
  if (!target) return { error: "claim not found: " + claimId };

  const retractions = Array.isArray(meta.retractions) ? [...meta.retractions] : [];
  retractions.push({
    id: "ret_" + retractions.length,
    ts,
    claim_id: claimId,
    reason: String(opts.reason || "retracted — bad or superseded information"),
    by: String(opts.by || opts.actor || "operator"),
    channel: opts.channel || "protocol/retract",
    prev_status: target.status || "active",
    prev_weight: target.weight,
  });
  meta.retractions = retractions;

  target.status = "retracted";
  target.weight = 0;
  target.retracted_at = ts;
  target.retracted_by = String(opts.by || opts.actor || "operator");
  target.retraction_reason = String(opts.reason || "");
  meta.claims = claims;

  return { meta, retraction: retractions[retractions.length - 1] };
}

/** Post an adversary challenge claim linked to a target. */
export function challengeClaimInMeta(meta, targetClaimId, challenge, opts = {}) {
  const claims = Array.isArray(meta.claims) ? meta.claims.map((c) => ({ ...c })) : [];
  const target = claims.find((c) => c.id === targetClaimId);
  if (!target) return { error: "target claim not found: " + targetClaimId };

  let maxN = 0;
  claims.forEach((c) => {
    const m = /^c(\d+)$/.exec(String(c.id || ""));
    if (m) maxN = Math.max(maxN, +m[1]);
  });
  const id = "c" + (maxN + 1);
  const ts = buildNowIso();

  const newClaim = {
    id,
    text: String(challenge.text || "").slice(0, 2000),
    tier: challenge.tier || "mechanistic",
    weight: challenge.weight ?? 0.4,
    section: challenge.section || "Challenge",
    slot: challenge.slot || null,
    source_ids: challenge.source_ids || [],
    source_status: (challenge.source_ids || []).length ? "sourced" : "unsourced",
    why_material: String(challenge.why_material || "Adversary challenge to " + targetClaimId),
    status: "active",
    who_claims: challenge.who_claims || opts.actor || "adversary",
    posted_by: {
      actor: challenge.who_claims || opts.actor || "adversary",
      channel: opts.channel || "protocol/challenge",
      ts,
      model: opts.model || null,
    },
    challenges: [targetClaimId],
  };

  target.challenged_by = Array.from(new Set([...(target.challenged_by || []), id]));
  if (typeof target.weight === "number") {
    target.weight = Math.max(0, target.weight - (challenge.downweight || 0.15));
    if (target.weight < 0.15) target.status = "downweighted";
  }

  claims.push(newClaim);
  meta.claims = claims;
  meta.challenges = Array.isArray(meta.challenges) ? [...meta.challenges] : [];
  meta.challenges.push({
    id: "ch_" + meta.challenges.length,
    ts,
    target_claim_id: targetClaimId,
    challenge_claim_id: id,
    by: opts.actor || "adversary",
    reason: challenge.reason || newClaim.text.slice(0, 200),
  });

  return { meta, challenge_claim_id: id, target_claim_id: targetClaimId };
}

export function honestySummary(meta) {
  const claims = meta.claims || [];
  return {
    active: claims.filter((c) => isActiveClaim(c)).length,
    retracted: claims.filter((c) => c.status === "retracted").length,
    cut: claims.filter((c) => c.status === "cut").length,
    downweighted: claims.filter((c) => c.status === "downweighted").length,
    challenges: (meta.challenges || []).length,
    retractions: (meta.retractions || []).length,
    scrub_events: (meta.scrub_events || []).length,
  };
}