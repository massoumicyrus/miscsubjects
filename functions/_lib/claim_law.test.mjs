
// node:test, not vitest. Every gate in ship.mjs invoked `npx --no-install vitest`, and this repo
// has never had vitest installed — so npx refused to fetch it and each of these regression tests
// failed on every ship without ever executing. The assertions below are unchanged; only the
// runner is one the runtime already provides.
import { describe, it, beforeEach, afterEach, before, after } from "node:test";
import assert from "node:assert/strict";

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
import { checkClaims, claimLawRefusal, requiredClaimCount, CLAIM_LAW_MIN_WORDS } from './claim_law.js';

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const claim = (i, over = {}) => ({ id: `c${i}`, text: `This is a real assertion number ${i} that a reader could agree or disagree with.`, tier: 'human', source_ids: [], ...over });
const claims = (n, over) => Array.from({ length: n }, (_, i) => claim(i + 1, over));

describe('the failure that started this', () => {
  it('refuses a 2,782-word published article with zero claims — the tesofensine shape', () => {
    const r = checkClaims({ body: words(2782), claims: [], sources: [{ id: 's1' }] });
    expect(r.ok).toBe(false);
    expect(r.violations[0].code).toBe('claims_missing');
    expect(r.violations[0].message).toMatch(/addressable DIVs/);
    expect(r.violations[0].message).toMatch(/proof-of-work/);
    expect(r.violations[0].message).toMatch(/token-minting/);
  });

  it('tells the author the number and the shape, not just no', () => {
    const r = checkClaims({ body: words(2782), claims: [] });
    const refusal = claimLawRefusal(r);
    expect(refusal.error).toBe('claim_law_refused');
    expect(refusal.claims_required).toBe(6);
    expect(refusal.how_to_fix).toMatch(/webhook/);
    expect(refusal.how_to_fix).toMatch(/tier/);
  });

  it('accepts the same article once it carries enough claims', () => {
    const r = checkClaims({ body: words(2782), claims: claims(6), sources: [] });
    expect(r.ok).toBe(true);
  });
});

describe('atomization', () => {
  it('scales the requirement with length and stays inside 3 to 12', () => {
    expect(requiredClaimCount(400)).toBe(3);
    expect(requiredClaimCount(2782)).toBe(6);
    expect(requiredClaimCount(100000)).toBe(12);
  });

  it('refuses a long article that asserts one thing', () => {
    const r = checkClaims({ body: words(5000), claims: claims(2) });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.code === 'claims_too_few')).toBe(true);
  });
});

describe('what a claim has to be', () => {
  it('refuses a bare string, which cannot carry a tier or a hash', () => {
    const r = checkClaims({ body: words(600), claims: ['just a sentence', ...claims(2)] });
    expect(r.violations.some((v) => v.code === 'claim_not_object')).toBe(true);
  });

  it('refuses a claim with no id, because it can never be addressed or challenged', () => {
    const r = checkClaims({ body: words(600), claims: [claim(1, { id: '' }), claim(2), claim(3)] });
    expect(r.violations.some((v) => v.code === 'claim_id_missing')).toBe(true);
  });

  it('refuses two claims sharing an id', () => {
    const r = checkClaims({ body: words(600), claims: [claim(1), claim(1), claim(3)] });
    expect(r.violations.some((v) => v.code === 'claim_id_duplicate')).toBe(true);
  });

  it('refuses a label in place of an assertion', () => {
    const r = checkClaims({ body: words(600), claims: [claim(1, { text: 'mechanism' }), claim(2), claim(3)] });
    expect(r.violations.some((v) => v.code === 'claim_text_missing')).toBe(true);
  });

  it('refuses a missing or unknown evidence tier', () => {
    const missing = checkClaims({ body: words(600), claims: [claim(1, { tier: '' }), claim(2), claim(3)] });
    expect(missing.violations.some((v) => v.code === 'claim_tier_missing')).toBe(true);
    const unknown = checkClaims({ body: words(600), claims: [claim(1, { tier: 'vibes' }), claim(2), claim(3)] });
    expect(unknown.violations.some((v) => v.code === 'claim_tier_unknown')).toBe(true);
  });

  it('refuses a claim citing a source the article does not carry', () => {
    const r = checkClaims({
      body: words(600),
      claims: [claim(1, { source_ids: ['s9'] }), claim(2), claim(3)],
      sources: [{ id: 's1' }, { id: 's2' }],
    });
    const v = r.violations.find((x) => x.code === 'claim_source_dangling');
    expect(v).toBeTruthy();
    expect(v.message).toContain('s9');
  });

  it('accepts a claim citing a source the article does carry', () => {
    const r = checkClaims({
      body: words(600),
      claims: claims(3, { source_ids: ['s1'] }),
      sources: [{ id: 's1' }],
    });
    expect(r.ok).toBe(true);
  });
});

describe('what the law deliberately does not touch', () => {
  it('exempts a draft, because incomplete is what draft means', () => {
    expect(checkClaims({ body: words(3000), claims: [], draft: true }).ok).toBe(true);
    expect(checkClaims({ body: words(3000), claims: [], status: 'draft' }).ok).toBe(true);
  });

  it('exempts a short page, which is a pointer rather than an article making assertions', () => {
    expect(checkClaims({ body: words(CLAIM_LAW_MIN_WORDS - 1), claims: [] }).ok).toBe(true);
  });

  it('does not exempt a page one word over the line', () => {
    expect(checkClaims({ body: words(CLAIM_LAW_MIN_WORDS + 1), claims: [] }).ok).toBe(false);
  });
});

// THE TIER VOCABULARY MUST MATCH THE CORPUS, NOT MY JUDGEMENT OF IT.
//
// The first version of TIERS omitted `anecdotal` and `preclinical`. 758 and 389 published articles
// respectively already used them, so CLAIM_LAW refused a citation repair on /a/tirzepatide-semaglutide
// and would have refused any edit to over a thousand articles. A law that blocks repair of the thing
// it governs is worse than no law.
describe('the tier vocabulary', () => {
  it('accepts the tiers the corpus actually uses, by volume', () => {
    for (const tier of ['anecdotal', 'human', 'preclinical', 'animal', 'mechanism', 'review', 'regulatory']) {
      const r = checkClaims({ body: words(600), claims: claims(3, { tier }) });
      expect(r.ok, tier + ' must be a valid tier — the corpus uses it').toBe(true);
    }
  });

  it('still refuses a tier that means nothing to the renderer', () => {
    const r = checkClaims({ body: words(600), claims: claims(3, { tier: 'vibes' }) });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.code === 'claim_tier_unknown')).toBe(true);
  });

  it('does not let a claim-repair PUT be blocked by a pre-existing anecdotal tier', () => {
    // The exact shape that was refused: 807 words, 5 claims, two of them anecdotal.
    const mixed = [claim(1, { tier: 'human' }), claim(2, { tier: 'human' }), claim(3, { tier: 'rct' }),
      claim(4, { tier: 'anecdotal' }), claim(5, { tier: 'anecdotal' })];
    expect(checkClaims({ body: words(807), claims: mixed }).ok).toBe(true);
  });
});

// A LAW THAT BLOCKS REPAIR GETS ROUTED AROUND.
//
// Repairing one wrong citation title on /a/the-disc-stack was refused for claims_too_few. The write
// touched a source's title field and nothing else; the article was no worse after it than before.
// Demanding unrelated atomization as the price of fixing a citation is how a law stops repairs.
describe('the count check is a ratchet, not a toll gate', () => {
  it('allows a repair that leaves an already-short claim count unchanged', () => {
    const r = checkClaims({ body: words(3000), claims: claims(2), existing_claim_count: 2 });
    expect(r.ok).toBe(true);
  });

  it('allows a repair that raises a short count without reaching the requirement', () => {
    const r = checkClaims({ body: words(3000), claims: claims(4), existing_claim_count: 2 });
    expect(r.ok).toBe(true);
  });

  it('refuses a write that removes claims', () => {
    const r = checkClaims({ body: words(3000), claims: claims(3), existing_claim_count: 6 });
    expect(r.ok).toBe(false);
    const v = r.violations.find((x) => x.code === 'claims_too_few');
    expect(v.message).toMatch(/down from 6 already stored/);
    expect(v.fix).toMatch(/would remove claims/);
  });

  it('still refuses zero claims outright, whatever was stored before', () => {
    expect(checkClaims({ body: words(3000), claims: [], existing_claim_count: 0 }).ok).toBe(false);
  });

  it('still enforces the requirement on a first write, where nothing is stored yet', () => {
    expect(checkClaims({ body: words(3000), claims: claims(2), existing_claim_count: null }).ok).toBe(false);
  });

  it('still checks every claim structurally even when the count is ratcheted through', () => {
    const r = checkClaims({ body: words(3000), claims: [claim(1, { tier: 'vibes' }), claim(2)], existing_claim_count: 2 });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.code === 'claim_tier_unknown')).toBe(true);
  });
});
