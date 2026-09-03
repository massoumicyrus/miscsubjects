import test from "node:test";
import assert from "node:assert/strict";
import { seoWriteIssues } from "./seo_gate.js";

test("SEO GATE — a new published article with no tags is refused", () => {
  const issues = seoWriteIssues({ isNew: true, published: 1, meta: {}, prevMeta: null });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "seo_tags_required");
});

test("SEO GATE — tags satisfy the gate in both shapes the write path accepts (array and string)", () => {
  assert.equal(seoWriteIssues({ isNew: true, published: 1, meta: { tags: ["peptides"] }, prevMeta: null }).length, 0);
  assert.equal(seoWriteIssues({ isNew: true, published: 1, meta: { tags: "peptides, evidence" }, prevMeta: null }).length, 0);
});

test("SEO GATE — drafts are an open scratch surface: no tag requirement", () => {
  assert.equal(seoWriteIssues({ isNew: true, published: 0, meta: {}, prevMeta: null }).length, 0);
});

test("SEO GATE — ratchet: an existing article without tags is never blocked retroactively", () => {
  assert.equal(seoWriteIssues({ isNew: false, published: 1, meta: {}, prevMeta: {} }).length, 0);
});

test("SEO GATE — a deck this write sets is bounded 40–300 chars", () => {
  const thin = seoWriteIssues({ isNew: false, published: 1, meta: { deck: "too short" }, prevMeta: {} });
  assert.equal(thin[0].code, "seo_deck_too_thin");
  const long = seoWriteIssues({ isNew: false, published: 1, meta: { deck: "y".repeat(400) }, prevMeta: { deck: "old" } });
  assert.equal(long[0].code, "seo_deck_overlong");
});

test("SEO GATE — an untouched deck never blocks a repair, whatever its length", () => {
  const deck = "x".repeat(9); // far below the floor, but not set by this write
  assert.equal(seoWriteIssues({ isNew: false, published: 1, meta: { deck }, prevMeta: { deck } }).length, 0);
});
