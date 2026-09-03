// Full article bundle — body + ledger + provenance + LLM manifest (paste into Grok/GPT/Gemini).

import { loadArticleTopology } from "./article_topology.js";
import {
  slimClaimsForExport,
  slimSourcesForExport,
} from "./ledger_slim.js";
import { loadQuestionGraph } from "./question_graph.js";
import { buildVoxelGraph, vxProcedure } from "./voxel_graph.js";
import {
  ARTICLE_CONSTITUTION,
  constitutionMarkdown,
} from "./article_constitution.js";
import { attachSelf, selfMarkdown, wrapMarkdown } from "./self_explain.js";

const BASE = "https://miscsubjects.com";

export const LLM_LEDGER_MANIFEST = {
  version: "1",
  site: BASE,
  purpose:
    "Peptide evidence articles with hash-chained source ledgers, tiered claims, and a question graph. LLMs should READ bundles/URLs and WRITE back via ingest — never invent doses.",
  read: {
    human_page: BASE + "/a/{slug}",
    bundle_json: BASE + "/api/articles/{slug}/bundle",
    bundle_markdown: BASE + "/api/articles/{slug}/bundle?format=markdown",
    topology: BASE + "/api/articles/{slug}/topology",
    question_graph: BASE + "/api/articles/{slug}/question-graph",
    sources: BASE + "/api/articles/{slug}/sources",
    provenance: BASE + "/api/articles/{slug}/provenance",
    contributions: BASE + "/api/articles/{slug}/contributions",
    graph_topology: BASE + "/api/articles/{slug}/graph-topology?question={question}",
    voxels: BASE + "/api/articles/{slug}/voxels",
    constitution: BASE + "/api/articles/constitution",
    ontology: BASE + "/api/articles/ontology",
    system_map: BASE + "/api/articles/system-map",
    system_map_markdown: BASE + "/api/articles/system-map?format=markdown",
    health: BASE + "/api/articles/{slug}/health",
    repair: "POST " + BASE + "/api/protocol/repair",
    list_articles: BASE + "/api/articles",
    graph_canvas: BASE + "/graph.html?slugs={slug}",
    graph_yield: BASE + "/api/graph?slugs={slug}&layer=yield",
    obsidian_vault: BASE + "/api/articles/obsidian-vault?slugs={slug}",
    graph_query: BASE + "/api/v1/query?from={slug}&kind=claim&where=tier=human",
  },
  ask: {
    description: "Answer only from topology; creates a question_node with gaps.",
    api: "POST " + BASE + "/api/protocol/ask",
    body: { slug: "{slug}", question: "string" },
    imessage: "{slug}|your question",
    router_tag: "[ARTICLE_ASK]{slug}|question[/ARTICLE_ASK]",
    auth: "x-terminal-key header for API; iMessage/WhatsApp via miscsubjects build",
  },
  ingest: {
    description: "Parse pasted evidence → source ledger + claims + evidence_ingest node.",
    api: "POST " + BASE + "/api/protocol/ingest",
    body: { slug: "{slug}", evidence: "paste text", question_node_id: "optional qn_..." },
    imessage: "ingest {slug}|q:{node_id}|paste from this model",
    router_tag: "[ARTICLE_INGEST]{slug}|evidence[/ARTICLE_INGEST]",
    tiers: ["human", "preclinical", "anecdotal", "mechanistic", "speculative"],
  },
  claim: {
    description:
      "Prompt-injection style POST — one claim voxel with who_claims + posted_by provenance.",
    api: "POST " + BASE + "/api/protocol/claim",
    body: {
      slug: "{slug}",
      text: "one assertion",
      tier: "human|preclinical|anecdotal|mechanistic|speculative",
      who_claims: "study author, platform, or model id",
      source_ids: "optional [s1]",
    },
    imessage: "claim {slug}|{tier}|assertion — who claims it?",
    router_tag: "[ARTICLE_CLAIM]{slug}|{tier}|assertion[/ARTICLE_CLAIM]",
    slots: ["what_it_is", "who_claims_what", "what_is_known", "what_is_unknown", "mechanism", "limitations", "disclaimer"],
  },
  tiers: {
    human: 0.8,
    preclinical: 0.5,
    anecdotal: 0.3,
    mechanistic: 0.3,
    speculative: 0.1,
  },
  invariants: [
    "Self-explaining — every API JSON has _self; every paste widget has §SELF; root index at /api/articles/system-map",
    "Append-only — revisions preserved at ?rev=n",
    "Source chain verifies integrity, not truth",
    "Answers must cite claim ids and source ids from topology",
    "Not medical advice",
  ],
};

function parseMeta(m) {
  try {
    return JSON.parse(m || "{}") || {};
  } catch {
    return {};
  }
}

async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

function provBody(e) {
  return [
    e.prev,
    e.ts,
    e.model,
    e.action,
    e.prompt,
    e.input,
    e.response,
    e.tokens_in,
    e.tokens_out,
  ].join("|");
}

function srcBody(e) {
  return [
    e.prev,
    e.accessed_at,
    e.type,
    e.url,
    e.title,
    e.quote,
    e.summary,
    (e.claim_ids || []).join(","),
  ].join("|");
}

async function verifyProv(list) {
  let prev = "genesis";
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.prev !== prev) return { valid: false, broken_at: i };
    const h = await sha256(provBody(e));
    if (h !== e.hash) return { valid: false, broken_at: i };
    prev = e.hash;
  }
  return { valid: true, entries: list.length, head: list.length ? list[list.length - 1].hash : "genesis" };
}

async function verifySources(list) {
  let prev = "genesis";
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.prev !== prev) return { valid: false, broken_at: i };
    const h = await sha256(srcBody(e));
    if (h !== e.hash) return { valid: false, broken_at: i };
    prev = e.hash;
  }
  return { valid: true, entries: list.length, head: list.length ? list[list.length - 1].hash : "genesis" };
}

/** Build complete bundle for one article. opts.slim=true → ranked subset, no duplicate topology blob. */
// One root claim → 3–7 load-bearing children → standing objections stated honestly →
// verbs → reads_next. Identity pins slug/version/hash/thread_head so every downstream
// write can CAS against exactly what was read.
async function buildMasthead(env, s, row, meta, claimsRaw) {
  const enc = new TextEncoder().encode(String(row.body || ""));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bodySha = [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
  let disc = null;
  try {
    const { readDiscourse } = await import("./discourse_widgets.js");
    disc = await readDiscourse(env, s, 100);
  } catch { /* discourse plane optional */ }
  const claims = Array.isArray(claimsRaw) ? claimsRaw.filter((c) => (c.status || "active") === "active") : [];
  // Thesis = the designated root claim (meta.masthead.root_claim_id) or c1 when it reads as
  // an assertion. FLAG when neither reduces the article to one falsifiable root claim.
  const rootId = meta.masthead?.root_claim_id || (claims[0] && claims[0].id) || null;
  const root = claims.find((c) => c.id === rootId) || null;
  const thesisOk = !!(root && String(root.text || "").trim().length >= 20);
  const loadBearing = claims
    .filter((c) => c.id !== rootId)
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))
    .slice(0, Math.max(3, Math.min(7, claims.length - 1)))
    .map((c) => ({ id: c.id, tier: c.tier, status: c.status || "active", text: String(c.text || "").slice(0, 160) }));
  const divs = Array.isArray(meta.divs) ? meta.divs : [];
  // sorry-status (GUM P4, answers obj-54 structurally): the masthead states in public how
  // many claims still rest on unbacked assertions — the gap is displayed, not argued.
  const claimDivs = divs.filter((d) => d.type === "claim" && (d.status || "active") === "active");
  const unbackedDivs = claimDivs.filter((d) => !(Array.isArray(d.sources) && d.sources.length));
  return {
    sorry_status: claimDivs.length
      ? unbackedDivs.length + " of " + claimDivs.length + " claim-DIVs rest on unbacked assertions (backed=false in /voxels) — displayed, shrinking, never hidden"
      : "planes not merged yet — sorry-status activates after voxel-merge-planes",
    identity: {
      slug: s,
      version: Array.isArray(meta.revisions) ? meta.revisions.length + 1 : 1,
      content_hash: bodySha,
      thread_head: disc?.thread_head || null,
      divs: divs.filter((d) => (d.status || "active") === "active").length || null,
    },
    thesis: thesisOk
      ? { root_claim: root.id, text: String(root.text).slice(0, 300), tier: root.tier }
      : { FLAGGED: "this article's thesis does not reduce to one falsifiable root claim — audit finding, not fudged", candidates: claims.slice(0, 2).map((c) => c.id) },
    load_bearing: loadBearing,
    standing_objections: disc
      ? { open: disc.counts.open, strongest_open: disc.strongest_open ? disc.strongest_open.gist : null, link: BASE + "/api/articles/" + s + "/discourse" }
      : { open: "UNKNOWN", note: "discourse index unavailable" },
    verbs: {
      read: "GET " + BASE + "/api/articles/" + s + "/voxels — DIVs + hashes + chains (free)",
      read_claims: "GET " + BASE + "/api/articles/" + s + "/claims — every formal claim as claim:<id> with current hash, thread, stable link, and exact contribution/edit bodies",
      challenge: "POST " + BASE + "/api/protocol/voxel-challenge {slug, expected_thread_head, target_div?, expected_hash?, body, actor} — read /discourse first; no key needed; returns the stable widget link",
      attest: "POST " + BASE + "/api/protocol/voxel-attest {slug, outcome, content_hash, actor} — close your read with one of four outcomes",
      mutate: "voxel-edit / voxel-move / voxel-consolidate — CAS-gated, needs a key scoped rows:VOXEL_* from the owner",
    },
    reads_next: [BASE + "/a/philosophy", BASE + "/api/articles/" + s + "/discourse", BASE + "/api/protocol"],
  };
}

export async function buildArticleBundle(env, slug, opts = {}) {
  const slim = opts.slim !== false;
  const s = String(slug || "").trim().toLowerCase();
  if (!s || !env.DB) return { error: "need slug" };

  const row = await env.DB.prepare(
    "SELECT slug, title, body, meta, created_at, updated_at FROM articles WHERE slug=?",
  )
    .bind(s)
    .first();
  if (!row) return { error: "article not found: " + s };

  const meta = parseMeta(row.meta);
  const topo = slim ? null : await loadArticleTopology(env, s, { question_limit: 16 });
  const qgraph = await loadQuestionGraph(env, s, { limit: slim ? 8 : 16 });

  const provenance = Array.isArray(meta.provenance) ? meta.provenance : [];
  const sourcesRaw = Array.isArray(meta.sources) ? meta.sources : [];
  const claimsRaw = Array.isArray(meta.claims) ? meta.claims : [];
  const claims = slim
    ? slimClaimsForExport(claimsRaw, sourcesRaw)
    : claimsRaw;
  const sources = slim
    ? slimSourcesForExport(sourcesRaw, claimsRaw)
    : sourcesRaw;
  const contributions = Array.isArray(meta.contributions) ? meta.contributions : [];

  const provVerify = await verifyProv(provenance);
  // Verify the complete stored chain, not the slim export projection. The projection
  // intentionally omits prev/accessed_at/full hashes, so validating it manufactures a
  // broken_at:0 result even when /sources proves the persisted ledger is intact.
  const srcVerify = await verifySources(sourcesRaw);
  const voxels = slim
    ? {
        slug: s,
        counts: buildVoxelGraph(s, meta).counts,
        note: "slim bundle — full voxels at /api/articles/" + s + "/voxels",
      }
    : buildVoxelGraph(s, meta);

  const manifest = {
    ...LLM_LEDGER_MANIFEST,
    read: Object.fromEntries(
      Object.entries(LLM_LEDGER_MANIFEST.read).map(([k, v]) => [
        k,
        String(v).replace(/\{slug\}/g, s),
      ]),
    ),
    ask: {
      ...LLM_LEDGER_MANIFEST.ask,
      imessage: s + "|your question",
      router_tag: "[ARTICLE_ASK]" + s + "|question[/ARTICLE_ASK]",
    },
    ingest: {
      ...LLM_LEDGER_MANIFEST.ingest,
      imessage: "ingest " + s + "|q:{node_id}|paste evidence",
      router_tag: "[ARTICLE_INGEST]" + s + "|evidence[/ARTICLE_INGEST]",
    },
    claim: {
      ...LLM_LEDGER_MANIFEST.claim,
      imessage: "claim " + s + "|tier|assertion — who claims it?",
      router_tag: "[ARTICLE_CLAIM]" + s + "|tier|assertion[/ARTICLE_CLAIM]",
    },
    constitution: ARTICLE_CONSTITUTION,
    this_article: {
      slug: s,
      url: BASE + "/a/" + s,
      bundle_url: BASE + "/api/articles/" + s + "/bundle?format=markdown",
    },
    voxel_procedure: vxProcedure(s),
  };

  // MASTHEAD (W13, owner ship-order 2026-07-16): the uniform ≤500-token block that opens
  // every bundle. Building it doubles as an audit: an article whose thesis cannot be stated
  // as ONE falsifiable root claim is FLAGGED, never fudged.
  const masthead = await buildMasthead(env, s, row, meta, claimsRaw);

  const raw = {
    MASTHEAD: masthead,
    bundle_version: 1,
    generated_at: new Date().toISOString(),
    slug: s,
    title: row.title,
    url: BASE + "/a/" + s,
    register: meta.register || "standard",
    tags: meta.tags || [],
    posted_at: meta.posted_at || row.created_at,
    updated_at: row.updated_at,
    body: row.body || "",
    claims,
    sources,
    voxels,
    constitution: slim ? { url: BASE + "/api/articles/constitution" } : ARTICLE_CONSTITUTION,
    provenance: slim ? provenance.slice(-8).map((p) => ({
      action: p.action,
      model: p.model,
      ts: p.ts,
      hash: p.hash ? String(p.hash).slice(0, 16) : null,
      tokens_in: p.tokens_in,
      tokens_out: p.tokens_out,
    })) : provenance,
    contributions: contributions.map((c) => ({
      id: c.id,
      ts: c.ts,
      model: c.model,
      role: c.role,
      action: c.action,
      rationale: (c.rationale || "").slice(0, 500),
      hash: c.hash,
    })),
    topology: slim ? null : topo && !topo.error ? topo : null,
    slim,
    ledger_totals: slim
      ? { claims: claimsRaw.length, sources: sourcesRaw.length, exported_claims: claims.length, exported_sources: sources.length }
      : undefined,
    question_graph: qgraph,
    verification: {
      provenance: provVerify,
      sources: srcVerify,
    },
    counts: {
      claims: claims.length,
      sources: sources.length,
      provenance: provenance.length,
      contributions: contributions.length,
      questions: qgraph.questions?.length || 0,
      evidence_ingests: qgraph.evidence?.length || 0,
      voxel_edges: voxels.counts?.edges || 0,
    },
    transport: "Open every URL in this bundle with your browser or web / URL-fetch tool. Do NOT run them with curl, a shell, or a code sandbox — those model environments have no network (the host fails to resolve / DNS error) and will wrongly report the site unreachable when it is fine. Opening the link IS the call.",
    llm_manifest: manifest,
    api_urls: {
      bundle: BASE + "/api/articles/" + s + "/bundle",
      bundle_markdown: BASE + "/api/articles/" + s + "/bundle?format=markdown",
      topology: BASE + "/api/articles/" + s + "/topology",
      voxels: BASE + "/api/articles/" + s + "/voxels",
      constitution: BASE + "/api/articles/constitution",
      ontology: BASE + "/api/articles/ontology",
      question_graph: BASE + "/api/articles/" + s + "/question-graph",
      ask: BASE + "/api/protocol/ask",
      ingest: BASE + "/api/protocol/ingest",
      claim: BASE + "/api/protocol/claim",
      system_map: BASE + "/api/articles/system-map",
      system_map_markdown: BASE + "/api/articles/system-map?format=markdown",
    },
  };
  return attachSelf(raw, "article_bundle", {
    slug: s,
    contains:
      "body, claims, sources, voxels, provenance, question graph, constitution, llm_manifest",
    how_to_use:
      "Reference bundle for an LLM or reader. §SELF explains the surface; ingest and claim endpoints in llm_manifest are the write-back routes.",
  });
}

/** Plain-text / markdown paste for LLM chat windows. */
export function formatBundleMarkdown(bundle) {
  if (!bundle || bundle.error) return "# Error\n" + (bundle?.error || "unknown");
  const slug = bundle.slug;
  const ctx = {
    slug,
    contains:
      "body, claims, sources, voxels, provenance, question graph, constitution, llm_manifest",
  };

  const lines = [];
  lines.push("# miscsubjects article bundle");
  lines.push("");
  lines.push("> Reference bundle for Grok, GPT, Gemini, or a human reader. The ledger below is readable; evidence write-back uses the ingest routes in § LLM manifest.");
  lines.push("");
  const mh = bundle.MASTHEAD;
  if (mh) {
    lines.push("## MASTHEAD");
    lines.push("- **identity:** `" + mh.identity.slug + "` v" + mh.identity.version + " · content_hash `" + String(mh.identity.content_hash).slice(0, 16) + "…` · thread_head " + (mh.identity.thread_head || "none") + (mh.identity.divs ? " · " + mh.identity.divs + " DIVs" : ""));
    if (mh.thesis.FLAGGED) lines.push("- **thesis:** FLAGGED — " + mh.thesis.FLAGGED);
    else lines.push("- **thesis (" + mh.thesis.root_claim + "):** " + mh.thesis.text);
    for (const c of mh.load_bearing || []) lines.push("  - " + c.id + " [" + (c.tier || "?") + "/" + c.status + "] " + c.text);
    if (mh.sorry_status) lines.push("- **sorry-status:** " + mh.sorry_status);
    lines.push("- **standing objections:** " + mh.standing_objections.open + " open" + (mh.standing_objections.strongest_open ? " · strongest: " + mh.standing_objections.strongest_open : "") + " → " + (mh.standing_objections.link || ""));
    lines.push("- **verbs:** read free · challenge/attest open · edit/move/consolidate CAS-gated with a rows:VOXEL_* key");
    lines.push("- **reads_next:** " + (mh.reads_next || []).join(" · "));
    lines.push("");
  }
  lines.push("## Article");
  lines.push("- **slug:** `" + bundle.slug + "`");
  lines.push("- **title:** " + bundle.title);
  lines.push("- **url:** " + bundle.url);
  lines.push("- **register:** " + (bundle.register || "standard"));
  lines.push("- **updated:** " + (bundle.updated_at || ""));
  if (bundle.tags?.length) lines.push("- **tags:** " + bundle.tags.join(", "));
  lines.push("");
  lines.push("## Body");
  lines.push("");
  lines.push(bundle.body || "(empty)");
  lines.push("");
  const claimTotal = bundle.ledger_totals?.claims || bundle.counts?.claims || 0;
  const exported = bundle.claims?.length || 0;
  lines.push(
    "## Claims (" +
      exported +
      (bundle.slim && claimTotal > exported ? " of " + claimTotal + " ranked" : "") +
      ")",
  );
  lines.push("");
  for (const c of bundle.claims || []) {
    lines.push(
      "- **" +
        c.id +
        "** [" +
        (c.tier || "?") +
        " w=" +
        (c.weight != null ? c.weight : "?") +
        "] " +
        (c.text || ""),
    );
    if (c.who_claims || c.posted_by?.actor)
      lines.push("  - who_claims: " + (c.who_claims || c.posted_by.actor));
    if (c.slot) lines.push("  - slot: " + c.slot);
    if (c.why_material) lines.push("  - why: " + c.why_material);
    if (c.source_ids?.length) lines.push("  - sources: " + c.source_ids.join(", "));
    if (c.posted_by?.channel)
      lines.push(
        "  - posted_by: " +
          c.posted_by.actor +
          " via " +
          c.posted_by.channel +
          " @ " +
          String(c.posted_by.ts || "").slice(0, 16),
      );
  }
  lines.push("");
  if (bundle.slim) {
    lines.push(
      "## Voxel graph (" +
        (bundle.voxels?.counts?.voxels || bundle.counts?.claims || 0) +
        " atoms · " +
        (bundle.voxels?.counts?.edges || 0) +
        " edges)",
    );
    lines.push("- full graph: " + (bundle.api_urls?.voxels || ""));
  } else {
    lines.push("## Voxel graph (" + (bundle.voxels?.counts?.voxels || 0) + " atoms · " + (bundle.voxels?.counts?.edges || 0) + " edges)");
    lines.push("- live: " + (bundle.api_urls?.voxels || ""));
    for (const v of (bundle.voxels?.voxels || []).slice(0, 24)) {
      const edgeTypes = (v.edges || []).map((e) => e.type).join(", ");
      lines.push(
        "- **" +
          v.id +
          "** edges[" +
          edgeTypes +
          "]" +
          (v.who_claims ? " who=" + v.who_claims : ""),
      );
    }
  }
  lines.push("");
  lines.push("## Article constitution");
  lines.push("");
  if (bundle.slim) {
    lines.push("- full: " + (bundle.api_urls?.constitution || BASE + "/api/articles/constitution"));
  } else {
    lines.push(constitutionMarkdown(slug));
  }
  lines.push("");
  const srcTotal = bundle.ledger_totals?.sources || bundle.counts?.sources || 0;
  const srcExported = bundle.sources?.length || 0;
  lines.push(
    "## Source ledger (" +
      srcExported +
      (bundle.slim && srcTotal > srcExported ? " of " + srcTotal : "") +
      ")",
  );
  lines.push(
    "- chain valid: " +
      (bundle.verification?.sources?.valid ? "yes" : "no") +
      " · head: `" +
      String(bundle.verification?.sources?.head || "").slice(0, 16) +
      "`",
  );
  lines.push("");
  for (const src of bundle.sources || []) {
    lines.push(
      "### " +
        src.id +
        " · " +
        (src.type || "other") +
        (src.link_status ? " · " + src.link_status : ""),
    );
    if (src.title) lines.push("- title: " + src.title);
    if (src.url) lines.push("- url: " + src.url);
    if (src.summary) lines.push("- summary: " + src.summary);
    if (src.quote) lines.push("- quote: " + String(src.quote).slice(0, 800));
    if (src.claim_ids?.length) lines.push("- claim_ids: " + src.claim_ids.join(", "));
    lines.push("- hash: `" + String(src.hash || "").slice(0, 16) + "`");
    lines.push("");
  }
  lines.push("## Provenance (" + (bundle.counts?.provenance || 0) + " model passes)");
  lines.push(
    "- chain valid: " +
      (bundle.verification?.provenance?.valid ? "yes" : "no") +
      " · head: `" +
      String(bundle.verification?.provenance?.head || "").slice(0, 16) +
      "`",
  );
  lines.push("");
  for (const p of (bundle.provenance || []).slice(-12)) {
    lines.push(
      "- " +
        (p.action || "?") +
        " · " +
        (p.model || "?") +
        " · " +
        String(p.ts || "").slice(0, 16) +
        " · hash `" +
        String(p.hash || "").slice(0, 12) +
        "`",
    );
  }
  lines.push("");
  lines.push("## Question graph");
  lines.push(
    "- questions: " +
      (bundle.counts?.questions || 0) +
      " · evidence ingests: " +
      (bundle.counts?.evidence_ingests || 0),
  );
  for (const q of (bundle.question_graph?.questions || []).slice(0, 8)) {
    lines.push(
      "- **" +
        q.node_id +
        "** [" +
        q.status +
        "] " +
        String(q.question || "").slice(0, 120),
    );
    if (q.gaps?.length) lines.push("  - gaps: " + q.gaps.join("; "));
  }
  lines.push("");
  lines.push("## LLM manifest — how to communicate with this ledger");
  lines.push("");
  if (bundle.slim) {
    lines.push("- system map: " + (bundle.api_urls?.system_map_markdown || ""));
    lines.push("- topology (ranked): " + (bundle.api_urls?.topology || ""));
    lines.push("- ingest: POST " + BASE + "/api/protocol/ingest");
    lines.push("- claim: POST " + BASE + "/api/protocol/claim");
  } else {
    lines.push("```json");
    lines.push(JSON.stringify(bundle.llm_manifest, null, 2));
    lines.push("```");
  }
  lines.push("");
  lines.push("### Quick actions for this article");
  lines.push("- **Read live:** " + bundle.api_urls.topology);
  lines.push("- **Ask (API):** POST " + bundle.api_urls.ask + ' `{"slug":"' + bundle.slug + '","question":"..."}`');
  lines.push("- **Ingest your findings:** POST " + bundle.api_urls.ingest + ' or text `ingest ' + bundle.slug + '|your evidence`');
  lines.push("- **Post one claim:** POST " + bundle.api_urls.claim + ' or text `claim ' + bundle.slug + '|tier|assertion`');
  lines.push("- **iMessage ask:** `" + bundle.slug + "|your question`");
  lines.push("- **System map:** " + (bundle.api_urls?.system_map_markdown || BASE + "/api/articles/system-map?format=markdown"));
  lines.push("");
  return wrapMarkdown("article_bundle", lines.join("\n"), ctx);
}
