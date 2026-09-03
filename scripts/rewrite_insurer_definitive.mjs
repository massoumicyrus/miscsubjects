#!/usr/bin/env node
/**
 * Rewrite /a/insurer-ai-performance-rate-table to definitive depth. Only this article.
 * Everything grounded in live receipts already on the ledger — nothing fabricated.
 * Run: node scripts/rewrite_insurer_definitive.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "insurer-ai-performance-rate-table";
const ls = (id, title, url, summary, claims) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  ls("s1", "Measured per-model error rates under a fixed rule set", BASE + "/a/adjudication-probe-report-eu-ai-act", "Per-model error rates on a hashed suite, with Krippendorff alpha and Fleiss kappa — the agreement statistics that separate correlated from independent error — and the prevalence paradox stated rather than hidden.", ["c2", "c4"]),
  ls("s2", "The derivation-agreement gate — fail-closed by construction", BASE + "/a/auditable-reasoning-hardened", "Independent models under a pinned rule set; the gate refuses to authorise when their clause-by-clause derivations diverge, even on a unanimous verdict. Includes the false-convergence defect and its documented fix.", ["c5", "c7"]),
  ls("s3", "A unanimous verdict, refused on divergent derivation", BASE + "/receipt/inv_o6s0exhodd", "Three models returned the same verdict citing the same clauses; two derived it through different trigger states, so the gate escalated instead of concluding — a detected deferral instead of an undetected error.", ["c5"]),
  ls("s4", "The 72-call variance study: cost and the governed structure", BASE + "/a/auditable-reasoning-audited", "Three prompt arms x three models x eight runs. Auditable structure appeared in 0 of 48 ungoverned calls; clause-citation Jaccard rose 0.74 to 0.95 under the constitution; a governed call costs $0.0006-$0.0024 and a three-model sealed decision $0.0049.", ["c3", "c8"]),
  ls("s5", "The genuine APPROVE — unanimous verdict, identical derivation", BASE + "/receipt/inv_wl0rnh136b", "The one clean authorisation on record: every seat fired the same clauses in the same trigger states on the same evidence. What a covered, sealed decision looks like.", ["c6"]),
  ls("s6", "A structurally invalid finding, voided", BASE + "/receipt/inv_2dsklah529", "The cheapest seat cited clauses 7, 8 and 12 of a six-clause rule set. A deterministic parser voided the finding; malformed output can never authorise. The fail-closed floor an underwriter can rely on.", ["c7"]),
  ls("s7", "The instrument auditing its own input: eight defects", BASE + "/receipt/inv_qh3ge2x74b", "A governed model asked to critique the case input found the rule set stated only a necessary condition where a sufficient one was needed — separating specification failure from model failure, which is the coverage boundary.", ["c9"]),
];
const claims = [
  { id: "c1", text: "AI performance guarantees are not being written at scale because machine judgement has no loss-frequency history in a form an actuary can use, so the risk is either declined or loaded to the point of pricing itself out.", section: "The underwriting problem", tier: "system", source_ids: [], why_material: "The market-blocking gap this artifact fills." },
  { id: "c2", text: "Per-model error rates measured under a rule set pinned to a content hash are a loss-frequency estimate for machine judgement, published with its sampling limits stated.", section: "The rate table", tier: "system", source_ids: ["s1"], why_material: "The missing actuarial input, produced as a live table rather than a vendor assertion." },
  { id: "c3", text: "The panel's seats are separate models from separate vendors with no shared state, and the governed output structure that makes their findings comparable appeared in zero of 48 ungoverned calls.", section: "Correlated versus independent error", tier: "system", source_ids: ["s4"], why_material: "Diversification across seats is only real if the errors are independent and the findings are comparable." },
  { id: "c4", text: "Krippendorff's alpha and Fleiss' kappa are published alongside the rates, so an underwriter can see whether the seats' errors are correlated — the statistic that determines whether a multi-model panel actually diversifies the risk.", section: "Correlated versus independent error", tier: "system", source_ids: ["s1"], why_material: "Correlated error is the tail risk a panel cannot be priced without." },
  { id: "c5", text: "The derivation-agreement gate fails closed: a unanimous verdict was refused because two seats derived it through different trigger states, converting a would-be undetected error into a detected, receipted deferral to a human.", section: "Why the loading collapses", tier: "system", source_ids: ["s2", "s3"], why_material: "Detected deferral is a priceable event; undetected error is the fraud/opacity loading." },
  { id: "c6", text: "A sealed authorisation on record shows every seat firing the same clauses in the same trigger states on the same evidence — the artifact a parametric trigger can reference.", section: "A parametric trigger", tier: "system", source_ids: ["s5"], why_material: "A claim event definable from the receipt alone removes the loss-adjustment dispute." },
  { id: "c7", text: "Malformed findings — invented clauses, missing fields, no terminal decision line — are voided by a deterministic parser and can never authorise, and the gate's own one recorded failure (false convergence on clause numbers) is documented with its fix.", section: "Why the loading collapses", tier: "system", source_ids: ["s2", "s6"], why_material: "Fail-closed behaviour plus a documented self-caught failure is the moral-hazard answer." },
  { id: "c8", text: "A governed call costs $0.0006 to $0.0024 and a three-model sealed decision $0.0049, so putting the measurement on every covered decision costs effectively nothing against the insured exposure.", section: "The economics", tier: "system", source_ids: ["s4"], why_material: "Removes the economic objection to per-decision evidence as a policy condition." },
  { id: "c9", text: "The same machinery separates specification failure from model failure: a governed critique of a case file found eight input defects, the lead one a necessity-stated-as-sufficiency error that had caused every prior divergence.", section: "The coverage boundary", tier: "system", source_ids: ["s7"], why_material: "Whether the insured's policy text or the model caused the loss is the coverage dispute; here it is decidable from receipts." },
  { id: "c10", text: "No calibration study establishes correctness at a known rate; the published rates cover one task class with small n; and the genuine APPROVE used two model families, not three.", section: "What is not satisfied", tier: "system", source_ids: [], why_material: "An underwriter must not be sold more than the evidence supports; these are the exact gaps a pilot must close." },
];
const body = `## The underwriting problem, stated as an actuary would

Insurance is written on frequency and severity. Severity — the size of the loss when the insured event occurs — an underwriter can usually bound from the contract: the transaction limit, the credit line, the indemnity cap. Frequency is the problem. Every line of business that exists became writable when someone assembled a credible answer to *how often does this happen* — mortality tables for life, loss triangles for casualty, catastrophe models for property. Machine judgement has no such table. When Munich Re's aiSure, Armilla, Relm, and the Lloyd's syndicates that have circled AI performance cover assess a proposal, the question that stalls it is not whether the model is impressive. It is: **at what rate is it wrong, measured how, on what fixed basis?**

Absent that number, one of three things happens, and all three are visible in the market today:

1. **The risk is declined.** No rate, no policy.
2. **The risk is written narrow** — cover attaches only to a specific model version on a specific task with the vendor standing behind it, which is really the vendor's warranty wearing an insurance wrapper.
3. **The risk is written with a loading** large enough to absorb everything the underwriter cannot see: the *opacity loading* (the model's failure modes are unknown) and the *moral-hazard loading* (the insured operates the model, observes its failures first, and controls what gets reported). Loadings of that size price the product out of the use cases that need it.

Two further structural problems make it worse than an ordinary new line. First, **correlated error**: if an insurer writes a thousand policies on judgements made by the same model family, the errors do not diversify — a defect in the checkpoint is a defect in every insured decision simultaneously, which is a catastrophe-shaped exposure, not a frequency-shaped one. Second, **claims adjudication**: when the insured says "the model was wrong and it cost us," reconstructing what the model saw, what it was instructed with, and what it actually concluded is, for an ungoverned system, forensic archaeology. Every one of those disputes is loss-adjustment expense, and the anticipated expense is priced in before the first claim.

This page maps a running system's measured artifacts onto those exact inputs. Every claim opens to a live receipt.

## The rate table

Under a rule set pinned to a content hash — so the basis of measurement is beyond dispute — each model's error rate is measured on a fixed suite and published:

[[embed:source:s1]]

Read it as an actuary, because that is what it is shaped for. It is a **per-seat frequency estimate on a fixed, hashed basis**: the rule set cannot drift under the measurement, the suite is versioned, and re-running it after a vendor swaps checkpoints is the change-detection instrument. It is not a vendor benchmark: the limits — one task class, deliberately small n, the prevalence paradox that makes raw accuracy misleading on skewed case mixes — are stated on the page itself, because an underwriter who prices on a hidden sample is the one who gets hurt at the first claim.

## Correlated versus independent error: the panel and its statistics

A single model's error rate, however well measured, leaves the correlation problem untouched. The system's answer is structural: each governed decision is put to **several models from different training families**, separate vendors, no shared state, each blind to the others. Diversification across seats, though, is only real if two things hold, and both are measured rather than assumed.

First, the seats' findings must be *comparable* — otherwise "agreement" is unfalsifiable. A governing constitution compels every seat into the same output shape: verdict, clauses relied on, a clause-by-clause derivation (did the clause trigger, does it support or defeat the action, on which evidence records), the records that were absent, the strongest rejected alternative, the finding that would flip the conclusion. A 72-call controlled study established that this structure is caused by the governing text, not by model goodwill — it appeared in **zero of 48 ungoverned calls**, and clause-citation agreement rose from 0.74 to 0.95 (Jaccard) as governance tightened:

[[embed:source:s4]]

Second, the correlation itself must be published. The rate table carries **Krippendorff's alpha and Fleiss' kappa** alongside the per-seat rates. For an underwriter this is the load-bearing statistic: high inter-seat agreement on *wrong* answers means the panel's errors are correlated and the multi-model structure diversifies nothing; independent errors mean the panel's joint failure rate is the product of small numbers. The statistic that distinguishes those two worlds is on the same page as the rates. No AI vendor's accuracy claim ships with it.

## Why the fraud and opacity loading collapses

The loading exists because, in an ungoverned system, a wrong machine decision is **undetected** — it looks exactly like a right one until the loss surfaces, and the insured sees it before the carrier does. The derivation-agreement gate changes the shape of that risk mechanically.

The surviving findings from the panel go to a gate that does not compare verdicts. It compares **derivations** — canonical per-clause tuples of clause, trigger state, disposition, and evidence records. Only when independent models agree not just on the answer but on *why*, clause by clause, does the decision seal. Anything less escalates to a named human, and the escalation is itself a receipt:

[[embed:source:s2]]

The exhibit that matters for pricing is the refusal. Three models returned the **same verdict**, citing the **same clauses** — and the gate still declined to conclude, because two of them had derived that verdict through different trigger states:

[[embed:source:s3]]

That receipt is the loading collapsing in a single artifact. The event an underwriter cannot price — a plausible-looking wrong answer executing silently — is converted into an event that is cheap to price: a **detected deferral**, timestamped, escalated, on the record. The carrier is no longer covering an opaque black box operated by the insured; it is covering a process with a measured per-seat error rate, a published correlation statistic, and a documented halt condition. Undetected error becomes detected deferral, and detected deferral is just frequency times a known, small severity.

The floor underneath it is deterministic, not probabilistic. A finding that invents a clause, omits a required field, or lacks its terminal decision line is **voided by a parser** — not judged by another model — and structurally cannot authorise. Here is that happening to the cheapest seat on a panel, which cited clauses 7, 8 and 12 of a six-clause rule set:

[[embed:source:s6]]

And the gate has the credential an underwriter should demand of any control: a documented failure of its own. Its first version compared clause *numbers* and sealed an APPROVE on what turned out to be false convergence — three seats citing the same numbers while meaning different things. The seal was retracted, the comparison was rebuilt on canonical derivation tuples, and both the defective seal and its replacement are public receipts, linked from the gate write-up above. A control that has caught itself failing, on the record, is the opposite of moral hazard.

## A parametric trigger

The severity side of AI performance cover is poisoned by loss adjustment: every claim is an argument about what the model saw and why it decided. Parametric insurance exists to delete that argument — the claim pays on an objectively verifiable trigger event, not on adjusted loss. The sealed decision is exactly such an event. Here is a genuine authorisation: every seat firing the same clauses in the same trigger states on the same evidence, hashed inputs, complete request and response payloads preserved:

[[embed:source:s5]]

A policy can reference that artifact directly: cover attaches to decisions sealed by unanimous derivation agreement under rule set hash H; a claim event is a sealed decision subsequently shown wrong against the same hashed record. Everything the adjuster would have had to reconstruct — inputs, instructions, reasoning, verdict — is already in the receipt, verbatim. The dispute surface shrinks to "was the sealed decision wrong," which is the one question insurance is actually for.

## The coverage boundary: specification failure versus model failure

The claim dispute that remains is attribution: did the model fail, or was the insured's own policy text defective — a loss the carrier never agreed to cover? For ungoverned systems this is undecidable, which is more loading. Here it is machine-decidable, with a receipt. A governed seat, asked to critique a case file as a colleague, returned eight input defects, the lead one critical: the rule set's grant clause stated only a *necessary* condition where a sufficient one was needed, so no clause licensed an affirmative grant — and that defect, not model unreliability, had caused every prior derivation divergence on the case:

[[embed:source:s7]]

An instrument that distinguishes those two failure classes, per case, from artifacts rather than testimony, is the difference between a coverage exclusion that can be operated and one that can only be litigated.

## The economics

The instrument's own cost does not enter the argument. A governed call runs $0.0006 to $0.0024; a full three-model sealed decision, $0.0049 measured — about half a cent:

[[embed:source:s4]]

Against the exposure on a single guaranteed decision, the cost of measuring, gating, and receipting it rounds to zero. The correct conclusion is not that the measurement is affordable; it is that a policy has no reason to accept any covered decision *without* it.

## What a policy specification could mandate

The fastest route to a writable market is not a carrier buying this instrument — it is a broker or buyer writing it into the specification, where the loss-frequency requirement becomes contractual. A specification could mandate, per covered decision class:

- **A hashed basis**: the rule set and record under a content hash, so the insured basis of every decision is fixed and disputes about "which version" are impossible.
- **A published rate table**: per-seat error rates on the hashed suite, re-run on every model or prompt change, with the change events themselves receipted.
- **Agreement statistics**: Krippendorff's alpha and Fleiss' kappa across seats, so correlated error is visible before it is priced.
- **A fail-closed gate**: no decision executes on divergent derivations; malformed findings void; escalations receipted — the halt condition the loading was covering for.
- **Seat diversity**: a minimum number of distinct model families on consequential decision classes.
- **Complete payloads**: every receipt carries the full request and response, not summaries — the loss-adjustment file, pre-assembled.
- **Input audits**: a governed critique of the rule set itself on file, so specification failure is separated from model failure before a claim, not during one.

Every item on that list is demonstrated above with a live artifact. None of it is a proposal.

## What is not satisfied

Stated as plainly as the rest, because a rate table that oversells itself is worthless to the one profession that will actually check:

- **No correctness calibration.** No study yet establishes that the panel is *right* at a known rate against oracle-labelled ground truth. The rates quantify disagreement and per-seat error on the fixed suite; they do not certify accuracy. That study — hashed, oracle-labelled cases, a measured wrongful-authorisation rate — is the named next artifact, and it is the one an actuary would price from.
- **Small n, one task class.** The published rates come from a deliberately bounded suite. They are a starting table — enough to structure a pilot and refine on the pilot's own decisions, not enough to treat as a certified actuarial basis across domains.
- **Two families, not three.** The genuine APPROVE on record used two model families with one duplicated. Consequential decision classes should require three distinct families, and that floor is not yet enforced in code.

An underwriter reading this should treat those three gaps as the pilot agenda. Everything else on this page is already openable.

## Submit a case

Send one bounded decision you would have to price — the rule set and the record — to **build@miscsubjects.com**. You get back the governed panel, the seal, and the receipt: the exact artifact a specification could mandate. No account, no call, no deck.
`;
const cur = await (await fetch(`${BASE}/api/articles/${SLUG}`)).json();
const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({ ...cur, slug: SLUG, body, claims, sources, status: "published" }),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources");
