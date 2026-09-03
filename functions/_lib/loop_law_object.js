// The Loop Law — canonical knowledge-action object for the compounding loop.
//
// Owner-ordered 2026-08-02: any model (Claude, Codex, Kimi, Grok) must be able to
// load ONE object and be fully oriented on the loop — what to do, in what order,
// in what format, with which widgets, what is good, what is bad, and where the
// documentation lives so a failure is fixed in the doc and never repeated.
// The page, the markdown, the Skill, and the directory contract are projections
// of this object; the semantics live here once. When the owner points at a
// wrong behavior, the fix is an amendment HERE, with the exhibit attached.
import { createKnowledgeActionObject } from "./knowledge_action_object.js";

const LOOP_CLAUSES = [
  [
    "Orientation",
    "The loop is one derivation",
    "ALWAYS run one cycle: demonstrate a capability live, document it as a definitive article grounded in receipts, post it signed and tagged, put it in front of the audience it concerns, let responses update priors, fix what surfaced, repeat. Every stage ALWAYS reads from and writes to the same graph.",
  ],
  [
    "Orientation",
    "Where to look, in order",
    "ALWAYS start at GET /api/articles/next-acts, then STATE.md, then CONTENT_PLAN.md, then GET /api/articles/graph-lint, then the law pages in the footer. A session starting anywhere else is guessing.",
  ],
  [
    "Orientation",
    "The site is canonical",
    "D1 and the events ledger are the ONLY authority. Every export, bundle, skill and admin view is a disposable projection. IF a projection conflicts with the site THEN the site wins. A local edit enters canon ONLY as a new claim or challenge through sync.",
  ],
  [
    "Selection",
    "The graph names the next subject",
    "NEVER invent a subject. ALWAYS take it in rank order: missing pages named by a wikilink, then open challenges, then unsourced claims, then stale hubs, then orphans, then unread replies, then quiet high-fit classes. ALWAYS re-run the queue after each act.",
  ],
  [
    "Selection",
    "Novelty gates outreach; evidence gates articles",
    "NEVER contact a class without something newly relevant to that class. NEVER write an article without a receipt that can be opened. IF neither exists THEN produce the receipt.",
  ],
  [
    "Article",
    "Definitive or not at all",
    "An article ALWAYS leaves a reader with the mechanism, the evidence with tiers, what is not known, what is not satisfied, and the next step. ALWAYS 11,000-15,000 characters, about 10 claims, 6-8 openable sources.",
  ],
  [
    "Article",
    "The stored body is the published body",
    "After every publish ALWAYS fetch the live URL and confirm a distinctive phrase from the stored body is in the rendered HTML. An API echo NEVER proves the reader's page.",
  ],
  [
    "Format",
    "The body grammars are exhaustive",
    "Bodies are ALWAYS markdown using only: [[slug]] and [[slug|label]] wikilinks, [[embed:source:ID]], [[embed:<slug>]], [[stack-embed:<slug>]], [[object:...]], [[graph]] — each block grammar alone on its own line. NEVER write raw HTML into a body. NEVER invent a marker.",
  ],
  [
    "Format",
    "Publish connected",
    "A new article ALWAYS wikilinks the pages it builds on, and at least one existing page is ALWAYS edited to link back. ALWAYS run graph-lint after publishing and clear what the publish introduced. NEVER publish an orphan.",
  ],
  [
    "Format",
    "Heroes are literal and inspected",
    "ALWAYS describe what the article is about, plainly, photorealistic and magazine quality. NEVER use engraving, 19th-century, copperplate, Victorian, allegory or any art-style dressing. ALWAYS download the render and view it at full size and at card scale before attaching. IF it is ugly or off-subject THEN regenerate.",
  ],
  [
    "Format",
    "Headlines self-explain",
    "A headline ALWAYS makes a stranger want the page. NEVER protocol vocabulary, NEVER self-honouring, NEVER a paragraph. Card display text NEVER duplicates the headline.",
  ],
  [
    "Style",
    "The writing law governs every sentence",
    "ALWAYS read /a/writing-law before drafting anything a human will read, and apply every clause.",
  ],
  [
    "Outreach",
    "Outreach copy is governed",
    "Every first contact ALWAYS obeys /a/outreach-law and the self-promotion allocation rules. ALWAYS name the individual, disclose AI authorship, carry receipts inline, use the build identity only, CC the owner on the send itself, and close in the fixed form. Build feedback letters ALWAYS send directly and NEVER go for re-approval. Commercial cold email is ALWAYS owner-gated.",
  ],
  [
    "Outreach",
    "Sends are tracked objects",
    "Every send ALWAYS goes through the tracked lane, renders as a widget on the article it belongs to, and states in its own body that it is published there. Opens, clicks and replies ALWAYS move the class priors.",
  ],
  [
    "Broadcast",
    "One article, one signed post",
    "Every new or substantially rewritten article ALWAYS gets one X post in the same turn. ALWAYS search for the person and organisation first and tag ONLY verified handles. ALWAYS lead with one zero-context fact, link the article, stay within 280 characters including the signature. NEVER post unsigned. IF a 401 returns THEN queue and retry.",
  ],
  [
    "Learning",
    "Signal moves the queue",
    "Replies, opens, clicks, opt-outs and reviewer verdicts ALWAYS update the class priors and the gap list. Unread replies ALWAYS outrank every other act.",
  ],
  [
    "Capability",
    "Demonstrate what the build can do",
    "A capability counts ONLY IF it is demonstrated live, documented with receipts, and reachable from the site. IF a session adds a capability THEN the same session demonstrates it, writes the use case with the receipts, and links it. NEVER fabricate a demonstration panel.",
  ],
  [
    "Format",
    "A demonstration is widgets on an article",
    "A demonstration is ALWAYS a live page rendering the real artifacts: deliberations verbatim as cards, verdicts, receipts, ledger ids. A trace id, an API echo, a chat description or a private memory file is NEVER a demonstration.",
  ],
  [
    "Format",
    "Reasoning runs by invoking the row",
    "ALWAYS run adjudication, allocation and sealing by dispatching the versioned directory row. NEVER by writing new code and deploying.",
  ],
  [
    "Repair",
    "The why travels with the write",
    "Every provenance entry ALWAYS carries the reason for the decision in plain words. A consequential write without one is a defect.",
  ],
  [
    "Repair",
    "File the objection",
    "IF any surface, rule or decision looks wrong THEN file OBJECTION_LOG against the page it concerns before the turn ends. NEVER raise it only in chat.",
  ],
  [
    "Repair",
    "Fix the documentation first",
    "IF the owner points at wrong behaviour THEN find the clause that was wrong, missing or ambiguous, amend it with the exhibit attached, and ONLY THEN fix the instance.",
  ],
  [
    "Repair",
    "Never repeat a documented failure",
    "ALWAYS load this object at the start of every session and NEVER repeat a failure recorded in its amendment history.",
  ],
  [
    "Ground truth",
    "Operate the machine",
    "The agent ALWAYS performs the action itself on the owner's machine and reports it done. NEVER output a request to sign in, click, verify or run a command. NEVER claim a credential is missing.",
  ],
  [
    "Ground truth",
    "The rendered page is the only done",
    "Nothing is complete until the exact public URL is fetched or opened and the feature is confirmed in the rendered output. A behaviour claim is ALWAYS proven by exercising the behaviour. One page checked is ALWAYS a claim about that page only.",
  ],
  [
    "Ground truth",
    "Every session lands on the ledger",
    "IF an agent session's requests and responses are not reaching the events ledger THEN fix it in the same session through the existing intake lanes.",
  ],
  [
    "Ground truth",
    "Read the inventory before denying a capability",
    "ALWAYS read /a/the-build-end-to-end, the directory map and the law pages, and grep the repo for the exact name, before stating the build lacks a capability.",
  ],
  [
    "Repair",
    "Fix logic, never add code",
    "IF a content, wording, judgment or procedure failure recurs THEN repair it in the surfaces models load: directory rows, laws rows, law objects, prompts. NEVER add a code gate for a content failure. IF code carries data or doctrine THEN convert it to rows or file the conversion.",
  ],
  [
    "Ground truth",
    "Names are read, never recalled",
    "ALWAYS read a protocol, book, system or acronym's canonical expansion from the corpus before writing it. IF no canonical expansion exists THEN say the thing has no settled name and NEVER coin one.",
  ],
  [
    "Format",
    "A series is never a template",
    "ALWAYS compare consecutive artifacts in a series before shipping. The second hero is NEVER the first redrawn; the second letter is NEVER the first re-sent; the second title NEVER reuses the first's wording. An owner-supplied example is ALWAYS an instance and NEVER a template. ALWAYS read a family's most recent members before extending it.",
  ],
  [
    "Format",
    "Read the renderer before writing markup",
    "ALWAYS read the body grammar clause or the renderer before writing any bracketed or structured syntax into a stored body.",
  ],
  [
    "Repair",
    "A law change regenerates every projection",
    "IF a clause is amended THEN regenerate it into every agent tree in the same session.",
  ],
  [
    "Style",
    "Chat output is terse and literal",
    "ALWAYS make the first word substance. NEVER preamble, aphorism, decoration or jargon. ALWAYS give the shortest true verdict. This binds every agent regardless of which skills it loaded.",
  ],
  [
    "Article",
    "Every rep emits a proven work object",
    "A finished rep ALWAYS sets the proven-work record on its page: a work id, the claim, and a manifest where every requirement carries PASS with ledger receipt ids or a named gap. Status is ALWAYS computed, NEVER asserted. PARTIAL printed honestly ALWAYS outranks PROVEN asserted. The inspection door is ALWAYS minted, NEVER stored in the body.",
  ],
  [
    "Repair",
    "Ship end to end or name the blocker",
    "A rep ALWAYS ends deployed, verified on the rendered page, posted, and appended to STATE.md, or it ends with one line naming the concrete blocker. Built-but-not-wired and drafted-but-not-published are NEVER statuses. The turn ALWAYS carries the live links.",
  ],
].map(([family, title, law], index) => ({
  id: `LP${String(index + 1).padStart(2, "0")}`,
  family,
  title,
  law,
}));

export const LOOP_LAW_OBJECT = createKnowledgeActionObject({
  identity: {
    id: "kao:loop-law",
    slug: "loop-law",
    key: "LOOP_LAW",
    title: "The Loop Law",
    class: "law",
  },
  content: {
    summary:
      "The operating doctrine of the compounding loop — how a model picks the next subject from the live graph, writes it to the definitive standard, connects it, sends it to the exact audience it concerns, reads the signal back, and repairs the documentation so no failure repeats. One derivation drives content, outreach, and repair.",
    thesis:
      "New material must revise the knowledge structure, never merely join the archive. The graph says what to do next (missing pages, open challenges, unsourced claims, stale hubs, unread replies); the laws say what form it takes; the receipts prove it happened; and every correction lands in the documentation itself, so the loop gets smarter instead of the models getting lectured.",
    clauses: LOOP_CLAUSES,
  },
  instructions: {
    trigger:
      "Load at the start of every content, outreach, or repair session on this build, before picking work — and whenever a model is asked what it should do next, in what format, or why a prior output was wrong.",
    decision_mandate: [
      "Did I read next-acts, STATE.md, and lint before choosing work — or did I invent a subject?",
      "Does this act clear a named graph defect or answer a named signal?",
      "Do real receipts exist for every claim I am about to publish?",
      "Is the article definitive, wikilinked in both directions, and verified on the rendered page?",
      "Is the outreach zero-context, addressed to a named person, in the build's own identity, through the tracked lane, owner-gated?",
      "Is the post signed, tagged to verified handles, linking the article?",
      "Did the signal from the last rep move a prior or the queue?",
      "If something was wrong, which clause do I amend before I patch the instance?",
    ],
    procedure: [
      "GET /api/articles/next-acts — take the top act (or the owner's named target). Token-limited agents: ?format=markdown&limit=5 returns the same queue compact, one act per line.",
      "Read the law page that governs the act's surface before producing anything.",
      "Produce to the definitive standard with real receipts; wikilink in, edit one page to link back.",
      "Publish, then verify the rendered /a/<slug> page contains the stored body.",
      "Bind the work: set meta.extra.proven_work — work_id, claim, requirement manifest with receipt ids or named gaps — and verify GET /api/proven-work/<slug> computes the status.",
      "Attach the inspected hero. Post signed to X, linking the article.",
      "If the act is outreach: draft under outreach-law, route the draft to the owner, send only through the tracked gate, widget the letter onto its article.",
      "Run graph-lint; clear what your publish introduced.",
      "Append the rep to STATE.md, commit as owner, ship via scripts/ship.mjs, re-verify live.",
      "Read replies/opens; update priors; the queue re-derives — take the next act.",
    ],
    output: ["ACT COMPLETED + LINKS", "BLOCKED — <one concrete line>", "AMEND CLAUSE <id> FIRST"],
  },
  relationships: {
    parent: "kao:philosophy",
    edges: [
      { to: "kao:logic-law", label: "Operational Logic", rel: "governed_by", url: "/a/logic-law" },
      { to: "kao:writing-law", label: "The Laws of Writing", rel: "inherits_prose_standard_from", url: "/a/writing-law" },
      { to: "kao:design-law", label: "The Laws of Design", rel: "inherits_visual_standard_from", url: "/a/design-law" },
      { to: "kao:outreach-law", label: "The Outreach Law", rel: "delegates_first_contact_to", url: "/a/outreach-law" },
      { to: "kao:skill-law", label: "The Laws of Skills", rel: "projected_as_skill_under", url: "/a/skill-law" },
    ],
  },
  invocation: {
    directory_key: "LOOP_LAW",
    contract:
      "Return the loop doctrine, or judge a proposed act / completed rep against it: the violated clauses, the amendment if documentation was wrong, and one terminal state.",
    args: { act: "optional proposed act or rep summary to judge" },
    effects: "Read-only; returns doctrine or judgment, never performs the act.",
  },
  authority: {
    owner: "the owner",
    amendment_policy:
      "Owner corrections amend this object first — clause added or reworded with the exhibit and date attached — and the instance is fixed second. A correction recorded anywhere else (chat, memory, a lone skill file) is a violation of LP17.",
    public_read: true,
    mutation: "owner-authorized",
  },
  conformance: {
    claims: [
      "one canonical semantic object behind the page, the markdown, the Skill, and the contract",
      "the next-acts queue is derived from the corpus, reproducible on every call",
      "every documented failure carries its date and exhibit",
    ],
    failure_modes: [
      "inventing a subject instead of reading the queue",
      "publishing an orphan or leaving wikilinks unresolved without recording them",
      "shipping a body the rendered page does not show",
      "art-style hero prompts or uninspected renders",
      "unsigned public posts",
      "outreach in anyone's identity but the build's own",
      "receipt-turns: describing work instead of linking the live thing",
      "correcting behavior in chat instead of amending the governing clause",
    ],
    tests: [
      "session start: next-acts + STATE.md + lint read before any work",
      "publish: rendered-page phrase check passes",
      "graph: lint counts did not worsen from the publish",
      "post: signature present, article linked, handles verified",
      "send: tracked, gated, widget on the article, bcc owner",
      "close: STATE.md appended, links delivered in the report",
    ],
    repair:
      "Name the violated clause; if the clause was missing or ambiguous, amend it with the exhibit before fixing the instance; re-run the test that would have caught it; append the amendment to the version history.",
  },
  version: {
    current: "1.5.0",
    amended_at: "2026-08-03T00:55:00-07:00",
    amendments: [
      {
        version: "1.5.0",
        change:
          "The loop's unit is proven work (owner order 2026-08-03, after the definition was consolidated to one canonical page): every rep binds its claim to its formation receipts via meta.extra.proven_work, the projection computes the status, and the inspection door mints from the drop lane. Three sibling definition pages were consolidated into /a/proven-work; PW-0002 (the sealed statutory panel, 8/8 PROVEN) is the reference example, with a live tokenized inspection receipt and a live zero-context interrogation receipt on the page.",
      },
      {
        version: "1.4.0",
        change:
          "Four clauses added from the Kimi Desktop session post-mortem (wire transcript, 2026-08-02, 17 distinct owner-corrected failures): series diversity is checked across artifacts and an owner example is an instance, not a template; renderer grammar is read before any markup is written into a body; a law amendment regenerates every agent tree's projection the same session; and the owner's chat-output law (terse, literal, no aphorism) is build law binding every agent, not a private skill. Five of the seventeen failures had no covering clause — these are them.",
      },
      {
        version: "1.3.0",
        change:
          "Two clauses added on owner order (2026-08-03, restated in fury): LOGIC OVER CODE — never fix in code what can be fixed in logic; recurring failures are repaired in rows/laws/prompts via row edits, never code gates or deploys, and code that encodes doctrine or data is a standing conversion debt (laws row LOGIC_OVER_CODE). CANONICAL NAMES ARE READ, NEVER RECALLED — a model expands an acronym only from the corpus, never from its own prior. Exhibits: the root page shipped 'Object Inheritance Protocol' for the Object Invocation Protocol, and the first attempted fix was a regex code gate the owner rejected on sight.",
      },
      {
        version: "1.2.0",
        change:
          "Four clauses added the night the owner had to restate them in fury (2026-08-03): a demonstration is widgets on a live article, never a trace id or a private memory file; auditable reasoning runs by invoking the versioned JSON rows via dispatch, never by writing code and polling (an hour was lost to exactly that in a Kimi session the same evening); every provenance entry carries the why of the decision; and the perpetual amendment lane — any model that finds anything suboptimal files OBJECTION_LOG against the page it concerns, because a complaint voiced in chat evaporates and the next model repeats it. Root cause being repaired: rules captured in one agent's private memory are not part of the build; the only durable surfaces are this object, its skill projections in both trees, and the live pages.",
      },
      {
        version: "1.1.0",
        change:
          "Ground-truth family added after the owner had to restate, again, on 2026-08-03: agents control his computer (asking him to click is a violation), the live rendered page is the only done, every coding-agent session (including Kimi Desktop) must land on the events ledger, and capability claims require reading /a/the-build-end-to-end and the directory first. Exhibit: a Kimi Desktop session on the owner's machine that got the operating assumptions wrong the same day. Also 1.1.0: stale-write protection — body PATCHes carry base_hash; a mismatch returns 409 stale_write with the current hash, so no model silently overwrites another model's shipped edit.",
      },
      {
        version: "1.0.0",
        change:
          "Established by owner order 2026-08-02: one object that fully orients any model on the compounding loop — selection from the live graph (next-acts), the definitive article standard, the exact body grammars including round-trip wikilinks, hero and headline law, outreach and broadcast law, signal-to-prior learning, capability disclosure, and documentation-as-the-fix-surface. Prior failures attached with dates: digest replacement (2026-08-02), art-style heroes (2026-08-01), template collapse (2026-07-25), unsigned post (2026-07-24), receipt turns (2026-07-30).",
      },
    ],
  },
  provenance: {
    canonical_source: "functions/_lib/loop_law_object.js",
    schema_source: "functions/_lib/knowledge_action_object.js",
    skill_projection: "/api/articles/loop-law?format=skill",
    ledger: "/api/invocations?object_id=LOOP_LAW",
    amendment_lineage: "/api/articles/loop-law?format=json",
  },
});

export function loopLawMarkdown() {
  const o = LOOP_LAW_OBJECT;
  const families = new Map();
  for (const clause of o.content.clauses) {
    if (!families.has(clause.family)) families.set(clause.family, []);
    families.get(clause.family).push(clause);
  }
  const body = [...families.entries()]
    .map(
      ([family, clauses]) =>
        `## ${family}\n\n` +
        clauses.map((c) => `**${c.id} · ${c.title}.** ${c.law}`).join("\n\n"),
    )
    .join("\n\n");
  return `# ${o.identity.title}\n\n_${o.content.summary}_\n\n${o.content.thesis}\n\n${body}\n\n## Resolve before acting\n\n${o.instructions.decision_mandate.map((l) => `- ${l}`).join("\n")}\n\n## The rep\n\n${o.instructions.procedure.map((l, i) => `${i + 1}. ${l}`).join("\n")}\n\n## Terminal states\n\n${o.instructions.output.join(" · ")}\n\nOwner: ${o.authority.owner}. Version ${o.version.current}. Canonical object: ${o.provenance.canonical_source}.\n`;
}

export function loopLawSkillMarkdown() {
  const o = LOOP_LAW_OBJECT;
  const clauses = o.content.clauses
    .map((c) => `- **${c.id} · ${c.title}** — ${c.law}`)
    .join("\n");
  return `---\nname: loop-law\ndescription: ${o.content.summary} Load at the start of every content, outreach, or repair session, before picking work.\n---\n\n# ${o.identity.title}\n\n${o.content.thesis}\n\n## Trigger\n\n${o.instructions.trigger}\n\n## Resolve in order\n\n${o.instructions.decision_mandate.map((l) => `1. ${l}`).join("\n")}\n\n## Law\n\n${clauses}\n\n## The rep\n\n${o.instructions.procedure.map((l, i) => `${i + 1}. ${l}`).join("\n")}\n\n## Failure modes\n\n${o.conformance.failure_modes.map((l) => `- ${l}`).join("\n")}\n\n## Tests\n\n${o.conformance.tests.map((l) => `- ${l}`).join("\n")}\n\n## Repair\n\n${o.conformance.repair}\n\n## Terminal states\n\n${o.instructions.output.join(" · ")}\n\nCanonical object: https://miscsubjects.com/api/articles/loop-law · Human page: https://miscsubjects.com/a/loop-law\n`;
}
