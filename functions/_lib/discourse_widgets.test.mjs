// THE DEDUPE GATE WAS SECRETLY A LENGTH FILTER.
//
// Built from the exact published failure (discourse obj-82 and obj-86 on /a/philosophy):
// three DIFFERENT dense arguments — a Clauset-Shalizi-Newman statistics critique and two
// north-star drafts — were 409-matched at similarity 0.559–0.765 against obj-59, a
// ten-word linktest stub ("FUNCTIONAL TEST: does this return a clickable link"), while a
// 15-character junk body ("test-full-error") filed straight in. Containment similarity
// over a short stub's trigram set is covered by ANY long English text, so the gate
// blocked dense contributions and admitted junk — the exact inverse of the density
// directive.
//
// The published fix spec (the answers on obj-82/obj-86, implemented verbatim):
//   "Exclude test stubs from canonical pool; require shared target_div for dedupe
//    candidacy" + "add self-void verb for own args (status change + receipt, not deletion)"
//
// These tests pin the gate's two sides. Weakening them re-admits the length filter.

import { describe, it, expect } from "vitest";
import { similarity, isTestStub, findDuplicate, DUP_THRESHOLD } from "./discourse_widgets.js";

// The ten-word linktest stub that was canonicalizing real arguments (obj-59's body).
const STUB = "FUNCTIONAL TEST: does this return a clickable link";

// A dense argument of the same class as the one 409-rejected live (the CSN power-law
// critique of philosophy claim c1, per obj-82).
const DENSE =
  "The power-law claim in claim c1 does not survive the Clauset-Shalizi-Newman test: " +
  "fitting a straight line on a log-log plot is not evidence of a power law, because " +
  "lognormal and stretched-exponential alternatives return equally straight lines over " +
  "two decades of data. To make this claim the article must report a likelihood-ratio " +
  "test against these alternatives and a p-value from the KS-distance bootstrap, not a " +
  "visual fit. Until then the distributional claim is unsupported and the conclusions " +
  "that link heavy tails to the grain thesis inherit that weakness.";

// The 15-character junk body that filed straight in, per obj-86.
const JUNK = "test-full-error";

function fakeEnv(rows) {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: rows }),
          first: async () => rows[0] || null,
        }),
      }),
    },
  };
}

describe("the failure that started this (obj-82/obj-86)", () => {
  it("reproduces the defect's precondition: a dense argument scores above threshold against a ten-word stub", () => {
    // This is WHY the old gate 409'd real work — the number itself must stay above the
    // threshold or this test no longer exercises the published failure.
    expect(similarity(DENSE, STUB)).toBeGreaterThanOrEqual(DUP_THRESHOLD);
  });

  it("passes the dense argument: the stub is excluded from the canonical pool", async () => {
    const env = fakeEnv([
      { id: "obj-59", body: STUB, status: "answered", independently_raised: 0, canonical_of: null, target_div: null },
    ]);
    const dup = await findDuplicate(env, "philosophy", DENSE, null);
    expect(dup).toBeNull();
  });

  it("refuses the 15-character junk body as a test-family stub", () => {
    expect(isTestStub(JUNK)).toBe(true);
    expect(isTestStub(STUB)).toBe(true); // linktest/functional-test stubs are stubs too
    expect(isTestStub("")).toBe(true);
  });

  it("never mistakes a dense argument for a stub, even one that talks about tests", () => {
    expect(isTestStub(DENSE)).toBe(false);
  });
});

describe("shared target_div is required for dedupe candidacy (obj-82 fix)", () => {
  const REAL = "The audit chain anchors only prove a lower bound on formation time, not the claimed formation order, because drand rounds are public before the payloads reference them.";

  it("an identical body on a DIFFERENT div is not a duplicate candidate", async () => {
    const env = fakeEnv([
      { id: "arg-1", body: REAL, status: "open", independently_raised: 0, canonical_of: null, target_div: "claim:c1" },
    ]);
    const dup = await findDuplicate(env, "philosophy", REAL, "claim:c2");
    expect(dup).toBeNull();
  });

  it("an identical body on the SAME div is still caught", async () => {
    const env = fakeEnv([
      { id: "arg-1", body: REAL, status: "open", independently_raised: 0, canonical_of: null, target_div: "claim:c1" },
    ]);
    const dup = await findDuplicate(env, "philosophy", REAL, "claim:c1");
    expect(dup).not.toBeNull();
    expect(dup.obj_id).toBe("arg-1");
  });

  it("article-level (null div) still dedupes against article-level entries", async () => {
    const env = fakeEnv([
      { id: "arg-2", body: REAL, status: "open", independently_raised: 0, canonical_of: null, target_div: null },
    ]);
    const dup = await findDuplicate(env, "philosophy", REAL, null);
    expect(dup).not.toBeNull();
    expect(dup.obj_id).toBe("arg-2");
  });
});
