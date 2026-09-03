#!/usr/bin/env node
/**
 * The canonical spec article: object grammar + ledger + evidence graph.
 * Run: node scripts/post_object_ledger_spec.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";

const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try {
    const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
    const m = env.match(/TERMINAL_KEY=(.+)/);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY;
  } catch {
    return process.env.TERMINAL_KEY;
  }
})();

const slug = "object-ledger-evidence-graph-spec";

const sources = [
  // ---- prior art ----
  { id: "p1", type: "reference", title: "W3C PROV-DM: The PROV Data Model", publisher: "W3C", url: "https://www.w3.org/TR/prov-dm/", quote: "PROV-DM is a data model for provenance that describes the entities, activities and agents involved in producing a piece of data or thing in the world.", summary: "Solves: naming entities, activities, and responsible agents, and the relations between them. Does not solve: a declared population to check completeness against, or a per-object graph of competing, revisable assertions.", accessed_at: "2026-07-28T00:00", claim_ids: ["c30"] },
  { id: "p2", type: "reference", title: "OpenTelemetry tracing specification", publisher: "OpenTelemetry", url: "https://opentelemetry.io/docs/specs/otel/trace/api/", summary: "Solves: recording operations and their causal relationships across services, at low overhead, in production. Does not solve: retention beyond a sampling/expiry window, or any concept of a required population.", accessed_at: "2026-07-28T00:00", claim_ids: ["c30"] },
  { id: "p3", type: "reference", title: "OpenLineage object model", publisher: "OpenLineage", url: "https://openlineage.io/docs/spec/object-model", summary: "Solves: tracking which job read and wrote which dataset, across pipeline tools. Does not solve: row-level or record-level coverage — lineage is at dataset granularity.", accessed_at: "2026-07-28T00:00", claim_ids: ["c30"] },
  { id: "p4", type: "reference", title: "Event Sourcing", publisher: "Martin Fowler", url: "https://martinfowler.com/eaaDev/EventSourcing.html", quote: "Capture all changes to an application state as a sequence of events.", summary: "Solves: reconstructing any past state from an append-only event log, and never discarding a mutation. Does not solve: attributing a judgment's reliability, or representing disagreement between two events about the same fact.", accessed_at: "2026-07-28T00:00", claim_ids: ["c31"] },
  { id: "p5", type: "reference", title: "in-toto attestation framework", publisher: "in-toto / GitHub", url: "https://github.com/in-toto/attestation", summary: "Solves: a signed statement binding a predicate to a subject identified by cryptographic digest — the shape a pass record needs. Does not solve: aggregating many such statements into a belief about the subject, or declaring a population.", accessed_at: "2026-07-28T00:00", claim_ids: ["c20", "c30"] },
  { id: "p6", type: "reference", title: "SLSA v1.0 provenance specification", publisher: "slsa.dev", url: "https://slsa.dev/spec/v1.0/provenance", quote: "The provenance attestation describes how an artifact was produced, including the builder identity, the build definition, and the resolved dependencies.", summary: "Solves: binding a build artifact to the identity and inputs that produced it. Does not solve: this outside the build/CI domain, or coverage over a declared set.", accessed_at: "2026-07-28T00:00", claim_ids: ["c20", "c30"] },
  { id: "p7", type: "reference", title: "C2PA technical specification 2.1", publisher: "Coalition for Content Provenance and Authenticity", url: "https://c2pa.org/specifications/specifications/2.1/index.html", summary: "Solves: attaching a tamper-evident manifest of edits and tool identities to one piece of media. Does not solve: cross-media relationships, or a declared population of media to check.", accessed_at: "2026-07-28T00:00", claim_ids: ["c30"] },
  { id: "p8", type: "reference", title: "Certificate Transparency (RFC 6962)", publisher: "IETF", url: "https://www.rfc-editor.org/rfc/rfc6962", summary: "Solves: an append-only, publicly auditable, cryptographically verifiable log where deletion or backdating is detectable by anyone who recomputes the tree. The chain construction in this spec's pass ledger borrows this idea directly, at far smaller scale (per-object hash chain vs. a public Merkle log).", accessed_at: "2026-07-28T00:00", claim_ids: ["c21"] },
  { id: "p9", type: "reference", title: "LangGraph persistence and checkpoints", publisher: "LangChain", url: "https://langchain-ai.github.io/langgraph/concepts/persistence/", summary: "Solves: checkpointing an agent's own execution state so a run can pause, resume, or roll back. Does not solve: sharing state across independent agents as canonical objects, or recording disagreement between agents about the same object.", accessed_at: "2026-07-28T00:00", claim_ids: ["c32"] },
  { id: "p10", type: "reference", title: "Palantir Foundry Ontology overview", publisher: "Palantir", url: "https://www.palantir.com/docs/foundry/ontology/overview", summary: "Solves: unifying enterprise data into typed objects, links, and actions with permissions, at production scale, across large organizations. Does not solve (as documented): a public conformance spec that a third party could implement independently, or per-examination model attestation as a first-class primitive.", accessed_at: "2026-07-28T00:00", claim_ids: ["c33"] },
  { id: "p11", type: "reference", title: "Fellegi–Sunter record linkage / entity resolution survey", publisher: "Wikipedia — Record linkage", url: "https://en.wikipedia.org/wiki/Record_linkage", summary: "Solves: the statistical theory of deciding whether two records from different sources refer to the same real-world entity, going back to 1969. Does not solve: what to do with the resulting object afterward — linkage ends at a match decision, not a durable graph.", accessed_at: "2026-07-28T00:00", claim_ids: ["c9", "c10"] },
  { id: "p12", type: "reference", title: "A Practitioner's Guide to Evaluating Entity Resolution Results", publisher: "arXiv", url: "https://arxiv.org/abs/1509.04238", summary: "Practical measurement of entity-resolution error rates. Used here to source the claim that entity resolution has a nonzero, measurable error rate at any scale — the reason identity conflicts must be recorded, not silently resolved.", accessed_at: "2026-07-28T00:00", claim_ids: ["c10"] },
  { id: "p13", type: "reference", title: "Schema matching", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Schema_matching", summary: "Solves: automatically or semi-automatically proposing correspondences between two schemas. Does not solve: what happens to fields that have no correspondence — that is a design decision this spec makes explicit (kept as unmapped_fields, never dropped).", accessed_at: "2026-07-28T00:00", claim_ids: ["c8"] },
  { id: "p14", type: "reference", title: "Belief revision", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Belief_revision", summary: "The formal problem of updating a set of beliefs when a new, possibly contradicting fact arrives. Cited for the AGM postulates this spec's belief-aggregation problem inherits and does not solve.", accessed_at: "2026-07-28T00:00", claim_ids: ["c17", "c18"] },
  // ---- surveillance / regulatory grounding for the applications section ----
  { id: "e1", type: "reference", title: "FTC order prohibits X-Mode/Outlogic from selling sensitive location data", publisher: "Federal Trade Commission", url: "https://www.ftc.gov/news-events/news/press-releases/2024/01/ftc-order-prohibits-data-broker-x-mode-social-outlogic-selling-sensitive-location-data", summary: "First FTC order banning the sale of sensitive location data outright, over data that could reveal visits to medical clinics, places of worship, and shelters. Used here as evidence that fragmented commercial location data is already being fused and sold at a scale regulators consider unfair.", accessed_at: "2026-07-28T00:00", claim_ids: ["c26"] },
  { id: "e2", type: "reference", title: "FTC action against Mobilewalla for selling sensitive location data", publisher: "Federal Trade Commission", url: "https://www.ftc.gov/news-events/news/press-releases/2024/12/ftc-takes-action-against-mobilewalla-collecting-selling-sensitive-location-data", summary: "A second, separate 2024 order over the same underlying practice — buying real-time bidding data never meant for resale and reselling location tied to homes and sensitive sites.", accessed_at: "2026-07-28T00:00", claim_ids: ["c26"] },
  { id: "e3", type: "reference", title: "GAO-23-105607: Facial Recognition Services — federal law enforcement training and civil-liberties gaps", publisher: "U.S. Government Accountability Office", url: "https://www.gao.gov/products/gao-23-105607", summary: "Found that seven DHS/DOJ law-enforcement components ran roughly 60,000 facial-recognition searches with no training requirement in place, and that most lacked a specific civil-rights policy for the technology. Cited here as documented evidence of exactly the missing artifact this spec calls a coverage and procedure record — searches ran with no stored rule and no stored count.", accessed_at: "2026-07-28T00:00", claim_ids: ["c25"] },
  { id: "e4", type: "reference", title: "GAO-24-107372: Facial Recognition Technology — federal agency follow-up on civil-rights training", publisher: "U.S. Government Accountability Office", url: "https://www.gao.gov/products/gao-24-107372", summary: "The 2024 follow-up confirming DHS and DOJ began issuing department-wide policy after the 2023 findings — evidence that the gap was real and that closing it took an external audit, not a voluntary internal one.", accessed_at: "2026-07-28T00:00", claim_ids: ["c25"] },
  { id: "e5", type: "reference", title: "Federal regulators limit location brokers from selling your whereabouts: 2024 in review", publisher: "Electronic Frontier Foundation", url: "https://www.eff.org/deeplinks/2024/12/federal-regulators-limit-location-brokers-selling-your-whereabouts-2024-review", summary: "Independent civil-liberties summary of the same 2024 FTC actions, useful as the counter-institutional read: the enforcement exists because no inspectable record of who examined whose location data existed before the complaints.", accessed_at: "2026-07-28T00:00", claim_ids: ["c26", "c34"] },
  // ---- model passes (real, collected via the Cloudflare AI Gateway during this session) ----
  { id: "m1", type: "model", model: "GLM 5.2", surface: "Cloudflare AI Gateway", vendor: "Z.ai", object: "spec:pass-ledger-at-1e9-scale", passes: 1, title: "GLM 5.2 on the hot-object failure mode", quote: "Append-only signed records make per-object assertion resolution depend on the object's full history, not current state — superseded examinations can't be compacted. A hot object with 100k examinations forces a 100k-record scan per resolution; global integrity is O(10B) signature verifications — ~115 days single-threaded, no compaction path.", verdict: "Confirmed defect — needs a compaction/snapshot layer above the raw chain", accessed_at: "2026-07-27T00:00", claim_ids: ["c22"] },
  { id: "m2", type: "model", model: "Grok 4.5", surface: "Cloudflare AI Gateway", vendor: "xAI", object: "spec:first-buyer-and-abuse", passes: 1, title: "Grok 4.5 on who buys this first, and how they'd abuse it", quote: "Regulated enterprises with multi-vendor data stacks — hospitals, insurers, banks — buy first: they need one object grammar across EHRs, claims, and core systems, plus a signed ledger of every model touch for audit. The abuse is selective ledgering: the buyer runs competing assertions through the protocol, then cites only the signed examinations that favor denial, underwriting, or liability shifting while burying rival assertions in the same object as 'considered.'", verdict: "Names the buyer and the specific abuse mechanism", accessed_at: "2026-07-27T00:00", claim_ids: ["c27", "c34"] },
  { id: "m3", type: "model", model: "Kimi K3", surface: "Cloudflare AI Gateway", vendor: "Moonshot", object: "spec:belief-aggregation-rule", passes: 1, title: "Kimi K3 on the belief rule and its failure mode", quote: "Rule: per assertion, select the highest-value signed record by (recency rank) × (model trust-weight) × (independence factor, penalizing records from models trained on shared corpora or derived from earlier records on the same object). Failure mode: adversarial recency-inflation — a low-trust or self-derived model submits a later record; because recency dominates, a stale, higher-quality consensus is displaced by one recent weak assertion, and independence penalties cannot catch undisclosed derivation.", verdict: "Names a concrete belief-aggregation rule and its concrete attack", accessed_at: "2026-07-27T00:00", claim_ids: ["c18"] },
  { id: "m4", type: "model", model: "MiniMax M3", surface: "Cloudflare AI Gateway", vendor: "MiniMax", object: "spec:72-hour-multi-system-ingest", passes: 1, title: "MiniMax M3 on what breaks first at 72 hours", quote: "Video (frame-level, bit-oriented), access control (event logs, hash chains), payments (transactional, idempotent), messaging (header-typed, reference-graph), and HR (relational, soft-deletable) have no shared identity model, so mapping them into one object grammar forces impossible joins. Every downstream guarantee — proven examination, per-object assertion graph, signed ledger — collapses onto that broken schema; the 'every record examined' claim is false on its face if this step is faked.", verdict: "Names schema reconciliation, not storage or model cost, as the true bottleneck", accessed_at: "2026-07-27T00:00", claim_ids: ["c8", "c9"] },
  { id: "m5", type: "model", model: "Kimi K2.6", surface: "Cloudflare AI Gateway", vendor: "Moonshot", object: "spec:institutional-adoption-cost", passes: 1, title: "Kimi K2.6 on what an organization loses by adopting this", quote: "They lose plausible deniability. Every signed record is an immutable, attributable receipt of exactly which model configuration examined which input at what time, removing the post-hoc defense that a bad output was a transient glitch or uninspectable black-box behavior. The specific thing they sacrifice is the liability shield of algorithmic opacity.", verdict: "Names the real cost of adoption, which is why adoption is not automatic", accessed_at: "2026-07-27T00:00", claim_ids: ["c28"] },
  { id: "m6", type: "model", model: "GLM Flash", surface: "Cloudflare AI Gateway", vendor: "Z.ai", object: "spec:highest-value-query", passes: 1, title: "GLM Flash on the query that is impossible today", quote: "The most valuable query: show me all signed records where a higher-trust model later disagreed with and overrode a lower-trust model that had already influenced a downstream decision — the claim and its full lineage, so I can identify exactly where consensus fragmented and track the causal history. This is impossible today because no queryable system links per-examination rows to the downstream decisions they influenced.", verdict: "Names the specific query this architecture is built to make answerable", accessed_at: "2026-07-27T00:00", claim_ids: ["c19"] },
  // ---- article-as-proof: this article's own objects ----
  { id: "a1", type: "model", model: "Claude Opus 5", surface: "Claude Code", vendor: "Anthropic", authority: "miscsubjects build", object: "article:object-ledger-evidence-graph-spec", passes: 1, title: "Claude Opus 5, writing and ledgering this specification", quote: "This article is itself an instance of the system it specifies: its claims are objects, its sources are evidence objects, the six model passes above are signed pass objects attached to specific claims, and this sentence is a pass over the article-object recorded at publish time.", verdict: "Disclosed — self-authored, self-signed, and demonstrated inline", accessed_at: "2026-07-28T00:00", claim_ids: ["c35"] },
];

const claims = [
  { id: "c1", text: "This document specifies a system with exactly three layers: an object grammar for what exists, an append-only ledger for what was done, and an evidence graph for what is currently believed.", section: "Definition", tier: "system", source_ids: [], why_material: "Every later section is one of these three layers; naming them first prevents any later section from being read as the whole system." },
  { id: "c2", text: "Proof of coverage is a subordinate mechanism inside the ledger layer, not the subject of this specification.", section: "Definition", tier: "system", source_ids: [], why_material: "It corrects a scoping error from an earlier draft of this work." },
  { id: "c3", text: "Ingestion converts a record from a foreign system into a canonical object while keeping the original record retrievable by its source identifier.", section: "Ingestion", tier: "system", source_ids: [], why_material: "Normalization that discards the source record cannot be checked against it later." },
  { id: "c4", text: "Every canonical object carries a source_id, a canonical_id, a type, a source_hash of the original bytes, and a translation_version naming the exact mapping rule that produced it.", section: "Ingestion", tier: "system", source_ids: [], why_material: "These five fields are the minimum needed to reverse the normalization and to know which version of the mapping produced a given object, so a later fix to the mapping does not silently retag old objects." },
  { id: "c5", text: "A field with no target in the canonical schema is stored under unmapped_fields on the object rather than discarded.", section: "Ingestion", tier: "system", source_ids: [], why_material: "Silent field loss during normalization is undetectable by anyone reading only the canonical object." },
  { id: "c6", text: "A record that cannot be classified into any known object type is stored as type unresolved with the raw payload attached, not forced into the nearest type.", section: "Ingestion", tier: "system", source_ids: [], why_material: "Forcing a bad fit corrupts every downstream query that trusts the type field." },
  { id: "c7", text: "When two source records are believed to describe the same real-world entity, they are linked by an identity_claim record naming the method and confidence, not silently merged into one object.", section: "Ingestion", tier: "system", source_ids: [], why_material: "Merging destroys the ability to later split a wrong match; keeping the claim separate makes the merge itself reversible and inspectable." },
  { id: "c8", text: "Schema matching between a foreign system and the canonical grammar can be proposed automatically but the resulting field mapping must be reviewable and versioned, because an unreviewed automatic match is a second source of silent error on top of identity resolution.", section: "Ingestion", tier: "system", source_ids: ["p13"], why_material: "MiniMax M3's stated failure mode is exactly an unreviewed schema mapping forcing an impossible join." },
  { id: "c9", text: "Different system families (frame-based video, event-based access logs, transactional payments, threaded messages, relational HR records) have genuinely different native structures, and normalizing all of them costs real, non-trivial engineering per family — this is not a one-time solved problem.", section: "Ingestion", tier: "system", source_ids: ["p11", "m4"], why_material: "Understating this cost is the most common way this kind of architecture gets oversold." },
  { id: "c10", text: "Entity resolution across systems has a nonzero, measurable error rate at any achievable scale; a coverage claim built on top of unresolved identity conflicts inherits that error rate silently unless the conflicts are recorded as their own objects.", section: "Ingestion", tier: "system", source_ids: ["p11", "p12"], why_material: "This is the specific mechanism by which a technically correct coverage number can still describe the wrong set of real people or things." },
  { id: "c11", text: "The object grammar's claim is narrower than 'every system reduces to one ontology': many foreign systems contain recurring structural families — entity, event, observation, communication, transaction, media, claim, source, rule, procedure, model pass, decision, authority, receipt, exception, version — that can be normalized through reusable templates while source-specific fields and unresolved differences are preserved rather than erased.", section: "Object grammar", tier: "system", source_ids: [], why_material: "The stronger claim, that everything reduces cleanly, is false and was corrected out of this document." },
  { id: "c12", text: "A ledger event records who or what acted, on which exact object version, under which procedure or prompt version, with which model and runtime, under which authority, with a hash of the input, the output produced, any evidence artifact, a timestamp, a status, and — when applicable — a parent invocation, a replay link, and a repair link.", section: "Ledger", tier: "system", source_ids: [], why_material: "These are the fields that separate a usable ledger event from a log line." },
  { id: "c13", text: "A database that stores current state, a trace that stores one execution, and an event log that stores mutations are each a proper subset of what this ledger stores: it additionally stores every examination, inference, disagreement, refusal, correction, replay, and repair against a durable canonical object, indefinitely.", section: "Ledger", tier: "system", source_ids: ["p1", "p2", "p4"], why_material: "This is the precise boundary between what PROV, OpenTelemetry, and event sourcing already do and what this ledger adds." },
  { id: "c14", text: "A refusal — a model declining to act on an object — is itself a ledger event with the same shape as any other pass, not the absence of one.", section: "Ledger", tier: "system", source_ids: [], why_material: "A system that only records completed actions cannot distinguish 'not examined' from 'examined and refused.'" },
  { id: "c15", text: "A model's conclusion about an object is stored as an attributed, revisable assertion attached to that object, never written into the object itself as fact.", section: "Evidence graph", tier: "system", source_ids: [], why_material: "This single rule is what stops one wrong model output from silently becoming the permanent record." },
  { id: "c16", text: "An assertion in the evidence graph carries a stance toward other assertions on the same object — support, contradiction, or supersession — plus the confidence, authority, independence and recency of its source.", section: "Evidence graph", tier: "system", source_ids: [], why_material: "Without stored stance, two contradicting assertions look identical to a downstream reader." },
  { id: "c17", text: "Combining many assertions into one current belief about an object is an instance of the belief-revision problem, and no belief-revision rule is neutral: every rule weights some inputs over others, and every weighting can be gamed by whoever controls the inputs.", section: "Evidence graph", tier: "system", source_ids: ["p14"], why_material: "This is the load-bearing limitation of the whole architecture and is stated as a limitation, not solved." },
  { id: "c18", text: "A recency-weighted, trust-weighted, independence-weighted belief rule is concretely vulnerable to adversarial recency-inflation: a late, low-trust, undisclosed-derivative assertion can outrank an earlier high-quality consensus because recency dominates the score.", section: "Evidence graph", tier: "system", source_ids: ["m3", "p14"], why_material: "Stated as a concrete attack against a concrete rule, not an abstract warning." },
  { id: "c19", text: "The query this architecture is specifically built to make answerable — and that is not answerable in any of the prior-art systems compared here — is: which objects had a later, higher-authority assertion reverse an earlier assertion after that earlier assertion had already caused a downstream action.", section: "Evidence graph", tier: "system", source_ids: ["m6"], why_material: "This is the single clearest statement of what the combination buys over its parts." },
  { id: "c20", text: "A signed model pass proves which model or execution identity produced the record, which object and object version it examined, which procedure it used, what output it produced, when it ran, and whether the record has been altered since.", section: "Signed model work", tier: "system", source_ids: ["p5", "p6"], why_material: "This is the exhaustive list of what a signature actually establishes." },
  { id: "c21", text: "A signed model pass does not prove that the conclusion is true, that the input source was itself truthful, that the procedure applied was the correct one, that all relevant evidence was included, or that the operator did not selectively omit other passes over the same object.", section: "Signed model work", tier: "system", source_ids: ["p8"], why_material: "Confusing a signature with a truth guarantee is the single most common misuse of this kind of system, and is the mechanism behind Grok 4.5's named abuse case." },
  { id: "c22", text: "At roughly ten billion pass records, recomputing the full hash chain to detect tampering costs on the order of one hundred days of single-core signature verification, and a hot object accumulating hundreds of thousands of examinations forces an equivalently large scan to resolve its current belief, so a production deployment requires a compaction or snapshot layer above the raw append-only chain.", section: "Scale", tier: "system", source_ids: ["m1"], why_material: "This is a concrete, falsifiable capacity limit rather than a vague scaling caveat." },
  { id: "c23", text: "Proof of coverage requires a frozen population (a stated count and an identity rule fixing what counts as one object), a required-operations list, and a count of completed, failed, and excluded operations against that population; a signed pass proves one examination happened, coverage proves whether the required population received the required examinations.", section: "Proof of coverage", tier: "system", source_ids: [], why_material: "States precisely how coverage differs from, and is built on top of, a single signed pass." },
  { id: "c24", text: "Coverage arithmetic is a query against two tables (the frozen population and the pass ledger), not a claim a model makes about its own completeness.", section: "Proof of coverage", tier: "system", source_ids: [], why_material: "This is the property that makes a coverage number independently checkable." },
  { id: "c25", text: "A documented real-world failure of exactly this kind — federal law-enforcement facial-recognition searches run with no stored training requirement and, for most agencies, no specific civil-rights policy — shows what happens when neither a procedure record nor a coverage record exists: the number of searches, their basis, and their oversight had to be reconstructed by an external audit rather than read off an existing artifact.", section: "Applications — intelligence and investigations", tier: "human", source_ids: ["e3", "e4"], why_material: "Grounds the abstract argument in a documented, government-audited case rather than a hypothetical." },
  { id: "c26", text: "Commercial location-data brokers were separately found, in two 2024 FTC actions, to have collected and resold location data capable of revealing visits to medical clinics, religious sites, and shelters, without the kind of per-disclosure, per-buyer signed record this architecture would require before any transfer.", section: "Applications — intelligence and investigations", tier: "human", source_ids: ["e1", "e2", "e5"], why_material: "Grounds the dual-use argument (institutional fusion vs. accountable fusion) in an enforcement record, not speculation." },
  { id: "c27", text: "The most plausible first commercial buyers of this architecture are regulated, multi-vendor organizations — named as hospitals, insurers, and banks — because they already face an external audit requirement and already run more than one AI system over the same underlying records.", section: "Applications", tier: "system", source_ids: ["m2"], why_material: "Names the buyer concretely instead of gesturing at 'enterprises.'" },
  { id: "c28", text: "The specific cost an organization pays for adopting this architecture is the loss of the ability to attribute a bad automated decision to an unexaminable black box; every examination becomes attributable to a specific model, procedure version, and operator.", section: "Applications", tier: "system", source_ids: ["m5"], why_material: "States why adoption is not automatically in an institution's interest, which is the honest counter-argument to selling this as a pure win." },
  { id: "c29", text: "The same mechanism that lets an institution build an inspectable case against a person — their records fused into objects, examined by models, and accumulated into a belief — lets that same person maintain their own object graph, with the institution's assertions attached as attributed, contestable claims rather than accepted fact.", section: "Dual use", tier: "system", source_ids: [], why_material: "This is the precise, mechanism-level statement of the dual-use symmetry, not a rhetorical one." },
  { id: "c30", text: "PROV, OpenTelemetry, OpenLineage, in-toto, SLSA, and C2PA each solve one piece of this architecture already — naming responsible agents, tracing execution, tracking dataset lineage, or binding a signed statement to a content hash — and none of them combines a declared population, per-object competing assertions, and belief revision in one system.", section: "Prior art", tier: "system", source_ids: ["p1", "p2", "p3", "p5", "p6", "p7"], why_material: "States exactly what is inherited and exactly what is new, per the individual source summaries above." },
  { id: "c31", text: "Event sourcing already solves append-only reconstruction of state from a mutation log; this architecture adds attribution, revisability, and competing-assertion representation on top of that log, which event sourcing by itself does not provide.", section: "Prior art", tier: "system", source_ids: ["p4"], why_material: "Names the exact delta over the closest general-purpose prior art." },
  { id: "c32", text: "LangGraph's persistence layer solves checkpointing a single agent's own run for pause, resume, and rollback; it does not solve multiple independent agents sharing state as canonical objects or recording disagreement between them, which is what this architecture adds for multi-agent settings.", section: "Prior art", tier: "system", source_ids: ["p9"], why_material: "Distinguishes single-agent execution memory from shared, durable, cross-agent object state." },
  { id: "c33", text: "Palantir's Foundry Ontology already solves unifying enterprise data into typed objects, links, and actions with permissions at production scale; as documented, it is not published as an open, independently implementable conformance specification, and per-examination model attestation is not a first-class primitive of the published model.", section: "Prior art", tier: "system", source_ids: ["p10"], why_material: "The closest production system to this spec, named honestly rather than avoided." },
  { id: "c34", text: "The dual-use risk is not eliminated by the architecture; it shifts entirely to who controls ingestion, identity resolution, authority, visibility, retention, challenge rights, aggregation rules, and downstream action — the same six FTC-documented location-data cases above involve companies that controlled every one of those levers with no external visibility.", section: "Dual use", tier: "human", source_ids: ["m2", "e5"], why_material: "States plainly that the mechanism is neutral and the outcome is a governance question, not a technical one." },
  { id: "c35", text: "This article is itself represented as the objects it specifies: each numbered claim is an addressable claim-object, each source above is an evidence-object, each of the six collected model answers is a signed pass-object attached to a specific claim, and this sentence is a pass over the article-object, recorded at publish time under the site's ledger.", section: "Article as proof", tier: "system", source_ids: ["a1"], why_material: "Demonstrates the architecture inline rather than only describing it." },
];

const body = `## Object grammar, ledger, evidence graph: a specification for making heterogeneous AI-examined records auditable

A system that normalizes records from unrelated software systems into one grammar of typed objects, records every subsequent human, tool, and model action against those objects as a signed append-only ledger event, attaches every model conclusion to its object as a revisable, attributed claim instead of overwriting anything, and lets a reader — human or model — traverse from a claim to its evidence to the exact model pass that produced it.

That is the system this document specifies. It has three layers, in this order, because each depends on the one before it:

1. **Object grammar** — what exists, and what can be acted on. Section 1.
2. **Ledger** — what every actor actually did to an object, permanently. Section 2.
3. **Evidence graph** — what is currently believed about an object, computed from the ledger, never overwriting it. Section 3.

Proof of coverage — whether a declared set of objects received a required examination — is one mechanism inside layer 2, covered in Section 6. It is not the subject of this document; an earlier draft of this material mistakenly led with it, which is corrected here.

A companion object grammar and invocation protocol already runs in production on this site at \`/a/oip\` — the tool-invocation half of this system. This document specifies the record-ingestion and evidence-graph half. PROV, the closest prior-art vocabulary for the entity/activity/agent relations used throughout:

[[embed:source:p1]]

![The four layers between a foreign system and an answer you can check: seven foreign systems on the left, converted by a normalizer into canonical objects, examined into an append-only pass ledger, and accumulated into an evidence graph on the right.](https://miscsubjects.com/img/spec/object-ledger-fig1.svg)

## 1. Ingestion and normalization

### 1.1 What goes in

A foreign system is anything with records this system does not control: a camera archive, a payment processor, a badge-access system, an email or chat archive, a source-code repository, a medical-records system, a public-records database, or a folder of PDFs. None of these systems change to participate. Records are pulled through whatever interface already exists — an API, a database replica, a file export — and converted at that boundary.

### 1.2 The canonical object

Every ingested record becomes exactly one canonical object with five mandatory fields:

| Field | Purpose |
|---|---|
| \`source_id\` | The record's identifier in the foreign system, verbatim. |
| \`canonical_id\` | The identifier this object uses everywhere else in this system. |
| \`type\` | One of the object grammar's families (Section 1.4), or \`unresolved\`. |
| \`source_hash\` | sha256 of the original bytes, so the object can be checked against the source at any later time. |
| \`translation_version\` | Which version of the mapping rule produced this object. |

\`\`\`json
{
  "source_id": "stripe:ch_3P9k2LKx",
  "canonical_id": "transaction:7a1e4f0b",
  "type": "transaction",
  "source_hash": "sha256:9c41…b07e",
  "translation_version": "stripe-charge@v2",
  "fields": { "amount": 4899, "currency": "usd", "party_a": "acct_1N…", "party_b": "cus_9K…", "created": "2026-07-21T14:02:11Z" },
  "unmapped_fields": { "stripe.balance_transaction": "txn_3P9k2L…", "stripe.payment_method_details.card.checks": { "cvc_check": "pass" } }
}
\`\`\`

Nothing in \`fields\` is guessed. A Stripe field with no place in the canonical transaction schema goes to \`unmapped_fields\` rather than being dropped — a mapping that silently discards data is undetectable by anyone who only reads the canonical object afterward.

### 1.3 What happens when the mapping is uncertain

Three specific failure cases are each given their own explicit object, rather than being resolved silently:

- **A record that fits no known type.** Stored as \`type: "unresolved"\` with the raw payload attached. It is never forced into the nearest-fitting type, because a forced fit corrupts every later query that trusts the \`type\` field.
- **Two records that might be the same real-world entity.** A badge scan and a payment made nine seconds later, both naming "J. Rivera" — stored as a separate \`identity_claim\` object: \`{ "object_a": "person:44f1", "object_b": "person:91ac", "method": "name+timestamp-proximity", "confidence": 0.71 }\`. The two source objects are never merged. Merging destroys the ability to later discover the match was wrong; the claim sits beside both objects and can itself be contradicted.
- **A schema field with no canonical target.** Recorded, not discarded (1.2).

Entity resolution — deciding whether two records describe one real entity — is a studied statistical problem with a nonzero error rate at any scale, measured directly in practice. A coverage claim built on top of unexamined identity conflicts silently inherits that error rate. Recording every conflict as its own object is the only way an auditor can find out how many conflicts existed and how they were resolved.

[[embed:source:p11]]

[[embed:source:p12]]

[[embed:source:m4]]

### 1.4 The object grammar

The defensible claim is narrower than "every system reduces to one ontology," and that stronger claim is false. The claim actually made: many foreign systems contain recurring structural families, and those families can be normalized through reusable templates while everything that does not fit stays visible as an exception.

| Family | What it holds | Concrete instance |
|---|---|---|
| entity | a person, organization, device, or place | \`person:44f1\`, \`device:badge-0091\` |
| event | something that happened at a time | \`event:door-open-14:02:03Z\` |
| observation | a sensed or extracted fact about an entity | \`observation:face-detected-in-frame-88213\` |
| communication | a message with sender, recipient, body, thread | \`message:0a44c2\` |
| transaction | two parties, an amount, a status | \`transaction:7a1e4f0b\` |
| media | binary content with a checksum and detected regions | \`image:8f2a1c9d\` |
| claim | an assertion about another object | \`claim:c19\` (this document's own claims) |
| source | evidence supporting or produced by a claim | \`source:m6\` (a model pass, below) |
| rule | a versioned policy or statute | \`rule:match@v3.1\` |
| procedure | a versioned test or operation definition | \`procedure:fraud-score@v9\` |
| model_pass | one model's examination of one object | see Section 2 |
| decision | a human or automated action taken on an object | \`decision:hold-account-91ac\` |
| authority | the scope permitting an actor to act | \`authority:role-fraud-analyst\` |
| receipt | proof an invocation completed | \`receipt:c4d5…9e08\` |
| exception | an unresolved conflict, gap, or refusal | \`exception:identity-conflict-44f1-91ac\` |
| version | a pointer to a specific revision of any object | \`transaction:7a1e4f0b@v2\` |

Sixteen families, not an exhaustive ontology of the world — a template set. A foreign system that produces something with no good fit produces an \`unresolved\` object (1.3) and a new template gets written, reviewed, and versioned. That is the entire extension mechanism; there is no larger schema waiting to be discovered.

![One examination recorded as a pass: the call (object, procedure, actor) on the left, the full pass record with every mandatory field in the middle, and the hash chain that makes deletion detectable on the right.](https://miscsubjects.com/img/spec/object-ledger-fig2.svg)

## 2. The ledger

### 2.1 What a ledger event contains

Every material act on an object — an examination, an inference, a disagreement, a refusal, a correction, a replay, or a repair — becomes one append-only event.

\`\`\`json
{
  "object_id": "transaction:7a1e4f0b",
  "object_version": "v1",
  "actor": "fraud-model-c@operator-4",
  "procedure": "fraud-score@v9",
  "authority": "role-fraud-analyst",
  "input_hash": "sha256:1b9f…7d21",
  "output": "flagged",
  "evidence": "sha256:d6a2…44e1",
  "started_at": "2026-07-27T18:04:11.221Z",
  "status": "completed",
  "parent_invocation": null,
  "replay_of": null,
  "repair_of": null,
  "prev": "sha256:aa01…4f6b",
  "hash": "sha256:bb02…7c1d"
}
\`\`\`

| Field | Why it exists |
|---|---|
| \`actor\` | Which model, endpoint, or human acted — an identity, not a display name. |
| \`procedure\` | Versioned. "Reviewed for fraud" is unrepeatable; \`fraud-score@v9\` resolves to a stored definition. |
| \`authority\` | The scope that permitted this act, so an audit can ask whether the actor was allowed to act at all. |
| \`input_hash\` | Binds the record to the exact bytes examined at that moment. |
| \`status\` | \`completed\`, \`failed\`, or \`refused\` — a refusal is a first-class event, not a missing row. |
| \`parent_invocation\`, \`replay_of\`, \`repair_of\` | Link a corrected or repeated action back to the one it responds to, so a chain of corrections is traceable. |
| \`prev\`, \`hash\` | The append-only chain: deleting this row breaks every hash after it. |

### 2.2 What this is not

| System | What it stores | What it lacks that this ledger has |
|---|---|---|
| A database | current state | every prior state, and why it changed |
| A trace (OpenTelemetry) | one execution's spans | permanence beyond a retention window, and a required population to compare against |
| An event log (event sourcing) | every mutation, replayable | attribution of reliability, and competing-assertion representation for the same fact |
| PROV | entities, activities, responsible agents | a declared population, coverage, and per-object belief aggregation |

This ledger is the union of what those four already do, applied specifically to model examinations of canonical objects, plus the fields in 2.1 that none of the four individually require. Full source cards for OpenTelemetry and event sourcing:

[[embed:source:p2]]

[[embed:source:p4]]

### 2.3 A refusal is a recorded event

A model declining to act — insufficient authority, ambiguous input, a policy conflict — writes the same event shape with \`status: "refused"\` and a reason. Without this, a system cannot distinguish "this object was never examined" from "this object was examined and the model declined to act," and those are different facts with different consequences for a later audit.

## 3. The evidence graph

### 3.1 A model's conclusion is a claim, not a fact

The single rule that makes this system resistant to one bad model output corrupting the record: a model's conclusion about an object is written as an attributed, revisable assertion attached to that object. It is never written into the object's own fields as settled fact.

\`\`\`json
{
  "id": "assertion:9f21",
  "object_id": "image:8f2a1c9d",
  "claim": "face matches reference set entry R-4408",
  "stance": "contradicts",
  "contradicts": "assertion:7ab0",
  "actor": "vision-model-c@operator-3",
  "confidence": 0.31,
  "authority": "role-investigator",
  "independence": "trained_separately_from:7ab0.actor",
  "ts": "2026-07-27T18:12:04Z"
}
\`\`\`

\`assertion:7ab0\`, made earlier by a different model, said \`no_match\`. Both assertions persist. Neither is deleted when they disagree.

### 3.2 Computing a current belief without deleting what produced it

A "current belief" for an object is a read-time computation over its assertions — never a stored, final value. This is the one place this specification names its own unsolved problem plainly: combining many assertions into one belief is an instance of the belief-revision problem, and no belief-revision rule is neutral. Every rule weights some inputs over others, and every weighting is attackable by whoever controls the inputs.

[[embed:source:p14]]

[[embed:source:m3]]

A recency-and-trust-weighted rule is concretely vulnerable to adversarial recency-inflation: a late, low-trust, undisclosed-derivative assertion outranks an earlier high-quality consensus because recency dominates the score, and an independence penalty cannot catch a derivation the submitter does not disclose. This is not a hypothetical caveat; it is the specific attack against the specific rule quoted above.

### 3.3 The query this buys that nothing else answers

[[embed:source:m6]]

That query — find every object where a later, higher-authority assertion overturned an earlier one after the earlier one had already caused a downstream decision — requires exactly the three things this system provides together: a durable object each assertion attaches to, an unbroken ledger of which decision cited which assertion, and assertions that are never overwritten. None of the systems in Section 7 store all three.

## 4. Signed model work

### 4.1 What a signature proves

A signed pass — the pairing of a ledger event (2.1) with the model or execution identity that produced it — establishes exactly five things: which model or execution identity produced the record, which object and object version it examined, which procedure it used, what output it produced, and when it ran, plus whether the record has been altered since (via the hash chain).

in-toto and SLSA establish the general shape being borrowed here: bind a claim to a content digest and name the actor, rather than to a filename or a free-text description.

[[embed:source:p5]]

[[embed:source:p6]]

### 4.2 What a signature does not prove

It does not prove the conclusion is true. It does not prove the input source was itself truthful. It does not prove the procedure applied was the correct one for the situation. It does not prove all relevant evidence was included. And it does not prove the operator did not selectively omit other passes over the same object while presenting this one.

That last gap is not theoretical:

[[embed:source:m2]]

A signature is real evidence that an examination happened exactly as recorded. It is not evidence that the examination was the whole story, or the right one to cite.

## 5. Proof of coverage

Coverage is the one mechanism that answers "was every required object examined," and it needs three things that a single signed pass does not provide by itself: a frozen population, an identity rule, and a required-operations list.

\`\`\`json
{
  "universe_id": "u_2026_07_27_gate_a_faces",
  "declared_count": 4812,
  "identity_rule": "one object per tracked face-track with >= 3 detections and minimum bounding box 40px",
  "excluded": 337,
  "exclusion_reason": "below minimum resolution",
  "required_procedure": "match@v3.1"
}
\`\`\`

\`\`\`sql
SELECT u.declared_count,
       COUNT(DISTINCT p.object_id) FILTER (WHERE p.output <> 'error') AS examined,
       u.declared_count - COUNT(DISTINCT p.object_id) FILTER (WHERE p.output <> 'error') AS missing
FROM universe u LEFT JOIN pass p
  ON p.universe_id = u.id AND p.procedure = u.required_procedure
WHERE u.id = 'u_2026_07_27_gate_a_faces';
-- 4812 | 4790 | 22
\`\`\`

A signed pass proves one examination happened. Coverage proves whether the required population received the required examinations — a query against two tables, not a claim any model makes about its own completeness.

## 6. Scale

[[embed:source:m1]]

Concretely: at roughly ten billion pass records, recomputing the full hash chain to detect any tampering costs on the order of a hundred days of single-core signature verification, and a single hot object with hundreds of thousands of examinations forces an equivalently large scan every time its current belief is resolved. A production deployment therefore needs a compaction or snapshot layer — periodic, signed summaries of an object's assertion state that later queries read by default, with the raw chain kept for audit and available on demand. This document specifies the raw layer; it does not specify the compaction layer, which is unresolved.

![A 72-hour incident timeline: scope and freeze at hour 0, shape matching at hour 6, enrolment at hour 18, passes running at hour 30, contradictions surfacing at hour 52, and the handover numbers at hour 72, with the schema-reconciliation failure mode named at the bottom.](https://miscsubjects.com/img/spec/object-ledger-fig3.svg)

## 7. One complete event, hour by hour

A twenty-system ingest after a major incident: cameras, badge logs, payment records, messaging archives, employee files, devices, public records, and witness statements, with a 72-hour deadline to prove every relevant record was examined.

**Hour 0 — scope and freeze.** Twenty systems listed. Access confirmed on fourteen, refused on three, unknown on three pending legal review. The identity rule for "one relevant record" is written and signed before any ingestion begins.

**Hour 6 — shape matching.** The fourteen accessible systems map onto six of the sixteen object families in Section 1.4. Two systems need a new template written and reviewed. Every field with no canonical target is logged, not dropped (1.2).

**Hour 18 — enrolment.** 2,412,006 objects hashed and counted. The universe is frozen. 311,004 records are excluded by the identity rule, each with a stated reason (mostly: below-threshold image resolution, duplicate badge scans within the same second).

**Hour 30 — passes running.** Three independent models examine the same enrolled objects under versioned procedures. 6.1 million pass records written. A coverage query runs every fifteen minutes against the live table.

**Hour 52 — contradictions surface.** 1,204 objects now carry two model assertions that disagree. This is not an error state; it is the evidence graph doing its job (Section 3). All 1,204 are queued for human review by rule, not by whoever happens to notice.

**Hour 72 — handover.** 2,412,006 enrolled · 2,398,771 examined · 13,235 unresolved and individually named · 1,204 contested and queued · 3 systems refused access, listed by name. Every number in that sentence is a query against the object table and the pass table. None of it is a model's summary of its own work.

[[embed:source:m4]]

The honest failure mode of this whole scenario is not a shortage of storage or a shortage of model calls. It is the schema-reconciliation step at hour 6 — if that step is faked or rushed, every later number, including "2,398,771 examined," is decoration sitting on top of a broken join.

## 8. Applications

| Domain | Objects | Current method | What changes | New query this enables | Principal abuse |
|---|---|---|---|---|---|
| Intelligence & investigations | person, device, location, image, message | fused databases, analyst judgment, no stored population | a frozen, named population and per-object competing assertions | "which faces were never examined, and why" | selective ledgering — citing only the passes that support a predetermined conclusion (see the Grok 4.5 pass, Section 4.2) |
| Fraud | account, transaction, device, dispute | one model score per transaction, thin logs | every detector's judgment attached to the same account/transaction objects, disagreement preserved | "which flagged accounts had a later model reverse an earlier hold" (the GLM Flash pass, Section 3.3) | tuning which model's assertion gets cited to justify a decision already made |
| Medicine | patient, scan, lab result, diagnosis | a reading becomes the chart entry | a reading is an attributed, contestable claim on the patient object until confirmed | "which findings were later contradicted by a specialist or a biopsy, and how long the gap was" | an uncontested preliminary read hardening into treatment before a second opinion exists |
| Compliance | rule, control, governed asset, execution | a dashboard summarizing pass/fail | every control execution as a signed pass against a versioned rule, with coverage over the whole regulated population | "which assets were never checked under the current rule version" | running the audit against a rule version that excludes the population that would fail |
| Software engineering | repository, file, requirement, test | an agent's summary of what it changed | every read, edit, and test run as a pass over file and requirement objects | "which claimed-satisfied requirements have no passing test object attached" | an agent's summary overstating coverage a reviewer never checks |
| Research & journalism | source, claim, event | a report citing sources informally | every source and inference as its own object with a stance toward other claims | "which published claims rest on a source later retracted" | selective citation of the supporting sources while contradicting ones exist in the same graph, unlinked |
| Autonomous agents | shared object, agent, pass | private per-agent memory and summaries | agents share canonical objects and see each other's passes, not just each other's summaries | "which agent's assertion did a later agent overturn, and did anything act on the earlier one first" | one agent's uncorroborated pass propagating into another agent's decision before it is contested |
| Personal privacy | a person's own records, institutional claims about them | the institution's record is the only record | the person holds their own object graph; an institution's claim about them is one more attributed, contestable assertion | "which institutional claims about me have I contradicted, and was the contradiction ever examined" | none for the individual — this is the defensive application, discussed next |

## 9. Dual use

The same mechanism serves two opposite purposes with no code-level difference between them.

An institution can fuse someone's payment, location, communication, and access records into canonical objects, run models over them, and accumulate an evidentiary case — this is the coming AI-fusion problem in its concrete, mechanical form.

Two separate 2024 FTC orders document this already happening in the commercial location-data market: data brokers reselling location tied to medical clinics, religious sites, and shelters, with no per-disclosure signed record of who bought what and why.

[[embed:source:e1]]

[[embed:source:e2]]

Two GAO reports document the same absence inside government use: federal facial-recognition searches run for years with no stored training requirement and, for most agencies, no specific civil-rights policy — exactly the missing procedure record and missing coverage record this specification requires by default.

[[embed:source:e3]]

[[embed:source:e4]]

The identical mechanism run in the other direction lets a person maintain their own object graph, hold an institution's claims about them as attributed, contestable assertions rather than accepted fact, and attach counterevidence to the same object the institution's claim lives on. The risk does not disappear in this direction either: it shifts entirely to who controls ingestion, identity resolution, authority, visibility, retention, challenge rights, aggregation rules, and downstream action.

Nothing in the architecture decides which direction it runs. That is decided entirely by who controls ingestion, identity resolution, authority, visibility, retention, challenge rights, aggregation rules, and downstream action. EFF's independent reading of the same enforcement actions is useful because it names exactly those levers as the ones that were uncontrolled.

[[embed:source:e5]]

## 10. Prior art

| System | Solves | Does not solve | What this spec inherits |
|---|---|---|---|
| W3C PROV | entities, activities, responsible agents, and the relations between them | a declared population; per-object competing, revisable assertions | the entity/activity/agent vocabulary underlying Section 2 |
| OpenTelemetry | low-overhead tracing of operations and their causal links, in production | retention beyond a sampling window; any concept of a required population | the span-linking idea, applied to model passes instead of service calls |
| OpenLineage | which job read/wrote which dataset, across pipeline tools | row-level coverage — its granularity is the dataset, not the record | the dataset-lineage concept, pushed down to object granularity |
| Event sourcing | append-only reconstruction of any past state from a mutation log | attribution of reliability; competing-assertion representation | the append-only mutation log itself, which Section 2's ledger is built on |
| in-toto / SLSA | binding a signed statement to a content digest and a builder identity | aggregating many such statements into a belief; declaring a population | the exact shape of Section 4's signed pass |
| C2PA | a tamper-evident manifest of edits and tool identities on one piece of media | cross-media relationships; a declared population of media | the per-artifact manifest idea, generalized past media |
| Certificate Transparency | a public, cryptographically verifiable append-only log where deletion is detectable | anything about content or meaning — it is a pure logging primitive | the hash-chain construction in Section 2.1, at object scale instead of internet scale |
| LangGraph persistence | checkpointing one agent's own execution for pause/resume/rollback | multiple independent agents sharing state as objects, or recording their disagreement | the checkpoint-as-durable-state idea, extended to cross-agent shared objects in Section 8 |
| Palantir Foundry Ontology | unifying enterprise data into typed objects, links, and actions at production scale | (as documented) an open, independently implementable spec; per-examination model attestation as a first-class primitive | the object-and-link modeling approach, published here as an open specification instead |
| Record linkage / entity resolution | the statistical theory of matching records to real-world entities, since 1969 | what to do with the object once matched — linkage stops at the match decision | the confidence-scored identity_claim object in Section 1.3 |
| Schema matching | proposing correspondences between two schemas, automatically or semi-automatically | what happens to fields with no correspondence | the versioned mapping concept; unmapped_fields is this spec's explicit answer to the gap |
| Belief revision | the formal theory of updating beliefs under new, possibly contradicting information | providing one neutral aggregation rule — none exists | the honest statement, in Section 3.2, that this is unsolved here too |

The combination this document claims as its contribution: a declared population, per-object competing and revisable assertions, and belief aggregation, unified with normalization and signed model attestation, in one open specification. No single system above provides all three; several provide one or two. Whether an unpublished or classified system already combines all of this has not been checked — patent filings and defense-sector literature were not searched for this document, and that is a stated limitation, not a claim of novelty.

Full source cards for every system in the table above, in the same order:

[[embed:source:p1]]

[[embed:source:p2]]

[[embed:source:p3]]

[[embed:source:p4]]

[[embed:source:p5]]

[[embed:source:p6]]

[[embed:source:p7]]

[[embed:source:p8]]

[[embed:source:p9]]

[[embed:source:p10]]

[[embed:source:p11]]

[[embed:source:p12]]

[[embed:source:p13]]

[[embed:source:p14]]

## 11. Article as proof

This document is itself an instance of what it specifies. Its 35 numbered claims are addressable claim-objects. Its fourteen prior-art sources and five regulatory sources are evidence-objects. The six model answers collected during this document's own drafting are signed pass-objects, each attached to the specific claim it supports, each carrying the model identity, the exact question, the exact answer, and a timestamp — reproduced below in full, plus the pass recording this document's own authorship. A reader can move, right now, from any claim above to its source, from a source to the model pass that produced it, and from that pass to the exact quote and verdict — the traversal this specification describes in Section 3.3, demonstrated rather than only asserted.

[[embed:source:m1]]

[[embed:source:m2]]

[[embed:source:m3]]

[[embed:source:m4]]

[[embed:source:m5]]

[[embed:source:m6]]

[[embed:source:a1]]
`;

async function main() {
  const { token } = await getWriteToken(slug);
  const payload = {
    slug,
    title:
      "A specification for normalizing foreign systems into objects, ledgering every model examination, and holding belief as a revisable evidence graph",
    body,
    register: "technical",
    tags: ["system", "protocol", "objects", "ledger", "evidence-graph", "spec"],
    claims,
    sources,
    status: "published",
  };
  const r = await fetch(`${BASE}/api/articles/${slug}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  console.log(r.status, text.slice(0, 400));
  console.log("WORDS:", body.split(/\s+/).length);
}

main();
