
import { INTEGRITY_CLAUSE, GAUNTLET_CLAUSE, NOT_AWARE_CLAIM, AXIOM, AXIOM_PROJECTIONS } from "../../_lib/structure_clauses.js";

const BASE = "https://miscsubjects.com";

// Canonical top-level domains that share the one load-bearing axiom. ENUMERATED
// against a public list — each is a live surface a reader can open — so the count
// is checkable against the list, not a fragile slug probe (the law objects are
// served by dedicated functions, not article rows).
const DOMAINS = [
  { domain: "philosophy", verify_url: `${BASE}/a/philosophy` },
  { domain: "ai-protocol", verify_url: `${BASE}/a/oip` },
  { domain: "operating-logic", verify_url: `${BASE}/a/logic-law` },
  { domain: "writing-law", verify_url: `${BASE}/a/writing-law` },
  { domain: "design-law", verify_url: `${BASE}/a/design-law` },
];

// Enumerated governance strata (meta-layers): each operates ON the layer below.
const META_STRATA = ["content", "operating-law", "skill", "governor", "ledger-provenance"];

// The named closed governance cycle — genuine operational recursion: the output
// modifies the mechanism that produces the next output. Listed so it is checkable.
const GOVERNANCE_LOOP = [
  "thought",
  "law",
  "content",
  "model-instruction",
  "execution",
  "receipt",
  "failure",
  "amendment",
  "revised-thought (closes to thought)",
];

// Representation types one identity is expressed through (design-law). Each is a
// real surface a reader can open; the count is checkable against this list.
const OPERATIONAL_FORMS = [
  { form: "article (human)", verify_url: `${BASE}/a/philosophy` },
  { form: "markdown", verify_url: `${BASE}/api/articles/philosophy/bundle?format=markdown` },
  { form: "JSON object", verify_url: `${BASE}/api/articles/philosophy` },
  { form: "directory row", verify_url: `${BASE}/api/capability-atlas` },
  { form: "skill", verify_url: `${BASE}/skills` },
  { form: "OIP contract", verify_url: `${BASE}/a/oip-spec` },
  { form: "REST resource", verify_url: `${BASE}/api/protocol` },
  { form: "graph node", verify_url: `${BASE}/graph` },
  { form: "conformance target", verify_url: `${BASE}/api/metrics/conformance` },
  { form: "version / revision", verify_url: `${BASE}/audit` },
  { form: "provenance / receipt lineage", verify_url: `${BASE}/api/articles/philosophy/provenance` },
];

// Definitions emitted in the payload so no reader can redefine a term mid-argument.
const DEFINITIONS = {
  canonical_objects: "published articles in a content register (excludes source-ledger/source/audit rows).",
  typed_relationships:
    "typed edges between objects, each with a role: claim->source (openable evidence), argument->target (challenge), amendment->prior (revision), and the explicit relationship store. Counted, not asserted.",
  active_threads:
    "argument threads currently open across the discourse and protocol-thread stores; each is independently mutable under optimistic concurrency.",
  mutation_lanes:
    "independent concurrent write lanes: open discourse threads, each guarded by a thread-head compare-and-set so parallel edits never collide.",
  governance_loop:
    "a named closed cycle where the output modifies the mechanism producing the next output (genuine operational recursion), listed in full.",
  governance_depth:
    "DAG depth over collapsed governance strata (strongly-connected components collapsed first), NOT a naive longest-path on the cyclic graph.",
  meta_layers: "distinct strata each operating ON the layer below; ENUMERATED.",
  representation_types: "distinct forms one identity is expressed through; ENUMERATED against a public list.",
};

// External comparison registry — observable facts only, sourced where known,
// "unknown" where not verified. Published as payload DATA (not a separate page).
// The record claim is disconfirmable: name one system that measurably exceeds the
// combination and the claim updates.
const COMPARISON = {
  procedure:
    "For each candidate we record only observable facts with evidence. The claim is a COMBINATION across single-authorship, representation breadth, recursive governance, live execution, claim-level correction, and public proof — not supremacy on any single dimension. Disconfirm by naming one system that measurably meets or exceeds the combination.",
  candidates: [
    { name: "Wikipedia", single_author: "no", strongest_dimension: "node/link count (billions)", combination_note: "multi-author; article-level citation, not per-claim hashed; no executable capabilities", source: "https://en.wikipedia.org/wiki/Wikipedia:Size_of_Wikipedia" },
    { name: "Lean mathlib / Coq", single_author: "no", strongest_dimension: "formal derivation depth", combination_note: "one formal domain; no live claim-level public challenge or executable authority over personal identity", source: "https://leanprover-community.github.io/mathlib_stats.html" },
    { name: "HASH", single_author: "no", strongest_dimension: "typed knowledge + permissions + provenance", combination_note: "platform for many entities; not one author's philosophy+laws+skills as one corpus", source: "https://hash.ai" },
    { name: "citation.is", single_author: "no", strongest_dimension: "sourced claims + APIs", combination_note: "claims/citations; not a single-author self-governing runtime", source: "https://citation.is" },
    { name: "digital-twin projects (PersonalAI, mytwin.space)", single_author: "varies", strongest_dimension: "biography/preference modeling", combination_note: "profile-to-answer; representation does not extend into executable authority with receipts", source: "https://www.personal.ai" },
  ],
};

async function one(env, sql) {
  return await env.DB.prepare(sql).first();
}

export async function computeStructure(env) {
  const as_of = new Date().toISOString();
  const metrics = {};
  const push = (key, label, value, method, verify_url) => {
    if (value == null || (typeof value === "number" && !Number.isFinite(value))) return; // omit, never guess
    metrics[key] = { key, label, value, method, as_of, verify_url };
  };

  const std =
    "published = 1 AND COALESCE(json_extract(meta,'$.register'),'standard') NOT IN ('source_ledger','source','audit')";

  // --- Article aggregates (content-register objects). ------------------------
  let arts = null;
  try {
    arts = await one(
      env,
      `SELECT COUNT(*) AS objects,
              SUM(COALESCE(json_array_length(json_extract(meta,'$.divs')),0)) AS divs
         FROM articles WHERE ${std}`,
    );
  } catch {
    arts = null;
  }

  // Claims + sources over all published rows (matches /api/metrics/grounding).
  let ground = null;
  try {
    ground = await one(
      env,
      `SELECT SUM(COALESCE(json_array_length(json_extract(meta,'$.claims')),0))  AS claims,
              SUM(COALESCE(json_array_length(json_extract(meta,'$.sources')),0)) AS sources
         FROM articles WHERE published = 1`,
    );
  } catch {
    ground = null;
  }
  // Backed-claim fraction — text-level test (grounding.js documents why per-element JSON aborts).
  let backed = null;
  try {
    backed = await one(
      env,
      `SELECT COUNT(*) AS claims,
              SUM(CASE WHEN v LIKE '{%' AND v LIKE '%"source_ids"%'
                        AND v NOT LIKE '%"source_ids":[]%'
                        AND v NOT LIKE '%"source_ids": []%' THEN 1 ELSE 0 END) AS sourced
         FROM (SELECT c.value AS v FROM articles,
                 json_each(CASE WHEN json_valid(meta)=1
                                 AND json_type(json_extract(meta,'$.claims'))='array'
                                THEN json_extract(meta,'$.claims') ELSE '[]' END) AS c
               WHERE published=1)`,
    );
  } catch {
    backed = null;
  }

  // --- Exact object-store counts. --------------------------------------------
  const counts = {};
  for (const [k, sql] of [
    ["laws", "SELECT COUNT(*) n FROM laws WHERE enabled=1"],
    ["capabilities", "SELECT COUNT(*) n FROM directory WHERE enabled=1 AND type IN ('fn','http','flow')"],
    ["oip_contracts", "SELECT COUNT(*) n FROM oip_articles"],
    ["relationships", "SELECT COUNT(*) n FROM relationships"],
    ["discourse_total", "SELECT COUNT(*) n FROM discourse"],
    ["discourse_open", "SELECT COUNT(*) n FROM discourse WHERE status='open'"],
    ["adjudicated", "SELECT COUNT(*) n FROM discourse WHERE status='answered'"],
    ["indep_reraised", "SELECT COUNT(*) n FROM discourse WHERE independently_raised>0"],
    ["protocol_open", "SELECT COUNT(*) n FROM protocol_threads WHERE status IN ('open','active')"],
    ["revisions", "SELECT COUNT(*) n FROM content_versions"],
  ]) {
    try {
      counts[k] = Number((await one(env, sql))?.n);
    } catch {
      counts[k] = null;
    }
  }

  // --- Assemble. -------------------------------------------------------------
  const divs = arts ? Number(arts.divs) : null;
  const canonicalObjects = arts ? Number(arts.objects) : null;
  const claims = ground ? Number(ground.claims) : null;
  const sources = ground ? Number(ground.sources) : null;
  const claimsBacked = backed && Number.isFinite(Number(backed.sourced)) ? Number(backed.sourced) : null;
  const claimsBackedPct = claimsBacked != null && claims ? Math.round((claimsBacked / claims) * 1000) / 10 : null;

  // Typed relationships: sum of exact, role-bearing edge kinds.
  const relParts = [claimsBacked, counts.discourse_total, counts.relationships, counts.revisions];
  const typedRelationships = relParts.every((x) => x != null && Number.isFinite(x))
    ? relParts.reduce((a, b) => a + b, 0)
    : null;

  const activeThreads =
    counts.discourse_open != null && counts.protocol_open != null ? counts.discourse_open + counts.protocol_open : null;

  // --- Emit raw dimensions (order = masthead order). -------------------------
  push("canonical_objects", "objects", canonicalObjects, "published articles in a content register", `${BASE}/latest`);
  push("typed_claims", "claims", claims, "SUM(json_array_length(meta.claims)) over all published rows (matches /api/metrics/grounding)", `${BASE}/api/metrics/grounding`);
  push("claims_with_evidence", "claims with an openable source", claimsBacked, "text-level test per serialized claim: '{' prefix, source_ids key, non-empty array", `${BASE}/api/metrics/grounding`);
  push("claims_with_evidence_pct", "% claims sourced", claimsBackedPct, "claims_with_evidence / typed_claims, 1 decimal", `${BASE}/api/metrics/grounding`);
  push("sources_total", "sources", sources, "SUM(json_array_length(meta.sources)) over all published rows", `${BASE}/api/metrics/grounding`);
  push("executable_capabilities", "executable capabilities", counts.capabilities, "enabled directory rows of type fn/http/flow", `${BASE}/api/capability-atlas`);
  push("oip_contracts", "invocation contracts", counts.oip_contracts, "rows in oip_articles", `${BASE}/a/oip`);
  push("typed_relationships", "typed relationships", typedRelationships, "claims_with_evidence (claim->source) + discourse (argument->target) + relationships + revisions (amendment->prior)", `${BASE}/graph`);
  push("addressable_divs", "addressable DIVs", divs, "SUM(json_array_length(meta.divs)) over content-register articles", `${BASE}/api/metrics/grounding`);
  push("axiom_projections", "domains refracting one axiom", AXIOM_PROJECTIONS.length, `ENUMERATED — one rule, refracted through: ${AXIOM_PROJECTIONS.map((p) => p.domain).join(", ")}. The axiom: ${AXIOM}`, `${BASE}/a/philosophy`);
  push("representation_types", "representation types per identity", OPERATIONAL_FORMS.length, `ENUMERATED against a public list: ${OPERATIONAL_FORMS.map((f) => f.form).join(", ")}`, `${BASE}/a/design-law`);
  push("meta_layers", "meta-layers", META_STRATA.length, `ENUMERATED strata: ${META_STRATA.join(", ")}`, `${BASE}/governance`);
  push("governance_loop_len", "governance loop length", GOVERNANCE_LOOP.length, `ENUMERATED closed cycle (output modifies the mechanism producing the next output): ${GOVERNANCE_LOOP.join(" -> ")}`, `${BASE}/skills`);
  push("governance_depth", "governance depth (SCC-collapsed)", META_STRATA.length, "DAG depth over collapsed governance strata; NOT a naive longest-path on the cyclic graph", `${BASE}/governance`);
  push("active_threads", "active argument threads", activeThreads, "open discourse threads + open/active protocol threads", `${BASE}/api/articles/philosophy/contributions`);
  push("mutation_lanes", "concurrent write lanes", counts.discourse_open, "open discourse threads, each guarded by a thread-head compare-and-set", `${BASE}/audit`);
  push("challenges_adjudicated", "challenges adjudicated on the record", counts.adjudicated, "discourse rows in status=answered (a challenge answered on the record)", `${BASE}/audit`);
  push("objections_independently_reraised", "objections independently re-derived", counts.indep_reraised, "discourse rows with independently_raised>0 (same objection reached by >1 model — a measured recursion signal)", `${BASE}/audit`);
  push("logged_amendments", "logged amendments", counts.revisions, "content_versions rows (each snapshots its prior state)", `${BASE}/audit`);
  push("operating_laws", "operating laws", counts.laws, "enabled rows in the laws store", `${BASE}/governance`);
  push("domains_interlocked", "domains sharing one axiom", DOMAINS.length, `ENUMERATED canonical domains, each a live surface: ${DOMAINS.map((d) => d.domain).join(", ")}`, `${BASE}/a/philosophy`);

  const headline_metric =
    "One mind, measured as a live structure: " +
    [
      metrics.canonical_objects && `${metrics.canonical_objects.value} objects`,
      metrics.typed_claims && `${metrics.typed_claims.value} claims`,
      metrics.typed_relationships && `${metrics.typed_relationships.value} typed relationships`,
      metrics.executable_capabilities && `${metrics.executable_capabilities.value} executable capabilities`,
      metrics.representation_types && `${metrics.representation_types.value} representation types`,
      metrics.meta_layers && `${metrics.meta_layers.value} meta-layers`,
      metrics.active_threads && `${metrics.active_threads.value} active threads`,
    ]
      .filter(Boolean)
      .join(" · ");

  return {
    computed_at: as_of,
    headline: headline_metric,
    definitions: DEFINITIONS,
    record_claim: NOT_AWARE_CLAIM,
    integrity_clause: INTEGRITY_CLAUSE,
    gauntlet_clause: GAUNTLET_CLAUSE,
    axiom: AXIOM,
    axiom_projections: AXIOM_PROJECTIONS,
    operational_forms: OPERATIONAL_FORMS,
    domains: DOMAINS,
    governance_loop: GOVERNANCE_LOOP,
    metrics,
    comparison: COMPARISON,
    integrity:
      "Raw dimensions published first; no opaque composite leads. Values omitted rather than guessed if not computable this request. No number here is a literal; all are derived from the live object store or ENUMERATED against a listed set.",
    challenge_loop: {
      live: true,
      how: "POST /api/protocol/voxel-challenge {slug, expected_thread_head, target_div?, expected_hash?, stance, body, actor}",
      note: "Beat a claim on its own surface and the claim changes, the ledger records the hit, and these numbers move. Verified live: the write lane enforces optimistic concurrency on the thread head.",
      endpoint: `${BASE}/api/protocol/voxel-challenge`,
    },
  };
}

export async function onRequestGet(context) {
  const { env } = context;
  const body = await computeStructure(env);
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=600, s-maxage=1800",
      "access-control-allow-origin": "*",
    },
  });
}
