import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequestGet } from './projections.js';

test('serves a machine-readable manifest derived from the live directory query', async () => {
  const results = [
    { key: 'ADD', type: 'fn', enabled: 1, planner_visible: 1, planner_rank: 1, content: '# WHAT: Add.' },
    { key: 'PRIVATE', type: 'fn', enabled: 1, planner_visible: 0, planner_rank: 2, content: '# WHAT: Private.' },
  ];
  const env = {
    DB: {
      prepare(sql) {
        assert.match(sql, /FROM directory/);
        return { all: async () => ({ results }) };
      },
    },
  };
  const response = await onRequestGet({ env, request: new Request('https://example.test/api/projections') });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.catalogue_row_count, 2);
  assert.deepEqual(body.projections.mcp.ids, ['ADD']);
  assert.deepEqual(body.projections.contract.ids, ['ADD', 'PRIVATE']);
});

test('serves the same snapshot as a human-readable report', async () => {
  const env = {
    DB: {
      prepare() {
        return {
          all: async () => ({
            results: [{ key: 'ADD', type: 'fn', enabled: 1, planner_visible: 1, content: '# WHAT: Add.' }],
          }),
        };
      },
    },
  };
  const response = await onRequestGet({
    env,
    request: new Request('https://example.test/api/projections?format=markdown'),
  });
  assert.match(response.headers.get('content-type'), /text\/markdown/);
  const body = await response.text();
  assert.match(body, /# Catalogue projection manifest/);
  assert.match(body, /Catalogue snapshot: `[a-f0-9]{64}`/);
  assert.match(body, /\| MCP \| 1 \|/);
});
