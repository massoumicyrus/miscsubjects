
export const PRECEDENCE = [
  "1. article-class rule (this profile, for your class)",
  "2. surface rule (instructions.surface_scope on the writing law)",
  "3. core writing clause (families: hostility, compression, commitment, concrete, register, invariant, conformance)",
  "4. optional preference — never blocks publication, never cited as a defect",
];

// A defect is only a defect if it is one of the six named in the conformance family. Anything
// else is level 4 and is a preference.
export const RESOLUTION_ORDER =
  "Apply the narrowest applicable rule. Where a rule at one level permits and a rule at a " +
  "lower level forbids, the prohibition wins. Where two rules at the SAME level collide, that " +
  "is a defect in the law: fix the clauses, do not pick a winner silently.";

const HOUSE = {
  // Chosen once so no model re-litigates it. The audience and the regulatory frame are US.
  spelling: "US English. 'organized', 'labeled', 'analyze', 'fiber', 'hematocrit'.",
  dates_in_prose: "4 August 2026 — day, month spelled, year. No ordinals, no slashes.",
  dates_in_tables_and_metadata: "2026-08-04 (ISO).",
  titles: "Sentence case. Capitalize only the first word and proper nouns. No title case.",
  quotations:
    'Double quotes for quoted speech and verbatim source text. Single quotes only inside a quotation. ' +
    "A verbatim quote is never silently trimmed; use an ellipsis in brackets for an omission.",
  units:
    "Space between number and unit: 10 mg, 4 mL, 60 µg/kg. Exception: 50% and 37 °C. " +
    "Use µg not mcg in study reporting; use mcg only when quoting a vial label or a syringe mark.",
  percentages: "One decimal place when the source gives one (70.4%); whole numbers otherwise (70%). Never invent precision the source lacks.",
  ranges: "En dash, no spaces: 200–500 mcg, 2013–2026. 'between X and Y' in prose where the dash would be ambiguous.",
  numbers: "Spell out one to nine in prose unless it carries a unit or is a study count. Numerals for everything else.",
  identifiers: "PMID 37559207, NCT07437547 — bare, uppercase prefix, no punctuation between prefix and number.",
};

// Enumerated evidence-state vocabulary. A model may use these words and no others to describe
// the standing of a claim. This closes the gap the audit found: the live prose used 'tilts
// slightly' and 'simply open', which are honest but unenumerated.
export const EVIDENCE_STATES = {
  measured: "A number was recorded under a stated method. Give the number.",
  observed: "Seen and reported, but not quantified under a controlled method.",
  reported: "A person or party says it happened. Attribution required.",
  "consistent with": "Does not contradict the hypothesis, and does not establish it.",
  "not tested": "The experiment that would decide it has not been run.",
  unsupported: "Asserted somewhere, with no evidence behind the assertion.",
  "cannot be inferred": "The available evidence is of the wrong kind to reach this claim.",
  unresolved: "Evidence exists on both sides and does not decide it. Say what would.",
  open: "A live question the page is deliberately not closing. Say what would close it.",
};

const COMMON = {
  opening:
    "Sentence 1: what the thing is, in words a stranger owns. Sentence 2: the decisive state — " +
    "the verdict, or the boundary of the evidence. No third sentence describing the page. " +
    "'What follows is organized around it' and every variant is framing language and is cut.",
  ordering:
    "Decision-relevant finding first, then the evidence chain needed to believe it. Within the " +
    "evidence chain, strongest first: human, then animal with species and model, then mechanism, " +
    "then the counted reports. Mechanism may precede the evidence chain ONLY when the mechanism " +
    "is itself the decisive finding — that is the case on /a/bpc-157 and it is conforming.",
  headings:
    "A heading states a literal finding or a physical mechanism, in a human voice. Vivid is " +
    "allowed and good when it is literal: 'Nobody has ever tested it on a disc' and 'Storage has " +
    "a hard clock on it' both conform. Banned: mood, claims of importance, and analogy that adds " +
    "no information.",
  paragraphs:
    "One reasoning movement per paragraph: claim, its support, then its consequence or its limit. " +
    "A new claim resting on different evidence starts a new paragraph.",
  second_person:
    "'You' is permitted for a decision the reader will actually make — 'if you source it anyway, " +
    "here is what to check'. It is not permitted to assign the reader a role, a job or a business " +
    "(that is the invariant family), and not permitted for exhortation.",
  technicality:
    "Keep an identifier, a measurement name, or a term the reader will meet on a label, a scan " +
    "report or a forum — and translate it in the same sentence, once. Push receptor-level and " +
    "assay-level detail into a source card when the main inference does not need it.",
  form:
    "Prose for causal reasoning. Table for the same dimensions repeated across items. Numbered " +
    "list for an ordered sequence. Bullets only for mutually exclusive options. Source card for " +
    "one evidence object. Widget for a relationship or a calculation the reader would otherwise " +
    "do by hand.",
  citations:
    "A citation attaches to the smallest complete claim it supports, and supports nothing around " +
    "it by proximity. A table carries sources per row, or one clearly labeled group source for " +
    "the whole table.",
  subject_boundary:
    "Background becomes its own article only when it answers a question a person would search " +
    "separately. Otherwise it is a section here. This is the resolution between 'spin off " +
    "anything needing context' and 'one subject, one article'.",
  ending:
    "End on the last fact, limit, or open question that could change a decision. No recap, no " +
    "conclusion heading, no invitation, no generic caution.",
  revision:
    "Preserve accepted sentences, headings and structure. Rewrite only when the evidence changed, " +
    "a clause is violated, or the owner rejected that wording. Preferring a different phrasing is " +
    "not a reason, and rewriting on that basis destroys work that was already judged good.",
};

export const ARTICLE_CLASSES = {
  compound: {
    matches: "A single substance: bpc-157, tb-500, ara-290, kpv, ghk-cu, dsip, thymosin-alpha-1.",
    families: ["evidence", "medical", "canonical_resource", "sources", "plain_language", "rhythm", "harm"],
    title: "Entity: plain definition or deliverable. 'BPC-157: body protection compound' conforms.",
    required_blocks: [
      "evidence-state block, above the argument",
      "commercial-relationship disclosure, relationship only, never the identity",
      "the five questions in order: what it is, where it comes from, how it works, why that would help, what was measured",
      "dosing arithmetic shown as arithmetic, with a dose-to-syringe-marks table",
      "regulatory status with the date it was checked",
      "counted report record with its search method and denominator",
    ],
    reference: "/a/bpc-157",
    ...COMMON,
  },
  condition: {
    matches: "A disease or injury: degenerative-disc-disease, herniated-disc, sciatica.",
    families: ["evidence", "medical", "canonical_resource", "sources", "plain_language", "rhythm", "harm"],
    title: "Plain name of the condition plus what the reader gets.",
    required_blocks: [
      "natural history first — what happens with no treatment at all, with the numbers",
      "what correlates with symptoms versus what merely appears on a scan",
      "the two-rate model, but only where tissue is lost faster than replaced",
      "standard of care with its evidence and its cost",
      "action thresholds and named red-flag symptoms",
    ],
    reference: "/a/herniated-disc",
    ...COMMON,
  },
  pairing: {
    matches: "A compound applied to a condition, or a stack: bpc-157-vs-nsaids, wolverine-stack.",
    families: ["evidence", "medical", "canonical_resource", "sources", "plain_language", "rhythm", "harm"],
    title: "Name both sides and the question between them.",
    required_blocks: [
      "link the parent compound and parent condition articles rather than restating them",
      "what has been tested in the combination itself, stated once, at its real weight",
      "how the factors compound — the comparison of whole combinations, not single items",
      "where the interaction has never been measured, named as a finding",
    ],
    reference: "/a/wolverine-stack",
    ...COMMON,
  },
  contested: {
    matches: "A live or disputed event; anything where sources are parties to the dispute.",
    families: ["conflict", "evidence", "canonical_resource", "sources", "plain_language", "rhythm"],
    title: "Name the event and the disputed proposition.",
    required_blocks: [
      "event date separate from publication date on every claim",
      "first-hand versus repeated, and each source's affiliation and access limits",
      "verified fact and party claim kept in separate registers",
      "revision history where counts have moved",
      "image and video provenance",
      "a dated change log while the subject is still moving",
    ],
    reference: "/a/war-claims-under-an-open-record",
    ...COMMON,
    ordering:
      "Established base first — what is not in dispute. Then the disputed proposition, then each " +
      "party's evidence, then the verdict or the explicit open state. Never lead with the newest claim.",
  },
  system: {
    matches: "A method, capability or system this build operates.",
    families: ["canonical_resource", "sources", "plain_language", "rhythm", "surface"],
    title: "Name the system and what it does.",
    required_blocks: [
      "the named kinds of organization that would run it and the situation that makes them",
      "one scenario walked end to end with the clock and the costs running",
      "exact commands, values and expected output",
    ],
    reference: "/a/the-build-end-to-end",
    ...COMMON,
  },
  law: {
    matches: "A governing object: writing-law, design-law, operational-logic.",
    families: ["governance", "conformance", "canonical_resource", "plain_language"],
    title: "Name the law and its domain.",
    required_blocks: ["clause id, family, and the failure each clause exists to stop"],
    reference: "/a/writing-law",
    ...COMMON,
  },
};

export const KNOWN_DEFECTS = [
  {
    where: "/a/bpc-157",
    defect:
      "Opening carried two framing sentences — 'This page is the whole file on it' and 'The rest " +
      "of this page is ordered by that table' — both banned framing language.",
    resolution: "Both cut, 2026-08-04. The law was right and the prose was wrong.",
    status: "resolved",
  },
  {
    where: "writing law, evidence ordering",
    defect:
      "The law orders human, animal, mechanism, reports. The accepted BPC-157 page opens on " +
      "mechanism and tissue evidence.",
    resolution:
      "The prose was right. Mechanism may lead when the mechanism IS the decisive finding. " +
      "Written into COMMON.ordering above.",
    status: "resolved",
  },
  {
    where: "writing law W62, live prose",
    defect: "Live prose uses 'tilts slightly' and 'simply open'; W62 demands a quantity.",
    resolution:
      "Both are honest and neither is a hedge. EVIDENCE_STATES enumerates the legal vocabulary " +
      "for a claim's standing, so qualitative states are named rather than improvised.",
    status: "resolved",
  },
];

export const EDITORIAL_PROFILE = {
  id: "kao:editorial-profile",
  version: "1.0.0",
  derived_from: "prose the owner accepted, principally /a/bpc-157",
  precedence: PRECEDENCE,
  resolution_order: RESOLUTION_ORDER,
  house: HOUSE,
  evidence_states: EVIDENCE_STATES,
  classes: ARTICLE_CLASSES,
  known_defects: KNOWN_DEFECTS,
  note:
    "Load the profile for your class plus the clause families it names. A clause outside those " +
    "families does not apply to your page. Where this profile and a core clause collide, this " +
    "profile wins for that class — and the collision is reported, because a collision means one " +
    "of the two is wrong.",
};
