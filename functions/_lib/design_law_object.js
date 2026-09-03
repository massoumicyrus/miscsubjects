import {
  createKnowledgeActionObject,
  knowledgeActionConformance,
  knowledgeActionVersions,
  knowledgeActionVoxels,
} from "./knowledge_action_object.js";

const DESIGN_CLAUSES = [
  [
    "purpose",
    "Existence test",
    "Every recurring word, heading, link, widget, control, badge and mark stays ONLY IF it aids clarity, gives a material benefit, or removes a material detriment. IF none THEN remove it.",
  ],
  [
    "purpose",
    "Reduce before adding",
    "IF a surface is incoherent THEN remove, group, defer or collapse the competing elements. NEVER add form before reduction is exhausted.",
  ],
  [
    "nature",
    "Nature is the precedent",
    "ALWAYS treat recurrence, hierarchy, proportion and self-similarity as structural constraints. NEVER as decorative reference.",
  ],
  [
    "nature",
    "One recursive grammar",
    "ALWAYS apply the same law to site, page, section, component, paragraph, image, interval, graph, admin surface and source module.",
  ],
  [
    "system",
    "One visual system",
    "ALWAYS use exactly three type roles: display, reading, machine voice. ALWAYS one accent, one spacing scale, one radius, one contrast law across every surface. The typeface and the accent value are profile state, NEVER law.",
  ],
  [
    "system",
    "Principles are law, values are profile",
    "A principle is immutable and lives in this law. A hex, a typeface, a pixel size or a radius is profile state, defaulted in the token module and overridden through /api/design. This law NEVER names a value as an obligation. A document naming a value ALWAYS names its profile.",
  ],
  [
    "system",
    "Deliberate proportion",
    "Type scale, spacing and measure ALWAYS come from one explicit ladder in the profile tokens. NEVER invent a step per surface. Body text is ALWAYS 15-25px, line spacing 120-145% of size, measure 45-90 characters.",
  ],
  [
    "orientation",
    "Location before options",
    "ALWAYS show current location, parent category, sibling family and return path before any onward choice.",
  ],
  [
    "orientation",
    "Hierarchy before volume",
    "ALWAYS fold complexity into the smallest useful categories. ALWAYS expand one relationship family at a time.",
  ],
  [
    "orientation",
    "Sticky top-level navigation only",
    "The sticky header ALWAYS carries ONLY the highest-level human categories. Ontologies and subcategories ALWAYS live inside expanding hubs.",
  ],
  [
    "reading",
    "Editorial cadence",
    "ALWAYS repeat: idea, development, visual proof, subheading. NEVER run more than two prose beats without a change in reading mode.",
  ],
  [
    "reading",
    "Invite reading",
    "ALWAYS set display in a literary serif and hold measure near 66 characters. NEVER ship line spacing, heading scale, paragraph length or contrast that makes reading laborious.",
  ],
  [
    "reading",
    "Lists disclose logic",
    "A list ALWAYS becomes a category, sequence, comparison, map or compact logic object. NEVER a wall of bullets, links or raw pipe tables.",
  ],
  [
    "complexity",
    "Collapse optional layers",
    "ALWAYS default model commentary, provenance, machine procedures, raw fields, graph detail, controls and secondary actions to a named collapsed disclosure.",
  ],
  [
    "complexity",
    "Human surface first",
    "Raw JSON and API resources are ALWAYS labelled machine data. NEVER place them in primary navigation and NEVER let a reader arrive at one by accident.",
  ],
  [
    "interaction",
    "Interaction must clarify",
    "Search, filters, maps, AI interaction and expandable ontologies stay ONLY IF they reduce uncertainty or reveal a relationship. IF not THEN remove them.",
  ],
  [
    "interaction",
    "Relationship before click",
    "ALWAYS show why a link exists and what family it belongs to before asking for the click.",
  ],
  [
    "quality",
    "Rendering repairs or refuses",
    "ALWAYS reject or repair a malformed table, a link wall, a contrast failure or a broken source structure before it reaches a reader.",
  ],
  [
    "quality",
    "Queryable and discoverable",
    "Every reader surface ALWAYS carries categories, search or traversal, semantic headings, canonical metadata, structured data, valid internal links and responsive behaviour.",
  ],
  [
    "source",
    "The inside is beautiful",
    "ALWAYS organise source as law, primitive, composition, surface, proof. ALWAYS use shared names and one-directional dependencies. NEVER scatter local design inventions.",
  ],
  [
    "system",
    "One accent, total",
    "ALWAYS use exactly one accent colour. Neutrals ALWAYS carry the hierarchy; contrast, weight, proportion and interval ALWAYS carry the meaning. The hue is profile state; the count of one is law.",
  ],
  [
    "system",
    "Source is a REST object",
    "A source module ALWAYS carries identity, content, instructions, relationships, invocation, authority, conformance, representations, version and provenance.",
  ],
  [
    "knowledge",
    "Page, skill and directory row are one",
    "A page, its skill and its directory row ALWAYS share one identity, version and provenance. Each ALWAYS speaks in the language of its own audience.",
  ],
  [
    "knowledge",
    "Widgets are content",
    "A widget is ALWAYS the page's meaning made visible. NEVER decoration.",
  ],
  [
    "knowledge",
    "Sources wear their platform",
    "An embedded source ALWAYS renders in its own platform identity. An organisation speaking in its own name ALWAYS gets a letterhead and NEVER another masthead. Card interiors are the ONLY exemption from profile tokens. A card ALWAYS carries its ledger hash and ALWAYS appears on /design.",
  ],
  [
    "knowledge",
    "Article and skill are one",
    "An article and its skill ALWAYS share one identity, meaning, version and provenance, in distinct language for distinct audiences.",
  ],
  [
    "knowledge",
    "Maximal interoperability",
    "Article, Markdown, JSON, directory row, skill, OIP contract, REST resource, graph node, conformance target, version and receipt ALWAYS express one identity. Shared identity NEVER requires shared wording.",
  ],
  [
    "knowledge",
    "Failures become knowledge",
    "IF a model failure repeats THEN produce the article amendment, skill instruction, conformance test, code repair, directory clarification and regression proof.",
  ],
  [
    "editorial",
    "One image, one literal idea",
    "An editorial image ALWAYS shows the story's literal subject in one instantly readable scene. NEVER analogy, rendered text, tables, dashboards, terminals, UI collage, generic robot or circuit art, keyword scenes, or stock people. The prompt is ALWAYS a plain description of the subject. NEVER set a standing palette, medium, era, lighting, material, mood or draughtsmanship across articles.",
    "The image shows the SUBJECT, never the method that studied it. /a/bdnf-p21 shipped a photograph of a laboratory mouse in a cage. The animal a study was run in is a fact about the study, exactly as it is in a headline; it is not what the compound is. Cages, mice, rats, pipettes and petri dishes are banned as the subject of a compound hero. Owner, 2026-08-04: a mouse has nothing to do with the peptide.",
    "A prop that would illustrate any compound equally identifies none. Two vials on a tray, a silver tray, a loading dock, a pallet, a shelf of pill bottles: /a/wolverine-stack and /a/tirzepatide both shipped one, and a weight-loss drug illustrated by a loading dock is a picture of nothing. Show what is specific to this subject.",
    "A reference image sets the LEVEL OF CRAFT. It does not donate its props to the next brief. One approved hero of four robots at a table with a red wax seal and red string became, image after image, a single gold robot with a red seal and a red string, until the site read as though a gold robot were its mascot. Passing a good image as a reference means match this standard, never reuse these objects. Enforced in functions/_lib/title_hero_gate.js as checkHeroSubjectFit.",
    "A published article has a featured image. Ten condition articles shipped on 2026-08-04 with no hero at all, because the audit only ever asked whether an EXISTING hero was any good and was silent about the article that had none. An article with no image is not finished.",
  ],
  [
    "editorial",
    "Preflight, inspect, keep auditing",
    "ALWAYS record the article subject, hero subject, visible action and why the image belongs to the story, then pass the editorial preflight. NEVER generate a batch before one brief and one render pass. ALWAYS open the rendered asset and record what is visibly present before publishing. A prompt is NEVER visual proof.",
  ],
  // ── Widget law, 2026-08-05. The owner opened an evidence-dense article and found the cards
  // rendering light text on light surfaces — the verbatim quote, which IS the card, at 1.21:1.
  // The cause was a `prefers-color-scheme:dark` block recolouring ink on a fixed-white card.
  // The same defect had been repaired once, forty lines away, with a comment claiming it was
  // the only one. These clauses replace the comment with a formula and a gate. ───────────────
  [
    "quality",
    "Widget ink derives from the widget surface",
    "A widget stylesheet NEVER contains a prefers-color-scheme block, for any property. IF a widget needs a dark presentation THEN its surface and its ink change together in the same rule, keyed to the widget.",
  ],
  [
    "quality",
    "Contrast floors are computed",
    "Payload text ALWAYS clears 7:1 against its resolved surface. Secondary text ALWAYS clears 4.5:1. The surface is ALWAYS the nearest ancestor declaring a background, defaulting to the card. IF the ink is already at the light end THEN darken the surface, NEVER lighten the ink.",
  ],
  [
    "quality",
    "One token, one fallback",
    "Every reference to a token ALWAYS carries the same fallback, and that fallback ALWAYS clears the contrast floor on every surface the token is used on.",
  ],
  [
    "quality",
    "The quote is the payload",
    "A source's own words are NEVER styled lighter, smaller or lower-contrast than the label, masthead, hostname or timestamp around them.",
  ],
  [
    "quality",
    "Widget ink is a literal",
    "A widget's ink is ALWAYS a literal colour or a token the widget's own stylesheet declares. NEVER a token set elsewhere. Design tokens govern the page around the card, NEVER the card.",
  ],
  [
    "system",
    "Every widget is on the index",
    "/widgets ALWAYS renders one live specimen of every widget type with its key, its fields and its governing clauses. IF a widget type is added THEN its specimen is added in the same change.",
  ],
].map(([family, title, law], index) => ({
  id: `D${String(index + 1).padStart(2, "0")}`,
  family,
  title,
  law,
}));

export const DESIGN_LAW_OBJECT = createKnowledgeActionObject({
  identity: {
    id: "kao:design-law",
    slug: "design-law",
    key: "DESIGN_LAW",
    title: "The Laws of Design",
    class: "law",
  },
  content: {
    summary:
      "The complete obligational design law for making every interface, article, graph, source module, and knowledge object maximally clear and beautiful.",
    thesis:
      "The patterns that govern beautiful thought and beautiful nature must also govern design: reduction, recursion, hierarchy, proportion, rhythm, relationship, and proof.",
    clauses: DESIGN_CLAUSES,
  },
  instructions: {
    trigger:
      "Use for any design, rendering, navigation, editorial, graph, admin, source-architecture, SEO, readability, or article-skill decision.",
    decision_mandate: [
      "Does it aid clarity or orientation?",
      "Does it provide a material benefit?",
      "Does it relieve a material detriment?",
      "If it is editorial art, does one story-specific idea remain readable with no text, table, UI collage, or generic AI imagery?",
      "If every answer is no, remove it.",
    ],
    procedure: [
      "Inventory visible objects and repeated words.",
      "Remove every object that fails the decision mandate.",
      "Name the smallest useful hierarchy and current location.",
      "Apply one recursive type, color, measure, spacing, and component grammar.",
      "Establish the repeating editorial cadence.",
      "Preflight each headline and hero concept; inspect the actual asset; run the continuous editorial audit.",
      "Collapse every optional complexity layer.",
      "Generate interoperable representations from this canonical object.",
      "Validate readability, links, SEO, responsiveness, source direction, and conformance.",
    ],
    output: [
      "removals",
      "hierarchy",
      "rhythm",
      "disclosures",
      "interoperability",
      "proof",
    ],
  },
  relationships: {
    parent: "kao:philosophy",
    edges: [
      {
        to: "kao:oip",
        label: "Object Invocation Protocol",
        rel: "governs_presentation_of",
        url: "/a/oip",
      },
      {
        to: "kao:evidence",
        label: "Evidence law",
        rel: "requires_proof_from",
        url: "/graph",
      },
      {
        to: "kao:article-system",
        label: "Article system",
        rel: "renders",
        url: "/content",
      },
      {
        to: "code:design-law",
        label: "Master design module",
        rel: "implemented_by",
        url: "/api/articles/design-law#implementation",
      },
    ],
  },
  invocation: {
    directory_key: "DESIGN_LAW",
    contract:
      "Apply the complete Design Law to the named surface and return removals, hierarchy, rhythm, disclosures, interoperability, and proof.",
    args: { surface: "string or URL", task: "audit|design|refactor|validate" },
    effects: "Read-only unless the caller separately authorizes edits.",
  },
  authority: {
    owner: "the owner",
    amendment_policy:
      "Owner corrections append clauses and scored conformance tests; semantic history is never overwritten.",
    public_read: true,
    mutation: "owner-authorized",
  },
  conformance: {
    claims: [
      "one canonical semantic object",
      "all representations derive from it",
      "optional complexity defaults collapsed",
    ],
    failure_modes: [
      "local design drift",
      "link wall",
      "raw machine surface",
      "uncollapsed optional complexity",
      "manual representation drift",
      "unreadable source rendering",
      "rendered-text, table, dashboard, terminal, UI-collage, or generic-AI hero",
      "interchangeable stock scene or superficial keyword literalism",
      "uninspected generated asset or arbitrary batch generation",
    ],
    tests: [
      "facet completeness",
      "representation route integrity",
      "skill synchronization",
      "link audit",
      "responsive browser audit",
      "source dependency audit",
      "headline and hero proposal preflight",
      "actual-asset inspection record",
      "continuous corpus editorial audit",
      "card-catalog/server and chest-scan positive cases",
    ],
    repair:
      "Remove the violating object or amend the canonical clause, regenerate every representation, and rerun conformance.",
  },
  version: {
    current: "1.6.0",
    amended_at: "2026-08-01T00:00:00-07:00",
    amendments: [
      {
        version: "1.6.0",
        change:
          "Added the canonical editorial-image acceptance test and two-layer enforcement after 44 heroes were batch-overwritten first with interchangeable stock scenes and then with dashboards, tables, terminals, rendered text and generic UI art. The law now requires the article's literal subject, a pre-generation rationale, actual-asset inspection before publication, and continuous editor-style corpus auditing with actionable corrections. Positive cases include physical source records connected to server infrastructure, the missed-follow-up chest scan itself, and the repository or evidence involved in the OpenAI–Hugging Face incident.",
      },
      {
        version: "1.0.0",
        change: "Established recursive reductive design law.",
      },
      {
        version: "1.1.0",
        change:
          "Promoted the article into a complete Canonical Knowledge-Action Object with generated article, Markdown, JSON, directory, Skill, OIP, graph, conformance, version, and provenance facets.",
      },
      {
        version: "1.2.0",
        change:
          "Made every representation a typed, audience-specific expression: articles explain, Skills direct behavior, directory rows expose contracts, and OIP invocations execute with proof.",
      },
      {
        version: "1.3.0",
        change:
          "Established the monochrome visual system, the source-as-REST-object ontology, and the page-skill-directory identity.",
      },
      {
        version: "1.4.0",
        change:
          "Separated immutable principles from mutable profile values. The law no longer names typefaces or hex codes (the 1.3.0 Cormorant/Inter/brass and monochrome clauses had drifted three design generations behind the live site); concrete values now live in the runtime design profile (default in core.js, override via /api/design, disclosed at /design). Added the principle/value distinction clause, replaced the golden-ratio clause with deliberate proportion plus quantified reading bands (body 15–25px, leading 120–145%, measure 45–90 characters), and amended monochrome to single-accent restraint.",
      },
      {
        version: "1.5.0",
        change:
          "Added the platform-mimicry clause: embedded sources render pixel-faithful to their own platform (tweet = tweet, Reddit = Reddit, publisher masthead only for that publisher, letterhead for an org speaking in its own name), the one sanctioned exemption from the profile tokens. Evidence widgets became first-class disclosed specimens on /design.",
      },
    ],
  },
  provenance: {
    canonical_source: "functions/_lib/design_law_object.js",
    schema_source: "functions/_lib/knowledge_action_object.js",
    implementation: "functions/_lib/design_law.js",
    skill_projection: ".claude/skills/design-law/SKILL.md",
    ledger: "/api/ledger?object=DESIGN_LAW",
    amendment_lineage: "/api/articles/design-law/versions",
  },
});

export function designLawMarkdown() {
  const object = DESIGN_LAW_OBJECT;
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

export function designLawSkillMarkdown() {
  const object = DESIGN_LAW_OBJECT;
  return `---\nname: design-law\ndescription: Apply the miscsubjects Laws of Design when designing, reviewing, refactoring, or validating interfaces, articles, navigation, graphs, typography, source architecture, SEO, readability, or Knowledge-Action Objects.\n---\n\n# Apply the Laws of Design\n\nThis Skill is the model-operating expression of [the human article](/a/design-law). Read the canonical object at /api/articles/design-law when exact clauses or provenance are needed; do not reproduce its article prose by default.\n\n## Decide\n\n${object.instructions.decision_mandate.map((line) => `- ${line}`).join("\n")}\n\n## Operate\n\n${object.instructions.procedure.map((line, index) => `${index + 1}. ${line}`).join("\n")}\n\n## Traverse related design systems\n\nRead /api/articles/design-law and inspect ontology.relationships. For image or motion work, select the relevant GPT Image, Grok Image, ArcAds, or Grok Video object; read its embedded live directory definition and official source documentation before invoking it through OIP. Treat those systems as members of the Design conformance group, not unrelated utilities.\n\n## Reject as nonconforming\n\n${object.conformance.failure_modes.map((failure) => `- ${failure}`).join("\n")}\n\n## Return\n\nReturn only: ${object.instructions.output.join(", ")}. Cite the object identity ${object.identity.id}, its version, and the proof routes used.\n`;
}

export function designLawConformance() {
  return knowledgeActionConformance(DESIGN_LAW_OBJECT);
}

export function designLawVoxels() {
  return knowledgeActionVoxels(DESIGN_LAW_OBJECT);
}

export function designLawVersions() {
  return knowledgeActionVersions(DESIGN_LAW_OBJECT);
}
