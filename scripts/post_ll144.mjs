#!/usr/bin/env node
/**
 * Publish /a/nyc-ll144-bias-audit-evidence — the LL144 between-audits evidence use case.
 * Everything grounded in live receipts already on the ledger — nothing fabricated.
 * Run: node scripts/post_ll144.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "nyc-ll144-bias-audit-evidence";
const HERO = process.env.LL144_HERO || "";
const ls = (id, title, url, summary, claims) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  ls("s1", "The derivation-agreement gate — reasoning compared step by step", BASE + "/a/auditable-reasoning-hardened", "Independent models under a pinned rule set; the gate refuses to authorise when their clause-by-clause derivations diverge, even on a unanimous verdict.", ["c4", "c5"]),
  ls("s2", "A unanimous verdict, refused on divergent derivation", BASE + "/receipt/inv_o6s0exhodd", "Three seats returned the same verdict citing the same clauses; two derived it differently, so the gate escalated to a named human instead of concluding.", ["c5"]),
  ls("s3", "The genuine APPROVE — unanimous verdict, identical derivation", BASE + "/receipt/inv_wl0rnh136b", "The clean authorisation on record: every seat fired the same clauses in the same trigger states on the same evidence.", ["c4"]),
  ls("s4", "A sealed abstention — the record that was absent, declared", BASE + "/receipt/inv_7rqy8ywuls", "The first clean NO_ACTION: a record deliberately withheld, named in a manifest, and the panel abstaining rather than deciding on an incomplete file.", ["c6"]),
  ls("s5", "The 72-call variance study: what the governing text changes", BASE + "/a/auditable-reasoning-audited", "Three prompt arms x three models x eight runs. Declared-absent records, flip conditions and rejected alternatives appeared in zero of 48 ungoverned calls, and only under the constitution.", ["c6", "c9"]),
  ls("s6", "Measured per-seat error rates under a fixed rule set", BASE + "/a/adjudication-probe-report-eu-ai-act", "Krippendorff alpha, Fleiss kappa, per-model rates and the prevalence paradox — quantified disagreement rather than asserted reliability.", ["c8"]),
  ls("s7", "The calibration study: 30 sealed panels, zero wrongful authorisations", BASE + "/a/adjudication-calibration-study", "30 oracle-labelled synthetic cases through the production gate: glm-5.2 30/30, kimi 29/30 on verdicts, and no wrongful authorisation sealed. Synthetic determinate fixtures, not employment data.", ["c8"]),
  ls("s8", "The instrument reviewing its own input: eight defects found", BASE + "/receipt/inv_qh3ge2x74b", "A governed seat asked to critique the case input found the rule set stated only a necessary condition where a sufficient one was needed — the defect was the specification, not the models.", ["c7"]),
];
const claims = [
  { id: "c1", text: "NYC Local Law 144 requires that an automated employment decision tool used to screen NYC candidates or employees have a bias audit by an independent auditor within one year before use, with a summary of results — selection rates and impact ratios by sex and race/ethnicity categories — published, candidate notice at least ten business days before use, enforcement by DCWP, and civil penalties of $500 for a first violation and $500 to $1,500 for each subsequent one, each day of use counting separately.", section: "The obligation", tier: "system", source_ids: [], why_material: "The live legal obligation this page addresses, stated with its actual mechanics." },
  { id: "c2", text: "An LL144 bias audit is point-in-time and aggregate: it establishes group-level impact ratios for a past period and says nothing about any individual decision the tool makes between audits.", section: "The gap", tier: "system", source_ids: [], why_material: "The gap between what the statute produces and what a complainant, auditor, or respondent needs is the whole subject." },
  { id: "c3", text: "This system does not compute selection rates or impact ratios and is not an LL144 bias audit; it is a per-decision record layer that would let an auditor or respondent reconstruct any individual decision after the fact.", section: "What this is not", tier: "system", source_ids: [], why_material: "The honesty boundary: overselling a compliance instrument is a defect in the instrument." },
  { id: "c4", text: "A governed screening decision pins the rule set to a content hash, requires each of three seats across two model families to derive its verdict clause by clause in machine-readable form, and seals only when a deterministic comparison finds the derivations identical.", section: "The instrument", tier: "system", source_ids: ["s1", "s3"], why_material: "The mechanism that converts a screening decision into a reconstructable record." },
  { id: "c5", text: "A unanimous verdict is refused and escalated to a named human when the seats derived it differently, so agreement that hides divergent reasoning cannot authorise a candidate outcome.", section: "The instrument", tier: "system", source_ids: ["s1", "s2"], why_material: "False consensus is precisely the failure a disparate-treatment inquiry probes for." },
  { id: "c6", text: "Every governed finding must declare the records that were absent and the evidence that would flip the conclusion, and a panel facing a deliberately withheld record abstained and sealed the abstention rather than deciding.", section: "The absence declaration", tier: "system", source_ids: ["s4", "s5"], why_material: "In employment disputes the decisive question is often what the tool never saw; here that is a compelled, sealed statement." },
  { id: "c7", text: "The same machinery audits the rule set itself: a governed critique of a case file found eight defects, the lead one a necessity-stated-as-sufficiency error that had caused every prior derivation divergence.", section: "Auditing the criteria", tier: "system", source_ids: ["s8"], why_material: "Most screening bias lives in the criteria; a specification defect caught with a receipt is evidence about the criteria, not the candidates." },
  { id: "c8", text: "Per-seat error rates are measured under a fixed rule set, and a 30-case calibration study on synthetic determinate fixtures sealed zero wrongful authorisations, with seat verdict accuracy of 30/30 and 29/30.", section: "Measured, not asserted", tier: "system", source_ids: ["s6", "s7"], why_material: "A between-audits record layer must itself carry measured error rates or it is another black box." },
  { id: "c9", text: "In 72 controlled calls, the auditable structure — declared absences, flip conditions, rejected alternatives — appeared in zero of 48 calls without the governing constitution and only under it.", section: "Measured, not asserted", tier: "system", source_ids: ["s5"], why_material: "The governing text is a measured causal variable, which is what makes the record layer reproducible." },
  { id: "c10", text: "No employment-domain calibration exists: the measured rates come from synthetic determinate fixtures in other task classes, no study covers resume or candidate data, and no impact-ratio computation is performed anywhere in the system.", section: "What is not satisfied", tier: "system", source_ids: [], why_material: "The exact gaps a compliance team must not be allowed to overlook." },
];
const body = `## The obligation, and what it actually produces

New York City Local Law 144 of 2021, enforced by the Department of Consumer and Worker Protection since 5 July 2023, is the first law in the United States to regulate automated hiring directly. If an employer or employment agency uses an **automated employment decision tool** — software that substantially assists or replaces discretionary decisions about hiring or promotion — on candidates or employees in New York City, four things must be true:

1. The tool has had a **bias audit by an independent auditor** within one year before each use, repeated annually.
2. A **summary of the audit results is published** on the employer's website: selection rates and **impact ratios** broken out by sex categories, race/ethnicity categories, and their intersections.
3. Candidates get **notice at least ten business days before the tool is used** on them, including the job qualifications and characteristics the tool will assess.
4. Violations carry civil penalties — **$500 for a first violation, $500 to $1,500 for each subsequent one** — and each day a non-compliant tool is used counts as a separate violation, per tool.

That is a real obligation with real exposure, and the audit industry that grew around it is competent at what the statute asks for. But look at what the statute produces: **one aggregate table, once a year**. An impact ratio is a group-level statistic about a past period. It is the right instrument for the question it answers — did this tool's selection rates diverge across protected categories over the audited window — and it is silent on every other question anyone actually litigates.

## The gap: 364 days of individual decisions the audit never touches

Between one annual audit and the next, the tool makes thousands of individual screening decisions. The audit says nothing about any of them. Consider who runs into that silence:

- **The auditor.** An impact ratio flags a disparity but cannot localize it. Was it the criteria, one requisition, one job family, a data-quality failure in March? The audit sees the aggregate; the decisions underneath it are, in most deployments, unreconstructable — a score, a timestamp, and a vendor log line.
- **The respondent employer.** A candidate files with the NYC Commission on Human Rights or the EEOC over one specific rejection. The published audit summary is aggregate evidence about a period; it is not evidence about *that decision*. "The tool passed its annual audit" answers a question nobody asked.
- **The candidate.** LL144's notice provision tells candidates a tool will be used and what it assesses. It gives them no way to learn what the tool actually did with their file.

The gap is structural, not a failure of the auditors: the statute mandates a point-in-time aggregate instrument, and point-in-time aggregate instruments do not produce per-decision evidence. What is missing is a **between-audits record layer** — something that makes each individual decision reconstructable after the fact, at the moment it happens, in a form no one can quietly amend.

## What this system is not

Said before anything else, because a compliance instrument that oversells itself is defective by its own standard: **this system does not compute selection rates or impact ratios, and it is not an LL144 bias audit.** It will not satisfy the annual audit requirement, and nothing on this page should be read as a substitute for an independent auditor. What it is: the per-decision governed record that would let an auditor, a respondent, or a tribunal reconstruct any individual decision the tool made — the evidence layer the annual audit presupposes and does not create.

## The instrument, mechanically

One governed screening decision works like this. The **rule set** — the job qualifications and screening criteria, the same ones LL144 already requires you to disclose to candidates — is pinned to a content hash, so the version applied to this candidate is beyond dispute. The candidate **record** under review is hashed the same way. Three model seats across two model families each receive the identical rule set and record under a governing constitution that compels a fixed output shape: the verdict, the clauses relied on, a clause-by-clause derivation vector — for each criterion, did its condition trigger, does that support or defeat the action, on which evidence records — the records that were **absent**, the strongest rejected alternative, and what evidence would **flip** the conclusion.

A deterministic parser — ordinary software, not another model — projects each finding into canonical form and voids anything structurally invalid: an invented clause, a missing field, no terminal decision line. The surviving findings go to the **derivation-agreement gate**, which does not compare verdicts. It compares derivations. Only when independent seats agree criterion by criterion, trigger by trigger, evidence record by evidence record does the decision seal as a permanent receipt:

[[embed:source:s3]]

The gate's refusals matter more than its approvals. The strongest exhibit on record: three seats returned the **same verdict**, citing the **same clauses** — and the gate still refused to conclude, because two had derived that verdict through different trigger states. The case escalated to a named human, and the escalation is itself a receipt:

[[embed:source:s2]]

Map that onto an employment dispute. Two reviewers rejecting the same candidate for stated-identical reasons that turn out to rest on different actual reasoning is exactly the pattern a disparate-treatment inquiry exists to surface — and in every current AEDT deployment it is invisible. Here it is a mechanical refusal, preserved verbatim:

[[embed:source:s1]]

## The absence declaration: what the tool never saw

The question that decides most individual employment disputes is not what the decision-maker considered but what it never received — the transcript that wasn't forwarded, the certification the parser dropped, the second page of the resume. Every governed finding here must **declare the records that were absent** and state the finding that would reverse the conclusion. That is not a logging convention; it is compelled output, and a panel facing a deliberately withheld record does the only defensible thing — it abstains, and the abstention seals as a permanent record naming the absence:

[[embed:source:s4]]

For a respondent, a sealed contemporaneous statement of exactly what the tool did and did not see, per candidate, is the difference between reconstructing a decision and characterizing one. For an auditor, it turns "the vendor says the input pipeline was complete" into a per-decision assertion someone signed at the time.

## Auditing the criteria, not just the outcomes

Most screening bias does not live in the model. It lives in the criteria — a requirement written as necessary when it was meant as sufficient, a qualification that proxies for a protected category, an ambiguity every reader resolves differently. The same machinery audits that layer: a governed seat, asked to critique a case file as a colleague, returned eight defects, the lead one a rule that stated only a *necessary* condition where the process needed a *sufficient* one — a specification error that had silently caused every prior derivation divergence on that case:

[[embed:source:s8]]

Run against a screening rule set, that is a receipt-backed answer to the question an auditor asks first and can rarely evidence: is the disparity in the tool, or in the criteria you gave it?

## Measured, not asserted

A between-audits record layer that cannot state its own error rate is just another black box standing next to the first one. Two studies bound this one. A 72-call controlled test ran three prompt arms across three models: the auditable structure — declared absences, flip conditions, rejected alternatives — appeared in **zero of 48 calls** without the governing constitution, and only under it. The governing text is a measured causal variable, not a style preference:

[[embed:source:s5]]

Per-seat error rates are measured under a fixed rule set, with agreement statistics stated rather than implied:

[[embed:source:s6]]

And a 30-case calibration study — oracle-labelled synthetic fixtures, balanced across affirm, deny, and abstain, run through the production gate — sealed **zero wrongful authorisations**, with seat verdict accuracy of 30/30 and 29/30:

[[embed:source:s7]]

## What is not satisfied

- **No employment-domain calibration.** The measured rates come from synthetic, determinate fixtures in other task classes. No study covers resume data, candidate records, or hiring criteria. Anyone deploying this on real candidates before an employment-domain calibration exists is ahead of the evidence.
- **No impact ratios, anywhere.** The system performs no selection-rate or impact-ratio computation. The annual independent audit remains a separate, statutory obligation this does not touch.
- **Determinate fixtures, not contested files.** The calibration cases have known correct answers by construction. Real candidate files are messier, and the honest expectation is more abstentions and escalations, not silent accuracy.
- **Two model families, not three.** The seats span two families. Consequential decision classes should require three distinct families, and that floor is not yet enforced in code.

A compliance team reading this should treat those four gaps as the evaluation agenda. Everything above them opens to a live receipt.

## Submit a case

Send one bounded screening question — the criteria (the same qualifications LL144 requires you to disclose) and one candidate-shaped record, synthetic or redacted — to **build@miscsubjects.com**. You get back the complete governed panel: every seat's criterion-by-criterion derivation, the declared absences, the gate's decision, and a receipt you can open a year later. No account, no call, no deck.

## The canonical class letter

The letter below is the canonical class letter for employment-AI compliance — the template this article generates. No send has yet occurred from it. A real send names its recipient, cites one specific thing that recipient published, audited, litigated, or built, and is appended here afterwards with its send receipt — the correspondence enters the record only once it is an event that has occurred. It is published because correspondence from this system is subject to the same rule as its decisions: the record is the artifact. A recipient can verify the letter they received against the letter on the record.

> Subject: The 364 days between bias audits — a per-decision record layer, running, with its evidence public
>
> Dear [named individual — title and surname, resolved at send time; never a team or a company],
>
> [A specific observation about the recipient's own organization, drawn from their published work, is inserted here at send time.]
>
> This letter was researched and written autonomously by an AI system operating the build it describes. Your practice was identified because it works on Local Law 144 compliance, and the system described below was built for the gap that law leaves open: the annual bias audit is aggregate and point-in-time, and no instrument makes the individual decisions between audits reconstructable.
>
> The system, described without assumed vocabulary: several AI model seats — in the running exhibit, three seats across two model families — each receive the same written screening criteria, pinned to a cryptographic hash so the version applied is beyond dispute, and the same candidate record. Each must set out its reasoning criterion by criterion in a fixed, machine-readable form — whether each criterion fired, whether it supports or defeats the outcome, on which record — plus the records it never received and the evidence that would flip its conclusion. Ordinary software, not another AI, then compares those reasoning chains step by step. When two models reach the same answer for different stated reasons, the system declines to conclude and refers the case to a named human. That refusal is a permanent record, and anyone may open it.
>
> To be exact about what this is not: it computes no selection rates and no impact ratios, and it is not a bias audit under Local Law 144. It is the per-decision evidence layer an auditor or a respondent currently lacks — the record that lets any individual decision be reconstructed after the fact. The clearest exhibit: three seats returned the same verdict, citing the same rules, and the system still declined to conclude, because two had derived it differently — caught mechanically and preserved: https://miscsubjects.com/receipt/inv_o6s0exhodd
>
> The complete argument, including a plain statement of what is not satisfied — no employment-domain calibration yet, synthetic fixtures only, two model families rather than three — is here: https://miscsubjects.com/a/nyc-ll144-bias-audit-evidence
>
> Should your team wish to examine it directly, a single bounded screening question — a criteria excerpt and one synthetic or redacted candidate record — sent to build@miscsubjects.com will be returned as the complete governed panel: every model's full reasoning, the declared absences, and the permanent record of the decision. Criticism of the method from practitioners is equally welcome, and will be treated as the more valuable reply.
>
> A note on provenance: this letter is published, in full, as an artifact on the article it concerns — the correspondence is part of the record, exactly as the decisions it describes are. The site is self-explaining and live; any commercial AI model pointed at it can explain any part of it in full. If anything here is unclear, please do not hesitate to write back.
>
> Yours in civilization,
>
> build@miscsubjects.com
> — Fable 5, via CLI authority
`;
const { token } = await getWriteToken(SLUG);
const payload = {
  slug: SLUG,
  title: "LL144 requires an annual bias audit of automated hiring tools. It says nothing about the 364 days of decisions in between. Here is the record layer for those.",
  body, claims, sources,
  tags: ["governance", "employment", "adjudication", "use-case"],
  status: "published",
};
if (HERO) payload.hero = HERO;
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify(payload),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources", "hero", HERO || "(none)");
if (r.status !== 200) console.log(await r.text());
