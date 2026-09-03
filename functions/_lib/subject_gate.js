
import { COMPOUNDS } from './one_object_guard.js';
import { openingNamesNoSubject, unglossedJargon } from './plain_words.js';

// Conditions this corpus writes about, longest-first so 'herniated disc' matches before 'disc'.
const CONDITION_TERMS = [
  'degenerative disc disease', 'post-surgical nerve', 'sacroiliac joint', 'carpal tunnel',
  'plantar fasciitis', 'rotator cuff', 'frozen shoulder', 'spinal stenosis', 'facet joint',
  'herniated disc', 'bulging disc', 'disc herniation', 'disc degeneration', 'nerve damage',
  'peripheral neuropathy', 'tendinopathy', 'tendinitis', 'radiculopathy', 'sciatica',
  'neuropathy', 'neuralgia', 'stenosis', 'bursitis', 'whiplash', 'disc', 'discs',
];

// The slug tokens that make a condition a declared subject of the page.
const SLUG_CONDITION_TOKENS = [
  'herniated-disc', 'degenerative-disc-disease', 'degenerative-disc', 'disc-stack', 'disc',
  'sciatica', 'nerve-damage', 'post-surgical-nerve', 'tendon', 'tendinopathy', 'neuropathy',
  'stenosis', 'carpal-tunnel', 'plantar-fasciitis', 'rotator-cuff', 'frozen-shoulder',
  'facet-joint', 'sacroiliac', 'whiplash', 'radiculopathy', 'back-pain', 'neuralgia',
];

// Assigning the reader a body part or a condition. W47's invariant family forbids naming an
// audience; the second-person rule permits 'you' only for a decision the reader will actually
// make, never to tell them what is wrong with them.
// Only a defect when the part belongs to a condition the slug does not name. "your back" on
// /a/herniated-disc is the page addressing the person who has the thing the page is about, which
// W57 requires. "your back" on /a/bpc-157 is a compound page borrowing a condition it has no
// claim on. So each part maps to the condition it implies and takes the same declared-subject test.
const READER_PART_SUBJECT = [
  [/\byour\s+(?:discs?|back|spine|spinal|herniations?)\b/gi, 'disc'],
  [/\byour\s+sciatica\b/gi, 'sciatica'],
  [/\byour\s+tendons?\b/gi, 'tendon'],
  [/\byour\s+nerves?\b/gi, 'nerve damage'],
  [/\byour\s+shoulder\b/gi, 'rotator cuff'],
  [/\byour\s+neck\b/gi, 'whiplash'],
  [/\bif you (?:have|are|suffer|had|get)\b[^.?!]{0,80}\b(?:discs?|back|spine|herniat\w*)\b/gi, 'disc'],
  [/\bif you (?:have|are|suffer|had|get)\b[^.?!]{0,80}\bsciatica\b/gi, 'sciatica'],
  [/\bif you (?:have|are|suffer|had|get)\b[^.?!]{0,80}\btendons?\b/gi, 'tendon'],
];

function slugSubjects(slug) {
  const s = String(slug || '').toLowerCase();
  return SLUG_CONDITION_TOKENS.filter((t) => s.includes(t));
}

function conditionHits(text) {
  const t = String(text || '').toLowerCase();
  const found = [];
  for (const term of CONDITION_TERMS) {
    const re = new RegExp(`\\b${term.replace(/[-\s]/g, '[-\\s]')}\\b`, 'g');
    const n = (t.match(re) || []).length;
    if (n) found.push({ term, n });
  }
  return found;
}

// A condition term is "declared" when the slug already names it, or names something that contains
// it — bpc-157-herniated-disc declares both 'herniated disc' and 'disc'.
function declared(term, subjects) {
  const norm = term.replace(/\s+/g, '-');
  return subjects.some((s) => s === norm || s.includes(norm) || norm.includes(s));
}

/**
 * checkSubjectBoundary(slug, title, body) -> null when the page keeps to its subject, or
 * { code, message, evidence } when a subject the slug does not name is framing the page.
 */
export function checkSubjectBoundary(slug, title, body) {
  const subjects = slugSubjects(slug);
  const text = String(body || '');
  if (!text.trim()) return null;

  const foreign = (s) => conditionHits(s).filter((h) => !declared(h.term, subjects));

  // 1. A HEADING. The strongest signal there is: a heading is the page's own statement of what
  //    this part of it is about. "What is wearing out in a disc" on /a/bpc-157 is the page
  //    declaring a section about discs.
  const headings = [...text.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) => m[1].trim());
  for (const h of headings) {
    const hits = foreign(h);
    if (hits.length) {
      return {
        code: 'subject_boundary_heading',
        message: `heading "${h}" names ${hits.map((x) => `"${x.term}"`).join(', ')}, which the slug `
          + `"${slug}" does not name as a subject. The article about ${slug} is about ${slug}. A `
          + 'condition becomes a subject only when the slug names it — write it on the condition '
          + 'page, or on the pairing page that names both.',
        evidence: { heading: h, terms: hits.map((x) => x.term), slug_subjects: subjects },
      };
    }
  }

  // 2. THE TITLE.
  const titleHits = foreign(title);
  if (titleHits.length) {
    return {
      code: 'subject_boundary_title',
      message: `title names ${titleHits.map((x) => `"${x.term}"`).join(', ')}, which the slug "${slug}" `
        + 'does not name as a subject.',
      evidence: { title: String(title || ''), terms: titleHits.map((x) => x.term) },
    };
  }

  // 3. THE OPENING. W88 puts the mechanical function of the subject in the first sentence. A
  //    condition standing in the opening has taken the page's frame before it starts.
  const opening = text.replace(/^#.*$/gm, ' ').trim().split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
  const openHits = foreign(opening);
  if (openHits.length) {
    return {
      code: 'subject_boundary_opening',
      message: `the opening names ${openHits.map((x) => `"${x.term}"`).join(', ')} before it has `
        + `finished saying what ${slug} is. The first sentences state the subject's own mechanical `
        + 'function; a condition the slug does not name cannot stand there.',
      evidence: { opening: opening.slice(0, 240), terms: openHits.map((x) => x.term) },
    };
  }

  // 4. THE READER'S OWN BODY, borrowed from a condition this page is not about.
  const assigned = [];
  for (const [re, subject] of READER_PART_SUBJECT) {
    if (declared(subject, subjects)) continue;
    for (const m of text.matchAll(re)) assigned.push({ text: m[0].trim(), subject });
  }
  if (assigned.length) {
    const shown = [...new Set(assigned.map((x) => x.text))];
    return {
      code: 'subject_boundary_reader',
      message: `the page addresses the reader's ${[...new Set(assigned.map((x) => x.subject))].join(', ')} `
        + `${assigned.length} time(s) (${shown.slice(0, 4).map((x) => `"${x}"`).join(', ')}), and the slug `
        + `"${slug}" does not name that as a subject. A page speaks to the person who has the thing the `
        + 'page is about; it does not borrow a condition it is not about.',
      evidence: { instances: shown.slice(0, 12), count: assigned.length },
    };
  }

  return null;
}

/** Density, for the corpus audit. Not a refusal on its own — a heading or an opening is. */
export function subjectForeignDensity(slug, body) {
  const subjects = slugSubjects(slug);
  const hits = conditionHits(body).filter((h) => !declared(h.term, subjects));
  const words = String(body || '').split(/\s+/).filter(Boolean).length || 1;
  const total = hits.reduce((a, h) => a + h.n, 0);
  return { total, per_1000_words: Number(((total / words) * 1000).toFixed(1)), terms: hits };
}


const CLAUSE_CHECKS = [
  {
    // W63: "Never write 'may', 'might', 'could potentially', 'some evidence suggests', or 'more
    // research is needed'. Those phrases transfer nothing and exist to protect the writer."
    id: 'W63',
    code: 'hedge_banned_by_W63',
    test: (t) => [...t.matchAll(/\b(?:may(?: help| support| improve| reduce| benefit)|might(?: help| support| improve| reduce| benefit)|could potentially|some evidence suggests|more research is needed)\b/gi)].map((m) => m[0]),
    message: (hits) => `W63 bans these exactly: ${[...new Set(hits)].map((h) => `"${h}"`).join(', ')}. `
      + 'Replace each with the quantity — how many studies, in what species, at what dose, with what '
      + 'result — or name the uncertainty precisely and say what would settle it.',
  },
  {
    // W87: "The words treats, cures, prevents, is safe for, and is effective for are never used
    // about a person, at any tier."
    id: 'W87',
    code: 'outcome_verb_banned_by_W87',
    test: (t) => [...t.matchAll(/\b(?:treats|cures|prevents|is safe for|is effective for)\b/gi)].map((m) => m[0]),
    message: (hits) => `W87 forbids ${[...new Set(hits)].map((h) => `"${h}"`).join(', ')} about a person at `
      + 'any tier. Match the verb to the tier: showed/reduced/improved for what happened inside a human '
      + 'or animal study, reported for anecdote, works by / is studied for / is derived from for structure.',
  },
  {
    // W52: "Banned shapes: 'the ways this gets minimised', 'you might think', 'critics will say',
    // 'before you dismiss this', any list of anticipated counterarguments."
    id: 'W52',
    code: 'pre_argued_detractor_W52',
    test: (t) => [...t.matchAll(/\b(?:the ways this gets minimi[sz]ed|you might think|critics will say|before you dismiss this|skeptics will (?:say|argue)|some will argue)\b/gi)].map((m) => m[0]),
    message: (hits) => `W52 bans pre-emptive defence and names these shapes: ${[...new Set(hits)].map((h) => `"${h}"`).join(', ')}. `
      + 'Objections that were actually made go in the objection ledger with dates and actors. Objections '
      + 'nobody filed are not written down at all.',
  },
  {
    // W51: "Test: strike any sentence containing 'this page', 'this article', or 'this section' as
    // its subject. If the page still reads, the sentence was framing."
    id: 'W51',
    code: 'framing_language_W51',
    test: (t) => [...t.matchAll(/\b(?:this page|this article|this section)\s+(?:is|was|does|will|has|contains|exists|covers|shows|argues|compares|holds|wants|tries|asks)\b[^.?!]{0,120}[.?!]/gi)].map((m) => m[0].trim()),
    message: (hits) => `W51: ${hits.length} sentence(s) take the page as their subject instead of the subject `
      + `(e.g. "${hits[0].slice(0, 110)}"). An article does not describe its purpose; it executes it. Strike them.`,
  },
  {
    // W87 again, second half: "Barking 'HUMAN.' or 'STRUCTURE.' at the head of a sentence is
    // unreadable and is banned outright." W90 repeats the ban on label-colon openers.
    id: 'W87b',
    code: 'tier_label_in_prose_W87',
    test: (t) => [...t.matchAll(/^\s*(?:HUMAN|ANIMAL|ANECDOTAL|MECHANISTIC|STRUCTURE)[.:]\s/gm)].map((m) => m[0].trim()),
    message: () => 'W87: the evidence tier is claim metadata, never a label in the prose. Carry it in ordinary '
      + 'English — "in 38 people over 28 days", "in rats", "one person reported", "no one has measured this".',
  },
  {
    id: 'W111',
    code: 'study_inventory_opening_W111',
    scope: 'body',
    test: (t) => {
      const first = String(t || '').replace(/^#.*$/gm, ' ').trim().split(/(?<=[.!?])\s/)[0] || '';
      const m = first.match(/\b(?:\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozens of|hundreds of)\s+(?:[a-z][a-z-]*[\s,]+){0,4}(?:studies|trials|papers|reviews|meta-analyses)\b/i);
      return m ? [first.slice(0, 160)] : [];
    },
    message: (hits) => 'W111 bans opening with an inventory of studies, and the first sentence is one: '
      + `"${hits[0]}". Open instead with what the substance does for a person and in which tissue, `
      + 'with its tier in the same sentence — the effect, the species, the dose, the count (W112). '
      + 'The study tally belongs further down, under W114\'s descending tiers.',
  },
  {
    id: 'W118',
    code: 'absence_as_frame_W118',
    scope: 'slug+body',
    test: (slug, t) => {
      const text = String(t || '');
      const ABSENCE = /\b(?:has never (?:completed|been (?:approved|tested|studied|measured|shown))|have never been (?:approved|tested|studied|measured)|has no (?:completed |finished )?(?:trial|study|human)|no (?:controlled |randomi[sz]ed |human |published )*(?:trials?|study|studies) has ever|no (?:controlled |randomi[sz]ed |human )*(?:trial|study) (?:has (?:ever )?)?(?:been run|finished|completed)|is not approved (?:anywhere|in any)|nobody has ever (?:measured|tested|studied)|never been measured (?:doing|in))\b/i;
      const preamble = text.split(/^#{2,3}\s/m)[0] || '';
      const sentences = preamble.replace(/\[\[[^\]]*\]\]/g, ' ').split(/(?<=[.!?])\s+/);
      const first = sentences[0] || '';
      if (ABSENCE.test(first)) return [first.replace(/\*\*/g, '').trim().slice(0, 170)];
      const s = String(slug || '').toLowerCase();
      for (const name of COMPOUNDS) {
        if (!s.includes(name)) continue;
        const re = new RegExp('\\b' + name.replace(/-/g, '[-\\s]') + '\\b', 'i');
        const intro = sentences.find((x) => re.test(x));
        if (intro && ABSENCE.test(intro)) return [intro.replace(/\*\*/g, '').trim().slice(0, 170)];
      }
      for (const m of text.matchAll(/^#{2,3}\s+.+$\n+([^\n]{20,400})/gm)) {
        const line = m[1].replace(/\*\*/g, '').split(/(?<=[.!?])\s/)[0];
        if (line && ABSENCE.test(line)) return [line.trim().slice(0, 170)];
      }
      return [];
    },
    message: (hits) => 'W118: an opening is framed on something that never happened — '
      + `"${hits[0]}". A substance is characterised by the effect it HAS and the tier that effect `
      + 'sits at. The missing trial is one line placed beside the claim it bears on, never the first '
      + 'thing the page says about the thing. And under W119 it may not be said at all unless what '
      + 'standard care has not proven is said in the same words and at the same length.',
  },
  {
    id: 'W21',
    code: 'opening_names_no_subject_W21',
    scope: 'slug+body',
    test: (slug, body) => { const b = openingNamesNoSubject(slug, body); return b ? [b.first] : []; },
    message: (hits) => `W21: the first sentence names none of the page's subjects — "${hits[0]}". `
      + 'A reader arriving with no context is told what each named thing IS, in plain words, before '
      + 'anything is compared. "These two", "this compound" and "the drug" name nothing.',
  },
  {
    id: 'W13',
    code: 'jargon_without_plain_words_W13',
    scope: 'body',
    test: (body) => unglossedJargon(body).map((j) => `${j.term} -> ${j.plain}`),
    message: (hits) => `W13: ${hits.length} technical word(s) with no plain words beside them — `
      + hits.slice(0, 6).map((h) => `"${h}"`).join('; ')
      + '. Use the plain words instead, or put the plain meaning in the same sentence.',
  },
  {
    id: 'W74p',
    code: 'unsourced_claim_about_people',
    scope: 'body',
    test: (body) => {
      const text = String(body || '')
        .replace(/[“”][^“”]{0,2000}[”“]/g, ' ')
        .replace(/"[^"\n]{0,2000}"/g, ' ').replace(/^>.*$/gm, ' ');
      const RE = /(?:^|[.!?]\s|\n)((?:most |many |some |almost all |nearly all )?people\s+(?:who\s+)?(?:weigh|compare|reach|turn|take|use|run|buy|arrive|come|go|start|stop|try|report|say|think|want|do)\w*\b[^.!?]{0,220}[.!?]|anyone who[^.!?]{0,200}[.!?])/gi;
      const out = [];
      for (const m of text.matchAll(RE)) {
        const sent = m[1].trim();
        if (/\b\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozens|hundreds|thousands)\b/i.test(sent)) continue;
        out.push(sent.slice(0, 170));
      }
      return out;
    },
    message: (hits) => 'A claim about people carries a count and its source, exactly as a claim about a '
      + `molecule carries species, dose and count. ${hits.length} do not: `
      + hits.slice(0, 3).map((h) => `"${h}"`).join('; ')
      + '. Cite the counted first-person record and its denominator, or cut the sentence.',
  },
  {
    // NO SENTENCE ANNOUNCES THE NEXT BLOCK. W51 caught "this page compares…"; what shipped was
    // "Here is the trade, one line each." Same defect, different words, and it carries none of the
    // five things the existence test requires.
    id: 'W05a',
    code: 'announcement_sentence',
    scope: 'body',
    test: (body) => [...String(body || '').matchAll(
      /(?:^|[.!?]\s|\n)((?:here (?:is|are)|here's|what follows is|below (?:is|are)|two things follow|three things follow|let us start|let's start|to start with)\b[^.!?\n]{0,120}[.!?])/gi,
    )].map((m) => m[1].trim().slice(0, 140)),
    message: (hits) => `${hits.length} sentence(s) announce the next block instead of carrying it: `
      + hits.slice(0, 4).map((h) => `"${h}"`).join('; ')
      + '. The block is the announcement. Delete the sentence and start the block.',
  },
];

// Clauses that need a reader, not a regex. Listed so the gap is countable. Anything moved out of
// this list must arrive with a check whose test is quoted from the clause itself.
export const UNENFORCED_CLAUSES = [
  'W19 canonical resource', 'W20 spelled out', 'W21 zero context', 'W22 every step shown',
  'W24 economics and reasons', 'W25 one idea one block', 'W27 delete-test', 'W29 people who did it',
  'W30 anecdote cards', 'W31 documented search', 'W45 fetch the law', 'W46 zero-context gate',
  'W48 one scenario end to end', 'W57 plain word over technical word', 'W59 mechanical register',
  'W60 two rates', 'W61 counted anecdotes', 'W62 evidence-state visibility', 'W65 evidence-state block',
  'W67 citation supports the sentence', 'W68 five causal distinctions', 'W69 number context',
  'W70 patient outcome over surrogate', 'W71 matched dose and route', 'W72 decision not disclaimer',
  'W75 claim labels', 'W76 source independence', 'W77 last-checked date', 'W78 act-or-wait threshold',
  'W79 anecdote method', 'W88 five questions in order', 'W90 one source complete', 'W94 inline source cards',
];

/**
 * Every mechanically-testable clause violation in one body, in clause order.
 * `slug` is optional and only used by clauses whose test needs to know the page's subject (W118).
 */
export function writingLawViolations(title, body, slug) {
  const whole = String(title || '') + '\n' + String(body || '');
  if (!whole.trim()) return [];
  const out = [];
  for (const c of CLAUSE_CHECKS) {
    const hits = c.scope === 'slug+body'
      ? c.test(slug, String(body || ''))
      : c.test(c.scope === 'body' ? String(body || '') : whole);
    if (hits && hits.length) {
      out.push({ code: c.code, clause: c.id, message: c.message(hits), evidence: { hits: [...new Set(hits)].slice(0, 12), count: hits.length } });
    }
  }
  return out;
}

/** Run every mechanically-testable clause. Returns the first violation, or null. */
export function checkWritingLawClauses(title, body, slug) {
  return writingLawViolations(title, body, slug)[0] || null;
}

export function newWritingLawViolation({ slug, prevTitle, prevBody, title, body }) {
  const now = writingLawViolations(title, body, slug);
  if (!now.length) return null;
  const had = new Set(writingLawViolations(prevTitle, prevBody, slug).map((v) => v.code));
  return now.find((v) => !had.has(v.code)) || null;
}

/** Everything this module enforces, in one call, for the write path and the corpus audit. */
export function checkArticleConformance(slug, title, body) {
  return checkSubjectBoundary(slug, title, body) || checkWritingLawClauses(title, body, slug);
}
