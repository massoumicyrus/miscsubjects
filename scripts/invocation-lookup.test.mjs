import assert from 'node:assert/strict';
import { lookupInvocation, getInvocation } from '../functions/_lib/invocation_log.js';

let n = 0;
const atest = async (name, fn) => { try { await fn(); n++; console.log('ok', name); } catch (e) { console.log('FAIL', name); throw e; } };
const ledger = (impl) => ({ LEDGER: { prepare: () => ({ bind: () => ({ first: impl }) }) } });

await atest('a hit returns ok:true with the row', async () => {
  const r = await lookupInvocation(ledger(async () => ({ id: 'inv_x', object_id: 'NOW' })), 'inv_x');
  assert.equal(r.ok, true); assert.equal(r.rec.object_id, 'NOW');
});
await atest('a true miss returns ok:true and rec:null', async () => {
  const r = await lookupInvocation(ledger(async () => null), 'inv_missing');
  assert.equal(r.ok, true); assert.equal(r.rec, null);
});
await atest('a ledger error returns ok:false and never rec:null-as-miss', async () => {
  const r = await lookupInvocation(ledger(async () => { throw new Error('D1 DB is overloaded'); }), 'inv_x', { retries: 0 });
  assert.equal(r.ok, false); assert.match(r.error, /overloaded/);
});
await atest('one retry recovers a transient failure', async () => {
  let calls = 0;
  const r = await lookupInvocation(ledger(async () => { calls++; if (calls === 1) throw new Error('Requests queued for too long'); return { id: 'inv_x' }; }), 'inv_x');
  assert.equal(r.ok, true); assert.equal(r.rec.id, 'inv_x'); assert.equal(calls, 2);
});
await atest('no LEDGER binding is a failure, not a miss', async () => {
  const r = await lookupInvocation({}, 'inv_x');
  assert.equal(r.ok, false);
});
await atest('the legacy getInvocation still returns null on error (callers that tolerate it are unchanged)', async () => {
  const r = await getInvocation(ledger(async () => { throw new Error('boom'); }), 'inv_x');
  assert.equal(r, null);
});
console.log(`${n} passed`);
