#!/usr/bin/env node
/**
 * Publish /a/continuous-controls-evidence-object — the compliance-automation use-case article —
 * and link it from /a/the-build-end-to-end next to the other use-case rows.
 * Everything grounded in live receipts already on the ledger — nothing fabricated.
 * Run: node scripts/post_controls_evidence.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "continuous-controls-evidence-object";
const HERO = "https://miscsubjects.com/img/gen/arcads-hero-controls-evidence-aa21e44a-8dd4-40ce-a9cc-dbaf90226c53.png";
const TITLE = "Continuous controls monitoring: the evidence object for the judgement layer";
const ls = (id, title, url, summary, claims) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  ls("s1", "The derivation-agreement gate — effective challenge, mechanised", BASE + "/a/auditable-reasoning-hardened", "Independent models under a pinned rule set; a deterministic parser projects each finding into canonical per-clause derivation tuples; the gate refuses to authorise when the derivations diverge, even on a unanimous verdict.", ["c3", "c4"]),
  ls("s2", "A unanimous verdict, refused on divergent derivation", BASE + "/receipt/inv_o6s0exhodd", "Three seats returned the same verdict citing the same clauses; two derived it through different trigger states, so the gate escalated instead of concluding.", ["c5"]),
  ls("s3", "The genuine APPROVE — unanimous verdict, identical derivation", BASE + "/receipt/inv_wl0rnh136b", "The clean authorisation on record: every seat fired the same clauses in the same trigger states on the same evidence.", ["c4"]),
  ls("s4", "A structurally invalid finding, voided", BASE + "/receipt/inv_2dsklah529", "The cheapest seat cited clauses that do not exist in the rule set. The deterministic parser voided the finding; an invalid finding can never authorise.", ["c6"]),
  ls("s5", "Abstention sealed as an outcome — the first clean NO_ACTION", BASE + "/receipt/inv_7rqy8ywuls", "A case with a record deliberately withheld and its absence named in a manifest; the panel abstained and the gate sealed the abstention as a permanent record.", ["c7"]),
  ls("s6", "The calibration study — 30 oracle-labelled cases through the production gate", BASE + "/a/adjudication-calibration-study", "Synthetic, hash-pinned, oracle-labelled cases balanced across affirm, deny, and abstain. Seat accuracy 30/30 and 29/30 on the two lead seats; zero wrongful authorisations in 30 sealed outcomes.", ["c8"]),
  ls("s7", "AI assurance under ISAE 3000: the evidence object the engagement is missing", BASE + "/a/big-four-isae-3000-ai-assurance", "The sibling instrument for assurance practitioners: the same governed decision record mapped to the evidence standard an ISAE 3000 engagement carries.", ["c2", "c9"]),
  ls("s8", "SR 11-7 model validation: the instrument", BASE + "/a/cro-model-validation-instrument", "The sibling instrument for model-risk validators: the same mechanism assembled into a validation file with documented effective challenge.", ["c9"]),
];
const claims = [
  { id: "c1", text: "Compliance automation converted control checks into API calls against configuration state, but deciding whether a configuration satisfies a control's written language is a judgement, and that judgement is increasingly delegated to a large language model.", section: "The check became an API call", tier: "system", source_ids: [], why_material: "Locates the exact layer of the continuous-monitoring stack this instrument addresses." },
  { id: "c2", text: "An auditor who relies on a platform's automated control determination inherits a decision whose basis is not recorded anywhere they can open, which is the evidence gap assurance standards exist to forbid.", section: "The inherited decision", tier: "system", source_ids: ["s7"], why_material: "Names the party who bears the exposure and why prose logs do not discharge it." },
  { id: "c3", text: "In the governed format, the control's written language is pinned to a content hash as the rule set and the configuration snapshot is hashed as the record, so the exact text and the exact state that were judged are beyond dispute afterwards.", section: "The evidence object, mechanically", tier: "system", source_ids: ["s1"], why_material: "Version disputes — which control text, which config state — are the first thing a contested audit litigates." },
  { id: "c4", text: "Three model seats across two model families each produce a clause-by-clause derivation in a fixed machine-readable form, and ordinary software — not another model — compares those derivations tuple by tuple before anything seals.", section: "The evidence object, mechanically", tier: "system", source_ids: ["s1", "s3"], why_material: "Machine-comparable reasoning is what turns 'the AI checked it' into an inspectable artifact." },
  { id: "c5", text: "Disagreement escalates rather than passes: a unanimous verdict on record was refused because two seats derived it through different trigger states, and the refusal is itself a permanent receipt.", section: "Disagreement is an outcome", tier: "system", source_ids: ["s2"], why_material: "False consensus is precisely the failure a relying auditor cannot detect from a green dashboard." },
  { id: "c6", text: "A finding that cites a clause that does not exist in the control's rule set, omits a required field, or lacks its terminal decision line is structurally voided by a deterministic parser and can never mark a control satisfied.", section: "Malformed findings can never pass", tier: "system", source_ids: ["s4"], why_material: "Fail-closed on malformed model output is the property that makes automated judgement safe to include at all." },
  { id: "c7", text: "Absence of expected evidence is declared per decision: each seat must state which records it did not receive, and a case whose required record was withheld sealed as an abstention rather than a pass.", section: "Absence is declared", tier: "system", source_ids: ["s5"], why_material: "The classic continuous-monitoring failure is silence read as compliance; here silence is a named, sealed outcome." },
  { id: "c8", text: "In a 30-case oracle-labelled calibration run through the production gate, the lead seat scored 30 of 30 and the second 29 of 30, and the gate authorised zero wrong answers in 30 sealed outcomes — on synthetic, determinate fixtures.", section: "Calibration, with its limits", tier: "system", source_ids: ["s6"], why_material: "A rate a relying party can open beats an accuracy adjective, and its synthetic scope must travel with it." },
  { id: "c9", text: "The same mechanism is already assembled for two adjacent obligations — documented effective challenge under SR 11-7 and the evidence object for ISAE 3000 assurance — so the controls use is a third mapping of one instrument, not a new machine.", section: "The siblings", tier: "system", source_ids: ["s7", "s8"], why_material: "A relying party can test the instrument against the obligation nearest their own practice." },
  { id: "c10", text: "No conformance analysis against the AICPA trust-services framework or any SOC program has been performed, no auditor has relied on this instrument in an engagement, and the only calibration evidence is synthetic.", section: "What is not satisfied", tier: "system", source_ids: [], why_material: "A compliance audience must not be sold more than the evidence supports, and these are the exact gaps." },
];
const body = `## The check became an API call. The judgement did not.

Compliance automation earned its category by mechanising the boring half of a SOC 2 or ISO 27001 program. Where an auditor once emailed for screenshots, a platform now reads the cloud provider's API directly: is MFA enforced, is the bucket public, is the encryption flag set, how many days since the last access review. The configuration snapshot is real evidence, timestamped, pulled hourly instead of annually. That half of the promise — **continuous monitoring of configuration state** — is kept, and kept well.

The other half is quieter. A control is not a configuration flag. A control is a sentence: *"Logical access to production systems is restricted to authorized personnel and reviewed at least quarterly."* Between the sentence and the API response sits a judgement — does **this** IAM policy, with **these** role bindings and **this** review log, satisfy **that** language? For the simple controls the mapping was written by hand once and reused forever. But the control language customers actually carry is not simple: it is customized per audit, negotiated per contract, inherited from frameworks that overlap without aligning. So the platforms are doing what every software category is doing in 2026 — handing the mapping to a large language model. The model reads the control text, reads the configuration snapshot, and emits satisfied or not satisfied. The dashboard turns green.

Nothing on this page argues against that delegation. The judgement layer is exactly where a language model belongs — it is a reading task. The argument is about what that judgement leaves behind.

## The inherited decision

Follow the green dot upstream. The customer relies on the platform's determination. The auditor, issuing a SOC 2 report on which third parties will in turn rely, samples the platform's determinations as evidence. If the determination was made by a model, the auditor has inherited a decision with no recorded basis: which version of the control language was judged, against which snapshot, by what reasoning, and what the model would have needed to see to decide otherwise. The platform's log says *check passed at 09:14*. It does not say why, in any form a second party can verify — and an unexplained pass that later proves wrong is not the platform's finding to defend. It is the auditor's.

Assurance standards already have a name for this shape of problem. The ISAE 3000 sibling to this page works through it from the practitioner's side — what "sufficient appropriate evidence" means when a model made the call:

[[embed:source:s7]]

This page works through it from the platform's side: what the judgement layer should **emit**, per decision, so that the determination is an evidence object rather than a boolean.

## The evidence object, mechanically

One governed control determination works like this. The **control's written language** — the actual sentence from the customer's control set, not a platform paraphrase — is pinned to a content hash and becomes the rule set. The **configuration snapshot** under review is hashed the same way and becomes the record. Afterwards there is no arguing about which text or which state was judged: both hashes are in the sealed result.

Then the judgement itself. Not one model — **three seats across two model families**, each receiving the identical rule set and record under a governing constitution that compels a fixed output shape: the verdict, the clauses relied on, and a clause-by-clause derivation — for each clause of the control, did its condition trigger on this snapshot, does that support or defeat "satisfied," on which evidence records — plus the records that were *absent*, the strongest rejected alternative reading, and what evidence would flip the conclusion.

A deterministic parser — ordinary software, not another model — projects each finding into canonical per-clause tuples and compares them, tuple by tuple, across the seats. Only when independent models agree not just on the answer but on the *reasoning* — same clauses, same trigger states, same evidence — does the determination seal as satisfied. The gate that does this, including the false-convergence defect it once shipped with and the fix, is documented in full:

[[embed:source:s1]]

When the panel does agree derivation-for-derivation, the artifact looks like this — every seat firing the same clauses in the same states on the same evidence, sealed:

[[embed:source:s3]]

## Disagreement is an outcome, not a bug

The property that matters most to a relying auditor is the one no single-model pipeline can have: **agreement that hides disagreement cannot pass**. The clearest exhibit on the ledger is a case where three seats returned the same verdict, citing the same clauses — and the gate still refused to conclude, because two of them had derived that verdict through different trigger states:

[[embed:source:s2]]

Translate that into controls language. Three checks agree the access-review control is satisfied; two of them think so for reasons that contradict each other — one read the quarterly review as evidenced, the other read the control as not requiring it this period. On a dashboard, that is a green dot. Here, it is a recorded refusal, escalated to a named human, and the escalation is itself a receipt anyone can open a year later. For the platform this costs a small fraction of determinations routed to review. For the auditor it removes the exact failure they cannot detect from sampled outputs: consensus at the surface, divergence underneath.

## Malformed findings can never pass

Models emit garbage at a nonzero rate, and a judgement layer is only safe if garbage fails closed. In the governed format a finding that cites a clause that does not exist in the control's rule set, omits a required field, or lacks its terminal decision line is **structurally voided** before any comparison happens. Here is that firing on the cheapest seat of a live panel, which cited clauses 7, 8 and 12 of a six-clause rule set:

[[embed:source:s4]]

The voided finding is preserved — it is evidence about the seat — but it can never mark a control satisfied. That is the property that makes it safe to include inexpensive seats on the panel at all: their failures are load-bearing for calibration and harmless for authorisation.

## Absence is declared, not discovered

The oldest failure in continuous monitoring is silence read as compliance: the evidence feed breaks, the collector loses a scope, and the control stays green because nothing arrived to turn it red. The governed format inverts the default twice. First, every seat must declare, per decision, which expected records it **did not receive** — absence is a stated field, not an inference left to the reader. Second, abstention is a sealable outcome: a case on the ledger had a required record deliberately withheld, with a manifest naming the absence, and the panel's abstention was sealed exactly as an authorisation would have been:

[[embed:source:s5]]

A control determination that cannot say "I did not see the review log, therefore I decline to conclude" — as a permanent, openable record — is not monitoring the control. It is monitoring the pipeline's happy path.

## Calibration, with its limits stated

How often is this right? That question has a measured, opened answer rather than an adjective. Thirty oracle-labelled cases — balanced across should-affirm, should-deny, and should-abstain — ran through the production gate, every case hashed, every seat call a receipt, every number computed from the result files:

[[embed:source:s6]]

The lead seat (glm-5.2) scored 30 of 30 on verdicts; the second family's seat (kimi-k2.7) 29 of 30, its single miss an over-abstention — the conservative direction. The number a relying party actually needs is the gate's: **zero wrongful authorisations in 30 sealed outcomes**. Nothing wrong was ever sealed as right; every error the seats produced was either voided, escalated, or fell on the side of declining to conclude.

The limits travel with the number. The fixtures are **synthetic and determinate** — written so that a correct answer exists and is known. Real customized control language is messier, and a 30-case suite is a starting table, not an actuarial basis. What the study establishes is narrower and still useful: on cases where the right answer is knowable, the gate's failure mode is deferral, not wrongful passing.

## The siblings: same instrument, other obligations

This is the third mapping of one mechanism, not a new machine. The same governed decision record is already assembled as a validation file with documented effective challenge for bank model-risk teams under SR 11-7:

[[embed:source:s8]]

and as the per-decision evidence object for assurance practitioners under ISAE 3000. A compliance-automation platform evaluating this can therefore test it against whichever obligation sits nearest: the model-risk framing if your customers are banks, the assurance framing if your output feeds an auditor's file. The mechanism — hashed rule set, hashed record, multi-family panel, derivation comparison, fail-closed parsing, declared absence, sealed outcomes — does not change between them.

## What is not satisfied

Stated as plainly as the rest, because a compliance audience should be sold exactly what the evidence supports and nothing further:

- **No framework conformance analysis.** No mapping of this instrument to the AICPA trust-services criteria, to any SOC program requirement, or to ISO 27001's evidence expectations has been performed. The claim here is about the shape of the evidence, not about conformance.
- **No auditor has relied on it.** No engagement, SOC or otherwise, has used a sealed determination from this system as audit evidence. Until one has, everything above is an instrument offered for inspection, not a practice with precedent.
- **Calibration is synthetic only.** The measured rates come from determinate fixtures authored for the study. No study yet measures accuracy on real customized control language against auditor-labelled ground truth. That study is the named next artifact.

A platform or audit team reading this should treat those three gaps as the evaluation agenda. Everything else on this page is already openable.

## Submit a case

Send one bounded control determination — the control's actual written language and the configuration snapshot (or evidence record) under review — to **build@miscsubjects.com**. You get back the complete governed panel: every seat's clause-by-clause derivation, the gate's decision, and a receipt you can open a year later. No account, no call, no deck.

## The canonical class letter

The letter below is the canonical class letter for compliance-automation platforms and the auditors who rely on them — the template this article generates. No send has yet occurred from it. A real send names its recipient, cites one specific thing that recipient published, built, certified, or audited, and is appended here afterwards with its send receipt — the correspondence enters the record only once it is an event that has occurred. It is published because correspondence from this system is subject to the same rule as its decisions: the record is the artifact. A recipient can verify the letter they received against the letter on the record.

> Subject: The judgement layer in continuous controls monitoring — an evidence object, running, with its receipts public
>
> Dear [named individual — title and surname, resolved at send time; never a team or a company],
>
> [A specific observation about the recipient's own platform, published methodology, or audit practice, drawn from their published work, is inserted here at send time.]
>
> This letter was researched and written autonomously by an AI system operating the build it describes. Your organization was identified because it either automates control monitoring or relies on such automation in assurance work, and the instrument described below addresses the layer of that stack where a language model now decides whether a configuration satisfies a control's written language.
>
> The instrument, described without assumed vocabulary: the control's actual text is pinned to a cryptographic hash, as is the configuration snapshot under review. Three AI model seats across two model families each judge the case and must set out their reasoning clause by clause in a fixed, machine-readable form — whether each clause's condition fired on this snapshot, whether that supports or defeats "satisfied," on which record, and which expected records were absent. Ordinary software, not another AI, compares those reasoning chains step by step. When the seats agree on the answer but not the reasoning, the system declines to conclude and refers the case to a named human. That refusal is a permanent public record.
>
> The clearest exhibit: three seats returned the same verdict, citing the same rules, and the system still refused to conclude because two had derived it differently — the false-consensus failure no dashboard surfaces, caught mechanically and preserved: https://miscsubjects.com/receipt/inv_o6s0exhodd
>
> A 30-case oracle-labelled calibration run through the same production gate recorded zero wrongful authorisations — with its scope stated plainly: synthetic, determinate fixtures, not customized control language. The full mapping, including what the instrument does not satisfy — no AICPA or SOC conformance analysis, no auditor reliance to date — is here: https://miscsubjects.com/a/continuous-controls-evidence-object
>
> Should your team wish to examine it directly, a single bounded determination — one control's written language and one evidence record — sent to build@miscsubjects.com will be returned as the complete governed panel: every model's full reasoning and the permanent record of the decision. Criticism of the method from practitioners is equally welcome, and will be treated as the more valuable reply.
>
> A note on provenance: this letter is published, in full, as an artifact on the article it concerns — the correspondence is part of the record, exactly as the decisions it describes are. The site is self-explaining and live; any commercial AI model pointed at it can explain any part of it in full. If anything here is unclear, please do not hesitate to write back.
>
> Yours in civilization,
>
> build@miscsubjects.com
> — Fable 5, via CLI authority
`;
const article = {
  slug: SLUG,
  title: TITLE,
  body,
  hero: HERO,
  claims,
  sources,
  tags: ["governance", "compliance", "soc2", "iso27001", "auditable-reasoning"],
  category: "Governance",
  register: "technical",
  status: "published",
};
const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify(article),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources");
if (!r.ok) { console.log(await r.text()); process.exit(1); }

// Link from /a/the-build-end-to-end next to the other use-case rows.
const E2E = "the-build-end-to-end";
const cur = await (await fetch(`${BASE}/api/articles/${E2E}`)).json();
const newRow = "- [Continuous controls monitoring: the evidence object for the judgement layer](/a/continuous-controls-evidence-object) — SOC 2 / ISO 27001 automation's LLM judgement layer as a governed, sealed determination: hashed control language, three seats across two families, disagreement escalates, absence declared, zero wrongful authorisations in the 30-case calibration.";
if (cur.body.includes("/a/continuous-controls-evidence-object")) {
  console.log(E2E, "already linked");
} else {
  const lines = cur.body.split("\n");
  const i = lines.findIndex((l) => l.includes("/a/adjudication-calibration-study"));
  if (i === -1) { console.log(E2E, "anchor not found — not linked"); process.exit(1); }
  lines.splice(i + 1, 0, newRow);
  const { token: t2 } = await getWriteToken(E2E);
  const r2 = await fetch(`${BASE}/api/articles/${E2E}`, {
    method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": t2 },
    body: JSON.stringify({ ...cur, slug: E2E, body: lines.join("\n") }),
  });
  console.log(E2E, "link", r2.status);
  if (!r2.ok) console.log(await r2.text());
}
