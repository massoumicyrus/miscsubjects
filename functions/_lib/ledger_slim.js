// Ledger compaction — stop 100KB+ meta rows and 600KB+ LLM bundles.

import { rankClaims } from "./article_topology.js";
import { weightForTier } from "./ledger_durability.js";

const MAX_QUOTE = 480;
const MAX_SUMMARY = 600;
const MAX_CLAIM_TEXT = 1200;

function normText(t) {
  return String(t || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim()
    .slice(0, 160);
}

function trimSource(s) {
  const out = { ...s };
  if (out.quote) out.quote = String(out.quote).slice(0, MAX_QUOTE);
  if (out.summary) out.summary = String(out.summary).slice(0, MAX_SUMMARY);
  return out;
}

function trimClaim(c) {
  const out = { ...c };
  if (out.text) out.text = String(out.text).slice(0, MAX_CLAIM_TEXT);
  for (const k of [
    "retracted_at",
    "retraction_reason",
    "challenged_by",
    "supports",
    "challenges",
  ]) {
    if (out[k] == null || (Array.isArray(out[k]) && !out[k].length)) delete out[k];
  }
  return out;
}

function isMarketingClaim(c) {
  const t = String(c.text || "").toLowerCase();
  if (c.tier === "speculative" && c.slot === "who_claims_what") return true;
  if (/commercial vendors|clinic|medspa|marketing material|seo/.test(t)) return true;
  return false;
}

/** Merge duplicate marketing who_claims_what claims into one aggregated claim. */
export function collapseMarketingClaims(claims, sources) {
  const active = (claims || []).filter((c) => c.status !== "retracted" && c.status !== "cut");
  const marketing = active.filter(isMarketingClaim);
  if (marketing.length < 4) return { claims, collapsed: 0 };

  let maxN = 0;
  for (const c of claims) {
    const m = /^c(\d+)$/.exec(String(c.id || ""));
    if (m) maxN = Math.max(maxN, +m[1]);
  }

  const sourceIds = new Set();
  for (const c of marketing) {
    for (const sid of c.source_ids || []) sourceIds.add(sid);
  }

  const keepId = marketing[0].id;
  const merged = {
    ...marketing[0],
    id: keepId,
    text:
      "Commercial vendors and clinics market this compound (" +
      sourceIds.size +
      " commercial/clinic sources catalogued) — marketing material, not evidence.",
    tier: "speculative",
    weight: weightForTier("speculative", { marketing_grey: true }),
    slot: "who_claims_what",
    section: "who_claims_what",
    source_ids: [...sourceIds],
    source_status: "sourced",
    why_material: "Collapsed " + marketing.length + " duplicate marketing claims",
    status: "active",
    who_claims: "commercial vendors",
  };

  const drop = new Set(marketing.slice(1).map((c) => c.id));
  const out = claims
    .filter((c) => !drop.has(c.id))
    .map((c) => (c.id === keepId ? merged : c));

  for (const s of sources || []) {
    const ids = (s.claim_ids || []).filter((id) => !drop.has(id));
    if (ids.length || sourceIds.has(s.id)) {
      if (sourceIds.has(s.id) && !ids.includes(keepId)) ids.push(keepId);
      s.claim_ids = [...new Set(ids)];
    }
  }

  return { claims: out, collapsed: marketing.length - 1 };
}

/** Dedupe near-identical active claims (same normalized text). */
export function dedupeClaimsByText(claims) {
  const seen = new Map();
  const drop = new Set();
  for (const c of claims || []) {
    if (c.status === "retracted" || c.status === "cut") continue;
    const key = normText(c.text);
    if (!key || key.length < 24) continue;
    if (seen.has(key)) {
      drop.add(c.id);
      const keep = seen.get(key);
      keep.source_ids = [...new Set([...(keep.source_ids || []), ...(c.source_ids || [])])];
    } else {
      seen.set(key, c);
    }
  }
  if (!drop.size) return { claims, deduped: 0 };
  return {
    claims: claims.filter((c) => !drop.has(c.id)),
    deduped: drop.size,
  };
}

/** Compact stored meta — trim quotes, collapse marketing, dedupe text. */
export function compactLedgerMeta(meta, opts = {}) {
  let claims = Array.isArray(meta.claims) ? meta.claims.map(trimClaim) : [];
  let sources = Array.isArray(meta.sources) ? meta.sources.map(trimSource) : [];

  let collapsed = 0;
  let deduped = 0;
  if (opts.collapse_marketing !== false) {
    const r = collapseMarketingClaims(claims, sources);
    claims = r.claims;
    collapsed = r.collapsed;
  }
  if (opts.dedupe_text !== false) {
    const r = dedupeClaimsByText(claims);
    claims = r.claims;
    deduped = r.deduped;
  }

  return {
    meta: { ...meta, claims, sources },
    stats: {
      claims: claims.length,
      sources: sources.length,
      collapsed_marketing: collapsed,
      deduped_text: deduped,
    },
  };
}

const SLIM_CLAIM_LIMIT = 48;
const SLIM_SOURCE_LIMIT = 40;

/** Ranked, trimmed claims for LLM export (not full D1 dump). */
export function slimClaimsForExport(claims, sources, limit = SLIM_CLAIM_LIMIT) {
  return rankClaims(claims, sources)
    .slice(0, limit)
    .map((c) =>
      trimClaim({
        id: c.id,
        text: c.text,
        tier: c.tier,
        weight: c.weight,
        effective_weight: c.effective_weight,
        slot: c.slot,
        interaction_risk: c.interaction_risk === true ? true : undefined,
        quote_gated: c.quote_gated === true ? true : undefined,
        source_ids: c.source_ids,
        who_claims: c.who_claims,
        status: c.status,
      }),
    );
}

/** Trimmed sources for LLM export — ranked by claim linkage count. */
export function slimSourcesForExport(sources, claims, limit = SLIM_SOURCE_LIMIT) {
  const linked = new Set();
  for (const c of claims || []) {
    for (const sid of c.source_ids || []) linked.add(sid);
  }
  const ranked = [...(sources || [])].sort((a, b) => {
    const la = linked.has(a.id) ? 1 : 0;
    const lb = linked.has(b.id) ? 1 : 0;
    return lb - la || String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });
  return ranked.slice(0, limit).map((s) =>
    trimSource({
      id: s.id,
      type: s.type,
      url: s.url,
      title: s.title,
      summary: s.summary,
      quote: s.quote,
      quote_status: s.quote_status,
      link_status: s.link_status,
      claim_ids: s.claim_ids,
      hash: s.hash ? String(s.hash).slice(0, 16) : undefined,
    }),
  );
}