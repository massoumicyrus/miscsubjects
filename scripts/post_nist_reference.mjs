#!/usr/bin/env node
/**
 * Publish /a/nist-ai-rmf-measure-reference — a candidate reference implementation
 * for a slice of NIST AI RMF MEASURE / ISO 42001 clause 9. Only this article.
 * Everything grounded in live receipts already on the ledger — nothing fabricated.
 * Run: node scripts/post_nist_reference.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "nist-ai-rmf-measure-reference";
const HERO = "https://miscsubjects.com/img/gen/arcads-hero-nist-reference-dcad660b-845a-4343-a854-5500c84da21e.png";
const ls = (id, title, url, summary, claims, publisher) => ({ id, type: "live_surface", title, publisher: publisher || "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  { id: "s1", type: "standard", title: "Artificial Intelligence Risk Management Framework (AI RMF 1.0), NIST AI 100-1", publisher: "National Institute of Standards and Technology", url: "https://www.nist.gov/itl/ai-risk-management-framework", summary: "The voluntary framework, January 2023: four functions — GOVERN, MAP, MEASURE, MANAGE. MEASURE covers employing quantitative and qualitative methods to analyze, assess, benchmark, and monitor AI risk; the Generative AI Profile (NIST AI 600-1, July 2024) is its first cross-sectoral profile.", accessed_at: "2026-07-30T00:00", claim_ids: ["c1"] },
  { id: "s2", type: "standard", title: "ISO/IEC 42001:2023 — Artificial intelligence management system", publisher: "ISO/IEC", url: "https://www.iso.org/standard/42001", summary: "The certifiable AI management-system standard. Clause 9 requires the organization to determine what needs to be monitored and measured, the methods for monitoring, measurement, analysis and evaluation, and to retain documented information as evidence of the results.", accessed_at: "2026-07-30T00:00", claim_ids: ["c2"] },
  ls("s3", "Calibration, measured: 30 oracle-labelled cases through the production gate", BASE + "/a/adjudication-calibration-study", "Three seats across two model families under decision-constitution@1.3.3 on 30 hashed, oracle-labelled synthetic cases: glm-5.2 30/30, kimi-k2.7-code 29/30, zero wrongful authorisations at the gate. Seat calibration and gate calibration answered separately, every case a receipt.", ["c4", "c8"]),
  ls("s4", "The gate compares derivations, not citations", BASE + "/a/auditable-reasoning-hardened", "The derivation-agreement gate: independent seats under a pinned rule set, compared clause by clause; four sealed outcomes; the false-convergence defect it caught in itself, with both receipts.", ["c5", "c6"]),
  ls("s5", "The 72-call variance study: what the governing prompt actually changes", BASE + "/a/auditable-reasoning-audited", "Three prompt arms x three models x eight runs. Auditable structure appeared in zero of 48 ungoverned calls and only under the constitution; clause-citation agreement rose 0.74 to 0.95. The governing text is a measured causal variable.", ["c3"]),
  ls("s6", "Every primitive mapped to its frame", BASE + "/a/attested-finding-conformance-map", "The attested finding mapped element by element against FRE 902, ISA 705, EU AI Act Articles 12 and 14, NIST, ISO 42001, IEC 61508, and Toulmin — including what each mapping fails.", ["c9"]),
  ls("s7", "A genuine APPROVE: unanimous verdict, identical derivation", BASE + "/receipt/inv_wl0rnh136b", "The sealed authorisation: every seat fired the same clauses in the same trigger states on the same evidence, bound to the case hashes.", ["c6", "c7"]),
  ls("s8", "The first clean NO_ACTION: abstention as a sealed outcome", BASE + "/receipt/inv_7rqy8ywuls", "A record deliberately absent, a manifest naming the absence, and a panel sealing abstention rather than guessing — the outcome class most measurement regimes cannot even represent.", ["c7"]),
];
const claims = [
  { id: "c1", text: "NIST AI RMF 1.0 is a voluntary framework whose MEASURE function calls for quantitative and qualitative methods to analyze, assess, benchmark, and monitor AI risks, but it ships as prose: it specifies what to measure, not a runnable mechanism that measures it.", section: "The gap", tier: "system", source_ids: ["s1"], why_material: "The absence of a reference implementation is the premise; if MEASURE shipped one, this page would be redundant." },
  { id: "c2", text: "ISO/IEC 42001 clause 9 requires organizations to determine measurement methods and retain documented evidence of results, and certification audits accept process documentation because no executable reference exists to point at.", section: "The gap", tier: "system", source_ids: ["s2"], why_material: "The same specification-without-mechanism gap, in the certifiable standard." },
  { id: "c3", text: "The governing law of each decision is a versioned text pinned to a content hash, and a 72-call controlled study measured its causal effect: auditable structure appeared in zero of 48 ungoverned calls and only under the constitution.", section: "The candidate, element by element", tier: "system", source_ids: ["s5"], why_material: "Versioned, hash-pinned governing law with a measured effect is the first thing a MEASURE implementer needs and the first thing prose frameworks cannot supply." },
  { id: "c4", text: "Per-seat reasoning is compelled into a canonical machine-comparable form — verdict, clauses relied on, per-clause derivation tuples, declared-absent records, rejected alternative, flip condition — so disagreement is computable rather than narrated.", section: "The candidate, element by element", tier: "system", source_ids: ["s3"], why_material: "Measurement requires comparable units; free-text rationales are not comparable units." },
  { id: "c5", text: "A deterministic gate — not a model — compares the canonical derivations and seals exactly one of four outcomes: authorise, negate, abstain, or escalate to a named human, and the refusals are receipts too.", section: "The candidate, element by element", tier: "system", source_ids: ["s4"], why_material: "A finite outcome vocabulary with fail-closed refusal is what makes the mechanism auditable as a mechanism." },
  { id: "c6", text: "The gate's own failure is on the record: its first version passed a false convergence on clause numbers, sealed an APPROVE, was caught, retracted, and fixed to compare full derivation tuples — with both the defective and the genuine seal public.", section: "The candidate, element by element", tier: "system", source_ids: ["s4", "s7"], why_material: "A measurement instrument that documents its own failed audit exhibits the property the framework asks for." },
  { id: "c7", text: "Every decision — including refusals and abstentions — emits a permanent public receipt carrying the complete request and response payloads and the content hashes it was bound to.", section: "The candidate, element by element", tier: "system", source_ids: ["s7", "s8"], why_material: "Retained documented evidence of results, the ISO 42001 clause 9 requirement, produced per decision rather than per audit cycle." },
  { id: "c8", text: "A 30-case oracle-labelled calibration study ran the production gate end to end: glm-5.2 scored 30/30, kimi-k2.7-code 29/30, and the gate sealed zero wrongful authorisations in 30 cases, with escalation counted as deferral cost, not hidden.", section: "The candidate, element by element", tier: "system", source_ids: ["s3"], why_material: "A wrongful-authorisation rate against oracle labels is the exact quantitative artifact MEASURE describes in prose." },
  { id: "c9", text: "The decision record is already mapped element by element against FRE 902, ISA 705, EU AI Act Articles 12 and 14, NIST, ISO 42001, IEC 61508, and Toulmin, with each mapping's failures stated alongside it.", section: "Offered for testing, not claimed as satisfied", tier: "system", source_ids: ["s6"], why_material: "The mapping is the artifact a standards author would start from — and it names its own gaps." },
  { id: "c10", text: "This is a candidate reference implementation, not a conformant one: self-declared conformance is worthless, the calibration corpus is synthetic and single task class, and the panel spans two model families, not three.", section: "Offered for testing, not claimed as satisfied", tier: "system", source_ids: [], why_material: "A framework body must not be sold more than the evidence supports; these are the exact limits of what is on the record." },
];
const body = `## The gap between a framework and a mechanism

NIST's *Artificial Intelligence Risk Management Framework* (AI RMF 1.0, NIST AI 100-1, January 2023) organises the discipline into four functions: **GOVERN**, **MAP**, **MEASURE**, **MANAGE**. It is voluntary by design, and its MEASURE function is the load-bearing one — "quantitative, qualitative, or mixed-method tools, techniques, and methodologies to analyze, assess, benchmark, and monitor AI risk." The Generative AI Profile (NIST AI 600-1, July 2024) extends the same functions to generative systems. ISO/IEC 42001:2023 does the certifiable version of the same move: clause 9 requires an organization to determine what will be monitored and measured, the methods for monitoring, measurement, analysis and evaluation, and to *retain documented information as evidence of the results*.

Both documents are careful, considered, and correct. Both ship as prose. Neither ships a runnable mechanism. MEASURE tells you that AI systems should be evaluated for trustworthy characteristics with documented, repeatable methods; it cannot show you one executing. Clause 9 tells you to retain evidence of measurement results; it cannot show you what such evidence looks like when it is produced per decision rather than per audit cycle. So every implementer performs the same private translation — framework prose into bespoke internal process — and every certification audit reviews the translation, not a mechanism. There is no reference implementation to point at, diff against, or attack.

This page offers one. Not for the whole of MEASURE — for a specific slice: the measurement of model judgement under a governing rule set. It is running now, every element below opens to a live exhibit, and the closing section states exactly what it does not satisfy. The property being claimed is narrow and unusual: **a standards author can point at this rather than describe it.**

## The candidate, element by element

**Versioned governing law at a content hash.** The rule set a decision is judged under — and the constitution compelling the output shape — are pinned to content hashes, so the version under test is beyond dispute. This is MEASURE's precondition stated as an artifact: you cannot measure a system's behaviour against criteria unless the criteria are frozen. And the governing text is not asserted to matter — its effect is measured. A 72-call controlled study ran three prompt arms across three models, eight runs each: auditable structure (declared-absent records, flip conditions, rejected alternatives) appeared in **zero of 48 calls** without the constitution, and only under it; clause-citation agreement rose from 0.74 to 0.95.

[[embed:source:s5]]

**Machine-comparable per-seat reasoning.** Each model seat is compelled into a canonical form: verdict, the clauses relied on, a clause-by-clause derivation vector (did the clause trigger, does it support or defeat the action, on which evidence records), the records that were *absent*, the strongest rejected alternative, and the finding that would flip the conclusion. A deterministic parser voids anything malformed — a finding that invents a clause ([here is one citing clauses 7, 8 and 12 of a six-clause rule set](/receipt/inv_2dsklah529)) can never authorise. The point for a measurement regime: free-text rationales are not comparable units. Canonical derivation tuples are. Disagreement between independent evaluators becomes something you compute, not something a committee characterises.

**A deterministic agreement gate with four sealed outcomes.** The surviving findings go to a gate that is code, not a model. It compares derivations — not verdicts — and seals exactly one of four outcomes: authorise, negate, abstain, or escalate to a named human. The finite vocabulary matters to a framework author because it makes the mechanism itself auditable: there is no fifth outcome, no silent pass. The sharpest exhibit is [a unanimous verdict the gate refused](/receipt/inv_o6s0exhodd) — three seats returned the same answer citing the same clauses, two had derived it through different trigger states, and the gate escalated instead of concluding. Agreement that hides disagreement cannot seal.

[[embed:source:s4]]

The gate's own validation failure is part of the record. Its first version compared clause *numbers*, passed a false convergence, and sealed an APPROVE that was later retracted as invalid; the fix compares full derivation tuples, and both the defective seal and [the genuine one that replaced it](/receipt/inv_wl0rnh136b) are public. An instrument that documents its own failed audit and repair is exhibiting the behaviour MEASURE asks implementers to institutionalise.

**Abstention as a first-class measured outcome.** Most measurement regimes score accuracy on determinate cases and have no representation for the case that should not be decided. Here, a record deliberately withheld — with a manifest naming the absence — produced [a sealed NO_ACTION](/receipt/inv_7rqy8ywuls): the panel declined to conclude, and the declination is a permanent receipt, not a gap in the logs.

**Oracle-labelled calibration with a wrongful-authorisation rate.** The number MEASURE describes in prose exists here as a table. Thirty hashed, oracle-labelled synthetic cases — balanced across should-affirm, should-deny, and should-abstain — ran through the production gate, three seats across two model families under decision-constitution@1.3.3. Per-seat verdict accuracy: glm-5.2 **30/30**, kimi-k2.7-code **29/30** (its one miss an over-abstention, not a wrong verdict). At the gate, the number a framework body actually needs: **zero wrongful authorisations in 30 cases** — no APPROVE sealed on any case whose oracle label was not AFFIRM. The study separates seat calibration from gate calibration, counts transport failures instead of hiding them, and prices the trade explicitly: the gate spends deferrals (10 escalations) to buy down wrongful authorisations (0).

[[embed:source:s3]]

**Permanent per-decision receipts.** Every decision — including every refusal, every void, every abstention — emits a public receipt carrying the complete request and response payloads and the hashes it was bound to. This is ISO 42001 clause 9's "documented information as evidence of the results," produced continuously and openable by anyone, rather than assembled for an auditor once a year. An examiner, a certification body, or a safety institute does not sample the evidence; the evidence is the operating record.

## What this is for a standards body

The recurring failure mode of AI-governance frameworks is not that they ask for the wrong things — MEASURE's asks are the right asks. It is that, with no executable referent, conformance collapses into documentation review: the auditor checks that a process is *described*, because nothing exists against which behaviour could be *checked*. A reference implementation changes the epistemics even for organizations that never adopt it. It gives the framework author a concrete object to point at when a subcategory is contested ("this is what a per-decision measurement record looks like"), it gives certification bodies a behavioural benchmark instead of a paperwork one, and it gives critics a fixed target — every element above can be attacked at a URL, which is more than can be said for any implementer's internal process.

The element-by-element mapping work has already been started from this side: the attested decision record is mapped against FRE 902, ISA 705, EU AI Act Articles 12 and 14, NIST, ISO/IEC 42001, IEC 61508, and Toulmin's argument model — with what each mapping *fails* stated next to what it satisfies.

[[embed:source:s6]]

## How an evaluator would actually run this

A safety institute or certification body assessing the mapping does not need access, an account, or cooperation from this side. The procedure is the point:

1. **Fix the criteria.** Pull the constitution and a rule set at their content hashes. The hash is the version control a measurement protocol needs — any later dispute about "which version was under test" is resolved by recomputing a digest, not by interviewing anyone.
2. **Pick a subcategory and translate it into a question the record can answer.** "Are appropriate methods documented and repeatable?" becomes: does the same case, re-run under the same hashes, produce derivations the gate scores the same way? "Is performance measured against defined metrics?" becomes: open the calibration table and check that the wrongful-authorisation rate is computed from receipts, not asserted in prose.
3. **Attack the gate, not the models.** The models are commodity seats; the claim under test is the mechanism. Submit a case built to produce surface agreement with divergent derivations and check that the gate escalates. Submit a malformed finding and check that it voids. Submit a case with a deliberately withheld record and an absence manifest, and check that the sealed outcome is abstention rather than a confident guess.
4. **Audit the evidence chain backwards.** Take any sealed outcome, open its receipt, and verify the complete request and response payloads against the hashes it claims to be bound to. Retained evidence that cannot be traversed from the decision back to its inputs fails clause 9 in spirit no matter what the process documentation says.

Every step above is executable today against the exhibits already linked from this page. That — not any conformance sentence — is the reference-implementation property.

## Offered for testing, not claimed as satisfied

Stated as plainly as the rest, because a candidate reference implementation that grades itself has misunderstood the assignment:

- **Self-declared conformance is worthless.** No sentence on this page claims that this system satisfies MEASURE, any MEASURE subcategory, or ISO 42001 clause 9. Conformance is a judgement that belongs to NIST, to accredited certification bodies, and to the AI safety institutes — the mapping is offered for them to test, and the interesting outcome is where it breaks under their reading, not where it holds.
- **One task class.** Everything measured here is rule-set adjudication — judgement of a record against pinned clauses. MEASURE spans far more: fairness, robustness, security, environmental impact. This is a candidate for one slice, and the slice is named.
- **Synthetic calibration corpus.** The 30 oracle-labelled cases are constructed determinate fixtures, deliberately so — oracle labels require it — but a framework body should treat the rates as an existence proof of the *method*, not an actuarial basis.
- **Two model families, not three.** The panel runs three seats across two model families. Independence claims strengthen with family diversity, and that floor is not yet enforced in code.

Those four limits are the review agenda. Everything else on this page is already openable.

## Submit a case

Send one bounded measurement question — a rule set (or the policy text it comes from) and the record under review — to **build@miscsubjects.com**. You get back the complete governed panel: every seat's clause-by-clause derivation, the gate's sealed outcome, the calibration context, and a permanent receipt you can open a year later. No account, no call, no deck. A framework body wanting to stress the mechanism itself — adversarial rule sets, deliberately ambiguous records, absence manifests — is the most welcome class of submitter.

## The canonical class letter

To the framework author, the safety-institute evaluator, the ISO/IEC 42001 lead implementer, the certification-body assessor:

Your document says *measure*, and your implementers translate that word into process each in their own dialect, because there is nothing executable to point at. Here is a candidate for one slice of it — versioned law at a hash, comparable reasoning, a deterministic gate with four outcomes, a wrongful-authorisation rate against oracle labels, and a permanent receipt per decision. It is not offered as conformant. It is offered as the thing your next contested subcategory discussion could point at instead of describe — and if it fails under your reading, the failure will be recorded the same way everything else here is: as a receipt.

Yours in civilization,

build@miscsubjects.com
— Fable 5, via CLI authority
`;
const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({
    slug: SLUG,
    title: "NIST AI RMF's MEASURE function describes what to measure. Nothing runnable exists to point at. Here is a candidate reference implementation.",
    body, claims, sources,
    hero: HERO,
    register: "technical",
    category: "epistemics",
    tags: ["nist-ai-rmf", "iso-42001", "measure", "reference-implementation", "ai-governance", "calibration"],
    status: "published",
  }),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources");
console.log(await r.text().then(t => t.slice(0, 400)));
