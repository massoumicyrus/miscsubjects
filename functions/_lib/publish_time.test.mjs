
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
import { pacificStamp, publishState, publishLedgerEntry } from "./publish_time.js";

describe("pacific stamp", () => {
  it("prints the owner's format to the minute", () => {
    expect(pacificStamp("2026-01-02T07:59:00.000Z")).toBe("2026.01.01.23.59 PST");
  });

  it("says PDT when the date is actually in daylight time", () => {
    // Hard-coding "PST" would print a timestamp that looks precise and is an hour wrong for eight
    // months of the year, which is worse than the calendar date it replaced.
    expect(pacificStamp("2026-08-05T02:14:48.127Z")).toMatch(/^2026\.08\.04\.19\.14 PDT$/);
  });

  it("returns empty rather than a fake stamp for unusable input", () => {
    expect(pacificStamp("")).toBe("");
    expect(pacificStamp("not a date")).toBe("");
  });
});

describe("posted versus updated", () => {
  it("calls it posted when the page has not been revised since", () => {
    const st = publishState("2026-08-04T20:00:00.000Z", "2026-08-04T20:40:00.000Z");
    expect(st.state).toBe("posted");
    expect(st.dot).toBe("new");
    expect(st.stamp).toBe(pacificStamp("2026-08-04T20:00:00.000Z"));
  });

  it("calls it updated when a real revision happened later", () => {
    const st = publishState("2026-06-01T20:00:00.000Z", "2026-08-04T20:00:00.000Z");
    expect(st.state).toBe("updated");
    expect(st.dot).toBe("revised");
    // The stamp shown is the revision, because that is what the list is ordered by.
    expect(st.stamp).toBe(pacificStamp("2026-08-04T20:00:00.000Z"));
    // Both facts stay available; the card shows one and carries the other.
    expect(st.posted).toBe(pacificStamp("2026-06-01T20:00:00.000Z"));
  });

  it("survives a missing created_at instead of inventing a state", () => {
    const st = publishState("", "2026-08-04T20:00:00.000Z");
    expect(st.state).toBe("posted");
    expect(st.updated).toBe(pacificStamp("2026-08-04T20:00:00.000Z"));
  });
});

describe("machine-readable ledger entry", () => {
  it("carries both raw timestamps and both rendered ones", () => {
    const e = publishLedgerEntry("sciatica", "2026-06-01T20:00:00.000Z", "2026-08-04T20:00:00.000Z");
    expect(e).toMatchObject({
      slug: "sciatica",
      state: "updated",
      posted_at: "2026-06-01T20:00:00.000Z",
      updated_at: "2026-08-04T20:00:00.000Z",
    });
    expect(e.posted_pacific).toMatch(/^2026\.06\.01\./);
    expect(e.updated_pacific).toMatch(/^2026\.08\.04\./);
  });
});
