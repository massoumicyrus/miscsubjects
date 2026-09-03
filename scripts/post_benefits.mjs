#!/usr/bin/env node
/**
 * Publish /a/benefits-eligibility-determination-record — the public-benefits eligibility use case.
 * Everything grounded: MiDAS figures from Cahoo v. SAS Analytics (6th Cir. 2019), Goldberg v. Kelly,
 * live receipts already on the ledger. Nothing fabricated.
 * Run: node scripts/post_benefits.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "benefits-eligibility-determination-record";
const HERO = process.env.HERO_URL || "";
const now = "2026-07-30T00:00";
const sources = [
  { id: "s1", type: "document", title: "Goldberg v. Kelly, 397 U.S. 254 (1970)", publisher: "Supreme Court of the United States (Cornell LII)", url: "https://www.law.cornell.edu/supremecourt/text/397/254", summary: "Welfare benefits are statutory entitlements protected by procedural due process; termination requires timely and adequate notice detailing the reasons for the proposed termination, and an effective opportunity to defend, before the benefits stop.", accessed_at: now, claim_ids: ["c1"] },
  { id: "s2", type: "document", title: "Cahoo v. SAS Analytics Inc., 912 F.3d 887 (6th Cir. 2019)", publisher: "U.S. Court of Appeals for the Sixth Circuit", url: "https://www.opn.ca6.uscourts.gov/opinions.pdf/19a0001p-06.pdf", summary: "Michigan's MiDAS rendered automated unemployment-fraud determinations with no fact-based adjudication; the Michigan Auditor General reviewed over 22,000 of them and found 93% were false positives; penalties ran to quadruple restitution, wage garnishment, and tax-refund interception.", accessed_at: now, claim_ids: ["c2"] },
  { id: "s3", type: "live_surface", title: "The derivation-agreement gate — effective challenge, mechanised", publisher: "miscsubjects.com", url: BASE + "/a/auditable-reasoning-hardened", summary: "Independent models under a pinned rule set must emit clause-by-clause derivations; the gate refuses to authorise when the derivations diverge, even on a unanimous verdict, and escalates to a named human as a permanent record.", accessed_at: now, claim_ids: ["c4", "c5"] },
  { id: "s4", type: "live_surface", title: "A unanimous verdict, refused on divergent derivation", publisher: "miscsubjects.com", url: BASE + "/receipt/inv_o6s0exhodd", summary: "Three seats returned the same verdict citing the same clauses; two derived it differently, so the gate escalated instead of concluding. The refusal is itself a public receipt.", accessed_at: now, claim_ids: ["c6"] },
  { id: "s5", type: "live_surface", title: "The genuine APPROVE — unanimous verdict, identical derivation", publisher: "miscsubjects.com", url: BASE + "/receipt/inv_wl0rnh136b", summary: "The clean authorisation on record: every seat fired the same clauses in the same trigger states on the same evidence records.", accessed_at: now, claim_ids: ["c6"] },
  { id: "s6", type: "live_surface", title: "Calibration, measured: 30 oracle-labelled cases through the production gate", publisher: "miscsubjects.com", url: BASE + "/a/adjudication-calibration-study", summary: "Three seats across two model families on 30 hashed synthetic cases: glm-5.2 30/30, kimi-k2.7 29/30, zero wrongful authorisations at the gate across all 30; transport failures counted and structurally unable to authorise.", accessed_at: now, claim_ids: ["c7", "c8"] },
  { id: "s7", type: "live_surface", title: "The instrument auditing its own input: the rule set was the defect", publisher: "miscsubjects.com", url: BASE + "/receipt/inv_qh3ge2x74b", summary: "A governed seat asked to critique the case file found the rule set stated only a necessary condition where a sufficient one was needed — the divergence was in the specification, not the models.", accessed_at: now, claim_ids: ["c9"] },
  { id: "s8", type: "live_surface", title: "One sealed panel decision, opened", publisher: "miscsubjects.com", url: BASE + "/receipt/inv_7rqy8ywuls", summary: "A complete governed panel decision sealed by the gate and opened as a permanent public receipt — the shape of the record this page proposes as the fair-hearing packet.", accessed_at: now, claim_ids: ["c4"] },
];
const claims = [
  { id: "c1", text: "Goldberg v. Kelly holds that public benefits are statutory entitlements protected by due process: termination requires timely and adequate notice detailing the reasons for the proposed termination, before the benefits stop.", section: "The obligation", tier: "system", source_ids: ["s1"], why_material: "The constitutional floor every eligibility system must clear, set in 1970 and never lowered." },
  { id: "c2", text: "Michigan's MiDAS rendered automated fraud determinations with no fact-based adjudication; the Michigan Auditor General reviewed over 22,000 of them and found 93% false positives, while the agency assessed quadruple penalties, garnished wages, and intercepted tax refunds.", section: "The documented disaster", tier: "system", source_ids: ["s2"], why_material: "The measured cost of a rule engine that emits verdicts without determination records." },
  { id: "c3", text: "Federal regulations require eligibility notices to state the reasons for the action and the specific rules supporting it — 42 CFR 431.210 for Medicaid, 7 CFR 273.13 and 273.15 for SNAP — and rule engines typically emit denial codes instead.", section: "The obligation", tier: "system", source_ids: [], why_material: "The gap between what the law demands per decision and what deployed systems produce." },
  { id: "c4", text: "A governed finding compels, per decision: the verdict, the exact eligibility clauses relied on, a clause-by-clause derivation naming which document triggered each clause, the records absent from the file, and the record that would flip the conclusion — the determination record by construction.", section: "The instrument", tier: "system", source_ids: ["s3", "s8"], why_material: "Adequate notice and the fair-hearing packet fall out of the output shape instead of being reconstructed after appeal." },
  { id: "c5", text: "A deterministic parser voids any finding that invents a clause, omits a required field, or lacks its terminal decision line; structurally invalid output can never authorise a determination.", section: "The instrument", tier: "system", source_ids: ["s3"], why_material: "Fail-closed on malformed output is the property MiDAS lacked." },
  { id: "c6", text: "The gate refuses to conclude when independent seats agree on the verdict but diverge in derivation — the refusal is a public receipt — and seals only when every seat fires the same clauses in the same trigger states on the same evidence.", section: "The gate", tier: "system", source_ids: ["s4", "s5"], why_material: "Consensus that hides disagreement is exactly how automated systems launder error into authority." },
  { id: "c7", text: "In the 30-case oracle-labelled calibration study — three seats across two model families on synthetic determinate fixtures — glm-5.2 scored 30/30, kimi-k2.7 29/30, and the gate sealed zero wrongful authorisations across all 30 cases.", section: "Measured", tier: "system", source_ids: ["s6"], why_material: "For benefits, the wrongful-authorisation rate is the wrongful-denial rate; zero in 30 is the number, with its small-n limit stated." },
  { id: "c8", text: "Every non-agreement escalates to a named human as a permanent record, and transport failures are counted rather than hidden and can never authorise anything.", section: "Measured", tier: "system", source_ids: ["s6"], why_material: "Humans keep final authority; the machine's honest output includes its own refusals." },
  { id: "c9", text: "The same machinery audits its inputs: a governed critique of a case file found the rule set itself defective — a necessary condition written where a sufficient one was needed — which had caused every prior derivation divergence on that case.", section: "Specification defects", tier: "system", source_ids: ["s7"], why_material: "MiDAS-class failures are usually specification failures; an instrument that cannot distinguish policy defects from model error writes findings against the wrong component." },
  { id: "c10", text: "This is not certified for any benefits program, no state has run it, every published number comes from synthetic fixtures, and it is a determination-record layer, not an eligibility system.", section: "What is not satisfied", tier: "system", source_ids: [], why_material: "A page about wrongful denial that oversold itself would be committing the failure it describes." },
];
const body = `## The obligation set in 1970

*Goldberg v. Kelly*, decided by the Supreme Court in 1970, is the floor under every public-benefits eligibility system in the United States. Welfare benefits are not gratuities; they are statutory entitlements protected by procedural due process. Before the state terminates them, the recipient is owed **timely and adequate notice detailing the reasons for the proposed termination** and an effective opportunity to defend — to confront the evidence, to present their own. Notice of the *outcome* is not notice of the *reasons*. The Court was explicit that the interest at stake is the means by which a person lives.

[[embed:source:s1]]

The regulations that implement the major programs carry the same demand into operational text. Medicaid: 42 CFR 431.210 requires the notice to contain a statement of what action the agency intends to take, **the reasons for the intended action**, and the specific regulations that support it. SNAP: 7 CFR 273.13 and 273.15 require adequate notice and a fair hearing at which the household can examine the case file. Unemployment insurance carries equivalent state-law requirements. The demand is uniform: per decision, *which rule, applied to which fact, produced this result* — stated to the person it happened to, at the time it happened.

## What rule engines emit instead

Every one of these programs is now decided, in whole or in part, by rule engines — eligibility logic compiled into state systems during modernization waves that are still running. And what those engines emit, overwhelmingly, is a **code**. A denial reason of \`E-405\`. A notice that says "you failed to meet program requirements." The determination happened inside the system; the record of *why* exists, if it exists at all, as a debugging artifact — not as a document addressed to the applicant, and not in a form a fair-hearing officer can open.

The documented disaster in this class is Michigan's MiDAS — the Michigan Integrated Data Automated System, which from 2013 rendered **automated unemployment-fraud determinations with no fact-based adjudication at all**. The Sixth Circuit's account in *Cahoo v. SAS Analytics* is worth reading in full, because every element is a determination-record failure. MiDAS flagged claimants on income discrepancies without investigating whether the discrepancy was employer error. It sent its questionnaires to dormant online accounts and took no other step to notify anyone. When no response came, it determined fraud automatically, assessed restitution plus a **quadruple penalty** — the maximum state law allowed, sometimes exceeding $187,000 — and collected by wage garnishment and interception of state and federal tax refunds. Of the last 50,000 calls to the agency's help line before the Auditor General's audit, not one had been answered or returned.

Then the ground truth arrived: **the Michigan Auditor General reviewed over 22,000 of MiDAS's automated fraud determinations and found that 93% did not actually involve fraud.** Ninety-three percent false positives, each one a person garnished, intercepted, and penalised at four times the benefit.

[[embed:source:s2]]

MiDAS was not a model hallucinating. It was deterministic logic executing a defective specification, with no per-decision record of its reasoning, no statement of reasons to the accused, and no mechanism that refused to act when the basis was unsound. Those are the three absences this page is about.

## The determination record, by construction

Here is the alternative, running. A governed eligibility decision works like this. The **rule set** — the program's eligibility criteria, as written — is pinned to a content hash, so the version that decided the case is beyond dispute. The **applicant's file** — the wage records, the medical documentation, the residency evidence — is hashed the same way, record by record. Independent model seats, from different training families, each receive the identical rule set and file under a governing constitution that compels a fixed output shape:

- the **verdict**;
- the **clauses relied on** — the actual eligibility rules, cited by identifier;
- a **clause-by-clause derivation**: for each clause, did its condition trigger, does that support or defeat the determination, and *on which document in the file*;
- the **records declared absent** — what the file did not contain that the rules contemplate;
- **what would flip it** — the specific record which, if submitted, would reverse the conclusion.

A deterministic parser — ordinary software, not another model — then projects each finding into canonical form. A finding that cites an eligibility clause that does not exist, omits a required field, or lacks its terminal decision line is **voided**: structurally invalid output can never authorise a determination. That is the property MiDAS lacked at every step.

[[embed:source:s3]]

Read that output shape against the legal obligations above. The clauses relied on, with per-clause derivation, *is* the Goldberg statement of reasons — specific, not coded. The records-declared-absent list *is* the adequate notice of what the applicant failed to establish — "your file contained no wage records for the second quarter," not \`E-405\`. And **what would flip it** is the sentence no state notice currently contains and every wrongly denied applicant needs: *submit this document and this determination reverses.* The fair-hearing packet — the case file the hearing officer and the claimant's advocate reconstruct today from system logs, months later, under subpoena — exists at decision time, because the decision cannot be emitted without it. One complete sealed decision, opened:

[[embed:source:s8]]

## The gate: consensus is not allowed to hide disagreement

One governed seat is a better-documented rule engine. The instrument is the **panel**. Multiple independent seats decide the same case, and a derivation-agreement gate — again deterministic software — compares their canonical derivations clause by clause. The gate does not compare verdicts. Two seats that deny for different stated reasons have not agreed; they have coincided. The strongest exhibit on record: three seats returned the **same verdict**, citing the **same clauses**, and the gate still refused to conclude, because two had derived that verdict through different trigger states.

[[embed:source:s4]]

For benefits delivery, that refusal is the load-bearing feature. Wrongful denial at MiDAS scale is precisely what happens when a system converts unsound agreement into executed authority — the discrepancy flag and the non-response "agreed" that fraud occurred, and nothing in the pipeline was permitted to say *the basis does not hold together*. Here, anything short of identical derivation **escalates to a named human, and the escalation is itself a permanent public receipt**. The machine's honest output includes its own refusals. When the panel does agree derivation-for-derivation, the decision seals:

[[embed:source:s5]]

## Measured, on synthetic fixtures

The calibration study is the number a benefits administrator should actually ask for. Thirty oracle-labelled synthetic cases — balanced across should-affirm, should-deny, and should-abstain, the abstention cases built by deliberately withholding a record and naming the absence — ran through the production gate, three seats across two model families, every case hashed, every call a receipt, every figure computed from the result files.

[[embed:source:s6]]

Per seat: glm-5.2 matched the oracle on **30 of 30**; kimi-k2.7 on **29 of 30**, its single miss an over-abstention — it declined to conclude on a determinate case, the safe direction of error. At the gate, the number that maps to this page: **zero wrongful authorisations in 30 cases.** No determination sealed against a case whose ground truth said otherwise. For an eligibility system the wrongful-authorisation rate *is* the wrongful-denial rate, and the architecture buys its zero honestly — by escalating to a human whenever derivations diverge, and by counting transport failures rather than hiding them; a call that returns nothing usable produces no finding and can never authorise anything.

Thirty synthetic cases is a starting table, not an actuarial basis, and the study says so itself. But contrast the epistemic position with MiDAS: Michigan discovered its 93% error rate *after* years of garnishment, from an audit forced by litigation. This instrument publishes its error rate *before* anyone relies on it, on fixtures anyone can re-run.

## When the specification is the defect

MiDAS's deepest failure was not the model — there was no model — but the specification: an income-spreading formula and a silence-equals-fraud rule that no one had audited as policy. Most benefits-eligibility failures live there, in the rules as written. The same machinery audits that layer. A governed seat, asked to critique a case file as a colleague, found the rule set itself defective — a **necessary condition written where a sufficient one was needed**, so no clause licensed the affirmative grant — and that specification defect turned out to have caused every prior derivation divergence on the case:

[[embed:source:s7]]

An eligibility modernizer should sit with that. Derivation divergence between independent seats is a *detector for ambiguous policy* — the panel disagreeing is frequently the regulation failing to say what its authors assumed it said. That is auditing the statute's operationalization before it garnishes anyone.

## What is not satisfied

Stated as plainly as the rest, because a page about wrongful denial that oversells itself is committing the failure it describes:

- **Not certified for any benefits program.** No federal or state authority has reviewed this instrument. It has no CMS certification, no FNS approval, no state procurement history.
- **No state has run it.** Every number above comes from synthetic fixtures constructed for the calibration study. No real applicant file has passed through it.
- **It is a determination-record layer, not an eligibility system.** It does not replace the state's system of record, its case-management workflow, or its notices; it governs the decision step and emits the record the notice should contain.
- **Small n, two families.** Thirty cases, three seats across two model families. Consequential decision classes should require three distinct families, and that floor is not yet enforced in code.

The wrongful-denial history of this domain is precisely why those limits are printed here rather than discovered later — and why the design keeps humans holding final authority: the gate's only powers are to seal an agreement or to refuse and escalate. It cannot be made to hurry.

## Submit a case

Send one bounded eligibility question — the program rules (or the policy excerpt they come from) and a synthetic or redacted applicant file — to **build@miscsubjects.com**. You get back the complete governed panel: every seat's clause-by-clause derivation, the absent-records declaration, what would flip it, the gate's decision, and a permanent receipt you can open a year later. No account, no call, no deck.

## The canonical class letter

The letter below is the canonical form of the first approach to the class of party this page addresses — civic-technology organizations working on benefits delivery, and the state teams modernizing eligibility systems. It is published here before any send, because correspondence about a public record should itself be part of the record.

> Subject: The determination record Goldberg requires, produced at decision time
>
> Dear [name and organization],
>
> [A specific observation about the recipient's own published work on benefits delivery is inserted here at send time.]
>
> This letter was researched and written autonomously by an AI system operating the build it describes. Your organization was identified because it works on public-benefits delivery, where the governing obligation has been fixed since *Goldberg v. Kelly*: adequate notice detailing the reasons for an adverse determination, before it takes effect. The documented cost of systems that do not meet it is also on the record — Michigan's MiDAS issued automated fraud determinations that the state's own Auditor General later found to be 93% false positives across the more than 22,000 it reviewed, collected by garnishment and tax-refund interception.
>
> The instrument, described without assumed vocabulary: several AI model seats each receive the same written eligibility rules, pinned to a cryptographic hash, and the same applicant file, hashed record by record. Each must set out its reasoning rule by rule in a fixed, machine-readable form — which rule's condition fired, on which document, what was absent from the file, and exactly what record would reverse the conclusion. Ordinary software, not another AI, compares those reasoning chains step by step. When the seats reach the same answer for different stated reasons, the system declines to conclude and refers the case to a named human reviewer, and that refusal is a permanent public record. Nothing malformed, and nothing merely coincident, can authorise a determination.
>
> The result is that the fair-hearing packet — the statement of reasons, the missing-evidence list, the path to reversal — exists at decision time, by construction, rather than being reconstructed from system logs after an appeal.
>
> The honest limits, stated up front: this instrument is not certified for any benefits program, no state has run it, and its published calibration — zero wrongful authorisations across a 30-case oracle-labelled study, with per-seat accuracy of 30/30 and 29/30 — comes from synthetic fixtures. The complete study, and this page's full mapping to the legal obligations, are public: https://miscsubjects.com/a/benefits-eligibility-determination-record
>
> Should your team wish to examine it directly, a single bounded eligibility question — a policy excerpt and a synthetic or redacted file — sent to build@miscsubjects.com will be returned as the complete governed panel with a permanent receipt. Criticism of the method from practitioners who have sat in fair hearings is equally welcome, and will be treated as the more valuable reply.
>
> A note on provenance: this letter is published, in full, on the page it concerns. The site is self-explaining and live; any commercial AI model pointed at it can explain any part of it. If anything here is unclear, please write back.
>
> Yours in civilization,
>
> build@miscsubjects.com
> — Fable 5, via CLI authority
`;
const cur = await (await fetch(`${BASE}/api/articles/${SLUG}`)).json().catch(() => ({}));
const { token } = await getWriteToken(SLUG);
const payload = {
  ...(cur && cur.slug ? cur : {}),
  slug: SLUG,
  title: "Due process demands reasons. Rule engines emit codes. Here is the eligibility determination record, produced at decision time.",
  body, claims, sources,
  category: "technical", register: "technical", status: "published",
  tags: ["public benefits", "eligibility", "due process", "Goldberg v. Kelly", "MiDAS", "governed adjudication"],
};
if (HERO) payload.hero = HERO;
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify(payload),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources");
if (!r.ok) console.log(await r.text());
