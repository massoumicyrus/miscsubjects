// REGRESSION TEST BUILT FROM THE EXACT HEADLINES AND IMAGES THE OWNER REJECTED, 2026-08-04.
//
// Three failure classes, all of which shipped live:
//
//   1. THE EVIDENCE STATE IN THE HEADLINE. /a/bdnf-p21 published as "BDNF-P21: the compound is P021,
//      and every result is a mouse fed it in its diet". Owner: "the peptide is the peptide. If there
//      are human studies, there are human studies. If there's rat studies, there's rat studies. The
//      fact that you put it in the headline shows that you have zero understanding of what I am
//      wanting to represent."
//
//   2. THE WITHHELD REVEAL. /a/tirzepatide published as "Tirzepatide: 20.9% of body weight at 72
//      weeks, and what happens when the injections stop". Owner: "it's almost like it's a clickbait
//      headline… This is not the daily mail."
//
//   3. THE RESEARCH METHOD AS THE IMAGE. /a/bdnf-p21 shipped a photograph of a laboratory mouse.
//      Owner: "a mouse has nothing to do with the peptide."
//
// The model he gave for a correct headline: name the thing and say what it is. "Here's tirzepatide,
// it's a dual agonist." "Here's retatrutide, the triple agonist."

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
import { checkTitle, checkHeadlineSubject, checkHeroBrief, checkHeroSubjectFit, auditEditorialArticle } from "./title_hero_gate.js";

describe("headline names its subject", () => {
  it("refuses the exact BDNF-P21 headline that shipped", () => {
    const bad = checkHeadlineSubject("BDNF-P21: the compound is P021, and every result is a mouse fed it in its diet");
    expect(bad).toBeTruthy();
    expect(bad).toMatch(/evidence|animal/i);
  });

  it("refuses the exact tirzepatide clickbait headline that shipped", () => {
    const bad = checkHeadlineSubject("Tirzepatide: 20.9% of body weight at 72 weeks, and what happens when the injections stop");
    expect(bad).toBeTruthy();
    expect(bad).toMatch(/withhold|states its point/i);
  });

  it("refuses every other shape of the same two defects", () => {
    for (const t of [
      "ARA-290 (cibinetide): six human trials, three that hit, and the dose almost nobody takes",
      "Spinal stenosis: the shopping trolley test, and the year of untreated data nobody mentions",
      "BPC-157: rat studies only, and no human data",
      "MOTS-c: the one thing nobody tells you",
      "Semax: here's what the trials found",
      "Glow-70: 12 studies, and why that matters",
      "KPV: in vitro results, and what happens when you scale the dose",
    ]) {
      expect(checkHeadlineSubject(t), `should refuse: ${t}`).toBeTruthy();
    }
  });

  it("publishes headlines that name the thing and say what it is", () => {
    for (const t of [
      "Retatrutide: the third receptor, and what the evidence now establishes",
      "Tirzepatide: a dual GIP and GLP-1 agonist, and how it differs from semaglutide",
      "BPC-157: a synthetic fragment of a stomach protein, and where it acts",
      "Sciatica: what is actually pressing on the nerve, and what each cause does over a year",
      "Frozen shoulder: the capsule shrinks, and the treatment changes with the phase",
      "Carpal tunnel syndrome: the median nerve in a passage that cannot expand",
      // States its finding outright rather than promising one. The line is withholding, not tone:
      // a headline may report an uncomfortable result as long as it reports it.
      "Tendinopathy: why the injection that helps this month leaves you worse next year",
    ]) {
      expect(checkHeadlineSubject(t), `should publish: ${t}`).toBeFalsy();
    }
  });

  it("keeps the older headline rules working", () => {
    expect(checkTitle("")).toBeTruthy();
    expect(checkTitle("A revolutionary new peptide protocol for everyone")).toMatch(/decorative/i);
    expect(checkTitle("Sciatica: four causes, and what the randomised evidence supports")).toBeFalsy();
  });
});

describe("hero shows the subject, not the method", () => {
  it("refuses the laboratory mouse that shipped on BDNF-P21", () => {
    const bad = checkHeroSubjectFit("A white laboratory mouse in a clear cage with bedding, eating pellets from a ceramic bowl");
    expect(bad).toBeTruthy();
    expect(bad).toMatch(/research method|study/i);
  });

  it("refuses props that would illustrate any compound equally", () => {
    for (const b of [
      "Two peptide vials standing on a silver tray under soft light",
      "A loading dock with pallets and shipping crates at dawn",
      "Pill bottles arranged on a warehouse shelf",
    ]) {
      expect(checkHeroSubjectFit(b), `should refuse: ${b}`).toBeTruthy();
    }
  });

  it("refuses the house motif being reused as a template", () => {
    // One approved image of four robots at a table with a red wax seal and red string became the
    // props for every image after it. The reference sets craft, not contents.
    const bad = checkHeroSubjectFit("A gold robot at a table with a red wax seal and red string between the documents");
    expect(bad).toBeTruthy();
    expect(bad).toMatch(/motif|template/i);
    // The page the motif genuinely belongs to may still use it.
    expect(checkHeroSubjectFit("Four robots around a table, red wax seal, red string", { motifOwner: true })).toBeFalsy();
  });

  it("accepts a hero anchored in the article's own subject", () => {
    expect(checkHeroBrief(
      "A cutaway of the lumbar spine at the moment a disc fragment contacts the nerve root, painted "
      + "in the style of a mid-century medical plate, one clear focal point, no text",
    )).toBeFalsy();
  });
});

describe("a published article has a featured image", () => {
  it("refuses an article with no hero at all", () => {
    const r = auditEditorialArticle({
      slug: "sciatica",
      title: "Sciatica: four causes, and what the randomised evidence supports",
      body: "## What is pressing on the nerve\n\nSome prose.",
      hero: "",
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "hero_missing")).toBe(true);
  });

  it("does not raise hero_missing when a hero exists", () => {
    const r = auditEditorialArticle({
      slug: "sciatica",
      title: "Sciatica: four causes, and what the randomised evidence supports",
      body: "## What is pressing on the nerve\n\nSome prose.",
      hero: "https://assets.miscsubjects.com/hero/sciatica.png",
      editorial_review: {
        headline_subject: "sciatica", hero_subject: "lumbar spine cutaway",
        visual_action: "disc fragment contacting the nerve root", rationale: "the mechanism the page explains",
        hero_brief: "A cutaway of the lumbar spine at the moment a disc fragment contacts the nerve root, mid-century medical plate style",
        inspected: true, inspection_note: "one focal point, no text, matches the brief",
      },
    });
    expect(r.issues.some((i) => i.code === "hero_missing")).toBe(false);
  });
});
