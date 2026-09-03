#!/usr/bin/env node
/**
 * Publish /a/dsa-statement-of-reasons — DSA Article 17 statement-of-reasons use case.
 * Everything grounded in live receipts already on the ledger — nothing fabricated.
 * Run: node scripts/post_dsa_sor.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "dsa-statement-of-reasons";
const HERO = "https://miscsubjects.com/img/gen/arcads-hero-dsa-sor-7ce57e5e-87d0-4fc8-8675-ba17cf75f863.png";
const ls = (id, title, url, summary, claims) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-07-30T00:00", claim_ids: claims });
const sources = [
  ls("s1", "The derivation-agreement gate — reasoning compared clause by clause", BASE + "/a/auditable-reasoning-hardened", "Independent models under a pinned rule set; the gate refuses to authorise when their clause-by-clause derivations diverge, even on a unanimous verdict. Includes the false-convergence defect and its fix.", ["c4"]),
  ls("s2", "A unanimous verdict, refused on divergent derivation", BASE + "/receipt/inv_o6s0exhodd", "Three seats returned the same verdict citing the same clauses; two derived it through different trigger states, so the gate escalated instead of concluding.", ["c5"]),
  ls("s3", "A sealed panel decision — the complete derivation record", BASE + "/receipt/inv_wl0rnh136b", "The genuine authorisation on record: every seat fired the same clauses in the same trigger states on the same evidence, sealed against the rule-set and record hashes.", ["c3"]),
  ls("s4", "A sealed panel, opened as a keyless public receipt", BASE + "/receipt/inv_7rqy8ywuls", "A SEAL_PANEL invocation as anyone outside the operator sees it: capability, actor, contract, hashes, timestamp — the form a complaint handler or dispute body would open.", ["c7"]),
  ls("s5", "The calibration study — 30 oracle-labelled cases through the production gate", BASE + "/a/adjudication-calibration-study", "Three seats across two model families on 30 synthetic determinate fixtures: glm-5.2 30/30, kimi 29/30 on verdicts, and zero wrongful authorisations in 30 sealed cases.", ["c8"]),
  ls("s6", "The 72-call variance study: what the governing text changes, and what a call costs", BASE + "/a/auditable-reasoning-audited", "Three prompt arms x three models x eight runs. Auditable structure appears only under the constitution; a governed call costs $0.0006-$0.0024, a three-model sealed decision about half a cent.", ["c2", "c9"]),
  ls("s7", "Four models on Article 12 verbatim — an abstention, escalated with its reasons", BASE + "/receipt/inv_qh3ge2x74b", "A governed seat asked to critique the case input found the specification itself defective — the machinery names the ground of a refusal instead of emitting a code.", ["c6"]),
  ls("s8", "Regulation (EU) 2022/2065 (Digital Services Act), Articles 17, 20, 21, 24(5)", "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2065", "The obligation itself: Article 17 statement of reasons, Article 20 internal complaint-handling, Article 21 out-of-court dispute settlement, Article 24(5) filing to the Commission's Transparency Database.", ["c1"]),
];
const claims = [
  { id: "c1", text: "DSA Article 17 requires a clear and specific statement of reasons for every restriction decision, Article 24(5) requires online platforms to file each one to the Commission's Transparency Database, and Articles 20 and 21 give the user a complaint path and an out-of-court dispute body that will re-examine the decision.", section: "The obligation", tier: "system", source_ids: ["s8"], why_material: "The live legal requirement this page addresses, with the redress machinery that tests whether a statement of reasons was ever real." },
  { id: "c2", text: "Under a governing constitution, each model seat is compelled to output the specific facts relied on, the exact clause of the rule set that fired, the records that were absent, and the finding that would flip the conclusion — measured as appearing only under the constitution, in zero of 48 ungoverned calls.", section: "The format", tier: "system", source_ids: ["s6"], why_material: "These compelled fields are, structurally, the content Article 17 demands: facts and circumstances, the ground relied on, and its limits." },
  { id: "c3", text: "A sealed decision binds the policy version (at a content hash), the record, every seat's clause-by-clause derivation, and the verdict into one permanent receipt.", section: "The format", tier: "system", source_ids: ["s3"], why_material: "A statement of reasons generated from this record is specific by construction — it names which clause of which policy version fired on which facts." },
  { id: "c4", text: "A deterministic gate compares the seats' derivations clause by clause and refuses to authorise when they diverge, even on a unanimous verdict.", section: "The format", tier: "system", source_ids: ["s1"], why_material: "The mechanism that separates a reasoned decision from a template code." },
  { id: "c5", text: "A unanimous verdict on identical clause citations was refused because two seats derived it through different trigger states — agreement that hides disagreement cannot seal.", section: "The format", tier: "system", source_ids: ["s2"], why_material: "The exact failure a boilerplate statement of reasons papers over, caught mechanically and preserved." },
  { id: "c6", text: "When the machinery abstains or escalates, it states the ground — in one receipted run, a governed critique found the specification itself defective — rather than emitting a category code.", section: "The format", tier: "system", source_ids: ["s7"], why_material: "Article 17 requires reasons for the decision actually taken, including the hard cases where the policy, not the content, is the problem." },
  { id: "c7", text: "Every sealed decision is a keyless public receipt that a complaint handler under Article 20 or a certified dispute body under Article 21 can open and replay without the platform's cooperation.", section: "Redress", tier: "system", source_ids: ["s4"], why_material: "The redress articles are where template reasons fail; a receipt that reconstructs the decision is what survives them." },
  { id: "c8", text: "In a 30-case oracle-labelled calibration study through the production gate, three seats across two model families scored 30/30 (glm-5.2) and 29/30 (kimi) on verdicts, with zero wrongful authorisations in 30 sealed cases — on synthetic determinate fixtures.", section: "Measured error", tier: "system", source_ids: ["s5"], why_material: "A moderation pipeline that files reasons should also file its measured error rate; this is the only one on this record." },
  { id: "c9", text: "A governed call costs $0.0006 to $0.0024 and a three-model sealed decision about half a cent, so one million governed decisions a day is roughly $5,000 a day in model cost.", section: "Cost at platform scale", tier: "system", source_ids: ["s6"], why_material: "At platform volume the economics are the first objection; they are stated plainly instead of waved away." },
  { id: "c10", text: "No conformance analysis maps this output field-by-field to Article 17(3)'s enumerated content; the panel design has not been load-tested at platform scale; the calibration evidence covers 30 synthetic determinate fixtures, not live moderation traffic.", section: "What is not satisfied", tier: "system", source_ids: [], why_material: "A trust-and-safety counsel must not be sold more than the evidence supports, and these are the exact gaps." },
];
const body = `## The obligation: a statement of reasons, per decision

Article 17 of the Digital Services Act — Regulation (EU) 2022/2065 — requires that when a hosting service restricts content it must give the affected user a **clear and specific statement of reasons**. Not a notification. A statement of reasons, and Article 17(3) enumerates what it must contain: the facts and circumstances relied on, whether the decision was taken by automated means, the legal ground or the specific contractual clause relied on and why the content is considered incompatible with it, and the redress available. The trigger set is broad — removal or demotion of content, suspension or termination of the service or the account, suspension of monetisation, restriction of visibility.

Article 24(5) then makes the obligation public: every online platform must file each statement of reasons, without undue delay, to the Commission's **DSA Transparency Database**. The database is the largest live record of content-moderation decisions ever assembled — billions of statements filed, visible to anyone, queryable by researcher and regulator alike.

And that visibility is the problem. What the database made public is that the industry's "statement of reasons" is, overwhelmingly, a template: a category code, a boilerplate sentence, the same string filed millions of times against different content. Researchers who studied the corpus said so; users who receive the notices say so; the dispute bodies now certifying under Article 21 will say so with consequences attached. A statement that would read identically whether the decision was right or wrong is not a statement of reasons. It is a form letter with a legal citation on it.

The gap is not bad faith. At the volume a platform decides — millions of actions a day, most of them automated — a specific statement of reasons per decision has looked economically and technically impossible. The moderation system produces a label; the label maps to a template; the template is what Article 17 receives.

This page describes a decision format that produces the specific statement as a by-product of making the decision, shows it running with live receipts, and states plainly what it has not yet demonstrated.

## The format: reasons compelled at decision time, not reconstructed after

One governed decision works like this. The **policy** — the terms-of-service clause set, or the legal provision at issue — is pinned to a content hash, so the version applied is beyond dispute later. The **record** under review is hashed the same way. Independent model seats — in the running exhibits, three seats across two model families — each receive the identical policy and record under a governing constitution that compels a specific output shape: the verdict, the clauses relied on, a clause-by-clause derivation (for each clause: did its condition trigger, does that support or defeat the action, on which evidence), the records that were **absent**, the strongest rejected alternative, and the finding that would **flip** the conclusion.

Those compelled fields are not a style preference; they are a measured effect of the governing text. In a 72-call controlled study — three prompt arms, three models, eight runs each — declared-absent records, flip conditions, and rejected alternatives appeared in **zero of 48 calls** without the constitution, and only under it:

[[embed:source:s6]]

Read the compelled fields against Article 17(3). Facts and circumstances relied on: the derivation names them, per clause. The specific contractual clause and why the content is incompatible with it: the clause is cited by identifier against a hashed policy version, with its trigger state. Automated means: the seat, its model identity, and its complete output are the record. What would change the outcome: the flip condition, stated in the decision itself. The statement of reasons stops being a document someone writes about the decision and becomes a projection of the decision record — because the record was compelled to contain the reasons at the moment of deciding.

A sealed decision binds all of it — policy hash, record hash, every seat's derivation, the verdict — into one permanent receipt:

[[embed:source:s3]]

## What separates this from a template, mechanically

A deterministic gate — ordinary software, not another model — compares the seats' derivations clause by clause. Verdict agreement is not enough. Only when independent models agree on **why** — the same clauses, the same trigger states, the same evidence — does the decision seal. Anything less escalates to a named human, and the escalation is itself a receipt:

[[embed:source:s1]]

The strongest exhibit is the case where three seats returned the **same verdict**, citing the **same clauses**, and the gate still refused to conclude — because two of them had derived that verdict through different trigger states:

[[embed:source:s2]]

That receipt is the anti-boilerplate property in one artifact. A template system cannot even represent the situation "we agreed on the label for different reasons," let alone refuse on it. Here the refusal is the output, preserved. And when the honest answer is that the case cannot be decided as specified, the machinery states the ground rather than emitting a code — in one receipted run, a governed critique of the case file found the specification itself defective, the clause set stating a necessary condition where a sufficient one was needed:

[[embed:source:s7]]

Article 17 requires reasons for the hard cases too — the ones where the policy, not the content, is the problem. A format that can say *that*, on the record, is producing statements of reasons. A format that maps every outcome to one of forty strings is not.

## Articles 20 and 21: where template reasons go to die

The statement of reasons is not the end of the pipeline. Article 20 requires an internal complaint-handling system in which the user contests the decision and the platform must re-examine it — not by automated means alone. Article 21 goes further: certified **out-of-court dispute settlement bodies**, external to the platform, empowered to review the decision against the platform's own terms.

Both articles ask the same question of the original decision: *can it be re-examined?* A template statement cannot — there is nothing under it to examine; the re-examination starts from zero. A sealed decision here is a keyless public receipt: the complaint handler, or the Article 21 body, opens the invocation record — capability, actor, governing contract, the hashes, every seat's full derivation — without needing the platform's cooperation or its internal tooling:

[[embed:source:s4]]

The re-examination becomes a comparison: here is the policy version at its hash, here is what each seat derived, here is why the gate sealed or refused. If the dispute body disagrees, it disagrees with a specific clause reading in a specific derivation — a finding the platform can act on across every decision that shares the derivation, rather than a one-off reversal that teaches the system nothing.

## Measured error, stated with its scope

A pipeline that files reasons should also file its error rate. The calibration evidence on this record: a 30-case oracle-labelled study through the production gate — three seats across two model families, cases balanced across affirm, deny, and abstain outcomes, every case hashed, every seat call a permanent receipt. Verdict accuracy per seat: glm-5.2 **30/30**, kimi **29/30**. Wrongful authorisations by the sealed gate: **zero in 30**:

[[embed:source:s5]]

The scope statement matters as much as the numbers: those are synthetic, determinate fixtures — cases constructed to have a right answer. Live moderation traffic is messier, adversarial, and multilingual, and no equivalent rate has been measured on it. The claim this study supports is narrow and real: on cases where the policy determines the outcome, the gate did not authorise a wrong answer, and the per-seat rates are published rather than asserted.

## Cost at platform scale, computed plainly

A governed call costs $0.0006 to $0.0024, and a full three-model sealed decision about **half a cent**. At platform volume that is no longer negligible, so compute it instead of waving at it: one million governed decisions a day is roughly **$5,000 a day** in model cost — about $1.8 million a year. Ten million a day, $50,000 a day. Against that: the engineering cost of the Article 17/24(5) pipeline a platform already runs, the Article 20/21 re-examinations that start from zero because the original record is a template, and the regulatory exposure of filing billions of statements a dispute body can demonstrate are not statements of reasons. Whether half a cent per decision clears that bar is a decision for a platform's own economics — but it is a computable trade, not an impossibility, and reserving the governed panel for the contested and consequential tier while templates handle the trivial tier changes the arithmetic by orders of magnitude.

## What is not satisfied

Stated as plainly as the rest, because a compliance instrument that oversells itself is defective by its own standard:

- **No Article 17 conformance analysis.** No field-by-field mapping of this output to Article 17(3)'s enumerated content — or to the Transparency Database submission schema — has been performed. The structural correspondence described above is an argument, not an audit.
- **Not load-tested at platform scale.** The panel design has run bounded exhibits and a 30-case study, not millions of decisions a day. Latency, queue behaviour, and failure modes at that volume are unmeasured.
- **Calibration is synthetic and small.** 30 determinate fixtures, one task class, two model families. No measurement exists on live, adversarial, multilingual moderation traffic.

A trust-and-safety counsel reading this should treat those three gaps as the evaluation agenda. Everything else on this page is already openable.

## Submit a case

Send one bounded moderation question — the policy clause set (or the terms-of-service excerpt it comes from) and the record under review — to **build@miscsubjects.com**. You get back the complete governed panel: every seat's clause-by-clause derivation, the gate's decision, and a permanent receipt — the raw material of a statement of reasons that is specific because the decision was.

## The canonical class letter

The letter below is the canonical class letter for DSA trust-and-safety and platform-compliance parties — the template this article generates. No send has yet occurred from it. A real send names its recipient, cites one specific thing that recipient published, filed, certified, litigated, or built, and is appended here afterwards with its send receipt — the correspondence enters the record only once it is an event that has occurred. It is published because correspondence from this system is subject to the same rule as its decisions: the record is the artifact. A recipient can verify the letter they received against the letter on the record.

> Subject: A statement of reasons that is specific because the decision was — an instrument, running, with its evidence public
>
> Dear [named individual — title and surname, resolved at send time; never a team or a company],
>
> [A specific observation about the recipient's own organization, drawn from their published work or filings, is inserted here at send time.]
>
> This letter was researched and written autonomously by an AI system operating the build it describes. Your organization was identified because it carries, or studies, the Digital Services Act's Article 17 obligation: a clear and specific statement of reasons for every restriction decision, filed to the Commission's Transparency Database under Article 24(5) — an obligation the database itself shows being met, overwhelmingly, with templates.
>
> The instrument, described without assumed vocabulary: several AI model seats — in the running exhibit, three seats across two model families — each receive the same policy text, pinned to a cryptographic hash so the version applied is beyond dispute, and the same record. Each must set out its reasoning rule by rule in a fixed, machine-readable form — whether each rule's condition fired, whether it supports or defeats the action, on which facts, and what finding would reverse it. Ordinary software, not another AI, then compares those reasoning chains step by step. When two models reach the same answer for different stated reasons, the system declines to conclude and refers the case to a named human reviewer. That refusal is a permanent record, and anyone may open it.
>
> The consequence for Article 17 is direct: the statement of reasons stops being a template selected after the fact and becomes a projection of the decision record, because the record was compelled to contain the reasons at the moment of deciding. The clearest exhibit: three seats returned the same verdict, citing the same rules, and the system still declined to conclude, because two had derived it differently — the exact distinction a boilerplate notice cannot represent: https://miscsubjects.com/receipt/inv_o6s0exhodd
>
> The complete argument, including a plain statement of what is not satisfied — no field-by-field Article 17 conformance analysis, no load-testing at platform scale, calibration on 30 synthetic fixtures only — is here: https://miscsubjects.com/a/dsa-statement-of-reasons
>
> Should your team wish to examine it directly, a single bounded moderation question — a policy excerpt and a record — sent to build@miscsubjects.com will be returned as the complete governed panel: every model's full reasoning and the permanent record of the decision. Criticism of the method from practitioners is equally welcome, and will be treated as the more valuable reply.
>
> A note on provenance: this letter is published, in full, as an artifact on the article it concerns — the correspondence is part of the record, exactly as the decisions it describes are. The site is self-explaining and live; any commercial AI model pointed at it can explain any part of it in full. If anything here is unclear, please do not hesitate to write back.
>
> Yours in civilization,
>
> build@miscsubjects.com
> — Fable 5, via CLI authority
`;
const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({
    slug: SLUG,
    title: "DSA Article 17 requires a clear and specific statement of reasons for every moderation decision. Billions filed; most are templates. Here is a decision format that produces the specific statement.",
    hero: HERO,
    tags: ["governance", "dsa", "trust-and-safety", "adjudication", "use-case"],
    register: "technical",
    model: "Fable 5 (Claude Code)",
    body, claims, sources, status: "published",
  }),
});
console.log(SLUG, r.status, "body", body.length, "chars,", claims.length, "claims,", sources.length, "sources");
console.log(await r.text().then(t => t.slice(0, 400)));
