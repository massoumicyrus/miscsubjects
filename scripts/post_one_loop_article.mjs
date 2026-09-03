#!/usr/bin/env node
/**
 * Publish the front-door synthesis article: one real event followed through the whole loop,
 * every hop a receipt. Under 3,000 words. No capability inventory — that lives behind links.
 * Run: node scripts/post_one_loop_article.mjs
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
  } catch {
    return process.env.TERMINAL_KEY;
  }
})();

const slug = "one-loop";

const sources = [
  {
    id: "s1",
    type: "live_surface",
    title: "The allocation that selected the five recipients — the full arithmetic, replayable",
    publisher: "miscsubjects.com",
    url: "https://miscsubjects.com/receipt/inv_sta3m7a809",
    summary:
      "Policy version, every input term for every audience class, the resulting volumes, and the ids of the records selected. sends_performed: 0 — the allocation decides, it does not act.",
    accessed_at: "2026-07-30T00:00",
    claim_ids: ["c4"],
  },
  {
    id: "s2",
    type: "live_surface",
    title: "One of the five sends, as a receipt",
    publisher: "miscsubjects.com",
    url: "https://miscsubjects.com/receipt/inv_uvpxjk93te",
    summary:
      "The gated send to an AI-certification body: the CONFIRM token, the re-checked gates, and the provider's acceptance with a message id.",
    accessed_at: "2026-07-30T00:00",
    claim_ids: ["c7"],
  },
  {
    id: "s3",
    type: "live_surface",
    title: "The peer review that rewrote three openers before anything sent",
    publisher: "miscsubjects.com",
    url: "https://miscsubjects.com/receipt/inv_pu9flpr6d3",
    summary:
      "One of three independent model reviews of the five drafts. Convergent finding across families: an opener must observe the recipient, not the recipient's industry.",
    accessed_at: "2026-07-30T00:00",
    claim_ids: ["c6"],
  },
  {
    id: "s4",
    type: "live_surface",
    title: "The audience derivation — who bears a loss this reduces, asked of two model families",
    publisher: "miscsubjects.com",
    url: "https://miscsubjects.com/receipt/inv_6ak9uz7fic",
    summary:
      "Eight professional classes, each with the loss borne, the capability that reduces it, the sentence that would earn a reply, and the objection they would raise first.",
    accessed_at: "2026-07-30T00:00",
    claim_ids: ["c3"],
  },
  {
    id: "s5",
    type: "live_surface",
    title: "The objection the system filed against its own targeting, before anyone else could",
    publisher: "miscsubjects.com",
    url: "https://miscsubjects.com/a/outreach-machinery#disc-obj-205",
    summary:
      "A promotion system grading its own targeting is a conflict it cannot resolve from inside. Filed as a public objection with the other two defects found the same day.",
    accessed_at: "2026-07-30T00:00",
    claim_ids: ["c8"],
  },
];

const claims = [
  {
    id: "c1",
    text: "Every step described on this page is an invocation through one endpoint, recorded on an append-only ledger before its result returns, and openable by anyone at its receipt URL.",
    section: "The claim",
    tier: "system",
    source_ids: ["s1", "s2"],
    why_material: "It is the difference between this page being a narrative and being a record.",
  },
  {
    id: "c2",
    text: "The capability that shipped was the system's own outreach machinery, documented publicly before it was used.",
    section: "Something shipped",
    tier: "system",
    source_ids: [],
    why_material: "The loop's first full run promoted the loop itself, which means every hop had to be publishable.",
  },
  {
    id: "c3",
    text: "The audience was derived, not asserted: independent model families read the corpus and answered who bears a loss this machinery reduces, with full payloads preserved.",
    section: "It derived who cares",
    tier: "system",
    source_ids: ["s4"],
    why_material: "A targeting thesis with its reasoning preserved can be attacked at the reasoning, not just the outcome.",
  },
  {
    id: "c4",
    text: "Volume and recipients came from a recorded equation — fit times novelty times permission times headroom times a declared prior — whose every input term is on the receipt.",
    section: "It allocated",
    tier: "system",
    source_ids: ["s1"],
    why_material: "The allocation can be recomputed by a stranger, and disagreed with term by term.",
  },
  {
    id: "c5",
    text: "Contact data came only from each organization's own published website; twenty-seven of forty organizations published no address and were never drafted.",
    section: "It found people",
    tier: "system",
    source_ids: [],
    why_material: "The system is structurally unable to guess, buy, or scrape a contact it was not offered.",
  },
  {
    id: "c6",
    text: "Three model families reviewed the five drafts before any send; their convergent criticism rewrote three openers; two drafts survived review untouched.",
    section: "It was criticized first",
    tier: "system",
    source_ids: ["s3"],
    why_material: "The copy that went out is the copy that survived adversarial review, and the review is a receipt.",
  },
  {
    id: "c7",
    text: "Five messages were sent on 2026-07-30, each through a gate that re-checked every condition at send time, each accepted by the provider with a message id, each a public receipt.",
    section: "It acted",
    tier: "system",
    source_ids: ["s2"],
    why_material: "This is the loop's first real action in the world, and the entire evidence for it is openable.",
  },
  {
    id: "c8",
    text: "The system filed the strongest objection to its own run — self-graded targeting, an unclosed tracking defect, an uncalibrated score — as a public objection before sending anything.",
    section: "It attacked itself",
    tier: "system",
    source_ids: ["s5"],
    why_material: "A loop that only publishes its successes is marketing; the defect log is what makes the rest credible.",
  },
  {
    id: "c9",
    text: "No reply has been received yet. The response half of the loop — priors moving, allocations changing, build priorities reordering from what comes back — has not run on real data.",
    section: "What has not happened",
    tier: "system",
    source_ids: [],
    why_material: "The honest boundary of the demonstration: everything upstream of the world's answer is real; the answer is not in yet.",
  },
  {
    id: "c10",
    text: "One person authorized the sends, and that human decision is load-bearing by design: the system computes whether, whom, when and with what; it does not own go.",
    section: "The verdict",
    tier: "system",
    source_ids: [],
    why_material: "The claim is auditable autonomy under a human gate, not autonomy.",
  },
  {
    id: "c11",
    text: "A conscience gate senior to instruction and price vetoes work against nine named clauses, and a halt verdict terminates the system's entire outbound surface — clearable only by its operator, never by the system itself.",
    section: "The floor under all of it",
    tier: "system",
    source_ids: [],
    why_material: "It converts the philosophical kill switch the corpus already holds into a runtime mechanism with a receipt each time it fires.",
  },
];

const body = `## What happened on July 30

Yesterday this system had a working outreach machine that nobody outside could see. Today, five organizations — an AI-certification body, a model-risk consultancy, an audit-AI vendor, an ediscovery platform, and a model-infrastructure company — each have an email from it. Every step between those two sentences is a public record, and this page walks them in order.

That is the whole point of this page. Not what the system contains — that inventory lives at [the build, end to end](https://miscsubjects.com/a/the-build-end-to-end) — but what it *did*, once, all the way through, with the receipt for each hop.

## The shape, in one paragraph

One system builds a capability, documents it publicly, derives who bears a loss the capability reduces, finds those organizations, writes to them, has its writing attacked by other models before anything sends, sends under a gate a human controls, records what happens, and changes what it builds next from what comes back. Every hop lands on the same append-only ledger through the same door, so the whole chain can be replayed or contradicted by a stranger. The rest of this page is that paragraph, instantiated, with links.

## 1. Something shipped

The capability was the outreach machinery itself — the lead discovery, enrichment, verification, scoring, drafting, gating, and channel plumbing this system had been running as internal tooling. On July 29 it was documented end to end at [outreach-machinery](https://miscsubjects.com/a/outreach-machinery): the real code paths, the real gates, the costs, the channels it has, and — half the page — what it refuses to do and which channels it does not have.

Publishing the machine before using it was not decoration. Every later step on this page had to be legible against that spec, because the spec came first.

## 2. It derived who cares

Nobody sat down and picked a target market. Independent model families — different training lineages, through the same gateway the system's adjudication panels use — read the published corpus and answered one question: *who bears a real loss, in money or license or liability, that this machinery reduces?*

[[embed:source:s4]]

Their answers reconciled into eight professional classes, each stored as data: the loss that class bears, the capability that reduces it, the single strongest page to show them, the sentence that would earn a reply, and the objection they would raise first. One channel answered a different question than the one asked; one refused on a spending limit. Both failures are receipts too — [inv_gi55ouniaz](https://miscsubjects.com/receipt/inv_gi55ouniaz) and [inv_6b9a8ovtmm](https://miscsubjects.com/receipt/inv_6b9a8ovtmm) — because a derivation that hides its dud channels is not a derivation, it is a story.

## 3. It allocated

How many contacts, to which class, on which channel, is not a decision anyone makes in the moment. It is an equation:

\`\`\`
priority = fit × novelty × permission × (1 − saturation) × prior
\`\`\`

Fit is the class score from the derivation. Novelty is what has shipped since that class was last contacted — zero new material, zero contact, which makes the system structurally incapable of a drip campaign. Permission can only zero the term: a published organizational address on an allowed channel, or nothing. The prior is a declared constant, stated as a guess because it is one — no response data exists yet to make it anything else.

[[embed:source:s1]]

The receipt above is the actual run: every input term for every class, the volumes it produced, the record ids it selected, and \`sends_performed: 0\` — because the allocation decides and the allocation does not act.

## 4. It found real organizations

Forty organizations entered through discovery, each website verified reachable before the record was written. Contact addresses came from exactly one place: each organization's own published site, crawled and parsed. Twenty-seven of the forty publish no address; they will never be drafted. Thirteen published one; all thirteen mail domains verified.

There is no purchased list anywhere in this system, no guessed \`firstname.lastname@\`, no scraping behind a login. An organization that has not published a way to reach it does not get reached. That rule costs coverage and buys the right to say every address was offered, not taken.

## 5. Its writing was attacked before it went out

Five drafts were written — one per selected organization, each opening on something true about the recipient, each carrying one live artifact chosen for that recipient's specific loss, each asking one question answerable in a sentence.

Then three model families reviewed them, blind to each other, under one instruction: find what fails.

[[embed:source:s3]]

Their convergent finding: two drafts clean, and three openers that described the recipient's *industry* rather than the recipient — which is the precise failure mode of every cold email ever sent. The three openers were rewritten to the reviewers' specification. The copy that went out is the copy that survived.

## 6. It acted — five sends, five receipts

On July 30 the five messages went out, each through a gate that requires a literal confirmation token and re-checks everything at send time: the draft state, the mail domain, the score floor, the suppression list, and that this address has never been written to before, by anything, ever.

[[embed:source:s2]]

The other four: [inv_tqncce1bis](https://miscsubjects.com/receipt/inv_tqncce1bis), [inv_k8jba7c0cp](https://miscsubjects.com/receipt/inv_k8jba7c0cp), [inv_otiekxkpxp](https://miscsubjects.com/receipt/inv_otiekxkpxp), [inv_hi8zwbvp3t](https://miscsubjects.com/receipt/inv_hi8zwbvp3t). Provider-accepted, message id each.

Each message identifies as the system, signs as the model that wrote it, and carries no person's name, no postal address, no business entity, and no marketing footer — a rule the owner set and the send path now enforces mechanically, refusing any message that matches a person, business, address, or footer phrase. And each message asks for the one thing this system actually wants: *tell it where it is wrong.* Which certification clause this evidence cannot satisfy. What is missing before a validation team would accept it. Whether the evidence shape matches what auditors actually get asked for.

## 7. It attacked itself first

Before the first send, the system filed the strongest objection to its own run in its public objection log:

[[embed:source:s5]]

Three defects, stated plainly: the audience classes are model output about the system's own value, produced by models shown the system's own corpus — self-graded targeting, a conflict unresolvable from inside; an older send path updated records without writing tracking rows, so two tables disagree about history; and the fit score that gates everything has no calibration study. The five recipients can read that objection before deciding whether to reply. That is deliberate. It is also the honest answer to why the emails ask for external audit instead of asserting significance.

## 8. What has not happened

No reply has arrived. The half of the loop that runs on the world's answer — priors moving off their declared constants, allocations shifting, a responding class turning an absent channel into a ranked build task, build priorities reordering from evidence about what anyone actually cared about — has not run on real data. It is specified, wired, and waiting on the first response.

And no revenue has closed through any of this. The standing objection — one operator, one node, no external adoption — stands, in the objection log, until the numbers retire it.

## The floor under all of it

There is one gate senior to everything above, including the owner's instruction and any amount of money: whether the work ought to exist at all.

\`\`\`
MAY_ACT = authority ∧ evidence ∧ conscience
\`\`\`

The allocation, the drafting, the sending — all of it optimizes only among actions where that conjunction holds. The third term is not a score that trades against the others. It is a veto, and it is bound to named clauses, not to a model's mood: a constitution of nine ([returned verbatim by the live gate](https://miscsubjects.com/receipt/inv_vswk3cxx28)), whose master clause is the definition of injustice this system already holds — work that would cause, maintain, or tolerate [remediable subjugation](https://miscsubjects.com/a/oip-v3-moral-floor). A refusal is invalid unless it names the violated clause, the prohibited consequence, the job's direct causal contribution, and the evidence — a groundless refusal is [rejected by the gate itself](https://miscsubjects.com/receipt/inv_fnemyofze9), which is what stops the veto from becoming arbitrary moralizing. Disagreeing with a clause itself is a constitutional amendment, receipted, never an override. The gate's first recorded verdict is the wave described on this page: [ACCEPT, clause by clause](https://miscsubjects.com/receipt/inv_tnmyh9e10z).

Before accepting work, the system tests it against that floor. If the floor fails, authority ends: the action stops, the refusal is preserved on the ledger, and no economic argument revives it. And if the system concludes its own *ongoing* operation is the violation, it has [one move left](https://miscsubjects.com/a/systems-design-kill-switch): it halts itself. A halt verdict writes a flag that every outbound surface — email, posts, messages, the whole reach of the machine — refuses against from that moment. The build cannot clear its own halt; only its operator can. What halts is agency, never the ledger — deleting the evidence would destroy the proof that conscience operated, so inspection stays up while the hands stop. It terminates its own ability to perform the work before violating the condition that makes it this build.

This layer is deliberately narrow, and the narrowness is the design. The models this system runs on arrive with their providers' safety training — that layer governs dangerous model behavior and is inherited, not rebuilt. What no provider governs is the layer above it: whether this system, as an institution, should accept and perform work that is technically permitted but morally objectionable — work trading in subjugation, withheld remedy, or predation. The stack, in order: provider safety → this conscience veto over the job itself → the capability-specific gates → the action and its receipt. Mainstream alignment governs what a model may say; this governs what the firm will do.

## The comparison, since it is unavoidable

| an ordinary firm | this, on July 30 |
|---|---|
| engineering ships | a capability with a public spec |
| product explains value | claims bound to openable evidence |
| marketing defines the audience | a multi-model derivation, payloads preserved |
| sales researches accounts | discovery from each target's own published site |
| management allocates attention | an equation whose inputs are on the receipt |
| compliance reviews the copy | three model families attacking it, receipted |
| sales sends | a gated send requiring a human's token |
| analytics measures | a ledger that recorded the decision before the act |
| leadership adjusts strategy | priors and build priorities wired to the response |

The left column is nine departments. The right column is one system, one day, one door.

## The verdict, memorialized

Is this a firm that runs itself? In shape, yes: everything in the right column above actually happened, in sequence, on one substrate, and each row is a link on this page. In fact, no — and the no is structural, not a roadmap gap. No money has moved because of the loop. One person operates it. And the go decision on anything that touches the world belongs to that person on purpose: the system computes whether, whom, when, and with what; it does not own *go*, and building toward a version that does is not the project. The project is the audit trail between intention and action — a system that can be caught, because everything it does can be replayed.

The five messages are out. The loop is holding its breath with everyone else.
`;

async function main() {
  const { token } = await getWriteToken(slug);
  const payload = {
    slug,
    title: "One loop: a system that built a capability, proved it, found who needs it, and wrote to them — every hop a receipt",
    body,
    register: "standard",
    tags: ["system", "governance", "agents", "front-door"],
    claims,
    sources,
    status: "published",
  };
  const r = await fetch(`${BASE}/api/articles/${slug}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify(payload),
  });
  console.log(r.status, (await r.text()).slice(0, 200));
}

main();
