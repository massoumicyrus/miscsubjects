// Regression test for the exact failure that exposed the defect.
//
// 2026-08-08: law_enforcement.js declared five writing clauses — W51 framing, W52 pre-argued
// detractors, W63 hedges, W87 outcome verbs and the W87 tier-label test — as enforced by
// subject_gate.checkWritingLawClauses "at the write path". functions/api/articles/[[path]].js
// imported checkSubjectBoundary and nothing else. None of the five had ever run on a single article
// write. The enforcement ratchet counted them as enforced the whole time, so the published number
// of enforced clauses was wrong in the direction that flatters the build.
//
// Two things are pinned here. First, that the clause tests actually catch the shapes the corpus was
// carrying — every one of these strings is quoted from a page that was live that morning. Second,
// that the write path refuses a violation a write INTRODUCES and never one it inherited, because a
// flat gate would block the very edit that repairs the article, which is the failure claim_law.js
// already learned once with existing_claim_count.
//
// scripts/check-law-enforcement.mjs holds the other half: a write-path declaration whose named
// function does not appear in the write-path source now fails the deploy.

import { describe, expect, it } from "vitest";
import { newWritingLawViolation, writingLawViolations } from "./subject_gate.js";

const clauses = (title, body) => writingLawViolations(title, body).map((v) => v.clause);
const clauses2 = (title, body, slug) => writingLawViolations(title, body, slug).map((v) => v.clause);

describe("writing-law clause tests", () => {
  it("catches the W111 study-inventory opening that /a/ara-290 shipped with", () => {
    const body = "Six randomised, placebo-controlled trials have put this compound into people and "
      + "measured what happened. Three hit the thing they set out to change. Three missed.";
    expect(clauses("ARA-290", body)).toContain("W111");
  });

  it("catches a study inventory written as a raw count of papers", () => {
    expect(clauses("x", "Around 150 animal papers report it speeding repair in tendon.")).toContain("W111");
  });

  it("allows an opening that states the benefit, its species and its dose", () => {
    const body = "BPC-157 grows new blood vessels into damaged tissue, and a torn tendon rebuilds "
      + "only as fast as blood reaches it. In rats, at 10 µg/kg a day, a cut Achilles came back "
      + "taking more load before it failed.";
    expect(clauses("BPC-157", body)).not.toContain("W111");
  });

  it("does not fire on a first sentence that merely contains a number word", () => {
    expect(clauses("x", "One suppresses the signal that starts repair and takes the pain away.")).toEqual([]);
    expect(clauses("x", "Start with the two numbers that should govern every decision.")).toEqual([]);
  });

  it("catches the W51 framing sentences four of the eight core pages carried", () => {
    expect(clauses("x", "This page compares the state of the evidence.")).toContain("W51");
  });
});

describe("the write path refuses what a write introduces, not what it inherited", () => {
  const clean = "A body with nothing wrong in it at all. It states a benefit and its tier.";
  const inventory = "Six randomised trials have put this compound into people.";

  it("refuses a write that introduces a violation", () => {
    const v = newWritingLawViolation({ prevTitle: "t", prevBody: clean, title: "t", body: inventory });
    expect(v?.clause).toBe("W111");
  });

  it("never blocks an edit to an article that already carried the violation", () => {
    const v = newWritingLawViolation({
      prevTitle: "t",
      prevBody: inventory + " Old tail.",
      title: "t",
      body: inventory + " New tail, a real repair to a later paragraph.",
    });
    expect(v).toBeNull();
  });

  it("passes a write that removes the violation", () => {
    const v = newWritingLawViolation({ prevTitle: "t", prevBody: inventory, title: "t", body: clean });
    expect(v).toBeNull();
  });

  it("refuses a new article that opens with an inventory, since it inherited nothing", () => {
    const v = newWritingLawViolation({ prevTitle: "", prevBody: "", title: "t", body: inventory });
    expect(v?.clause).toBe("W111");
  });
});

// ── W118, added the same day, from the paragraph the owner read on /a/bpc-157-vs-nsaids ──
//
// The exhibit is the THIRD paragraph of that page, not its first sentence, which is why the W111
// check passed it and the owner did not. The test therefore runs on the first sentence that names
// a compound the slug names, inside the page's preamble.

describe("W118 — never characterise a thing by what it has not claimed", () => {
  const EXHIBIT = "One suppresses the signal that starts repair and reliably takes the pain away.\n\n"
    + "**Ibuprofen has been tested in people, at scale, and it works.** Number-needed-to-treat 2.5.\n\n"
    + "**BPC-157 has never completed a randomised controlled trial in a human being for any injury.** "
    + "Not for tendon, not for muscle, not for a disc, not for a joint.\n\n## Later section\n\nText.";

  it("refuses the exhibit, which the first-sentence check passed", () => {
    expect(clauses2("t", EXHIBIT, "bpc-157-vs-nsaids")).toContain("W118");
  });

  it("passes the same page once the peptide is introduced by what it does", () => {
    const fixed = "These two do opposite things to a healing tissue.\n\n"
      + "**The anti-inflammatory reduces pain by suppressing the process that repairs the tissue.** NNT 2.5.\n\n"
      + "**BPC-157 grows new blood vessels into damaged tissue.** In rats, at 10 µg/kg a day, an Achilles "
      + "came back stronger. No controlled trial in a person has finished.\n\n## Later section\n\nText.";
    expect(clauses2("t", fixed, "bpc-157-vs-nsaids")).not.toContain("W118");
  });

  it("refuses a page whose very first sentence is an absence", () => {
    expect(clauses2("t", "BPC-157 is not approved anywhere. It grows vessels.", "bpc-157")).toContain("W118");
  });

  it("refuses a section that opens on a trial nobody ran", () => {
    const b = "BPC-157 grows new blood vessels.\n\n## What is known\n\nNo controlled trial has ever been run.";
    expect(clauses2("t", b, "bpc-157")).toContain("W118");
  });

  it("leaves an absence stated in its proper place alone", () => {
    const b = "BPC-157 grows new blood vessels into damaged tissue in rats at 10 µg/kg. "
      + "It has never completed a randomised controlled trial in a person, and the first one reads out in 2027.";
    expect(clauses2("t", b, "bpc-157")).toEqual([]);
  });
});
