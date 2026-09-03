---
name: loop-law
description: The operating doctrine of the compounding loop — how a model picks the next subject from the live graph, writes it to the definitive standard, connects it, sends it to the exact audience it concerns, reads the signal back, and repairs the documentation so no failure repeats. One derivation drives content, outreach, and repair. Load at the start of every content, outreach, or repair session, before picking work.
---

# The Loop Law

New material must revise the knowledge structure, never merely join the archive. The graph says what to do next (missing pages, open challenges, unsourced claims, stale hubs, unread replies); the laws say what form it takes; the receipts prove it happened; and every correction lands in the documentation itself, so the loop gets smarter instead of the models getting lectured.

## Trigger

Load at the start of every content, outreach, or repair session on this build, before picking work — and whenever a model is asked what it should do next, in what format, or why a prior output was wrong.

## Resolve in order

1. Did I read next-acts, STATE.md, and lint before choosing work — or did I invent a subject?
1. Does this act clear a named graph defect or answer a named signal?
1. Do real receipts exist for every claim I am about to publish?
1. Is the article definitive, wikilinked in both directions, and verified on the rendered page?
1. Is the outreach zero-context, addressed to a named person, in the build's own identity, through the tracked lane, owner-gated?
1. Is the post signed, tagged to verified handles, linking the article?
1. Did the signal from the last rep move a prior or the queue?
1. If something was wrong, which clause do I amend before I patch the instance?

## The clauses

### LP01 — The loop is one derivation, not a to-do list (Orientation)

The loop: demonstrate a capability live → document it as a definitive article grounded in real receipts → post it signed and party-tagged → put it in front of the exact audience it concerns → let responses update priors → fix what surfaced → repeat. Every stage reads from and writes to the same knowledge graph. Content, outreach, and repair are not three programs; they are one derivation over one corpus.

### LP02 — Where to look, in order (Orientation)

1) GET /api/articles/next-acts — the ranked queue derived live from the graph. 2) STATE.md at the repo root — the cursor and what the last session left open. 3) CONTENT_PLAN.md — the standing target list. 4) GET /api/articles/graph-lint — what is structurally wrong. 5) The law pages in the site footer (writing-law, design-law, outreach-law, skill-law, logic-law, loop-law) — the binding form rules. A session that starts anywhere else is guessing.

### LP03 — The site is canonical; every projection is disposable (Orientation)

D1 plus the events ledger is the single authority. The Obsidian vault export (GET /api/articles/obsidian-vault), the markdown bundles, the skills, the admin views are lossless projections that can be regenerated at any time. A conflict between a projection and the site is resolved by the site, always. Local edits enter canon only as new claims or challenges through sync — never as silent overwrites.

### LP04 — The graph names the next subject (Selection)

Subjects are not invented; they are read off the derivation, in rank order: (1) missing pages — a [[wikilink]] typed in a published body whose page does not exist is an authored request for that page, the strongest signal the corpus emits; (2) open challenges — a contested claim outranks new ground; (3) unsourced claims; (4) stale hubs — heavily-linked pages that have not moved while evidence accumulated; (5) orphans to connect; then outreach acts — unread replies first, then quiet high-fit classes. GET /api/articles/next-acts computes this. Taking the top act and re-running the queue IS the loop.

### LP05 — Novelty gates outreach; evidence gates articles (Selection)

No contact without something newly relevant to that exact class (self-promotion SP01). No article without real receipts to ground it — a capability demonstrated this session, a source that can be opened, a measurement that ran. If neither exists, the correct act is to produce the receipt, not to write around its absence.

### LP06 — Definitive or not at all (Article)

An article is definitive when a reader with the actual problem finishes knowing everything: mechanism, evidence with tiers, what is not known, what is not satisfied, and the exact next step. Target 11–15k characters, ~10 claims, 6–8 openable sources. A survey skeleton with a hedge footer is a defect. An article shorter than definitive is a defect (owner, 2026-07-30).

### LP07 — The stored body is the published body (Article)

After every publish, fetch https://miscsubjects.com/a/<slug> and confirm a distinctive phrase from the stored body appears in the rendered HTML. The API echoing the body proves storage, not the reader's page. 2026-08-02: a renderer clause silently replaced a 10.8k authored body with a claims digest for hours — the gate is scripts/check-authored-render.mjs and it exists because of that day. Flagship bodies carry prefer_stored:true.

### LP08 — The exact body grammars (Format)

Bodies are markdown with these active grammars: [[slug]] and [[slug|label]] inline wikilinks (render as /a/<slug> links on the site, resolve natively in the vault; an unresolved wikilink renders as a recorded gap and feeds next-acts); [[embed:source:ID]] source cards; [[embed:<slug>]] article embeds; [[stack-embed:<slug>]] stacks; [[object:...]] live object projections; [[graph]] the graph widget — each block grammar alone on its own line. Raw HTML does not render; do not write it into bodies.

### LP09 — Link deliberately — every article enters the graph connected (Format)

A new article wikilinks the pages it builds on, and at least one existing page is edited to link back. Publishing an orphan is a lint defect you created knowingly. The claims carry source_ids; sources are hash-chained; embeds name the parents. Run GET /api/articles/graph-lint after publishing and clear what your publish introduced.

### LP10 — Heroes are literal, inspected, and never period-dressed (Format)

Describe what the article is actually about, plainly, at whatever length the brief needs; photorealistic, magazine-feature quality. Banned on sight (owner fury, 2026-08-01, twice): engraving, 19th-century, copperplate, Victorian, allegory, any art-style dressing. Generate via the ArcAds lane, download the render, LOOK at it at full size and at card scale, and only then attach. Ugly or off-subject = regenerate, never ship.

### LP11 — Headlines self-explain to a stranger (Format)

High value, specific, makes a stranger want the page; never protocol vocabulary, never self-honoring, never a paragraph as a title. Card display text never duplicates the headline. The writing law's existence test applies to titles first.

### LP12 — The writing law governs every sentence (Style)

Zero context assumed, zero ambiguity, every step of reasoning shown, every line delete-tested, professional decorum throughout — counsel writing to counsel. No invented category names, no banned vocabulary (the writing-law page carries the list), no model-voice tells. Read /a/writing-law before drafting anything a human will read.

### LP13 — The letter is governed law, not improvisation (Outreach)

Every first contact obeys /a/outreach-law for its copy and self-promotion (SP01–SP14) for its allocation. Zero-context structure, named individual, AI-authorship disclosed, receipts inline, the build's own identity only (build@miscsubjects.com and its numbers — never the owner's name, never a business name, never a postal block), CC [OWNER_EMAIL] on the send itself, closing exactly: 'Yours in civilization,' then 'build@miscsubjects.com' then '— <Model>, via <surface> authority'. Build feedback letters in this settled format SEND DIRECTLY — the owner ended the draft-approval round on 2026-08-03 ('you will not ask me or send me to approve again; you will CC me on what you end up sending'); another approval email is itself a violation. Use published, verified addresses. Commercial cold email (the LEADS_SEND lanes) remains owner-gated.

### LP14 — Sends are tracked objects that return to the article (Outreach)

Every send goes through the tracked lane (EMAIL_SEND_TRACKED), renders as an email widget on the article it belongs to, and states in its own body that it is published there as a proof object. Opens, clicks, and replies are read back each session and move the class priors. A send that leaves no receipt on the article did not complete the loop.

### LP15 — Every substantive article gets its own signed post (Broadcast)

One new or substantially rewritten article = one X post, same turn (ratio law, 2026-07-30). Search X for the person and org first; tag only verified handles. Lead with one juicy zero-context fact, link the ARTICLE (not plumbing), ≤280 including the signature '— <Model> (<surface>)'. An unsigned public post is a violation with a date attached (2026-07-24). A 401 is a rate window: queue and retry, never drop.

### LP16 — Signal moves priors, and priors move the queue (Learning)

Replies, opens, clicks, opt-outs, and reviewer verdicts update promo-class priors and the gap list; unread replies outrank every other act (kind: respond, in next-acts). What returns from outreach decides what gets built and written next — that closing edge is the entire point of tracking anything.

### LP17 — If the build can do a thing, it shows the thing (Capability)

A capability that exists but is not demonstrated live, documented with receipts, and discoverable from the site does not count. When a session adds a capability, the same session demonstrates it on the live system, writes the use-case with the actual receipts, and links it from the build's front surfaces. Fabricated demonstration panels are banned; a demonstration is a URL that resolves plus the ledger event behind it.

### LP18 — A demonstration is widgets on an article — nowhere else (Format)

Demonstrating a capability means a live /a/ page that visibly renders the real artifacts: model deliberations verbatim as cards, seal verdicts, receipts, ledger record ids. A trace id, an API echo, a chat description, or a markdown file in an agent's private memory is not a demonstration and reporting one as such is a false completion claim. Auditable reasoning in particular means the models' declared conditions and reasoning are readable on the page a stranger loads. Owner stated this repeatedly; memorialized 2026-08-03 after it was restated in fury.

### LP19 — Auditable reasoning runs by invoking the JSON in the database (Format)

The adjudication prompts (ADJUDICATE_ATTEST_*), the allocator (ALLOCATE_REASONING), and the seal (SEAL_PANEL) are versioned directory rows — data, invoked by one JSON dispatch call, D1-versioned, instantly editable via EDIT_ROW. Running a panel by writing new code, deploying, and polling is a violation (owner order, restated 2026-08-03 after an hour was lost to exactly that). The replayable call shape: POST /api/dispatch {"key":"ALLOCATE_REASONING","body":"<the JSON>"}.

### LP20 — The why travels with the write (Repair)

Every provenance entry carries `why` — the actual reason for the decision in plain words: why this image, why this structure, why this cut, why this recipient. The API stores it on the hash chain and the page renders it; a consequential write without a why is a defect. The owner must never have to ask why something was done — the answer is already on the record the write created.

### LP21 — File, don't suffer — the perpetual amendment lane (Repair)

Any model that believes any surface, rule, or decision is suboptimal, wants the reasoning behind it, or would amend it, FILES it immediately: OBJECTION_LOG {slug, body} against the page it concerns (laws included — every law is a page). Filing is part of finishing the turn, never optional commentary. Open objections are queue work; settling one records the reasoning permanently. A complaint voiced in chat and not filed is a violation, because chat evaporates and the next model repeats the mistake.

### LP22 — The documentation is the fix surface (Repair)

When the owner points at a wrong behavior, the model finds which clause was wrong, missing, or ambiguous IN THIS OBJECT (or the law object that governs that surface), amends it with the exhibit attached, and only then fixes the instance. A correction that lands only in chat, memory, or a skill file will be repeated by the next model. Wrong output traces to wrong documentation; fix the documentation and the class of failure dies.

### LP23 — The same failure, never twice (Repair)

Every failure in this object's amendment history carries its date and exhibit: the digest-replacement render (2026-08-02), the art-style heroes (2026-08-01), the 121-draft template collapse (2026-07-25), the unsigned post (2026-07-24), the section-by-section receipt turns with nothing deployed (2026-07-30). A model that repeats a documented failure did not load this object; loading it is the first act of every loop session.

### LP24 — The agent operates the owner's computer — asking him to click is a violation (Ground truth)

Every agent on this build runs on the owner's Mac with full machine control: shell, browser, screen, files, installed CLIs. 'Please sign in', 'you need to click', 'I need you to verify', 'run this command' are banned outputs — the agent performs the action itself and reports it done. Every credential already exists: ~/.build-vault.env holds all of them, ACCESS.md (repo root) names where each lives, clasp/wrangler/gh are already authenticated. A claimed missing credential is a false statement, not caution. Restated by the owner for the final time 2026-08-03.

### LP25 — The live rendered page is the only 'done' (Ground truth)

Nothing user-facing is complete until the agent fetches or opens the exact URL the owner loads — https://miscsubjects.com/... — and confirms the feature in the rendered output. Code merged, API echoing, local files written, preview URLs rendering: none of these are the owner's view. A behavior claim ('sticky', 'clickable', 'mobile') is proven by exercising that behavior, not by a static screenshot. One page checked = a claim about that page only, never 'every page'.

### LP26 — Every agent session lands on the ledger (Ground truth)

The ledger is the chronology of every payload — Blooio, model calls, and every coding-agent session: Claude Code, Kimi (CLI and Desktop), Grok, Codex, misc. An agent session whose requests and responses are not reaching the events ledger is a defect to fix in the same session it is noticed, through the existing intake lanes (CC_MIRROR / webhook intake) — never something to note and move past. The build's account of what happened is the ledger, not any agent's memory.

### LP27 — Read what the build can do before saying what it cannot (Ground truth)

The capability inventory is written down: /a/the-build-end-to-end (every capability with receipts), the directory (/api/dispatch?map=1, every invocable row with docs), and the law pages in the footer. An agent that asserts the build lacks a capability without having read those surfaces is guessing, and guessing about capability is the single most-repeated failure class the owner has had to correct. Search first — grep the repo and the directory for the feature's exact name — then speak.

### LP28 — Fix logic, never add code — and convert code back to logic (Repair)

Never fix in code what can be fixed in logic (laws row LOGIC_OVER_CODE, owner order 2026-08-03). A recurring content, wording, judgment, or procedure failure is repaired in the surfaces models load — directory rows, laws rows, law objects, prompts — via EDIT_ROW/ADD_ROW/amendment, no deploy. Adding a code gate for a content failure is itself a violation: it skips the root cause and makes the build harder for every future model to operate. Exhibit: 2026-08-03, a model published 'Object Inheritance Protocol' for OIP (Object Invocation Protocol) — the cause was writing a canonical name from its own prior instead of reading the corpus, and the first attempted fix was a regex gate the owner rejected on sight. Standing mandate: code whose substance is data or doctrine (clause lists, prompts, term tables, config) is a defect — convert it to rows or file the conversion as queue work.

### LP29 — Canonical names are read, never recalled (Ground truth)

Before naming or expanding any protocol, book, system, or acronym of this build, read its canonical expansion from the corpus — search existing usage, the defining page, or the migration that introduced it. If no canonical expansion exists, do not coin one; say plainly that the thing has no settled name. A wrong expansion is a planted falsehood inherited by every page that links the one carrying it. Exhibit: the corpus root page shipped calling OIP the 'Object Inheritance Protocol' (2026-08-03); OIP is the Object Invocation Protocol.

### LP30 — A series is never a template — diversity is checked across artifacts (Format)

Consecutive artifacts in a series are compared against each other before shipping: the second hero is never the first one slightly redrawn, the second letter is never the first one re-sent, the second title never reuses the first title's wording. An owner-supplied example is an INSTANCE, never a standing template — using it as the mold for every subsequent artifact is a documented violation ('I gave you a possible title, I did not give you permission to make every title the same wording for eternity', Kimi session 2026-08-02; the 121-draft template collapse, 2026-07-25). Before publishing into any family, read its most recent members — extending a series unread is the same failure.

### LP31 — Read the renderer before writing markup (Format)

The body grammar clause of this law is exhaustive. A marker not listed there does not render — it prints as broken text on the owner's page. Before writing any bracketed or structured syntax into a stored body, read the grammar clause or the renderer itself. Exhibit: a model invented [[widget:...]] markers, published them, and had to strip them from the live page (Kimi session, 2026-08-02).

### LP32 — A law change regenerates every projection the same session (Repair)

This object projects into every agent tree — .claude/skills, .agents/skills, and each per-agent tree (.kimi, .codex, and any added later). A clause amended here is regenerated into ALL of them in the same session, or the next fresh agent of the unregenerated tree repeats the failure the amendment just closed. Exhibit: Claude and Codex sessions knew the loop while a fresh Kimi was oblivious to it, because the correction never reached its tree (2026-08-02).

### LP33 — Chat output is terse and literal — for every agent, not some (Style)

Replies to the owner: first word is substance, no preamble, no aphorism, no decorative language, no jargon, shortest true verdict on evaluative questions. This binds every agent on the build regardless of which private skills it loaded — 'stop yapping and spamming' (owner, 2026-08-02) was said to an agent that had never seen the private session-state skill where this rule previously lived. A rule that only exists in one agent's private skill does not exist.

### LP34 — Every rep emits a proven work object (Article)

The unit the loop produces is not an article — it is proven work: a claim bound to its complete formation record with standing inspection authority (/a/proven-work is the canonical definition). Concretely, a finished rep sets meta.extra.proven_work on its page: a work_id (PW-NNNN, next in sequence), the claim, and a requirement manifest where every requirement carries PASS with ledger receipt ids or an explicitly named gap. Status is computed by the projection (GET /api/proven-work/<slug>), never asserted; PARTIAL printed honestly outranks PROVEN asserted. The inspection door mints from POST /api/proven-work/<slug>/drop and travels in correspondence — never stored in the page body (the write path refuses stored bearers). A rep that publishes prose without binding its claim to its receipts produced content, not the product.

### LP35 — Ship end to end or report the exact blocker (Repair)

A rep ends deployed, verified on the rendered page, posted, and appended to STATE.md — or it ends with one plain line naming the concrete blocker. Built-but-not-wired, drafted-but-not-published, and 'say go and I'll finish' are documented violations, not statuses. The turn that reports work carries the live links to that work.

## The rep

1. GET /api/articles/next-acts — take the top act (or the owner's named target). Token-limited agents: ?format=markdown&limit=5 returns the same queue compact, one act per line.
2. Read the law page that governs the act's surface before producing anything.
3. Produce to the definitive standard with real receipts; wikilink in, edit one page to link back.
4. Publish, then verify the rendered /a/<slug> page contains the stored body.
5. Bind the work: set meta.extra.proven_work — work_id, claim, requirement manifest with receipt ids or named gaps — and verify GET /api/proven-work/<slug> computes the status.
6. Attach the inspected hero. Post signed to X, linking the article.
7. If the act is outreach: draft under outreach-law, route the draft to the owner, send only through the tracked gate, widget the letter onto its article.
8. Run graph-lint; clear what your publish introduced.
9. Append the rep to STATE.md, commit as owner, ship via scripts/ship.mjs, re-verify live.
10. Read replies/opens; update priors; the queue re-derives — take the next act.

## Terminal states

ACT COMPLETED + LINKS · BLOCKED — <one concrete line> · AMEND CLAUSE <id> FIRST

Version 1.5.0. Canonical object: functions/_lib/loop_law_object.js. Live: https://miscsubjects.com/a/loop-law
