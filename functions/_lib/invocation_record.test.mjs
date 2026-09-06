import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { STATE, buildInvocation, credentialEnvFor, outwardSideEffect, realInvocation, recordTest, testPlan, verdict } from './invocation_record.js';

const addRow = { key: 'ADD', type: 'fn', target: '', content: '# WHAT: Add two numbers.\n# $1 a — first\n# $2 b — second\n# EXAMPLE: [ADD]2|3[/ADD]\n$1 + $2', enabled: 1 };
const agentRow = { key: 'ROUTER', type: 'agent', target: '', content: '# WHAT: routes.\nYou are the router.', enabled: 1 };
const noArgs = { key: 'NOW', type: 'fn', target: '', content: '# WHAT: the time.', enabled: 1 };
const needsArgs = { key: 'LOWER', type: 'fn', target: '', content: '# WHAT: lowercase $1.\n$1', enabled: 1 };

test('the invocation is the raw dispatch REST envelope with example args and the credential left as a placeholder', () => {
  const inv = buildInvocation(addRow, { origin: 'https://example.test' });
  assert.equal(inv.method, 'POST');
  assert.equal(inv.url, 'https://example.test/api/dispatch');
  assert.equal(inv.headers['x-terminal-key'], '$TERMINAL_KEY');
  assert.deepEqual(inv.body, { key: 'ADD', body: '2|3' });
  assert.equal(inv.args.length, 2);
  assert.match(inv.curl, /-H "x-terminal-key: \$TERMINAL_KEY"/);
  assert.match(inv.curl, /--data '\{"key":"ADD","body":"2\|3"\}'/);
  assert.match(inv.sheet, /=INVOKE\(A2,"status"\)/);
  assert.equal(buildInvocation(addRow, { args: '10|20' }).body.body, '10|20');
});

test('the test plan runs safe rows, skips outward side effects, and refuses to judge a tool by missing args', () => {
  assert.deepEqual(testPlan(addRow), { runnable: true, args: '2|3' });
  assert.deepEqual(testPlan(noArgs), { runnable: true, args: '' });
  assert.equal(testPlan(agentRow).runnable, true);
  assert.match(testPlan(agentRow).args, /OK/);
  assert.equal(testPlan(needsArgs).runnable, false);
  assert.match(testPlan(needsArgs).reason, /needs args/);
  assert.equal(testPlan({ ...noArgs, enabled: 0 }).runnable, false);
  for (const k of ['EMAIL_SEND', 'X_POST', 'BLOOIO_SEND_MESSAGE', 'STRIPE_REFUND_CREATE', 'D1_EXEC', 'DELTASK', 'ADDTASK', 'LOCAL_SAY', 'AGENT_SPAWN']) assert.equal(outwardSideEffect(k), true, k);
  for (const k of ['ADD', 'NOW', 'STRIPE_BALANCE', 'ARTICLES', 'KV_GET', 'GOOGLE_TASKS_LIST', 'META_INSIGHTS', 'BLOOIO_LIST_CHATS', 'WRITER', 'WRITER_AGENT', 'EDITOR_AGENT', 'CRITIC', 'KIMI_CODER', 'GLM_CODER', 'CODE_MODE', 'PEPTIDE_WRITER', 'RESEARCH_BOT', 'PLANNER']) assert.equal(outwardSideEffect(k), false, k);
  for (const k of ['GROK_IMAGE', 'ARCADS_GENERATE', 'WRITE_ARTICLE', 'CODE_LEASE_COMMIT']) assert.equal(outwardSideEffect(k), true, k);
});

test('a verdict is about the returned payload: errors, breakers, error JSON and emptiness are broken', () => {
  assert.equal(verdict('5').ok, true);
  assert.equal(verdict('{"ok":true,"n":3}').ok, true);
  assert.equal(verdict('ERR:missing arg').ok, false);
  assert.equal(verdict('BREAKER: BROWSER_MARKDOWN auth-locked').ok, false);
  assert.equal(verdict('{"error":"unauthorized"}').ok, false);
  assert.equal(verdict('').ok, false);
  assert.equal(verdict('fine', 'boom').ok, false);
  assert.equal(verdict('PROVIDER_ERROR: Incorrect API key provided').ok, false);
  assert.equal(verdict('OK [REPLY]OK[/REPLY]').ok, true);
});

test('recordTest writes the five columns onto the row', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE directory (key TEXT PRIMARY KEY, type TEXT, content TEXT, updated_at TEXT); INSERT INTO directory VALUES ('ADD','fn','# WHAT: add','2026-09-06T00:00:00Z');");
  db.exec(readFileSync(new URL('../../migrations/0375_directory_invocation.sql', import.meta.url), 'utf8'));
  const env = { DB: { prepare(sql) { const st = db.prepare(sql); let b = []; return { bind(...x) { b = x; return this; }, async run() { return { meta: { changes: st.run(...b).changes } }; }, async first() { return st.get(...b) || null; } }; } } };
  const inv = buildInvocation(addRow);
  await recordTest(env, 'ADD', { invocation: inv, transport: { http: 200, ok: true, ms: 12 }, response: '5', state: STATE.works, at: '2026-09-06T01:00:00Z' });
  const row = db.prepare("SELECT * FROM directory WHERE key='ADD'").get();
  assert.equal(row.test_state, '🟢 works');
  assert.equal(row.last_response, '5');
  assert.equal(JSON.parse(row.invocation).body.key, 'ADD');
  assert.equal(JSON.parse(row.last_status).ok, true);
  assert.equal(row.tested_at, '2026-09-06T01:00:00Z');
});

test('after a run the invocation is the REAL outbound request with the credential as its vault variable', () => {
  const recorded = JSON.stringify({ url: 'https://api.x.ai/v1/chat/completions', method: 'POST', headers: { 'content-type': 'application/json', authorization: '<REDACTED>' },
    body: { model: 'grok-4.3', messages: [{ role: 'system', content: 'You are the router.' }, { role: 'user', content: 'Reply OK' }] } });
  const inv = realInvocation(agentRow, recorded, { origin: 'https://example.test' });
  assert.equal(inv.url, 'https://api.x.ai/v1/chat/completions');
  assert.equal(inv.headers.authorization, 'Bearer $GROK_API_KEY');
  assert.equal(inv.credential_env, 'GROK_API_KEY');
  assert.equal(inv.body.model, 'grok-4.3');
  assert.equal(inv.body.messages[0].content, 'You are the router.');
  assert.match(inv.curl, /^curl -sS -X POST 'https:\/\/api\.x\.ai\/v1\/chat\/completions' -H 'content-type: application\/json' -H "authorization: Bearer \$GROK_API_KEY" --data '\{"model":"grok-4.3"/);
  assert.equal(inv.build_wrapper.url, 'https://example.test/api/dispatch');
  // an http row names its own secret in its auth column
  const httpRow = { key: 'STRIPE_BALANCE', type: 'http', target: 'GET https://api.stripe.com/v1/balance', auth: 'Bearer:$STRIPE_SECRET_KEY', content: '# WHAT: balance', enabled: 1 };
  const inv2 = realInvocation(httpRow, JSON.stringify({ url: 'https://api.stripe.com/v1/balance', method: 'GET', headers: { authorization: '<REDACTED>' } }));
  assert.equal(inv2.headers.authorization, 'Bearer $STRIPE_SECRET_KEY');
  assert.equal(credentialEnvFor('https://miscsubjects.com/api/x', {}), 'TERMINAL_KEY');
  assert.equal(credentialEnvFor('https://unknown.example/x', {}), null);
  // no request recorded → the wrapper, honestly labelled
  assert.match(realInvocation(noArgs, null).via, /build dispatch/);
});
