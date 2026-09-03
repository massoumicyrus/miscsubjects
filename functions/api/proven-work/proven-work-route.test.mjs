import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from './[[path]].js';

function envFor(manifest) {
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (!sql.includes('FROM articles')) return null;
                return { slug: args[0], title: 'PW-0001', meta: JSON.stringify({ extra: { proven_work: manifest } }) };
              },
              async all() {
                if (!sql.includes('FROM agent_turns')) return { results: [] };
                return { results: [{ id: 7326, user_input: 'owner@example.com', user_input_sha256: 'abc123', tools_json: '[]' }] };
              },
            };
          },
        };
      },
    },
  };
}

test('the work route returns only the declared ledger slice as a redacted projection', async () => {
  const manifest = {
    work_id: 'PW-0001',
    requirements: [{ id: 'formation', status: 'PASS' }],
    evidence: { agent_turn_ids: [7326] },
  };
  const response = await onRequestGet({
    request: new Request('https://miscsubjects.com/api/proven-work/proven-work-example-one'),
    env: envFor(manifest),
    params: { path: ['proven-work-example-one'] },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.work_id, 'PW-0001');
  assert.equal(body.evaluation.status, 'PROVEN');
  assert.equal(body.formation_records[0].user_input, '[redacted-email]');
  assert.equal(body.formation_records[0].user_input_sha256, 'abc123');
});

test('an article without a Proven Work manifest is not represented as proven', async () => {
  // Tap-and-go for every article (owner order 2026-08-03): a bare article now answers 200
  // with a manifest SYNTHESIZED from its own stored records — and the invariant this test
  // guards survives: the synthesized status is computed, carries declared gaps, and is
  // never PROVEN for a page whose formation record is unbound.
  const response = await onRequestGet({
    request: new Request('https://miscsubjects.com/api/proven-work/ordinary-article'),
    env: envFor(null),
    params: { path: ['ordinary-article'] },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.manifest.synthesized, true);
  assert.notEqual(body.evaluation.status, 'PROVEN');
  const gapIds = body.manifest.requirements.filter((r) => r.status !== 'PASS').map((r) => r.id);
  assert.ok(gapIds.includes('formation_record'));
});

test('the drop route mints for anyone — the server signs the mint itself (owner order 2026-08-03)', async () => {
  const originalFetch = globalThis.fetch;
  let sentKey;
  globalThis.fetch = async (input, init) => {
    sentKey = new Headers((init && init.headers) || (input.headers ?? {})).get('x-terminal-key');
    return new Response(JSON.stringify({
      ok: true, scope: 'row:WEB_FETCH', max_uses: 'unlimited', expires_at: '2026-08-10T00:00:00Z',
      fingerprint: 'cap_pub', share_token: 'sh.public',
      invoke_url: 'https://miscsubjects.com/api/dispatch?invoke=WEB_FETCH&share=sh.public',
      explain_url: 'https://miscsubjects.com/api/dispatch?explain=1&share=sh.public',
    }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const response = await onRequestPost({
      request: new Request('https://miscsubjects.com/api/proven-work/proven-work-example-one/drop', { method: 'POST' }),
      env: { ...envFor({ work_id: 'PW-0001', requirements: [] }), TERMINAL_KEY: 'owner-key' },
      params: { path: ['proven-work-example-one', 'drop'] },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.match(body.block, /token: sh\.public/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('certification requires a real inspection receipt — no receipt, no signature', async () => {
  const response = await onRequestPost({
    request: new Request('https://miscsubjects.com/api/proven-work/proven-work-example-one/certify', {
      method: 'POST',
      body: JSON.stringify({ verdict: 'SUPPORTED_BY_RECORD', model: 'test-model', grounds: 'checked' }),
    }),
    env: { ...envFor({ work_id: 'PW-0001', requirements: [] }), TERMINAL_KEY: 'owner-key' },
    params: { path: ['proven-work-example-one', 'certify'] },
  });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.error, 'inspection_receipt_required');
});

test('certification rejects a verdict outside the contract', async () => {
  const response = await onRequestPost({
    request: new Request('https://miscsubjects.com/api/proven-work/proven-work-example-one/certify', {
      method: 'POST',
      body: JSON.stringify({ verdict: 'LOOKS_GOOD', model: 'test-model', grounds: 'checked', inspection_receipt: 'inv_abc123' }),
    }),
    env: { ...envFor({ work_id: 'PW-0001', requirements: [] }), TERMINAL_KEY: 'owner-key' },
    params: { path: ['proven-work-example-one', 'certify'] },
  });
  assert.equal(response.status, 422);
});

test('the owner can mint an unlimited fixed-body block from the existing token system', async () => {
  const originalFetch = globalThis.fetch;
  let mintUrl;
  globalThis.fetch = async (input) => {
    mintUrl = new URL(input);
    return new Response(JSON.stringify({
      ok: true,
      scope: 'row:WEB_FETCH',
      max_uses: 'unlimited',
      expires_at: '2026-08-10T00:00:00Z',
      fingerprint: 'cap_123',
      share_token: 'sh.example',
      invoke_url: 'https://miscsubjects.com/api/dispatch?invoke=WEB_FETCH&share=sh.example',
      explain_url: 'https://miscsubjects.com/api/dispatch?explain=1&share=sh.example',
      ledger_url: 'https://miscsubjects.com/api/invocations?actor=cap%3Acap_123',
    }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const response = await onRequestPost({
      request: new Request('https://miscsubjects.com/api/proven-work/proven-work-example-one/drop', {
        method: 'POST',
        headers: { 'x-terminal-key': 'owner-key' },
      }),
      env: { ...envFor({ work_id: 'PW-0001', requirements: [{ id: 'replay', status: 'PASS' }] }), TERMINAL_KEY: 'owner-key' },
      params: { path: ['proven-work-example-one', 'drop'] },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.max_uses, 'unlimited');
    assert.match(body.block, /token: sh\.example/);
    assert.equal(mintUrl.searchParams.get('scope'), 'row');
    assert.equal(mintUrl.searchParams.get('key'), 'WEB_FETCH');
    assert.equal(mintUrl.searchParams.get('uses'), '0');
    assert.equal(mintUrl.searchParams.get('body_fixed'), 'GET|https://miscsubjects.com/api/proven-work/proven-work-example-one||');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
