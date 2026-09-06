import test from 'node:test';
import assert from 'node:assert/strict';
import { logEvent, flushPendingEvents } from './event_log.js';

function fakeLedger(plan) {
  // plan: array of booleans per batch() call — true = succeed, false = throw
  const rows = [];
  let calls = 0;
  const stmt = (sql) => ({ bind: (...b) => ({ sql, b, run: async () => { rows.push({ sql, b }); } }) });
  return {
    rows,
    calls: () => calls,
    prepare: (sql) => stmt(sql),
    batch: async (stmts) => {
      const ok = plan[Math.min(calls, plan.length - 1)];
      calls++;
      if (!ok) throw new Error('D1_ERROR: Requests queued for too long');
      for (const s of stmts) rows.push({ sql: s.sql, b: s.b });
    },
  };
}
function fakeKV() {
  const m = new Map();
  return {
    m,
    get: async (k, type) => { const v = m.get(k); if (v == null) return null; return type === 'json' ? JSON.parse(v) : v; },
    put: async (k, v) => { m.set(k, v); },
    delete: async (k) => { m.delete(k); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name })) }),
  };
}

test('a refused write is retried and lands on a later attempt', async () => {
  const LEDGER = fakeLedger([false, false, true]);
  const env = { LEDGER, KV: fakeKV() };
  const id = await logEvent(env, { source: 'blooio', action: 'message_in', request: 'How are you' });
  assert.ok(id);
  assert.equal(LEDGER.calls(), 3);
  assert.ok(LEDGER.rows.some((r) => /INSERT INTO events\b/.test(r.sql) && r.b[0] === id), 'the events row landed');
  assert.equal([...env.KV.m.keys()].length, 0, 'nothing stashed when the retry succeeded');
});

test('a write the database keeps refusing is stashed whole, then flushed with its original ts', async () => {
  const LEDGER = fakeLedger([false]);
  const KV = fakeKV();
  const env = { LEDGER, KV };
  const id = await logEvent(env, { source: 'grok', key: 'ROUTER', action: 'chat_completion', trace_id: 't_x', request: { a: 1 }, response: { b: 2 } });
  assert.ok(id, 'the caller still gets an id');
  const stashed = await KV.get('ledger:pending:' + id, 'json');
  assert.ok(stashed, 'row stashed in KV');
  assert.equal(stashed.trace_id, 't_x');
  assert.equal(stashed.request_json, JSON.stringify({ a: 1 }));
  assert.equal(await KV.get('ledger:pending:any'), '1');
  const originalTs = stashed.ts;

  // the database recovers
  const LEDGER2 = fakeLedger([true]);
  const out = await flushPendingEvents({ LEDGER: LEDGER2, KV }, 10);
  assert.equal(out.flushed, 1);
  const landed = LEDGER2.rows.find((r) => /INSERT OR IGNORE INTO events/.test(r.sql));
  assert.ok(landed, 'flushed as INSERT OR IGNORE');
  assert.equal(landed.b[0], id);
  assert.equal(landed.b[1], originalTs, 'keeps the timestamp of when it happened, not when it landed');
  assert.equal(await KV.get('ledger:pending:' + id), null, 'stash cleared');
  assert.equal(await KV.get('ledger:pending:any'), null, 'flag cleared when nothing remains');
});

test('flush stops at the first refusal and leaves the rest for next time', async () => {
  const KV = fakeKV();
  await KV.put('ledger:pending:a', JSON.stringify({ id: 'a', ts: '2026-09-05T22:51:20-07:00', source: 's' }));
  await KV.put('ledger:pending:b', JSON.stringify({ id: 'b', ts: '2026-09-05T22:51:21-07:00', source: 's' }));
  await KV.put('ledger:pending:any', '1');
  const out = await flushPendingEvents({ LEDGER: fakeLedger([false]), KV }, 10);
  assert.equal(out.flushed, 0);
  assert.equal(await KV.get('ledger:pending:any'), '1', 'flag stays while rows remain');
});
