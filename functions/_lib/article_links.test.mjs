// Pins the extractor that fills article_links. Two copies of a link regex is two
// link graphs, so this is the only place the grammar is asserted — the backfill
// script and the write path both import the same function.

import test from "node:test";
import assert from "node:assert/strict";
import { extractLinks } from "./article_links.js";

test("extracts wikilinks, aliases and anchors", () => {
  const body = [
    "See [[bpc-157]] and [[tb-500|the other one]].",
    "Deeper: [[the-obedience-gap#Part III]].",
    "Both: [[kpv#Dosing|how much]].",
  ].join("\n");
  const got = extractLinks(body, {});
  const byTarget = Object.fromEntries(got.map((l) => [l.target, l]));

  assert.equal(byTarget["bpc-157"].kind, "wikilink");
  assert.equal(byTarget["bpc-157"].label, null);
  assert.equal(byTarget["tb-500"].label, "the other one");
  assert.equal(byTarget["the-obedience-gap"].anchor, "Part III");
  assert.equal(byTarget["kpv"].anchor, "Dosing");
  assert.equal(byTarget["kpv"].label, "how much");
});

test("extracts markdown links, relative and absolute, and keeps the anchor", () => {
  const body =
    "[a](/a/semax) then [b](https://miscsubjects.com/a/selank) then [c](/a/kpv#dosing)";
  const got = extractLinks(body, {});
  const targets = got.map((l) => l.target).sort();
  assert.deepEqual(targets, ["kpv", "selank", "semax"]);
  assert.equal(got.every((l) => l.kind === "link"), true);
  assert.equal(got.find((l) => l.target === "kpv").anchor, "dosing");
});

test("ignores links that leave the site", () => {
  const body = "[x](https://example.com/a/not-ours) [y](https://pubmed.gov/123)";
  assert.deepEqual(extractLinks(body, {}), []);
});

test("meta.embeds become embed edges", () => {
  const got = extractLinks("no links here", { embeds: ["BPC-157", "tb-500"] });
  assert.deepEqual(
    got.map((l) => [l.target, l.kind]),
    [
      ["bpc-157", "embed"],
      ["tb-500", "embed"],
    ],
  );
});

test("[[graph]] is a view, not an article", () => {
  assert.deepEqual(extractLinks("open the [[graph]] please", {}), []);
});

test("the same target twice is one edge per kind, and both kinds survive", () => {
  const got = extractLinks("[[kpv]] again [[kpv]] and also [z](/a/kpv)", {});
  assert.equal(got.length, 2);
  assert.deepEqual(got.map((l) => l.kind).sort(), ["link", "wikilink"]);
});

test("extraction is stable — same body, same order", () => {
  const body = "[[b]] [x](/a/a) [[c]]";
  assert.deepEqual(extractLinks(body, {}), extractLinks(body, {}));
});

test("meta accepted as a JSON string as well as an object", () => {
  const got = extractLinks("", JSON.stringify({ embeds: ["kpv"] }));
  assert.deepEqual(got.map((l) => l.target), ["kpv"]);
});
