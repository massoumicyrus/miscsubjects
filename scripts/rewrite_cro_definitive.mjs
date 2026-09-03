#!/usr/bin/env node
/**
 * Rewrite /a/cro-model-validation-instrument to definitive depth. Only this article.
 * Everything grounded in live receipts already on the ledger — nothing fabricated.
 * Run: node scripts/rewrite_cro_definitive.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "cro-model-validation-instrument";
const ls = (id, title, url, summary, claims) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  ls("s1", "The derivation-agreement gate — effective challenge, mechanised", BASE + "/a/auditable-reasoning-hardened", "Independent models under a pinned rule set; the gate refuses to authorise when their clause-by-clause derivations diverge, even on a unanimous verdict. Includes the false-convergence defect and its fix.", ["c2", "c6"]),
  ls("s2", "A unanimous verdict, refused on divergent derivation", BASE + "/receipt/inv_o6s0exhodd", "Three models returned CANNOT_CONCLUDE citing the same clauses; two derived it differently, so the gate escalated instead of concluding.", ["c3"]),
  ls("s3", "Measured per-model error rates under a fixed rule set", BASE + "/a/adjudication-probe-report-eu-ai-act", "Krippendorff alpha, Fleiss kappa, per-model rates, the prevalence paradox — the quantitative evidence a validation file needs.", ["c4"]),
  ls("s4", "The 72-call variance study: what the governing prompt actually changes", BASE + "/a/auditable-reasoning-audited", "Three prompt arms x three models x eight runs. Auditable structure appears ONLY under the constitution (0 of 48 calls without it); clause-citation agreement rises 0.74 to 0.95; cost per governed call measured.", ["c5", "c8"]),
  ls("s5", "The genuine APPROVE — unanimous verdict, identical derivation", BASE + "/receipt/inv_wl0rnh136b", "The one clean authorisation on record: every seat fired the same clauses in the same trigger states on the same evidence.", ["c6"]),
  ls("s6", "A structurally invalid finding, voided", BASE + "/receipt/inv_2dsklah529", "The cheapest seat invented clauses 7, 8 and 12 that do not exist in the rule set. The parser voided the finding; an invalid finding can never authorise.", ["c7"]),
  ls("s7", "The instrument reviewing its own input: eight defects found", BASE + "/receipt/inv_qh3ge2x74b", "A governed model asked to critique the case input found the rule set stated only a necessary condition where a sufficient one was needed — the divergence was the input, not the models.", ["c9"]),
];
const claims = [
  { id: "c1", text: "SR 11-7 and OCC 2011-12 require independent validation of a model with documented effective challenge, and no established instrument does this for a large language model.", section: "The obligation", tier: "system", source_ids: [], why_material: "A live legal requirement with personal exposure for the validator, currently met with prose memos." },
  { id: "c2", text: "The derivation-agreement gate mechanises effective challenge: independent models under a pinned rule set are compared clause by clause, and disagreement is a recorded refusal.", section: "The instrument", tier: "system", source_ids: ["s1"], why_material: "Converts 'we reviewed it' into an artifact a regulator can open." },
  { id: "c3", text: "A unanimous verdict is refused when the derivations diverge, so agreement that hides disagreement cannot pass validation.", section: "The instrument", tier: "system", source_ids: ["s2"], why_material: "False consensus is the failure a validator is personally on the hook for." },
  { id: "c4", text: "Per-model error rates are measured under a fixed rule set, with agreement statistics, so the residual is quantified rather than asserted.", section: "Outcomes analysis", tier: "system", source_ids: ["s3"], why_material: "Quantified residual error is the core of a validation file." },
  { id: "c5", text: "In 72 controlled calls, auditable structure (declared absent records, flip conditions, rejected alternatives) appeared in zero of 48 calls without the governing constitution and only under it.", section: "Conceptual soundness", tier: "system", source_ids: ["s4"], why_material: "The governing text is a measured causal variable, not a style choice — which is what conceptual-soundness review must establish." },
  { id: "c6", text: "The gate itself failed validation once — clause-number agreement passed a false convergence — and the fix (canonical per-clause derivation tuples) is documented with both receipts.", section: "The instrument, validated", tier: "system", source_ids: ["s1", "s5"], why_material: "An instrument that documents its own failed audit and repair is exhibiting the behavior it sells." },
  { id: "c7", text: "A finding that invents a clause, omits a required field, or lacks the terminal decision line is structurally voided and can never authorise.", section: "The instrument", tier: "system", source_ids: ["s6"], why_material: "Fail-closed on malformed output is the property that makes cheap seats safe to include." },
  { id: "c8", text: "A governed call costs $0.0006 to $0.0024 and a three-model sealed decision about half a cent, so the instrument's cost is negligible against the exposure it documents.", section: "Cost", tier: "system", source_ids: ["s4"], why_material: "Removes the economic objection to per-decision validation evidence." },
  { id: "c9", text: "The same instrument audits its own inputs: a governed critique of the case file found eight defects, the lead one a necessity-stated-as-sufficiency error in the rule set that had caused every prior divergence.", section: "Challenge runs both ways", tier: "system", source_ids: ["s7"], why_material: "Most validation failures are specification failures; the instrument catches those too, with a receipt." },
  { id: "c10", text: "No calibration study establishes correctness at a known rate; the measured rates cover one task class with small n; the genuine APPROVE used two model families, not three.", section: "What is not satisfied", tier: "system", source_ids: [], why_material: "A validator must not be sold more than the evidence supports, and these are the exact three gaps." },
];
const body = `## The obligation nobody has an instrument for

SR 11-7 — the Federal Reserve and OCC's *Supervisory Guidance on Model Risk Management*, issued April 2011 and still the governing text — and its OCC twin, Bulletin 2011-12, require that every model a bank relies on be **independently validated**. Not reviewed. Validated, by people organizationally independent of the developers, with three named components:

1. **Evaluation of conceptual soundness** — evidence that the model's design and construction are fit for purpose, including the quality of its inputs.
2. **Ongoing monitoring** — evidence that it keeps behaving as designed once in use, including benchmarking against alternatives.
3. **Outcomes analysis** — comparison of model outputs to actual outcomes, with the residual error quantified.

Running through all three is the phrase the examiners actually test for: **effective challenge** — "critical analysis by objective, informed parties who can identify model limitations and assumptions and produce appropriate changes." Challenge that leaves no artifact is challenge an examiner will not credit.

For a regression model or a Monte Carlo engine this is a mature discipline: holdout samples, backtesting, sensitivity analysis, champion-challenger runs. For a large language model exercising judgement — reading a covenant, classifying a transaction, screening an alert — **none of that toolkit applies as-is**. There is no likelihood function to backtest. The "model" is a prompt, a temperature, and a vendor checkpoint that changes under your feet. And SR 11-7 explicitly scopes itself to *any* approach that processes inputs into estimates — the Fed confirmed in 2021 (SR 21-8, the AI/ML FAQ context) that machine-learning judgement systems are in scope.

So the second line of defense is holding a legal obligation, with personal accountability under the examination process, and meeting it with narrative memos: "we sampled 30 outputs and a reviewer agreed with 28." That is not effective challenge. That is attestation by anecdote.

This page is the instrument, it is running, and every claim on it opens to a live receipt.

## What the instrument is, mechanically

One governed decision works like this. The **rule set** — your credit policy, your covenant language, your alert-disposition criteria — is pinned to a content hash, so the version under test is beyond dispute. The **record** under review is hashed the same way. Several independent models, from *different training families*, each receive the identical rule set and record under a governing constitution that compels a specific output shape: verdict, the clauses relied on, a clause-by-clause derivation vector (for each clause: did its condition trigger, does that support or defeat the action, on which evidence records), the records that were *absent*, the strongest rejected alternative, and what evidence would flip the conclusion.

A deterministic parser — not a model — then projects each finding into a canonical form. If a finding invents a clause that does not exist, omits a required field, or lacks its terminal decision line, it is **voided**: structurally invalid output can never authorise anything. Here is that happening to the cheapest seat on the panel, which cited clauses 7, 8 and 12 of a six-clause rule set:

[[embed:source:s6]]

The surviving findings go to the **derivation-agreement gate**. The gate does not compare verdicts. It compares derivations — the canonical per-clause tuples. Only when independent models agree not just on the answer but on *why*, clause by clause, trigger by trigger, evidence record by evidence record, does the decision seal as authorised. Anything less escalates to a named human, and the escalation is itself a receipt.

[[embed:source:s1]]

## Effective challenge, produced as an artifact

Measure this against the SR 11-7 phrase. "Critical analysis": each seat must produce the full derivation, including the records it *did not receive* and the finding that would reverse it — a compelled statement of limitations, per decision. "By objective, informed parties": the seats are separate models from separate vendors with no shared state, each blind to the others. "Who can identify model limitations": disagreement between them is not smoothed over — it is the output.

The strongest exhibit is a case where three models returned the **same verdict**, citing the **same clauses** — and the gate still refused to conclude, because two of them had derived that verdict through different trigger states:

[[embed:source:s2]]

Sit with what that receipt is. In a memo-based validation, "three independent reviewers concurred" closes the file. Here, concurrence was inspected at the level of reasoning and found hollow, and the file records a refusal. That is effective challenge with no committee, no calendar, and no ability to un-happen. When the panel *does* agree derivation-for-derivation, you get the other artifact — the genuine authorisation, every seat firing the same clauses in the same states on the same evidence:

[[embed:source:s5]]

## Conceptual soundness: the governing text is a measured variable

SR 11-7's first pillar asks whether the design is sound — which, for an LLM system, means: does the governing prompt actually *do* anything, or is it decoration? That question has a measured answer here. A 72-call controlled study ran three prompt arms (bare, thin instructions, full constitution) across three models, eight runs each, on a case with known ground truth:

[[embed:source:s4]]

Three results matter to a validator. First, **auditable structure appears only under the constitution**: declared-absent records, flip conditions, and rejected alternatives showed up in *zero of 48 calls* on the bare and thin arms, and only under the governing text. Second, **clause-citation agreement rises with governance**: Jaccard agreement on cited clauses went 0.74 (bare) → 0.84 (thin) → 0.95 (constitution) on the strongest seat. Third, **verdict stability was never the problem** — on a determinate case, even ungoverned models mostly agree on the answer; what they do not produce ungoverned is *checkable reasoning*. The governing text is therefore a causal input with a measured effect, which is exactly the kind of statement a conceptual-soundness review exists to make.

## Ongoing monitoring and outcomes analysis: the rate table

Because every decision emits the same canonical record, monitoring is not a quarterly sampling exercise — it is a query. And the residual is already quantified: per-model error rates under a fixed rule set, with Krippendorff's alpha and Fleiss' kappa, and the prevalence paradox stated rather than hidden:

[[embed:source:s3]]

That table is the outcomes-analysis section of a validation file: not "the model is accurate," but *here is the rate at which each seat is wrong, measured, and here is the mechanism that catches the wrong answers before they authorise anything*. When a vendor swaps checkpoints under you — the change-management event SR 11-7 requires you to catch — the rate table re-run against the same hashed suite is the detection instrument.

## The instrument validated itself, and failed once

A validation instrument that has never caught itself being wrong should worry you. This one has a documented failure. Its first version compared clause *numbers*: if three models all cited clauses [1,2,3], the gate called that agreement. It sealed an APPROVE on that basis. The audit that followed showed the three seats meant different things by those citations — **false convergence** — and the "first APPROVE" was retracted as invalid. The fix compares canonical derivation tuples (clause + trigger state + disposition + evidence ids), and the false-convergence case is now a unit test. Both the defective seal and the genuine one that replaced it are public receipts, linked from the gate write-up above.

For a validator this is not an embarrassing footnote; it is the credential. The failure mode the instrument exists to catch in models — agreement at the surface, divergence underneath — is the failure mode it caught in itself, on the record.

## Challenge runs both ways: the input audit

SR 11-7 folds input quality into conceptual soundness, and most real validation failures are specification failures — the policy was ambiguous before any model touched it. The same machinery audits that. A governed seat, asked to critique the case file itself as a colleague, returned eight defects, the lead one critical: the rule set's grant clause stated only a *necessary* condition ("granted only to a match") and never a sufficient one, so no clause licensed an affirmative grant — which had silently caused every prior derivation divergence on that case:

[[embed:source:s7]]

The variance across the panel was the input's ambiguity, not the models' unreliability. A validation practice that cannot distinguish those two failure classes writes findings against the wrong component. This one distinguishes them with receipts.

## What a validation file assembled from this looks like

- **Conceptual soundness**: the constitution at its content hash; the 72-call study showing the governing text's measured effect; the input-critique receipts for the rule sets in scope.
- **Effective challenge**: the escalation receipts — every case where the gate refused a unanimous panel, with the divergent derivations preserved verbatim.
- **Ongoing monitoring**: the rate table per seat, re-run on the hashed suite at every vendor or prompt change; the malformed-finding voids showing fail-closed behavior.
- **Outcomes analysis**: sealed decisions vs. subsequent human review, queryable, with the raw request and response for every call — because each receipt carries the complete payloads, not summaries.

Cost does not enter the argument against it: a governed call runs $0.0006–$0.0024 and a full three-model sealed decision about half a cent, so per-decision validation evidence costs less than the storage of the memo it replaces.

## What is not satisfied

Stated as plainly as the rest, because a validation instrument that oversells itself is defective by its own standard:

- **No correctness calibration.** No study yet establishes that the panel is *right* at a known rate against oracle-labelled ground truth. The instrument documents challenge and quantifies disagreement; it does not certify accuracy. That study — 30 hashed, oracle-labelled cases, a wrongful-authorisation rate — is the named next artifact.
- **Small n, one task class.** The published rates come from a deliberately bounded suite. They are a starting table, not an actuarial basis.
- **Two families, not three.** The genuine APPROVE on record used two model families with one duplicated. Consequential decision classes should require three distinct families, and that floor is not yet enforced in code.

A validator reading this should treat those three gaps as the review agenda. Everything else on this page is already openable.

## Submit a case

Send one bounded validation question — your rule set (or the policy text it comes from) and the record under review — to **build@miscsubjects.com**. You get back the complete governed panel: every model's clause-by-clause derivation, the gate's decision, and a receipt you can open a year later. No account, no call, no deck.
`;
const cur = await (await fetch(`${BASE}/api/articles/${SLUG}`)).json();
const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({ ...cur, slug: SLUG, body, claims, sources, status: "published" }),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources");
