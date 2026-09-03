import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRequest, expandSpecs, resolveModel, invokeJSON, callOne } from './invoke_json.js';

function dbWith(rows) {
  return {
    prepare(sql) {
      return {
        bind() { return this; },
        async all() {
          if (/prompt_block/.test(sql)) return { results: rows.blocks || [] };
          return { results: rows.directory || [] };
        },
      };
    },
  };
}

test('resolveModel maps aliases and passes real ids through', () => {
  assert.equal(resolveModel('kimi'), '@cf/moonshotai/kimi-k2.7-code');
  assert.equal(resolveModel('fast'), '@cf/zai-org/glm-4.7-flash');
  assert.equal(resolveModel('xai/grok-4.5'), 'xai/grok-4.5');
  assert.equal(resolveModel('', { AIG_DEFAULT_MODEL: 'x/y' }), 'x/y');
});

test('the row supplies the prompt and the model; the call object overrides both', () => {
  const row = { key: 'W', target: 'kimi', content: 'ROW PROMPT' };
  const a = buildRequest({ key: 'W', input: 'hi' }, row, {});
  assert.equal(a.body.messages[0].content, 'ROW PROMPT');
  assert.equal(a.body.model, '@cf/moonshotai/kimi-k2.7-code');

  const b = buildRequest({ key: 'W', system: 'LITERAL', model: 'fast', input: 'hi' }, row, {});
  assert.equal(b.body.messages[0].content, 'LITERAL');
  assert.equal(b.body.model, '@cf/zai-org/glm-4.7-flash');
});

test('memory is appended under its own header and never mutates the row', () => {
  const row = { key: 'W', target: 'kimi', content: 'BASE' };
  const built = buildRequest({ key: 'W', memory: 'owner hates hedging', input: 'x' }, row, {});
  const system = built.body.messages[0].content;
  assert.match(system, /^BASE/);
  assert.match(system, /=== MEMORY \(appended for this call only\) ===\nowner hates hedging$/);
  assert.equal(row.content, 'BASE');
});

test('includes compose ahead of the prompt, from blocks, in order', () => {
  const blocks = { B1: 'one', B2: 'two' };
  const built = buildRequest({ system: 'BODY', includes: 'B1,B2', input: 'x' }, null, blocks);
  assert.equal(built.body.messages[0].content, '=== B1 ===\none\n\n=== B2 ===\ntwo\n\nBODY');
});

test('vars substitute in system and input; unknown vars are left alone', () => {
  const built = buildRequest({ system: 'Hello {{NAME}}', input: '{{TOPIC}} and {{NOPE}}', vars: { NAME: 'C', TOPIC: 'peptides' } }, null, {});
  assert.equal(built.body.messages[0].content, 'Hello C');
  assert.equal(built.body.messages[1].content, 'peptides and {{NOPE}}');
});

test('inputs and n expand into one flat parallel batch with distinct labels', () => {
  const specs = expandSpecs({ key: 'W', inputs: ['a', 'b'], n: 2 });
  assert.equal(specs.length, 4);
  assert.deepEqual(specs.map((s) => s.input), ['a', 'a', 'b', 'b']);
  assert.equal(new Set(specs.map((s) => s.label)).size, 4);
  assert.ok(specs.every((s) => s.inputs === undefined && s.n === undefined));
});

test('calls array and a bare array are both accepted', () => {
  assert.equal(expandSpecs({ calls: [{ key: 'A' }, { key: 'B' }] }).length, 2);
  assert.equal(expandSpecs([{ key: 'A' }, { key: 'B' }, { key: 'C' }]).length, 3);
});

test('an unknown directory key fails that one call and names the fix', async () => {
  const env = { DB: dbWith({ directory: [] }), CF_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't' };
  const out = await invokeJSON(env, { key: 'MISSING', input: 'x' });
  assert.equal(out.ok, false);
  assert.deepEqual(out.missing_keys, ['MISSING']);
  assert.match(out.results[0].error, /unknown directory key: MISSING/);
});

test('missing credentials are a named result, not a throw', async () => {
  const out = await callOne({}, { system: 's', input: 'i' }, null, {});
  assert.equal(out.ok, false);
  assert.match(out.error, /no_credentials/);
});

test('an edge error page is reported as an edge error page, never as a model answer', async () => {
  const env = { CF_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't' };
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response('<!DOCTYPE html><html>error 1101</html>', { status: 502 });
  try {
    const out = await callOne(env, { system: 's', input: 'i' }, null, {});
    assert.equal(out.ok, false);
    assert.equal(out.text, '');
    assert.match(out.error, /^edge_error_page/);
    assert.equal(out.http, 502);
  } finally { globalThis.fetch = real; }
});

test('a timeout is a result with a stated budget, not silence and not a hang', async () => {
  const env = { CF_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't' };
  const real = globalThis.fetch;
  globalThis.fetch = (url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  try {
    const out = await callOne(env, { system: 's', input: 'i', timeout_ms: 60 }, null, {});
    assert.equal(out.ok, false);
    assert.equal(out.error, 'timeout after 60ms');
  } finally { globalThis.fetch = real; }
});

test('a batch runs in parallel: wall clock is the slowest call, not the sum', async () => {
  const env = {
    DB: dbWith({ directory: [{ key: 'W', type: 'agent', target: 'fast', content: 'P' }] }),
    CF_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't',
  };
  const real = globalThis.fetch;
  let inFlight = 0, peak = 0;
  globalThis.fetch = async () => {
    inFlight++; peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 40));
    inFlight--;
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
  };
  try {
    const t0 = Date.now();
    const out = await invokeJSON(env, { key: 'W', inputs: ['a', 'b', 'c', 'd', 'e'] });
    const elapsed = Date.now() - t0;
    assert.equal(out.count, 5);
    assert.equal(out.ok_count, 5);
    assert.equal(peak, 5, 'all five calls must be in flight at once');
    assert.ok(elapsed < 150, 'batch took ' + elapsed + 'ms — that is serial, not parallel');
  } finally { globalThis.fetch = real; }
});
