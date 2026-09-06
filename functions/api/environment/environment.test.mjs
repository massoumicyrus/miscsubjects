import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequestGet } from './[[path]].js';

const descriptors = [
  {
    key: 'ENVIRONMENT', type: 'http', object_kind: 'environment', enabled: 1,
    descriptor_rev: 1, descriptor_hash: 'env-hash',
    descriptor_json: JSON.stringify({
      ref: 'environment://miscsubjects', title: 'miscsubjects environment',
      operations: [{ id: 'manual', method: 'GET', href: '/api/environment?format=markdown' }],
      governance: { direct: ['law://work/W01'] },
    }),
  },
  {
    key: 'PAGE_ADMIN', type: 'http', object_kind: 'page', enabled: 1,
    descriptor_json: JSON.stringify({
      ref: 'page://admin', title: 'Admin', parent_ref: 'environment://miscsubjects',
      governance: { direct: ['law://design/D08'] },
    }),
  },
  {
    key: 'PAGE_ADMIN_SHEETS', type: 'http', object_kind: 'page', enabled: 1,
    descriptor_json: JSON.stringify({
      ref: 'page://admin/sheets', title: 'Sheets', parent_ref: 'page://admin',
      source: { ref: 'source://functions/admin/sheets/index.js', revision: 'source-hash' },
      operations: [{ id: 'read', method: 'GET', href: '/admin/sheets' }],
      governance: { direct: ['law://sheets/S01'] },
      comparables: [{
        target_ref: 'external://google/sheets',
        dimensions: ['programmability', 'arbitrary grid state'],
        basis: 'Both expose arbitrary cells through a stable grammar.',
        similarities: ['mutable grid'],
        differences: ['this environment projects directory and ledger objects'],
        sources: ['https://developers.google.com/apps-script/guides/sheets'],
        status: 'verified', verified_at: '2026-09-05',
      }],
    }),
  },
  { key: 'LAW_WORK_W01', type: 'fn', object_kind: 'law', descriptor_rev: 2, descriptor_hash: 'work-hash', descriptor_json: JSON.stringify({ ref: 'law://work/W01', title: 'Work is an object' }) },
  { key: 'LAW_DESIGN_D08', type: 'fn', object_kind: 'law', descriptor_rev: 3, descriptor_hash: 'design-hash', descriptor_json: JSON.stringify({ ref: 'law://design/D08', title: 'Location before options' }) },
  { key: 'LAW_SHEETS_S01', type: 'fn', object_kind: 'law', descriptor_rev: 1, descriptor_hash: 'sheet-law-hash', descriptor_json: JSON.stringify({ ref: 'law://sheets/S01', title: 'Cells remain arbitrary' }) },
  { key: 'EXTERNAL_GOOGLE_SHEETS', type: 'http', object_kind: 'external_system', descriptor_json: JSON.stringify({ ref: 'external://google/sheets', title: 'Google Sheets' }) },
];

function env() {
  return {
    DB: {
      prepare(sql) {
        assert.match(sql, /FROM directory/);
        return { all: async () => ({ results: descriptors }) };
      },
    },
  };
}

async function get(path = '', query = '') {
  return onRequestGet({
    env: env(),
    request: new Request(`https://miscsubjects.com/api/environment${path}${query}`),
    params: { path: path.split('/').filter(Boolean) },
  });
}

test('root JSON is a discovery document generated from live directory descriptors', async () => {
  const response = await get();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.schema, 'miscsubjects/environment/1');
  assert.equal(body.canonical_ref, 'environment://miscsubjects');
  assert.equal(body.object_count, descriptors.length);
  assert.equal(body.manual, 'https://miscsubjects.com/api/environment?format=markdown');
  assert.equal(body.discovery.governance, 'https://miscsubjects.com/api/environment/governance?ref=<canonical-ref>');
});

test('one-link Markdown teaches the stable grammar and ledger proof states', async () => {
  const response = await get('', '?format=markdown');
  assert.match(response.headers.get('content-type'), /text\/markdown/);
  const body = await response.text();
  assert.match(body, /^# miscsubjects environment/m);
  assert.match(body, /Directory = current state/);
  assert.match(body, /Ledger = history and execution evidence/);
  assert.match(body, /page:\/\/admin\/sheets/);
  assert.match(body, /contract_only.*effect_verified/s);
});

test('governance route resolves direct and inherited rules with revision evidence', async () => {
  const response = await get('/governance', '?ref=page%3A%2F%2Fadmin%2Fsheets');
  const body = await response.json();
  assert.deepEqual(body.direct.map((r) => r.rule_ref), ['law://sheets/S01']);
  assert.deepEqual(body.inherited.map((r) => r.rule_ref), ['law://design/D08', 'law://work/W01']);
  assert.equal(body.effective[1].rule_hash, 'design-hash');
});

test('comparables route explains named dimensions and material differences', async () => {
  const response = await get('/comparables', '?ref=page%3A%2F%2Fadmin%2Fsheets&dimension=programmability');
  const body = await response.json();
  assert.equal(body.comparables.length, 1);
  assert.deepEqual(body.comparables[0].dimensions, ['programmability', 'arbitrary grid state']);
  assert.deepEqual(body.comparables[0].differences, ['this environment projects directory and ledger objects']);
});

test('object route returns the same canonical descriptor instead of a second page schema', async () => {
  const response = await get('/objects', '?ref=page%3A%2F%2Fadmin%2Fsheets');
  const body = await response.json();
  assert.equal(body.ref, 'page://admin/sheets');
  assert.equal(body.source.ref, 'source://functions/admin/sheets/index.js');
  assert.equal(body.governance.effective.length, 3);
  assert.equal(body.comparables.comparables.length, 1);
});
