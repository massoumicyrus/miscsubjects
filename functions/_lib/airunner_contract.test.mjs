
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
import { checkAirunnerResponse, rowsWritten } from "./airunner_contract.js";

describe("a sheet write is confirmed by what it wrote", () => {
  it("refuses the exact health payload that was counted as a write", () => {
    const r = checkAirunnerResponse(
      "sheets_replace_tab",
      'HTTP 200:{"ok":true,"msg":"airunner up","ts":"2026-08-05T03:50:37.061Z"}',
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/health payload|never ran/i);
  });

  it("accepts the receipt the small tabs actually returned", () => {
    const r = checkAirunnerResponse(
      "sheets_replace_tab",
      'HTTP 200:{"ok":true,"tab":"LEADS_BY_SOURCE","rows":7}',
    );
    expect(r.ok).toBe(true);
    expect(rowsWritten('HTTP 200:{"ok":true,"tab":"LEADS_BY_SOURCE","rows":7}')).toBe(7);
  });

  it("refuses a bare ok with nothing named", () => {
    const r = checkAirunnerResponse("sheets_replace_tab", 'HTTP 200:{"ok":true}');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/does not name the tab/i);
  });

  it("refuses an empty body", () => {
    expect(checkAirunnerResponse("sheets_replace_tab", "").ok).toBe(false);
  });

  it("surfaces an error the script did report", () => {
    const r = checkAirunnerResponse("sheets_replace_tab", 'HTTP 200:{"ok":false,"error":"no such sheet"}');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no such sheet/);
  });

  it("leaves read actions alone", () => {
    // A health-shaped answer to a read is not this contract's business; only writes must prove
    // what they changed, and over-policing reads would break every listing call.
    expect(checkAirunnerResponse("sheets_list_tabs", 'HTTP 200:{"ok":true,"msg":"airunner up"}').ok).toBe(true);
    expect(checkAirunnerResponse("", 'HTTP 200:{"ok":true}').ok).toBe(true);
  });

  it("covers the other write actions, not just the one that failed", () => {
    for (const action of ["sheets_append_rows", "sheets_write_range", "drive_write_file", "tasks_add"]) {
      expect(
        checkAirunnerResponse(action, 'HTTP 200:{"ok":true,"msg":"airunner up"}').ok,
        `${action} should refuse a health payload`,
      ).toBe(false);
    }
  });
});
