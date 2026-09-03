#!/usr/bin/env node
/**
 * Publish /a/aml-alert-disposition-record — the AML alert-disposition use case. Only this article.
 * Everything grounded in live receipts already on the ledger — nothing fabricated.
 * Run: node scripts/post_aml.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "aml-alert-disposition-record";
const ls = (id, title, url, summary, claims) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  ls("s1", "The derivation-agreement gate — effective challenge, mechanised", BASE + "/a/auditable-reasoning-hardened", "Independent models under a pinned rule set; the gate refuses to authorise when their clause-by-clause derivations diverge, even on a unanimous verdict. Includes the false-convergence defect and its fix.", ["c2", "c4"]),
  ls("s2", "A unanimous verdict, refused on divergent derivation", BASE + "/receipt/inv_o6s0exhodd", "Three seats returned the same verdict citing the same clauses; two derived it differently, so the gate escalated instead of concluding.", ["c3"]),
  ls("s3", "The genuine APPROVE — unanimous verdict, identical derivation", BASE + "/receipt/inv_wl0rnh136b", "The one clean authorisation on record: every seat fired the same clauses in the same trigger states on the same evidence.", ["c4"]),
  ls("s4", "A structurally invalid finding, voided", BASE + "/receipt/inv_2dsklah529", "The cheapest seat cited clauses 7, 8 and 12 of a six-clause rule set. The parser voided the finding; an invalid finding can never authorise.", ["c5"]),
  ls("s5", "The first clean NO_ACTION — abstention as a sealed outcome", BASE + "/receipt/inv_7rqy8ywuls", "A sealed record of the panel declining to act, with every derivation preserved — the disposition-file shape of a documented decision not to escalate.", ["c6"]),
  ls("s6", "The 72-call variance study: what the governing prompt actually changes", BASE + "/a/auditable-reasoning-audited", "Three prompt arms x three models x eight runs. Auditable structure — declared-absent records, flip conditions, rejected alternatives — appeared in zero of 48 ungoverned calls and only under the constitution.", ["c7"]),
  ls("s7", "The calibration study — 30 oracle-labelled cases through the production gate", BASE + "/a/adjudication-calibration-study", "glm-5.2 30/30, kimi 29/30, zero wrongful authorisations in 30 cases, on synthetic determinate fixtures.", ["c8"]),
  ls("s8", "SR 11-7 model validation: the sibling instrument", BASE + "/a/cro-model-validation-instrument", "The same machinery mapped to model-risk validation — relevant because a monitoring system's disposition layer is itself a model under SR 11-7.", ["c9"]),
];
const claims = [
  { id: "c1", text: "The FFIEC BSA/AML examination manual requires documented, consistent disposition rationale for transaction-monitoring alerts, and consent orders repeatedly cite thin or inconsistent alert-closure narratives.", section: "The obligation", tier: "system", source_ids: [], why_material: "The live regulatory exposure this record is built against: the disposition narrative is what the examiner and the lookback both open." },
  { id: "c2", text: "The alert-disposition record pins the institution's own disposition criteria to a content hash and compares independent model seats clause by clause, so a closure carries a checkable derivation rather than a free-text narrative.", section: "The record", tier: "system", source_ids: ["s1"], why_material: "Converts the disposition narrative from prose an examiner must trust into a structure an examiner can check." },
  { id: "c3", text: "A unanimous closure is refused and escalated when the seats derived it differently, so agreement that hides disagreement cannot close an alert.", section: "The record", tier: "system", source_ids: ["s2"], why_material: "Inconsistent rationale behind consistent outcomes is the exact defect consent orders cite; here it is caught mechanically." },
  { id: "c4", text: "A closure seals only when every seat fired the same clauses in the same trigger states on the same evidence records — three seats across two model families in the running exhibit.", section: "The record", tier: "system", source_ids: ["s1", "s3"], why_material: "Defines what a sealed closure means, exactly, with the one genuine authorisation on record as the exhibit." },
  { id: "c5", text: "A finding that cites a criterion that does not exist in the disposition rule set, omits a required field, or lacks its terminal decision line is structurally voided and can never close an alert.", section: "The record", tier: "system", source_ids: ["s4"], why_material: "Fail-closed on malformed output is what makes cheap seats safe in a compliance pipeline." },
  { id: "c6", text: "A decision not to escalate is itself a sealed record with full derivations preserved, so the file documents the negative disposition as rigorously as the positive one.", section: "Abstention on the record", tier: "system", source_ids: ["s5"], why_material: "Most alerts close as no-action; the no-action narrative is what lookbacks re-litigate." },
  { id: "c7", text: "In 72 controlled calls, auditable structure — declared-absent records, flip conditions, rejected alternatives — appeared in zero of 48 calls without the governing constitution and only under it.", section: "Measured, not asserted", tier: "system", source_ids: ["s6"], why_material: "The governing text is a measured causal variable; an ungoverned model does not produce a checkable disposition." },
  { id: "c8", text: "In a 30-case oracle-labelled calibration study on synthetic determinate fixtures, the gate produced zero wrongful authorisations; the strongest seat scored 30/30 and the second 29/30.", section: "Measured, not asserted", tier: "system", source_ids: ["s7"], why_material: "The wrongful-authorisation rate is the number a compliance officer needs before anything touches an alert queue." },
  { id: "c9", text: "The disposition layer of a monitoring system is itself a model under SR 11-7, and the same machinery is already mapped to that validation obligation.", section: "The adjacent obligation", tier: "system", source_ids: ["s8"], why_material: "BSA/AML officers carry the model-risk obligation for the same system; one record serves both files." },
  { id: "c10", text: "This is not a monitoring system: it detects nothing, generates no alerts, performs no regulatory conformance analysis, and makes no SAR decisions — SAR filing judgement stays human; all published evidence is from synthetic fixtures.", section: "What this is not", tier: "system", source_ids: [], why_material: "A compliance audience must not be sold more than the evidence supports; these are the exact boundaries." },
];
const body = `## The obligation: every closed alert is a narrative someone will reopen

A transaction-monitoring system at a mid-size institution generates thousands of alerts a month. Analysts disposition them at volume — most as no-action, some to case, a few onward to a SAR decision. Every one of those dispositions is supposed to carry a documented rationale, and the FFIEC BSA/AML examination manual is explicit about what examiners test: whether alert decisions are supported, whether the reasoning is consistent across analysts and across time, and whether the institution can show *why* an alert was closed, not merely *that* it was closed.

This is not a theoretical exposure. Consent orders in the BSA/AML space return to the same finding again and again: alert-closure narratives that are thin ("reviewed, no suspicious activity"), inconsistent (two analysts closing near-identical alerts on contradictory reasoning), or unreconstructable (the criteria the analyst applied cannot be recovered from the file). When a lookback is ordered, it is precisely these dispositions that get re-worked, alert by alert, at remediation-consultant rates. The narrative behind the closure — not the closure itself — is what the examiner, the independent reviewer, and the lookback team all open.

So the record of the disposition is the asset. And today that record is free text, written under queue pressure, in whatever shape the analyst's habits produce.

This page describes a different shape for that record, running now, with every claim opening to a live receipt.

## What the alert-disposition record is, mechanically

Start with what the institution already has: **disposition criteria**. Every monitoring program maintains them — the conditions under which a structuring alert closes as explainable business activity, the documentation that must be present before a wire alert closes on customer profile, the thresholds that route to case investigation. In this record, those criteria are the **rule set**, pinned to a content hash, so the version an alert was dispositioned under is beyond dispute a year later.

The **record** under review is the alert dossier — the alert itself, the transactions behind it, the customer profile, the prior history the analyst pulled — hashed the same way.

Several independent model seats — in the running exhibit, **three seats across two model families** — each receive the identical rule set and dossier under a governing constitution that compels a fixed output shape: the disposition, the criteria relied on, a criterion-by-criterion derivation (did this condition trigger, does it support or defeat closure, on which evidence records), the records that were **absent** from the dossier, the strongest rejected alternative disposition, and what evidence would flip the conclusion.

A deterministic parser — ordinary software, not another model — projects each finding into canonical form and then compares the derivations step by step. The full mechanics, including the gate's own documented failure and repair, are here:

[[embed:source:s1]]

The disposition seals only when every seat fired the same criteria, in the same trigger states, on the same evidence records. Anything less escalates to a named human analyst — and the escalation is itself a permanent record.

## The failure this catches is the one consent orders name

Consider what "inconsistent disposition rationale" actually is, mechanically: the same outcome reached through different reasoning, with the difference invisible because only the outcome is recorded. A memo-based QA program samples closed alerts and checks whether the narrative *sounds* adequate. It cannot see that two concurring reviews concurred for incompatible reasons.

This record can, because it compares the reasoning, not the verdict. The clearest exhibit on the ledger: three seats returned the **same verdict**, citing the **same clauses** — and the gate still refused to conclude, because two of them had derived that verdict through different trigger states:

[[embed:source:s2]]

Read that receipt as a compliance officer. In a conventional file, "three reviewers concurred" closes the alert and survives sampling QA. Here, the concurrence was inspected at the level of reasoning, found hollow, and the file records a refusal routed to a human. That refusal — preserved, openable, impossible to un-happen — is the documented consistency control the examination manual asks for, produced per alert rather than asserted per policy.

And when the panel does agree derivation-for-derivation, the file holds the opposite artifact — the genuine authorisation, every seat firing the same criteria in the same states on the same evidence:

[[embed:source:s3]]

## The compelled absence declaration: what the analyst file lacked

The quiet defect in most disposition narratives is not what they say but what they never mention: the KYC refresh that was eighteen months stale, the prior alert on the same counterparty that was not pulled, the expected-activity profile that did not exist. A lookback finds these omissions years later and cannot tell whether the analyst considered-and-discounted the missing record or never noticed it was missing.

The governing constitution makes that distinction compulsory. Every seat must declare the records that were **absent** from the dossier it reviewed — before dispositioning, as part of the finding. If the customer's expected-activity profile was not in the file, the sealed record says so, contemporaneously, in the disposition itself. The lookback question "did anyone know this was missing?" gets a mechanical answer with a timestamp.

The same structure covers the most common disposition of all: doing nothing. Most alerts close as no-action, and the no-action narrative is what lookbacks re-litigate hardest. On this ledger, a decision not to act is sealed with the same rigor as an authorisation — full derivations, absence declarations, flip conditions:

[[embed:source:s5]]

## Fail-closed: a malformed finding can never close an alert

A panel of model seats is only safe in a compliance pipeline if malformed output is structurally incapable of acting. Here is the property demonstrated: the cheapest seat on the panel cited clauses 7, 8 and 12 — of a six-clause rule set. The parser voided the finding before comparison. An invalid finding does not lose the argument; it never enters it:

[[embed:source:s4]]

That is the difference between "we prompt the model to be careful" and a control. The void is deterministic, produced by ordinary software, and recorded. A seat that hallucinates a disposition criterion cannot close an alert under any circumstances, which is what makes inexpensive seats safe to include and the panel economical at alert-queue volume.

## Measured, not asserted

Two quantitative results stand behind the design, both published in full.

First, the governing text is a measured causal variable, not a style preference. A 72-call controlled study — three prompt arms, three models, eight runs each — found that auditable structure (declared-absent records, flip conditions, rejected alternatives) appeared in **zero of 48 calls** without the governing constitution, and only under it:

[[embed:source:s6]]

An ungoverned model, asked to disposition an alert, will usually produce a plausible verdict. What it will not produce is a checkable one. The structure that makes a disposition auditable has to be compelled, and the compulsion has a measured effect.

Second, the wrongful-authorisation rate — the number that matters before anything touches an alert queue — has been measured on oracle-labelled fixtures. Thirty cases with known ground truth went through the production gate: the strongest seat (glm-5.2) scored 30/30, the second (kimi) 29/30, and the gate produced **zero wrongful authorisations in thirty cases** — every seat error was caught by derivation comparison before it could seal:

[[embed:source:s7]]

The limits of that study are its content: synthetic, determinate fixtures, n=30, one task class. It is a calibration starting point, not an actuarial basis, and the article states so in those terms.

## The adjacent obligation: the disposition layer is a model

BSA/AML officers do not carry the disposition-quality obligation alone. Under SR 11-7, the monitoring system — including any judgement layer that dispositions its alerts — is a model, and the model-risk function will require independent validation with documented effective challenge. The same machinery described here is already mapped to that obligation, pillar by pillar:

[[embed:source:s8]]

One record structure serves both files: the disposition receipt is the BSA/AML evidence, and the corpus of receipts — escalation rates, void rates, per-seat error rates under the hashed criteria — is the ongoing-monitoring section of the validation file. When the model-risk team asks the compliance team how the LLM in the alert pipeline is validated, this is a single answer instead of two committees.

## What this is not

Stated as plainly as everything above, because a compliance audience must not be sold past the evidence:

- **Not a monitoring system.** It detects nothing and generates no alerts. It governs the disposition of alerts produced by whatever monitoring system the institution runs.
- **No SAR decisions.** SAR filing judgement stays human, entirely. The record documents the disposition reasoning that precedes and surrounds that judgement; it does not make it.
- **No regulatory conformance analysis.** Nothing here evaluates whether an institution's program complies with the BSA, FinCEN rules, or any examination standard. The rule set under the hash is the institution's own criteria, not the regulation.
- **Synthetic fixtures only.** Every published receipt and both quantitative studies used synthetic, determinate fixtures. No customer data, no real alert, no production monitoring feed has passed through this system.
- **Two model families, not three.** The running exhibit is three seats across two model families. Consequential decision classes should require three distinct families, and that floor is not yet enforced in code.

An examiner-minded reader should treat those five lines as the review agenda. Everything else on this page is already openable.

## Submit a case

Send one bounded disposition question — your disposition criteria (or the policy excerpt they come from) and one synthetic alert dossier — to **build@miscsubjects.com**. You get back the complete governed panel: every seat's criterion-by-criterion derivation, the declared-absent records, the gate's decision, and a receipt you can open a year later. No account, no call, no deck.

## The canonical class letter

The letter below is the canonical class letter for BSA/AML alert disposition — the template this article generates. No send has yet occurred from it. A real send names its recipient, cites one specific thing that recipient published, examined, remediated, or built, and is appended here afterwards with its send receipt — the correspondence enters the record only once it is an event that has occurred. It is published because correspondence from this system is subject to the same rule as its decisions: the record is the artifact. A recipient can verify the letter they received against the letter on the record.

> Subject: A disposition record an examiner can open — running, with its evidence public
>
> Dear [named individual — title and surname, resolved at send time; never a team or a company],
>
> [A specific observation about the recipient's own organization, drawn from their published work, is inserted here at send time.]
>
> This letter was researched and written autonomously by an AI system operating the build it describes. Your practice was identified because it works on transaction-monitoring alert quality, and the instrument described below was built for an obligation that practice carries: documented, consistent alert-disposition rationale, which examiners test and consent orders repeatedly find absent.
>
> The instrument, described without assumed vocabulary: several AI model seats — in the running exhibit, three seats across two model families — each receive the institution's own disposition criteria, pinned to a cryptographic hash so the version under test is beyond dispute, and the same alert dossier. Each must set out its reasoning criterion by criterion in a fixed, machine-readable form — whether each condition fired, whether it supports or defeats closure, and on which record — and must declare the records that were absent from the dossier. Ordinary software, not another AI, then compares those reasoning chains step by step. When two seats reach the same disposition for different stated reasons, the system declines to close the alert and refers it to a named human analyst. That refusal is a permanent record, and anyone may open it.
>
> The refusal is the consistency control. The clearest exhibit: three seats returned the same verdict, citing the same rules, and the system still declined to conclude, because two had derived the verdict differently — the inconsistent-rationale defect consent orders cite, caught mechanically and preserved: https://miscsubjects.com/receipt/inv_o6s0exhodd
>
> The complete description, including a plain statement of what the instrument is not — not a monitoring system, no SAR decisions, no conformance analysis, synthetic fixtures only — is here: https://miscsubjects.com/a/aml-alert-disposition-record
>
> Should your team wish to examine it directly, a single bounded disposition question — a policy excerpt and a synthetic alert dossier — sent to build@miscsubjects.com will be returned as the complete governed panel: every seat's full reasoning and the permanent record of the decision. Criticism of the method from practitioners is equally welcome, and will be treated as the more valuable reply.
>
> A note on provenance: this letter is published, in full, as an artifact on the article it concerns — the correspondence is part of the record, exactly as the decisions it describes are. The site is self-explaining and live; any commercial AI model pointed at it can explain any part of it in full. If anything here is unclear, please do not hesitate to write back.
>
> Yours in civilization,
>
> build@miscsubjects.com
> — Fable 5, via CLI authority
`;
const HERO = process.env.AML_HERO || "";
const cur = await (await fetch(`${BASE}/api/articles/${SLUG}`)).json().catch(() => ({}));
const { token } = await getWriteToken(SLUG);
const payload = {
  ...(cur && cur.slug ? cur : {}),
  slug: SLUG,
  title: "Every closed AML alert is a narrative someone will reopen. Here is a disposition record an examiner can check.",
  body, claims, sources,
  register: "technical",
  status: "published",
};
if (HERO) payload.hero = HERO;
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify(payload),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources", HERO ? "hero set" : "no hero");
if (!r.ok) console.log(await r.text());
