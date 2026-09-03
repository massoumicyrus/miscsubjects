import {
  createKnowledgeActionObject,
  knowledgeActionConformance,
  knowledgeActionVersions,
  knowledgeActionVoxels,
} from "./knowledge_action_object.js";

// THE LAWS OF SKILLS — the governance object for the article ⇄ skill loop.
// Decides when something becomes a skill, when a model may edit one, how an
// edit is judged, and whose words bind. Exists so the same failure is never
// fixed twice — by any model: Claude, Codex, Grok, Kimi, or a future one.

const SKILL_CLAUSES = [
  [
    "existence",
    "A skill is a procedure",
    "A skill exists ONLY for a repeatable procedure. Facts and conventions ALWAYS live in the always-loaded instruction files. IF an instruction section grows into a procedure THEN move it into a skill. IF a skill shrinks to a fact THEN move it back.",
  ],
  [
    "existence",
    "No skill without a failing exhibit",
    "A skill is created ONLY IF a model demonstrably failed or repeated the task without it, and its provenance ALWAYS names that exhibit. A skill written from imagination is deleted on sight.",
  ],
  [
    "existence",
    "Repetition is the trigger",
    "IF the same instruction, fix or correction occurs a second time THEN write the procedure into a skill in that turn. A third repetition of a captured pattern is a governance failure.",
  ],
  [
    "existence",
    "A gate beats prose",
    "IF a rule can be enforced mechanically THEN the enforcement is code and the skill documents ONLY the judgment the code cannot make. NEVER restate what a validator already blocks.",
  ],
  [
    "existence",
    "One concern per skill",
    "A skill covers ONLY one procedure. IF a second concern accumulates THEN extract it. IF two skills cover one concern THEN merge them and keep both provenance trails.",
  ],
  [
    "editing",
    "Write the correction before the reply",
    "IF an owner instruction changes or contradicts a rule in any skill THEN edit the skill first, in the same turn, and ONLY THEN do the work.",
  ],
  [
    "editing",
    "Edit the smallest clause",
    "ALWAYS change only the clause the failure implicates. NEVER restructure a working skill to taste.",
  ],
  [
    "editing",
    "Both trees or neither",
    "Every skill ALWAYS exists in both sibling trees. IF an edit lands in one tree THEN it lands in the other in the same change.",
  ],
  [
    "editing",
    "Claim before edit",
    "ALWAYS read fresh, claim, edit, release. NEVER edit a shared skill unclaimed.",
  ],
  [
    "editing",
    "Never edit a skill to excuse an output",
    "A skill is edited ONLY to prevent the next failure. NEVER to reclassify a past one as correct. Weakening a clause so a bad output passes is reverted with the ledger as proof.",
  ],
  [
    "judgment",
    "Fluency is not provenance",
    "A model-written rule binds other models ONLY IF it carries the failing exhibit it fixes or the owner's recorded acceptance. Confidence, structure and volume establish nothing.",
  ],
  [
    "judgment",
    "Test against a fresh agent",
    "ALWAYS judge a skill edit by behaviour: run the trigger scenario without the skill and with it, and link the pair from its provenance. IF the baseline does not fail THEN the skill teaches nothing. IF the with-skill run does not pass THEN the edit missed.",
  ],
  [
    "judgment",
    "The description is the trigger",
    "A description states ONLY when to load the skill. NEVER summarise the procedure in it, or the summary is executed and the body is skipped.",
  ],
  [
    "judgment",
    "Small enough to be read",
    "A skill body ALWAYS stays under 500 lines, and under 200 words when always-relevant. Heavy reference ALWAYS splits into files one level deep.",
  ],
  [
    "judgment",
    "Judged by counts",
    "A skill succeeds ONLY IF the failure it captures stops recurring in the governor counts, the ledger error classes and the owner-restatement counts. IF the class recurs THEN re-open the skill.",
  ],
  [
    "provenance",
    "Every edit names actor and exhibit",
    "A skill edit ALWAYS records who edited, the exhibit that forced it, and the clause delta. An edit without provenance is reverted on discovery.",
  ],
  [
    "provenance",
    "The owner outranks the archive",
    "IF a skill and a live owner instruction conflict THEN the instruction wins and the skill is amended in the same turn. NEVER quote a skill, lock or prior rule back to the owner as a reason not to act.",
  ],
  [
    "provenance",
    "Imported skills keep their source",
    "An imported skill is ALWAYS installed verbatim with its license and origin recorded. Local amendments ALWAYS append and NEVER rewrite the imported text.",
  ],
  [
    "representation",
    "A skill is an article object",
    "Every site-governing skill is ALWAYS one identity with typed representations, all derived from the object module. NEVER hand-maintain a representation twice.",
  ],
  [
    "representation",
    "One link, one identity, one folder",
    "Any object a link names is ALWAYS downloadable as one folder holding all its representations with a manifest and hash lineage. Folders ALWAYS compose upward.",
  ],
  [
    "representation",
    "Machine URLs are never human links",
    "Raw JSON and machine endpoints are ALWAYS shown to humans as copyable text. NEVER as clickable navigation.",
  ],
].map(([family, title, law], index) => ({
  id: `S${String(index + 1).padStart(2, "0")}`,
  family,
  title,
  law,
}));

export const SKILL_LAW_OBJECT = createKnowledgeActionObject({
  identity: {
    id: "kao:skill-law",
    slug: "skill-law",
    key: "SKILL_LAW",
    title: "The Laws of Skills",
    class: "law",
  },
  content: {
    summary:
      "The governance law for the article ⇄ skill loop: when something becomes a skill, when a model may edit one, how edits are judged, and whose words bind — so no failure is fixed twice.",
    thesis:
      "A skill is the build's memory of a failure it refuses to repeat. Memory that is not written is repeated; memory written without a failing exhibit is fiction; memory edited without judgment decays into noise. So skills are created only from real failures, edited the moment the owner's words change the rule, judged by fresh-agent behavior and falling failure counts, and bound by provenance — because fluency is not provenance, and one model's confident output must never silently become another model's instruction.",
    clauses: SKILL_CLAUSES,
  },
  instructions: {
    trigger:
      "Use when deciding whether something becomes a skill, before creating or editing any skill in either tree, when judging or reviewing a skill edit, when a failure or owner correction repeats, or when importing an external skill.",
    decision_mandate: [
      "Did a model actually fail at this without the skill, and where is the exhibit?",
      "Is this a procedure (skill) or a fact (instruction file) — and could a mechanical gate enforce it instead?",
      "Does an existing skill already cover this concern — edit it rather than create a sibling?",
      "Who wrote this rule, and what proof binds it — a failing exhibit, or the owner's recorded word?",
    ],
    procedure: [
      "Search both skill trees for the concern before writing anything new.",
      "Capture the failing exhibit: the ledger event, owner correction, or wrong output.",
      "If a mechanical gate can block the failure, build the gate; keep prose for judgment only.",
      "Write or edit the smallest clause that prevents the failure; one concern per skill.",
      "Sync the sibling tree in the same change; claim shared files before editing.",
      "Judge the edit: fresh agent, baseline-fails then with-skill-passes; link both exhibits.",
      "Record actor, exhibit, and delta in the ledger; the skill points at the receipt.",
      "Project the skill to its site object so every model reads the same law from one identity.",
    ],
    output: [
      "the exhibit",
      "the clause delta",
      "the gate (if mechanical)",
      "the fresh-agent verdict",
      "the ledger receipt",
      "both trees synced",
    ],
  },
  relationships: {
    parent: "kao:philosophy",
    edges: [
      {
        to: "kao:writing-law",
        label: "The Laws of Writing",
        rel: "parallels",
        url: "/a/writing-law",
      },
      {
        to: "kao:design-law",
        label: "The Laws of Design",
        rel: "parallels",
        url: "/a/design-law",
      },
      {
        to: "article:oip",
        label: "Object Invocation Protocol",
        rel: "governs_capability_use_of",
        url: "/a/oip",
      },
      {
        to: "skill:shared-failure-to-skill",
        label: "Failure → Skill procedure",
        rel: "operationalized_by",
        url: "/api/articles/skill-law/skill",
      },
    ],
  },
  invocation: {
    directory_key: "SKILL_LAW",
    contract:
      "Apply the Laws of Skills to a proposed or existing skill and return the verdict: exists rightfully / edit / merge / gate instead / delete, with the exhibit and clause cited.",
    args: { skill: "name or path or proposal text", task: "create|edit|judge|import|audit" },
    effects: "Read-only unless the caller separately authorizes edits.",
  },
  authority: {
    owner: "the owner",
    amendment_policy:
      "Owner corrections amend clauses in the same turn they are given; model-proposed amendments bind only with a failing exhibit and recorded acceptance. Semantic history is never overwritten.",
    public_read: true,
    mutation: "owner-authorized",
  },
  conformance: {
    claims: [
      "one canonical semantic object",
      "all representations derive from it",
      "every skill in both trees has a provenance trail",
      "no failure class captured by a skill recurs unaddressed",
    ],
    failure_modes: [
      "skill written from imagination with no failing exhibit",
      "correction acknowledged in chat but never written into the skill",
      "edit landing in one tree only",
      "description that summarizes the procedure instead of stating the trigger",
      "skill weakened to excuse a past output",
      "model-authored rule binding others without proof or acceptance",
      "duplicate skills accreting on one concern",
      "prose restating what a validator already blocks",
    ],
    tests: [
      "facet completeness",
      "representation route integrity",
      "sibling-tree synchronization",
      "fresh-agent baseline/with-skill pair per edit",
      "description states trigger only",
      "failure-count regression per captured class",
    ],
    repair:
      "Locate the violated clause, restore or amend it with the exhibit named, re-sync both trees, re-run the fresh-agent pair, and record the receipt. If the concern is mechanical, replace the prose with a gate.",
  },
  version: {
    current: "1.0.0",
    amended_at: "2026-07-24T00:00:00-07:00",
    amendments: [
      {
        version: "1.0.0",
        change:
          "Established the Laws of Skills as the governance object for the article ⇄ skill loop, on the owner's order. Codified: skills exist only for procedures with failing exhibits; corrections are written before replies; edits are judged by fresh-agent baseline pairs and falling failure counts; provenance binds (fluency is not provenance — a model-written rule needs an exhibit or recorded acceptance to govern another model); every governing skill is an article-object; every link's object is downloadable as one folder; machine URLs are never human links.",
      },
    ],
  },
  provenance: {
    canonical_source: "functions/_lib/skill_law_object.js",
    schema_source: "functions/_lib/knowledge_action_object.js",
    skill_projection: ".claude/skills/skill-law/SKILL.md",
    ledger: "/api/ledger?object=SKILL_LAW",
    amendment_lineage: "/api/articles/skill-law/versions",
  },
});

export function skillLawMarkdown() {
  const object = SKILL_LAW_OBJECT;
  const families = new Map();
  for (const clause of object.content.clauses) {
    if (!families.has(clause.family)) families.set(clause.family, []);
    families.get(clause.family).push(clause);
  }
  const laws = [...families.entries()]
    .map(
      ([family, clauses]) =>
        `## ${family}\n\n${clauses.map((clause) => `${clause.id}. **${clause.title}.** ${clause.law}`).join("\n\n")}`,
    )
    .join("\n\n");
  return `# ${object.identity.title}\n\n${object.content.thesis}\n\n## Decision mandate\n\n${object.instructions.decision_mandate.map((line) => `- ${line}`).join("\n")}\n\n${laws}\n\n## Representations\n\n${Object.entries(
    object.representations,
  )
    .map(
      ([name, expression]) =>
        `- **${name}:** ${expression.route} — ${expression.role} (${expression.audience})`,
    )
    .join("\n")}\n`;
}

export function skillLawSkillMarkdown() {
  const object = SKILL_LAW_OBJECT;
  return `---\nname: skill-law\ndescription: Apply the miscsubjects Laws of Skills when deciding whether something becomes a skill, before creating or editing any skill, when judging a skill edit, when a failure or owner correction repeats, or when importing an external skill.\n---\n\n# Apply the Laws of Skills\n\nThis Skill is the model-operating expression of [the human article](/a/skill-law). Read the canonical object at /api/articles/skill-law when exact clauses or provenance are needed.\n\n## The axiom\n\nA skill is the build's memory of a failure it refuses to repeat. Unwritten memory repeats; exhibit-less memory is fiction; unjudged edits decay into noise. Fluency is not provenance — one model's confident output never silently becomes another model's instruction.\n\n## Decide\n\n${object.instructions.decision_mandate.map((line) => `- ${line}`).join("\n")}\n\n## Operate\n\n${object.instructions.procedure.map((line, index) => `${index + 1}. ${line}`).join("\n")}\n\n## Reject as nonconforming\n\n${object.conformance.failure_modes.map((failure) => `- ${failure}`).join("\n")}\n\n## Pair with\n\nshared-failure-to-skill (the capture procedure), shared-rule-capture (owner restatements), shared-write-law (claim before edit), writing-skills (authoring mechanics), skill-creator (eval harness), test-driven-development and systematic-debugging (the code-writing discipline this law governs the upkeep of).\n\n## Return\n\nReturn only: ${object.instructions.output.join(", ")}. Cite ${object.identity.id}, its version, and the exhibits used.\n`;
}

export function skillLawConformance() {
  return knowledgeActionConformance(SKILL_LAW_OBJECT);
}

export function skillLawVoxels() {
  return knowledgeActionVoxels(SKILL_LAW_OBJECT);
}

export function skillLawVersions() {
  return knowledgeActionVersions(SKILL_LAW_OBJECT);
}
