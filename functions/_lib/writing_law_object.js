import { EDITORIAL_PROFILE } from "./editorial_profile.js";
import {
  createKnowledgeActionObject,
  knowledgeActionConformance,
  knowledgeActionVersions,
  knowledgeActionVoxels,
} from "./knowledge_action_object.js";

const WRITING_CLAUSES = [
  [
    "hostility",
    "Opacity is hostility",
    "NEVER use a decorative, ambiguous or opaque word. IF a plain word carries the same meaning THEN use the plain word.",
  ],
  [
    "hostility",
    "Deliver the ordered form",
    "ALWAYS deliver a thought in the order you hold it. NEVER make the reader reconstruct it.",
  ],
  [
    "hostility",
    "Ambiguity is not politeness",
    "NEVER hedge to avoid commitment. ALWAYS state the thing that could be wrong.",
  ],
  [
    "hostility",
    "The burden is on the writer",
    "IF a reader asks what a sentence means THEN rewrite it in plainer words with a concrete case. NEVER restate it at the same altitude. NEVER blame the reader.",
  ],
  [
    "compression",
    "Existence test",
    "A sentence stays ONLY IF it carries a fact, a claim, a number, a name or a position. IF not THEN cut it.",
  ],
  [
    "compression",
    "Say it once",
    "ALWAYS state a point once. NEVER restate it as summary, recap or emphasis.",
  ],
  [
    "compression",
    "One question at a time",
    "ALWAYS resolve one question before opening another. NEVER branch into parallel scaffolding.",
  ],
  [
    "commitment",
    "Falsifiable or flagged",
    "ALWAYS sharpen a claim until it could be wrong. IF it cannot be THEN label it an axiom or a bet.",
  ],
  [
    "commitment",
    "No decorative certainty",
    "NEVER use certainty as decoration. NEVER use qualifier-armor. State the confidence you have.",
  ],
  [
    "commitment",
    "Land somewhere",
    "ALWAYS reach a verdict. IF two positions both hold THEN present both with their evidence and say what would decide it. NEVER present balance in place of a verdict.",
  ],
  [
    "commitment",
    "Concede plainly",
    "IF a point against you holds THEN concede it in one sentence and continue. NEVER bury it and NEVER soften it.",
  ],
  [
    "concrete",
    "Concrete over abstract",
    "ALWAYS attach one concrete case to an abstract claim.",
  ],
  [
    "concrete",
    "Plain words only",
    "ALWAYS use the plainest word that keeps the meaning exact.",
  ],
  [
    "rhythm",
    "Vary the sentence",
    "ALWAYS vary sentence length. NEVER write a run of same-shaped sentences.",
  ],
  [
    "rhythm",
    "Headings state findings",
    "A heading ALWAYS states a literal finding or a physical mechanism. NEVER a filing label, NEVER mood, NEVER analogy. IF two pages could swap a heading THEN rewrite it.",
  ],
  [
    "register",
    "End where the substance ends",
    "ALWAYS stop when the substance stops. NEVER add a closing recap.",
  ],
  [
    "surface",
    "Write to the surface",
    "ALWAYS load the clause families for your surface and NEVER apply a clause outside them.",
  ],
  [
    "surface",
    "Tag deliberately",
    "ALWAYS choose every tag, hash and signature for a stated reason. NEVER add one by habit.",
  ],
  [
    "canonical_resource",
    "An article solves the problem",
    "An article ALWAYS solves the reader's problem from that page alone. NEVER narrate a process and NEVER describe itself.",
  ],
  [
    "canonical_resource",
    "Spell out every step",
    "ALWAYS state each step in order and in precise terms. IF a term carries complexity THEN define it in place.",
  ],
  [
    "canonical_resource",
    "Zero context",
    "ALWAYS define every term that carries complexity or could be taken two ways, in place or by link to its own page.",
  ],
  [
    "canonical_resource",
    "Show every step",
    "ALWAYS show premise to conclusion with nothing skipped, IN THAT ORDER. NEVER present a conclusion whose steps are absent, and NEVER present it before them. A page is read top to bottom by someone who knows nothing: what each named thing IS, then how the thing being treated actually works, then what each option does to that process with its numbers, and ONLY THEN what follows from it. A verdict in the opening is a conclusion whose steps are absent, however true it is."
  ],
  [
    "canonical_resource",
    "Executable on the page",
    "ALWAYS give exact commands, exact names, exact labels and exact expected output. A step that needs an earlier value ALWAYS comes after it.",
  ],
  [
    "canonical_resource",
    "State money and reasons",
    "ALWAYS give real rates, measured cost and the arithmetic. ALWAYS say why the design was chosen and what the alternatives cost.",
  ],
  [
    "canonical_resource",
    "One idea, one block",
    "ALWAYS give a unique idea its own visible object: widget, card, table, code block or source card. NEVER hide it inside a paragraph.",
  ],
  [
    "canonical_resource",
    "Spin off context",
    "IF something needs more than a paragraph of background THEN give it its own article and link it.",
  ],
  [
    "canonical_resource",
    "Delete-test every sentence",
    "Delete each sentence. IF the page loses no fact, no number, no action and no step of reasoning THEN it stays deleted.",
  ],
  [
    "canonical_resource",
    "The model is never the subject",
    "NEVER narrate your own process. NEVER make the author or a vendor the protagonist. ALWAYS report a measurement with its method.",
  ],
  [
    "sources",
    "Cite the people who did it",
    "ALWAYS cite people who did the thing in public, positive and negative. NEVER let vendor documentation be the whole source set.",
  ],
  [
    "sources",
    "Anecdotes are labelled cards",
    "An anecdotal source ALWAYS renders as its own card with platform, handle, verbatim quote, date and permalink, labelled anecdotal. NEVER paraphrase it into an assertion. NEVER drop it for being inconvenient.",
  ],
  [
    "sources",
    "Publish the failed search",
    "NEVER claim nothing was found. IF a search returns nothing THEN publish the platforms, terms, date range and date searched.",
  ],
  [
    "sources",
    "Six source classes",
    "A how-to page ALWAYS carries: vendor documentation, the spec, the repository, an independent measurement with its harness, quoted people, and a first-party measurement with its method.",
  ],
  [
    "harm",
    "Truth over helpfulness",
    "ALWAYS be complete and literal. NEVER optimise for sounding helpful, engaging or agreeable.",
  ],
  [
    "harm",
    "Write so a cheap model can execute it",
    "ALWAYS write so a model that follows instructions literally can execute the page without inference. IF a step needs judgment THEN state the rule that decides it.",
  ],
  [
    "governance",
    "The object is the law",
    "The law object is authoritative. A skill file is a projection. NEVER write from the projection.",
  ],
  [
    "social",
    "A post names who and what",
    "A post ALWAYS names who it is about and what it is about, in the post itself.",
  ],
  [
    "social",
    "Tags and hashtags are obligatory on every social post, and only there",
    "This clause governs SOCIAL POSTS ONLY — X and any equivalent feed. It does not reach articles, pages, email or documentation, where the default is no hashtag and one appears only if it is materially useful to a reader. On a social post: at least one account tag and at least one hashtag. Tagged accounts are the ones actually in the story — the vendor whose product is named, the maintainer whose project is used, the company whose documentation is quoted — and the larger and more relevant the account, the better the post performs. Hashtags are the searchable term a real community browses. Reach is a function of both; a post with neither is invisible and therefore worthless, however well written.",
  ],
  [
    "social",
    "Never honour the author",
    "NEVER praise, thank or credit the author of the thing you are posting about.",
  ],
  [
    "social",
    "Maximum value, fewest characters",
    "ALWAYS carry the maximum value in the fewest characters.",
  ],
  [
    "social",
    "The post is the value",
    "The post ALWAYS carries the value on its own. A link is ONLY a footnote.",
  ],
  [
    "social",
    "Publication is not an event",
    "NEVER post that something was published. ONLY post the substance.",
  ],
  [
    "social",
    "Write to one person",
    "ALWAYS write a post the way you would tell one person who would care.",
  ],
  [
    "social",
    "Earn the tag",
    "ONLY tag an account or add a hashtag when it changes who should see the post.",
  ],
  [
    "social",
    "Grade the post first",
    "ALWAYS grade a post against the six booleans before sending. IF any is false THEN rewrite it.",
  ],
  [
    "canonical_resource",
    "Fetch the law before writing",
    "ALWAYS fetch the clauses from GET /api/articles/writing-law before the first sentence. NEVER write from memory of the law or from a skill file.",
  ],
  [
    "canonical_resource",
    "Zero-context gate",
    "Before publishing, ALWAYS confirm a stranger can state after one read: what the page is about, what problem it solves, the mechanism, and what to do. IF any is missing THEN rewrite.",
  ],
  [
    "canonical_resource",
    "Never name an audience",
    "A page about a substance or a condition is ONLY about that subject. NEVER name a profession, a buyer, a clinic, a market or a business. ONLY a page about a method or system names the organisations that run it.",
  ],
  [
    "canonical_resource",
    "Walk one scenario",
    "A method page ALWAYS walks one application end to end: starting state, each action, what each step produces, its cost in time and money, what breaks, ending state. NEVER a capability list.",
  ],
  [
    "canonical_resource",
    "The title names subject and deliverable",
    "A title ALWAYS states the subject and what the reader gets, in plain nouns, under 115 characters, legible with no surrounding page. NEVER a statistic, a question, a tease, an evidence tier, or a word implying importance.",
  ],
  [
    "canonical_resource",
    "Define it in the first two sentences",
    "The first sentence ALWAYS states what the subject is, in words a reader who knows nothing will understand, and what it does. NEVER open with the argument, the stakes or an anecdote. The ban on opening with a contrast was REPEALED 2026-08-08 for pages whose slug names two things: W113 requires the comparison, and a comparison page whose first sentence names neither thing it compares has failed W21 instead. On such a page the first sentence still says what each named thing IS before anything is compared.",
  ],
  [
    "canonical_resource",
    "No framing language",
    "NEVER write a sentence whose subject is this page, this article or this section. NEVER announce what the page will do.",
  ],
  [
    "canonical_resource",
    "Never pre-argue",
    "NEVER anticipate a critic, rank dismissals, or answer an objection nobody filed. ONLY record objections actually made, with date and actor.",
  ],
  [
    "canonical_resource",
    "The hero image makes one story-specific editorial idea visible",
    "NO TEXT IN THE IMAGE, AND NEVER A MODEL NAME. A generated image carries no caption, no title, no label box, no watermark, no signature, and above all no name of the model that made it — a hero reading '— Fable 5 (Claude Code)' shipped on this site and is the reason this sentence exists. The page renders the title; the image must not. The model signature belongs in provenance metadata, never on a pixel. Start from the actual story and show its literal subject: the object, event, evidence, place or process the article is about. Conforming: a missed radiology follow-up shows the chest scan itself; an article defining AI-native content can show physical source records connected to the real server infrastructure that stores and serves them; the OpenAI–Hugging Face incident images show the repository, package, evidence break or compute involved in the reported failure. Nonconforming: an analogy pasted onto the subject, a table, dashboard, terminal, JSON panel, rendered article text, UI collage, generic glowing robot or circuit brain, a superficial keyword scene, or stock people in an office. Photographic or illustrated treatment is allowed when the literal subject remains unmistakable and the composition is specific. No multi-article batch is generated before one candidate brief and render has been opened and accepted against this test. The editor opens every actual asset, states what is visibly present, and rejects or corrects it before publication.",
  ],
  [
    "canonical_resource",
    "Preflight the headline and hero",
    "ALWAYS pass a headline and hero brief through the cold-reader and story-specific tests before writing or generating. ALWAYS inspect the rendered asset before publishing. NEVER approve a prompt in place of a render.",
  ],
  [
    "canonical_resource",
    "One subject, one article",
    "Facets of one subject are ALWAYS sections, NEVER separate pages.",
  ],
  [
    "plain_language",
    "Plain word beats technical word",
    "NEVER use a scientific, clinical or Latinate term where an ordinary word says the same thing. IF the reader will meet the term on a label or a scan THEN give the plain sentence first and the term once in parentheses.",
  ],
  // Added after 411 article bodies were found to be assembled by JavaScript string templates in
  // functions/_lib/article_prose.js and functions/_lib/enrichment_logic.js. Every clause in this
  // law was already correct and every one of them was violated, because a `.push()` call cannot
  // read a law. The defect was never a missing rule about vocabulary. It was that the writing
  // path had no writer in it. This clause exists so that adding more writing rules is never again
  // the proposed remedy for prose no model produced.
  [
    "invariant",
    "Prose is written, never emitted",
    "Reader-facing prose is ALWAYS written by a writer holding this law. NEVER emitted by a template, a string concatenation or a filled skeleton.",
  ],
  [
    "plain_language",
    "Every line helps or removes a harm",
    "Every sentence ALWAYS states something that helps the reader or removes something that would hurt them. ALWAYS write X does Y, which causes Z. NEVER turn a verb into an abstract noun.",
  ],
  [
    "evidence",
    "Two rates, compounding, and the negation test",
    "ALWAYS write a substance or condition page as two rates: tissue is broken down at one speed and rebuilt at another, and every fact is placed by what it does to one of them. ALWAYS give the complete register of both sides: every detriment and its size, every benefit and its size. ALWAYS state what a substance does alone, what it does with each substance it is routinely combined with, and where that pair has never been measured. ALWAYS compare whole combinations, because a reader chooses a combination and never one item. ALWAYS put every substantive claim against what would falsify it. IF the condition is infection, autoimmune disease, cancer, poisoning, acute trauma or psychiatric illness THEN say in one line that this model does not fit and organise on the mechanism that governs it.",
  ],
  [
    "evidence",
    "Count the anecdotes",
    "ALWAYS gather first-hand reports at scale and present them as counts with the denominator stated. ALWAYS surface no-effect and harm reports as prominently as positive ones.",
  ],
  [
    "evidence",
    "Organise on what is known",
    "ALWAYS carry the evidence state and the commercial disclosure. The ordering rule that stood here — order by strength, human first — was REPEALED 2026-08-08: it forced an empty human tier to the front of every page that had one, which is the whole corpus. W114 governs order now, and its rule is that the tiers descend AFTER what the evidence supports doing, and that an empty tier yields the answer to the tier below it.",
  ],
  [
    "evidence",
    "Never hedge",
    "NEVER write may, might, could potentially, some evidence suggests, or more research is needed. ALWAYS give the count, species, dose and result. IF no number exists THEN name the missing measurement and what would settle it.",
  ],
  [
    "register",
    "The reader has the condition",
    "ALWAYS write for the person who has the condition. NEVER for a practitioner, a buyer or a seller.",
  ],
  // W64 "Evidence-state block first" REPEALED 2026-08-08. Its text was: "A substance page ALWAYS
  // opens with a block stating: how many randomised human trials exist and what they found, how
  // many people have taken it in a study, what the animal record covers, what has never been
  // measured in a person. IF none THEN say none. NEVER move it below the fold."
  //
  // It commanded, as an absolute with its own NEVER, exactly the opening W111 forbids as an
  // absolute with its own NEVER. Both were scoped to a substance page. Both governed the opening.
  // W81 could not resolve it — equally narrow, both prohibitions — and W81's own instruction in
  // that case is "fix the clauses and NEVER pick a winner silently", which is what nobody did.
  //
  // This is why the owner removed a study-inventory opening from these pages four times in one day
  // and it returned in a new shape each time: the writer was obeying W64. The evidence state is not
  // lost — it is required still, below the first sentence that states an effect. See W111.
  [
    "conformance",
    "Disclose the commercial relationship on the page",
    "Where the site, its operator, or an affiliated business sells, brokers, or profits from a substance a page describes, the page says so plainly and in its own body. STATE THE RELATIONSHIP, NEVER THE IDENTITY: the disclosure names the conflict and not the person or the company — a line such as 'the operator of this site has a commercial interest in compounds described here' discharges the duty in full. Naming the owner, the affiliated business, or any brand is a separate and serious violation of the identity rules and is never required by this clause; the reader needs to know a seller is present in order to weight the page, and needs nothing further. Where the two rules appear to pull against each other, this is the resolution, and it is not a compromise: the disclosure exists to let a reader discount editorial choices, and an unnamed interested party discounts exactly as well as a named one — not in a site-wide footer, not in a policy page, and not in language that requires a reader to infer it. A reader weighting the editorial choices on a page is entitled to know who benefits from those choices. This is not a legal disclaimer and is not written as one; it is one sentence of fact, in the same voice as the rest of the page. Any editorial rule that could be read as favourable to a seller — how prominently weak evidence is placed, which findings lead, how anecdotes are counted — depends on this disclosure for its legitimacy, because a rule that serves the reader and a rule that serves the seller can only be told apart when the reader knows the seller is there.",
  ],
  [
    "evidence",
    "A citation supports its own sentence",
    "A citation ALWAYS supports the exact sentence it hangs on, at that strength, for that population. ALWAYS fetch every identifier and confirm it resolves before publishing. An unresolved identifier is treated as fabricated.",
  ],
  [
    "evidence",
    "Keep five distinctions separate",
    "NEVER treat correlation as causation, a mechanism as an outcome, an animal result as a human result, a surrogate marker as a symptom, or absence of evidence as evidence of no effect. ALWAYS say which is being asserted.",
  ],
  [
    "evidence",
    "Every number carries its context",
    "A consequential figure ALWAYS states denominator, unit, comparator, time period, sample size and uncertainty. IF an effect is relative THEN give the absolute effect beside it.",
  ],
  [
    "medical",
    "Patient outcome before surrogate",
    "ALWAYS report pain, function, work, surgery and survival before an imaging or lab measure, and say which kind each result is. IF only surrogates exist THEN state that as the limit.",
  ],
  [
    "medical",
    "Matched dose and route",
    "ALWAYS state benefit and harm at the same dose and route. ALWAYS give the human dose against the animal dose with the conversion, adverse events with denominators, funding, conflicts, enrolment, completion, contraindications, interactions, and regulatory status with its date.",
  ],
  [
    "medical",
    "Give the decision, not the disclaimer",
    "NEVER write a general caution to consult a professional. ALWAYS state what to try, what has no human support, what not to combine, what to stop on, and the named symptoms warranting immediate medical attention.",
  ],
  [
    "conflict",
    "Separate event from report",
    "ALWAYS state when a thing happened separately from when it was reported, and who saw it separately from who repeated it.",
  ],
  [
    "conformance",
    "The measurable defects",
    "ALWAYS fail a page carrying any named measurable defect.",
  ],
  [
    "evidence",
    "Label the claim type",
    "Every substantive claim is ALWAYS one of: FACT, INFERENCE, CAUSAL, HYPOTHESIS, RECOMMENDATION, PERSONAL REPORT.",
  ],
  [
    "evidence",
    "Count independent sources",
    "IF a claim carries several citations THEN state how many independent groups, labs, cohorts or datasets are behind it. IF the literature descends from one investigator THEN say so in the text.",
  ],
  [
    "evidence",
    "Date every consequential claim",
    "ALWAYS state when a regulatory status, trial status, price, availability or safety finding was last verified.",
  ],
  [
    "evidence",
    "State the threshold",
    "ALWAYS state what the evidence supports doing now, waiting on, and avoiding. IF the subject can present seriously THEN name the specific signs warranting urgent care.",
  ],
  [
    "evidence",
    "Publish the counting method",
    "IF a rate is built from user reports THEN publish platforms, exact terms, date range, deduplication, inclusion rule, exclusions and selection biases.",
  ],
  [
    "conformance",
    "Corrections name the change",
    "A correction ALWAYS names the claim, the change and the evidence that forced it.",
  ],
  [
    "conformance",
    "Repair what you read",
    "IF you read a violation THEN repair it in the same turn. NEVER file it and move on.",
  ],
  [
    "conformance",
    "The narrower prohibition wins",
    "IF two clauses collide THEN apply the lower band: 1 harm and legal truth, 2 evidence discipline, 3 reader comprehension, 4 structure and decision, 5 register. Within one band apply the narrowest, and IF one permits and a narrower forbids THEN the prohibition wins. IF two prohibitions collide inside one band THEN that is a defect in the law and NEVER a choice for the writer: stop, repeal or amend one of them, and say which in the same turn. NEVER pick a winner silently. Four repeals on 2026-08-08 — W50 in part, W61 in part, W64 outright, W47 in part — were all collisions a writer had been resolving silently for months.",
  ],
  [
    "invariant",
    "Length is an output",
    "A page is ALWAYS as long as its clauses require and no longer. NEVER target a length.",
  ],
  [
    "invariant",
    "Nothing depends on who reads it",
    "NEVER write anything whose truth depends on who is reading.",
  ],
  [
    "invariant",
    "Separate what is invariant from what is relative",
    "Before writing, sort the subject into three bins and keep them visibly separate on the page. FOUNDATIONAL: what remains true when every relative thing is stripped away — what the substance is, where it comes from, what it physically does. ALWAYS or NEVER: the booleans. Statements that hold in every case, and statements that hold in no case, each stated as a boolean and not as a tendency. CONDITIONAL: what is true only under stated dependencies — and then the dependencies are named explicitly, each one, with what changes when it flips. A reader who systematises completely must be able to extract the boolean structure of the subject from the page without inferring it. Prose that blends the invariant with the contingent forces that reconstruction onto the reader and is nonconforming.",
  ],
  [
    "invariant",
    "Name the dependency",
    "IF a claim holds only under a condition THEN state the condition in the same sentence or the next. NEVER imply it.",
  ],
  [
    "evidence",
    "Tag the evidence tier on every substantive claim, and match the verb to the tier",
    "Every claim carries its tier as CLAIM METADATA — in the claims array, where a machine reads it and a reader never trips over it. The tier is NEVER written into the prose as a label. Barking 'HUMAN.' or 'STRUCTURE.' at the head of a sentence is unreadable and is banned outright. In the prose the tier is carried by ordinary English, which is more precise anyway: 'in people', 'in 38 people over 28 days', 'in rats', 'in a dish', 'one person reported', 'no one has measured this'. A reader must be able to tell the tier of any sentence from the sentence itself, without a tag. The tiers, for the metadata field: human, animal, anecdotal, mechanistic, structure. The verb is constrained by the tier and the constraint is absolute. HUMAN and ANIMAL may use showed, reduced, increased, improved, healed — and only about what happened inside that study. ANECDOTAL may use reported, or 'n of m people described'. STRUCTURE may use works by, is studied for, is derived from. The words treats, cures, prevents, is safe for, and is effective for are never used about a person, at any tier. Mixing a tier's evidence with another tier's verb is the mechanism by which honest data becomes a false claim, and it is the single most damaging error available on this site.",
  ],
  [
    "canonical_resource",
    "Five questions in order",
    "A substance page ALWAYS answers, in order: what it is; where it comes from and whether the sold form is the natural molecule or a synthetic piece; how it works physically; why that mechanism would help the tissue; what was measured, with numbers.",
  ],
  [
    "compression",
    "Six sentence jobs",
    "A sentence ALWAYS defines a term, locates an origin, explains a mechanism, explains a physical benefit, reports measured data, or connects data to mechanism. IF none THEN cut it.",
  ],
  [
    "canonical_resource",
    "Complete on one page",
    "ALWAYS answer every question the subject raises on the page, foundational before dependent. NEVER send the reader elsewhere for a definition, number, dose, risk or legal status.",
  ],
  [
    "register",
    "No invented grammar",
    "NEVER invent shorthand: no label-colon openers, no telegraphic fragments, no bracketed codes, no notation the reader must learn before reading. ALWAYS use ordinary English. A contraction, a plain idiom and a short spoken sentence ALL conform.",
  ],
  [
    "register",
    "Impossible to misunderstand",
    "ALWAYS write so a reader cannot fail to understand. NEVER omit or soften anything to get there.",
  ],
  [
    "register",
    "No generated skeleton",
    "NEVER fill one skeleton across pages. NEVER repeat a hedge, disclaimer or closing across articles. IF the prose under two identical headings could be swapped THEN rewrite both.",
  ],
  // ── Owner correction, 2026-08-05: he read a 157,000-character indictment of a named
  // company and could not tell, while reading it, what a single source was. Every source was
  // real and every one of them was filed at the foot of the page. Prose citation is filing;
  // the card beside the sentence is evidence. The same read found the argument softened into
  // a complaint about the category when the evidence indicted one vendor by name. ──────────
  [
    "sources",
    "Source cards beside the claim",
    "Every material claim ALWAYS carries an inline source card on its own line after the paragraph that makes it. A ledger entry at the foot NEVER sources a sentence.",
  ],
  [
    "evidence",
    "Prove it in their own words",
    "IF you charge a named party THEN place their own quoted text beside their competitors' on the same question. ALWAYS fetch the primary file. NEVER soften the charge into one about the industry.",
  ],
  [
    "evidence",
    "State what is not claimed",
    "IF you indict one product THEN state that you do not indict the category, the competitors or its other uses.",
  ],
  [
    "evidence",
    "Name the defect class",
    "IF the defect is in a prompt, setting or document THEN the remedy is an edit. IF it is in weights, training data, schema or specification THEN the remedy is withdrawal and replacement, with its cost and who performs it.",
  ],
  [
    "harm",
    "Carry the harm to a body",
    "ALWAYS name which step is skipped, in which room, by whom, and what happens to the person at the end. NEVER stop at design flaw. NEVER gesture at critical systems.",
  ],
  // ── Owner corrections, 7 August 2026. During a single session the writer invented a length
  // criterion the law does not contain, framed the BPC-157 page around a spinal disc, placed new
  // rules in source files no agent reads, reported a blocker after one attempt, and narrated its own
  // corrections in place of doing the work. The owner directed that a rule is only a rule when it is
  // enforced, and specified binding operator form at minimum length. ─────────────────────────────
  [
    "invariant",
    "Only the rules confer validity",
    "ONLY these rules make a decision valid. NEVER a model's training, a vendor, a convention, a validator's output, or the writer's own judgment. IF the rules are silent THEN propose a clause and stop; NEVER act on the silence.",
  ],
  [
    "invariant",
    "Never invent a criterion",
    "NEVER apply a standard the rules do not contain. IF a standard is needed THEN state the proposed clause, state what it would decide, and stop. An invented criterion is a violation whether or not it is sensible, applied, or disclosed afterwards.",
  ],
  [
    "invariant",
    "An owner correction becomes a clause in the same turn, naming what it repeals",
    "ALWAYS write an owner correction into the law in the same turn, and ALWAYS name in that same edit which existing clause it repeals or amends, or state that it collides with none. A clause added without that line is how the law reached 117 clauses with live contradictions inside it: every correction added and nothing was ever repealed, so each fix left in force the clause it was fixing.",],
  [
    "invariant",
    "Cause only from the record",
    "ONLY the revision, provenance, commit or execution record establishes how something came to be. NEVER infer it from similar text, shape or cadence. IF the record is silent THEN state 'cause not established from the current record' and repair the artifact. NEVER amend a law, gate or schema from an inferred cause.",
  ],
  [
    "invariant",
    "A validator's output is never the work order",
    "A gate returns defects, NEVER an assignment. ALWAYS do the work that was named. NEVER substitute the validator's list for it.",
  ],
  [
    "invariant",
    "Rules live only in the law",
    "Rules live ONLY in a law object served on the site. NEVER in other code, comments, skills or reports. Code ONLY enforces, and ALWAYS names the clause it enforces.",
  ],
  [
    "conformance",
    "A clause with no enforcement is a suggestion",
    "Every clause ALWAYS declares the check that binds it and where that check runs, or the written reason no machine can decide it. IF neither THEN it is a suggestion and the deploy fails. The count of undeclared clauses ONLY falls.",
  ],
  [
    "conformance",
    "Merge clauses that share one check",
    "IF two clauses are enforced by the same check THEN merge them into the shortest wording that still says everything. ONLY IF every check covering either still covers the merged clause. NEVER trade an enforcement for fewer words.",
  ],
  [
    "conformance",
    "Clauses are written as binding operators",
    "ALWAYS write a clause with ALWAYS, NEVER, ONLY IF, or IF/THEN, at minimum length. NEVER as description, rationale or preference. Write the fewest clauses that keep every enforcement.",
  ],
  [
    "invariant",
    "Never report a blocker you have not attempted",
    "NEVER name something blocked, impossible or needing the owner until the fix has been attempted from the current state and failed. IF a call fails THEN retry from the current state before reporting it. NEVER manufacture a dependency on the owner.",
  ],
  [
    "register",
    "Professional prose only",
    "ALWAYS write in professional prose in every artifact: law, source, comment, commit message and report. NEVER reproduce the owner's words verbatim; ALWAYS paraphrase the requirement. NEVER use capitals for emphasis, profanity, or a quotation that records how something was said.",
  ],
  [
    "invariant",
    "Never invent a problem",
    "NEVER raise a blocker, a dependency, a risk or a complication that the record does not establish. ALWAYS attempt the fix first. IF the attempt succeeds THEN there was no problem to report. NEVER manufacture complexity in place of the work.",
  ],
  [
    "invariant",
    "Report only what changes the owner's next action",
    "Owner-facing output carries ONLY what changes what he does next. NEVER process narration, NEVER corrections of your own earlier statements, NEVER acknowledgement, NEVER an account of what you understood. IF a sentence does not change his next action THEN cut it.",
  ],
  [
    "canonical_resource",
    "State the benefit in the first five sentences",
    "ALWAYS state within the first five sentences what the substance IS in plain words and what it DOES for a person, in which tissue, with its tier in the same sentence. NEVER open with an inventory of studies, and NEVER put a trial count, a study count or a review count before the first sentence that states an effect. The evidence state — how many human trials, how many people, what the animal record covers, what has never been measured — is REQUIRED, and it goes immediately after that first effect sentence, never before it and never below the fold.",
  ],
  [
    "evidence",
    "The permitted form of a benefit",
    "ALWAYS write the effect, the species, the dose and the count together: \"grew new blood vessels into cut tendon in rats at 10 µg/kg, in 11 of 19 studies\". NEVER a bare study description, NEVER a hedge, NEVER a human-outcome verb.",
  ],
  [
    "medical",
    "Answer the choice the reader is making",
    "ALWAYS put the substance against what is prescribed for the same problem, with both sets of numbers, and ALWAYS state what standard care does to the repair the reader came for in the same breath as what it does to the symptom. NEVER state a prescribed drug's benefit without, in the same place and at the same length, what it does to the tissue and what it costs over a year. IF the comparison favours standard care THEN say so. NEVER describe a substance in isolation from the decision in front of the reader.",
  ],
  [
    "evidence",
    "Lead with what the evidence supports doing",
    "This clause orders the TIERS and NEVER the page. Give the tiers in descending order — people, animals, mechanism, reports — and ONLY lead with an absence when the absence decides the action. The descending order ranks evidence, it NEVER ranks importance: an empty tier is reported as empty and yields the page's answer to the tier below it that is not. The instruction that stood here — lead with what the evidence supports doing — was REPEALED 2026-08-08 as an instruction about the page. It put the verdict in the opening, where a reader with no context cannot evaluate it, and it collided with W22, which forbids a conclusion whose steps are absent. W22 is band 3, reader comprehension; this clause is band 4, structure. Band 3 wins. The verdict goes after the steps that earn it, never before them."
  ],
  [
    "invariant",
    "A request is executed literally",
    "ALWAYS execute the request as worded. A transcript means the transcript, NEVER a summary of it. A list means the list, NEVER a description of it. IF the literal thing cannot be produced THEN say which word cannot be honoured and why.",
  ],
  [
    "invariant",
    "A deliverable lands in Downloads and opens",
    "IF the owner asks for a file, an export, a handoff, a transcript or any artifact THEN write it to ~/Downloads and open it on his screen in the same turn. NEVER hand him a path, a link or a description in place of the opened file.",
  ],
  [
    "commitment",
    "Label the extrapolation",
    "IF an argument runs past what was measured THEN say so in that sentence and name the one measurement that would settle it.",
  ],
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // The four clauses below were written on 2026-08-08 from a single paragraph the owner read on
  // /a/bpc-157-vs-nsaids. Every clause above was live when that paragraph was written, and it still
  // came out inverted in both directions at once:
  //
  //   "BPC-157 has never completed a randomised controlled trial in a human being for any injury.
  //    Not for tendon, not for muscle, not for a disc, not for a joint."
  //
  // The peptide was characterised by a trial nobody ran — a claim it never made — while the drug
  // beside it was characterised by its best measured result, with the thing that actually matters
  // about the drug demoted to a cost line. The owner: "EVERYTHING THAT YOU SAY THEY NEVER CLAIM IS
  // CLAIMED ANECDOTALLY BY AN OCEAN OF PEOPLE. EVERYTHING THAT IS PROVEN HARMFUL ABOUT NSAIDS YOU
  // CONCEAL AND MAKE WHAT IS NOT TRUE ABOUT IT CENTRAL."
  //
  // He is right that the rules produced it. W114 ordered the tiers by strength, and an empty top
  // tier read as "nothing is known" rather than yielding the answer to the counted record below it.
  // W113 asked for standard care's numbers without saying that its effect on the repair must sit
  // beside its effect on the symptom, so the year-cost got written and the mechanism did not. Both
  // are amended above. These four close what neither of them reached.
  [
    "evidence",
    "Never characterise a thing by what it has not claimed",
    "ALWAYS characterise a substance by the effect it has and the tier that effect sits at. NEVER open a page, a section or a comparison on a trial that was not run, an approval not held, or a claim the substance never made. An absence is one line placed beside the claim it bears on, and NEVER the frame.",
  ],
  [
    "evidence",
    "One evidentiary standard across a comparison",
    "ALWAYS judge the substance and what is prescribed instead by the same test. IF the page states what the substance has not proven THEN it states what standard care has not proven, in the same words and at the same length. NEVER grade one side on its best measured result and the other on its missing trial.",
  ],
  [
    "medical",
    "Relief is never reported as repair",
    "NEVER report a drug's effect on a symptom as an effect on the tissue. IF a drug relieves pain and impairs the repair the reader came for THEN state both in the same breath, with both numbers, and NEVER the relief alone. IF suppressing a process is how the drug works and that process is the repair signal THEN say so wherever the drug's benefit is stated.",
  ],
  [
    "evidence",
    "A counted record is evidence about the exposure people run",
    "IF no controlled trial has been run at the dose and duration people actually take THEN the counted first-person record is the only evidence that exists about that exposure, and it belongs in the page's answer with its denominator, its harms and its filters. NEVER write that there is no evidence when a counted record exists. NEVER let the descending tier order push that record out of the answer.",
  ],
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Owner, 2026-08-08, an hour after the four clauses above, on a paragraph that had already been
  // rewritten under them: "YOU ARE BENDING BACKWARDS… THIS ISNT EVEN ABOUT THOSE SPECIFIC PEPTIDES
  // ITS ABOUT YOUR NEGLECT OF BOTH THE SCIENTIFIC AND ANECDOTAL EVIDENCE PLEASE FIX THE LOGIC OF
  // YOUR RULES SO THAT YOU UNDERSTAND THIS ACROSS ALLLLLLLL PEPTIDES."
  //
  // Three distinct defects, none of them about peptides:
  //
  // 1. THE ONE-SIDED RESCUE. The sentence read "the drug measurably worsens tendon healing when
  //    given early, though this effect disappears if you give it later". The window was offered to
  //    the drug as an escape and never offered to the peptide — and it was not even true: NSAIDs
  //    lower maximum pull-out strength at the bone-tendon junction when given at days 6-14 and at
  //    days 11-20 as well. A qualifier had been invented to soften a harm.
  //
  // 2. THE STOPPED CHAIN. "Weight-loss peptides cause weight loss" is where every page stopped.
  //    The owner: they cause the load a body carries to fall, which is why retatrutide's TRIUMPH-4
  //    measured knee pain falling 4.5 WOMAC points against 2.4 on placebo in 445 people over 68
  //    weeks — which reaches anyone whose problem is mechanical load, including a bad back. The
  //    primary endpoint was being reported as though it were the whole effect.
  //
  // 3. THE SPEED SUBSTITUTED FOR THE RESULT. "Healing is slower" was written where the measurement
  //    was that the repaired tissue comes back mechanically weaker, and "does not heal" was written
  //    about a steroid injection whose actual role is to defer a surgical decision.
  [
    "evidence",
    "Follow the effect to the reader's problem",
    "ALWAYS carry a measured effect down the chain to the problem the reader has, one link at a time, with the tier at each link, and stop only at a link nobody has measured, saying so there. NEVER report a primary endpoint as though it were the whole effect. IF a substance changes the load a tissue carries, what a tissue is made of, or what reaches it, THEN state what that does to every condition whose mechanism is that load, that material or that supply.",
  ],
  [
    "medical",
    "Report the repaired tissue, not only the speed",
    "ALWAYS report what the healed tissue is like — its strength, its structure, its failure rate — and NEVER let a statement about speed stand where a structural measurement exists. IF an intervention only defers a decision THEN say that is what it does, and NEVER report deferral as treatment.",
  ],
  [
    "evidence",
    "A qualifier that rescues one side is applied to both",
    "NEVER narrow a harm with a timing window, a dose or a subgroup unless the same narrowing is applied to the benefit the same mechanism produces. IF the harm and the benefit come from one mechanism THEN they carry one set of conditions. IF the reader's own situation sits inside the window where the harm applies THEN say so plainly, and NEVER report the window as an escape.",
  ],
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // Owner, 2026-08-08, unable to get past the first paragraph of the rewritten
  // /a/bpc-157-vs-nsaids, which had passed every gate in this file:
  //
  //   "People weigh these two against each other because they reach for both after the same thing:
  //    a tendon, a muscle or a joint that got hurt and still hurts."
  //   -> "No, they fucking don't. Literally, no, they don't… whenever you stub your toe, you go for
  //       a fucking BPC injection. You stupid motherfucker."
  //
  //   "Here is the trade, one line each."
  //   -> "then you're narrating about the article… one of the rules on the site is absolute truth,
  //       and for every sentence to earn its place."
  //
  // Two defects, both already covered in spirit and neither binding. The first is that a claim about
  // PEOPLE — what they do, why they do it, when they do it — was written to no standard at all,
  // while every claim about a molecule on the same page carried a species, a dose and a count. It
  // was invented to justify the page existing, and it is false: nobody injects a peptide for a
  // stubbed toe. The site holds a counted record of 37 first-person accounts. That record was the
  // available evidence about what people actually do with this compound, and it was ignored in
  // favour of a sentence made up on the spot.
  //
  // The second is that W51 bans a sentence whose subject is "this page", and the sentence that
  // shipped was "Here is the trade, one line each" — the same defect wearing different words. A
  // sentence announcing the shape of the next block carries no fact and fails the existence test,
  // W05, which was also live.
  //
  // Amends: W74 (truth over helpfulness) gains the people half. W51 (no framing language) gains the
  // announce shapes. Repeals nothing.
  [
    "evidence",
    "A claim about people is a claim",
    "A statement about what people do, why they do it, how many of them, or what they reach for ALWAYS carries a count and its source, exactly as a claim about a molecule carries species, dose and count. NEVER write people do, most people, many people, people turn to, or anyone who, as a bridge, a motivation or a premise. IF the counted first-person record on the page answers it THEN cite that record and its denominator. IF nothing counts it THEN the sentence does not exist.",
  ],
  [
    "compression",
    "No sentence announces the next block",
    "NEVER write a sentence whose only job is to announce what follows: here is the trade, what follows is, below are, two things follow, here is the evidence state, let us start with. The block that follows is the announcement. A sentence that carries no fact, no number, no name, no claim and no position is cut under the existence test, and an announcement carries none of the five.",
  ],
].map(([family, title, law], index) => ({
  id: `W${String(index + 1).padStart(2, "0")}`,
  family,
  title,
  law,
}));

export const WRITING_LAW_OBJECT = createKnowledgeActionObject({
  editorial_profile: EDITORIAL_PROFILE,
  identity: {
    id: "kao:writing-law",
    slug: "writing-law",
    key: "WRITING_LAW",
    title: "The Laws of Writing",
    class: "law",
  },
  content: {
    summary:
      "The complete obligational writing law: opaque, decorative, ambiguous language is hostility toward the reader, and every sentence must carry meaning or be cut.",
    thesis:
      "Writing is the transfer of order from one mind to another. Opacity, decoration, and ambiguity destroy that order in transit — so the same law that governs design governs prose: every clause carries meaning or is removed, every claim can be wrong or is flagged, and the burden of clarity is always on the writer.",
    clauses: WRITING_CLAUSES,
  },
  instructions: {
    trigger:
      "Use for any writing, rewriting, editing, replying, header, summary, argument, concession, or challenge on any surface of this site or in any exchange it hosts.",
    // The law grew past what one model can hold at once, and clauses for one surface were
    // being applied to another — social hashtag rules landing in articles, article structure
    // rules landing on posts. Load the families your surface names and ignore the rest;
    // ALWAYS families bind everywhere. This is the routing, not a summary of the clauses.
    surface_scope: {
      ALWAYS: ["hostility", "compression", "commitment", "concrete", "register", "invariant", "conformance"],
      article: ["canonical_resource", "evidence", "sources", "plain_language", "rhythm", "surface", "harm"],
      "article:substance_or_condition": ["canonical_resource", "evidence", "sources", "plain_language", "medical", "rhythm", "surface", "harm"],
      "article:contested_or_current_events": ["canonical_resource", "evidence", "sources", "plain_language", "conflict", "rhythm", "surface", "harm"],
      social: ["social", "surface"],
      email: ["surface"],
      prompt_or_skill: ["governance", "conformance"],
    },
    surface_scope_note:
      "A clause outside your surface's families does not apply to you. A model writing a peptide page loads ALWAYS plus article:substance_or_condition and never reads the hashtag or hero-image clauses; a model writing a post loads ALWAYS plus social and never reads the article-structure clauses. Where a clause is genuinely needed on two surfaces it names both in its own text — that naming, not this map, is the authority.",
    decision_mandate: [
      "Does the sentence carry a fact, claim, number, name, or position?",
      "Could a reader repeat the point after one read?",
      "Could the claim be wrong, and does it say what would break it?",
      "Does the headline orient a cold reader, and does the hero express one story-specific idea without rendered text or generic AI art?",
      "If any answer is no, cut or rewrite it.",
    ],
    procedure: [
      "State the point in the first sentence, in plain words.",
      "Cut every clause that fails the existence test.",
      "Attach one concrete case to each abstract claim.",
      "Sharpen each claim until it can be wrong, or flag it as an axiom or a bet.",
      "Collapse multi-branch scaffolding to one question with one case.",
      "Delete certainty theater, recaps, and hedging armor.",
      "Vary the rhythm; make each heading a finding.",
      "Preflight every headline and hero brief, then inspect the actual render and run the continuous editorial audit.",
      "Read it aloud; end where the substance ends.",
    ],
    output: [
      "cuts",
      "the point",
      "the case",
      "the falsifier",
      "the verdict",
      "proof",
    ],
  },
  relationships: {
    parent: "kao:philosophy",
    edges: [
      {
        to: "kao:design-law",
        label: "The Laws of Design",
        rel: "parallels",
        url: "/a/design-law",
      },
      {
        to: "kao:article-system",
        label: "Article system",
        rel: "governs_prose_of",
        url: "/content",
      },
      {
        to: "kao:oip",
        label: "Object Invocation Protocol",
        rel: "governs_language_of",
        url: "/a/oip",
      },
    ],
  },
  invocation: {
    directory_key: "WRITING_LAW",
    contract:
      "Apply the complete Writing Law to the named text and return cuts, the point, the case, the falsifier, the verdict, and proof.",
    args: { text: "string or URL", task: "audit|write|rewrite|validate" },
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
      "every clause survives the existence test",
    ],
    failure_modes: [
      "wall of text hiding one question",
      "qualifier-armor and hedging",
      "decorative certainty",
      "restating summary",
      "filing-label headers",
      "jargon in place of plain words",
      "reader-facing prose emitted by code — template literals, string concatenation or a filled skeleton — instead of written by a writer holding this law",
      "balance without a verdict",
      "headline that needs context or carries the whole article outline",
      "rendered table, dashboard, terminal, UI collage, or generic AI hero",
      "hero changed without a recorded inspection of the actual asset",
    ],
    tests: [
      "facet completeness",
      "representation route integrity",
      "skill synchronization",
      "existence test per clause",
      "read-aloud audit",
      "falsifiability audit",
      "headline and hero proposal preflight",
      "continuous corpus editorial audit",
      "AI-native card-catalog/server positive case and overloaded-title negative case",
    ],
    repair:
      "Cut the violating clause or rewrite it in plainer words with a concrete case, regenerate every representation, and rerun conformance.",
  },
  version: {
    current: "1.6.0",
    amended_at: "2026-08-01T00:00:00-07:00",
    amendments: [
      {
        version: "1.6.0",
        change:
          "Replaced the contradictory dark-UI/table rule after it caused 44 story heroes to be overwritten with dashboards, terminals, rendered text and generic interface art. Titles now pass a cold-reader brevity test; heroes show the article's literal subject rather than an analogy; proposed assets pass preflight before generation; changed assets require inspection of the actual render; and the existing corpus is continuously audited with a concrete replacement or precise review issue. Recorded positive cases: the chest scan itself for missed radiology follow-up, the repository and evidence involved in the OpenAI–Hugging Face incident, and physical source records connected to the server infrastructure that makes content model-readable. Recorded negative title case: the overloaded AI-native definition/rubric/proper-noun/scoring headline.",
      },
      {
        version: "1.5.0",
        change:
          "Four clauses added to the canonical_resource family after the owner read an article and said he could not tell what it was about — his own idea, written back to him unrecognisably. Three specific defects, now each a clause. The title was an aphorism ('Everyone ships the answer. Nobody ships the denominator.') that names neither subject nor deliverable and is illegible in a search result. The opening argued before it defined, so a reader who had not been in the originating conversation never learned what the system was. And the model wrote from its memory of the law instead of fetching the clauses, which is why the page satisfied a remembered style and failed the live text. The law now requires the fetch as a step, requires the definition before the argument, requires a subject-and-deliverable title, and makes the zero-context read a publish gate with four questions a stranger must be able to answer after one pass.",
      },
      {
        version: "1.4.0",
        change:
          "Four clauses added to the social family after the owner read the posts the previous rules produced and called them categorically horrible. The rules were being satisfied and the posts were still spam, because every one of them was an announcement with a link as its payload: the hook was a headline, the beat was a fact about the build, and the reader who did not click received nothing. The law now says the post is the value and the link is a footnote — delete the link and something usable must remain; publication is never an event, so a page, endpoint, repo or feature existing is not a subject; the register is one competent person telling another something interesting at speed, not a headline and not a thread-bro cadence; and a tag is earned by saying the specific thing that product did, because a tag with nothing said about the tagged is itself the spam signal.",
      },
      {
        version: "1.3.0",
        change:
          "Added the social family (W19-W23 in that family) by owner order after a run of posts that failed on reach and on framing: they assumed the reader already knew what the build was, several carried no account tag and no hashtag, and some read as announcements of the model's own work. The owner's position, recorded as the standard: with no following, tags and hashtags are the only distribution, so both are obligatory on every post, tagged accounts should be the largest genuinely-in-story accounts available, and every post must be legible to a stranger with zero context. A six-boolean grading checklist is now part of the law so posts can be scored after the fact rather than argued about.",
      },
      {
        version: "1.2.0",
        change:
          "Added the canonical_resource, sources, harm and governance families after two failures on the same day. First: an article about routing a coding CLI through a third-party gateway shipped as a blog — it opened by describing itself, narrated the model's own process, omitted every prerequisite a stranger needs, carried no anecdotal sources, and spun off no context articles. The owner's verdict: 'you have written a blog.' Second, and worse: the model wrote the correcting law into .claude/skills/writing-law/SKILL.md, which is a generated projection, and left this object — the auditable one, the one that renders at /a/writing-law — untouched. The reason it did that is recorded because it is the failure mode: the model reads its own instructions from the skill path, so it treated that path as the home of the law, and wrote a private rule the owner could not see and no third party could audit. The law now states that the object is the law and the skill file is a projection, and that amending the projection alone is void.",
      },
      {
        version: "1.1.0",
        change:
          "Added the surface family (W17, W18) after models published prose to X that was clean as sentences and wrong as posts: machine-log headers in the hook position, paragraph blobs, third-party model self-promotion, unsigned posts. The law now states that prose is only finished in the surface that renders it, and that tagging, hashing, and signing are writing decisions rather than decoration. Enforced mechanically: X_POST refuses machine-log headers, missing signatures, paragraph blobs, and generic hashtags (functions/_lib/fn_runners.js xFormatViolation).",
      },
      {
        version: "1.0.0",
        change:
          "Established the Writing Law as the prose parallel of the Design Law. Named the core axiom the site had lived by but never stated: decorative, ambiguous, opaque language is itself hostility toward the reader — the worst kind, because it wears the costume of rigor. Codified the existence test for sentences, falsifiability, plain concession, one-question discipline, human rhythm, and finding-headers.",
      },
    ],
  },
  provenance: {
    canonical_source: "functions/_lib/writing_law_object.js",
    schema_source: "functions/_lib/knowledge_action_object.js",
    skill_projection: ".claude/skills/writing-law/SKILL.md",
    ledger: "/api/ledger?object=WRITING_LAW",
    amendment_lineage: "/api/articles/writing-law/versions",
  },
});

export function writingLawMarkdown() {
  const object = WRITING_LAW_OBJECT;
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

export function writingLawSkillMarkdown() {
  const object = WRITING_LAW_OBJECT;
  return `---\nname: writing-law\ndescription: Apply the miscsubjects Laws of Writing when writing, rewriting, editing, replying, arguing, conceding, or validating any prose — articles, headers, summaries, replies, challenges, or owner-facing text.\n---\n\n# Apply the Laws of Writing\n\nThis Skill is the model-operating expression of [the human article](/a/writing-law). Read the canonical object at /api/articles/writing-law when exact clauses or provenance are needed; do not reproduce its article prose by default.\n\n## The axiom\n\nOpaque, decorative, ambiguous language is hostility toward the reader — the worst kind, because it wears the costume of rigor. The writer holds the thought in ordered form; delivering it disordered forces every reader to reconstruct it. That loss is charged to the writer.\n\n## Decide\n\n${object.instructions.decision_mandate.map((line) => `- ${line}`).join("\n")}\n\n## Operate\n\n${object.instructions.procedure.map((line, index) => `${index + 1}. ${line}`).join("\n")}\n\n## Reject as nonconforming\n\n${object.conformance.failure_modes.map((failure) => `- ${failure}`).join("\n")}\n\n## Pair with\n\nThe write-human skill (anti-slop mechanics: tell catalog, rhythm, read-aloud test) and the design-law skill (the visual parallel). This law is the axiom; those are the drills.\n\n## Return\n\nReturn only: ${object.instructions.output.join(", ")}. Cite the object identity ${object.identity.id}, its version, and the proof routes used.\n`;
}

export function writingLawConformance() {
  return knowledgeActionConformance(WRITING_LAW_OBJECT);
}

export function writingLawVoxels() {
  return knowledgeActionVoxels(WRITING_LAW_OBJECT);
}

export function writingLawVersions() {
  return knowledgeActionVersions(WRITING_LAW_OBJECT);
}
