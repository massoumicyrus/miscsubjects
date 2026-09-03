// Regression test for the exact failure that exposed the defect.
//
// 2026-08-04: /a/tirzepatide published as "Tirzepatide: 20.9% of body weight in 72 weeks, and
// nothing measured about a painful back". A single-compound page carried a condition frame and a
// denial of a claim the compound never made. The write path had no notion of article subject.
//
// These cases pin the refusal and, just as importantly, pin what must still be allowed: the
// combination article whose slug names both objects, and a compound page whose prose mentions
// its own biology (nerve growth factor) or a study endpoint.

// node:test, not vitest. This file imported vitest and the repo has never had it installed, so
// `npx --no-install vitest` failed on every ship and the regression below never actually ran —
// the gate reported a broken guard when the guard was fine. The assertions are unchanged; only
// the runner is one the runtime already provides.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const expect = (actual) => ({
  toContain: (needle) => assert.ok(
    Array.isArray(actual) ? actual.includes(needle) : String(actual).includes(needle),
    `expected ${JSON.stringify(actual)} to contain ${JSON.stringify(needle)}`),
  toEqual: (want) => assert.deepStrictEqual(actual, want),
  toBeNull: () => assert.strictEqual(actual, null),
});
import { crossObjectViolations, singleObjectOf } from "./one_object_guard.js";

describe("one-object guard", () => {
  it("refuses the exact headline that shipped on 2026-08-04", () => {
    const v = crossObjectViolations({
      slug: "tirzepatide",
      title: "Tirzepatide: 20.9% of body weight in 72 weeks, and nothing measured about a painful back",
      body: "",
    });
    const codes = v.map((x) => x.code);
    expect(codes).toContain("cross_object_framing");
    expect(codes).toContain("denial_framing");
  });

  it("passes the repaired headline", () => {
    expect(crossObjectViolations({
      slug: "tirzepatide",
      title: "Tirzepatide: 20.9% of body weight at 72 weeks, and what happens when the injections stop",
      body: "",
    })).toEqual([]);
  });

  it("allows cross-object writing in the combination article", () => {
    expect(crossObjectViolations({
      slug: "bpc-157-sciatica",
      title: "BPC-157 for sciatica: what the nerve-crush studies do and do not reach",
      body: "## What a compressed nerve root is\n\ntext",
    })).toEqual([]);
  });

  it("allows a condition page to headline its own condition", () => {
    expect(crossObjectViolations({
      slug: "herniated-disc",
      title: "Herniated disc: 70% resorb without surgery and 95% recover at one year",
      body: "",
    })).toEqual([]);
  });

  it("refuses a compound name in a condition page's headline", () => {
    const v = crossObjectViolations({
      slug: "herniated-disc",
      title: "Herniated disc: what BPC-157 does for it",
      body: "",
    });
    expect(v.map((x) => x.code)).toContain("cross_object_framing");
  });

  it("refuses a condition-framed section heading on a compound page", () => {
    const v = crossObjectViolations({
      slug: "semax",
      title: "Semax: a Russian stroke drug sold as a focus spray",
      body: "## The disc and the pinched nerve root are untested territory\n\ntext",
    });
    expect(v.map((x) => x.code)).toContain("cross_object_section");
  });

  it("does not mistake the compound's own biology for a condition frame", () => {
    expect(crossObjectViolations({
      slug: "bpc-157",
      title: "BPC-157: the gastric peptide and its nerve growth factor pathway",
      body: "## Nerve cells and the growth factor they use\n\ntext",
    })).toEqual([]);
  });

  it("treats a combination slug as multi-object", () => {
    expect(singleObjectOf("tirzepatide")).toEqual({ kind: "compound", name: "tirzepatide" });
    expect(singleObjectOf("bpc-157-sciatica")).toBeNull();
  });
});
