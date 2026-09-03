#!/usr/bin/env node
/**
 * Post five system-reference articles about the protocol itself.
 * Run: source ~/.config/grok-bridge.env && node scripts/post_protocol_meta_articles.mjs
 */

import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = "https://miscsubjects.com";

function loadKey() {
  try {
    const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
    const m = env.match(/TERMINAL_KEY=(.+)/);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY;
  } catch {
    return process.env.TERMINAL_KEY;
  }
}

function claim(id, text, slot, tier = "system") {
  return {
    id,
    text,
    section: slot.replace(/_/g, " "),
    slot,
    tier,
    source_status: "unsourced",
    why_material: "Architecture axiom — verifiable via live GET endpoints cited in text.",
    posted_by: { actor: "grok/build", channel: "api", ts: new Date().toISOString() },
    who_claims: "miscsubjects protocol (system tier)",
    weight: tier === "system" ? 0.35 : 0.5,
  };
}

const SHARED_EMBEDS = [
  "protocol",
  "protocol-api-structure",
  "protocol-widgets",
  "protocol-claims",
  "protocol-logic",
  "protocol-framework-utility",
];

const ARTICLES = [
  {
    slug: "protocol-api-structure",
    title: "Protocol API Structure: REST Surface, Objects, and Phase Machine",
    register: "technical",
    tags: ["system", "protocol", "api"],
    embeds: SHARED_EMBEDS.filter((s) => s !== "protocol-api-structure"),
    body: `## What this article is

A queryable map of the miscsubjects **protocol receiving layer** — the REST endpoints models and humans POST into, the objects those endpoints mutate, and how phases chain together. This is not peptide content; it is the **API structure of the protocol itself**.

Verify live contract: \`GET https://miscsubjects.com/api/protocol\`

## Two API planes

**Articles plane** (\`/api/articles/...\`) — flat article CRUD, hash-chained provenance and sources, sub-resources (topology, voxels, health, bundle).

**Protocol plane** (\`/api/protocol/...\`) — phase operations: populate, collaborate, review, score, grow, matrix. Mutating calls require header \`x-terminal-key\`.

## Core objects on the ledger

| Object | Storage | Primary write |
|--------|---------|---------------|
| article | D1 \`articles\` + meta JSON | POST /api/articles/{slug} |
| claim | meta.claims[] | POST /api/protocol/claim |
| source | meta.sources[] (hash-chained) | POST /api/protocol/sources |
| review | meta.reviews[] | POST /api/protocol/review |
| contribution | meta.contributions[] | POST /api/protocol/contribute |
| mapping | meta.mapping or pipeline combo | POST /api/matrix/sync + backfill |
| pipeline item | D1 pipeline table | POST /api/matrix/seed |

## Phase machine (P0–P8)

| Phase | Endpoint | Output |
|-------|----------|--------|
| P0 INVENTORY | POST /api/protocol/inventory | pipeline items |
| P1 OUTLINE | POST /api/protocol/outline | markdown outline on item |
| P2 DRAFT | POST /api/protocol/draft | published article |
| P3–P5 REVIEW | POST /api/protocol/review | contributions (neutral/adversary/endorsement) |
| P6 SOURCES | POST /api/protocol/sources | hash-chained source ledger |
| P7 SCORE | POST /api/protocol/score | claim weights from reviews |
| P8 REST GATE | server-side | materiality check; energy_spent if waste |

Growth automation: \`POST /api/protocol/grow\` runs populate → collaborate → repair → reflex per slug.

Combinatorial control: \`GET /api/matrix/plan\` → \`POST /api/matrix/tick\`.

## Sub-resource reads (public)

- \`GET /api/articles/{slug}/topology\` — claims + sources for ask/ROUTER
- \`GET /api/articles/{slug}/voxels\` — claim atoms + source edges
- \`GET /api/articles/{slug}/sources\` — chain + verify{valid,head}
- \`GET /api/articles/{slug}/health\` — constitution slot audit
- \`GET /api/graph?slugs=...\` — unified cross-article canvas

## Auth rule

Every POST/PUT/PATCH/DELETE on protocol endpoints returns 401 without matching \`x-terminal-key\`. Article GETs are public.

*Related: [[embed:protocol-widgets]] · [[embed:protocol-claims]] · [[embed:protocol-logic]]*`,
    claims: [
      claim("c_api_1", "GET /api/protocol returns the live machine contract — endpoint list, body schemas, and phase definitions; it is the authoritative API map.", "what_it_is"),
      claim("c_api_2", "The protocol splits into two planes: /api/articles for CRUD and sub-resources, and /api/protocol for phase operations (populate, review, score, grow).", "what_it_is"),
      claim("c_api_3", "Claims live in article.meta.claims[]; sources in meta.sources[] with prev/hash chain; provenance in meta.provenance[] — all append-only.", "what_is_known"),
      claim("c_api_4", "POST /api/protocol/draft validates tiers, optionally verifies source URLs, hash-chains sources, and publishes or updates the article head.", "what_is_known"),
      claim("c_api_5", "POST /api/protocol/populate ingests science + social sources into an article without rewriting body — forest-first growth.", "what_is_known"),
      claim("c_api_6", "POST /api/protocol/collaborate lets Kimi or Gemini read topology and append 1–3 claims with posted_by; optional require_challenge for adversary pass.", "what_is_known"),
      claim("c_api_7", "POST /api/protocol/score recomputes claim.weight from base(tier) + endorsement_sum − adversary_sum; claims below cut_threshold get status:cut.", "what_is_known"),
      claim("c_api_8", "GET /api/protocol/next?role=writer atomically claims one open task; POST /api/protocol/run executes one scheduler tick inside the 100s request cap.", "what_is_known"),
      claim("c_api_9", "GET /api/matrix/gaps audits missing peptide roots and unwritten cross cells; POST /api/matrix/seed deterministically fills pipeline from canonical catalog.", "what_is_known"),
      claim("c_api_10", "Webhook POST /api/articles/{slug}/webhook accepts atomic append of kind:claim|source|widget without replacing article head.", "who_claims_what"),
      claim("c_api_11", "The build documents API_QUICKMAP.md and PROTOCOL_SPEC.md as human-readable mirrors; GET /api/protocol is the runtime truth.", "who_claims_what"),
      claim("c_api_12", "Not every PROTOCOL_SPEC phase has a dedicated cron worker deployed yet — some remain manual via POST /api/protocol/grow or dispatch tools.", "what_is_unknown"),
      claim("c_api_13", "Rate limits and per-tenant quotas on gateway model calls are environment-dependent — not exposed in the public contract.", "what_is_unknown"),
      claim("c_api_14", "Phase transitions are stateless per request: each POST must finish inside Cloudflare's ~100s cap; batch work uses grow batch or cron ticks.", "mechanism"),
      claim("c_api_15", "This API map does not grant medical authority — it is a research-ledger transport layer only.", "disclaimer"),
      claim("c_api_16", "Immutable slugs (protocol) block DELETE; corrections use PATCH status:retracted or new revisions, never hard delete.", "limitations"),
    ],
  },
  {
    slug: "protocol-widgets",
    title: "Protocol Widgets: Self-Explanation, Vault Cards, and Native Embeds",
    register: "technical",
    tags: ["system", "protocol", "widgets"],
    embeds: SHARED_EMBEDS.filter((s) => s !== "protocol-widgets"),
    body: `## What widgets are here

In miscsubjects, **widgets** are not decorative UI chrome — they are **self-describing data envelopes** that travel with API responses and render as native cards on article pages and admin vaults.

Three widget families:

1. **\_self blocks** — every protocol/matrix/grow response carries \`_self: {what, how_to_use, related, proof_chain}\` so paste-without-context still orients the reader.
2. **Vault cards** — horizontal rails on /admin and /api/ledger; normalized via \`normalizeWidget()\` in vault_widgets.js.
3. **Article embeds** — ledger sources rendered as native Reddit/X/PubMed/iMessage strips via \`sourceToWidget()\` and \`[[embed:slug]]\` inline cards.

## \_self / FEATURES index

\`self_explain.js\` exports FEATURES — a canonical index (system_map, constitution, voxels, ask, ingest, graph_topology, matrix, etc.). \`attachSelf(payload, widgetId, opts)\` injects navigation.

Live index: \`GET https://miscsubjects.com/api/articles/system-map\`

## Source → platform widgets

When populate or sources append a ledger row, the reader page maps:

| source.type | Widget |
|-------------|--------|
| reddit | subreddit card + quote |
| x / twitter | handle + text strip |
| pubmed / clinical_trial | science card with quote + link |
| youtube | title + channel strip |
| instagram | caption card |
| imessage / whatsapp | chat bubble rail |

Implementation: \`functions/_lib/article_widgets.js\` + \`widgets/rail-platform.js\`.

## Meta widgets array

Articles may also store \`meta.widgets[]\` with types: imessage, quote, stat, note, gallery — JSON descriptors the renderer turns into in-body series.

## Graph / vault widgets

- \`GET /api/ledger?view=cards\` — grouped turn cards
- \`GET /api/graph\` — nodes/edges for canvas
- Admin content-map — peptide/combo picker cards

## Widget design principle

**Copy without context → reader knows what this is, how to use it, where to look next.** That is the binding rule in self_explain.js.

*Related: [[embed:protocol-api-structure]] · [[embed:protocol-claims]]*`,
    claims: [
      claim("c_wid_1", "Every attachSelf() response includes _self.what, _self.how_to_use, and _self.related URLs — widgets are self-explaining payloads, not static HTML.", "what_it_is"),
      claim("c_wid_2", "FEATURES in self_explain.js is the canonical feature index; system-map article exposes it for humans and LLMs.", "what_it_is"),
      claim("c_wid_3", "sourceToWidget() maps hash-chained ledger sources to native platform cards (reddit, x, pubmed, youtube, imessage) on the reader page.", "what_is_known"),
      claim("c_wid_4", "buildInlineEmbedMap() resolves [[embed:slug]] markers in article body to horizontal native cards without external iframes.", "what_is_known"),
      claim("c_wid_5", "normalizeWidget() in vault_widgets.js unifies directory rows, tasks, events, and claims into vault-card rails with shortHash ids.", "what_is_known"),
      claim("c_wid_6", "meta.widgets[] supports imessage|quote|stat|note|gallery types as JSON series independent of the source ledger.", "what_is_known"),
      claim("c_wid_7", "Graph canvas widgets come from GET /api/graph — nodes are claims/sources, edges are supported_by, posted_by, challenges, embeds.", "what_is_known"),
      claim("c_wid_8", "explainGrowStep() returns human-readable why/how for each grow-queue step — operational widget for cron operators.", "who_claims_what"),
      claim("c_wid_9", "Platform logos and rail styling live in widgets/platform_logos.js and widgets/social.js — presentation layer only, not ledger truth.", "who_claims_what"),
      claim("c_wid_10", "Third-party oEmbed iframes are avoided for Reddit/X — native cards use ledger quote+url for auditability.", "what_is_known"),
      claim("c_wid_11", "Not all admin pages yet consume _self blocks — some legacy HTML predates attachSelf.", "what_is_unknown"),
      claim("c_wid_12", "Widget accessibility (ARIA on rails) is partial — visual cards exist before full a11y pass.", "what_is_unknown"),
      claim("c_wid_13", "Widget rendering is deterministic from ledger JSON — same source hash always maps to same card content.", "mechanism"),
      claim("c_wid_14", "Widgets display evidence; they do not score or elevate claims — weighting remains in claim.weight from /score.", "limitations"),
      claim("c_wid_15", "Not medical advice — social anecdote widgets are anecdotal tier by definition.", "disclaimer"),
    ],
  },
  {
    slug: "protocol-claims",
    title: "How Claims Work: Voxel Atoms, Tiers, Weights, and Honesty Gates",
    register: "source_ledger",
    tags: ["system", "protocol", "claims"],
    embeds: SHARED_EMBEDS.filter((s) => s !== "protocol-claims"),
    body: `## Claims are the primary object

An article is **not** a prose blob. It is a **voxel graph of claims** — each claim is one falsifiable assertion with tier, weight, source_ids, posted_by, and constitution slot.

Binding rules: \`GET https://miscsubjects.com/api/articles/constitution\`

## Claim atom schema

\`\`\`json
{
  "id": "c1",
  "text": "one assertion",
  "tier": "human|preclinical|anecdotal|mechanistic|speculative|system",
  "slot": "what_it_is|who_claims_what|what_is_known|...",
  "source_ids": ["s1"],
  "posted_by": { "actor": "kimi/moonshot-v1-8k", "channel": "api", "ts": "..." },
  "weight": 0.0,
  "status": "active|cut|downweighted|retracted"
}
\`\`\`

## Required constitution slots

Every peptide/condition article should fill: what_it_is, who_claims_what, what_is_known, what_is_unknown, limitations, disclaimer — plus mechanism when material.

\`POST /api/protocol/fill-slots\` synthesizes missing slot claims from existing topology.

## How claims enter the ledger

| Path | Behavior |
|------|----------|
| POST /api/protocol/claim | Single claim append; no body rewrite |
| POST /api/protocol/ingest | Parse pasted evidence → sources + claims |
| POST /api/protocol/draft | Batch claims on publish |
| POST /api/protocol/collaborate | External model adds 1–3 claims |
| POST /api/articles/{slug}/webhook | Atomic kind:claim |

## Tier → base weight

| tier | base weight |
|------|-------------|
| human | 0.8 |
| preclinical | 0.5 |
| anecdotal | 0.3 |
| mechanistic | 0.3 |
| speculative | 0.1 |
| system | 0.35 |

\`POST /api/protocol/score\` applies: weight = clamp(base + pro − adversary, 0, 1).

## Honesty operations (never delete)

- **Retract**: POST /api/protocol/retract — status:retracted, stays on ledger
- **Challenge**: POST /api/protocol/challenge — adversary claim links to target
- **Scrub**: POST /api/protocol/scrub — secrets → [REDACTED:secret-leak]

## Repair graph wiring

\`POST /api/protocol/repair\` — wire claim↔source edges, materialize orphan sources as who_claims_what claims, retier mislabeled human/preclinical.

Inspect: \`GET /api/articles/{slug}/voxels\`

*Related: [[embed:protocol-logic]] · [[embed:protocol-api-structure]]*`,
    claims: [
      claim("c_clm_1", "One claim equals one falsifiable assertion — compound claims violate the constitution and fail health audit.", "what_it_is"),
      claim("c_clm_2", "system tier is reserved for architecture and protocol axioms, not biological mechanism claims.", "what_it_is"),
      claim("c_clm_3", "posted_by.actor uses canonical format provider/model (e.g. kimi/moonshot-v1-8k) or system/function for server passes.", "what_is_known"),
      claim("c_clm_4", "source_ids must reference rows in the hash-chained source ledger; orphan sources can be materialized into claims via repair.", "what_is_known"),
      claim("c_clm_5", "Elevation threshold default 0.6 — review contributions scoring below this do not enter the article.", "what_is_known"),
      claim("c_clm_6", "cut_threshold default 0.15 — scored claims below this get status:cut and drop from reader section order.", "what_is_known"),
      claim("c_clm_7", "Adversary challenges append to meta.challenges[] and raise stance_scores.adversary on target — symmetric to endorsement.", "what_is_known"),
      claim("c_clm_8", "Retracted claims remain in meta.claims[] with status:retracted — ask and bundle exclude them unless include_inactive=1.", "what_is_known"),
      claim("c_clm_9", "ingest creates evidence_ingest nodes on the question graph linking pasted text to new sources and claims.", "what_is_known"),
      claim("c_clm_10", "Who_claims_what slot must name study authors, platforms, or n= — not anonymous 'studies show'.", "who_claims_what"),
      claim("c_clm_11", "ledger_durability.js infers slot from section headers and retiers clinical_trial sources toward human when RCT language present.", "who_claims_what"),
      claim("c_clm_12", "Automated tier assignment from PubMed titles alone is incomplete — abstract parsing remains a gap.", "what_is_unknown"),
      claim("c_clm_13", "Cross-model claim deduplication is heuristic — near-duplicate assertions may coexist until adversary or manual retract.", "what_is_unknown"),
      claim("c_clm_14", "Weight recomputation is monotonic per score pass — reviews accumulate; rest gate discards non-material passes as energy_spent.", "mechanism"),
      claim("c_clm_15", "No doses, no 'you should take' — claims violating this fail constitution regardless of weight.", "limitations"),
      claim("c_clm_16", "This claim system is for research transparency, not clinical decision support.", "disclaimer"),
    ],
  },
  {
    slug: "protocol-logic",
    title: "The Logic of the Logic: Recursive Ledger, Entropy, and Combinatorial Control",
    register: "technical",
    tags: ["system", "protocol", "logic", "matrix"],
    embeds: SHARED_EMBEDS.filter((s) => s !== "protocol-logic"),
    body: `## Meta-logic: the ledger reasons about itself

miscsubjects is not only a content site — it is a **self-describing computation** where the protocol API, matrix engine, and grow queue form a **recursive control loop**. This article documents **the logic of that logic**.

## Layer stack

| Layer | What | Control |
|-------|------|---------|
| L0 Canonical | 33 peptides × 38 degenerative targets | ledger_canonical.js |
| L1 Matrix | regen_score, degen_score, delta per cell | ledger_matrix.js |
| L2 Corpus | articles = voxel graphs | D1 articles |
| L3 Growth | populate → collaborate → repair → reflex | graph_grow_queue.js |
| L4 Entropy | sprawl orphans, low-delta noise | auditEntropy() |

## Combinatorial delta (transparent)

\`\`\`
regen_score = layer_relevance(peptide, target) × evidence_factor
degen_score = catalog.degen_score (condition or pharma)
delta = regen_score − degen_score
weight = clamp(delta, 0, 1)
\`\`\`

Methodology is stored on meta.mapping — not an opaque rank score.

## Recursive population

1. \`auditGaps()\` — missing peptide roots (e.g. retatrutide), unwritten crosses
2. \`planNextTick()\` — priority: roots → high-Δ gaps → backfill mapping → repair orphans
3. \`POST /api/protocol/grow\` or \`POST /api/matrix/tick\` — executes one step
4. \`auditEntropy()\` — entropy_score vs negentropy_score

The ledger **plans its own sprawl reduction** — negentropy actions are emitted, not hand-curated.

## Ontology anti-sprawl

\`buildArticleOntology()\` flags orphans (no parent embed, not a root) and missteps (duplicate scope). Condition articles should embed from peptide roots.

## Reflex pass

\`POST /api/protocol/reflex\` — live HTTP probes vs vision claims on slug:protocol; graph proves its own shape.

## Proof chains

\_self.proof_chain in API responses links: constitution → sources → ask → grow — logical order for zero-context readers.

Inspect: \`GET https://miscsubjects.com/api/matrix/entropy\`

*Related: [[embed:protocol-framework-utility]] · [[embed:protocol-api-structure]]*`,
    claims: [
      claim("c_log_1", "The combinatorial matrix treats degenerative conditions and degenerative pharma as entropy targets on the same ledger plane.", "what_it_is"),
      claim("c_log_2", "delta = regen_score − degen_score is the elevation signal for queueing cross articles — disclosed methodology, not a black-box rank.", "what_it_is"),
      claim("c_log_3", "planNextTick() merges gap audit and entropy audit into a single prioritized slug list for grow and matrix/tick.", "what_is_known"),
      claim("c_log_4", "graph_grow_queue prepends matrix-planned slugs before legacy PRIORITY_SLUGS — canonical gaps override editorial hooks.", "what_is_known"),
      claim("c_log_5", "entropy_score rises with orphan count, missing roots, and low-delta written crosses; negentropy_score tracks coverage convergence.", "what_is_known"),
      claim("c_log_6", "parseCrossSlug() resolves article slugs to peptide×target cells for mapping backfill on existing corpus.", "what_is_known"),
      claim("c_log_7", "Pipeline table holds 1254 combo rows after full sync — deterministic seed replaces LLM-only pipelineSeed for inventory.", "what_is_known"),
      claim("c_log_8", "Reflex pass posts system-tier claims that cite live endpoint probes — the graph validates its own API surface.", "what_is_known"),
      claim("c_log_9", "Article ontology classifies peptide_root vs condition vs stack using PEPTIDE_CATALOG — 33 roots, not hardcoded 10.", "who_claims_what"),
      claim("c_log_10", "Rest gate (P8) logs energy_spent when a model pass is non-material — waste is visible on the ledger.", "who_claims_what"),
      claim("c_log_11", "Full autonomous cron for all P0–P8 phases is not continuously running — grow batch is the practical scheduler today.", "what_is_unknown"),
      claim("c_log_12", "LLM-driven pipelineMap weights are superseded by deterministic computeMapping for new syncs — historical rows may differ.", "what_is_unknown"),
      claim("c_log_13", "Hash chains on sources, provenance, and contributions make post-hoc tampering detectable via verify endpoints.", "mechanism"),
      claim("c_log_14", "Meta-logic articles use system tier — they do not compete with human clinical claims on weight.", "limitations"),
      claim("c_log_15", "Recursive control optimizes corpus shape, not patient outcomes.", "disclaimer"),
    ],
  },
  {
    slug: "protocol-framework-utility",
    title: "What This Framework Enables: Use Cases Beyond Peptide Catalogues",
    register: "combinatorial_accessible",
    tags: ["system", "protocol", "applications"],
    embeds: SHARED_EMBEDS.filter((s) => s !== "protocol-framework-utility"),
    body: `## Why build a self-planning evidence ledger?

The miscsubjects framework is peptide-flavored today, but the **architecture generalizes** — any domain needing adversarial, multi-model, source-chained knowledge can reuse it.

## Immediate utilities (live now)

**1. Queryable evidence boards** — Ask (\`POST /api/protocol/ask\`) answers only from topology; gaps[] tells you what the ledger lacks.

**2. Multi-model audit trails** — Kimi + Gemini collaborate on the same slug; every original post preserved in contributions[], not overwritten.

**3. Combinatorial discovery** — Matrix lists 1254 peptide×target cells with transparent delta; gaps drive what to write next.

**4. Source integrity** — Hash-chained sources with link_status and quote_status; Reddit/X/PubMed as first-class citizens.

**5. Honest retraction** — Bad claims retract, never delete; challenges downweight without erasing history.

**6. Zero-context API paste** — \_self blocks let operators and LLMs orient from any single JSON response.

## Domains that could mount the same stack

| Domain | Canonical layer | Cross cells |
|--------|-----------------|-------------|
| Drug–drug interactions | Rx catalog | drug × condition |
| Supplement × symptom | Compound inventory | compound × user-reported outcome |
| Policy evidence | Intervention catalog | policy × population outcome |
| Security advisories | CVE components | vuln × environment |
| Legal precedent | statute catalog | rule × fact pattern |

## Operator workflows

- **Corpus grow**: \`POST /api/protocol/grow {"batch":5}\`
- **Gap check**: \`GET /api/matrix/gaps\`
- **Repair after ingest**: \`POST /api/protocol/repair\`
- **Obsidian export**: \`GET /api/articles/obsidian-vault?slugs=...\`

## What makes it different from a wiki

- Claims are weighted atoms, not paragraphs
- Adversary is first-class, not post-hoc talk pages
- The ledger schedules its own population from matrix gaps
- Every write is provenance-logged with tokens/cost

## Limits

Framework does not replace IRB, prescribing, or regulatory submission. It **organizes contested evidence** for research literacy.

*Start here: [[embed:protocol]] · [[embed:protocol-api-structure]] · [[embed:protocol-claims]]*`,
    claims: [
      claim("c_use_1", "The framework separates transport (REST protocol), evidence atoms (claims), and presentation (widgets) — each layer inspectable independently.", "what_it_is"),
      claim("c_use_2", "POST /api/protocol/ask returns gaps[] and ingest_hint — the ledger tells the user what evidence would materially improve the answer.", "what_is_known"),
      claim("c_use_3", "Combinatorial matrix generalizes to any inventory × target grid where regen/degen scores can be defined transparently.", "what_is_known"),
      claim("c_use_4", "Multi-model collaborate preserves each model's original contribution — useful for audit, dispute resolution, and bias detection.", "what_is_known"),
      claim("c_use_5", "Graph canvas GET /api/graph enables cross-article reasoning without copying full bodies into prompt context.", "what_is_known"),
      claim("c_use_6", "iMessage/WhatsApp ingest paths let lay users add anecdotal tier evidence that enters the same hash-chained ledger.", "what_is_known"),
      claim("c_use_7", "Obsidian vault export supports offline research workflows while keeping slug parity with the live corpus.", "what_is_known"),
      claim("c_use_8", "Tasks REST + dispatch directory let cron and human operators invoke protocol steps as named functions.", "who_claims_what"),
      claim("c_use_9", "Library-snapshot and poll endpoints support periodic external source refresh against existing claims.", "who_claims_what"),
      claim("c_use_10", "Domain packs beyond peptides require new canonical catalogs — the engine (matrix, grow, claims) is domain-agnostic.", "what_is_unknown"),
      claim("c_use_11", "Federation across multiple miscsubjects instances is not implemented — single D1 spine today.", "what_is_unknown"),
      claim("c_use_12", "Commercial RUO peptide commerce integration is out of scope — framework is evidence organization only.", "what_is_unknown"),
      claim("c_use_13", "Usefulness scales with source forest density — empty articles benefit from populate before ask.", "mechanism"),
      claim("c_use_14", "Accessible register articles still depend on claim tier discipline — prose alone does not elevate evidence.", "limitations"),
      claim("c_use_15", "Framework users remain responsible for their own research and medical decisions.", "disclaimer"),
    ],
  },
];

async function postArticle(article, key) {
  const payload = {
    slug: article.slug,
    title: article.title,
    body: article.body,
    register: article.register,
    tags: article.tags,
    embeds: article.embeds,
    claims: article.claims,
    model: "grok/build (protocol-meta-articles)",
    prov: {
      model: "grok/build",
      action: "write",
      prompt: "post_protocol_meta_articles.mjs",
      input: article.slug,
    },
  };

  const r = await fetch(`${BASE}/api/articles/${article.slug}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-terminal-key": key,
    },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, slug: article.slug, claims: j.claims?.length, error: j.error };
}

async function main() {
  const key = loadKey();
  if (!key) {
    console.error("TERMINAL_KEY not found");
    process.exit(1);
  }

  const results = [];
  for (const article of ARTICLES) {
    const out = await postArticle(article, key);
    results.push(out);
    console.log(out.status === 200 ? "✓" : "✗", out.slug, out.claims || 0, "claims", out.error || "");
  }

  const failed = results.filter((r) => r.status !== 200);
  if (failed.length) process.exit(1);
  console.log("\nAll", results.length, "articles posted.");
  console.log("URLs:");
  for (const a of ARTICLES) {
    console.log(`  ${BASE}/a/${a.slug}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});