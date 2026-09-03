// Article topology — claims, sources, user reports, related embeds, question graph.
// Used by /api/articles/<slug>/topology, /prompts, /question-graph, and /api/protocol/ask.
import { loadQuestionGraph } from "./question_graph.js";
import { weightForTier } from "./ledger_durability.js";

const TIER_PRIORITY = {
  human: 5,
  preclinical: 4,
  mechanistic: 3,
  anecdotal: 2,
  speculative: 1,
  system: 0,
};
const UNVERIFIED_QUOTE = new Set(["unverified", "unchecked"]);
// A claim whose only backing is an unverified quote cannot present at full tier weight.
const QUOTE_GATE_CAP = 0.22;

/**
 * Runtime ranking for ask/topology presentation. Two enforced rules from the audit:
 *  - Safety first: interaction_risk / limitations-slot claims sort above who_claims_what volume.
 *  - Quote-gated weighting: a claim whose every backing source is an unverified quote is capped,
 *    so unverified marketing/clinic material cannot present at full tier weight.
 * ask() truncates the serialized topology at 28k chars, so order also decides what the model sees.
 */
export function rankClaims(claims, sources) {
  const quoteBySource = {};
  for (const s of sources || []) quoteBySource[String(s.id)] = s.quote_status;
  const scored = (claims || []).map((c) => {
    const base = typeof c.weight === "number" ? c.weight : weightForTier(c.tier);
    const sids = (c.source_ids || []).map(String);
    const isSafety = c.interaction_risk === true || c.slot === "limitations";
    const allUnverified =
      sids.length > 0 &&
      sids.every((id) => UNVERIFIED_QUOTE.has(String(quoteBySource[id] || "")));
    const roleBySource = {};
    for (const s of sources || []) roleBySource[String(s.id)] = s.source_role;
    const focusExcluded =
      sids.length > 0 &&
      sids.every((id) => roleBySource[id] === "exclude_candidate");
    let eff = base;
    let quote_gated = false;
    if (c.status === "cut" || focusExcluded) {
      eff = Math.min(base, 0.06);
    } else if (c.source_role === "adjacent_context") {
      eff = Math.min(base, 0.22);
    } else if (c.source_role === "commercial_claim") {
      eff = Math.min(base, 0.1);
    } else if (allUnverified && !isSafety) {
      eff = Math.min(base, QUOTE_GATE_CAP);
      quote_gated = true;
    }
    return {
      ...c,
      effective_weight: Math.round(eff * 1000) / 1000,
      quote_gated,
      _safety: isSafety ? 1 : 0,
      _tp: TIER_PRIORITY[c.tier] ?? 0,
    };
  });
  scored.sort(
    (a, b) =>
      b._safety - a._safety ||
      b.effective_weight - a.effective_weight ||
      b._tp - a._tp ||
      String(a.id).localeCompare(String(b.id), undefined, { numeric: true }),
  );
  return scored.map(({ _safety, _tp, ...c }) => c);
}

export function parseArticleMeta(m) {
  try {
    return JSON.parse(m || "{}") || {};
  } catch {
    return {};
  }
}

const ANEC_TYPES = new Set([
  "reddit",
  "x",
  "twitter",
  "youtube",
  "instagram",
  "anecdotal",
  "imessage",
  "whatsapp",
]);
const SCI_TYPES = new Set([
  "pubmed",
  "clinical_trial",
  "review",
  "medical",
]);

/** Condition phrases → stack / condition articles (cross-graph ask). */
const CONDITION_SLUGS = {
  "herniated disc": [
    "recovery-stack-herniated-disc",
    "bpc-ara-herniated-disc",
    "ara-290-herniated-disc",
  ],
  "herniated discs": [
    "recovery-stack-herniated-disc",
    "bpc-ara-herniated-disc",
    "ara-290-herniated-disc",
  ],
  sciatica: ["recovery-stack-sciatica", "ara-290-sciatica"],
  "glp-1": [
    "wolverine-stack-glp1",
    "bpc-157-glp1-gut-damage",
    "tb-500-glp1-muscle-loss",
  ],
  ozempic: ["wolverine-stack-glp1", "bpc-157-glp1-gut-damage"],
  mounjaro: ["wolverine-stack-glp1", "bpc-157-glp1-gut-damage"],
  wegovy: ["wolverine-stack-glp1", "bpc-157-glp1-gut-damage"],
  "gut damage": ["bpc-157-glp1-gut-damage", "bpc-157-gut-health"],
  "muscle loss": ["tb-500-glp1-muscle-loss", "tb-500"],
  crohn: ["bpc-157-ibd-crohns-colitis", "bpc-kpv-ibd-crohns-colitis"],
  colitis: ["bpc-157-ibd-crohns-colitis", "bpc-kpv-ibd-crohns-colitis"],
  ibd: ["bpc-157-ibd-crohns-colitis", "bpc-kpv-gut-repair"],
  "proton pump": ["bpc-157-ppi", "bpc-kpv-ppi"],
  ppi: ["bpc-157-ppi", "bpc-kpv-ppi"],
  adderall: ["bpc-157-adderall-gut", "adderall-stack-intro"],
  neuropathy: [
    "recovery-stack-diabetic-neuropathy",
    "ara-290-diabetic-neuropathy",
  ],
  "back pain": ["recovery-stack-back-pain", "recovery-stack-intro"],
  "post surgery": ["bpc-157-post-surgery", "recovery-stack-intro"],
  "post-surgery": ["bpc-157-post-surgery", "recovery-stack-intro"],
};

const PEPTIDE_ALIASES = {
  bpc: "bpc-157",
  "bpc-157": "bpc-157",
  bpc157: "bpc-157",
  tb: "tb-500",
  "tb-500": "tb-500",
  tb500: "tb-500",
  thymosin: "tb-500",
  ara: "ara-290",
  "ara-290": "ara-290",
  semax: "semax",
  selank: "selank",
  kpv: "kpv",
  "ghk-cu": "ghk-cu",
  ghk: "ghk-cu",
};

const STACK_COMPONENTS = {
  "wolverine-stack-glp1": ["bpc-157", "tb-500"],
  "recovery-stack-intro": ["bpc-157", "tb-500", "ara-290"],
  "recovery-stack-herniated-disc": [
    "bpc-157",
    "tb-500",
    "ara-290",
    "recovery-stack-intro",
  ],
  "recovery-stack-sciatica": ["recovery-stack-herniated-disc", "ara-290"],
  "bpc-ara-herniated-disc": ["bpc-157", "ara-290", "ara-290-herniated-disc"],
};

/** Resolve slugs for a question — condition + stack + peptide mentions. */
export function resolveAskSlugs(question, primarySlug) {
  const q = String(question || "").toLowerCase();
  const slugs = new Set();

  const prim = String(primarySlug || "")
    .trim()
    .toLowerCase();
  if (prim) {
    for (const part of prim.split(/[,;|]/)) {
      const p = part.trim();
      if (p) slugs.add(p);
    }
  }

  for (const [phrase, targets] of Object.entries(CONDITION_SLUGS)) {
    if (q.includes(phrase)) targets.forEach((s) => slugs.add(s));
  }

  for (const [alias, slug] of Object.entries(PEPTIDE_ALIASES)) {
    if (q.includes(alias)) slugs.add(slug);
  }
  if (/\bwolverine\b/.test(q)) slugs.add("wolverine-stack-glp1");
  if (/\brecovery stack\b/.test(q)) slugs.add("recovery-stack-intro");

  const expanded = new Set(slugs);
  for (const s of slugs) {
    for (const comp of STACK_COMPONENTS[s] || []) expanded.add(comp);
  }

  return [...expanded].slice(0, 8);
}

/** Merge multiple article topologies for cross-graph ask. */
export async function loadGraphTopology(env, slugs, opts = {}) {
  const list = (Array.isArray(slugs) ? slugs : [slugs])
    .map((s) =>
      String(s || "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
  if (!list.length) return { error: "need slugs" };

  const articles = [];
  for (const s of list) {
    const topo = await loadArticleTopology(env, s, opts);
    if (!topo.error) articles.push(topo);
  }
  if (!articles.length) return { error: "no articles found for: " + list.join(", ") };

  const tag = (a, id) => a.slug + ":" + id;
  const claims = articles.flatMap((a) =>
    (a.claims || []).map((c) => ({
      ...c,
      global_id: tag(a, c.id),
      article_slug: a.slug,
      article_title: a.title,
    })),
  );
  const sources = articles.flatMap((a) =>
    (a.sources || []).map((s) => ({
      ...s,
      global_id: tag(a, s.id),
      article_slug: a.slug,
    })),
  );
  const user_reports = articles.flatMap((a) =>
    (a.user_reports || []).map((u) => ({ ...u, article_slug: a.slug })),
  );

  return {
    graph: true,
    slugs: articles.map((a) => a.slug),
    articles,
    primary_slug: articles[0].slug,
    ranking: "safety-first (interaction_risk/limitations), then quote-gated effective_weight",
    claims: rankClaims(claims, sources),
    sources,
    anecdotal_sources: sources.filter((x) => ANEC_TYPES.has(String(x.type))),
    scientific_sources: sources.filter((x) => SCI_TYPES.has(String(x.type))),
    user_reports,
    counts: {
      articles: articles.length,
      claims: claims.length,
      sources: sources.length,
      anecdotal: sources.filter((x) => ANEC_TYPES.has(String(x.type))).length,
      scientific: sources.filter((x) => SCI_TYPES.has(String(x.type))).length,
      user_reports: user_reports.length,
    },
  };
}

/** Top N follow-up prompts for iMessage / WhatsApp after an ask. */
export function followUpPrompts(topologyOrGraph, limit = 3) {
  const prompts = [];
  if (topologyOrGraph?.graph && Array.isArray(topologyOrGraph.articles)) {
    for (const a of topologyOrGraph.articles.slice(0, 3)) {
      prompts.push(...suggestedPrompts(a));
    }
  } else if (topologyOrGraph && !topologyOrGraph.error) {
    prompts.push(...suggestedPrompts(topologyOrGraph));
  }
  const seen = new Set();
  const out = [];
  for (const p of prompts) {
    const key = p.imessage_body || p.prompt;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      prompt: p.prompt,
      imessage_body: p.imessage_body || p.prompt,
      channel_hint: p.channel_hint,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function loadArticleTopology(env, slug, opts = {}) {
  const s = String(slug || "")
    .trim()
    .toLowerCase();
  if (!s || !env.DB) return { error: "need slug" };
  const row = await env.DB.prepare(
    "SELECT slug, title, body, meta, updated_at FROM articles WHERE slug=?",
  )
    .bind(s)
    .first();
  if (!row) return { error: "article not found: " + s };

  const meta = parseArticleMeta(row.meta);
  const includeInactive = opts.include_inactive === true;
  const allClaims = meta.claims || [];
  const activeClaims = allClaims.filter(
    (c) =>
      includeInactive ||
      !c.status ||
      c.status === "active" ||
      c.status === "downweighted",
  );
  const claims = activeClaims.map((c) => ({
    id: c.id,
    text: c.text,
    tier: c.tier,
    weight: c.weight,
    section: c.section,
    slot: c.slot,
    interaction_risk: c.interaction_risk === true,
    status: c.status || "active",
    source_ids: c.source_ids || [],
    source_status: c.source_status,
    why_material: c.why_material,
    retracted_at: c.retracted_at || null,
    retraction_reason: c.retraction_reason || null,
    challenged_by: c.challenged_by || [],
  }));
  const sources = (meta.sources || []).map((src) => ({
    id: src.id,
    type: src.type,
    url: src.url,
    title: src.title,
    quote: src.quote,
    summary: src.summary,
    claim_ids: src.claim_ids || [],
    link_status: src.link_status,
    quote_status: src.quote_status,
    hash: src.hash,
  }));

  let user_reports = [];
  try {
    const ue = await env.DB.prepare(
      "SELECT id, ts, context, text, author, hash, status FROM user_entries WHERE subject=? ORDER BY ts DESC LIMIT ?",
    )
      .bind(s, opts.user_limit || 12)
      .all();
    user_reports = ue.results || [];
  } catch {}

  const embedSlugs = Array.isArray(meta.embeds) ? meta.embeds : [];
  const related_articles = [];
  const maxRel = opts.related_limit || 5;
  for (const es of embedSlugs.slice(0, maxRel)) {
    const rel = await env.DB.prepare(
      "SELECT slug, title, meta FROM articles WHERE slug=?",
    )
      .bind(es)
      .first();
    if (!rel) continue;
    const rm = parseArticleMeta(rel.meta);
    related_articles.push({
      slug: rel.slug,
      title: rel.title,
      claims: (rm.claims || []).slice(0, 8).map((c) => ({
        id: c.id,
        text: c.text,
        tier: c.tier,
      })),
    });
  }

  const question_graph = await loadQuestionGraph(env, s, {
    limit: opts.question_limit || 12,
  });

  return {
    slug: s,
    title: row.title,
    register: meta.register || "standard",
    tags: meta.tags || [],
    updated_at: row.updated_at,
    body_excerpt: String(row.body || "").slice(0, 4000),
    ranking: "safety-first (interaction_risk/limitations), then quote-gated effective_weight",
    claims: rankClaims(claims, sources),
    sources,
    anecdotal_sources: sources.filter((x) => ANEC_TYPES.has(String(x.type))),
    scientific_sources: sources.filter((x) => SCI_TYPES.has(String(x.type))),
    user_reports,
    related_articles,
    question_graph,
    honesty: {
      active_claims: activeClaims.length,
      retracted_claims: allClaims.filter((c) => c.status === "retracted").length,
      cut_claims: allClaims.filter((c) => c.status === "cut").length,
      challenges: (meta.challenges || []).length,
      scrub_events: (meta.scrub_events || []).length,
      note: "Retracted/cut claims stay on ledger but are excluded from ask unless ?include_inactive=1",
    },
    counts: {
      claims: claims.length,
      claims_total: allClaims.length,
      sources: sources.length,
      anecdotal: sources.filter((x) => ANEC_TYPES.has(String(x.type))).length,
      scientific: sources.filter((x) => SCI_TYPES.has(String(x.type))).length,
      user_reports: user_reports.length,
      questions: question_graph.questions?.length || 0,
      evidence_ingests: question_graph.evidence?.length || 0,
    },
  };
}

/** Auto-suggested prompts for iMessage / WhatsApp / on-page ask. */
export function suggestedPrompts(topology) {
  if (!topology || topology.error) return [];
  const slug = topology.slug;
  const title = topology.title || slug;
  const out = [];

  for (const c of (topology.claims || []).slice(0, 6)) {
    const short = String(c.text || "").slice(0, 140);
    out.push({
      id: "claim-" + c.id,
      claim_id: c.id,
      tier: c.tier,
      weight: c.weight,
      prompt:
        "What does the ledger say about this (" +
        c.tier +
        ' tier): "' +
        short +
        (c.text && c.text.length > 140 ? "…" : "") +
        '"?',
      channel_hint: "ask " + slug + " claim " + c.id,
      imessage_body:
        "On " +
        title +
        " — what's the evidence for claim " +
        c.id +
        "? (" +
        c.tier +
        ")",
    });
  }

  for (const s of (topology.anecdotal_sources || []).slice(0, 4)) {
    out.push({
      id: "anecdote-" + s.id,
      source_id: s.id,
      type: s.type,
      prompt:
        "Summarize this " +
        s.type +
        ' report and how it should weigh: "' +
        String(s.summary || s.quote || s.title || "").slice(0, 120) +
        '"',
      channel_hint: "ask " + slug + " source " + s.id,
      imessage_body:
        "On " + title + " — what did people report on " + s.type + " (source " + s.id + ")?",
    });
  }

  if ((topology.user_reports || []).length) {
    out.push({
      id: "user-reports",
      prompt: "What have readers submitted about " + title + " (good and bad)?",
      channel_hint: "ask " + slug + " user reports",
      imessage_body: "What experiences are logged on " + title + "?",
    });
  }

  // Health register only when the claim graph is actually health-tiered;
  // an AI-governance article offering "for my medical situation" is template leakage.
  const isHealth = (topology.claims || []).some((c) =>
    ["human", "preclinical", "anecdotal"].includes(String(c.tier || "")),
  );

  for (const rel of (topology.related_articles || []).slice(0, 3)) {
    out.push({
      id: "related-" + rel.slug,
      related_slug: rel.slug,
      prompt:
        "How does " + rel.title + " relate to " + title + (isHealth ? " for my condition?" : "?"),
      channel_hint: "ask " + slug + " related " + rel.slug,
      imessage_body:
        "How does " + rel.title + " connect to " + title + " in your catalogue?",
    });
  }

  out.push(
    isHealth
      ? {
          id: "catalogue-gaps",
          prompt:
            "For my medical situation, what can you answer from your catalogue about " +
            title +
            " — and what would you need me to tell you first?",
          channel_hint: "ask " + slug + " condition gaps",
          imessage_body:
            "I have a medical condition — what can you tell me from your " +
            title +
            " catalogue, and what don't you know?",
        }
      : {
          id: "catalogue-gaps",
          prompt:
            "What can you answer from your catalogue about " +
            title +
            " — and what remains open or unverified?",
          channel_hint: "ask " + slug + " gaps",
          imessage_body:
            "On " + title + " — what do you know, and what don't you know yet?",
        },
  );

  out.push(
    isHealth
      ? {
          id: "good-vs-bad",
          prompt:
            "What good and bad outcomes are documented for " + title + " (studies vs anecdotes)?",
          channel_hint: "ask " + slug + " good bad experiences",
          imessage_body:
            "What good and bad things do people report about " + title + "?",
        }
      : {
          id: "good-vs-bad",
          prompt:
            "What are the strongest objections or counter-evidence on record against " + title + "?",
          channel_hint: "ask " + slug + " objections",
          imessage_body:
            "What's the strongest case against the claims in " + title + "?",
        },
  );

  return out;
}