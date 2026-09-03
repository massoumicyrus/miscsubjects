// THE SOURCE LAW — one shared contract for every source entry, held at the write path.
//
// FAILURE CLASS THIS REMOVES. The owner reported, repeatedly, that source cards on the site show
// no quote: study cards carried a descriptor we had written instead of the study's own words, and
// social cards (X, Reddit) showed a paraphrase where the post itself belonged. Each time, the fix
// applied was to the article that exposed it.
//
// THE LAYER THAT PERMITTED IT. Not the renderer. functions/_lib/widgets/rail-platform.js has always
// printed `s.quote` inside the card and falls through to `s.summary` only when `quote` is empty. The
// two canonical source write paths — chainSources() in functions/api/articles/[[path]].js and
// POST /api/protocol/sources — accepted an entry with no quote at all, and even stamped it
// `quote_status: "na"` as though absence were a legitimate state. They also accepted entries that
// were not objects: bare strings sitting in meta.sources, which render as empty fallback cards.
//
// THE INVARIANT NOW ENFORCED. A source entry is an object, it has a URL, and it carries the
// source's own verbatim words in `quote`. The words in `quote` are never our words: they may not
// equal the title, the summary, or the plain-language gloss. A card can therefore never render
// without the quote the reader came for, because a quote-less source can no longer be stored.
//
// WHERE IT IS ENFORCED: both write paths call assertSourcesLawful() and refuse the whole write.
// WHAT KEEPS IT ENFORCED: scripts/check-source-quotes.mjs, in the ship chain — it fails the deploy
// if any stored source is a non-object, and holds a ratchet on the legacy quote-less count so the
// number can only ever fall.

export const SOURCE_LAW = Object.freeze({
  key: 'SOURCE_QUOTE_LAW',
  rule: 'A source entry is an object with a URL and the source\'s own verbatim words in `quote`. '
    + 'The quote is what the reader sees inside the card, so it may not be the title, the summary '
    + 'or our plain-language gloss, and it may not be absent.',
  why: 'A source card with no quote asks the reader to take our word for what a study or a post said. '
    + 'That is the one thing this site exists not to do.',
  min_quote_chars: 40,
});

/** Types whose card body IS the quote — the post, the message, the sentence from the paper. */
export const QUOTE_IS_THE_BODY = Object.freeze([
  'x', 'twitter', 'reddit', 'hackernews', 'imessage', 'whatsapp', 'statement', 'book',
  'pubmed', 'study', 'trial', 'paper', 'journal', 'anecdotal', 'forum',
]);

function norm(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Check one source entry against the law.
 * @returns {{ok: boolean, errors: string[]}}
 */
export function checkSourceEntry(raw, index) {
  const at = `sources[${index}]`;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      errors: [`${at} is ${Array.isArray(raw) ? 'an array' : typeof raw}, not a source object. `
        + 'A source is {type,url,title,quote,...}. A bare string renders as an empty card.'],
    };
  }
  const errors = [];
  const url = String(raw.url || raw.href || raw.link || '').trim();
  if (!url) errors.push(`${at} has no url`);

  const quote = String(raw.quote || '').trim();
  if (!quote) {
    errors.push(`${at} has no quote. The card shows the source's own words; without them it shows `
      + 'our description of the source instead, which is the defect this law exists to stop.');
  } else if (quote.length < SOURCE_LAW.min_quote_chars) {
    errors.push(`${at} quote is ${quote.length} characters; the law requires at least `
      + `${SOURCE_LAW.min_quote_chars}. A fragment that short is a label, not a quotation.`);
  } else {
    // Our words in the quote slot is the exact shape of the reported failure.
    const q = norm(quote);
    for (const [field, value] of [
      ['summary', raw.summary], ['title', raw.title], ['plain', raw.plain], ['why', raw.why],
    ]) {
      if (value && norm(value) === q) {
        errors.push(`${at} quote is identical to its \`${field}\`. The quote must be the source's `
          + 'words; the summary and gloss are ours.');
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Check a whole submitted list. Returns every violation, not just the first — an agent that has to
 * come back six times learns to route around the gate instead of fixing the data.
 * @returns {{ok: boolean, violations: Array<{index:number, errors:string[]}>, checked:number}}
 */
export function checkSources(list) {
  const arr = Array.isArray(list) ? list : [];
  const violations = [];
  arr.forEach((raw, i) => {
    const r = checkSourceEntry(raw, i);
    if (!r.ok) violations.push({ index: i, id: (raw && raw.id) || null, errors: r.errors });
  });
  return { ok: violations.length === 0, violations, checked: arr.length };
}

/**
 * The refusal object a write path returns. Refusing is the point: a rejected write leaves the
 * article as it was, and the agent is told exactly which entry to repair and why.
 */
export function sourceLawRefusal(result) {
  return {
    ok: false,
    error: 'source_quote_law',
    law: SOURCE_LAW.key,
    rule: SOURCE_LAW.rule,
    why: SOURCE_LAW.why,
    checked: result.checked,
    refused: result.violations.length,
    violations: result.violations,
    how_to_fix: 'Open the URL, copy the sentence that actually supports the claim, and put those '
      + 'exact words in `quote`. Keep your own description in `summary` or `plain`.',
  };
}
