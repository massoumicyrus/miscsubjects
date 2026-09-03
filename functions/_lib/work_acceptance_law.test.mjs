
// node:test, not vitest. Every gate in ship.mjs invoked `npx --no-install vitest`, and this repo
// has never had vitest installed — so npx refused to fetch it and each of these regression tests
// failed on every ship without ever executing. The assertions below are unchanged; only the
// runner is one the runtime already provides.
import { describe, it, beforeEach, afterEach, before, after } from "node:test";
import assert from "node:assert/strict";
// Minimal stand-in for vitest's `vi`. Only spyOn().mockImplementation()/mockRestore() is used
// here, and node:test's own mock API does not cover replacing a global the same way.
const vi = {
  spyOn(obj, prop) {
    const original = obj[prop];
    const handle = {
      mockImplementation(fn) { obj[prop] = fn; return handle; },
      mockRestore() { obj[prop] = original; },
    };
    return handle;
  },
};


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
import { runAcceptance, recordFailure } from './work_object.js';
import { findImpossible } from '../../scripts/check-work-acceptance.mjs';

/** Minimal D1 stand-in: work_tasks rows by id, plus swallowed writes. */
function fakeEnv(rows) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    DB: {
      prepare(sql) {
        return {
          _sql: sql,
          _args: [],
          bind(...args) { this._args = args; return this; },
          async first() {
            if (/FROM work_tasks WHERE id LIKE/.test(sql)) {
              const pre = String(this._args[0] || '').replace('-%', '');
              const ids = [...byId.keys()].filter((k) => k.startsWith(pre)).sort();
              return ids.length ? { id: ids[ids.length - 1] } : null;
            }
            if (/FROM work_tasks WHERE id/.test(sql)) return byId.get(this._args[0]) || null;
            return null;
          },
          async all() { return { results: [] }; },
          async run() {
            const m = /INSERT INTO work_tasks/.test(sql);
            if (m) {
              // column order in recordFailure's INSERT
              const [id, created_at, updated_at, objective, detail, capabilities, acceptance,
                evidence_required, parent_id, failure] = this._args;
              byId.set(id, {
                id, created_at, updated_at, kind: 'failure', objective, detail, state: 'open',
                priority: 1, depends_on: '[]', capabilities, acceptance, evidence_required,
                parent_id, failure, revision: 1, failure_count: 0,
              });
            }
            return { meta: { changes: 1 } };
          },
        };
      },
    },
  };
}

const PARENT_TESTS = [
  { id: 'exists', type: 'article_exists', slug: 'sciatica' },
  { id: 'renders', type: 'http_ok', url: '/a/sciatica' },
];

describe('a task with no acceptance tests', () => {
  it('refuses with a reason instead of a blank verdict', async () => {
    const env = fakeEnv([{ id: 'WF-9001', acceptance: '[]', evidence_required: '[]', parent_id: null }]);
    const v = await runAcceptance(env, await env.DB.prepare('FROM work_tasks WHERE id=?').bind('WF-9001').first(), {}, 'https://example.test');
    expect(v.accepted).toBe(false);
    // The failure: results was [] and missing_evidence was [] — nothing to read.
    expect(v.results.length).toBeGreaterThan(0);
    expect(v.results[0].id).toBe('no_acceptance_tests');
    expect(v.results[0].detail).toMatch(/no acceptance tests/i);
    expect(v.results[0].detail).toContain('WF-9001');
  });

  it('inherits its parent tests at evaluation time, so rows already written as [] are repaired', async () => {
    const env = fakeEnv([
      { id: 'WT-0041', acceptance: JSON.stringify(PARENT_TESTS) },
      { id: 'WF-0001', acceptance: '[]', evidence_required: '[]', parent_id: 'WT-0041' },
    ]);
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (u) => {
      const url = String(u);
      if (url.includes('/api/articles/')) return new Response(JSON.stringify({ slug: 'sciatica', body: 'x', sources: [] }), { status: 200 });
      return new Response('ok', { status: 200 });
    });
    const row = await env.DB.prepare('FROM work_tasks WHERE id=?').bind('WF-0001').first();
    const v = await runAcceptance(env, row, {}, 'https://example.test');
    spy.mockRestore();
    expect(v.tests_declared).toBe(2);
    expect(v.tests_inherited_from).toBe('WT-0041');
    expect(v.results.some((r) => r.id === 'no_acceptance_tests')).toBe(false);
    expect(v.accepted).toBe(true);
  });
});

// A gate nobody has watched fail is not a gate. These pin that the deploy blocker actually bites,
// and that it bites only on the shape it is meant to catch.
describe('the deploy gate', () => {
  it('fails a failure task whose parent also declares no tests', () => {
    const { examined, impossible } = findImpossible([
      { task_id: 'WT-9000', state: 'open', kind: 'work', acceptance_tests: PARENT_TESTS },
      { task_id: 'WF-9001', state: 'open', kind: 'failure', parent_task: 'WT-9002', acceptance_tests: [] },
      { task_id: 'WT-9002', state: 'open', kind: 'work', acceptance_tests: [] },
    ]);
    expect(examined).toBe(3);
    expect(impossible.map((t) => t.id).sort()).toEqual(['WF-9001', 'WT-9002']);
  });

  it('passes a failure task that inherits its parent tests — the WF-0001 shape after repair', () => {
    const { impossible } = findImpossible([
      { task_id: 'WT-0041', state: 'completed', kind: 'work', acceptance_tests: PARENT_TESTS },
      { task_id: 'WF-0001', state: 'open', kind: 'failure', parent_task: 'WT-0041', acceptance_tests: [] },
    ]);
    expect(impossible).toEqual([]);
  });

  it('ignores terminal tasks, so a completed row with no tests never blocks a ship', () => {
    const { examined, impossible } = findImpossible([
      { task_id: 'WT-1', state: 'completed', kind: 'work', acceptance_tests: [] },
      { task_id: 'WT-2', state: 'superseded', kind: 'work', acceptance_tests: [] },
    ]);
    expect(examined).toBe(0);
    expect(impossible).toEqual([]);
  });
});

describe('recordFailure', () => {
  it('gives the child the tests that caught the failure, never an empty array', async () => {
    const env = fakeEnv([{ id: 'WT-0041', state: 'evidence_submitted', revision: 3, acceptance: JSON.stringify(PARENT_TESTS), capabilities: '[]' }]);
    const r = await recordFailure(env, 'WT-0041', {
      agent: 'test', failure: { failure_class: 'c', layer: 'l', missing_invariant: 'i' },
    });
    expect(r.ok).toBe(true);
    const child = await env.DB.prepare('FROM work_tasks WHERE id=?').bind(r.failure_task).first();
    expect(JSON.parse(child.acceptance)).toEqual(PARENT_TESTS);
  });

  it('prefers an explicit failure.acceptance when the reporter supplies one', async () => {
    const env = fakeEnv([{ id: 'WT-0041', state: 'evidence_submitted', revision: 3, acceptance: JSON.stringify(PARENT_TESTS), capabilities: '[]' }]);
    const own = [{ id: 'mine', type: 'http_ok', url: '/a/other' }];
    const r = await recordFailure(env, 'WT-0041', {
      agent: 'test', failure: { failure_class: 'c', layer: 'l', missing_invariant: 'i', acceptance: own },
    });
    const child = await env.DB.prepare('FROM work_tasks WHERE id=?').bind(r.failure_task).first();
    expect(JSON.parse(child.acceptance)).toEqual(own);
  });
});
