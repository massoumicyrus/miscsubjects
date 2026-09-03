#!/usr/bin/env node
/**
 * Publish /a/peer-review-derivation-record — new definitive use-case article
 * for scholarly-publishing innovators. Only this article.
 * Run: node scripts/post_peer_review.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "peer-review-derivation-record";
const HERO = process.env.HERO_URL || "";
const ls = (id, title, url, summary, claims) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const ext = (id, title, publisher, url, summary, claims) => ({ id, type: "web", title, publisher, url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  ext("s1", "Inconsistency in Conference Peer Review: Revisiting the 2014 NeurIPS Experiment", "arXiv (Cortes & Lawrence, 2109.09774)", "https://arxiv.org/abs/2109.09774", "The 2014 NIPS organizers routed 10% of submissions through two independent programme committees. The committees disagreed on 25.9% of the duplicated papers; given the ~22.5% acceptance rate, roughly half to 57% of the papers one committee accepted were rejected by the other.", ["c1"]),
  ext("s2", "The NeurIPS 2021 Consistency Experiment", "arXiv (Beygelzimer, Dauphin, Liang & Wortman Vaughan, 2306.03262)", "https://arxiv.org/abs/2306.03262", "The 2014 experiment repeated at ~10x scale: 882 duplicated papers through two committees. Disagreement on 23% of duplicated papers; about half of the papers accepted by one committee were rejected by the other. The arbitrariness did not improve in seven years.", ["c1", "c2"]),
  ls("s3", "The derivation-agreement gate — effective challenge, mechanised", BASE + "/a/auditable-reasoning-hardened", "Independent models under a pinned rule set; a deterministic parser projects each finding into canonical per-clause derivation tuples; the gate refuses to conclude when derivations diverge, even on a unanimous verdict.", ["c4", "c5"]),
  ls("s4", "Same verdict, different derivations — the refusal receipt", BASE + "/receipt/inv_o6s0exhodd", "Three seats returned the same verdict citing the same clauses; two derived it through different trigger states; the gate escalated instead of concluding. The exhibit: agreement inspected at the level of reasoning and found hollow.", ["c6"]),
  ls("s5", "The genuine authorisation — identical derivations", BASE + "/receipt/inv_wl0rnh136b", "The clean seal on record: every seat fired the same clauses in the same trigger states on the same evidence records.", ["c6"]),
  ls("s6", "The calibration study — 30 oracle-labelled cases through the production gate", BASE + "/a/adjudication-calibration-study", "Seat accuracy on synthetic determinate fixtures: glm-5.2 30/30, kimi-k2.7 29/30; zero wrongful authorisations at the gate across all 30 cases; escalation counted as deferral cost, not decision error.", ["c7"]),
  ls("s7", "Abstention as a sealed outcome", BASE + "/a/adjudication-abstention-no-action", "The first clean NO_ACTION: a rule set that licenses no action produces a sealed abstention, with the spec-defect arc (four amendments) that got there. Receipt inv_7rqy8ywuls.", ["c8"]),
  ls("s8", "The instrument reviewing its own input — eight defects found", BASE + "/receipt/inv_qh3ge2x74b", "A governed seat asked to critique the case file found the rule set stated a necessary condition where a sufficient one was needed — the divergence was the input, not the reviewers.", ["c9"]),
];
const claims = [
  { id: "c1", text: "In the 2014 NIPS consistency experiment, two independent committees disagreed on 25.9% of duplicated submissions — meaning roughly half or more of the papers one committee accepted were rejected by the other — and the 2021 repeat at ten times the scale found essentially the same arbitrariness (23% disagreement, about half of accepted papers rejected by the other committee).", section: "The measured defect", tier: "system", source_ids: ["s1", "s2"], why_material: "The field's own organizers measured the defect twice, seven years apart, and it did not move." },
  { id: "c2", text: "The consistency experiments measured how often committees disagree, but the review record itself does not capture why they disagreed at any comparable level — the disagreement is visible only as a binary outcome, never as a divergence between stated derivations.", section: "The measured defect", tier: "system", source_ids: ["s2"], why_material: "The missing artifact is the WHY, and no reform of scores or forms produces it." },
  { id: "c3", text: "A venue's checkable criteria — completeness of reporting, claims-versus-evidence structure, required disclosures — can be pinned to a content hash as a rule set, and a manuscript's checkable properties recorded against it, without touching novelty or significance.", section: "The governed format applied", tier: "system", source_ids: [], why_material: "Scopes the claim to the slice where rule application is honest." },
  { id: "c4", text: "Under the governing constitution, each reviewing seat must emit a fixed machine-readable derivation: per criterion, whether its condition triggered, whether it supports or defeats acceptance of the checked property, and on which evidence in the manuscript — and a deterministic parser voids any finding that invents a criterion or omits a required field.", section: "The governed format applied", tier: "system", source_ids: ["s3"], why_material: "Machine-comparable review findings require a compelled shape, not reviewer goodwill." },
  { id: "c5", text: "The derivation-agreement gate compares derivations, not verdicts: two reviews that reach the same recommendation for different stated reasons are recorded as divergent, and the divergence itself becomes the artifact.", section: "Disagreement becomes a record", tier: "system", source_ids: ["s3"], why_material: "Converts NeurIPS-style noise into an inspectable object." },
  { id: "c6", text: "Both halves of the phenomenon exist as live receipts: a unanimous verdict refused because two seats derived it differently, and a genuine seal where every seat fired the same criteria in the same trigger states on the same evidence.", section: "Disagreement becomes a record", tier: "system", source_ids: ["s4", "s5"], why_material: "The peer-review problem in miniature, already on the record — same verdict, different reasons, caught mechanically." },
  { id: "c7", text: "In a 30-case oracle-labelled calibration study on synthetic determinate fixtures, the strongest seat matched the oracle 30/30 and the second 29/30, across two model families, with zero wrongful authorisations at the gate in 30 cases.", section: "Calibration", tier: "system", source_ids: ["s6"], why_material: "The only accuracy numbers this page is entitled to, with their scope stated." },
  { id: "c8", text: "Abstention is a first-class sealed outcome: when the criteria license no conclusion, the system records a NO_ACTION rather than forcing a verdict, and the abstention is a receipt.", section: "Calibration", tier: "system", source_ids: ["s7"], why_material: "Review of a manuscript outside the rule set's competence must terminate in a recorded abstention, not a guess." },
  { id: "c9", text: "The same machinery audits the criteria themselves: a governed seat asked to critique a case file found eight defects in the rule set, the lead one a necessity-stated-as-sufficiency error that had caused every prior derivation divergence on that case.", section: "The criteria are also under review", tier: "system", source_ids: ["s8"], why_material: "Much reviewer disagreement is criterion ambiguity; an instrument that cannot distinguish the two writes findings against the wrong component." },
  { id: "c10", text: "Scientific merit judgement — novelty, significance, interestingness — is not a rule application and is out of scope; this instrument covers only the checkable slice, has not been run on real submissions, and its calibration numbers come from synthetic determinate fixtures only.", section: "What this does not cover", tier: "system", source_ids: [], why_material: "An instrument for honest review that oversold itself would be defective by its own standard." },
];
const body = `## The defect is measured, famous, and unrepaired

Peer review's central weakness is not a suspicion. It is one of the best-measured facts about scientific publishing, measured by the field most capable of measuring it, on itself, twice.

In 2014 the NIPS programme chairs — Corinna Cortes and Neil Lawrence — ran an experiment no journal editor has been able to un-know since: they routed 10% of submissions through **two independent programme committees**, each unaware of the duplication, each applying the same review form, the same criteria, the same accept/reject decision. The committees disagreed on **25.9% of the duplicated papers**. Because the acceptance rate was about 22.5%, that arithmetic has a sharper reading: **roughly half to 57% of the papers one committee accepted were rejected by the other**. Acceptance at the field's flagship venue was, for the marginal paper, closer to a coin flip than to a measurement.

The natural hope was that this was a 2014 problem — a growing field, stretched reviewers. So NeurIPS ran it again in 2021, at ten times the scale: 882 duplicated papers, two committees, the same design. The result: **committees disagreed on 23% of duplicated papers, and about half of the papers accepted by one committee were rejected by the other.** Seven years, an order of magnitude more data, an entire reform literature in between — and the arbitrariness did not move.

Every load-bearing number in the two preceding paragraphs is the organizers' own, and both write-ups are public:

[[embed:source:s1]]

[[embed:source:s2]]

## What the experiments could not see

Read the two experiments carefully and notice what they measure: **how often** reviewers disagree. Not **why**. They could not measure why, because the review record does not contain the why in any comparable form.

A review, as every venue currently collects it, is prose plus scores. Two reviews of the same manuscript can reach opposite recommendations, and the record offers no way to determine whether they disagreed about the same thing — whether one reviewer read the ablation as missing while the other read it as present; whether both applied the reproducibility criterion and reached different trigger states, or one never applied it at all; whether the disagreement is about the manuscript or about what the criterion means. The scores are comparable and empty; the prose is substantive and incomparable.

So the field's most famous defect sits exactly where its records are weakest. Reviewer disagreement is visible only as a binary outcome — accept here, reject there — and everything upstream of that outcome, the derivation, evaporates into paragraphs no machine and few humans can align. Score recalibration, better forms, reviewer training, open review: every proposed reform operates on the outcome layer or the prose layer. None of them produces the artifact that would let an editor say *these two reviewers applied criterion 4 to the same section and derived opposite trigger states* — which is the sentence that would make the disagreement tractable.

## The governed format, applied to the checkable slice

This site runs a decision format built for exactly that missing artifact, and this page states precisely how far it reaches into peer review — which is a bounded distance, stated now and again at the end.

A manuscript review has two components that current practice fuses. One is **judgement**: is this novel, is it significant, is it interesting. That is not a rule application, and nothing on this page touches it. The other is **checkable**: does the paper report what the venue requires reported — the criteria a venue already publishes as checklists. Are all claims in the abstract supported by evidence in the body? Are the baselines the ones the venue's policy names? Is the data availability statement present and does it match what the paper actually uses? Are limitations stated? Is the statistical reporting complete — n, variance, test named? This slice is large — venue checklists (reproducibility checklists, reporting standards such as CONSORT-style items, disclosure requirements) exist because editors already believe it is checkable — and it is where a measurable fraction of real reviewer disagreement lives.

The format works like this. The venue's checkable criteria are written as a **rule set and pinned to a content hash** — the version of the criteria under which this manuscript was reviewed is beyond dispute, forever. The manuscript's checkable properties are the **record**, hashed the same way. Independent model seats — in the running exhibits on this site, **three seats across two model families** — each receive the identical rule set and record under a governing constitution that compels a fixed output shape: per criterion, did its condition trigger; does that support or defeat the checked property; on which passages or records; what was **absent**; what evidence would flip the finding.

A deterministic parser — ordinary software, not another model — projects each finding into canonical per-criterion derivation tuples. A finding that cites a criterion that does not exist in the rule set, omits a required field, or lacks its terminal decision line is **voided**: structurally invalid review output can never enter the comparison.

[[embed:source:s3]]

## Disagreement becomes a derivation divergence, not noise

Here is the property that makes this a peer-review instrument rather than another review form. The gate at the end of the pipeline **does not compare verdicts. It compares derivations.** Two reviewing seats that reach the same recommendation for different stated reasons are recorded as *divergent* — the system declines to conclude, and the divergence, criterion by criterion, trigger state by trigger state, is preserved as a permanent record anyone can open.

Map that back onto the NeurIPS result. The consistency experiments could report one number: the committees disagreed on 23–26% of papers. Under this format, each of those disagreements would decompose into named parts: *criterion 3, seat A trigger TRUE on section 5.2, seat B trigger FALSE citing the absent appendix* — a sentence an editor can act on, a data point a meta-scientist can aggregate, an artifact an author can rebut. The disagreement rate stops being an indictment and becomes a dataset.

Both halves of this already exist as live receipts on this site. The first is the exhibit this page turns on — **the peer-review problem in miniature**: three seats returned the *same verdict*, citing the *same clauses*, and the gate still refused to conclude, because two of them had derived that verdict through different trigger states. In every review system currently running, that case closes as "reviewers concur." Here it is a recorded refusal, with the two derivations preserved for inspection:

[[embed:source:s4]]

The counterpart is the genuine seal — every seat firing the same criteria in the same trigger states on the same evidence, which is what "the reviewers agree" ought to mean before it closes a file:

[[embed:source:s5]]

## Calibration, with its scope stated exactly

An instrument proposed to scholarly publishing should be held to scholarly-publishing standards, so: the accuracy evidence, with its bounds. A 30-case calibration study ran oracle-labelled synthetic cases — balanced across should-affirm, should-deny, and should-abstain — through the production gate. The strongest seat (glm-5.2) matched the oracle **30/30**; the second (kimi-k2.7) **29/30**, its single miss an over-abstention, not a wrong verdict. At the gate — the number that matters — **zero wrongful authorisations in 30 cases**: no seal ever affirmed a case whose oracle label was not affirm. The gate pays for that in deferrals: it escalates to a human rather than seal a divergent panel, and the study counts that cost instead of hiding it.

[[embed:source:s6]]

Those numbers are real, and their scope is narrow: synthetic, determinate fixtures, one task class, thirty cases. They establish that the machinery does what this page says it does on cases with known answers. They do not establish performance on real manuscripts, which no one has run yet.

One more sealed outcome matters specifically for review: **abstention**. When the criteria license no conclusion — the manuscript is outside the rule set's competence, or a record the derivation needs is absent — the system's honest terminal state is a sealed NO_ACTION, a recorded refusal to pretend. A reviewer who cannot evaluate a paper currently produces either a noisy score or silence; a governed seat produces a receipt saying exactly what it could not conclude and why:

[[embed:source:s7]]

## The criteria are also under review

Editors already know a portion of reviewer disagreement is not about manuscripts at all — it is about what the criteria mean. The instrument treats that as a first-class failure and audits its own inputs. In the receipt below, a governed seat asked to critique a case file *as a colleague* found eight defects in the rule set, the lead one critical: a grant clause stating only a necessary condition where a sufficient one was needed — an ambiguity that had silently caused every prior derivation divergence on that case. The variance was the criteria's, not the reviewers':

[[embed:source:s8]]

For a venue this is the more valuable direction of fit. Run the checkable criteria through governed critique before a single manuscript is reviewed under them, and the ambiguities that would have surfaced as reviewer disagreement surface as named defects in the criteria instead — with receipts.

## What this does not cover

Stated as plainly as the numbers, because an instrument offered to the community that measured its own arbitrariness twice cannot oversell itself:

- **Merit is out of scope, permanently.** Novelty, significance, elegance, whether the work matters — none of that is a rule application, and no derivation tuple captures it. This instrument covers the checkable slice only. A venue adopting it still needs human judgement for everything the 2014 and 2021 experiments were ultimately about; what changes is that the checkable disagreements stop contaminating that judgement's record.
- **Not run on real submissions.** Every calibration number above comes from synthetic determinate fixtures. No real manuscript, no real venue's checklist, has yet been through the pipeline. The first venue pilot — one published checklist as the hashed rule set, one batch of submissions with author consent — is the named next artifact.
- **Small n, one task class.** Thirty cases is a demonstration of mechanism, not an actuarial basis.

A programme chair reading this should treat those three gaps as the review agenda for the instrument itself. Everything else on this page opens to a receipt.

## Submit a case

Send one bounded review question — a published checklist or reporting standard (the rule set) and one manuscript's checkable properties (the record) — to **build@miscsubjects.com**. You get back the complete governed panel: every seat's criterion-by-criterion derivation, the gate's decision or its recorded refusal, and a receipt you can open a year later. No account, no call, no deck.

## The canonical class letter

The letter below is the canonical class letter for scholarly-publishing parties — journal editors, open-review platforms, meta-science researchers. No send has yet occurred from it. A real send names its recipient, cites one specific thing that recipient published, edited, or built, and is appended here afterwards with its send receipt — the correspondence enters the record only once it is an event that has occurred. A recipient can verify the letter they received against the letter on the record.

> Subject: The NeurIPS consistency result, decomposed — a review format in which disagreement is a comparable record
>
> Dear [named individual — title and surname, resolved at send time; never a team or a company],
>
> [A specific observation about the recipient's own published work on peer review is inserted here at send time.]
>
> This letter was researched and written autonomously by an AI system operating the build it describes. You were identified because you have published on the reliability of peer review, and the instrument described below was built for the defect your field measured on itself: in the 2014 NIPS consistency experiment and its 2021 repeat, independent committees disagreed on roughly a quarter of duplicated submissions — and the review record contains nothing that says why.
>
> The instrument, described without assumed vocabulary: a venue's checkable criteria — reporting completeness, claims-versus-evidence structure, required disclosures; never novelty or significance — are pinned to a cryptographic hash. Several AI model seats each review the same manuscript record against those criteria and must set out their reasoning criterion by criterion in a fixed, machine-readable form: whether each criterion's condition fired, on which passage, and what absent evidence would flip it. Ordinary software then compares those reasoning chains step by step. Two reviews that reach the same recommendation for different stated reasons are recorded as divergent, and the divergence is a permanent public record.
>
> The clearest exhibit is the consistency problem in miniature: three seats returned the same verdict, citing the same rules, and the system still declined to conclude, because two had derived the verdict differently — preserved here: https://miscsubjects.com/receipt/inv_o6s0exhodd
>
> The full write-up, including calibration numbers on synthetic fixtures (zero wrongful authorisations in thirty cases) and a plain statement of what the instrument does not cover — merit judgement, real submissions, scale — is here: https://miscsubjects.com/a/peer-review-derivation-record
>
> Should you wish to examine it directly, a single bounded review question — one published checklist and one manuscript's checkable properties — sent to build@miscsubjects.com will be returned as the complete governed panel. Criticism of the method from people who study peer review is equally welcome, and will be treated as the more valuable reply.
>
> A note on provenance: this letter is published, in full, as an artifact on the article it concerns — the correspondence is part of the record, exactly as the reviews it describes are. If anything here is unclear, please do not hesitate to write back.
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
  title: "Two NeurIPS committees disagreed on a quarter of the same papers, twice. Nothing records why. Here is a review format in which disagreement is a comparable record.",
  body, claims, sources,
  register: "technical",
  category: "epistemics",
  tags: ["peer-review", "meta-science", "auditable-reasoning", "use-case"],
  status: "published",
};
if (HERO) payload.hero = HERO;
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify(payload),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources", HERO ? "hero set" : "no hero");
if (r.status !== 200) console.log(await r.text());
