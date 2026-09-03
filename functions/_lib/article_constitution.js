// What belongs in an article — binding slots for writers, models, and claim posters.

import { selfMarkdown } from "./self_explain.js";
import { SOFTWARE_COMPARISON_AXIS_IDS } from "./build_comparison_axes.js";
import { NORMANDY_SLOTS, STANDING_ANSWER_LIMITS } from "./normandy_contract.js";

export const ARTICLE_SLOTS = [
  { id: "what_it_is", required: true, answers: "What is the object in plain literal language?" },
  { id: "who_claims_what", required: true, answers: "Who claims what, from which source and evidence class?" },
  { id: "what_is_known", required: true, answers: "What opened evidence establishes under the article's domain profile" },
  { id: "what_is_unknown", required: true, answers: "What is NOT known — explicit gaps" },
  { id: "mechanism", required: false, answers: "Proposed mechanism (mechanistic tier only)" },
  { id: "limitations", required: true, answers: "Limits of the evidence and exact unresolved questions" },
  { id: "disclaimer", required: false, answers: "Domain-specific safety statement when the subject requires one" },
];

export const ARTICLE_CONSTITUTION = {
  version: 3,
  principle:
    "Articles are voxel graphs of claims — not prose blobs. Every assertion is a claim atom with tier, weight, source_ids, and posted_by provenance.",
  slots: ARTICLE_SLOTS,
  claim_rules: [
    "One claim = one falsifiable assertion. No compound claims.",
    "Every claim must declare tier: human|preclinical|anecdotal|mechanistic|speculative|system.",
    "system tier = architecture/design axioms (not biological mechanism). Use for protocol self-definition.",
    "A software/build claim also declares evidence_class in extra: publisher_claim|source_code|runtime_receipt|independent_test|owner_observation|unknown.",
    "Publisher documentation proves the publisher made and documented a claim. It is not independent runtime proof.",
    "Source code proves an implementation exists. A successful receipt proves one invocation. Neither proves general reliability or field superiority.",
    "Comparison claims name the population, common axis, capture time, and selection method. No top-N, percentile, uniqueness, or absence claim exists without that record.",
    "Sourced claims must cite source_ids from the hash-chained ledger.",
    "Unsourced claims must set source_status: unsourced and why_material.",
    "posted_by is mandatory on every new claim (model id, human, or channel).",
    "No medical advice, no doses, no 'you should take'.",
    "Bad information is retracted (status:retracted), never deleted — retraction event stays on ledger.",
    "Adversary challenges link via challenges[] / challenged_by[] — target may be downweighted.",
    "Leaked secrets are scrubbed to [REDACTED:secret-leak] with scrub_events tombstone — honest audit trail.",
  ],
  source_rules: [
    "Every source is a voxel edge: type, url, exact quote, summary, found_by, accessed_at.",
    "Sources hash-chain — prev/hash on append.",
    "Anecdotal sources must name platform (reddit|x|youtube|imessage|user_entry).",
    "Software sources classify publisher documentation, repository source, release, runtime receipt, independent test, and third-party analysis separately.",
    "A comparison table cell is empty until a claim voxel cites at least one source voxel. Model prose alone is not evidence.",
  ],
  writing_rules: [
    "Literal nouns and verbs. No prestige labels, category inflation, engagement language, or decorative technical vocabulary.",
    "Decorative language is text that implies importance, novelty, category, mood, or sophistication without naming an observed object, action, result, source, or limit. Delete it.",
    "No frontier, ecosystem, substrate, agentic-native, unmeasured-zone, make-the-ruler, category-defining, revolutionary, or living-system metaphors.",
    "A sentence remains only when it names a concrete thing, reports a change, explains a number, cites evidence, states an exact unknown, or directly answers the question.",
    "Technical nouns are allowed only when literal. Define the first use by what the named code or data object stores or does.",
    "State the observed object before naming a category for it.",
    "Keep the evidentiary boundary beside the exact claim it limits.",
    "Unknown means unknown. Missing evidence does not become absence.",
  ],
  software_comparison_axes: SOFTWARE_COMPARISON_AXIS_IDS,
  normandy_contract: {
    purpose: "Each outside-model session reads the current graph, receives one empty slot, and adds data that was not already stored.",
    slots: NORMANDY_SLOTS,
    standing_answer_limits: STANDING_ANSWER_LIMITS,
    no_repeat_rules: [
      "A repeated standing limit is context, not a new contribution.",
      "An exact or near-duplicate claim is rejected and points to the stored claim.",
      "A duplicate source does not complete an assignment.",
      "A response completes only after at least one new graph object lands.",
      "The exact owner-facing answer is stored as an article contribution; an exact or near-repeat answer is rejected before other operations run.",
      "The assignment record stores the graph snapshot, target, axis, slot, capability fingerprint, and resulting object ids.",
    ],
    assignment: "GET /api/normandy?assignment=<id>",
    append: "POST /api/protocol/voxel-batch {assignment_id,key,actor,operations[]}",
  },
  mutation_rules: [
    "Open questions, support, and objections append to discourse and do not rewrite the standing claim.",
    "Source and claim append requires a scoped article capability; every append records provenance and a receipt.",
    "Existing text edits use the current voxel hash. A stale hash writes nothing.",
    "Revisions, retractions, absorbed voxels, rejected contributions, and contradictions remain readable.",
  ],
  ontology_rules: [
    "Peptide articles (bpc-157, tb-500) are tree roots.",
    "Condition articles (bpc-157-glp1-gut-damage) branch from peptides.",
    "Stack articles (wolverine-stack-glp1) compose peptides — never duplicate peptide mechanism prose.",
    "If an article has no parent embeds and is not a root peptide → sprawl candidate.",
    "Misstep = duplicate scope with another slug; merge or reparent via embeds.",
  ],
  post_protocol: {
    claim: "POST /api/protocol/claim",
    source: "POST /api/protocol/sources",
    ingest: "POST /api/protocol/ingest",
    webhook: "POST /api/articles/<slug>/webhook {kind:claim|source}",
    imessage_claim: "claim {slug}|{tier}|your assertion — who claims it, source?",
    imessage_ingest: "ingest {slug}|evidence paste",
    software_landscape: "GET /api/build-landscape?next=1&lane=field|build|opposition|synthesis",
    queue_population: "POST /api/build-landscape {action:queue_targets, cohort, query, sort, captured_at, source_url, targets[]}",
  },
};

export function constitutionMarkdown(slug) {
  const self = selfMarkdown("article_constitution", {
    slug: slug || null,
    contains: "required slots, claim rules, source rules, ontology rules, post_protocol",
    how_to_use: "Defines what belongs in every article. Pair with voxels + ontology endpoints.",
  });
  const lines = [
    self,
    "",
    "---",
    "",
    "# Article constitution (miscsubjects)",
    "",
    ARTICLE_CONSTITUTION.principle,
    "",
    "## Required slots",
    ...ARTICLE_SLOTS.map(
      (s) =>
        "- **" +
        s.id +
        "**" +
        (s.required ? " (required)" : "") +
        " — " +
        s.answers,
    ),
    "",
    "## Claim rules",
    ...ARTICLE_CONSTITUTION.claim_rules.map((r) => "- " + r),
    "",
    "## Source / voxel rules",
    ...ARTICLE_CONSTITUTION.source_rules.map((r) => "- " + r),
    "",
    "## Writing rules",
    ...ARTICLE_CONSTITUTION.writing_rules.map((r) => "- " + r),
    "",
    "## Software / build comparison axes",
    ...ARTICLE_CONSTITUTION.software_comparison_axes.map((r) => "- " + r),
    "",
    "## Normandy contribution contract",
    ARTICLE_CONSTITUTION.normandy_contract.purpose,
    ...ARTICLE_CONSTITUTION.normandy_contract.slots.map((slot) => "- " + slot.id + " — " + slot.stores),
    ...ARTICLE_CONSTITUTION.normandy_contract.no_repeat_rules.map((rule) => "- " + rule),
    "Assignment: " + ARTICLE_CONSTITUTION.normandy_contract.assignment,
    "Append: " + ARTICLE_CONSTITUTION.normandy_contract.append,
    "",
    "## Mutation and contribution rules",
    ...ARTICLE_CONSTITUTION.mutation_rules.map((r) => "- " + r),
    "",
    "## Ontology / anti-sprawl",
    ...ARTICLE_CONSTITUTION.ontology_rules.map((r) => "- " + r),
    "",
    "## How to POST into the ledger",
    "```json",
    JSON.stringify(ARTICLE_CONSTITUTION.post_protocol, null, 2),
    "```",
  ];
  return lines.join("\n");
}
