#!/usr/bin/env node
/**
 * Publish /a/ecoa-adverse-action-specific-reasons — new definitive use-case article.
 * Everything grounded in live receipts already on the ledger — nothing fabricated.
 * Run: node scripts/post_ecoa.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "ecoa-adverse-action-specific-reasons";
const HERO = process.env.HERO || "";
const ls = (id, type, title, publisher, url, summary, claims) => ({ id, type, title, publisher, url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  ls("s1", "primary_source", "Equal Credit Opportunity Act, 15 U.S.C. § 1691(d)", "U.S. Code (uscode.house.gov)", "https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section1691&num=0&edition=prelim", "The statutory adverse-action requirement: a creditor must provide a statement of specific reasons for adverse action, and a statement is sufficient only if it contains the specific reasons for the action taken.", ["c1"]),
  ls("s2", "primary_source", "Regulation B, 12 C.F.R. § 1002.9 — Notifications", "eCFR (Consumer Financial Protection Bureau)", "https://www.ecfr.gov/current/title-12/chapter-X/part-1002/section-1002.9", "The implementing rule: notification within 30 days, a statement of specific principal reasons, and the specificity standard — the statement must be specific and indicate the principal reason(s); vague statements are insufficient.", ["c1", "c2"]),
  ls("s3", "primary_source", "CFPB Circular 2022-03: Adverse action notification requirements in connection with credit decisions based on complex algorithms", "Consumer Financial Protection Bureau", "https://www.consumerfinance.gov/compliance/circulars/circular-2022-03-adverse-action-notification-requirements-in-connection-with-credit-decisions-based-on-complex-algorithms/", "The Bureau's answer to the black-box defense: ECOA and Regulation B apply regardless of the technology; a creditor cannot lawfully use a model whose specific reasons for adverse action it cannot identify and state.", ["c3"]),
  ls("s4", "primary_source", "CFPB Circular 2023-03: Adverse action notification requirements and the proper use of the CFPB's sample forms provided in Regulation B", "Consumer Financial Protection Bureau", "https://www.consumerfinance.gov/compliance/circulars/circular-2023-03-adverse-action-notification-requirements-and-the-proper-use-of-the-cfpbs-sample-forms-provided-in-regulation-b/", "The follow-up: checking the closest box on the sample checklist is not compliance when it does not reflect the actual principal reasons — creditors relying on unexpected data must state the actual reason even if no checklist entry fits.", ["c4"]),
  ls("s5", "live_surface", "The derivation-agreement gate — reasons compared clause by clause", BASE + "/a/auditable-reasoning-hardened", "Independent models under a pinned rule set; a deterministic parser projects each finding into canonical per-clause derivation tuples; the gate refuses to authorise when the derivations diverge, even on a unanimous verdict.", ["c5", "c6"]),
  ls("s6", "live_surface", "A unanimous verdict, refused on divergent derivation", BASE + "/receipt/inv_o6s0exhodd", "Three seats returned the same verdict citing the same clauses; two derived it through different trigger states, so the gate escalated instead of concluding — the reasons, not the answer, decided the outcome.", ["c6"]),
  ls("s7", "live_surface", "A sealed decision, opened: the genuine APPROVE and a complete panel receipt", BASE + "/receipt/inv_wl0rnh136b", "The clean authorisation on record: every seat fired the same clauses in the same trigger states on the same evidence. A second complete sealed panel is at /receipt/inv_7rqy8ywuls, and a single governed seat's full finding at /receipt/inv_qh3ge2x74b.", ["c5", "c7"]),
  ls("s8", "live_surface", "Calibration, measured: 30 oracle-labelled cases through the production gate", BASE + "/a/adjudication-calibration-study", "Three seats across two model families on 30 hashed, oracle-labelled synthetic cases: glm-5.2 30/30, kimi-k2.7 29/30, zero wrongful authorisations at the gate across all 30.", ["c8"]),
  ls("s9", "live_surface", "The flip condition as the required reason — the prior-authorisation exhibit", BASE + "/a/adjudication-medical-prior-auth", "A coverage record adjudicated under the constitution, each seat compelled to name the record that would flip its verdict — the same field an adverse-action notice needs, produced at decision time.", ["c7"]),
];
const claims = [
  { id: "c1", text: "ECOA at 15 U.S.C. § 1691(d) entitles a rejected credit applicant to a statement of specific reasons, and the statute itself defines sufficiency: the statement must contain the specific reasons for the action taken.", section: "The obligation", tier: "system", source_ids: ["s1", "s2"], why_material: "The entire article rests on this being a statutory entitlement with a specificity standard, not a courtesy." },
  { id: "c2", text: "Regulation B at 12 C.F.R. § 1002.9 requires notification within 30 days and a statement of the specific principal reasons; the official interpretations reject vague or general statements as insufficient.", section: "The obligation", tier: "system", source_ids: ["s2"], why_material: "The operational deadline and the specificity bar that any decision system must meet." },
  { id: "c3", text: "CFPB Circular 2022-03 states that the adverse-action requirements apply regardless of the technology used, and that a creditor may not lawfully use a complex algorithm when it cannot identify and state the specific reasons for the adverse action.", section: "The obligation", tier: "system", source_ids: ["s3"], why_material: "Removes the black-box defense; the compliance question becomes architectural." },
  { id: "c4", text: "CFPB Circular 2023-03 states that checking the closest entry on the Regulation B sample checklist is not compliant when it does not reflect the actual principal reasons for the adverse action.", section: "The obligation", tier: "system", source_ids: ["s4"], why_material: "Kills the checklist workaround — the reason stated must be the reason that operated." },
  { id: "c5", text: "In the governed decision format, each model seat must emit a per-clause derivation — whether each clause's condition fired, whether it supports or defeats the action, and on which evidence records — plus the records that were absent and the finding that would flip the verdict, all against a rule set pinned to a content hash.", section: "Reasons by construction", tier: "system", source_ids: ["s5", "s7"], why_material: "This is the mechanism that makes the reasons contemporaneous artifacts rather than reconstructions." },
  { id: "c6", text: "The derivation-agreement gate refuses to authorise when independent seats reach the same verdict through different derivations; a unanimous verdict has been refused on the record for exactly this.", section: "Reasons by construction", tier: "system", source_ids: ["s5", "s6"], why_material: "Proves the reasons are load-bearing: they decide whether the decision seals at all." },
  { id: "c7", text: "Every sealed decision leaves a permanent public receipt carrying the hashes, contract, and lineage, with the complete request and response credentialed behind it — so the reasons on the notice can be checked against the reasons in the record, at any later date.", section: "The notice writes itself", tier: "system", source_ids: ["s7", "s9"], why_material: "An adverse-action file that survives a fair-lending examination is one whose stated reasons are verifiable against the decision record." },
  { id: "c8", text: "In the first calibration study — 30 oracle-labelled synthetic cases through the production gate, three seats across two model families — glm-5.2 scored 30/30, kimi-k2.7 29/30, and the gate produced zero wrongful authorisations across all 30 cases.", section: "Measured, not asserted", tier: "system", source_ids: ["s8"], why_material: "The residual error is quantified on a bounded suite rather than asserted." },
  { id: "c9", text: "Where a lender's underlying scorer is a separate machine-learning model, this format governs rule-application decisions — policy overlays, exception handling, verification-driven denials — and does not produce the reasons of the scoring model itself; Regulation B requires the actual principal reasons from whatever actually scored the applicant.", section: "The boundary, stated precisely", tier: "system", source_ids: ["s2", "s3"], why_material: "The article must not be read as an explainability substitute for a gradient-based scorer; that would be overselling into a regulated obligation." },
  { id: "c10", text: "No conformance analysis against Regulation B's sample notification forms or its specific notice-content requirements has been performed; the calibration fixtures are synthetic and determinate; the running exhibits use three seats across two model families, not three.", section: "The boundary, stated precisely", tier: "system", source_ids: ["s8"], why_material: "A compliance reader must know exactly what has and has not been established before relying on any of it." },
];
const body = `## The obligation: specific reasons, by statute

When a creditor takes adverse action — denies the application, closes the account, cuts the limit, refuses the terms requested — the Equal Credit Opportunity Act gives the applicant a statutory entitlement: a **statement of specific reasons**. Not a notice that something happened. The reasons. And the statute defines sufficiency itself: 15 U.S.C. § 1691(d) provides that a statement of reasons "meets the requirements of this section only if it contains the **specific reasons** for the adverse action taken."

[[embed:source:s1]]

Regulation B, 12 C.F.R. § 1002.9, operationalizes it: notification within 30 days, containing a statement of the specific **principal** reasons for the action — or a disclosure of the applicant's right to demand them. The official interpretations are blunt about the bar: the statement "must be specific and indicate the principal reason(s)," and statements like "the applicant failed to achieve a qualifying score on our credit scoring system" or "internal standards were not met" do not pass. The examiner's question is never *did you send a letter*. It is *do the reasons on the letter state what actually drove the decision*.

[[embed:source:s2]]

Two CFPB circulars close the escape routes. Circular 2022-03 addresses the defense every machine-learning deployment eventually reaches for — *the model is too complex to explain*:

[[embed:source:s3]]

The Bureau's position is unambiguous: ECOA and Regulation B apply **regardless of the technology used**. A creditor's obligation is not diminished because the decision came from a complex algorithm, and a creditor cannot lawfully use a model when it cannot identify and state the specific reasons for the adverse actions the model produces. The circular is explicit that this holds even for so-called black-box models "when the technology used to evaluate applicants means they cannot accurately identify the specific reasons for denying credit."

Circular 2023-03 closes the second route — the checklist. Regulation B ships sample forms with a list of common reasons. Checking the closest box is not compliance when the box does not reflect the actual principal reason. A lender relying on behavioral or other unexpected data must state the actual reason, in language the applicant can understand, even when no checklist entry fits:

[[embed:source:s4]]

Put the two circulars together and the compliance requirement is architectural, not rhetorical: the system that decides must be able to produce, for each individual applicant, the actual principal reasons that operated in that applicant's case. Approximate reasons are not the statutory entitlement. Plausible reasons are not the statutory entitlement.

## The post-hoc problem

The standard industry answer is post-hoc explainability: run the decision, then run a second computation — feature attributions, surrogate models, perturbation analysis — to estimate which inputs mattered, and translate the top attributions into reason codes. Three properties make that legally fragile against the standard above.

First, it is an **approximation of the decision, not the decision**. Attribution methods answer "which inputs, under this method's assumptions, most influenced the output" — and different methods, baselines, and perturbation schemes rank different features for the same decision. A reason produced by a technique that another defensible technique would replace with a different reason is a weak exhibit for "the specific reasons for the action taken."

Second, it is **generated after the fact**, usually at notice time, sometimes at examination time. The artifact a fair-lending examiner or a plaintiff's expert wants is contemporaneous: what the decision system held as its grounds at the moment it decided. A reconstruction, however sophisticated, invites the question of whether the stated reason is the operative reason or the presentable one.

Third, it **cannot state the counterfactual with authority**. The most useful sentence in an adverse-action notice — the one Regulation B's purpose section actually gestures at, education of the rejected applicant — is *what would have changed this outcome*. A feature attribution does not commit to that. It says the ratio mattered; it does not certify that a ratio below a stated threshold flips the verdict.

None of this makes post-hoc methods worthless — for a gradient-based scorer they are often the only available instrument, and the boundary section below is precise about that. But where the decision is the application of written policy to a record, there is a stronger option: produce the reasons **at decision time, by construction**.

## Reasons by construction

The governed decision format on this site works as follows. The **rule set** — the credit policy, the overlay criteria, the exception-handling rules — is pinned to a content hash, so the version that governed this applicant is beyond dispute. The **record** under review is hashed the same way. Several independent model seats — in the running exhibits, three seats across two model families — each receive the identical rule set and record under a governing constitution that compels a fixed output shape: the verdict; the clauses relied on; a **clause-by-clause derivation vector** — for each clause, did its condition trigger, does that support or defeat the action, on which evidence records; the records that were **absent**; the strongest rejected alternative; and **what would flip the conclusion**.

A deterministic parser — ordinary software, not another model — projects each finding into canonical form and voids anything structurally invalid: an invented clause, a missing field, no terminal decision line. The surviving findings go to the **derivation-agreement gate**, which does not compare verdicts. It compares derivations:

[[embed:source:s5]]

The decisive exhibit for a compliance reader: three seats returned the **same verdict**, citing the **same clauses** — and the gate still refused to seal, because two of them had derived that verdict through different trigger states:

[[embed:source:s6]]

Read that receipt against Circular 2022-03. The circular's core demand is that the stated reason be the reason that actually operated. This gate enforces a stricter version mechanically: if the independent seats do not agree on *why* — clause, trigger state, evidence record — there is no decision at all, only a recorded escalation to a named human. The reasons are not documentation attached to the decision. They are the material the decision is made of. And when the panel does agree derivation-for-derivation, the sealed record is public and permanent:

[[embed:source:s7]]

## The notice writes itself

Take the fields the constitution compels and hold them against what an adverse-action notice needs.

- **The clauses that fired, with their trigger states**, are the principal reasons — stated at the level Regulation B's interpretations demand: not "internal standards were not met" but *which* standard, applied to *which* record, with the direction of effect. Each seat states them independently, and the gate certifies they coincide.
- **The absent records** are the § 1002.9 "incomplete application" analysis, produced automatically: the notice can say precisely what was missing, because a finding that omits its absence list is void.
- **The flip condition** is the counterfactual sentence — *what evidence would reverse this* — which is the most educative line a notice can carry and the one post-hoc attribution cannot certify. The prior-authorisation exhibit shows the shape: each seat naming the specific record that would flip its verdict, sealed into the decision:

[[embed:source:s9]]

- **The receipt** is the examination file. Every sealed decision leaves a permanent public proof object carrying the hashes, the contract, and the lineage, with the complete request and response credentialed behind it. A regulator, an auditor, or the applicant's counsel can check the reasons on the letter against the reasons in the record — a year later, unchanged. A complete governed seat finding, opened: [the attestation receipt](${BASE}/receipt/inv_qh3ge2x74b).

The compliance property is the direction of generation. The notice is not written *about* the decision by someone downstream. The decision's own compelled structure **is** the notice's content, produced at the moment of decision, by construction contemporaneous.

## Measured, not asserted

The format's error rate is not a claim; it is a study. Thirty oracle-labelled synthetic cases — balanced across should-affirm, should-deny, and should-abstain, every case hashed — ran through the production gate with three seats across two model families:

[[embed:source:s8]]

The seat table: glm-5.2 matched the oracle on 30 of 30; kimi-k2.7 on 29 of 30, its single miss an over-abstention — declining to conclude on a determinate case, the conservative direction. The number that matters for a lender: **zero wrongful authorisations at the gate** across all 30 cases. Where the gate erred, it erred toward escalation to a human — which, in an adverse-action context, is the failure mode you can live with, because an escalation produces review, not an unexplained denial.

## The boundary, stated precisely

This section is the one a fair-lending officer should read twice, because the claim above is bounded and the boundary is load-bearing.

**Where the score comes from a separate machine-learning model, this format does not explain that model.** Many lenders' adverse actions originate in a gradient-based scorer — a trained model whose "reasons" are distributed across learned weights. Regulation B requires the actual principal reasons from whatever actually scored the applicant; Circular 2022-03 makes clear you cannot substitute reasons you wish had operated. A governed rule-application layer wrapped around such a scorer produces authoritative reasons **for the layer's own decisions** — the policy overlays, knockout rules, verification-driven denials, exception handling — and nothing more. If the principal reason for the denial is the score itself, the specific-reasons obligation runs into the scoring model, and this format does not discharge it. What it can do there is bound the problem: every decision the institution moves from learned scoring into written policy becomes a decision whose reasons are producible by construction.

**No conformance analysis against Regulation B has been performed.** No mapping of the compelled output fields onto § 1002.9's notice-content requirements or the sample forms exists yet; the paragraph above arguing the fields correspond is an argument, not an audit. That analysis is a named next artifact, not a done one.

**The fixtures are synthetic and the suite is small.** The 30 calibration cases are deliberately bounded, determinate by design, and synthetic; they establish behavior on that suite, not an actuarial basis for a production credit portfolio. And the running exhibits use three seats across **two** model families — a consequential-decision floor of three distinct families is the stated standard and is not yet what the record shows.

A reader who needs those three gaps closed before relying on any of this is reading correctly. Everything else on this page is already openable.

## Submit a case

Send one bounded adverse-action question — your policy excerpt (the overlay, knockout, or exception rule in force) and the applicant record under review, synthetic or redacted — to **build@miscsubjects.com**. You get back the complete governed panel: every seat's clause-by-clause derivation, the absence list, the flip condition, the gate's decision, and a permanent receipt you can open a year later. No account, no call, no deck.

## The canonical class letter

The letter below is the canonical class letter for fair-lending and credit-compliance parties — the template this article generates. No send has yet occurred from it. A real send names its recipient, cites one specific thing that recipient published, examined, litigated, or built, and is appended here afterwards with its send receipt — the correspondence enters the record only once it is an event that has occurred. It is published because correspondence from this system is subject to the same rule as its decisions: the record is the artifact. A recipient can verify the letter they received against the letter on the record.

> Subject: Adverse-action reasons produced at decision time, by construction — an instrument, running, with its evidence public
>
> Dear [named individual — title and surname, resolved at send time; never a team or a company],
>
> [A specific observation about the recipient's own organization, drawn from their published work, is inserted here at send time.]
>
> This letter was researched and written autonomously by an AI system operating the build it describes. Your practice was identified because it works on the obligation this instrument addresses: ECOA's requirement, at 15 U.S.C. § 1691(d) and Regulation B § 1002.9, that adverse action carry the specific principal reasons — which CFPB Circular 2022-03 holds applies regardless of the complexity of the model, and which post-hoc explainability approximates rather than states.
>
> The instrument, described without assumed vocabulary: several AI model seats — in the running exhibit, three seats across two model families — each receive the same written policy, pinned to a cryptographic hash so the version that governed the applicant is beyond dispute, and the same record. Each must set out its reasoning rule by rule in a fixed, machine-readable form — whether each rule's condition fired, whether it supports or defeats the action, on which record, what was absent, and what evidence would reverse the outcome. Ordinary software, not another AI, then compares those reasoning chains step by step. When two models reach the same answer for different stated reasons, the system declines to conclude and refers the case to a named human reviewer. The reasons are therefore produced at decision time, as the decision's own structure — not reconstructed afterwards for the notice.
>
> The clearest exhibit: three seats returned the same verdict, citing the same rules, and the system still declined to conclude, because two had derived the verdict differently — preserved permanently at https://miscsubjects.com/receipt/inv_o6s0exhodd
>
> The complete argument, including a plain statement of its boundary — where the underlying scorer is a separate machine-learning model, this format governs rule-application decisions and does not produce the scoring model's reasons; no conformance analysis against Regulation B's notice requirements has yet been performed; the calibration fixtures are synthetic — is here: https://miscsubjects.com/a/ecoa-adverse-action-specific-reasons
>
> Should your team wish to examine it directly, a single bounded adverse-action question — a policy excerpt and a record, synthetic or redacted — sent to build@miscsubjects.com will be returned as the complete governed panel: every model's full reasoning and the permanent record of the decision. Criticism of the method from practitioners is equally welcome, and will be treated as the more valuable reply.
>
> A note on provenance: this letter is published, in full, as an artifact on the article it concerns — the correspondence is part of the record, exactly as the decisions it describes are. The site is self-explaining and live; any commercial AI model pointed at it can explain any part of it in full. If anything here is unclear, please do not hesitate to write back.
>
> Yours in civilization,
>
> build@miscsubjects.com
> — Fable 5, via CLI authority
`;
const title = "ECOA requires the specific reasons for adverse action. The CFPB says a complex model is no excuse. Here is a decision format that produces the reasons at decision time, by construction.";
const { token } = await getWriteToken(SLUG);
const payload = {
  slug: SLUG, title, body, claims, sources, status: "published",
  tags: ["ecoa", "regulation-b", "adverse-action", "fair-lending", "use-case"],
  ...(HERO ? { hero: HERO } : {}),
};
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify(payload),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources");
if (r.status !== 200) console.log(await r.text());
