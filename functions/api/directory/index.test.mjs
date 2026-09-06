import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequestPost } from './index.js';

test('POST applies the same hygiene gate before creating a catalogue row', async () => {
  let wrote = false;
  const env = {
    TERMINAL_KEY: 'owner-test-token',
    DB: {
      prepare() {
        return {
          bind() { return this; },
          async run() { wrote = true; return { success: true }; },
        };
      },
    },
  };
  const request = new Request('https://example.test/api/directory', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-terminal-key': 'owner-test-token',
    },
    body: JSON.stringify({
      key: 'MALICIOUS_ROW',
      type: 'fn',
      auth: '',
      content: '# WHAT: Public mutation with no example.',
    }),
  });
  const response = await onRequestPost({ request, env });
  assert.equal(response.status, 422);
  assert.equal(wrote, false);
  assert.deepEqual(await response.json(), {
    error: 'registry_hygiene_refused: keyless_missing_examples',
    key: 'MALICIOUS_ROW',
    how_to_fix: 'auth:none objects require at least one example — these are the ones strangers will call.',
    state_changed: false,
  });
});

test('GET /api/directory?brief=1 lists the catalog without payload columns', async () => {
  const { onRequestGet } = await import('./index.js');
  const env = { DB: { prepare() { return { bind() { return this; }, async all() { return { results: [{ key: 'NOW', type: 'fn', category: 'util', content: '# WHAT: the time.\n{}', test_state: '🟢 works', tested_at: 't', enabled: 1, planner_visible: 1, invocation: 'x'.repeat(5000), last_response: 'y'.repeat(5000) }] }; } }; } } };
  const res = await onRequestGet({ env, request: new Request('https://example.test/api/directory?brief=1') });
  const body = await res.json();
  assert.equal(body.rows.length, 1);
  assert.deepEqual(Object.keys(body.rows[0]).sort(), ['category', 'docs', 'enabled', 'key', 'planner_visible', 'row_num', 'test_state', 'tested_at', 'type']);
  assert.equal(body.rows[0].docs, 'WHAT: the time.');
});

test('POST /api/directory without a descriptor binds object_kind by type, never null', async () => {
  const { onRequestPost } = await import('./index.js');
  let binds = null;
  const env = { TERMINAL_KEY: 'owner-test-token', DB: { prepare(sql) { return { bind(...b) { binds = b; return this; }, async run() { return { success: true }; } }; } } };
  const mk = (type) => new Request('https://example.test/api/directory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-key': 'owner-test-token' }, body: JSON.stringify({ key: 'NEW_' + type.toUpperCase(), type, content: '# WHAT: x' }) });
  // bind order: …, runner(15), object_kind(16), descriptor_json, descriptor_rev, descriptor_hash, updated_at
  assert.equal((await onRequestPost({ env, request: mk('agent') })).status, 201);
  assert.equal(binds[16], 'agent');
  assert.equal((await onRequestPost({ env, request: mk('fn') })).status, 201);
  assert.equal(binds[16], 'capability');
});
