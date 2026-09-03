
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
// Mirrors TEST_TITLE_PATTERNS in functions/api/articles/[[path]].js. Kept in step by the cases
// below: if the route's list changes and this copy does not, the shared cases fail.
const TEST_TITLE_PATTERNS = [
  /\btest(?:ing)?[\s-]+(?:article|page|post|entry|doc|document|draft|content|item|upload|write|record)\b/i,
  /\b(?:article|page|post|entry|document)[\s-]+test(?:ing)?\b/i,
  /\bplaceholder\b/i,
  /\bsample\s+(?:article|post|page)\b/i,
  /\bdummy\b/i,
  /\blorem\s+ipsum\b/i,
  /\bhello[,\s]+world\b/i,
  /\bfoo\s*bar\b/i,
  /\basdf+\b/i,
  /\bdelete\s+me\b/i,
  /\bscratch(?:pad)?\b/i,
  /\bdo\s+not\s+publish\b/i,
  /\bwip\b/i,
  /\buntitled\b/i,
];

// Anchored shapes are matched against title and slug separately. Matching them against the
// concatenation never fires: "Test" with slug "t" becomes "Test t", which no end anchor matches.
const STANDALONE_TEST_PATTERNS = [
  /^\s*(?:kimi|grok|gpt|gemini|claude|deepseek|qwen|llama|fable|opus|sonnet|haiku)?[\s-]*test(?:ing)?[\s-]*\d*\s*$/i,
];

const refused = (slug, title) => {
  const slugWords = String(slug || "").replace(/-/g, " ");
  const both = String(title || "") + " " + slugWords;
  if (TEST_TITLE_PATTERNS.some((p) => p.test(both))) return true;
  return STANDALONE_TEST_PATTERNS.some((p) => p.test(String(title || "")) || p.test(slugWords));
};

describe("placeholder-title guard", () => {
  it("still refuses the exact title that caused the law", () => {
    expect(refused("kimi-test-article", "Kimi Test Article")).toBe(true);
  });

  it("refuses the other placeholder shapes", () => {
    for (const [slug, title] of [
      ["test-page", "test page"],
      ["t", "Test"],
      ["t2", "test 2"],
      ["t3", "grok test"],
      ["my-article-test", "Article test"],
      ["x", "Untitled"],
      ["y", "Lorem ipsum dolor"],
      ["z", "WIP — do not publish"],
      ["s", "scratchpad"],
      ["d", "dummy content"],
    ]) {
      expect(refused(slug, title), `should refuse: ${title}`).toBe(true);
    }
  });

  it("publishes clinical titles that name a real test", () => {
    for (const [slug, title] of [
      ["spinal-stenosis", "Spinal stenosis: the shopping trolley test, and the year of untreated data nobody mentions"],
      ["carpal-tunnel-syndrome", "Carpal tunnel syndrome: when nerve conduction testing changes the answer"],
      ["peripheral-neuropathy", "Peripheral neuropathy: the monofilament test every diabetes clinic should be doing"],
      ["sciatica", "Sciatica: what the straight leg raise test does and does not tell you"],
      ["b12", "When a blood test explains the numbness"],
    ]) {
      expect(refused(slug, title), `should publish: ${title}`).toBe(false);
    }
  });
});
