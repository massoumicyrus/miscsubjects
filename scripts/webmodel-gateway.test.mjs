// The gateway's edge half against a fake worker and a fake D1: no success can be reported when
// the durable write or the ledger write fails, and a failure from the worker is a named failure.
// node scripts/webmodel-gateway.test.mjs
import assert from 'node:assert/strict';
import { makeWebmodelFnMap } from '../functions/_lib/webmodel_gateway.js';

let n = 0;
const atest = async (name, fn) => { try { await fn(); n++; console.log('ok', name); } catch (e) { console.log('FAIL', name); throw e; } };

function fakeDb({ failTurnInsert = false, failAll = false } = {}) {
  const sessions = new Map(); const turns = [];
  return {
    _sessions: sessions, _turns: turns,
    prepare(sql) {
      return {
        bind(...args) {
          const s = sql.replace(/\s+/g, ' ');
          return {
            async run() {
              if (failAll) throw new Error('D1_ERROR: isolate reset');
              if (/INSERT INTO webmodel_sessions/.test(s)) { sessions.set(args[0], { session_id: args[0], provider: args[1], profile_id: args[3], conversation_url: args[4], state: args[6], created_at: args[7], metadata_json: args[11], state_handle: args[10] }); return { meta: {} }; }
              if (/INSERT INTO webmodel_turns/.test(s)) { if (failTurnInsert) throw new Error('D1_ERROR: write refused'); turns.push({ turn_id: args[0], session_id: args[1], user_content: args[4], assistant_content: args[5], status: args[10] }); return { meta: {} }; }
              return { meta: {} };
            },
            async first() {
              if (failAll) throw new Error('D1_ERROR: isolate reset');
              if (/FROM webmodel_sessions WHERE session_id/.test(s)) return sessions.get(args[0]) || null;
              if (/MAX\(ordinal\)/.test(s)) return { n: turns.filter((t) => t.session_id === args[0]).length };
              if (/FROM traffic_profiles/.test(s)) return null;
              return null;
            },
            async all() { return { results: [] }; },
          };
        },
      };
    },
  };
}

function fakeWorker(responses) {
  return async (url, init) => {
    const path = new URL(url).pathname.replace('/webmodel/', '');
    const body = JSON.parse(init.body || '{}');
    const r = typeof responses[path] === 'function' ? responses[path](body) : responses[path];
    return new Response(JSON.stringify(r), { status: 200 });
  };
}

const realFetch = globalThis.fetch;
const sessionOk = (b) => ({ ok: true, session_id: 'wms_test1', provider: b.provider, profile_id: 'default', conversation_url: null, state: 'ready', created_at: 'now', updated_at: 'now', metadata: {} });
const sendOk = (b) => ({ ok: true, session_id: b.session_id, provider: 'chatgpt', turn_id: 'wmt_t1', prompt: b.prompt, response: 'GATEWAY_LIVE_OK', conversation_url: 'https://chatgpt.com/c/x', started_at: 'a', completed_at: 'b', capture_method: 'network_stream_end+dom', response_digest: 'sha256:r', prompt_digest: 'sha256:p' });

await atest('a captured response that cannot be written to D1 is DURABLE_WRITE_FAILED, never ok:true', async () => {
  globalThis.fetch = fakeWorker({ 'session/new': sessionOk, send: sendOk });
  const env = { TERMINAL_KEY: 'k', DB: fakeDb({ failTurnInsert: true }) };
  const ledgered = [];
  const M = makeWebmodelFnMap({ logEvent: async (_e, o) => { ledgered.push(o.action); return 'evt_' + ledgered.length; }, buildNowIso: () => 'now' });
  const out = await M.webmodelSend(env, 'chatgpt|Reply with exactly GATEWAY_LIVE_OK');
  assert.ok(out.startsWith('ERR:DURABLE_WRITE_FAILED'), out);
  assert.ok(ledgered.includes('durable_write_failed'));
  assert.ok(!ledgered.includes('turn_completed'), 'no completion receipt may exist for a turn that did not land');
});
await atest('a turn that landed but whose ledger receipt was refused is LEDGER_WRITE_FAILED', async () => {
  globalThis.fetch = fakeWorker({ 'session/new': sessionOk, send: sendOk });
  const env = { TERMINAL_KEY: 'k', DB: fakeDb() };
  const M = makeWebmodelFnMap({ logEvent: async (_e, o) => (o.action === 'turn_completed' ? null : 'evt_x'), buildNowIso: () => 'now' });
  const out = await M.webmodelSend(env, 'chatgpt|Reply with exactly GATEWAY_LIVE_OK');
  assert.ok(out.startsWith('ERR:LEDGER_WRITE_FAILED'), out);
});
await atest('the happy path binds the exact prompt to the exact response and names the substrate', async () => {
  globalThis.fetch = fakeWorker({ 'session/new': sessionOk, send: sendOk });
  const env = { TERMINAL_KEY: 'k', DB: fakeDb() };
  const receipts = [];
  const M = makeWebmodelFnMap({ logEvent: async (_e, o) => { receipts.push(o); return 'evt_' + receipts.length; }, buildNowIso: () => 'now' });
  const out = JSON.parse(await M.webmodelSend(env, 'chatgpt|Reply with exactly GATEWAY_LIVE_OK'));
  assert.equal(out.ok, true); assert.equal(out.response, 'GATEWAY_LIVE_OK'); assert.equal(out.substrate, 'browser_web');
  const done = receipts.find((r) => r.action === 'turn_completed');
  assert.equal(done.request.prompt, 'Reply with exactly GATEWAY_LIVE_OK'); assert.equal(done.response.response, 'GATEWAY_LIVE_OK');
  assert.equal(env.DB._turns.length, 1);
});
await atest('a signed-out provider is AUTH_REQUIRED from the worker, never a fabricated answer', async () => {
  globalThis.fetch = fakeWorker({ 'session/new': (b) => ({ ok: false, error: 'AUTH_REQUIRED', message: `${b.provider} is not signed in`, session_id: 'wms_x' }) });
  const env = { TERMINAL_KEY: 'k', DB: fakeDb() };
  const M = makeWebmodelFnMap({ logEvent: async () => 'evt', buildNowIso: () => 'now' });
  const out = await M.webmodelSend(env, 'kimi|hello');
  assert.ok(out.startsWith('ERR:AUTH_REQUIRED'), out);
});
await atest('a worker that is down is BROWSER_WORKER_OFFLINE', async () => {
  globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
  const env = { TERMINAL_KEY: 'k', DB: fakeDb() };
  const M = makeWebmodelFnMap({ logEvent: async () => 'evt', buildNowIso: () => 'now' });
  const out = await M.webmodelSend(env, 'chatgpt|hello');
  assert.ok(out.startsWith('ERR:BROWSER_WORKER_OFFLINE'), out);
});
await atest('the producer records under a handle but is not handed the briefing; only with_state receives it', async () => {
  let lastPrompt = null;
  globalThis.fetch = fakeWorker({ 'session/new': sessionOk, send: (b) => { lastPrompt = b.prompt; return sendOk(b); } });
  const db = fakeDb();
  db.prepare = ((orig) => (sql) => {
    if (/FROM state_handles/.test(sql)) return { bind: () => ({ first: async () => ({ handle: 'state://h', objective: 'obj', status: 'open' }), all: async () => ({ results: [] }), run: async () => ({}) }) };
    if (/FROM state_entries/.test(sql)) return { bind: () => ({ all: async () => ({ results: [{ ts: 't', kind: 'turn', actor: 'chatgpt-web', summary: 'replied GATEWAY_LIVE_OK' }] }), first: async () => null, run: async () => ({}) }) };
    return orig(sql);
  })(db.prepare.bind(db));
  const env = { TERMINAL_KEY: 'k', DB: db };
  const M = makeWebmodelFnMap({ logEvent: async () => 'evt', buildNowIso: () => 'now' });
  await M.webmodelSend(env, JSON.stringify({ provider: 'chatgpt', prompt: 'Reply with exactly X', state_handle: 'state://h' }));
  assert.equal(lastPrompt, 'Reply with exactly X');
  await M.webmodelSend(env, JSON.stringify({ provider: 'claude', prompt: 'State exactly what the previous model replied.', state_handle: 'state://h', with_state: true }));
  assert.match(lastPrompt, /SHARED STATE state:\/\/h/); assert.match(lastPrompt, /GATEWAY_LIVE_OK/); assert.match(lastPrompt, /TASK: State exactly what the previous model replied\./);
});
await atest('a slow provider is accepted and polled to completion, never held open past the edge timeout', async () => {
  let polls = 0;
  globalThis.fetch = fakeWorker({ 'session/new': sessionOk, send: (b) => (b.async ? { ok: true, accepted: true, state: 'running', turn_id: 'wmt_slow', session_id: b.session_id, provider: 'claude' } : sendOk(b)), turn: (b) => (++polls < 2 ? { ok: true, state: 'running', turn_id: b.turn_id } : { ...sendOk({ session_id: 'wms_test1', prompt: 'p' }), provider: 'claude', turn_id: 'wmt_slow', response: 'GATEWAY_LIVE_OK', state: 'complete' }) });
  const env = { TERMINAL_KEY: 'k', DB: fakeDb() };
  const M = makeWebmodelFnMap({ logEvent: async () => 'evt', buildNowIso: () => 'now' });
  const out = JSON.parse(await M.webmodelSend(env, 'claude|Reply with exactly GATEWAY_LIVE_OK'));
  assert.equal(out.ok, true); assert.equal(out.response, 'GATEWAY_LIVE_OK'); assert.equal(out.turn_id, 'wmt_slow'); assert.ok(polls >= 2);
});
await atest('a turn that never completes within the budget is RESPONSE_TIMEOUT, by name', async () => {
  globalThis.fetch = fakeWorker({ 'session/new': sessionOk, send: (b) => ({ ok: true, accepted: true, state: 'running', turn_id: 'wmt_hang', session_id: b.session_id, provider: 'claude' }), turn: (b) => ({ ok: true, state: 'running', turn_id: b.turn_id }) });
  const env = { TERMINAL_KEY: 'k', DB: fakeDb() };
  const M = makeWebmodelFnMap({ logEvent: async () => 'evt', buildNowIso: () => 'now' });
  const out = await M.webmodelSend(env, JSON.stringify({ provider: 'claude', prompt: 'x', timeout_ms: 1 }));
  assert.ok(out.startsWith('ERR:RESPONSE_TIMEOUT'), out);
});
globalThis.fetch = realFetch;
console.log(`\n${n} assertions passed`);
