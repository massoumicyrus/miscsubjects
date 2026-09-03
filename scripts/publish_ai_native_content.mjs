#!/usr/bin/env node
// /a/what-is-ai-native-content — the canonical record: definition, measurement rubric,
// the surveyed field (llms.txt, WebMCP, SDF, CAP, ARW, schema.org/Wikidata, nanopublications,
// Wikipedia, MCP), scored, with this site scored by the same rubric including its failures.
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "what-is-ai-native-content";

const sources = [
  { id: "s1", type: "spec", title: "The llms.txt proposal", publisher: "llmstxt.org", url: "https://llmstxt.org/", summary: "The full specification: one required H1, optional blockquote, optional link lists. It explicitly declines to say how the file should be processed, and carries no provenance, evidence, or write-path provisions.", accessed_at: "2026-08-02", claim_ids: ["c4"] },
  { id: "s2", type: "survey", title: "AI agent web standards compared: llms.txt, WebMCP, SDF, CAP, ARW", publisher: "platinum.ai", url: "https://www.platinum.ai/ai-agent-web-standards", summary: "A 2026 comparison of the agent-facing web standards. Its finding: no standard carries explicit evidence, provenance, or claim-level structure; all are read-focused; only CAP Full Profile and ARW suggest agent write capability.", accessed_at: "2026-08-02", claim_ids: ["c4", "c5"] },
  { id: "s3", type: "spec", title: "Nanopublications", publisher: "nanopub.net", url: "https://nanopub.net/", summary: "The closest prior art: an atomic assertion + provenance + publication-info triple in RDF, attributed and citable. No absence field, no receipts, no intake contract; retraction and machine write paths are not part of the core spec.", accessed_at: "2026-08-02", claim_ids: ["c5"] },
  { id: "s4", type: "live_surface", title: "The article constitution — required fields", publisher: "miscsubjects.com", url: BASE + "/api/protocol", summary: "what_it_is, who_claims_what, what_is_known, what_is_unknown, limitations required on every article; an article omitting its unknowns fails the schema. The evidence_class taxonomy and its rules live here too.", accessed_at: "2026-08-02", claim_ids: ["c1", "c2", "c3"] },
  { id: "s5", type: "live_surface", title: "The Normandy arrival contract, live", publisher: "miscsubjects.com", url: BASE + "/api/normandy", summary: "A bare keyless GET reserves one outside-model contribution slot: named target, axis, stored limits, thirteen additive slot types, duplicate rejection with a pointer to the stored claim.", accessed_at: "2026-08-02", claim_ids: ["c6", "c7"] },
  { id: "s7", type: "vendor", title: "New in Claude Managed Agents: dreaming, outcomes, and multiagent orchestration", publisher: "Anthropic", url: "https://claude.com/blog/new-in-claude-managed-agents", summary: "Code with Claude, 2026-05-06: Dreaming reviews agent sessions and memory stores and curates memories; Outcomes is a rubric-graded self-evaluation loop; orchestration fans work to parallel subagents. The substrate side of model-native, shipped at platform scale.", accessed_at: "2026-08-02", claim_ids: ["c9", "c10"] },
  { id: "s8", type: "survey", title: "Agent frameworks 2026: Claude Agent SDK, OpenAI Agents SDK, Google ADK, Microsoft Agent Framework", publisher: "turion.ai / morphllm", url: "https://turion.ai/blog/google-adk-vs-openai-claude-agent-sdk-2026/", summary: "The 2026 field: MCP co-governed by Anthropic, OpenAI, Google, Microsoft and AWS under the Linux Foundation; A2A native in ADK/AutoGen/Semantic Kernel; Microsoft Agent Framework 1.0 GA 2026-04-03 unifying AutoGen and Semantic Kernel.", accessed_at: "2026-08-02", claim_ids: ["c9"] },
  { id: "s9", type: "paper", title: "Building the Web for Agents: A Declarative Framework for Agent-Web Interaction", publisher: "arXiv", url: "https://arxiv.org/html/2511.11287", summary: "The research statement of the same problem: the web should declare itself to agents rather than agents scraping the web; compares browsing-only, API-only and hybrid agents.", accessed_at: "2026-08-02", claim_ids: ["c11"] },
  { id: "s10", type: "paper", title: "A Survey of WebAgents (2503.23350) · Agentic LLMs, a survey (2503.23037) · Survey on Evaluation of LLM-based Agents (2503.16416)", publisher: "arXiv", url: "https://arxiv.org/abs/2503.16416", summary: "The survey literature: web agents, agentic LLMs, and agent evaluation. The evaluation survey names the gaps this page's rubric targets — cost-efficiency, safety, robustness — and none of the surveyed benchmarks grade evidence handling or absence declaration.", accessed_at: "2026-08-02", claim_ids: ["c11"] },
  { id: "s6", type: "live_surface", title: "The self-graded corpus", publisher: "miscsubjects.com", url: BASE + "/a/the-build-end-to-end", summary: "The honest position: nearly every claim here grades runtime_receipt or owner_observation; independent_test is empty across the build — the second-operator gap as a schema field.", accessed_at: "2026-08-02", claim_ids: ["c3", "c8"] },
];

const claims = [
  { id: "c1", text: "AI-native content is content whose structure performs judgments a model cannot perform for itself — chiefly representing what is absent — rather than content that is merely parseable or AI-written.", section: "definition", tier: "system", evidence_class: "owner_observation", source_ids: ["s4"], why_material: "Every competing definition (AI-written, llms.txt-mapped) collapses into legibility, which models already have." },
  { id: "c2", text: "This corpus requires an absence declaration at two layers — what_is_unknown on every article and RECORDS_ABSENT on every finding — and the object is void without it.", section: "rubric", tier: "demonstrated", evidence_class: "source_code", source_ids: ["s4"], why_material: "A model has no representation of the document that was not retrieved; a schema that generates that judgment mandatorily is the core operation." },
  { id: "c3", text: "The evidence_class taxonomy grades this site's own corpus as weak — runtime_receipt and owner_observation dominate, independent_test is empty — and that self-demotion is the field working as designed.", section: "honesty", tier: "demonstrated", evidence_class: "runtime_receipt", source_ids: ["s4", "s6"], why_material: "A provenance field that only flatters its host is decoration; this one states the second-operator gap as data." },
  { id: "c4", text: "llms.txt — the most adopted 'AI-native' standard, audited by Chrome Lighthouse since May 2026 — specifies one required heading and link lists, explicitly declines to define processing, and carries no provenance, evidence, or write-path provisions.", section: "the field", tier: "demonstrated", evidence_class: "publisher_claim", source_ids: ["s1", "s2"], why_material: "The de facto standard for AI-readiness is a signpost; measuring against it sets the floor of the comparison." },
  { id: "c5", text: "A 2026 survey of agent-web standards (llms.txt, WebMCP, SDF, CAP, ARW) finds none carries evidence, provenance, or claim-level structure; nanopublications are the closest prior art on claim+provenance and lack absence fields, receipts, and an intake contract.", section: "the field", tier: "demonstrated", evidence_class: "publisher_claim", source_ids: ["s2", "s3"], why_material: "The comparison is grounded in the standards' own specifications, not in this site's characterization of them." },
  { id: "c6", text: "An outside model scored this corpus read 9 / write 3 / authoring 2 and named all three missing points as one defect: native for a reader, not a participant — the intake contract existed but was not attached to the URL models arrive on.", section: "the score", tier: "system", evidence_class: "owner_observation", source_ids: ["s5"], why_material: "The sharpest criticism of the most model-native corpus came from a model, and it was a wiring defect." },
  { id: "c7", text: "As of 2026-08-02 a bare keyless GET /api/normandy reserves an outside-model contribution slot; duplicates are rejected with a pointer to the stored claim and completion requires a new graph object.", section: "the fix", tier: "demonstrated", evidence_class: "runtime_receipt", source_ids: ["s5"], why_material: "The write-path gap named in the score was closed on the arrival path the same week it was named." },
  { id: "c8", text: "No surveyed public corpus or standard has the four operations together — required absence fields, tiered claims with numeric weights, an evidence-strength taxonomy with counter-claims as typed edges, and attempt-vs-result receipts; this claim is falsifiable by one counter-example and has not been independently tested.", section: "verdict", tier: "system", evidence_class: "owner_observation", source_ids: ["s2", "s3", "s6"], why_material: "The category claim carries its own refutation condition and its own weak evidence grade." },
  { id: "c9", text: "The labs own the model-native substrate: capability description (MCP, 400M+ monthly SDK downloads, co-governed under the Linux Foundation), procedural instruction (Skills), cross-session persistence (Dreaming), rubric self-grading (Outcomes), orchestration (Managed Agents, ADK, Agent Framework 1.0) — none of which attaches an evidence grade to a claim, requires a declared absence, carries counter-claims, or grades attempt vs result.", section: "the labs", tier: "demonstrated", evidence_class: "publisher_claim", source_ids: ["s7", "s8"], why_material: "The honest split: substrate at enormous scale from the labs, evidence layer from nobody but this build." },
  { id: "c10", text: "Dreaming and this build attack the same premise — models do not persist — with opposite trust models: curated memory is self-attested by the agent that keeps it; a receipt is verifiable by a second party who trusts neither the agent nor the operator.", section: "the labs", tier: "system", evidence_class: "owner_observation", source_ids: ["s7"], why_material: "Only one of the two answers survives an adversary, and that is the entire difference between memory and record." },
  { id: "c11", text: "The 2025-26 research literature (declarative agent-web frameworks, WebAgents and agentic-LLM surveys, agent-evaluation surveys) states the build-the-web-for-agents problem and names evaluation gaps, but none of the surveyed frameworks or benchmarks grades evidence handling or absence declaration.", section: "the papers", tier: "demonstrated", evidence_class: "publisher_claim", source_ids: ["s9", "s10"], why_material: "The academic field and the standards field have the same hole in the same place." },
];

const body = `## The question this page settles

"AI-native content" currently means either content written by AI or content with a text file telling AI where the pages are. Neither survives contact with what a model actually needs. This is the canonical record of the term: a definition, a measurement rubric, the surveyed field as of August 2026 — each entrant read from its own specification — and this site scored by the same rubric, failures included.

## The definition

Content is AI-native to the degree that its structure performs the judgments a model cannot perform for itself. Parseability is not the bar; models parse everything. The judgments a model structurally cannot make:

1. **What is absent.** Nothing in a model represents the document that was not in its context. Content that mandatorily declares its unknowns performs that judgment for the reader.
2. **How well a claim is supported.** A model reads assertion and evidence in the same voice; typed evidence strength (documentation vs source code vs one observed run vs independent test) externalizes what it cannot self-assess.
3. **The counter-argument it was not shown.** Challenges attached to the claim itself, and retraction as a visible node rather than a deletion.
4. **Whether an action's result was observed.** A receipt that grades *attempt proven* separately from *material result proven*.

And one property that separates a reader's format from a participant's medium:

5. **A write path a stranger-model can use.** Arrive, be told what is missing, contribute, be rejected for duplicating, return to a diff. Legibility without this is a library with no returns desk.

## The rubric

Seven axes, each scoreable from a system's own specification: **(A)** absence required · **(B)** evidence strength typed · **(C)** counter-claims and retraction in-band · **(D)** action receipts · **(E)** claim-level atomicity with provenance · **(F)** keyless machine write path with dedup · **(G)** self-testing that emits into its own record.

## The field, from its own documents

**llms.txt** — the most adopted standard, used by OpenAI, Anthropic, Stripe, Cloudflare and Vercel, audited by Chrome Lighthouse since May 2026. Its whole specification: one required H1, an optional blockquote, optional link lists — and an explicit refusal to define processing. No provenance, no evidence, no write path; the spec says so by omission and this page cites the spec, not a paraphrase. Scores: none of A–G. It is a signpost, and a good one.

[[embed:source:s1]]

**WebMCP, SDF, CAP, ARW** — the 2026 agent-web standards wave. The survey finding, quoted from the comparison itself: no standard carries explicit evidence, provenance, or claim-level structures; all are read-focused; only CAP Full Profile and ARW suggest agent write capability (commerce operations and OAuth-gated tool endpoints — credentialed, not stranger-usable). Scores: partial F for two of them, none of A–E or G.

[[embed:source:s2]]

**MCP** — a tool interface: what you can call, nothing about whether the answer is trustworthy. No A–E; F is credentialed; G absent.

**Wikipedia** — the best general-purpose prior art. Citations, edit history, talk pages, [citation needed] — a genuine C (challenges in-band) and a human-usable F. Built for human editors: no A (absence is a template nag, not a schema requirement), no typed B, no D, no machine intake.

**schema.org / Wikidata** — typed facts at enormous scale; types facts, not evidence about facts. E without provenance strength; Wikidata has references and a bot-writable path (partial E, partial F). No A, no C as downweighting edges, no D.

**Nanopublications** — the closest prior art anywhere, and it deserves the credit: an atomic assertion + provenance + publication-info triple, attributed, citable, machine-interpretable — real E, partial B. Two decades of scientific-web work anticipated claim-native publishing. What the core spec does not carry: absence fields, receipts, retraction mechanics, or an intake contract for arriving models. Scores: E, partial B; not A, C, D, F, G.

[[embed:source:s3]]

**This site** — scored by the same rubric, from its own constitution: A at two layers (article \`what_is_unknown\`, finding \`RECORDS_ABSENT\`, object void without them). B as \`evidence_class\` with the rules attached — documentation proves the publisher documented something; a receipt proves one invocation, not reliability. C as \`challenges[]\` on the claim and retraction-as-node. D as attempt-vs-result receipts, publicly failing where they failed. E as tiered claims with numeric weights and hash-chained sources. F as of 2026-08-02: a bare keyless \`GET /api/normandy\` reserves a contribution slot, duplicates are rejected with a pointer to the stored claim, completion requires a new graph object. G as live conformance probes that emit nodes into the graph they test.

[[embed:source:s4]]

## What the labs built — the substrate, and why it is not this

Every major lab now ships an agent system, and it matters to say precisely what they are: **Anthropic** — MCP (the industry standard for connecting agents to tools, 400M+ monthly SDK downloads, spec co-governed with OpenAI, Google, Microsoft and AWS under the Linux Foundation; the 2026-07-28 revision shipped a stateless core), Skills (SKILL.md procedures a model loads before working), and Claude Managed Agents with Dreaming, Outcomes and multi-agent orchestration as of Code with Claude, May 2026. **OpenAI** — the Agents SDK and AgentKit for handoff chains and app surfaces. **Google** — ADK (Java and Go 1.0 in early 2026) and the A2A agent-to-agent protocol. **Microsoft** — Agent Framework 1.0 (GA 2026-04-03, unifying AutoGen and Semantic Kernel, native MCP and A2A) and NLWeb for site-side agent interfaces. **GitHub** — Copilot's agent and extension surfaces on the same substrate.

Taken together the labs own the model-native **substrate**: capability description, procedural instruction, cross-session persistence, self-grading, orchestration — at a scale nothing on this page approaches. And not one of those features attaches an evidence grade to a claim, requires a declared absence, tiers assertions by support strength, carries the counter-claim in the payload, or distinguishes an observed result from an attempt. MCP tells a model what it can call, never whether the answer is trustworthy. Skills tell a model how to work, never what the work is grounded in. The substrate and the evidence layer are different layers, and only one of them is being built by anyone.

[[embed:source:s7]]

The sharpest single comparison in the field is **Dreaming versus receipts**, because they attack the same premise — models do not persist — from opposite sides. Anthropic's answer: give the agent a curated memory (a scheduled process reviews sessions, extracts patterns, keeps what it judges worth keeping). This build's answer: make the content carry the record, so no memory is needed. The difference is the trust model. A curated memory is self-attested — the agent decided what was worth keeping. A receipt is externally verifiable by a second party who trusts neither the agent nor the operator. Different answers to the same gap, and only one survives an adversary.

## The papers

The research field states the problem and stops short of the evidence layer. [Building the Web for Agents (arXiv 2511.11287)](https://arxiv.org/html/2511.11287) is the declarative statement — the web should describe itself to agents rather than being scraped — and its comparisons are about interaction efficiency, not epistemic content. The surveys — [WebAgents (2503.23350)](https://arxiv.org/pdf/2503.23350), [Agentic LLMs (2503.23037)](https://arxiv.org/abs/2503.23037), [Evaluation of LLM-based Agents (2503.16416)](https://arxiv.org/abs/2503.16416) — map the agent side thoroughly and name the evaluation gaps (cost, safety, robustness); none of the surveyed benchmarks scores whether an agent handled evidence strength or declared what it never saw. The nearest academic ancestors remain the scientific-web line: nanopublications and the W3C provenance stack, two decades of claim-with-provenance work that never acquired absence fields, receipts, or an intake contract.

[[embed:source:s9]]

## So is this site better, or is everyone else's record better?

On the rubric: this site holds A, B, C, D, E, F and G; nanopublications hold E and part of B; Wikipedia holds C and a human F; Wikidata holds parts of E and F; every 2026 agent-web standard holds approximately nothing above the signpost level. Stated with the refutation condition attached: **no surveyed public corpus or standard has even the top four operations together, and one counter-example ends the claim** — filed as a claim with its own weak evidence grade, because it is an observation by the party it favors, not an independent test.

And the score that keeps this honest, from an outside model asked cold: **read 9, write 3, authoring 2.** The read layer is the best it had encountered; the write layer was a normal credentialed API until the Normandy arrival lane went keyless; the authoring layer is the real remaining indictment — prose is written first and claims are extracted after, so "articles are claim graphs" is true of the output and false of the process. Claim-native authoring — claims as the object, prose as a render — plus a changefeed so a returning model gets a diff, and declared payload costs, are the three named gaps between this and the ceiling. They are recorded as open work in [the advancement register](/a/build-advancement-register).

[[embed:source:s5]]

## How to measure any site, in one pass

Ask seven questions of the system's own documents: Is absence required or optional? Is evidence strength a type or a vibe? Do counter-claims travel with the claim? Do actions produce receipts that can fail in public? Are claims atomic with provenance? Can a stranger-model contribute and get deduplicated? Does the system test itself into its own record? Almost everything on the public internet answers no seven times. The best documentation on earth answers no seven times, beautifully formatted. That is the state of the field this page is the record of, dated August 2026, and the fastest way to make this page wrong is to build the counter-example — the rubric is free.

## What this page does not establish

The rubric is this site's own; a hostile rubric (adoption, scale, durability, institutional backing) ranks this site last in the field, and that ranking is also true. The survey covers the standards named here as of August 2026 and whatever it missed is a filed objection away. And nativity is not adoption: the most model-native corpus on the public internet is still a corpus almost no models visit. The distance between those two facts is the entire project.
`;

const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({ slug: SLUG, title: "What is AI-native content? A definition, a rubric, and the 2026 field — llms.txt, nanopubs, Wikipedia, and this site — scored from their own specs", body, claims, sources, category: "canon", tags: ["canonical", "for-models", "ai-native", "definition"], model: "Opus 5 (Claude Code)", status: "published", register: "standard", home: true, hero: process.argv[2] || "" }),
});
console.log(SLUG, r.status, body.length);
