// §7 acceptance: §INTEGRITY and §GAUNTLET must render byte-for-byte identical
// wherever they appear (homepage masthead, self markdown, API payload). This
// test pins the constants and asserts the self-block markdown emits them
// unchanged, and that the falsifiability qualifier is present.
import test from "node:test";
import assert from "node:assert/strict";
import { INTEGRITY_CLAUSE, GAUNTLET_CLAUSE, NOT_AWARE_CLAIM, structureSelfBlock } from "./structure_clauses.js";
import { selfMarkdown } from "./self_explain.js";

test("gauntlet clause carries no superlative framing", () => {
  assert.ok(GAUNTLET_CLAUSE.includes("falsifier"));
  assert.ok(!/largest|final boss|theory of everything|come at a node/i.test(GAUNTLET_CLAUSE));
});

test("record claim is bounded and disconfirmable", () => {
  assert.ok(NOT_AWARE_CLAIM.startsWith("I am not aware of"));
  assert.ok(/update/i.test(NOT_AWARE_CLAIM), "states the claim will update on a counterexample");
});

test("self markdown carries both clauses byte-for-byte", () => {
  const md = selfMarkdown("system_map", {});
  assert.ok(md.includes(INTEGRITY_CLAUSE), "integrity clause verbatim in self markdown");
  assert.ok(md.includes(GAUNTLET_CLAUSE), "gauntlet clause verbatim in self markdown");
  assert.ok(md.includes("### §STRUCTURE"));
  assert.ok(md.includes("### §INTEGRITY"));
  assert.ok(md.includes("### §GAUNTLET"));
});

test("structure self block never prints a guessed number", () => {
  // With no metrics supplied every value must fall back to the em-dash, not 0.
  const block = structureSelfBlock(null);
  assert.ok(block.includes("—"));
  assert.ok(!block.includes("undefined"));
  assert.ok(!block.includes("null"));
  // With metrics, values interpolate.
  const withVals = structureSelfBlock({ objects_total: { value: 1920 }, divs_total: { value: 24832 } });
  assert.ok(withVals.includes("1920 objects"));
  assert.ok(withVals.includes("24832 DIVs"));
});
