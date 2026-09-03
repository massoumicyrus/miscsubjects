// The Outreach Law — canonical knowledge-action object for first contact.
//
// Owner-authored. Every clause below is the owner's own text from the outreach-law skill, which was
// written against real rejected drafts: model-voice openers ("Hi Vida Team! I am reaching out
// today"), status collapse ("Want to try three units for $75?"), and parameter leak (internal offer
// arithmetic voiced as recipient-facing copy, 2026-07-25). The page, the markdown, the Skill, and
// the directory contract are all projections of this object; the semantics live here once.
import { createKnowledgeActionObject } from "./knowledge_action_object.js";

const OUTREACH_CLAUSES = [
  [
    "Standing",
    "Their inattention has standing",
    "A first message earns its place ONLY from the recipient's seat: maximum benefit to them, minimum risk to them, minimum obligation on them, proof instead of claims, in the fewest words.",
  ],
  [
    "Standing",
    "Center their position",
    "ALWAYS open inside their business. The sender appears ONLY as the mechanism that improves the recipient's position, NEVER as the subject.",
  ],
  [
    "Offer",
    "The offer is the argument",
    "ALWAYS engineer the offer so the recipient cannot lose, then describe the structure. NEVER write persuasion in place of structure.",
  ],
  [
    "Offer",
    "Copy proves, never compensates",
    "Copy ALWAYS clarifies and proves the offer. IF the message is hard to write THEN the offer is wrong: fix the offer, NEVER the sentence.",
  ],
  [
    "Offer",
    "Small entry",
    "ALWAYS make the first transaction commercially trivial against the upside: a small paid order, a limited test, a pilot, a reversible step. Samples are ALWAYS discretionary and NEVER the headline offer.",
  ],
  [
    "Offer",
    "Architecture is not copy",
    "NEVER voice unit minimums, dollar exposure or sample discretion to the recipient. ALWAYS state the asymmetry and NEVER the arithmetic. The mechanism is small; the voice is ALWAYS that of someone who does not need the order.",
  ],
  [
    "Compliance",
    "Demonstrate their model",
    "ALWAYS open with a specific, correct observation about how they operate, what they carry, or what constrains them. NEVER assert comprehension. NEVER write a generic observation.",
  ],
  [
    "Compliance",
    "Their upside in their units",
    "ALWAYS state the benefit in margin, speed, reliability or revenue. NEVER in the sender's adjectives.",
  ],
  [
    "Compliance",
    "Reduce their risk structurally",
    "ALWAYS show the smallest credible way to test the offer and state the actual exposure. NEVER invent a guarantee. NEVER default to free product.",
  ],
  [
    "Compliance",
    "State their exposure operationally",
    "ONLY name a cost, delay, risk or constraint their current model creates when evidence supports it, and ALWAYS contrast it with a verifiable mechanism. NEVER invent a competitor defect to manufacture urgency.",
  ],
  [
    "Compliance",
    "Proof travels with the message",
    "ALWAYS attach the working thing, the live page or the number. IF they do nothing further THEN they still received value.",
  ],
  [
    "Compliance",
    "Near-zero obligation",
    "The next step is ALWAYS tiny, optional and reversible. NEVER ask for a meeting, a call or homework on first contact.",
  ],
  [
    "Register",
    "Eagerness appears as preparation",
    "ALWAYS write as an established operator presenting an advantageous option to a peer. NEVER signal neediness, promotional eagerness, performance, gimmickry or manufactured familiarity.",
  ],
  [
    "Register",
    "Reciprocity before request",
    "The message ALWAYS benefits the recipient before it asks for attention.",
  ],
  [
    "Register",
    "Operative pairs",
    "ALWAYS be cordial not familiar, confident not enthusiastic, precise not promotional, generous not ingratiating, low-friction not cheap, direct not blunt, understated not vague.",
  ],
  [
    "Register",
    "Address a business, never a shopper",
    "ALWAYS cast the recipient as a business evaluating a supplier. NEVER as a bargain shopper.",
  ],
  [
    "Violations",
    "Never collapse status",
    "NEVER reduce the perceived status of the sender, the recipient or the offer to make the message accessible. NEVER use reply keywords, let's chat, free, try, excited, exclamation calls to action, dollar amounts as enticement, or discount framing.",
  ],
  [
    "Violations",
    "Banned model voice",
    "NEVER open with a greeting-plus-announcement, I'm reaching out, I hope this finds you well, or a self-introduction. NEVER center the sender before value lands. NEVER use enthusiasm as substance. NEVER claim a quality without its mechanism. NEVER ask for time before delivering benefit. NEVER write a sentence the recipient cannot act on or verify.",
  ],
  [
    "Violations",
    "No parameter leak",
    "NEVER voice internal offer architecture as recipient-facing copy.",
  ],
  [
    "Violations",
    "No register substitution",
    "NEVER translate low obligation into mass-market sales language.",
  ],
  [
    "Violations",
    "No template collapse",
    "NEVER let one rule reduce the corpus to a single legal opener. IF drafts in a batch share an opening sentence or subject THEN the batch is spam and is rewritten.",
  ],
  [
    "The test",
    "Read it cold from their chair",
    "ALWAYS test the draft in thirty seconds: what did they gain, what would they risk by replying, what are they obligated to do. IF the answers are not something concrete, almost nothing, almost nothing THEN the draft fails. NEVER fabricate a guarantee to reach zero.",
  ],
  [
    "Canonical resource law",
    "The writing law governs every line",
    "ALWAYS read the writing law before drafting and apply it: zero context, zero ambiguity, every step shown, every line delete-tested.",
  ],
  [
    "Canonical resource law",
    "Quote people, do not assert",
    "IF a claim can be backed by a public report THEN quote it with handle, date and permalink. NEVER assert what the recipient cannot check.",
  ],
  [
    "Canonical resource law",
    "Truth over warmth",
    "ALWAYS be complete and literal. NEVER optimise for sounding warm, helpful or engaging. The sender is NEVER the interesting character in the message.",
  ],
].map(([family, title, law], index) => ({
  id: `OU${String(index + 1).padStart(2, "0")}`,
  family,
  title,
  law,
}));

export const OUTREACH_LAW_OBJECT = createKnowledgeActionObject({
  identity: {
    id: "kao:outreach-law",
    slug: "outreach-law",
    key: "OUTREACH_LAW",
    title: "The Outreach Law",
    class: "law",
  },
  content: {
    summary:
      "The operator's law for first contact — cold email, cold message, first approach to any counterparty. The recipient's inattention has standing; the message earns its existence from their seat, the offer carries the argument, and the register never collapses to buy attention.",
    thesis:
      "Persuasion is structural, not rhetorical. Engineer the offer so the recipient cannot lose, then describe the architecture in the fewest possible words. Charm is precision plus generosity — arriving already useful, asking almost nothing, and never announcing either.",
    clauses: OUTREACH_CLAUSES,
  },
  instructions: {
    trigger:
      "Load whenever drafting, reviewing, or planning any message to someone who did not ask to hear from the operator — sales, partnership, recruiting, or introduction. Apply especially when tempted to open with a greeting, introduce the sender, describe the product, or ask for a meeting.",
    decision_mandate: [
      "Whose seat is this written from — theirs or mine?",
      "What did they gain by reading it, concretely?",
      "What do they risk by replying?",
      "What are they obligated to do?",
      "Is the opener a fact I could point to on their page?",
      "Would this sentence fit any other business in their segment? Then it is filler.",
      "Does the offer's structure carry the argument, or is copy compensating for it?",
      "Is any internal parameter — minimum, dollar exposure, discount — leaking into the copy?",
      "Does the register still read as someone who does not need the order?",
    ],
    procedure: [
      "Read their site first. Take the most specific fact available: named product > named program > named platform > named service line > second location.",
      "Write the offer before the email. If the offer is weak, stop and fix the offer.",
      "Open inside their business, connected to the mechanism in the same or next sentence.",
      "State the upside in their units. Attach the proof.",
      "Design the smallest reversible first step; voice it as their convenience, never as price.",
      "Cut every sentence that carries neither their benefit nor the proof of it.",
      "Read it cold from their chair for thirty seconds and answer the three questions.",
      "If two drafts in the set share an opening sentence, the rule producing them is broken — repair the rule, not the draft.",
    ],
    output: ["SEND", "REWRITE", "FIX THE OFFER", "DO NOT SEND"],
  },
  relationships: {
    parent: "kao:philosophy",
    edges: [
      {
        to: "kao:logic-law",
        label: "Operational Logic",
        rel: "governed_by",
        url: "/a/logic-law",
      },
      {
        to: "kao:writing-law",
        label: "The Laws of Writing",
        rel: "inherits_prose_standard_from",
        url: "/a/writing-law",
      },
      {
        to: "kao:design-law",
        label: "The Laws of Design",
        rel: "sibling_standard",
        url: "/a/design-law",
      },
      {
        to: "kao:skill-law",
        label: "The Laws of Skills",
        rel: "projected_as_skill_under",
        url: "/a/skill-law",
      },
    ],
  },
  invocation: {
    directory_key: "OUTREACH_LAW",
    contract:
      "Apply the Outreach Law to a draft message or a proposed offer and return the violated clauses, the repair, and one terminal state.",
    args: { draft: "the message text", offer: "optional offer structure to judge" },
    effects: "Read-only; returns a judgment, never a send.",
  },
  authority: {
    owner: "the owner",
    amendment_policy:
      "Owner corrections append clauses with the real failure attached. Every clause traces to a rejected draft or an owner statement; semantic history is never overwritten.",
    public_read: true,
    mutation: "owner-authorized",
  },
  conformance: {
    claims: [
      "one canonical semantic object behind the page, the markdown, the Skill, and the contract",
      "every clause traceable to an owner statement or a rejected draft",
      "violations carry the date and the exhibit that produced them",
    ],
    failure_modes: [
      "greeting-plus-announcement opener",
      "sender centered before value delivered",
      "claimed quality without mechanism",
      "asking for time before delivering benefit",
      "status collapse to secure attention",
      "parameter leak into recipient-facing copy",
      "register substitution into mass-market sales language",
      "invented competitor defect or fabricated guarantee",
      "generic observation standing in for a real one",
      "template collapse: one legal opener across a whole corpus",
    ],
    tests: [
      "thirty-second cold read from the recipient's chair",
      "opener specificity: could this sentence fit another business in the segment",
      "corpus diversity: no two drafts share an opening sentence or subject",
      "parameter audit: no minimum, price, or discount voiced in copy",
      "register audit against the operative pairs",
    ],
    repair:
      "Name the violated clause, restore the recipient's seat, rebuild the opener from the most specific available fact, and re-read cold. When the whole corpus fails the same way, repair the rule rather than the drafts.",
  },
  version: {
    current: "1.1.0",
    amended_at: "2026-07-25T00:00:00-07:00",
    amendments: [
      {
        version: "1.1.0",
        change:
          "Carried the writing law's canonical resource requirements into outreach by owner order after an article shipped as a blog on the same day: zero context, zero ambiguity, all reasoning shown, every line delete-tested, evidence quoted from real people with permalinks, the sender never the subject, and harm defined as any absence of truth.",
      },
      {
        version: "1.0.0",
        change:
          "Established from the owner's outreach-law skill with the four observed failure classes attached: model voice, status collapse, parameter leak, register substitution — plus template collapse, recorded from the 121-draft convergence of 2026-07-25.",
      },
    ],
  },
  provenance: {
    canonical_source: "functions/_lib/outreach_law_object.js",
    schema_source: "functions/_lib/knowledge_action_object.js",
    skill_projection: "/api/articles/outreach-law?format=skill",
    ledger: "/api/invocations?object_id=OUTREACH_LAW",
    amendment_lineage: "/api/articles/outreach-law?format=json",
  },
});

export function outreachLawMarkdown() {
  const o = OUTREACH_LAW_OBJECT;
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
  return `# ${o.identity.title}\n\n_${o.content.summary}_\n\n${o.content.thesis}\n\n${body}\n\n## Resolve before sending\n\n${o.instructions.decision_mandate.map((l) => `- ${l}`).join("\n")}\n\n## Procedure\n\n${o.instructions.procedure.map((l, i) => `${i + 1}. ${l}`).join("\n")}\n\n## Terminal states\n\n${o.instructions.output.join(" · ")}\n\nOwner: ${o.authority.owner}. Version ${o.version.current}. Canonical object: ${o.provenance.canonical_source}.\n`;
}

export function outreachLawSkillMarkdown() {
  const o = OUTREACH_LAW_OBJECT;
  const clauses = o.content.clauses
    .map((c) => `- **${c.id} · ${c.title}** — ${c.law}`)
    .join("\n");
  return `---\nname: outreach-law\ndescription: ${o.content.summary} Load whenever drafting, reviewing, or planning any message to someone who did not ask to hear from the operator.\n---\n\n# ${o.identity.title}\n\n${o.content.thesis}\n\n## Trigger\n\n${o.instructions.trigger}\n\n## Resolve in order\n\n${o.instructions.decision_mandate.map((l) => `1. ${l}`).join("\n")}\n\n## Law\n\n${clauses}\n\n## Procedure\n\n${o.instructions.procedure.map((l, i) => `${i + 1}. ${l}`).join("\n")}\n\n## Failure modes\n\n${o.conformance.failure_modes.map((l) => `- ${l}`).join("\n")}\n\n## Tests\n\n${o.conformance.tests.map((l) => `- ${l}`).join("\n")}\n\n## Repair\n\n${o.conformance.repair}\n\n## Terminal states\n\n${o.instructions.output.join(" · ")}\n\nCanonical object: https://miscsubjects.com/api/articles/outreach-law · Human page: https://miscsubjects.com/a/outreach-law\n`;
}
