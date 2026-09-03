import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as getOp } from '../api/op.js';
import { onRequestGet as getOpos } from '../api/opos.js';

function binding() {
  return {
    prepare() {
      return {
        async first() { return { total: 1 }; },
        async all() { return { results: [] }; },
      };
    },
  };
}

async function articleFetcher(url) {
  const slug = String(url).split('/').pop();
  return new Response(JSON.stringify({ body: '# ' + slug + '\n\nEmbedded article body for ' + slug + '.' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('OP is the canonical protocol root with an OIP compatibility alias', async () => {
  const response = getOp({ request: new Request('https://miscsubjects.com/api/op') });
  const record = await response.json();
  assert.equal(record.name, 'OP');
  assert.equal(record.expanded_name, 'Object Protocol');
  assert.match(record.previous_name, /OIP/);
  assert.equal(record.roots.operating_system, 'https://miscsubjects.com/opos');
});

test('OPOS separates one generic build audit from model-specific token mints', async () => {
  const env = { DB: binding(), LEDGER: binding() };
  const response = await getOpos({ request: new Request('https://miscsubjects.com/api/opos'), env });
  const record = await response.json();
  assert.equal(record.identity.name, 'OPOS');
  assert.equal(record.tap_and_go.build_audit.mint_url, 'https://miscsubjects.com/api/dispatch?tap_go=1&drop=audit');
  assert.equal(record.tap_and_go.build_audit.archive_url, 'https://miscsubjects.com/api/opos?format=archive');
  assert.deepEqual(record.tap_and_go.token_drops.map(x => x.model), ['chatgpt', 'claude', 'grok', 'gemini', 'kimi']);
  assert.ok(record.tap_and_go.token_drops.every(x => x.mint_url.includes('model=' + x.model)));
  assert.equal(record.article_roots.length, 6);
});

test('whole-build archive retains the separately retrievable evidence corpus', async () => {
  const env = { DB: binding(), LEDGER: binding() };
  const response = await getOpos({ request: new Request('https://miscsubjects.com/api/opos?format=archive'), env, fetch: articleFetcher });
  const drop = await response.text();
  assert.match(drop, /^# OPOS/);
  assert.doesNotMatch(drop, /TARGET MODEL/);
  assert.match(drop, /## Token DROP by model/);
  assert.match(drop, /model=claude/);
  assert.match(drop, /## Embedded root articles/);
  assert.equal((drop.match(/<article-data slug=/g) || []).length, 6);
  assert.match(drop, /Embedded article body for opos-formal-audit/);
});
