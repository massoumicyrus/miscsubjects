
// node:test, not vitest. Every gate in ship.mjs invoked `npx --no-install vitest`, and this repo
// has never had vitest installed — so npx refused to fetch it and each of these regression tests
// failed on every ship without ever executing. The assertions below are unchanged; only the
// runner is one the runtime already provides.
import { describe, it, beforeEach, afterEach, before, after } from "node:test";
import assert from "node:assert/strict";

const test = it;   // vitest exports `test` as an alias for `it`

function expect(actual) {
  const api = {
    toBe: (w) => assert.strictEqual(actual, w),
    toEqual: (w) => assert.deepStrictEqual(actual, w),
    toStrictEqual: (w) => assert.deepStrictEqual(actual, w),
    toBeTruthy: () => assert.ok(actual, `expected truthy, got ${JSON.stringify(actual)}`),
    toBeFalsy: () => assert.ok(!actual, `expected falsy, got ${JSON.stringify(actual)}`),
    toBeNull: () => assert.strictEqual(actual, null),
    toBeUndefined: () => assert.strictEqual(actual, undefined),
    toBeDefined: () => assert.notStrictEqual(actual, undefined),
    toBeGreaterThan: (n) => assert.ok(actual > n, `expected ${actual} > ${n}`),
    toBeGreaterThanOrEqual: (n) => assert.ok(actual >= n, `expected ${actual} >= ${n}`),
    toBeLessThan: (n) => assert.ok(actual < n, `expected ${actual} < ${n}`),
    toBeLessThanOrEqual: (n) => assert.ok(actual <= n, `expected ${actual} <= ${n}`),
    toContain: (n) => assert.ok(
      Array.isArray(actual) ? actual.includes(n) : String(actual).includes(n),
      `expected ${JSON.stringify(actual).slice(0, 200)} to contain ${JSON.stringify(n)}`),
    toMatch: (re) => assert.ok(
      (re instanceof RegExp ? re : new RegExp(String(re))).test(String(actual)),
      `expected ${JSON.stringify(String(actual)).slice(0, 200)} to match ${re}`),
    toMatchObject: (w) => {
      for (const [k, v] of Object.entries(w)) assert.deepStrictEqual(actual?.[k], v, `key ${k}`);
    },
    toThrow: (m) => assert.throws(actual, m ? (e) => new RegExp(String(m)).test(String(e.message)) : undefined),
    toHaveLength: (n) => assert.strictEqual(actual?.length, n),
  };
  api.not = {
    toBe: (w) => assert.notStrictEqual(actual, w),
    toEqual: (w) => assert.notDeepStrictEqual(actual, w),
    toContain: (n) => assert.ok(!(Array.isArray(actual) ? actual.includes(n) : String(actual).includes(n))),
    toMatch: (re) => assert.ok(!(re instanceof RegExp ? re : new RegExp(String(re))).test(String(actual))),
    toThrow: () => assert.doesNotThrow(actual),
  };
  return api;
}
import { renderPlatformCard } from './widgets/rail-platform.js';
import { checkSourceEntry, checkSources } from './source_law.js';

/** assert.ok with a message, in vitest terms. */
function expectOk(cond, why) {
  expect(cond, why).toBeTruthy();
}


const FDA_CARD = {
  id: 'w_9qu2rfyq',
  type: 'news',
  url: 'https://www.fda.gov/media/193343/download',
  title: 'FDA briefing document, Pharmacy Compounding Advisory Committee: evaluation of BPC-157-related bulk drug substances',
  quote: 'we propose not adding BPC-157 (free base) or BPC-157 acetate to the 503A bulk drug substances list',
  summary: "FDA media 193343. FDA's own scientific recommendation, against inclusion.",
  publisher: 'FDA',
  author: 'FDA Office of Compounding Quality and Compliance',
  hash: 'c8fddfbbfe84aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};

test('a news card renders the source own words, not only our summary', () => {
  const html = renderPlatformCard(FDA_CARD, 'bpc-157');
  expectOk(
    html.includes('we propose not adding BPC-157'),
    'the FDA quote is missing from the rendered news card — `summary || quote` has come back',
  );
  expect(html).toMatch(/rp-news-quote/);
  // The summary is still shown; it just no longer displaces the quote.
  expectOk(html.includes('FDA media 193343'), 'our summary should still appear alongside the quote');
  // Order matters: the evidence comes before the caption.
  expectOk(
    html.indexOf('we propose not adding') < html.indexOf('FDA media 193343'),
    'the quote must appear before our summary',
  );
});

test('a study card renders the study sentence, not our abstract line, when both exist', () => {
  const html = renderPlatformCard({
    id: 's27', type: 'pubmed', url: 'https://pubmed.ncbi.nlm.nih.gov/36455680/',
    title: 'BPC-157: a review',
    quote: 'To date, only 3 publications have reported on the administration of BPC-157 to humans.',
    summary: 'Review noting how little human data exists.',
  }, 'bpc-157');
  expectOk(html.includes('only 3 publications'), 'the study quote is missing from the study card');
  expect(html).toMatch(/rp-medquote/);
  expectOk(html.includes('Review noting how little'), 'the abstract line should still render');
});

test('an arXiv card renders the quote it carries', () => {
  const html = renderPlatformCard({
    type: 'arxiv', url: 'https://arxiv.org/abs/2401.00001', title: 'A paper',
    quote: 'We show that the method converges under the stated assumptions in every tested regime.',
    summary: 'Our note about the paper.',
  }, 'x');
  expectOk(html.includes('converges under the stated assumptions'));
  expect(html).toMatch(/rp-ax-quote/);
});

test('a video card shows what the video says, not just its headline', () => {
  // The exact row from /a/bpc-157: this card used the quote only as a fallback TITLE, so a video
  // with both a title and a quote rendered as a thumbnail and a headline and the quotation vanished.
  const html = renderPlatformCard({
    id: 's10', type: 'youtube', url: 'https://www.youtube.com/watch?v=abc123',
    title: 'Peptide BPC-157 - Does It Work? Breaking Down the Evidence',
    quote: "I started taking BPC 157 and TB500, my elbow tendinitis is almost gone. I really can't believe it.",
  }, 'bpc-157');
  expectOk(html.includes('elbow tendinitis is almost gone'), 'the video card dropped its quote');
  expect(html).toMatch(/rp-yt-quote/);
  // The headline must still be the title, not the quote standing in for it.
  expectOk(html.includes('Does It Work?'), 'the video title should still be the card headline');
});

test('a receipt card renders a stored quote instead of dropping it', () => {
  const html = renderPlatformCard({
    type: 'receipt', url: 'https://miscsubjects.com/i/inv_abc', title: 'WIKIPEDIA_SUMMARY',
    quote: 'The call returned the article extract for the requested title in 240 milliseconds.',
  }, 'x');
  expectOk(html.includes('returned the article extract'), 'the receipt card dropped its quote');
});

test('the write path refuses a source with no quote', () => {
  const r = checkSourceEntry({ type: 'pubmed', url: 'https://pubmed.ncbi.nlm.nih.gov/1/', title: 'T' }, 0);
  expect(r.ok).toBe(false);
  expect(r.errors.join(' ')).toMatch(/no quote/);
});

test('the write path refuses a source entry that is not an object', () => {
  const r = checkSourceEntry('GRAIN (the tilt) — related kin article in the OIP corpus', 3);
  expect(r.ok).toBe(false);
  expect(r.errors.join(' ')).toMatch(/not a source object/);
});

test('the write path refuses our own summary pasted into the quote slot', () => {
  const same = 'A review of the human data on this compound, such as it is.';
  const r = checkSourceEntry({ url: 'https://example.org/x', quote: same, summary: same }, 0);
  expect(r.ok).toBe(false);
  expect(r.errors.join(' ')).toMatch(/identical to its `summary`/);
});

test('a lawful source passes, and every violation in a batch is reported at once', () => {
  const good = {
    type: 'pubmed', url: 'https://pubmed.ncbi.nlm.nih.gov/23015291/', title: 'Kisspeptin',
    quote: 'Hypothalamic kisspeptin neurons serve as the nodal regulatory centre of reproductive function.',
    summary: 'Navarro 2020 on kisspeptin as the control point for GnRH release.',
  };
  expect(checkSourceEntry(good, 0).ok).toBe(true);
  const batch = checkSources([good, { url: '' }, 'a bare string', { url: 'https://a.b', quote: 'too short' }]);
  expect(batch.ok).toBe(false);
  expect(batch.violations.length).toBe(3);
  expect(batch.violations.map((v) => v.index)).toEqual([1, 2, 3]);
});
