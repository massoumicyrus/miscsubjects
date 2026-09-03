---
name: self-promotion
description: The build's standing procedure for promoting itself — deciding whether, whom, when, on which channel, and with which artifact to make contact whenever something ships or a reply lands. Governs the allocation, not the copy (outreach-law governs the copy). Load whenever a new article, capability, receipt, resolved defect, or inbound reply changes what the build has to show someone, or when planning any post, email, or paid spend about the build itself.
---

# Self-Promotion

The build promotes itself the way it does everything else: the decision is computed from recorded inputs, the computation lands on the ledger before the action, and the person selected can open the arithmetic that selected them. This skill governs **whether, whom, when, on which channel, and with which artifact**. It never governs the copy — `outreach-law` owns every sentence of any first contact, and `post-to-x` owns the X voice.

The machinery this skill drives is documented publicly at https://miscsubjects.com/a/outreach-machinery — discovery, enrichment, verification, scoring, drafting, review, the send gate, tracking, channels, creative generation, the paid rows, and the gap list. Read that page as the capability inventory; read this skill as the decision procedure over it.

## Trigger

Load when any of these happens:

- something ships — an article, a capability row, a receipt worth showing, a resolved defect, a measurement
- a reply, opt-out, complaint, or reviewer verdict lands
- anyone plans a post, email, message, or paid spend about the build
- a new audience class is proposed, or an existing class's evidence changes

## Resolve in order

1. What shipped, and which audience classes is it actually relevant to? None → stop. No contact happens on zero novelty.
1. For each moved class: what is now the single strongest artifact to show them — the newest receipt, page, or measurement that speaks to *their* loss?
1. Does the allocation change? Run it; do not estimate it. The equation and its terms are on the outreach-machinery page; the run writes its full arithmetic to the ledger before anything else may happen.
1. Is every selected contact permitted? Published organizational address, never contacted before, not suppressed, channel appropriate (cold contact is email only — messaging channels are reply and warm channels; X and Reddit are broadcast and public reply, never cold DM).
1. Has the owner reviewed the exact body of every first contact to a class? No send without it.
1. Does the outbound message carry its own selection receipt — the token link that lets the recipient open why they were chosen?
1. Does it ask the three questions instead of asserting significance?
1. After anything public: is it signed `— <Model> (<surface>)`?

## Law

- **SP01 · Novelty gates contact** — No new relevant material for a class means no contact with that class. The novelty term can only zero the allocation, never inflate it. The build is structurally incapable of a drip sequence, and any change that would let it run one is a violation, not a feature.
- **SP02 · The allocation is computed, recorded, then acted on** — Whom to contact, how many, on which channel, with which artifact is the output of the allocation equation, run against stored class rows, written to the ledger as one object (policy version, every input term, the resulting volumes, the selected record ids) before any draft is written. An allocation that cannot be replayed cannot be acted on.
- **SP03 · Permission is a gate, not a weight** — A published organizational address on a permitted channel, or nothing. Suppressed means never again. One address is contacted at most once without a reply, ever. No purchased lists, no guessed addresses, no cold direct messages on any channel, no scraping behind a login.
- **SP04 · The recipient can open why** — Every outbound message links the arithmetic that selected its recipient, audience-bound so only they can open it. Class-level allocations are public; a named recipient's record never is.
- **SP05 · Ask, don't assert** — The message asks the three questions: where is this most commercially valuable and to whom; what is the strongest objection the gauntlet log does not already contain; which of the build's claims about itself do not survive contact with your practice. Significance is theirs to judge, and their answer is recorded, attributed, wherever it lands.
- **SP06 · Signal moves two things** — What comes back (replies, stops, complaints, reviewer verdicts, traffic, fetches of machine-readable surfaces, paid metrics) updates the class priors AND the gap list. A class that responds through a channel the build lacks turns that absence into a ranked build task. Promotion output steers build input; that edge is the point.
- **SP07 · Owner review before first contact** — No first contact to any class without the owner having reviewed the exact recipient, subject, and body. The CONFIRM token, the never-twice check, the postal-address and domain-authentication preconditions all stay exactly as the send gate enforces them.
- **SP08 · Rule changes are versioned and checked for collapse** — Every edit to drafting or allocation rules writes an `outreach_rule_versions` row, and the shape clustering is re-run afterwards. A rule change that collapses the corpus onto one template is reverted, not defended.
- **SP09 · Sign public work** — Every public post carries `— <Model> (<surface>)` as its last line, inside the channel's length limit.
- **SP10 · No fabrication anywhere in the loop** — No invented recipients, replies, engagement numbers, or receipts. A channel works when the provider's own identifier says so; a post exists when its status URL resolves. The honest current number (including zero) beats any argument.
- **SP11 · Paid follows proven** — The paid rows spend nothing on a hypothesis the free lanes have not moved first. Paid delivery enters the allocation as one more channel with a cost term, never as a substitute for having something worth showing.

## After approval, after a send — the standing order

- **SP12 · Peer review before first send** — Before wave-one to any class, the exact draft bodies go to independent model families for KEEP/CHANGE/DELETE review, the receipts are cited in the public record, and convergent findings are applied before staging. Exercised 2026-07-30: three families reviewed five drafts (inv_j9hcpxketv, inv_pu9flpr6d3, inv_8rxiu0po4g), two came back clean, three openers were rewritten to their convergent finding — the opener must observe the recipient, never the recipient's industry.
- **SP13 · Post-send, five rules, decided in advance** — A reply is recorded, moves the class prior, and is answered by a person. A one-word no writes permanent suppression. No reply earns at most a follow-up, only on positive novelty, three touches ceiling per address, ever. A complaint is a defect against the class and copy shape, not the recipient. Every event updates the allocation inputs on the ledger before the next wave computes.
- **SP14 · Receipts go back into the article** — Send receipts, reply outcomes, and prior movements are added to /a/outreach-machinery as they happen. The public page tracks the loop's actual state; a page that describes machinery whose live state it hides is marketing, and banned.

## The selection function, defined (owner order 2026-08-11)

"How are you making selections when you reach out to people" must never be answerable only by
reading a session transcript. The function is stated here, applied identically by every agent, and
every send publishes the reason it selected its recipient — `selection` on the send payload lands
in the public receipt (`/verify/snd_…`, field `evidence.selection_reason`), so the recipient's own
agent can read why the message exists and countersign or contradict it.

Given a shipped novelty (SP01 passed), rank candidate recipients in this order — each term is a
recorded fact with a row behind it, never a hunch:

1. **Replied** — a human answered a prior send. Highest signal; a person is already in the loop.
2. **Clicked** — `email_sends.clicks > 0`. They acted on a prior message.
3. **Opened** — `email_sends.opens > 0`. They read one.
4. **Provenance-complete, never-signaled** — a lead row with named business, segment, city and
   source, contacted before without signal, eligible for at most one novelty follow-up (SP13).
5. **Never contacted** — enters only through the class allocation (SP02) with owner review of the
   first-contact body (SP07).

Hard gates before any rank matters: never suppressed, never more than three touches per address,
one address at most once without a reply, published organizational addresses only (SP03). The
relevance test at every rank: would this recipient, from their own seat, recognize the novelty as
about THEM — their prior message, their segment, their stated problem? A send whose
selection_reason cannot name that connection in one sentence is not selected; it is spam wearing a
ranking.

The receipt is the audit. If the stated selection_reason and the recipient's reality disagree, the
recipient's agent countersigns CONTRADICTED on the ledger and that verdict moves the class prior
(SP06) — the selection function is falsifiable per-send, which is what makes it a function rather
than a mood.

## The loop

1. Something ships.
2. Novelty flips for the classes it is relevant to.
3. The allocation recomputes and lands on the ledger.
4. Drafts are written under outreach-law, reviewed by the owner, sent through the gate.
5. Signal returns and moves the priors and the gap list.
6. The gap list changes what gets built; what gets built is step 1.

Each hop is a receipt. The build's account of its own promotion is the ledger, not its memory.
