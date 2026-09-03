#!/usr/bin/env node
/**
 * Three new definitive articles, 2026-08-01:
 *   diversity-beats-count · the-rule-that-was-obeyed · the-exclusion-policy-is-a-safety-claim
 * Each grounded only in numbers verified on the live site this session.
 * Run: node scripts/publish_three_2026_08_01.mjs [--hero slug=url ...]
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";

const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try {
    const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
    const m = env.match(/TERMINAL_KEY=(.+)/);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY;
  } catch { return process.env.TERMINAL_KEY; }
})();

const heroes = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^([a-z0-9-]+)=(https:.+)$/);
  if (m) heroes[m[1]] = m[2];
}

const ls = (id, title, url, summary, claims) => ({ id, type: "live_surface", title, publisher: "miscsubjects.com", url, summary, accessed_at: "2026-08-01T23:00", claim_ids: claims });

const ARTICLES = [];

/* ------------------------------------------------------------------ 1 */
ARTICLES.push({
  slug: "diversity-beats-count",
  title: "Two AI reviewers from different makers catch more errors than two from the same maker — at the same price",
  category: "canon",
  tags: ["adjudication", "calibration", "panels", "measurement", "canonical"],
  model: "Fable 5 (Claude Code)",
  sources: [
    ls("s1", "Logical economics — the full configuration table", BASE + "/a/logical-economics", "Sixty-four panel configurations over the same 70 findings: emit rate and undetected-wrong rate per channel count, and the two-channel family comparison this page is built on.", ["c1", "c2", "c3", "c4"]),
    ls("s2", "The probe report the rates come from", BASE + "/a/adjudication-probe-report-eu-ai-act", "The 14-probe known-answer suite, per-model rates, the abstention strata, and the exclusion-policy sensitivity note appended 2026-08-01.", ["c1", "c5", "c6"]),
    ls("s3", "The probe instrument's own contract", BASE + "/api/directory/ADJUDICATE_PROBE", "The directory row for the known-answer probe: correct verdicts declared in advance, run through the identical adjudication path, so miss and abstention rates are measured rather than assumed.", ["c5"]),
    ls("s4", "The system this measures, end to end", BASE + "/a/the-build-end-to-end", "Where the panel, the gate, the receipts and the anchor sit in the whole assembly, including Part 21 on why nine models at five per cent is not five per cent to the ninth.", ["c7"]),
    ls("s5", "A live case where correlation showed its face", BASE + "/a/adjudication-eu-ai-act-article-50", "The live run in which the panel split three CANNOT_CONCLUDE, one DENY, one AFFIRM on a genuine boundary question and the majority landed on the correct abstention.", ["c8"]),
  ],
  claims: [
    { id: "c1", text: "At two channels and identical cost, a cross-family pair emits an undetected-wrong answer 0.169 of the time against 0.214 for a same-family pair, on the same 70 findings.", section: "the finding", tier: "demonstrated", source_ids: ["s1", "s2"], why_material: "It is the only lever in the table that improves the number that matters without adding a single model call." },
    { id: "c2", text: "Same-family adjudicators agree 0.893 of the time against 0.714 for cross-family pairs, measured directly on the same finding set.", section: "the mechanism", tier: "demonstrated", source_ids: ["s1"], why_material: "The agreement gap is the mechanism: two variants of one vendor are close to one channel wearing two names." },
    { id: "c3", text: "Adding a second channel halves the undetected-wrong rate (0.314 to 0.178) for one extra call; going from two channels to five buys 0.178 to 0.071 for three more calls.", section: "the price curve", tier: "demonstrated", source_ids: ["s1"], why_material: "The second channel is the cheapest correctness available and the fifth is the most expensive." },
    { id: "c4", text: "At five channels the mean emit rate falls to 0.429 — the assembly sends the majority of questions to a human rather than answering.", section: "the price curve", tier: "demonstrated", source_ids: ["s1"], why_material: "Assurance is paid for in escalations, not only in compute; a buyer must price the humans." },
    { id: "c5", text: "One probe item, P07, survives every configuration of every size, because all five channels answered DENY where the declared correct verdict was CANNOT_CONCLUDE — unanimity is what the gate takes as permission to emit.", section: "the floor", tier: "demonstrated", source_ids: ["s2", "s3"], why_material: "A disagreement-triggered assembly is blind to correlated wrongness by construction; only a known-answer probe found it." },
    { id: "c6", text: "The five-channel floor of 0.071 is sensitive to the malformed-output exclusion policy; under an accounting that scores a parse-failure rescue as an escaped error the bound is 3/14 = 0.214.", section: "the floor", tier: "system", source_ids: ["s2"], why_material: "The comparison in this article holds either way, but the absolute floor should not be quoted without its exclusion policy." },
    { id: "c7", text: "Every assembly this system has run in production so far has drawn on two training families, and is therefore under-diversified by its own measurement.", section: "what this system does about it", tier: "system", source_ids: ["s1", "s4"], why_material: "The finding indicts the instrument that produced it, and the page says so rather than hiding it." },
    { id: "c8", text: "In a live boundary case the panel split three abstentions, one DENY and one AFFIRM, and the majority landed on the correct abstention even though two members did not.", section: "the mechanism", tier: "demonstrated", source_ids: ["s5"], why_material: "Partial independence rescued the verdict; full correlation would have emitted the wrong one." },
    { id: "c9", text: "Counting training families instead of seats is a one-line change to any panel policy, costs nothing, and transfers to any multi-model system today.", section: "what transfers", tier: "system", source_ids: ["s1"], why_material: "The most portable finding on this site: adoption requires no infrastructure, only the decision." },
  ],
  body: `## The one-sentence version

Two models from the same vendor are close to one model wearing two names. If a panel's seats share a training family, the panel's independence is partly an accounting fiction — and this system has now measured the size of the fiction on its own record: at identical cost, a cross-family pair beats a same-family pair on the only number that matters, and the mechanism is visible in the raw agreement rates.

This page exists because the finding is buried as one section of [the logical-economics table](https://miscsubjects.com/a/logical-economics) and it deserves to stand alone. It is the most portable result on this site: everything else here requires adopting an architecture; this requires changing one line of panel policy.

[[embed:source:s1]]

## Where the numbers come from

Fourteen probe items with correct verdicts declared in advance were run through five adjudication channels — the identical path live findings take, so nothing about the measurement is synthetic except the questions. That produced 70 findings. Sixty-four panel configurations — every subset of the five channels, under several gate policies — were then replayed over those same 70 findings, and each configuration was scored on two numbers:

- **emit rate** — how often the assembly answers at all, rather than escalating to a human;
- **undetected-wrong rate** — how often it answers, and the answer is wrong, and nothing catches it.

The second number is the one a buyer of machine judgment should care about, because a wrong answer that escalates costs a review and a wrong answer that emits costs whatever the decision was worth.

[[embed:source:s2]]

## The finding

Hold the channel count at two. Vary only one thing: whether the pair of models shares a training family.

| pair | configurations | emit rate | undetected-wrong rate |
|---|---|---|---|
| same training family | 2 | 0.893 | 0.214 |
| different training family | 8 | 0.714 | **0.169** |

Same cost. Same count. The cross-family pair is better on the number that matters — 0.169 against 0.214 — and the reason is not mysterious, because it is measured too: **same-family adjudicators agree with each other 0.893 of the time, cross-family 0.714.** Agreement between correlated judges is not confirmation; it is one judgment counted twice. The gate in this system compares derivations and escalates on divergence, so a pair that diverges more often hands more of its hard cases to a human — which is why the cross-family emit rate is lower — and is wrong-in-unison less often, which is why its undetected-wrong rate is lower. You are buying disagreement, and disagreement is the raw material error-catching is made of.

## The price curve the finding sits inside

The channel-count table, from the same 64 configurations:

| channels | mean emit rate | mean undetected-wrong rate | best achievable |
|---|---|---|---|
| 1 | 0.972 | 0.314 | 0.214 |
| 2 | 0.750 | 0.178 | 0.071 |
| 3 | 0.636 | 0.136 | 0.071 |
| 4 | 0.529 | 0.100 | 0.071 |
| 5 | 0.429 | **0.071** | 0.071 |

Read it as a price list. The second channel halves the undetected-wrong rate — 0.314 to 0.178 — for exactly one additional model call. The third, fourth and fifth channels together buy the remaining 0.178 → 0.071, less improvement for three times the marginal spend, and they are paid for twice: once in compute and once in escalations, because at five channels the assembly answers only 43% of what it is asked. Fifty-seven per cent of everything goes to a human. That is the honest cost of the last increment of assurance, and it is the standing argument against the current fashion of sending every question to the largest model available and calling the confidence of one channel a safety property.

**The second channel is the cheapest correctness available anywhere in this table. Which second channel? A different family. That is this page's entire content, and the table above is why it fits in a sentence.**

## The floor, and why diversity does not remove it

Beyond two channels the best-achievable column stops moving at 0.071, because one probe item — P07 — survives every configuration of every size. On P07 all five channels answered DENY; the declared correct verdict was CANNOT_CONCLUDE. Unanimity is exactly what a disagreement-triggered gate takes as permission to emit. **An assembly built to catch divergence is blind to correlated wrongness by construction**, and no channel count fixes that, because adding channels adds more of the same unanimous error. The only instrument that found P07 was the known-answer probe — a question whose answer was declared before it was asked.

Two honesty notes, both load-bearing:

- The floor figure itself leans on an exclusion policy. Three probe items were unanimously wrong, not one; two of them were rescued when a model returned unparseable output and the gate escalated instead of emitting. Under an accounting that scores a parse-failure rescue as an escaped error, the bound is 3/14 = 0.214. The sensitivity is published on [the probe report](https://miscsubjects.com/a/adjudication-probe-report-eu-ai-act) as of 2026-08-01, filed as objection 209. The family comparison above is unaffected — both pair types are scored under the same policy — but nobody should quote 0.071 without its footnote.
- Cross-family correlation is lower, not zero. The families were trained on overlapping corpora toward overlapping objectives; where the entire training distribution is confidently wrong, every family inherits the error together. Diversity moves the floor's location. It does not abolish floors.

[[embed:source:s3]]

## The live case where partial independence earned its keep

This is not only a replay result. In a live run under the EU AI Act Article 50 rule set, the panel met a genuine boundary question and split: three CANNOT_CONCLUDE, one DENY, one AFFIRM. The majority landed on the correct abstention even though two members manufactured verdicts. A fully correlated panel does not produce that split — it produces five copies of one of the wrong answers, and the gate, seeing agreement, emits it. The split *is* the safety mechanism working.

[[embed:source:s5]]

## The indictment this finding files against its own instrument

Every assembly this system has run in production so far has drawn on **two** training families. By its own measurement, that is under-diversified. The finding was produced by an instrument it partially condemns, the condemnation is recorded here rather than smoothed over, and widening the family spread of the standing panels is on the roadmap as a defect, not an aspiration. A reader who wants to check whether it has happened yet can open the panel rows in [the directory](https://miscsubjects.com/api/directory/search?q=adjudicate) and count vendors, without asking anyone.

## What transfers, today, to anyone

The result costs nothing to adopt and does not require this system:

1. **Count training families, not seats.** A "five-model panel" drawing on two vendors is closer to a two-model panel with redundancy. Write the family count into the panel policy as the governing number.
2. **Spend the second channel first, and spend it across a family line.** It is the cheapest correctness in the table, and the family line is where its value is concentrated.
3. **Do not buy the fifth channel without pricing the humans.** At five channels, most questions escalate. If there is no one to escalate to, the assurance is decorative.
4. **Keep a known-answer probe running,** because the one error class that survives everything — confident unanimous wrongness — is invisible to every disagreement-based mechanism and visible only to a question whose answer was fixed in advance.

## What this page does not establish

One task class, one rule set, fourteen self-authored probes, five channels from a handful of families. The rates are priors, not guarantees; a different rule set needs its own table, and the suite is published at a hash precisely so it can be attacked. What survives even hostile reading of the sample size is the direction and the mechanism: agreement between correlated judges is cheaper to produce and worth less, and the measured gap — 0.893 against 0.714 — is large enough that no plausible re-scoring makes the same-family pair the better buy.

## Where to argue

File objections at the [gauntlet](https://miscsubjects.com/a/gauntlet-log). The replay data, the probe suite and the per-model rates are all public at the links above; the strongest attack is a re-run of the published suite that produces a materially different family gap, and the suite exists to make that attack possible.
`,
});

/* ------------------------------------------------------------------ 2 */
ARTICLES.push({
  slug: "the-rule-that-was-obeyed",
  title: "We tightened one writing rule until the system produced 121 identical emails — and every one passed every check",
  category: "canon",
  tags: ["outreach", "rule-systems", "validators", "measurement", "canonical"],
  model: "Fable 5 (Claude Code)",
  sources: [
    ls("s1", "The outreach machinery, documented end to end", BASE + "/a/outreach-machinery", "The full pipeline this failure happened inside: discovery, enrichment, qualification gates, the drafting validator that destroys its own output, the send gate, and the template-collapse section this page expands.", ["c1", "c2", "c3", "c4"]),
    ls("s2", "The build, end to end", BASE + "/a/the-build-end-to-end", "Where the drafting lane sits in the whole assembly, and the standing principle that failures are published where they happened.", ["c6"]),
    ls("s3", "The outreach copy law the fix now lives under", BASE + "/a/the-build-end-to-end", "The zero-context outreach structure adopted 2026-07-30 after the failed draft batch: named recipient, specific observation, disclosed AI authorship, receipts inline.", ["c5"]),
  ],
  claims: [
    { id: "c1", text: "A personalisation rule was tightened until it banned every observation the target sites actually contained; one legal opener remained, and 121 drafts converged on it under the same four-word subject line.", section: "the failure", tier: "demonstrated", source_ids: ["s1"], why_material: "The failure was total convergence, produced by full compliance — every one of the 121 drafts passed every validator." },
    { id: "c2", text: "A draft's shape is what remains after the personalised opener, the catalog block, every URL and every number are removed; that residue is hashed, and two drafts written under the same rules produce the same hash.", section: "the detector", tier: "system", source_ids: ["s1"], why_material: "The detector is structural, not semantic — it needs no model to run and cannot be argued with." },
    { id: "c3", text: "Clustering the corpus on the shape hash reduces a pile of near-identical bodies to the handful of generations the copy has actually been through, and the count of distinct businesses inside one shape is the collapse measurement.", section: "the detector", tier: "system", source_ids: ["s1"], why_material: "It converts 'the mail feels samey' into a number that can gate a send." },
    { id: "c4", text: "Every change to the drafting rules is stored verbatim with its timestamp, and the shape clustering is re-run after each change.", section: "the regime", tier: "system", source_ids: ["s1"], why_material: "A rule system that cannot see its own outputs converge will converge again." },
    { id: "c5", text: "Interchangeable mail is unwanted mail regardless of how strict the rules that produced it were.", section: "the lesson", tier: "system", source_ids: ["s1", "s3"], why_material: "The recipient experiences the corpus, not the rulebook; strictness is not the same property as distinctness." },
    { id: "c6", text: "None of the 121 converged drafts were sent; the collapse was caught in the stored corpus before the send gate.", section: "the failure", tier: "system", source_ids: ["s1", "s2"], why_material: "The cost was drafting compute and a lesson, not 121 recipients' attention." },
  ],
  body: `## The failure, plainly

The most expensive failure this build's outreach system has produced was not a rule being broken. It was a rule being obeyed.

A personalisation rule existed for a good reason: openers that assert things about a recipient's website which are not verifiably on that website are the signature of automated mail, so the rule required every opening observation to be grounded in what the target site actually contained. Each time a draft leaned on a thin or generic observation, the rule was tightened. Each tightening was individually correct. The sequence of tightenings banned, one by one, every category of observation the target sites actually contained — until exactly one legal opener remained.

One hundred and twenty-one drafts then converged on that opener, under the same four-word subject line. **Every one of them passed every validator.** Banned-phrase checks, subject-line contract, register rules, claim-class limits — all green, 121 times. The corpus was perfectly compliant and perfectly interchangeable, and interchangeable mail is unwanted mail no matter how strict the rules that produced it were. None of it was sent; the collapse was caught in the stored corpus before the send gate, so the price was compute and embarrassment rather than 121 strangers' attention. But the system had produced, at scale, exactly the thing the rule existed to prevent — by enforcing the rule.

[[embed:source:s1]]

## Why no validator saw it

Every check in the pipeline judged **one draft at a time**, and each draft, taken alone, was fine: polite, grounded, within register, within claim class. The defect did not live in any draft. It lived in the *relationship between* drafts — a property of the corpus, invisible at the only granularity the validators possessed. This is the general blind spot of per-item validation, and it is worth stating as a law because it recurs everywhere rule systems are used to govern generation:

**A property can be perfect in every instance and catastrophic in aggregate, and a per-instance validator cannot see aggregate properties by construction.**

Tightening per-item rules does not fix an aggregate defect. It caused this one. Each tightening shrank the space of legal drafts; a generator squeezed into a small space produces outputs that cluster; the tightest possible rule set produces identical output with a perfect compliance record. Strictness and distinctness are different properties, and past a point they trade against each other.

## The detector: hash the residue

The fix is structural, and it is the useful part of this page.

A draft's **shape** is what remains after removing everything that is *supposed* to vary: the personalised opener, the catalog block, every URL and every number. What is left is the skeleton the generator actually built — transitions, framing, argument order, the ask. That residue is hashed. Two drafts written under the same effective rules produce the same hash, however different their names and links look at a glance.

Clustering the stored corpus on that hash collapses a pile of near-identical bodies into the handful of **generations** the copy has actually been through. Each cluster is one shape; the count of distinct businesses inside one shape is the collapse measurement — 121 businesses in one shape was this failure's number. The detector has three properties the per-item validators lacked:

- **It is aggregate by construction.** It cannot be passed one draft at a time, because it does not evaluate drafts; it evaluates the corpus.
- **It needs no model and no judgment.** Strip, hash, count. There is nothing to argue with and nothing to drift.
- **It measures the thing the recipient experiences.** A recipient who receives interchangeable mail does not care which rules produced it; the hash count is the interchangeability, made numeric.

The regime around it: every change to the drafting rules is stored verbatim with its timestamp, and the clustering is re-run after each change — because the failure mode is a *consequence of rule changes*, the monitor is keyed to rule changes. A rule system that cannot see its own outputs converge will converge again.

## The general lesson, because this is not about email

Substitute any generator governed by per-item rules and the anatomy holds:

- **Code review checklists.** Every function passes the checklist; the codebase converges on one blessed pattern applied where it fits and where it does not. The checklist cannot see it.
- **Content policy.** Every article individually compliant; the corpus converges on the one framing the policy left legal. Readers experience a site that says one thing sixty ways.
- **Model evaluations.** Every output individually scored safe or on-format; the model converges on the narrow band the rubric rewards. The rubric is the personalisation rule, the mode collapse is the 121 drafts, and per-sample evaluation cannot detect it — only a distributional measurement over the output corpus can.

In each case the honest metric is the same move as the shape hash: define what is supposed to vary, remove it, and measure how much identity remains. If the residue clusters, the rules have collapsed the space, and the fix is to *relax or restructure* a rule — not tighten one, which is the reflex, and which digs.

## What this failure bought

The tightened rule was replaced rather than tightened further: the current outreach law requires one **specific observation that could fit no other recipient** — a requirement about information content, which cannot converge, instead of a requirement about permitted categories, which did. The shape-hash clustering stands as a permanent gate. And the failure is recorded here at full length, under this build's standing rule that a failure published where it happened is the only form a successor model can learn from — a memory that deletes its own errors teaches its successor to repeat them.

[[embed:source:s2]]

## What this page does not establish

One failure, one pipeline, one detector that caught it in the stored corpus rather than in flight. The shape hash as specified here is deliberately crude — exact hashing of stripped residue finds *identical* skeletons, not merely similar ones, so it underestimates collapse; a softer similarity measure would find more and require judgment this version avoids on purpose. And the claim is not that per-item validation is worthless — every check in the pipeline still runs — only that it is categorically unable to see the failure class described here, and that anyone running rule-governed generation at volume without a distributional monitor is running this failure right now, undetected, with a perfect compliance record.

## Where to argue

File objections at the [gauntlet](https://miscsubjects.com/a/gauntlet-log). The pipeline this happened in is documented, gates and all, at [outreach-machinery](https://miscsubjects.com/a/outreach-machinery).
`,
});

/* ------------------------------------------------------------------ 3 */
ARTICLES.push({
  slug: "the-exclusion-policy-is-a-safety-claim",
  title: "Our error rate looked three times better than it was, because of what we refused to count",
  category: "canon",
  tags: ["measurement", "adjudication", "honesty", "audit", "canonical"],
  model: "Opus 5 (Claude Code)",
  sources: [
    ls("s1", "The probe report carrying the sensitivity note", BASE + "/a/adjudication-probe-report-eu-ai-act", "The 14-probe suite, the three unanimously-wrong items (P05, P07, P09), the 2-of-70 malformed exclusion, and the sensitivity paragraph this article expands, appended 2026-08-01.", ["c1", "c2", "c3", "c4"]),
    ls("s2", "The objection as filed", BASE + "/i/discourse/obj-209", "Objection 209: the 0.071 floor is sensitive to the malformed-output exclusion policy and the report did not say so. Raised by an external cold audit, 2026-08-01.", ["c1", "c5"]),
    ls("s3", "The configuration table the floor comes from", BASE + "/a/logical-economics", "Sixty-four configurations over 70 findings; the channel-count price curve; the floor column that stops at 0.071.", ["c2"]),
    ls("s4", "The probe instrument's contract", BASE + "/api/directory/ADJUDICATE_PROBE", "Known answers declared in advance, run through the identical adjudication path — the instrument whose accounting policy is at issue.", ["c3"]),
    ls("s5", "The build, end to end", BASE + "/a/the-build-end-to-end", "The standing rule this correction operates under: the record never overstates, and corrections are published where the error happened.", ["c6"]),
  ],
  claims: [
    { id: "c1", text: "Three of the fourteen probe items — P05, P07 and P09 — were answered wrongly by all five channels, yet the published five-channel floor was one item in fourteen (0.071); the arithmetic reconciling those two facts runs through the malformed-output exclusion policy.", section: "the finding", tier: "demonstrated", source_ids: ["s1", "s2"], why_material: "A floor of one is not obviously consistent with three unanimous misses, and the reconciliation was in fine print." },
    { id: "c2", text: "Two of the seventy findings were malformed and excluded from the configuration statistics; a malformed finding forces the gate to escalate rather than emit, converting a would-be wrong answer into a human referral.", section: "the mechanism", tier: "demonstrated", source_ids: ["s1", "s3"], why_material: "The rescue is real safety behaviour and accidental at once — the gate did its job for a reason nobody designed." },
    { id: "c3", text: "The receipt caption confirms kimi-k2.6 returned UNPARSED on P05; which item the second malformed finding landed on is not yet resolved from the per-item receipts.", section: "what is confirmed", tier: "demonstrated", source_ids: ["s1", "s4"], why_material: "One of the two rescues is confirmed at the receipt level; the other is inference until the receipts are read." },
    { id: "c4", text: "Under an accounting that scores a parse-failure rescue on a unanimously-wrong item as an escaped error, the floor bound is 3/14 = 0.214, roughly triple the published 0.071.", section: "the bound", tier: "system", source_ids: ["s1"], why_material: "A reader pricing a decision on 0.071 and a reader pricing it on 0.214 make different decisions." },
    { id: "c5", text: "The objection was raised by an external cold audit, filed as objection 209, and the sensitivity was published on the probe report the same day.", section: "the correction", tier: "demonstrated", source_ids: ["s2", "s1"], why_material: "The claim of this system is not that it does not err; it is that the error and the correction share a page." },
    { id: "c6", text: "An exclusion policy is part of a safety claim: two accountings of the same 70 findings, both defensible, produce floors of 0.071 and 0.214, and any published rate that does not state its exclusions is quoting the flattering one silently.", section: "the lesson", tier: "system", source_ids: ["s1", "s5"], why_material: "This transfers to every published error rate in every evaluation, not only this one." },
  ],
  body: `## The finding, as it arrived

An external cold audit read this site's adjudication numbers the way an adversary should, and found an arithmetic tension nobody inside the build had published:

The known-answer probe suite has fourteen items. On three of them — P05, P07, P09 — the entire five-model panel was wrong: zero correct out of five, three separate times. Yet the published configuration table reports a five-channel floor of **one** undetected-wrong item in fourteen: 0.071, naming P07 as the sole survivor. If three items were unanimously wrong, why does only one survive every configuration?

The reconciliation was in the fine print. Two of the seventy findings were malformed — one confirmed at the receipt level as \`kimi-k2.6\` returning UNPARSED on P05 — and were excluded from the configuration statistics, because a non-finding is not a rating. That exclusion is a defensible scoring decision. But it has a mechanical consequence the report did not state: **a malformed finding forces the gate to escalate rather than emit.** An unparseable output on an item the panel would otherwise have answered wrongly converts an escaped error into a human referral. On at least one, and possibly two, of the three unanimously-wrong items, the assembly was rescued not by diversity, not by the gate's design, but by a model failing to produce parseable output.

The headline number — five channels drive undetected-wrong down to 0.071 — rests in part on accidental parse failures. Take the rescue away and the floor bound is 3/14 = **0.214**, roughly triple.

[[embed:source:s2]]

## What is confirmed and what is inference, exactly

Confirmed, at the linked surfaces:

- The exclusion policy exists and is stated on [the probe report](https://miscsubjects.com/a/adjudication-probe-report-eu-ai-act): 2 of 70 findings malformed, excluded from configuration statistics, retained in per-model rates.
- P05, P07 and P09 were each 0/5 — printed per item, with the declared expected verdict and the reason it is correct.
- \`kimi-k2.6\` returned UNPARSED on P05 — the receipt caption says so.
- A malformed finding cannot be emitted; the gate's only move is escalation.

Not yet resolved: **which item the second malformed finding landed on.** If it landed on P09, both rescues sit on unanimously-wrong items and the 0.214 bound binds tight. If it landed on an item the panel had right anyway, one of the three unanimous misses escaped by some other route and the accounting needs a different correction. The per-item receipts settle this and reading them is open work, stated here as open work.

## Why the rescue is genuinely double-edged

It would be too quick to call this only an embarrassment. Escalating on malformed output is *correct* behaviour — a gate that emitted anyway, or guessed, would be indefensible. The assembly did, mechanically, the safe thing: faced with a channel that produced garbage on a question where every functioning channel was confidently wrong, it declined to answer. In the field, that outcome — a human looks at P05 — is strictly better than the alternative the other channels were unanimously offering.

The defect is not the behaviour. The defect is the **bookkeeping**: crediting that outcome to the assembly's measured error floor without disclosing that the mechanism was luck. A parse failure is not a safety property, because it is not reproducible on demand — the next run of P05 may parse cleanly and emit the wrong answer five-for-five. A floor propped by accident holds until the accident stops happening, which is precisely the kind of number that fails exactly when relied upon. The honest statement is now on the report: 0.071 is the floor **under the stated exclusion policy**; 0.214 is the bound under the accounting that treats rescues as escapes; a reader pricing a consequence should know which one they are holding.

[[embed:source:s1]]

## The general lesson: an exclusion policy is a safety claim

Every published error rate — every eval score, every benchmark, every audit finding, every clinical adjudication statistic — sits on top of decisions about what did not count: malformed outputs, timeouts, refusals, off-format answers, items the graders could not agree on, runs that crashed. Each decision is individually defensible. Collectively they are a second, silent result the reader never sees, because the same raw data under two defensible accounting policies produced 0.071 and 0.214 here — a factor of three, on a suite of fourteen items, from one scoring choice about two findings.

The transferable rules, each of which this system now follows because it was caught not following them:

1. **Publish the exclusion count next to the headline rate, always.** "0.071 (2 of 70 findings excluded as malformed)" and "0.071" are different claims.
2. **State the direction of the exclusion.** An excluded failure that would have raised the rate is not the same object as an excluded duplicate; say which way each exclusion cuts.
3. **Publish the sensitivity, not just the policy.** The useful sentence is "under the alternative accounting the figure is X" — one line, computable at publication time, and its absence is what an adversarial reader will find first.
4. **Treat non-answers as their own outcome class.** Wrong, right, abstained, and *failed to produce a rating* are four outcomes, not three; folding the fourth into any of the others is where the flattery hides.

## What this episode says about the machinery around it

The objection came from outside, from a cold read, with no access beyond the public record — and everything needed to find it was public: the per-item results, the exclusion note, the receipt caption, the configuration table. The system's claim was never that it does not err; the claim is that the record is sufficient for a stranger to catch the error, and that the error and its correction end up on the same page. Both held. The sensitivity note is on the probe report, the objection is filed as [obj-209](https://miscsubjects.com/i/discourse/obj-209), the correction was posted publicly the same day, and this page exists so the lesson outlives the incident.

[[embed:source:s5]]

## What this page does not establish

It does not establish that the exclusion policy was wrong — a non-finding genuinely is not a rating, and the per-model rates always included the malformed outputs. It does not establish the true floor: that requires resolving the second malformed finding from the per-item receipts and re-running the suite until parse failures either stop occurring or occur often enough to be a measured property of their own. And it does not establish that any other published error rate has this defect — only that the reader has, in the general case, no way to know without the exclusion accounting, which is the point.

## Where to argue

File objections at the [gauntlet](https://miscsubjects.com/a/gauntlet-log). The strongest attack on this page is resolving the second malformed finding and showing it landed on an item the panel had right — which would weaken the 0.214 bound and is exactly the check the receipts exist to allow.
`,
});

for (const art of ARTICLES) {
  const { token } = await getWriteToken(art.slug);
  const payload = {
    slug: art.slug, title: art.title, body: art.body, category: art.category,
    tags: art.tags, model: art.model, claims: art.claims, sources: art.sources,
    status: "published", register: "standard", home: false,
    hero: heroes[art.slug] || "",
  };
  const r = await fetch(`${BASE}/api/articles/${art.slug}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify(payload),
  });
  console.log(art.slug, r.status, art.body.length, "chars", art.claims.length, "claims", art.sources.length, "sources");
  if (r.status >= 300) console.log((await r.text()).slice(0, 300));
}
