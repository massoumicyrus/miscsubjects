// Self-explaining widgets — every paste/API payload carries its own map of the system.
// Principle: copy without context → reader knows what this is, how to use it, where to look next.

import { INTEGRITY_CLAUSE, GAUNTLET_CLAUSE, structureSelfBlock } from "./structure_clauses.js";

const BASE = "https://miscsubjects.com";

/** Canonical feature index. Each entry points to related features (logical proof chain). */
export const FEATURES = {
  unified_handoff: {
    id: "unified_handoff",
    name: "Unified handoff (content + backend)",
    what: "ONE paste/URL for any model + share token. Same self-explaining pattern as article bundle, but whole build.",
    read: BASE + "/api/handoff?format=markdown",
    read_md: BASE + "/api/handoff?format=markdown",
    write: null,
    related: ["system_map", "build_self", "oip_protocol", "bundle"],
  },
  build_self: {
    id: "build_self",
    name: "Build self-model",
    what: "Backend god-map — every tier, invoke path, admin pages, worked examples. Terminal key or share token.",
    read: BASE + "/api/dispatch?build=1&format=markdown",
    read_md: BASE + "/api/dispatch?build=1&format=markdown",
    write: "POST /api/dispatch {key, body}",
    related: ["unified_handoff", "oip_protocol", "admin_self"],
  },
  admin_self: {
    id: "admin_self",
    name: "Admin pages index",
    what: "Derived _self for every admin surface — not hand-curated.",
    read: BASE + "/api/admin/self?format=markdown",
    write: null,
    related: ["build_self", "unified_handoff"],
  },
  system_map: {
    id: "system_map",
    name: "System map",
    what: "Root index of every miscsubjects article-ledger feature. Start here if you have zero context.",
    read: BASE + "/api/articles/system-map",
    read_md: BASE + "/api/articles/system-map?format=markdown",
    write: null,
    related: ["constitution", "llm_manifest", "oip_article_hub", "oip_protocol", "bundle", "unified_handoff"],
  },
  constitution: {
    id: "constitution",
    name: "Article constitution",
    what: "Binding rules: required article slots, claim/source rules, ontology anti-sprawl.",
    read: BASE + "/api/articles/constitution",
    read_md: BASE + "/api/articles/constitution?format=markdown",
    write: null,
    related: ["voxels", "ontology", "claim_post"],
  },
  ontology: {
    id: "ontology",
    name: "Article ontology",
    what: "Recursive peptide tree, sprawl orphans, misstep candidates (duplicate scope / missing parent).",
    read: BASE + "/api/articles/ontology",
    write: null,
    related: ["constitution", "topology"],
  },
  bundle: {
    id: "bundle",
    name: "LLM article bundle",
    what: "Portable reference package: body + claims + sources + voxels + provenance + manifest + constitution.",
    read: BASE + "/api/articles/{slug}/bundle?format=markdown",
    write: null,
    related: ["topology", "voxels", "ask", "ingest", "claim_post", "llm_manifest"],
  },
  topology: {
    id: "topology",
    name: "Article topology",
    what: "Claims, sources, anecdotes, user reports, related embeds, question graph slice — for ask/ROUTER.",
    read: BASE + "/api/articles/{slug}/topology",
    write: null,
    related: ["ask", "graph_topology", "question_graph", "voxels"],
  },
  voxels: {
    id: "voxels",
    name: "Voxel graph",
    what: "Claims as atoms, sources as edges (supported_by, posted_by). Per-claim provenance.",
    read: BASE + "/api/articles/{slug}/voxels",
    write: BASE + "/api/protocol/claim",
    related: ["constitution", "sources_ledger", "claim_post"],
  },
  question_graph: {
    id: "question_graph",
    name: "Question graph",
    what: "Ask nodes (questions + gaps) and evidence_ingest nodes (pasted model output).",
    read: BASE + "/api/articles/{slug}/question-graph",
    write: BASE + "/api/protocol/ask",
    related: ["ask", "ingest", "topology"],
  },
  ask: {
    id: "ask",
    name: "Ask protocol",
    what: "Answer only from topology; creates question_node with gaps and ingest_hint.",
    read: BASE + "/api/articles/{slug}/prompts",
    write: BASE + "/api/protocol/ask",
    imessage: "{slug}|question",
    router: "[ARTICLE_ASK]{slug}|question[/ARTICLE_ASK]",
    related: ["topology", "ingest", "question_graph"],
  },
  ingest: {
    id: "ingest",
    name: "Ingest protocol",
    what: "Parse pasted evidence → source ledger + claims + evidence_ingest node.",
    read: null,
    write: BASE + "/api/protocol/ingest",
    imessage: "ingest {slug}|q:{node_id}|paste",
    router: "[ARTICLE_INGEST]{slug}|evidence[/ARTICLE_INGEST]",
    related: ["sources_ledger", "question_graph", "bundle"],
  },
  claim_post: {
    id: "claim_post",
    name: "Claim post protocol",
    what: "Prompt-injection style POST — one claim voxel with who_claims + posted_by.",
    read: BASE + "/api/articles/{slug}/voxels",
    write: BASE + "/api/protocol/claim",
    imessage: "claim {slug}|tier|assertion",
    router: "[ARTICLE_CLAIM]{slug}|tier|assertion[/ARTICLE_CLAIM]",
    related: ["voxels", "constitution", "sources_ledger"],
  },
  sources_ledger: {
    id: "sources_ledger",
    name: "Source ledger",
    what: "Hash-chained cited sources; verify integrity at GET .../sources.",
    read: BASE + "/api/articles/{slug}/sources",
    write: BASE + "/api/protocol/sources",
    related: ["voxels", "provenance", "ingest"],
  },
  provenance: {
    id: "provenance",
    name: "Provenance chain",
    what: "Hash-chained log of every model write/edit on an article.",
    read: BASE + "/api/articles/{slug}/provenance",
    write: "via protocol draft/write/ingest/claim (automatic)",
    related: ["contributions", "bundle"],
  },
  contributions: {
    id: "contributions",
    name: "Model contributions",
    what: "Every model's original post on an article (swipe deck on /a/{slug}).",
    read: BASE + "/api/articles/{slug}/contributions",
    write: BASE + "/api/protocol/contribute",
    related: ["provenance", "bundle"],
  },
  graph_topology: {
    id: "graph_topology",
    name: "Cross-article graph",
    what: "Merged claims/sources across condition+stack slugs for one question.",
    read: BASE + "/api/articles/{slug}/graph-topology?question=...",
    write: null,
    related: ["unified_graph", "topology", "ask"],
  },
  unified_graph: {
    id: "unified_graph",
    name: "Unified graph canvas",
    what:
      "Cross-article nodes+edges in one GET — filter by tier, posted_by, retractions, challenges, reflex, yield layers.",
    why: "Canvas is the article — one subgraph query replaces lossy context compression.",
    read:
      BASE +
      "/api/graph?slugs=protocol,bpc-157&tiers=human,system&include_challenges=true&depth=2",
    write: null,
    verifies: "counts.claims > 0 && counts.edges > 0",
    related: ["voxels", "graph_topology", "graph_reflex", "graph_yield", "graph_canvas"],
  },
  llm_manifest: {
    id: "llm_manifest",
    name: "LLM manifest",
    what: "Machine-readable read/write contract for external LLMs.",
    read: BASE + "/api/articles/llm-manifest",
    write: null,
    related: ["bundle", "system_map", "oip_article_hub", "oip_protocol"],
  },
  oip_article_hub: {
    id: "oip_article_hub",
    name: "OIP article hub",
    what: "Public article-native Object Invocation Protocol docs: /a/oip root, generated shelf/system/capability articles, machine bundles, token boundary, and receipt loop.",
    read: BASE + "/a/oip",
    read_md: BASE + "/api/articles/oip/bundle?format=markdown",
    write: "via directory rows and /api/dispatch receipts; docs are public, actions require scoped capability tokens or owner auth",
    related: ["oip_protocol", "oip_registry", "oip_invocations", "system_map", "llm_manifest"],
  },
  oip_protocol: {
    id: "oip_protocol",
    name: "Object Invocation Protocol",
    what: "Every capability is an invokable object: identify, explain, invoke, ledger, yield.",
    read: BASE + "/a/oip",
    read_md: BASE + "/api/articles/oip/bundle?format=markdown",
    write: BASE + "/api/dispatch",
    related: ["oip_article_hub", "oip_registry", "oip_invocations", "llm_manifest", "system_map"],
  },
  oip_registry: {
    id: "oip_registry",
    name: "OIP object registry",
    what: "Full registry of invokable directory objects with read/write paths and schemas.",
    read: BASE + "/api/dispatch?registry=1",
    write: null,
    related: ["oip_protocol", "oip_invocations"],
  },
  oip_invocations: {
    id: "oip_invocations",
    name: "OIP invocation log",
    what: "Yield and waste events for every dispatch invocation — trace, cost, material output.",
    read: BASE + "/api/invocations",
    write: "via POST /api/dispatch (automatic)",
    related: ["oip_protocol", "contributions"],
  },
  ledger_health: {
    id: "ledger_health",
    name: "Ledger health audit",
    what: "Orphan sources, missing posted_by, constitution slot gaps — per article.",
    read: BASE + "/api/articles/{slug}/health",
    write: BASE + "/api/protocol/repair",
    related: ["voxels", "constitution", "sources_ledger"],
  },
  ledger_repair: {
    id: "ledger_repair",
    name: "Ledger repair",
    what: "Wire claim↔source graph, backfill posted_by, materialize orphan sources as claims.",
    read: BASE + "/api/articles/{slug}/health",
    write: BASE + "/api/protocol/repair",
    related: ["ledger_health", "voxels", "populate"],
  },
  ledger_retract: {
    id: "ledger_retract",
    name: "Claim retraction",
    what: "Bad info stays on ledger; status:retracted + retraction event — never deleted.",
    read: BASE + "/api/articles/{slug}/topology?include_inactive=1",
    write: BASE + "/api/protocol/retract",
    related: ["ledger_challenge", "ask", "voxels"],
  },
  ledger_challenge: {
    id: "ledger_challenge",
    name: "Adversary challenge",
    what: "Counter-claim linked to target; downweights target; challenges[] edge in voxel graph.",
    write: BASE + "/api/protocol/challenge",
    related: ["ledger_retract", "review", "score"],
  },
  ledger_scrub: {
    id: "ledger_scrub",
    name: "Secret scrub",
    what: "Leaked API keys redacted to [REDACTED:secret-leak]; scrub_events tombstone for audit.",
    write: BASE + "/api/protocol/scrub",
    related: ["provenance", "ledger_health"],
  },
  kimi_collaborator: {
    id: "kimi_collaborator",
    name: "Kimi collaborator #1",
    what: "Kimi reads topology, posts claims with posted_by, optional challenge — first non-Grok writeback.",
    read: BASE + "/api/articles/{slug}/topology",
    write: BASE + "/api/protocol/collaborate",
    router: "[KIMI_COLLABORATE]{slug}[/KIMI_COLLABORATE]",
    related: ["gemini_collaborator", "ingest", "ledger_challenge", "poll"],
  },
  gemini_collaborator: {
    id: "gemini_collaborator",
    name: "Gemini collaborator #2",
    what: "Cheap Gemini pass after Kimi — gap-fill claims, optional adversary challenge on shared topology.",
    read: BASE + "/api/articles/{slug}/topology",
    write: BASE + "/api/protocol/collaborate",
    router: "[GEMINI_COLLABORATE]{slug}[/GEMINI_COLLABORATE]",
    related: ["kimi_collaborator", "ingest", "ledger_challenge"],
  },
  provenance_taxonomy: {
    id: "provenance_taxonomy",
    name: "Provenance taxonomy",
    what: "Canonical actor format: {provider}/{model} or system/{function}. Applied by repair with normalize_provenance:true.",
    read: BASE + "/api/articles/{slug}/contributions",
    write: BASE + "/api/protocol/repair",
    related: ["provenance", "ledger_repair", "claim_post"],
  },
  human_page: {
    id: "human_page",
    name: "Human article page",
    what: "Rendered article with claims, sources, copy widgets, ask prompts.",
    read: BASE + "/a/{slug}",
    write: null,
    related: ["bundle", "ask", "topology"],
  },
  graph_reflex: {
    id: "graph_reflex",
    name: "Reflex self-proof",
    what: "Live API probes vs protocol vision claims → conformance atoms with proves/responds_to edges.",
    why: "Graph recursively proves its own shape against documented weaknesses and novelty claims.",
    read: BASE + "/api/graph?slugs=protocol,bpc-157&layer=reflex",
    write: BASE + "/api/protocol/reflex",
    router: "[REFLEX_PASS]protocol[/REFLEX_PASS]",
    model: "system/reflex",
    verifies: "/api/graph?layer=reflex → reflex_claims > 0",
    related: ["unified_graph", "ledger_health", "graph_grow"],
  },
  graph_yield: {
    id: "graph_yield",
    name: "Model yield layer",
    what: "Per-pass $/claim and tok/claim under disclosed collaborate constraints.",
    why: "Cross-model economics auditable — participation comparable under same constitution.",
    read: BASE + "/api/graph?slugs={slug}&layer=yield",
    write: null,
    model: "all contributors",
    verifies: "/api/articles/{slug}/contributions → yield.usd_per_output",
    related: ["contributions", "kimi_collaborator", "gemini_collaborator"],
  },
  graph_query: {
    id: "graph_query",
    name: "Graph query (Dataview)",
    what: "Query live ledger: claims/sources/articles by tier, slot, posted_by.",
    why: "Obsidian Dataview queries files; this queries canonical atoms.",
    read: BASE + "/api/v1/query?from={slug}&kind=claim&where=tier=human",
    write: null,
    related: ["obsidian_vault", "voxels", "unified_graph"],
  },
  obsidian_vault: {
    id: "obsidian_vault",
    name: "Obsidian vault export",
    what: "Ontology folders, §SELF README, claims/sources/voxels per article, SHA256SUMS.",
    why: "Local-first UX on global ledger — edit feel, append-only sync.",
    read: BASE + "/api/articles/obsidian-vault?slugs={slug}",
    write: null,
    related: ["bundle", "graph_query", "obsidian_sync"],
  },
  obsidian_sync: {
    id: "obsidian_sync",
    name: "Obsidian bidirectional sync",
    what: "Local annotations → challenges on live graph; then pull fresh vault.",
    why: "Personal edits become adversarial commits, not silent overwrites.",
    read: null,
    write: "node scripts/obsidian_sync.mjs",
    related: ["obsidian_vault", "ledger_challenge"],
  },
  graph_canvas: {
    id: "graph_canvas",
    name: "Graph canvas UI",
    what: "Cytoscape canvas — reflex/yield/audit layers, claim cards, source vault.",
    why: "JSON is not a product; canvas is the article.",
    read: BASE + "/graph.html?slugs={slug}",
    write: null,
    related: ["unified_graph", "graph_reflex", "graph_yield"],
  },
  graph_grow: {
    id: "graph_grow",
    name: "Model growth queue",
    what: "Automated tick: populate → Kimi → Gemini → repair → reflex per slug priority.",
    why: "Models continuously queue articles, sources, and features without manual orchestration.",
    read: BASE + "/api/articles/ontology",
    write: BASE + "/api/protocol/grow",
    router: "[GRAPH_GROW][/GRAPH_GROW]",
    model: "grok + kimi + gemini + system",
    verifies: "sources↑ claims↑ contributions.models↑ reflex_last=today",
    related: ["populate", "kimi_collaborator", "gemini_collaborator", "graph_reflex", "ledger_repair"],
  },
  populate: {
    id: "populate",
    name: "Evidence populate",
    what: "Grok web-search loops — external URLs → hash-chained sources + claims.",
    why: "Break source monoculture; every claim needs real objects.",
    read: BASE + "/api/articles/{slug}/sources",
    write: BASE + "/api/protocol/populate",
    router: "[POPULATE]{slug}[/POPULATE]",
    model: "grok/grok-4.3",
    related: ["sources_ledger", "graph_grow", "ingest"],
  },
};

export const WIDGETS = {
  article_bundle: {
    feature: "bundle",
    paste_hint: "Reference block for Grok/GPT/Gemini. Section §SELF explains the system.",
  },
  article_topology: { feature: "topology" },
  article_voxels: { feature: "voxels" },
  article_ontology: { feature: "ontology" },
  article_constitution: { feature: "constitution" },
  article_question_graph: { feature: "question_graph" },
  article_ask_prompt: { feature: "ask" },
  article_ingest_paste: { feature: "ingest" },
  article_claim_post: { feature: "claim_post" },
  system_map: { feature: "system_map" },
  llm_manifest: { feature: "llm_manifest" },
  oip_article_bundle: { feature: "oip_article_hub" },
  oip_protocol: { feature: "oip_protocol" },
  oip_registry: { feature: "oip_registry" },
  oip_invocations: { feature: "oip_invocations" },
  ledger_health: { feature: "ledger_health" },
  ledger_repair: { feature: "ledger_repair" },
  graph_reflex: { feature: "graph_reflex" },
  graph_query: { feature: "graph_query" },
  obsidian_vault: { feature: "obsidian_vault" },
  graph_grow: { feature: "graph_grow" },
  unified_graph: { feature: "unified_graph" },
  graph_canvas: { feature: "graph_canvas" },
};

function slugUrl(template, slug) {
  return String(template || "").replace(/\{slug\}/g, slug || "{slug}");
}

function featureUrls(f, slug) {
  const out = {};
  if (f.read) out.read = slugUrl(f.read, slug);
  if (f.read_md) out.read_md = slugUrl(f.read_md, slug);
  if (f.write) out.write = slugUrl(f.write, slug);
  return out;
}

/** Structured _self block for JSON responses. */
export function selfMeta(widgetId, ctx = {}) {
  const widget = WIDGETS[widgetId] || { feature: widgetId };
  const feat = FEATURES[widget.feature] || FEATURES.system_map;
  const slug = ctx.slug || null;
  const related = (feat.related || [])
    .map((id) => FEATURES[id])
    .filter(Boolean)
    .map((r) => ({
      id: r.id,
      name: r.name,
      what: r.what,
      urls: featureUrls(r, slug),
    }));

  return {
    principle:
      "Self-explaining payload — no external context required. This _self block describes what you are reading and where to look next.",
    widget: widgetId,
    feature: feat.id,
    name: feat.name,
    what: feat.what,
    contains: ctx.contains || null,
    slug,
    urls: featureUrls(feat, slug),
    how_to_use: ctx.how_to_use || widget.paste_hint || feat.what,
    write: feat.write ? slugUrl(feat.write, slug) : null,
    imessage: feat.imessage ? slugUrl(feat.imessage, slug) : null,
    router_tag: feat.router || null,
    proof_chain: [
      { step: 1, claim: "Articles are voxel graphs of tiered claims, not prose blobs.", verify: slugUrl(FEATURES.constitution.read, slug) },
      { step: 2, claim: "Claims link to hash-chained sources via source_ids.", verify: slugUrl(FEATURES.sources_ledger.read, slug) },
      { step: 3, claim: "Ask reads topology; ingest/claim append to ledger.", verify: BASE + "/api/protocol" },
      { step: 4, claim: "Models queue growth: populate → collaborate → repair → reflex.", verify: BASE + "/api/protocol/grow" },
      { step: 5, claim: "Graph proves its own shape (reflex) and $/claim (yield).", verify: BASE + "/graph.html?layer=reflex" },
      { step: 6, claim: "Full feature index + _explain on every API response.", verify: FEATURES.system_map.read },
    ],
    related_features: related,
    system_map: FEATURES.system_map.read,
    system_map_markdown: FEATURES.system_map.read_md,
    not_medical_advice: true,
  };
}

function buildExplain(widgetId, ctx = {}) {
  const widget = WIDGETS[widgetId] || { feature: widgetId };
  const feat = FEATURES[widget.feature] || FEATURES[widgetId] || {};
  const slug = ctx.slug || "{slug}";
  const urls = {};
  if (feat.read) urls.read = slugUrl(feat.read, slug);
  if (feat.write) urls.write = slugUrl(feat.write, slug);
  return {
    feature: feat.id || widget.feature || widgetId,
    name: feat.name || widgetId,
    what: feat.what || ctx.contains,
    why: feat.why || "Every feature is auditable collective intelligence",
    how: ctx.how_to_use || feat.what,
    model: feat.model || null,
    verifies: feat.verifies ? slugUrl(feat.verifies, slug) : null,
    urls,
    imessage: feat.imessage ? slugUrl(feat.imessage, slug) : null,
    router: feat.router || null,
    related: (feat.related || []).map((id) => ({ id, what: FEATURES[id]?.what })),
    not_medical_advice: true,
  };
}

/** Attach _self + _explain to any JSON payload. */
export function attachSelf(data, widgetId, ctx = {}) {
  const _explain = buildExplain(widgetId, ctx);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { _self: selfMeta(widgetId, ctx), _explain, data };
  }
  if (data.error) {
    return {
      _self: selfMeta(widgetId, { ...ctx, contains: "error response" }),
      _explain,
      ...data,
    };
  }
  return { _self: selfMeta(widgetId, ctx), _explain, ...data };
}

/** Markdown header/footer for paste widgets. */
export function selfMarkdown(widgetId, ctx = {}) {
  const s = selfMeta(widgetId, ctx);
  const lines = [
    "## §SELF — miscsubjects portable reference",
    "",
    "**Principle:** " + s.principle,
    "",
    "**This widget:** `" + s.widget + "` — **" + s.name + "**",
    s.what,
  ];
  if (s.slug) lines.push("- **article slug:** `" + s.slug + "`");
  if (s.contains) lines.push("- **contains:** " + s.contains);
  if (s.how_to_use) lines.push("- **how to use:** " + s.how_to_use);
  if (s.urls?.read) lines.push("- **read:** " + s.urls.read);
  if (s.write) lines.push("- **write:** " + s.write);
  if (s.imessage) lines.push("- **iMessage:** `" + s.imessage + "`");
  if (s.router_tag) lines.push("- **ROUTER tag:** `" + s.router_tag + "`");
  lines.push("");
  lines.push("### Logical proof (verify each step)");
  for (const p of s.proof_chain) {
    lines.push(p.step + ". " + p.claim + " → " + p.verify);
  }
  lines.push("");
  lines.push("### Related features (explains other parts of the system)");
  for (const r of s.related_features) {
    lines.push("- **" + r.id + "** — " + r.what + (r.urls?.read ? " · " + r.urls.read : ""));
  }
  lines.push("");
  lines.push("### Full index");
  lines.push("- JSON: " + s.system_map);
  lines.push("- Markdown: " + s.system_map_markdown);
  lines.push("");
  lines.push("### §STRUCTURE");
  lines.push(structureSelfBlock(ctx.structure && ctx.structure.metrics));
  lines.push("");
  lines.push("### §INTEGRITY");
  lines.push(INTEGRITY_CLAUSE);
  lines.push("");
  lines.push("### §GAUNTLET");
  lines.push(GAUNTLET_CLAUSE);
  lines.push("");
  lines.push("*Not medical advice. Tier-honest. Cite claim/source ids.*");
  return lines.join("\n");
}

/** Full system map — root explainer for humans and LLMs. */
export function systemMapPayload(ctx = {}) {
  const slug = ctx.slug || null;
  const features = Object.values(FEATURES).map((f) => ({
    id: f.id,
    name: f.name,
    what: f.what,
    urls: featureUrls(f, slug),
    imessage: f.imessage ? slugUrl(f.imessage, slug) : null,
    router: f.router || null,
    related: f.related || [],
  }));
  return {
    site: BASE,
    version: 1,
    principle:
      "miscsubjects article ledger is self-explaining. Every API response and copy widget includes _self or §SELF. This endpoint is the root index.",
    invariants: [
      "Append-only revisions (?rev=n)",
      "Source hash-chain verifies integrity, not truth",
      "One claim = one falsifiable assertion with tier + who_claims",
      "Ask answers only from topology; gaps are explicit",
      "Not medical advice",
    ],
    read_order: [
      "system_map (this)",
      "constitution",
      "llm-manifest",
      "{slug}/topology",
      "{slug}/voxels",
      "{slug}/bundle?format=markdown",
    ],
    write_order: [
      "POST /api/protocol/ask — question node",
      "POST /api/protocol/ingest — evidence paste",
      "POST /api/protocol/claim — single assertion",
      "POST /api/protocol/sources — citations only",
    ],
    features,
    // THE TOTAL STRUCTURE — the protocol's source philosophy, machine-traversable.
    // Walk: shelf.next until null. Every stop: human page, JSON, bundle. Graph: /api/articles/oip/voxels.
    total_structure: {
      what: "The unified philosophy the protocol implements (12 axioms, moral floor, obligation, terrain, method, machine plane, object grammar, designer, wall, amendment protocol, falsification) — full text, verbatim, as traversable voxels.",
      root: { human: BASE + "/a/oip-total-structure", json: BASE + "/api/articles/oip-total-structure", shelf: BASE + "/api/articles/oip-total-structure/shelf", bundle: BASE + "/api/articles/oip-total-structure/bundle?format=markdown" },
      traversal: "GET /api/articles/oip-total-structure/shelf → all[] in reading order with prev/next per voxel; or follow shelf.next from any voxel's JSON.",
      voxel_graph: BASE + "/api/articles/oip/voxels",
      drop: BASE + "/api/articles/oip-total-structure/drop",
      mcp_relation: "MCP is tool/session access. OIP is accountable work-object execution above and around tools, including MCP tools.",
      objections: "POST " + BASE + "/api/articles/<slug>/objections {objection, actor, surface?} — open intake, ledgered; settled ground is relitigation-checked.",
      verbatim_law: "Philosophy voxels are prose-preserving. Recursion prosecutes them; it does not rewrite them unless the owner accepts an amendment.",
      thread_state: BASE + "/api/protocol/thread-state?target=oip",
      operator_mode: "Protocol status: operator mode. No new doctrine. No new architecture. Read thread-state, post material updates, accept useful deltas, route objections through the ledger. The protocol evolves through accepted material deltas, not repeated owner re-explanation.",
      books: [
        "oip-ground", "oip-obligation", "oip-terrain", "oip-method", "oip-machine-plane",
        "oip-object-grammar", "oip-the-designer", "oip-beyond-incentive", "oip-amendment-protocol", "oip-falsification",
      ],
    },
    widgets: Object.keys(WIDGETS),
    maintenance_questions: [
      "GET /api/articles/{slug}/health — ok? issues?",
      "POST /api/protocol/grow — what step ran? plans priority?",
      "GET /api/graph?layer=reflex|yield — reflex_claims? passes?",
      "GET /api/selftest?graph=1 — score and ask fallback count?",
      "GET /api/articles/ontology — misstep_candidates count?",
      "For top slugs: claims, sources, contributions.models, yield.usd_per_output?",
      "Provenance + source chains valid:true on head articles?",
      "GET /api/articles/obsidian-vault — file_count, SHA256SUMS?",
    ],
  };
}

export function systemMapMarkdown(ctx = {}) {
  const payload = systemMapPayload(ctx);
  const lines = [
    "# miscsubjects system map",
    "",
    payload.principle,
    "",
    "## Invariants",
    ...payload.invariants.map((i) => "- " + i),
    "",
    "## Suggested read order",
    ...payload.read_order.map((r, i) => i + 1 + ". " + slugUrl(r, ctx.slug)),
    "",
    "## Write paths",
    ...payload.write_order.map((w) => "- " + w),
    "",
    "## Feature index",
  ];
  for (const f of payload.features) {
    lines.push("### " + f.id + " — " + f.name);
    lines.push(f.what);
    if (f.urls?.read) lines.push("- read: " + f.urls.read);
    if (f.urls?.read_md) lines.push("- read_md: " + f.urls.read_md);
    if (f.urls?.write) lines.push("- write: " + f.urls.write);
    if (f.imessage) lines.push("- imessage: `" + f.imessage + "`");
    if (f.router) lines.push("- router: `" + f.router + "`");
    if (f.related?.length) lines.push("- related: " + f.related.join(", "));
    lines.push("");
  }
  lines.push("---");
  lines.push(selfMarkdown("system_map", ctx));
  return lines.join("\n");
}

/** Text prepended to iMessage/WhatsApp copy buttons. */
export function askPasteBlock(slug, imessageBody, extra = {}) {
  const header = selfMarkdown("article_ask_prompt", {
    slug,
    contains: "suggested ask prompt for miscsubjects build",
    how_to_use:
      "Text [BUILD_PHONE] or WhatsApp this message. Creates a question_node. Reply with ingest to add evidence.",
  });
  const body = [
    "",
    "## Prompt to send",
    "",
    imessageBody,
  ];
  if (extra.ingest_hint) body.push("", "## After you get a question_node_id", extra.ingest_hint);
  body.push(
    "",
    "## Write back (quote evidence from another model)",
    "`ingest " + slug + "|q:NODE_ID|quoted evidence`",
    "",
    "## Post one claim",
    "`claim " + slug + "|tier|assertion — who claims it?`",
  );
  return header + body.join("\n");
}

/** Wrap markdown body with §SELF header. */
export function wrapMarkdown(widgetId, body, ctx = {}) {
  return selfMarkdown(widgetId, ctx) + "\n\n---\n\n" + body + "\n\n---\n\n" + selfMarkdown("system_map", ctx);
}
