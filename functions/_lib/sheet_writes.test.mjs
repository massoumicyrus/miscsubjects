import assert from 'node:assert/strict';
import test from 'node:test';
import { fieldWritable, writeViewCell } from './sheet_writes.js';

test('only declared fields of writable sources can be written through a view', () => {
  assert.equal(fieldWritable('directory', 'content'), true);
  assert.equal(fieldWritable('directory', 'key'), false);
  assert.equal(fieldWritable('articles', 'body'), true);
  assert.equal(fieldWritable('articles', 'slug'), false);
  assert.equal(fieldWritable('ledger', 'response_json'), false);
});

test('an article body edit reads the hash first and sends it back; metadata edits go straight through', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null });
    if (!init.method) return { ok: true, status: 200, json: async () => ({ slug: 'bpc-157', body_hash: 'h1' }) };
    return { ok: true, status: 200, json: async () => ({ ok: true, updated_at: '2026-09-06T00:00:00Z' }) };
  };
  const env = { TERMINAL_KEY: 'k' };
  const r = await writeViewCell(env, { source: 'articles', id: 'bpc-157', field: 'body', value: 'new body', fetchImpl, origin: 'https://x.test' });
  assert.equal(r.ok, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].method, 'PATCH');
  assert.deepEqual(calls[1].body, { body: 'new body', expected_hash: 'h1' });
  const t = await writeViewCell(env, { source: 'articles', id: 'bpc-157', field: 'title', value: 'New title', fetchImpl, origin: 'https://x.test' });
  assert.equal(t.ok, true);
  assert.deepEqual(calls[2].body, { title: 'New title' });
  const p = await writeViewCell(env, { source: 'articles', id: 'bpc-157', field: 'published', value: 'true', fetchImpl, origin: 'https://x.test' });
  assert.deepEqual(calls[3].body, { published: 1 });
  assert.equal(p.ok, true);
});

test('a refused article write surfaces the refusal, never a silent success', async () => {
  const fetchImpl = async (url, init = {}) => init.method ? { ok: false, status: 409, json: async () => ({ ok: false, error: 'hash_mismatch', current_hash: 'h2' }) } : { ok: true, status: 200, json: async () => ({ body_hash: 'h1' }) };
  const r = await writeViewCell({ TERMINAL_KEY: 'k' }, { source: 'articles', id: 'a', field: 'body', value: 'x', fetchImpl });
  assert.equal(r.error, 'hash_mismatch');
  const l = await writeViewCell({}, { source: 'ledger', id: 'e1', field: 'response_json', value: 'x' });
  assert.equal(l.error, 'field_not_writable');
});
