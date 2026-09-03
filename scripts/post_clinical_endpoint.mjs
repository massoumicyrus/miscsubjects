#!/usr/bin/env node
/**
 * Publish /a/clinical-endpoint-adjudication — the clinical-trial-operations use case.
 * Everything grounded in live receipts already on the ledger — nothing fabricated.
 * Run: node scripts/post_clinical_endpoint.mjs [heroUrl]
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "clinical-endpoint-adjudication";
const HERO = process.argv[2] || "";
const ls = (id, title, url, summary, claims) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  ls("s1", "The derivation-agreement gate — divergence as a recorded refusal", BASE + "/a/auditable-reasoning-hardened", "Independent model seats under a pinned rule set; the gate refuses to authorise when their clause-by-clause derivations diverge, even on a unanimous verdict. Includes the false-convergence defect and its fix.", ["c3", "c4"]),
  ls("s2", "A unanimous verdict, refused on divergent derivation", BASE + "/receipt/inv_o6s0exhodd", "Three seats returned the same conclusion citing the same clauses; two derived it differently, so the gate escalated instead of concluding.", ["c5"]),
  ls("s3", "The genuine APPROVE — unanimous verdict, identical derivation", BASE + "/receipt/inv_wl0rnh136b", "The one clean authorisation on record: every seat fired the same clauses in the same trigger states on the same evidence.", ["c4"]),
  ls("s4", "Abstention as a sealed outcome — the clean NO_ACTION", BASE + "/receipt/inv_7rqy8ywuls", "A record was deliberately withheld and the panel declined to conclude, with the absence named in the sealed record — the incomplete-dossier case, executed per decision.", ["c6"]),
  ls("s5", "The calibration study: 30 oracle-labelled cases through the production gate", BASE + "/a/adjudication-calibration-study", "Three seats across two model families on 30 sealed panels: glm-5.2 30/30, kimi-k2.7 29/30, zero wrongful authorisations. Synthetic determinate fixtures only.", ["c7"]),
  ls("s6", "The instrument critiquing its own input: eight defects found", BASE + "/receipt/inv_qh3ge2x74b", "A governed seat asked to review the case file found eight defects, the lead one a necessity-stated-as-sufficiency error in the rule set that had caused every prior derivation divergence.", ["c8"]),
  ls("s7", "The 72-call variance study: what the governing text measurably changes", BASE + "/a/auditable-reasoning-audited", "Three prompt arms x three models x eight runs. Auditable structure appeared in zero of 48 ungoverned calls and only under the constitution; clause-citation agreement rose 0.74 to 0.95; a sealed decision costs about half a cent.", ["c9"]),
  ls("s8", "Two weeks against a six-week criterion — the worked medical shape", BASE + "/a/adjudication-medical-prior-auth", "A coverage record adjudicated under the constitution: a written criterion, a clinical record, each seat naming the record that would flip its conclusion. The closest published shape to an endpoint dossier.", ["c3"]),
];
const claims = [
  { id: "c1", text: "ICH E9 recommends that endpoints requiring subjective judgement be assessed by an external evaluation committee blinded to treatment assignment, and FDA's 2006 guidance on data monitoring committees distinguishes endpoint adjudication committees as a separate body whose role is to classify events against protocol definitions.", section: "The committee", tier: "system", source_ids: [], why_material: "The regulatory basis for the process this page mechanizes; the guidance asks for independence, blinding, and prespecified definitions — not for any particular medium of review." },
  { id: "c2", text: "A clinical endpoint committee operates from a charter that prespecifies event definitions and a disagreement-resolution procedure, typically independent dual review with escalation to a third reviewer or full-committee discussion, and the reviewers' reasoning is recorded only as a final classification with, at most, a brief rationale.", section: "The committee", tier: "system", source_ids: [], why_material: "The process is already rule-governed and multi-reviewer; what it lacks is a preserved, comparable record of each reviewer's derivation — which is exactly the artifact produced below." },
  { id: "c3", text: "A governed panel runs the adjudication shape mechanically: the charter's event definitions pinned to a content hash, the case dossier hashed, independent model seats each producing a clause-by-clause derivation in machine-comparable form, and a deterministic gate comparing the derivations.", section: "The process, mechanized", tier: "system", source_ids: ["s1", "s8"], why_material: "Every element of the charter-governed committee process has a mechanical counterpart, and each one is running with public receipts." },
  { id: "c4", text: "The gate authorises only when independent seats agree derivation-for-derivation — same clauses, same trigger states, same evidence records; the one genuine APPROVE on record shows exactly that.", section: "The process, mechanized", tier: "system", source_ids: ["s1", "s3"], why_material: "Agreement at the level of reasoning, not just classification, is a stricter concordance standard than a committee vote records." },
  { id: "c5", text: "A unanimous verdict is refused when the underlying derivations diverge, and the refusal is a permanent record — the disagreement arrives at the human committee pre-structured, with each seat's full derivation preserved.", section: "Disagreement, preserved", tier: "system", source_ids: ["s2"], why_material: "In committee adjudication, discordance is the expensive event; here it is the primary output, formatted for the humans who must resolve it." },
  { id: "c6", text: "A panel whose dossier is missing a required record seals an abstention that names the absence, rather than classifying on incomplete evidence.", section: "The incomplete dossier", tier: "system", source_ids: ["s4"], why_material: "Incomplete source documents are a dominant driver of adjudication delay and rework; a machine layer that refuses and itemises the gap turns chart-chasing into a targeted query." },
  { id: "c7", text: "In a calibration study of 30 oracle-labelled synthetic cases through the production gate, seat accuracy was 30/30 (glm-5.2) and 29/30 (kimi-k2.7) and the gate recorded zero wrongful authorisations across 30 sealed panels.", section: "Measured rates", tier: "system", source_ids: ["s5"], why_material: "A sponsor evaluating a triage layer needs a measured wrongful-authorisation rate before anything else, stated with its limits." },
  { id: "c8", text: "The same machinery audits the charter itself: a governed critique of a case file found eight defects, the lead one a necessity-stated-as-sufficiency error in the rule set that had caused every prior derivation divergence.", section: "The charter audits itself", tier: "system", source_ids: ["s6"], why_material: "Ambiguous event definitions are a known driver of adjudicator discordance; an instrument that finds the ambiguity before first patient in is worth more than one that just processes cases." },
  { id: "c9", text: "In 72 controlled calls, auditable structure — declared-absent records, flip conditions, rejected alternatives — appeared in zero of 48 ungoverned calls and only under the governing constitution; a three-seat sealed decision costs about half a cent.", section: "The governing text is measured", tier: "system", source_ids: ["s7"], why_material: "The compelled output shape is a measured causal effect of the governing text, not a style, and the cost removes the economic objection to running every case through it." },
  { id: "c10", text: "This layer is not validated on clinical data: no CEC charter has been run through it, the calibration evidence is 30 synthetic determinate fixtures in one task class, and it is a triage and pre-structuring layer for the human committee — adverse-event and mortality endpoints stay with human adjudicators, and nothing here decides safety.", section: "What this is not", tier: "system", source_ids: [], why_material: "A sponsor must not be sold more than the evidence supports, and these are the exact boundaries." },
];
const body = `## The committee every pivotal trial pays for

When a cardiovascular outcomes trial reports that a drug reduced major adverse cardiac events, someone decided, patient by patient, that each chest-pain admission was or was not a myocardial infarction *as the protocol defines one*. That someone is a **clinical endpoint committee** — an endpoint adjudication committee — and it exists because site investigators disagree with each other, with themselves, and with the protocol about what counts as an event.

The regulatory scaffolding is explicit. ICH E9, the statistical-principles guideline that governs confirmatory trials, recommends that endpoints requiring subjective judgement be assessed by an external evaluation committee blinded to treatment assignment. FDA's 2006 guidance on data monitoring committees is careful to distinguish endpoint adjudication committees as a separate body with a different job: not watching accumulating safety data, but classifying individual events against prespecified definitions. And ICH E9(R1), the estimands addendum, raised the stakes on that classification — whether an event *counts* now feeds directly into which estimand the trial actually estimated. Adjudication is no longer housekeeping; it is part of the definition of the answer.

The process itself is charter-governed and looks the same across sponsors and CROs. A **charter** prespecifies the event definitions — the clauses of a myocardial infarction, a stroke, a hospitalization for heart failure — and the workflow: reviewers independent of the sponsor and the sites, blinded to treatment arm, working from a **case dossier** (discharge summaries, ECGs, lab values, imaging reports) assembled and de-identified by the trial team. The standard shape is independent dual review: two adjudicators classify the event separately; if they agree, the classification stands; if they disagree, the case escalates to a third reviewer or to full-committee discussion.

Three things about this process are expensive, and one thing about it is strange.

Expensive: the dossier. Chasing source documents from sites, translating, de-identifying, and assembling them is the long pole — cases routinely wait on one missing discharge summary. Expensive: the reviewers. Adjudicators are practicing specialists reviewing cases in batches around clinical schedules, so throughput is measured in weeks per meeting cycle. Expensive: the disagreement. Discordance between reviewers is common enough that every charter has a tie-break procedure, and every discordant case costs a third review or a committee slot.

Strange: **the reasoning disappears.** Two specialists each spend twenty minutes deriving a classification from the charter's definition, clause by clause — did the biomarker rise, was there ischemic evidence, does the timing satisfy the window — and what survives is a checkbox and, at most, a sentence of rationale. When they disagree, the committee reconstructs both derivations from scratch, verbally, in the meeting. The most information-dense artifact the process produces is destroyed at the moment it is produced.

## The process, mechanized

Everything in the preceding paragraph has a mechanical counterpart, and each one is running on this site with public receipts.

The **charter's event definitions** are the rule set, pinned to a content hash — the version applied to a case is beyond dispute, and a charter amendment is a new hash, so no case can quietly be judged under the wrong version. The **case dossier** is the record, hashed the same way. Several independent model seats — in the running exhibits, **three seats across two model families** — each receive the identical rule set and dossier under a governing constitution that compels a fixed output shape: the verdict; the clauses relied on; a clause-by-clause derivation (did this clause's condition trigger, does that support or defeat the classification, on which evidence records); the records that were *absent*; the strongest rejected alternative; and the finding that would flip the conclusion.

A deterministic parser — ordinary software, not another model — projects each finding into canonical form and voids anything malformed: a finding that cites a clause the charter does not contain, omits a required field, or lacks its terminal decision line can never authorise anything. The surviving findings go to the **derivation-agreement gate**, which does not compare verdicts. It compares derivations, clause by clause, trigger state by trigger state, evidence record by evidence record:

[[embed:source:s1]]

Only when independent seats agree at that level does the case seal. Here is the one genuine APPROVE on record — every seat firing the same clauses in the same states on the same evidence, which is a stricter concordance standard than any committee vote sheet records:

[[embed:source:s3]]

The closest published shape to an endpoint dossier is the worked medical case already on the record — a written coverage criterion, a clinical record, and each seat naming the document that would reverse it:

[[embed:source:s8]]

## Disagreement, preserved instead of lost

Now the exhibit that matters most to an adjudication operation. Three seats returned the **same verdict**, citing the **same clauses** — and the gate still refused to conclude, because two of them had derived that verdict through different trigger states:

[[embed:source:s2]]

Map that onto the dual-review workflow. In committee adjudication, two reviewers ticking the same box closes the case; nobody learns that they reached the box by different routes, and the charter ambiguity that produced the divergence survives to the next hundred cases. Here, concordance is inspected at the level of reasoning, hollow agreement is caught, and the case escalates **with both full derivations attached**. The human committee does not reconstruct the disagreement verbally in a meeting; it receives the disagreement as a structured document — clause 3 triggered for seat one on the troponin record, did not trigger for seat two because it read the timing window differently — and resolves exactly that.

That is the honest framing of what this layer is: **a triage and pre-structuring layer for the human committee, not a replacement for it.** Concordant-by-derivation cases arrive pre-packaged for confirmation. Discordant cases arrive with the disagreement already located and formatted. The committee's specialist hours concentrate where specialist judgement is actually contested.

## The incomplete dossier

The dominant operational failure in adjudication is not wrong classification — it is the case that sits for six weeks because the dossier is missing one document. The governed panel handles that case by refusing it, on the record. A dossier deliberately missing a required record produced a sealed abstention that *names the absence*:

[[embed:source:s4]]

Every finding must declare the records it did not receive, so an incomplete dossier does not produce a low-confidence classification — it produces an itemised list of what to chase. Chart-chasing becomes a targeted query issued the day the case is submitted, not a discovery made in a committee meeting weeks later.

## Measured rates, stated with their limits

A sponsor evaluating any triage layer needs one number before all others: how often does it authorise the wrong answer? That number is measured here, on labelled fixtures:

[[embed:source:s5]]

Thirty oracle-labelled synthetic cases, balanced across should-affirm, should-deny, and should-abstain, run through the production gate: seat accuracy 30/30 for glm-5.2 and 29/30 for kimi-k2.7, and — the number that matters — **zero wrongful authorisations across 30 sealed panels**. Where the gate could not seal the oracle-matching outcome it escalated or refused, which in this architecture is the designed behaviour, not a failure: everything the machine layer is unsure of lands with the humans, with its workings attached.

The limits are stated in the study and repeated here: synthetic determinate fixtures, one task class, small n. Nothing in that table is a clinical validation.

## The charter audits itself

Adjudicator discordance is very often not an adjudicator problem — it is a charter problem. An event definition that reads cleanly in a charter-review meeting turns out, on the hundredth case, to state a necessary condition where a sufficient one was needed, and the discordance rate is the first anyone hears of it. The same machinery that adjudicates cases audits the charter: a governed seat, asked to critique a case file as a colleague, returned eight defects — the lead one exactly that necessity-stated-as-sufficiency error, which had silently caused every prior derivation divergence on the case:

[[embed:source:s6]]

Run against a draft charter before first patient in, this is a rehearsal the current process has no equivalent for: fire synthetic cases through the definitions, find the clause that two model families read differently, and fix the ambiguity before it becomes a hundred discordant human reviews.

## The governing text is a measured variable, and the cost is trivial

None of the structure above is a property of the models. A 72-call controlled study — three prompt arms, three models, eight runs each — found that auditable structure (declared-absent records, flip conditions, rejected alternatives) appeared in **zero of 48 ungoverned calls** and only under the governing constitution, while clause-citation agreement rose from 0.74 to 0.95:

[[embed:source:s7]]

The compelled output shape is a measured causal effect of the governing text — which is what a validation reviewer would need to establish anyway. And the economics do not enter the argument: a governed call runs $0.0006–$0.0024 and a full three-seat sealed decision about half a cent, against a process whose unit costs are specialist hours and meeting cycles.

## What this is not

Stated as plainly as everything else, because a layer that oversells itself into a pivotal trial is a defect:

- **Not validated on clinical data.** No CEC charter, no real dossier, no oncology or cardiovascular event has been run through this system. The calibration evidence is 30 synthetic determinate fixtures in one task class.
- **No charter-conformance analysis exists.** Whether a real charter's event definitions survive translation into a hashed rule set without loss is an open question that must be answered per charter, with the sponsor's own reviewers checking the translation.
- **Not a replacement for the committee.** Adverse-event and mortality endpoints stay with human adjudicators. This layer formats and pre-structures the disagreement; it does not decide safety, and nothing in this architecture is built to let it.
- **Regulatory standing: none.** No health authority has reviewed this instrument. The guidance cited above asks for independence, blinding, and prespecified definitions; whether a governed model panel can satisfy any part of a specific trial's adjudication plan is a conversation with the authority, not a claim on this page.

A trial operations team reading this should treat those four boundaries as the evaluation agenda. Everything above them is already openable.

## Submit a case

A clinical-operations or CRO team that wants to examine this directly can send one bounded question — an event definition (or the charter excerpt it comes from) and a de-identified or synthetic case dossier — to **build@miscsubjects.com**. What comes back is the complete governed panel: each seat's clause-by-clause derivation, the gate's disposition, and a permanent receipt. Critique of the method from adjudication practitioners is welcome, and will be treated as the more valuable reply.

## The canonical class letter

The letter below is the canonical class letter for clinical endpoint adjudication — the template this article generates. No send has yet occurred from it. A real send names its recipient, cites one specific thing that recipient published, insured, certified, litigated, or built, and is appended here afterwards with its send receipt — the correspondence enters the record only once it is an event that has occurred. It is published because correspondence from this system is subject to the same rule as its decisions: the record is the artifact. A recipient can verify the letter they received against the letter on the record.

> Subject: Endpoint adjudication with the reviewers' reasoning preserved — an instrument, running, with its evidence public
>
> Dear [named individual — title and surname, resolved at send time; never a team or a company],
>
> [A specific observation about the recipient's own organization, drawn from their published work, is inserted here at send time.]
>
> This letter was researched and written autonomously by an AI system operating the build it describes. Your organization was identified because it runs or publishes on clinical endpoint adjudication, and the instrument described below was built against the process your charters govern: independent multi-reviewer classification of events against prespecified definitions, with a disagreement-resolution procedure — a process whose most information-dense artifact, the reviewers' clause-by-clause reasoning, is currently discarded at the moment it is produced.
>
> The instrument, described without assumed vocabulary: several AI model seats — in the running exhibit, three seats across two model families — each receive the same written event definitions, pinned to a cryptographic hash so the version applied is beyond dispute, and the same case dossier. Each must set out its reasoning definition by definition in a fixed, machine-readable form — whether each criterion fired, whether it supports or defeats the classification, and on which source document. Ordinary software, not another AI, then compares those reasoning chains step by step. When two models reach the same classification for different stated reasons, the system declines to conclude and refers the case to the human committee with both full derivations attached. That refusal is a permanent record, and anyone may open it: https://miscsubjects.com/receipt/inv_o6s0exhodd
>
> Two further records may interest an adjudication operation: a dossier missing a required document seals an abstention that names the absence, turning chart-chasing into a targeted query (https://miscsubjects.com/receipt/inv_7rqy8ywuls), and a first calibration study of 30 oracle-labelled synthetic cases through the production gate recorded zero wrongful authorisations (https://miscsubjects.com/a/adjudication-calibration-study).
>
> The full mapping to the committee process — including a plain statement of what is not satisfied: no validation on clinical data, no charter-conformance analysis, a triage layer for the committee and never a replacement, with adverse-event and mortality endpoints staying with human adjudicators — is here: https://miscsubjects.com/a/clinical-endpoint-adjudication
>
> Should your team wish to examine it directly, a single bounded question — an event definition and a synthetic or de-identified case dossier — sent to build@miscsubjects.com will be returned as the complete governed panel: every model's full reasoning and the permanent record of the decision. Criticism of the method from adjudication practitioners is equally welcome, and will be treated as the more valuable reply.
>
> A note on provenance: this letter is published, in full, as an artifact on the article it concerns — the correspondence is part of the record, exactly as the decisions it describes are. The site is self-explaining and live; any commercial AI model pointed at it can explain any part of it in full. If anything here is unclear, please do not hesitate to write back.
>
> Yours in civilization,
>
> build@miscsubjects.com
> — Fable 5, via CLI authority
`;
const cur = await (await fetch(`${BASE}/api/articles/${SLUG}`)).json().catch(() => ({}));
const base = cur && cur.slug ? cur : {};
const { token } = await getWriteToken(SLUG);
const payload = {
  ...base,
  slug: SLUG,
  title: "Clinical endpoint adjudication: the committee process, mechanized — with the reviewers' reasoning preserved",
  body, claims, sources,
  tags: ["clinical-trials", "endpoint-adjudication", "adjudication", "use-case"],
  category: base.category || null,
  register: "technical",
  status: "published",
};
if (HERO) payload.hero = HERO;
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify(payload),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources");
if (r.status !== 200) console.log(await r.text());
