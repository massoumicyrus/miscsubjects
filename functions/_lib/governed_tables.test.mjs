// THE GOVERNED-TABLE GUARD, PINNED TO THE STATEMENTS THAT USED TO WORK.
//
// WT-0039: D1_EXEC accepted any write to the content database, so `UPDATE work_tasks SET
// state='completed'` closed a task without running one acceptance test or appending one audit row —
// the exact thing the work object exists to make impossible. `UPDATE work_actions` could rewrite the
// hash chain itself.
//
// Each case below is a statement that succeeded before the guard. Weakening the guard makes one of
// them pass again, and the bypass is back.

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
import { checkGovernedWrite, governedTableIn, GOVERNED_TABLES } from './governed_tables.js';

const BYPASSES = [
  ["UPDATE work_tasks SET state='completed' WHERE id='WT-0039'", 'work_tasks'],
  ['DELETE FROM work_tasks WHERE priority > 4', 'work_tasks'],
  ["INSERT INTO work_actions (task_id,action,hash) VALUES ('WT-1','accept','deadbeef')", 'work_actions'],
  ['DELETE FROM work_actions WHERE id > 100', 'work_actions'],
  ["UPDATE articles SET body='whatever' WHERE slug='bpc-157'", 'articles'],
  ["INSERT OR REPLACE INTO articles (slug,title,body) VALUES ('x','y','z')", 'articles'],
  ["UPDATE article_slots SET content='...' WHERE slug='bpc-157'", 'article_slots'],
  ['DROP TABLE work_actions', 'work_actions'],
  ['ALTER TABLE work_tasks ADD COLUMN sneaky TEXT', 'work_tasks'],
  // Formatting is not a loophole.
  ["update   WORK_TASKS   set state='completed'", 'work_tasks'],
  ['UPDATE "work_tasks" SET priority=9', 'work_tasks'],
  ['INSERT INTO `work_actions` (action) VALUES (\'accept\')', 'work_actions'],
];

describe('governedTableIn', () => {
  for (const [sql, table] of BYPASSES) {
    it(`names ${table} in: ${sql.slice(0, 46)}…`, () => {
      expect(governedTableIn(sql)).toBe(table);
    });
  }

  it('leaves ordinary tables alone', () => {
    expect(governedTableIn("UPDATE leads SET status='enriched' WHERE id=1")).toBe(null);
    expect(governedTableIn("INSERT INTO directory (key) VALUES ('X')")).toBe(null);
    expect(governedTableIn('DELETE FROM fidelity_log WHERE id < 10')).toBe(null);
  });

  it('does not fire on a read, because a read is not a write path', () => {
    expect(governedTableIn('SELECT * FROM work_tasks WHERE state=\'open\'')).toBe(null);
    expect(governedTableIn('SELECT COUNT(*) FROM work_actions')).toBe(null);
  });
});

describe('checkGovernedWrite', () => {
  it('refuses every statement that used to bypass the work object', () => {
    for (const [sql, table] of BYPASSES) {
      const err = checkGovernedWrite('D1_EXEC', sql);
      expect(err, sql).toBeTruthy();
      expect(err).toContain('governed_table:' + table);
    }
  });

  it('tells the caller which path does work — a refusal with no destination invites the next bypass', () => {
    const err = checkGovernedWrite('D1_EXEC', "UPDATE work_tasks SET state='completed'");
    expect(err).toContain('/api/work/task/<id>/submit');
    expect(err).toContain('D1_REPAIR');
  });

  it('lets the authorized repair lane through', () => {
    expect(checkGovernedWrite('D1_REPAIR', "UPDATE work_tasks SET priority=3 WHERE id='WT-1'", { repair: true })).toBe(null);
  });

  it('passes ordinary writes untouched', () => {
    expect(checkGovernedWrite('D1_EXEC', "UPDATE leads SET status='sent' WHERE id=4")).toBe(null);
  });

  it('gives every governed table a reason and a destination', () => {
    for (const [table, g] of Object.entries(GOVERNED_TABLES)) {
      expect(g.why.length, table).toBeGreaterThan(40);
      expect(g.instead.length, table).toBeGreaterThan(20);
    }
  });
});
