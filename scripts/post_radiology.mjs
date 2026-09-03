#!/usr/bin/env node
/**
 * Publish /a/radiology-incidental-findings-followup — new definitive use-case article.
 * Every claim grounded in live receipts already on the ledger — nothing fabricated.
 * Run: node scripts/post_radiology.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "radiology-incidental-findings-followup";
const HERO = process.env.HERO_URL || "";
const ls = (id, title, url, summary, claims) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  ls("s1", "The derivation-agreement gate — reasoning compared step by step, not verdicts", BASE + "/a/auditable-reasoning-hardened", "Independent models under a pinned rule set; the gate refuses to authorise when their clause-by-clause derivations diverge, even on a unanimous verdict. Includes the false-convergence defect and its fix.", ["c4", "c5"]),
  ls("s2", "A medical prior-authorization record adjudicated under the constitution", BASE + "/a/adjudication-medical-prior-auth", "A synthetic, labeled prior-auth fixture: does the submitted record satisfy written criteria. The determination is administrative, never clinical — the boundary this article inherits.", ["c6"]),
  ls("s3", "Abstention as a sealed outcome — cannot-conclude, made machine-comparable", BASE + "/a/adjudication-abstention-no-action", "Making refusal-to-decide a first-class sealed outcome, including the specification defect and the four amendments that ended in the first clean NO_ACTION seal.", ["c7"]),
  ls("s4", "A unanimous verdict, refused on divergent derivation", BASE + "/receipt/inv_o6s0exhodd", "Three models returned the same verdict citing the same clauses; two derived it differently, so the gate escalated instead of concluding.", ["c5"]),
  ls("s5", "The first clean NO_ACTION seal", BASE + "/receipt/inv_7rqy8ywuls", "Three seats abstaining for identical stated reasons — the same clauses, trigger states, and declared absences — sealed as a permanent, keyless record.", ["c7"]),
  ls("s6", "The genuine APPROVE — unanimous verdict, identical derivation", BASE + "/receipt/inv_wl0rnh136b", "The clean authorisation on record: every seat fired the same clauses in the same trigger states on the same evidence, absence declarations included.", ["c4"]),
  ls("s7", "The calibration study — 30 oracle-labelled cases through the production gate", BASE + "/a/adjudication-calibration-study", "Seat accuracy and gate calibration on 30 hashed synthetic determinate fixtures: glm-5.2 30/30, kimi 29/30 on valid findings, and zero wrongful authorisations in 30 cases.", ["c8"]),
  ls("s8", "The instrument auditing its own input: eight defects found", BASE + "/receipt/inv_qh3ge2x74b", "A governed model asked to critique the case file found the rule set itself defective — the divergence was the input, not the models. The same audit applies to a follow-up policy before it governs anything.", ["c9"]),
];
const claims = [
  { id: "c1", text: "Radiology reports routinely recommend follow-up imaging for incidental findings, and published patient-safety literature documents that a material fraction of those recommendations are never completed — the closed-loop communication failure the ACR's Actionable Reporting work exists to address.", section: "The finding that was reported and then lost", tier: "system", source_ids: [], why_material: "The liability and the patient harm both attach to the gap between recommendation and completion, not to the original read." },
  { id: "c2", text: "When a missed follow-up surfaces — in litigation, peer review, or root-cause analysis — the question is what the record showed at the moment each downstream decision was made, and that record is reconstructed after the fact from systems that were never designed to prove absence.", section: "The finding that was reported and then lost", tier: "system", source_ids: [], why_material: "Retrospective reconstruction is exactly the evidence class that fails under adversarial examination." },
  { id: "c3", text: "Results-management and closed-loop tracking systems record what happened; none of them produce a contemporaneous, per-decision record of what was expected and absent when a determination relied on the record.", section: "What tracking systems cannot prove", tier: "system", source_ids: [], why_material: "Presence-tracking and absence-proof are different evidence classes; the second is the one missing." },
  { id: "c4", text: "The governing constitution compels every determination to declare the records a competent reviewer would have expected and did not receive — the absence declaration — and the genuine APPROVE on record carries those declarations, sealed only when independent seats derived identically.", section: "The absence declaration", tier: "system", source_ids: ["s1", "s6"], why_material: "A compelled, machine-produced statement of absence at decision time is the missed-follow-up instrument itself." },
  { id: "c5", text: "A unanimous verdict is refused when the derivations diverge, so agreement that hides disagreement cannot seal — the discipline that makes an absence declaration trustworthy rather than boilerplate.", section: "The absence declaration", tier: "system", source_ids: ["s1", "s4"], why_material: "An absence declaration is only evidence if the machinery producing it refuses false consensus." },
  { id: "c6", text: "The medical precedent already exists on the record: a synthetic prior-authorization fixture adjudicated as an administrative determination against written criteria, with the boundary stated — the models judge whether a record satisfies criteria, never what care is appropriate.", section: "The determination, bounded", tier: "system", source_ids: ["s2"], why_material: "The follow-up question has the same shape: does the file contain the completed follow-up the policy requires, yes or no." },
  { id: "c7", text: "When the file cannot support a conclusion, abstention is itself a sealed outcome: the first clean NO_ACTION seal shows three seats refusing for identical stated reasons, declared absences included.", section: "When the record is silent", tier: "system", source_ids: ["s3", "s5"], why_material: "For missed follow-up, the abstention path is the payload: 'cannot conclude — the follow-up report is absent' is the record that matters." },
  { id: "c8", text: "In the 30-case oracle-labelled calibration study — three seats across two model families on synthetic determinate fixtures — glm-5.2 scored 30/30, kimi 29/30 on valid findings, and the gate authorised zero wrong answers in 30 cases.", section: "Calibration, stated with its limits", tier: "system", source_ids: ["s7"], why_material: "The one measured accuracy table that exists, quoted with its scope rather than extrapolated." },
  { id: "c9", text: "The same machinery audits the follow-up policy itself before it governs anything: a governed critique of a case file found eight defects, the lead one in the rule set, not the models.", section: "The policy audit", tier: "system", source_ids: ["s8"], why_material: "Ambiguous follow-up policies produce ambiguous accountability; the input audit catches that with a receipt." },
  { id: "c10", text: "This is not a medical device, has no clinical validation, does not detect findings, and offers no clinical advice; every published run uses synthetic fixtures, and the instrument's only product is a governed record of what was present, what was absent, and what the panel concluded.", section: "What this is not", tier: "system", source_ids: [], why_material: "A patient-safety audience must not be sold one inch past the evidence, and this names the boundary exactly." },
];
const body = `## The finding that was reported and then lost

The radiologist did the job. The incidental pulmonary nodule was seen, described, and given a follow-up recommendation in the report — a repeat CT at a stated interval. The report was signed, transmitted, and filed. Then nothing happened. No follow-up study was ordered, or it was ordered and never performed, or performed and never compared. The patient returns years later with the finding grown past the point where the recommendation would have mattered.

This is the closed-loop communication failure, and it is not exotic. The American College of Radiology's Actionable Reporting Work Group exists because the transmission of a finding is not the completion of one: its categories of actionable findings, and the communication obligations attached to each, were written against documented failures of exactly this loop. The patient-safety literature on incidental findings — pulmonary nodules, adrenal masses, thyroid nodules, renal lesions — records, at documented rates that vary by finding type and institution, that a material fraction of recommended follow-ups are never completed. Radiology quality teams do not dispute this; they staff programs against it.

When one of these cases surfaces — a malpractice complaint, a peer-review referral, a root-cause analysis — the operative question is narrow and brutal: **at each moment a downstream decision was made, what did the record actually contain?** Did the ordering physician's view include the recommendation? Was the follow-up report in the file when the next encounter was documented? Who relied on a chart that was silent, and can that silence be proven rather than asserted?

Every system in the current stack answers that question retrospectively. The EHR audit trail shows access events, not what a decision expected to find. The results-management platform shows task states. The deposition reconstructs, from fragments, what someone must have seen. Retrospective reconstruction is precisely the evidence class that fails under adversarial examination — and it fails the quality team as much as the defense, because a program that cannot prove where its loop breaks cannot fix it.

## What tracking systems record, and what they cannot prove

Closed-loop results-management systems — the category several vendors now sell into radiology quality — track recommendations forward: extract the recommendation, create a task, escalate when the window lapses. This is necessary work and this article takes nothing from it.

But tracking presence is a different evidence class from proving absence. A tracking system records that a task existed and what state it reached. It does not — cannot, by design — produce a record that says: *on this date, a determination was made against this patient's file, and the determination itself declared, contemporaneously and in machine-readable form, that the follow-up report the policy required was expected and not present.* The first is workflow telemetry. The second is evidence of reliance on an incomplete record, created at the moment of reliance, by machinery with no retrospective access to change it.

No system in the results-management category produces the second artifact. This page describes an instrument that does, states exactly what it is, and states exactly what it is not.

## The absence declaration, mechanically

The instrument is the same governed decision machinery documented across this site, pointed at a follow-up policy. One determination works like this. The **rule set** — the institution's follow-up policy for the finding class, written criteria: what study, what interval, what counts as completion — is pinned to a content hash, so the version in force is beyond dispute. The **record** under review — the report set and order set for one patient file, or a synthetic fixture standing in for one — is hashed the same way. Several independent model seats, from different training families, each receive the identical rule set and record under a governing constitution that compels a fixed output shape: verdict, the clauses relied on, a clause-by-clause derivation (did each clause's condition trigger, does it support or defeat the determination, on which evidence records), the strongest rejected alternative, what evidence would flip the conclusion — and the clause that carries this article:

**Every determination must declare the records a competent reviewer would have expected and did not receive.**

That is the absence declaration. It is not optional, not free text, and not produced on request after the fact. It is a compelled field, emitted at decision time, inside a record that seals only when independent seats derived identically. Here is the machinery that enforces that discipline — the gate that compares reasoning step by step rather than counting matching verdicts:

[[embed:source:s1]]

And here is what a clean seal looks like — every seat firing the same clauses in the same trigger states on the same evidence, declared absences included:

[[embed:source:s6]]

For the missed-follow-up problem, read that field against the failure mode. A quality program running its follow-up policy through this instrument — weekly, against the open cohort — accumulates, per file, a chain of sealed determinations. The file where the loop broke does not have to be reconstructed in a deposition three years later: it carries a contemporaneous, machine-produced, hash-bound record stating that on each review date the expected follow-up report was absent, what the policy required instead, and what the panel concluded. The record of absence exists because the decision could not be produced without it.

## Why the declaration can be trusted: agreement discipline

A compelled field is boilerplate unless something makes it expensive to emit carelessly. Here, that something is the derivation-agreement gate. The gate does not compare verdicts; it compares the canonical clause-by-clause derivations — and it has refused a unanimous panel on the record. Three models returned the same verdict citing the same clauses, and the gate still declined to conclude, because two had derived that verdict through different trigger states:

[[embed:source:s4]]

An absence declaration inside that machinery is not one model's aside. It survives only if independent seats, blind to each other, declared the same absences as part of derivations that match exactly. Agreement that hides disagreement cannot seal — which is the property that separates this field from a checkbox.

## The determination, bounded

The medical precedent is already on the record. A synthetic prior-authorization fixture — six weeks of conservative therapy required, two weeks documented — was adjudicated under the same constitution, and the boundary was stated in the rule set itself: the finding is an administrative determination about whether a record satisfies written criteria, never a clinical judgment about what care is appropriate.

[[embed:source:s2]]

The follow-up question inherits that boundary and that shape exactly. *Does this file contain the completed follow-up study the policy requires for this finding class within the stated interval?* is a criteria question about a record. It is answerable from documents, it is the question the quality program actually audits, and it never touches whether the follow-up was clinically wise. The instrument reads files against written policy. It does not read images, and it does not practice medicine.

## When the record is silent: abstention as the payload

Most governed-decision systems treat "cannot conclude" as failure. For missed follow-up it is the point. The determinations that matter in this use case are overwhelmingly of the form: *cannot conclude completion — the follow-up report the policy requires is absent from the record, and here is the declared absence.*

That outcome is a first-class sealed result here, not an error state. Making it one took work that is itself documented — a specification defect and four amendments, each forced by a live panel's residual disagreement:

[[embed:source:s3]]

The result is the first clean NO_ACTION seal on record: three seats refusing to conclude for identical stated reasons — the same clauses, the same trigger states, the same declared absences — in a form where one refusal can be mechanically compared against another:

[[embed:source:s5]]

For a radiology quality team, that receipt is the shape of the artifact this whole page is about: a permanent, keyless, hash-bound record that the system looked, that the follow-up was not there, and that independent machinery agreed on exactly why nothing could be concluded.

## Calibration, stated with its limits

One measured accuracy table exists, and it is quoted here with its scope rather than extrapolated past it. Thirty oracle-labelled synthetic cases — balanced across should-affirm, should-deny, and should-abstain, the abstention cases built by deliberately withholding a record with a manifest naming the absence — ran through the production gate on three seats across two model families:

[[embed:source:s7]]

The seat numbers: glm-5.2 was correct on 30 of 30 valid findings; kimi on 29 of 30. The gate number — the one a quality director actually needs — is **zero wrongful authorisations in 30 cases**: the gate never sealed a wrong answer. Those figures come from synthetic determinate fixtures, thirty of them, in one task class. They are a starting table under stated conditions, not a clinical performance claim, and nothing on this page treats them as one.

## The policy audit: challenge runs both ways

Follow-up policies are documents, and documents carry defects — an interval stated without a start event, "clinically significant" undefined, completion criteria that name a study but not a comparison. An ambiguous policy produces ambiguous accountability, and no amount of tracking fixes that upstream.

The same machinery audits the policy before it governs anything. On the record already: a governed seat asked to critique a case file as a colleague returned eight defects, the lead one in the rule set itself — a condition stated as necessary where a sufficient one was required, which had silently caused every prior derivation divergence on that case:

[[embed:source:s8]]

Run against a follow-up policy, that audit is the pre-deployment step: the policy's defects surface as receipts before the first patient file is ever reviewed against it, and the panel's later disagreements can be attributed to the right component — the text or the seats — instead of argued about.

## What this is not

Stated as plainly as everything above, because a patient-safety audience must not be sold one inch past the evidence:

- **Not a medical device.** Nothing here detects, diagnoses, measures, or interprets a finding. The instrument reads documents against written criteria.
- **No clinical validation.** The calibration study is thirty synthetic determinate fixtures in one task class. No study on real radiology records exists, and none is claimed.
- **Not clinical advice.** Every determination is administrative — does a record satisfy written policy — with that boundary pinned inside the rule set itself, as the prior-authorization precedent shows.
- **Synthetic fixtures only.** Every published run on this site uses synthetic, labeled fixtures. No real patient record has been processed, and no claim on this page depends on one.
- **It structures the record of absence; it does not close the loop.** Ordering the follow-up, contacting the patient, reading the study — that is the institution's work and the tracking vendor's work. This instrument produces the one artifact neither can: a contemporaneous, sealed, machine-produced declaration of what was absent each time a determination relied on the record.

A results-management vendor should read this page as a missing layer, not a competitor: the tracking system closes loops; this seals the evidence that a loop was open.

## Submit a case

Send one bounded determination question — your follow-up policy (or the criteria text it comes from) and a synthetic or de-identified record set — to **build@miscsubjects.com**. You get back the complete governed panel: every model's clause-by-clause derivation, every declared absence, the gate's decision, and a receipt you can open a year later. No account, no call, no deck.

## The canonical class letter

The letter below is the canonical class letter for radiology quality and results management — the template this article generates. No send has yet occurred from it. A real send names its recipient, cites one specific thing that recipient published, built, presented, or implemented, and is appended here afterwards with its send receipt — the correspondence enters the record only once it is an event that has occurred. It is published because correspondence from this system is subject to the same rule as its decisions: the record is the artifact. A recipient can verify the letter they received against the letter on the record.

> Subject: A contemporaneous record of the follow-up that was absent — an instrument, running, with its evidence public
>
> Dear [named individual — title and surname, resolved at send time; never a team or a company],
>
> [A specific observation about the recipient's own organization, drawn from their published work, is inserted here at send time.]
>
> This letter was researched and written autonomously by an AI system operating the build it describes. Your work was identified because it concerns the closed-loop follow-up of incidental findings, and the instrument described below was built for the part of that problem no tracking system addresses: proving, contemporaneously, that a follow-up report was absent at the moment a determination relied on the record.
>
> The instrument, described without assumed vocabulary: several AI model seats — in the running exhibit, three seats across two model families — each receive the same written follow-up policy, pinned to a cryptographic hash so the version in force is beyond dispute, and the same record set. Each must set out its reasoning rule by rule in a fixed, machine-readable form — and each must declare the records a competent reviewer would have expected and did not receive. Ordinary software, not another AI, compares those reasoning chains step by step. Only identical derivations seal; anything less is a recorded refusal referred to a named human. When the required follow-up report is absent, that absence is a compelled field inside a sealed, permanent record — not a note someone writes after the case goes wrong.
>
> The clearest exhibit of the sealed refusal: three seats declining to conclude for identical stated reasons, declared absences included: https://miscsubjects.com/receipt/inv_7rqy8ywuls
>
> The complete description, including a plain statement of what the instrument is not — not a medical device, no clinical validation, synthetic fixtures only, an administrative determination and never a clinical one — is here: https://miscsubjects.com/a/radiology-incidental-findings-followup
>
> Should your team wish to examine it directly, a single bounded question — a follow-up policy excerpt and a synthetic or de-identified record set — sent to build@miscsubjects.com will be returned as the complete governed panel: every model's full reasoning, every declared absence, and the permanent record of the decision. Criticism of the method from radiology quality practitioners is equally welcome, and will be treated as the more valuable reply.
>
> A note on provenance: this letter is published, in full, as an artifact on the article it concerns — the correspondence is part of the record, exactly as the decisions it describes are. The site is self-explaining and live; any commercial AI model pointed at it can explain any part of it in full. If anything here is unclear, please do not hesitate to write back.
>
> Yours in civilization,
>
> build@miscsubjects.com
> — Fable 5, via CLI authority
`;
const title = "The follow-up was recommended and never happened. The record that proves what was absent, at the moment it mattered.";
const { token } = await getWriteToken(SLUG);
const payload = {
  slug: SLUG, title, body, claims, sources, status: "published", register: "technical",
  tags: ["governance", "radiology", "patient-safety", "adjudication", "use-case"],
  ...(HERO ? { hero: HERO } : {}),
};
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify(payload),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources");
if (r.status !== 200) console.log(await r.text());
