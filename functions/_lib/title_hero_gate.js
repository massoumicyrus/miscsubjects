// Canonical write-path preflight and continuous editorial audit for article titles and
// hero images. The laws live in writing_law_object.js and design_law_object.js; this
// module turns their testable clauses into actionable publish-time checks.

const CONTEXT_DEPENDENT_TITLE = [
  /^what (taking|this|a|the|it)\b/i,
  /^why (this|it|we|i)\b/i,
  /^if you are\b/i,
  /^how (i|we)\b/i,
  /\bwould (actually )?mean\b/i,
  /\bwhat (this|it) means\b/i,
  /\bmy (journey|thoughts|take)\b/i,
];

const DECORATIVE_TITLE = /\b(revolutionary|game[- ]changing|category[- ]defining|frontier|substrate|ecosystem|paradigm|cutting[- ]edge|groundbreaking|unprecedented|remarkable|fascinating|profound|elegant|beautiful|powerful|robust|seamless|unlock|empower|transformative)\b/i;
const OVERLOADED_TITLE_LENGTH = 115;


// 1. THE EVIDENCE STATE. What kind of evidence exists is a property of the evidence, reported in
//    the body under its own tier. It is not a description of the compound and never the headline.
const EVIDENCE_STATE_IN_TITLE = [
  [/\b(mouse|mice|rat|rats|rodents?|murine|canine|porcine|zebrafish)\b/i, 'the animal the studies were run in'],
  [/\b(in vitro|in vivo|cell culture|petri dish|test tube)\b/i, 'the laboratory setting of the studies'],
  [/\b(no|zero)\s+(human|clinical)\s+(data|trials?|studies|evidence)\b/i, 'the absence of human data'],
  [/\bnever\s+(been\s+)?(tested|studied|trialled|trialed)\b/i, 'the absence of testing'],
  [/\b(every|all|the only)\s+(result|study|trial|finding)s?\s+(is|are|was|were)\b/i, 'a summary of the evidence base'],
  [/\b\d+\s+(human\s+)?(trials?|studies|papers?|rcts?|randomi[sz]ed)\b/i, 'a count of the studies'],
  [/\b(animal|preclinical|anecdotal|observational)\s+(data|evidence|only)\b/i, 'the evidence tier'],
];

// 2. A WITHHELD REVEAL. A headline that promises something it refuses to state is a clickbait
//    construction. Everything the reader needs is in the headline or the headline is rewritten.
// The line is between a trailing clause that NAMES what the page covers and one that PROMISES an
// unstated fact. "…and what the randomised evidence supports" tells the reader what they will get.
// "…and what happens when the injections stop" makes them click to find out. Only the second is
// banned; an earlier version of this rule caught both and would have refused correct headlines.
const WITHHELD_REVEAL_IN_TITLE = [
  [/\bwhat happens (when|if|next|after)\b/i, 'a "what happens when…" tease'],
  [/\b(and )?(why|how) (that|this|it) matters\b/i, 'a "why that matters" tease'],
  [/\bmeans something\b/i, 'a "means something" tease that names nothing'],
  [/\b(nobody|no one|almost nobody|few people|most people don'?t)\s+(mentions?|talks? about|knows?|tells? you|takes?|realis|realiz)/i, 'a "nobody tells you" tease'],
  [/\byou won'?t believe\b|\bwait (until|till)\b|\bhere'?s (what|why|the)\b/i, 'a tabloid reveal construction'],
  [/\banyway\s*$/i, 'a dangling "anyway"'],
  [/\bthe (one|real|hidden|surprising|shocking|dirty|uncomfortable) (truth|reason|thing|secret|catch)\b/i, 'a withheld-secret construction'],
  [/\bturns out\b/i, 'a "turns out" reveal'],
];

// 3. A STATISTIC AS THE HOOK. A number is a finding, reported where its denominator and method sit.
//    A headline built on one asks the reader to react before they can weigh it.
const STATISTIC_AS_HOOK = /^[^:]{0,60}:\s*\d+(\.\d+)?%/i;

export function checkHeadlineSubject(title) {
  const text = String(title || '').trim();
  if (!text) return null;
  for (const [pattern, what] of EVIDENCE_STATE_IN_TITLE) {
    const m = text.match(pattern);
    if (m) {
      return `headline carries ${what} ("${m[0]}"). The subject of the page is the subject; what kind `
        + 'of evidence exists for it is reported in the body under its own tier, never in the headline. '
        + 'Name the thing and say what it is.';
    }
  }
  for (const [pattern, what] of WITHHELD_REVEAL_IN_TITLE) {
    const m = text.match(pattern);
    if (m) {
      return `headline uses ${what} ("${m[0].trim()}"). A headline states its point; it never promises `
        + 'one. Name the thing and say what it is.';
    }
  }
  if (STATISTIC_AS_HOOK.test(text)) {
    return 'headline leads with a statistic as its hook. A number belongs where its denominator and '
      + 'method sit. Name the thing and say what it is.';
  }
  return null;
}

export function checkTitle(title) {
  const text = String(title || '').trim();
  if (!text) return 'headline is empty; name the article subject and what happened';
  if (text.length < 18) return `headline is too short to orient a cold reader; name the subject and event: "${text}"`;
  for (const pattern of CONTEXT_DEPENDENT_TITLE) {
    if (pattern.test(text)) {
      return `headline depends on surrounding context instead of naming its subject: "${text}"`;
    }
  }
  const decorative = text.match(DECORATIVE_TITLE);
  if (decorative) {
    return `headline uses decorative wording "${decorative[0]}"; replace it with the concrete subject or event`;
  }
  const subjectProblem = checkHeadlineSubject(text);
  if (subjectProblem) return subjectProblem;
  if (text.length > OVERLOADED_TITLE_LENGTH) {
    return `headline is overloaded at ${text.length} characters; shorten it to the core subject or event a cold reader needs`;
  }
  return null;
}

const NEG_ITEM = String.raw`(?:any\s+)?(?:readable\s+)?[A-Za-z-]+(?:\s+[A-Za-z-]+){0,3}`;
const NEGATION_CUE = new RegExp(String.raw`\b(?:no|without|avoid|avoiding|never|excluding|omitting|omit|free of|absent)\s+` + NEG_ITEM, 'gi');
const NEGATION_IMPERATIVE = new RegExp(String.raw`\b(?:do not|don't|must not|should not)\s+(?:show|include|render|use|depict|feature)\s+` + NEG_ITEM, 'gi');

function positivePromptText(brief) {
  return String(brief || '')
    .replace(NEGATION_IMPERATIVE, ' ')
    .replace(NEGATION_CUE, ' ');
}

const RENDERED_INTERFACE = /\b(dashboard|data table|spreadsheet|rows? and columns?|terminal window|command line|code editor|browser ui|app ui|ui collage|scorecard|infographic|flowchart|json panel|monospace layout|rendered article text|wall of text)\b/i;
const GENERIC_AI = /\b(generic (?:ai|artificial intelligence)|glowing (?:robot|brain)|robot brain|circuit brain|neural[- ]network nodes?|humanoid robot|digital brain|abstract ai|ai face|blue technology background)\b/i;

const LAB_ANIMAL_SUBJECT = /\b(mouse|mice|rat|rats|rodents?|cage|vivarium|lab animal|laboratory animal|guinea pig|zebrafish|petri dish|test tube rack|pipette)\b/i;

const INTERCHANGEABLE_COMPOUND_PROP = /\b(vials?|ampoules?|syringes? on a (?:tray|table)|silver tray|loading dock|warehouse shelf|pallet|shipping crate|pill bottles?|blister pack|stock photo)\b/i;

const OVERAPPLIED_MOTIF = /\b(gold robot|golden robot|red wax seal|wax seal|red string|red thread)\b/i;

export function checkHeroSubjectFit(brief, opts = {}) {
  const text = positivePromptText(String(brief || ''));
  const animal = text.match(LAB_ANIMAL_SUBJECT);
  if (animal) {
    return `hero proposes the research method as its subject ("${animal[0]}"). The animal a study ran `
      + 'in is a fact about the study, not what the compound is. Show the subject of the article.';
  }
  const prop = text.match(INTERCHANGEABLE_COMPOUND_PROP);
  if (prop) {
    return `hero proposes an interchangeable prop ("${prop[0]}") that would illustrate any compound `
      + 'equally and therefore identifies none. Show what is specific to THIS subject.';
  }
  // The motif ban is lifted only for the one page the motif genuinely belongs to.
  if (!opts.motifOwner) {
    const motif = text.match(OVERAPPLIED_MOTIF);
    if (motif) {
      return `hero reuses the house motif "${motif[0]}". A reference image sets the level of craft, `
        + 'not the props. Reusing its objects turns one good image into a template and the site into '
        + 'a mascot. Choose imagery this article earns on its own.';
    }
  }
  return null;
}

export function checkHeroBrief(brief) {
  const text = String(brief || '').trim();
  if (!text) return 'hero brief is empty; name the literal story subject and the one visible action or composition';
  const positive = positivePromptText(text);
  const rendered = positive.match(RENDERED_INTERFACE);
  if (rendered) {
    return `hero proposes a rendered table, dashboard, UI, or text surface ("${rendered[0]}"); use a tangible story-specific editorial scene instead`;
  }
  const generic = positive.match(GENERIC_AI);
  if (generic) {
    return `hero proposes generic AI art ("${generic[0]}"); anchor the image in a physical object or visual action unique to this story`;
  }
  const fit = checkHeroSubjectFit(text);
  if (fit) return fit;
  if (text.length < 45) {
    return 'hero brief is too vague; specify the tangible story anchor, the single visual action, and the editorial treatment';
  }
  return null;
}

const REVIEW_FIELDS = ['headline_subject', 'hero_subject', 'visual_action', 'rationale'];

function issue(code, message, extra = {}) {
  return { code, message, ...extra };
}

export function editorialPreflight(input = {}) {
  const stage = input.stage === 'publish' ? 'publish' : 'proposal';
  const title = String(input.title || '').trim();
  const heroBrief = String(input.hero_brief || '').trim();
  const editorialReview = input.editorial_review && typeof input.editorial_review === 'object'
    ? { ...input.editorial_review }
    : {};
  const issues = [];

  const titleProblem = checkTitle(title);
  if (titleProblem) issues.push(issue('headline_preflight', titleProblem, { review: 'Rewrite the headline as a short, literal answer to: what is this about or what happened?' }));

  const heroProblem = checkHeroBrief(heroBrief);
  if (heroProblem) issues.push(issue('hero_preflight', heroProblem, { review: 'Replace the concept before generation; do not render or inspect a known-bad brief.' }));

  for (const field of REVIEW_FIELDS) {
    if (!String(editorialReview[field] || '').trim()) {
      issues.push(issue(`editorial_${field}_missing`, `editorial review is missing ${field}`, { review: `Record ${field.replaceAll('_', ' ')} before image generation.` }));
    }
  }

  if (stage === 'publish') {
    if (editorialReview.inspected !== true) {
      issues.push(issue('hero_not_inspected', 'the generated hero has not been visually inspected against the approved brief', { review: 'Open the actual image, confirm one coherent story-specific idea, then set inspected=true.' }));
    }
    if (!String(editorialReview.inspection_note || '').trim()) {
      issues.push(issue('hero_inspection_note_missing', 'the visual inspection has no recorded finding', { review: 'Record what is visibly present and why it belongs to this story.' }));
    }
  }

  return {
    ok: issues.length === 0,
    stage,
    issues,
    input: { title, hero_brief: heroBrief, editorial_review: editorialReview },
  };
}

const FILING_LABEL = /^(overview|introduction|background|context|analysis|discussion|conclusion|summary|key takeaways?|what this means|why it matters|the problem|the solution)$/i;

function suggestedHeading(heading) {
  return `Replace “${heading}” with the concrete claim, event, or object introduced in that section.`;
}

export function auditEditorialArticle(article = {}) {
  const issues = [];
  const title = String(article.title || '').trim();
  const titleProblem = checkTitle(title);
  if (titleProblem) {
    const code = CONTEXT_DEPENDENT_TITLE.some((pattern) => pattern.test(title))
      ? 'headline_context'
      : 'headline_quality';
    issues.push(issue(code, titleProblem, { replacement: 'Write a shorter literal headline naming the article subject and its central event or claim.' }));
  }

  const headings = [...String(article.body || '').matchAll(/^#{2,3}\s+(.+)$/gm)].map((match) => match[1].trim());
  for (const heading of headings) {
    if (FILING_LABEL.test(heading)) {
      issues.push(issue('heading_filing_label', `section heading “${heading}” is a filing label that gives a cold reader no claim`, { replacement: suggestedHeading(heading) }));
    }
  }

  if (!String(article.hero || '').trim()) {
    issues.push(issue('hero_missing', 'the article is published with no featured image', {
      replacement: 'Generate a hero that shows this article\'s own subject, inspect it, and record the '
        + 'inspection before this counts as finished. An article with no image is not finished.',
    }));
  }

  const review = article.editorial_review && typeof article.editorial_review === 'object'
    ? article.editorial_review
    : null;
  if (article.hero && !review) {
    issues.push(issue('hero_review_missing', 'the existing hero has no story rationale or recorded visual inspection', { review: 'Inspect the actual image and record its literal subject, visible action or composition, and acceptance or rejection.' }));
  } else if (review) {
    const heroProblem = checkHeroBrief(review.hero_brief || article.hero_brief || '');
    if (heroProblem) issues.push(issue('hero_quality', heroProblem, { replacement: 'Propose one tangible story-specific editorial scene, then inspect the generated image before publication.' }));
    if (review.inspected !== true) {
      issues.push(issue('hero_not_inspected', 'the existing hero is not marked as visually inspected', { review: 'Open the asset and record a concrete inspection finding.' }));
    }
  }

  return { slug: article.slug || '', ok: issues.length === 0, issues };
}

export const HERO_TREATMENT =
  'Show the actual subject of the article in one instantly readable editorial image. Use the literal object, event, evidence, place, or process itself; no analogy, readable text, tables, dashboards, UI collage, generic AI imagery, or interchangeable stock scene.';
