// Ledger durability — provenance, bidirectional claim↔source wiring, constitution audit, repair.

import { ARTICLE_SLOTS } from "./article_constitution.js";
import { buildNowIso, buildSinceIso } from './build_time.js';
import { honestySummary, isActiveClaim } from "./ledger_honesty.js";
import { applyFocusHygiene, focusAudit } from "./ledger_focus.js";

const SLOT_ALIASES = {
  "what it is": "what_it_is",
  overview: "what_it_is",
  "who claims": "who_claims_what",
  "who claims what": "who_claims_what",
  known: "what_is_known",
  "what is known": "what_is_known",
  unknown: "what_is_unknown",
  gaps: "what_is_unknown",
  mechanism: "mechanism",
  limitations: "limitations",
  limits: "limitations",
  disclaimer: "disclaimer",
};

/** Canonical actor format: {provider}/{id} or system/{function} */
const ACTOR_ALIASES = {
  "miscsubjects protocol": "system/protocol",
  "miscsubjects protocol verdict": "system/verdict",
  "grok-build": "grok/build",
  "ledger-repair": "system/repair",
  repair: "system/repair",
  post_protocol_verdict: "system/verdict-post",
  ledger_hold: "system/ledger-hold",
  "fill-slots": "system/fill-slots",
  "kimi-collaborator": "kimi/moonshot-v1-8k",
  "gemini-collaborator": "gemini/gemini-2.5-flash",
  "miscsubjects ledger synthesis": "grok/synthesis",
  "miscsubjects gap analysis": "grok/gap-analysis",
  "grok-4.3": "grok/grok-4.3",
  "ingest:deterministic": "system/ingest-deterministic",
  selftest: "system/selftest",
};

export function normalizeActor(actor) {
  const raw = String(actor || "").trim();
  if (!raw) return "system/unknown";
  const key = raw.toLowerCase();
  if (ACTOR_ALIASES[key]) return ACTOR_ALIASES[key];
  if (raw.includes("/")) return raw.slice(0, 200);
  if (/^grok/i.test(raw)) return "grok/" + raw.replace(/^grok-?/i, "");
  if (/^gemini/i.test(raw)) return "gemini/" + raw;
  if (/^kimi|moonshot/i.test(raw)) return "kimi/" + raw;
  return "system/" + raw.replace(/\s+/g, "-").slice(0, 180);
}

export function makePostedBy(opts = {}) {
  const ts = buildNowIso();
  const actor = normalizeActor(
    opts.who_claims || opts.actor || opts.author || opts.model || "unknown",
  );
  return {
    actor,
    channel: String(opts.channel || "api"),
    ts,
    model: opts.model ? normalizeActor(opts.model) : null,
    rationale: String(opts.rationale || "").slice(0, 500),
  };
}

export function inferSlot(claim) {
  if (claim.slot) return claim.slot;
  const sec = String(claim.section || "").toLowerCase();
  for (const [k, v] of Object.entries(SLOT_ALIASES)) {
    if (sec.includes(k)) return v;
  }
  return null;
}

/** Ensure who_claims + posted_by on a claim. */
export function enrichClaim(claim, opts = {}) {
  const c = { ...claim };
  const posted_by = c.posted_by || makePostedBy({
    ...opts,
    who_claims: c.who_claims,
    actor: c.who_claims || opts.actor,
  });
  c.posted_by = posted_by;
  if (!c.who_claims) c.who_claims = posted_by.actor;
  if (!c.slot) c.slot = inferSlot(c);
  return c;
}

/** Bidirectional claim.source_ids ↔ source.claim_ids sync. */
export function wireClaimSourceGraph(claims, sources) {
  const claimList = (Array.isArray(claims) ? claims : []).map((c) => ({ ...c }));
  const sourceList = (Array.isArray(sources) ? sources : []).map((s) => ({
    ...s,
    claim_ids: Array.isArray(s.claim_ids) ? [...s.claim_ids.map(String)] : [],
  }));
  const byClaim = {};
  const bySource = {};
  claimList.forEach((c) => {
    byClaim[c.id] = c;
    c.source_ids = Array.isArray(c.source_ids) ? [...c.source_ids.map(String)] : [];
  });
  sourceList.forEach((s) => {
    bySource[s.id] = s;
  });

  for (const c of claimList) {
    for (const sid of c.source_ids) {
      const s = bySource[sid];
      if (s && !s.claim_ids.includes(c.id)) s.claim_ids.push(c.id);
    }
    if (c.source_ids.length) c.source_status = "sourced";
    else if (!c.source_status) c.source_status = "unsourced";
  }
  for (const s of sourceList) {
    for (const cid of s.claim_ids) {
      const c = byClaim[cid];
      if (c && !c.source_ids.includes(s.id)) {
        c.source_ids.push(s.id);
        c.source_status = "sourced";
      }
    }
  }
  return { claims: claimList, sources: sourceList };
}

export function checkConstitutionSlots(claims) {
  const required = ARTICLE_SLOTS.filter((s) => s.required).map((s) => s.id);
  const present = new Set();
  for (const c of claims || []) {
    const slot = c.slot || inferSlot(c);
    if (slot) present.add(slot);
  }
  const missing_required = required.filter((id) => !present.has(id));
  const filled = required.filter((id) => present.has(id));
  return {
    required,
    filled,
    missing_required,
    complete: missing_required.length === 0,
  };
}

const INTERACTION_RISK_RE =
  /\b(potentiat|amplif(?:y|ies|ied)|synerg|D-?amphetamine|psychostimulant)\b/i;

/** Text hints from a source row — used for human-vs-animal tier and slot inference. */
export function sourceHint(source) {
  return [source?.title, source?.summary, source?.quote]
    .filter(Boolean)
    .join(" ");
}

const HUMAN_STUDY_RE =
  /\b(randomi[sz]ed|double[- ]blind|placebo[- ]controlled|clinical trial|patients?|volunteers?|healthy subjects?|human subjects?|n\s*=\s*\d{1,4}|pilot study|open[- ]label study|cohort study|phase\s+[i123]|observational|cross[- ]sectional|longitudinal|gad patients?|human trial|in humans?|subjects? with)\b/i;
const ANIMAL_STUDY_RE =
  /\b(rats?|mice|mouse|rodent|in vitro|cell line|animal model|murine|canine|porcine|preclinical only|in rats?|in mice)\b/i;
const REVIEW_HUMAN_RE =
  /\b(review|meta[- ]analysis|systematic review|narrative review|scoping review|clinical review)\b/i;
const COMMERCIAL_SOURCE_RE =
  /\b(commercial vendor|vendors? and clinics? market|clinic market|our peptide|peptide (?:shop|store)|limitlesslife|medspa)\b/i;
const GAP_LANGUAGE_RE =
  /\b(no human|not studied in humans?|no (?:published )?trial|not examine|unclear in humans?|gap remains|sparse human|limited (?:western )?rct|only (?:in )?animals?)\b/i;
const MECHANISM_RE =
  /\b(mechanism|pathway|receptor|modulat|upregul|downregul|acts on|binds to|inhibits?|potentiat|bdnf|trkb|adenosine|melatonin|circadian)\b/i;
const LIMITATION_RE =
  /\b(interaction|contraindic|unsafe to combine|potentiat.*amphetamine|psychostimulant.*risk|overstrong|not established)\b/i;

/** Tier from source metadata — clinic SEO is not preclinical science. */
export function tierForSourceType(type, url = "", hint = "") {
  const t = String(type || "").toLowerCase();
  const u = String(url || "").toLowerCase();
  const h = String(hint || "").toLowerCase();

  if (t === "clinical_trial") return "human";

  if (["reddit", "x", "youtube", "instagram", "anecdotal"].includes(t)) {
    return "anecdotal";
  }

  const isPubMed =
    t === "pubmed" ||
    u.includes("pubmed.ncbi.nlm.nih.gov") ||
    u.includes("ncbi.nlm.nih.gov/pmc") ||
    (u.includes("doi.org") && !u.includes("medspa") && !u.includes("/blog"));

  if (COMMERCIAL_SOURCE_RE.test(h)) return "speculative";

  if (isPubMed || (t === "review" && (u.includes("pubmed") || u.includes("ncbi")))) {
    if (ANIMAL_STUDY_RE.test(h) && !HUMAN_STUDY_RE.test(h)) return "preclinical";
    if (HUMAN_STUDY_RE.test(h)) return "human";
    if (REVIEW_HUMAN_RE.test(h) && !ANIMAL_STUDY_RE.test(h)) return "human";
    if (MECHANISM_RE.test(h) && ANIMAL_STUDY_RE.test(h)) return "preclinical";
    if (MECHANISM_RE.test(h)) return "mechanistic";
    return "mechanistic";
  }

  if (t === "medical") {
    if (COMMERCIAL_SOURCE_RE.test(h)) return "speculative";
    if (HUMAN_STUDY_RE.test(h)) return "human";
    return "speculative";
  }

  if (t === "review" && !ANIMAL_STUDY_RE.test(h)) return "human";

  if (["medical", "review", "news", "business", "other"].includes(t)) {
    return "speculative";
  }
  return "speculative";
}

/** Route materialized claims to constitution slots from source + text — not everything → who_claims_what. */
export function inferSlotFromSource(source, claimText = "") {
  const type = String(source?.type || "").toLowerCase();
  const text = (
    claimText +
    " " +
    sourceHint(source)
  ).toLowerCase();

  if (LIMITATION_RE.test(text) || source?.interaction_risk) return "limitations";
  if (GAP_LANGUAGE_RE.test(text)) return "what_is_unknown";
  if (MECHANISM_RE.test(text) && !["reddit", "x", "anecdotal"].includes(type)) {
    return "mechanism";
  }
  if (["reddit", "x", "instagram", "youtube", "anecdotal"].includes(type)) {
    return "who_claims_what";
  }
  if (
    type === "clinical_trial" ||
    (["pubmed", "review", "medical"].includes(type) && HUMAN_STUDY_RE.test(text))
  ) {
    return "what_is_known";
  }
  if (["pubmed", "review", "medical"].includes(type)) return "what_is_known";
  if (tierForSourceType(type, source?.url, text) === "speculative") {
    return "who_claims_what";
  }
  return "what_is_known";
}

const PROTECTED_SLOTS = new Set([
  "what_it_is",
  "disclaimer",
  "limitations",
  "what_is_unknown",
  "what_is_known",
  "mechanism",
  "who_claims_what",
]);

/** Re-home claims dumped into who_claims_what when source/text implies another slot. */
export function reslotMisassignedClaims(claims, sources) {
  const bySource = {};
  for (const s of sources || []) bySource[s.id] = s;
  let moved = 0;
  const out = (claims || []).map((c) => {
    if (c.interaction_risk) return c;
    if (String(c.who_claims || "").includes("miscsubjects protocol")) return c;
    if (c.slot && c.slot !== "who_claims_what") return c;
    const sid = (c.source_ids || [])[0];
    const src = sid ? bySource[sid] : null;
    if (!src) return c;
    const inferred = inferSlotFromSource(src, c.text);
    if (!PROTECTED_SLOTS.has(inferred) || inferred === c.slot) return c;
    moved++;
    return { ...c, slot: inferred, section: inferred };
  });
  return { claims: out, moved };
}

/** Re-tier claims using source title/summary hints (fixes human-tier drought). */
export function retierClaimsWithHints(claims, sources) {
  const bySource = {};
  for (const s of sources || []) bySource[s.id] = s;
  let retiered = 0;
  const out = (claims || []).map((c) => {
    const src = primarySourceForClaim(c, bySource);
    if (!src) return c;
    const hint = sourceHint(src);
    const expected = tierForSourceType(src.type, src.url, hint);
    if (c.tier === expected) return c;
    if (String(c.who_claims || "").includes("miscsubjects protocol") && c.tier === "system") {
      return c;
    }
    retiered++;
    const nc = { ...c, tier: expected };
    nc.weight = weightForTier(expected, {
      quote_unverified:
        (src.quote_status === "unverified" || src.quote_status === "unchecked") &&
        expected === "preclinical",
      marketing_grey: expected === "speculative",
      interaction_risk: nc.interaction_risk,
    });
    return nc;
  });
  return { claims: out, retiered };
}

export function weightForTier(tier, opts = {}) {
  if (opts.interaction_risk) return 0.85;
  const base = {
    human: 0.8,
    preclinical: 0.5,
    anecdotal: 0.3,
    mechanistic: 0.3,
    speculative: 0.12,
    system: 0.1,
  }[tier] ?? 0.1;
  if (opts.quote_unverified) return Math.min(base, 0.22);
  if (opts.marketing_grey) return Math.min(base, 0.12);
  return base;
}

function primarySourceForClaim(claim, bySource) {
  const sid = (claim.source_ids || [])[0];
  return sid ? bySource[sid] : null;
}

function isMarketingGreySource(src) {
  if (!src) return false;
  const tier = tierForSourceType(src.type, src.url);
  return tier === "speculative";
}

function claimNeedsRetier(claim, bySource) {
  const src = primarySourceForClaim(claim, bySource);
  if (!src) return false;
  const expected = tierForSourceType(src.type, src.url, sourceHint(src));
  if (claim.tier !== expected) return true;
  if (
    claim.tier === "preclinical" &&
    isMarketingGreySource(src) &&
    (claim.weight || 0) >= 0.4
  ) {
    return true;
  }
  return false;
}

function applyClaimTierPolicy(claim, bySource) {
  const c = { ...claim };
  const src = primarySourceForClaim(c, bySource);
  const materialized = /materialized from orphan source/i.test(
    String(c.why_material || ""),
  );

  if (src && (materialized || claimNeedsRetier(c, bySource))) {
    const tier = tierForSourceType(src.type, src.url, sourceHint(src));
    c.tier = tier;
    const unverified =
      src.quote_status === "unverified" || src.quote_status === "unchecked";
    c.weight = weightForTier(tier, {
      quote_unverified: unverified && tier === "preclinical",
      marketing_grey: tier === "speculative",
    });
  }

  const text = String(c.text || "");
  if (INTERACTION_RISK_RE.test(text) && /amphetamine|psychostimulant/i.test(text)) {
    c.slot = "limitations";
    c.section = "limitations";
    c.interaction_risk = true;
    c.weight = weightForTier(c.tier || "preclinical", { interaction_risk: true });
    if (!c.why_material?.includes("interaction_risk")) {
      c.why_material =
        (c.why_material ? c.why_material + " " : "") +
        "[interaction_risk: documented amphetamine potentiation — surface in ask/topology]";
    }
  } else if (src?.quote_status === "unverified" && c.tier === "preclinical") {
    c.weight = weightForTier(c.tier, { quote_unverified: true });
  }

  return c;
}

/**
 * Repair ledger: wire graph, backfill posted_by, optionally materialize orphan sources as claims.
 */
export function repairLedgerMeta(meta, opts = {}) {
  const materializeOrphans = opts.materialize_orphans === true;
  const retierClaims = opts.retier_claims !== false;
  const backfillPostedBy = opts.backfill_posted_by !== false;
  const normalizeProvenance = opts.normalize_provenance === true;
  const defaultActor = opts.default_actor || "system/repair";
  const defaultChannel = opts.channel || "repair";

  let claims = Array.isArray(meta.claims) ? meta.claims.map((c) => ({ ...c })) : [];
  let sources = Array.isArray(meta.sources) ? meta.sources.map((s) => ({ ...s })) : [];

  if (normalizeProvenance) {
    claims = claims.map((c) => {
      const nc = { ...c };
      nc.who_claims = normalizeActor(nc.who_claims);
      if (nc.posted_by) {
        nc.posted_by = {
          ...nc.posted_by,
          actor: normalizeActor(nc.posted_by.actor || nc.who_claims),
          model: nc.posted_by.model ? normalizeActor(nc.posted_by.model) : null,
        };
      }
      return nc;
    });
    sources = sources.map((s) => ({
      ...s,
      found_by: s.found_by ? normalizeActor(s.found_by) : s.found_by,
      author: s.author ? normalizeActor(s.author) : s.author,
    }));
  }

  if (backfillPostedBy) {
    claims = claims.map((c) =>
      c.posted_by
        ? c
        : enrichClaim(c, {
            actor: c.who_claims || defaultActor,
            channel: defaultChannel,
            model: meta.model || null,
            rationale: "backfilled by ledger repair",
          }),
    );
  }

  let wired = wireClaimSourceGraph(claims, sources);
  claims = wired.claims;
  sources = wired.sources;

  if (retierClaims) {
    const bySource = {};
    for (const s of sources) bySource[s.id] = s;
    claims = claims.map((c) => applyClaimTierPolicy(c, bySource));
    const hinted = retierClaimsWithHints(claims, sources);
    claims = hinted.claims;
  }

  if (opts.reslot_claims !== false) {
    const reslotted = reslotMisassignedClaims(claims, sources);
    claims = reslotted.claims;
  }

  const materialized = [];
  if (materializeOrphans) {
    let maxN = 0;
    claims.forEach((c) => {
      const m = /^c(\d+)$/.exec(String(c.id || ""));
      if (m) maxN = Math.max(maxN, +m[1]);
    });
    const linkedSourceIds = new Set();
    for (const c of claims) {
      for (const sid of c.source_ids || []) linkedSourceIds.add(sid);
    }
    const orphans = sources.filter(
      (s) =>
        !(s.claim_ids || []).length &&
        !linkedSourceIds.has(s.id) &&
        String(s.summary || s.quote || s.title || "").trim(),
    );
    // Fat-article guard: once an article carries >30 claims, stop turning every clinic/marketing
    // URL into its own who_claims_what claim — that is exactly how a ledger balloons to 90+
    // near-duplicate marketing claims (the cognitive-stack-intro failure).
    const fat = claims.length > 30;
    const isMarketing = (s) => tierForSourceType(s.type, s.url) === "speculative";
    const marketingOrphans = orphans.filter(isMarketing);
    const substantiveOrphans = orphans.filter((s) => !isMarketing(s));
    // Collapse many clinic/vendor URLs saying the same thing into ONE who_claims_what claim.
    // Threshold drops to 1 on fat articles so marketing is never materialized 1:1 there.
    const collapseMarketing = marketingOrphans.length >= (fat ? 1 : 3);
    const materializeIndividually = collapseMarketing ? substantiveOrphans : orphans;

    if (collapseMarketing) {
      const topic = String(opts.title || opts.slug || "this compound").replace(/-/g, " ");
      const id = "c" + ++maxN;
      const claim = enrichClaim(
        {
          id,
          text:
            "Commercial vendors and clinics market " +
            topic +
            " (" +
            marketingOrphans.length +
            " commercial/clinic sources catalogued) — marketing material, not evidence.",
          tier: "speculative",
          weight: weightForTier("speculative", { marketing_grey: true }),
          section: "who_claims_what",
          slot: "who_claims_what",
          source_ids: marketingOrphans.map((s) => s.id),
          source_status: "sourced",
          why_material:
            "Aggregated " +
            marketingOrphans.length +
            " commercial/clinic sources into one who_claims_what claim (marketing dedupe)",
          status: "active",
          who_claims: "commercial vendors",
        },
        { actor: "commercial vendors", channel: defaultChannel },
      );
      claims.push(claim);
      for (const s of marketingOrphans) s.claim_ids = [id];
      materialized.push({
        claim_id: id,
        aggregated_source_ids: marketingOrphans.map((s) => s.id),
        marketing_dedupe: true,
      });
    }

    for (const s of materializeIndividually) {
      const text = String(s.summary || s.quote || s.title || "").trim().slice(0, 2000);
      if (!text) continue;
      const id = "c" + ++maxN;
      const hint = sourceHint(s);
      const tier = tierForSourceType(s.type, s.url, hint);
      const slot = inferSlotFromSource(s, text);
      const who = s.found_by || s.author || s.publisher || defaultActor;
      const unverified =
        s.quote_status === "unverified" || s.quote_status === "unchecked";
      const claim = enrichClaim(
        {
          id,
          text,
          tier,
          weight: null,
          section: slot,
          slot,
          source_ids: [s.id],
          source_status: "sourced",
          why_material: "Materialized from orphan source " + s.id + " by ledger repair",
          status: "active",
          who_claims: who,
        },
        { actor: who, channel: defaultChannel, model: s.found_by || null },
      );
      claim.weight =
        claim.weight ??
        weightForTier(tier, {
          quote_unverified: unverified && tier === "preclinical",
          marketing_grey: tier === "speculative",
        });
      const bySource = { [s.id]: s };
      const polished = applyClaimTierPolicy(claim, bySource);
      Object.assign(claim, polished);
      claims.push(claim);
      s.claim_ids = [id];
      materialized.push({ claim_id: id, source_id: s.id });
    }
    wired = wireClaimSourceGraph(claims, sources);
    claims = wired.claims;
    sources = wired.sources;
  }

  if (opts.anchor_source) {
    const sid = String(opts.anchor_source);
    const src = sources.find((s) => String(s.id) === sid);
    if (src) {
      // Bootstrap only — link claims that have NO sources yet; never overwrite existing chains.
      for (const c of claims) {
        if (!isActiveClaim(c)) continue;
        if ((c.source_ids || []).length) continue;
        c.source_ids = [sid];
        c.source_status = "sourced";
      }
      src.claim_ids = claims
        .filter((c) => isActiveClaim(c) && (c.source_ids || []).includes(sid))
        .map((c) => c.id);
      const rewired = wireClaimSourceGraph(claims, sources);
      claims = rewired.claims;
      sources = rewired.sources;
    }
  }

  let focus_stats = null;
  if (opts.apply_focus !== false && opts.slug) {
    const focused = applyFocusHygiene(
      { ...meta, claims, sources },
      opts.slug,
      opts.title,
    );
    claims = focused.meta.claims;
    sources = focused.meta.sources;
    meta.focus = focused.meta.focus;
    focus_stats = focused.stats;
  }

  const health = auditLedgerHealth({ claims, sources }, opts.slug);
  return {
    meta: { ...meta, claims, sources },
    materialized,
    health,
    focus_stats,
    focus_audit: opts.slug ? focusAudit({ claims, sources, focus: meta.focus }, opts.slug, opts.title) : null,
  };
}

/** Build constitution slot claims from existing ledger (topology-aware). */
export function buildConstitutionSlotClaims(meta, opts = {}) {
  const slug = opts.slug || "article";
  const check = checkConstitutionSlots(meta.claims || []);
  if (!check.missing_required.length) return { to_add: [], check };

  const claims = meta.claims || [];
  const sources = meta.sources || [];
  const sciN = sources.filter((s) =>
    ["pubmed", "clinical_trial", "review", "medical"].includes(String(s.type)),
  ).length;
  const anecN = sources.filter((s) =>
    ["reddit", "x", "youtube", "instagram", "anecdotal"].includes(String(s.type)),
  ).length;
  const humanClaims = claims.filter((c) => c.tier === "human" && (c.source_ids || []).length);
  const preClaims = claims.filter((c) => c.tier === "preclinical");
  const humanSrc = humanClaims.flatMap((c) => c.source_ids || []).slice(0, 3);
  const title = opts.title || slug.replace(/-/g, " ");

  const templates = {
    what_it_is: {
      text:
        title +
        " is catalogued in this miscsubjects ledger as a tier-honest evidence graph (claims + hash-chained sources). " +
        "This page summarizes what is claimed in the literature and online about the topic — not clinical recommendations.",
      tier: "system",
      source_ids: [],
      who_claims: "miscsubjects protocol",
    },
    what_is_known: {
      text:
        "Per this ledger on " +
        title +
        ": " +
        sciN +
        " scientific and " +
        anecN +
        " anecdotal sources are catalogued; " +
        (humanClaims.length
          ? humanClaims.length + " human-tier claim(s) cite controlled or pilot data (e.g. " + humanSrc.join(", ") + "). "
          : "") +
        (preClaims.length
          ? preClaims.length + " preclinical claim(s) summarize animal/cell literature in-catalogue."
          : "preclinical literature is represented in-catalogue."),
      tier: humanClaims.length ? "human" : "preclinical",
      source_ids: humanSrc,
      who_claims: "miscsubjects ledger synthesis",
    },
    what_is_unknown: {
      text:
        "Not established in this ledger: large randomized human trials for common marketed uses; long-term human safety beyond small pilots; condition-specific efficacy where only anecdotal or preclinical sources exist (explicit gaps remain in question graph).",
      tier: "speculative",
      source_ids: [],
      who_claims: "miscsubjects gap analysis",
    },
    limitations: {
      text:
        "Hash-chained sources verify integrity, not clinical truth. Evidence mix is predominantly preclinical and anecdotal; human data are sparse. " +
        (claims.some((c) => c.interaction_risk)
          ? "This ledger flags amphetamine/psychostimulant interaction-risk claims (e.g. Semax potentiation in rodent models) — see limitations-slot claims. "
          : "") +
        "No dosing, protocol, or treatment recommendations — catalogue only.",
      tier: "mechanistic",
      source_ids: [],
      who_claims: "miscsubjects protocol",
    },
    disclaimer: {
      text:
        "Not medical advice. Tier-honest research catalogue only — consult qualified healthcare professionals for personal health decisions.",
      tier: "human",
      source_ids: [],
      who_claims: "miscsubjects protocol",
    },
  };

  const to_add = [];
  for (const slot of check.missing_required) {
    const t = templates[slot];
    if (!t) continue;
    to_add.push({
      slot,
      section: slot,
      text: t.text,
      tier: t.tier,
      source_ids: t.source_ids,
      who_claims: t.who_claims,
      why_material: "Required constitution slot: " + slot,
      source_status: (t.source_ids || []).length ? "sourced" : "unsourced",
    });
  }
  return { to_add, check };
}

export function auditLedgerHealth(meta, slug) {
  const claims = meta.claims || [];
  const sources = meta.sources || [];
  let orphanSources = 0;
  let missingPostedBy = 0;
  let sourcedButEmpty = 0;
  const claimSourceIds = new Set();

  for (const c of claims) {
    if (!c.posted_by) missingPostedBy++;
    const sids = c.source_ids || [];
    if (c.source_status === "sourced" && !sids.length) sourcedButEmpty++;
    sids.forEach((id) => claimSourceIds.add(id));
  }
  for (const s of sources) {
    const linked =
      (s.claim_ids || []).length > 0 || claimSourceIds.has(s.id);
    if (!linked) orphanSources++;
  }

  const constitution = checkConstitutionSlots(claims);
  const edges =
    claims.reduce((n, c) => n + (c.source_ids || []).length, 0) +
    (claims.filter((c) => c.posted_by).length);

  const issues = [];
  if (missingPostedBy) issues.push(missingPostedBy + " claims missing posted_by");
  if (orphanSources) issues.push(orphanSources + " orphan sources (no claim link)");
  if (sourcedButEmpty) issues.push(sourcedButEmpty + " claims sourced but empty source_ids");
  if (constitution.missing_required.length)
    issues.push("missing constitution slots: " + constitution.missing_required.join(", "));

  const focus = slug ? focusAudit(meta, slug) : null;
  if (focus?.mislabeled_preclinical?.length) {
    issues.push(focus.mislabeled_preclinical.length + " claims mislabeled preclinical (human language)");
  }

  return {
    slug: slug || null,
    ok: issues.length === 0,
    counts: {
      claims: claims.length,
      sources: sources.length,
      voxel_edges: edges,
    },
    issues,
    constitution,
    focus,
    repair: slug
      ? "POST /api/protocol/repair {\"slug\":\"" + slug + "\",\"apply_focus\":true}"
      : null,
    honesty: honestySummary(meta),
    system_map: "https://miscsubjects.com/api/articles/system-map",
  };
}