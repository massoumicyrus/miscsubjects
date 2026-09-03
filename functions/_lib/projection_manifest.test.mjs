import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compileProjectionManifest,
  projectionRows,
} from './projection_manifest.js';

const rows = [
  {
    key: 'ADD',
    type: 'fn',
    category: 'math',
    enabled: 1,
    planner_visible: 1,
    content: '# WHAT: Add two numbers.',
    input_schema: '{"type":"object","properties":{"a":{"type":"number"},"b":{"type":"number"}}}',
  },
  {
    key: 'OWNER_ONLY',
    type: 'fn',
    category: 'admin',
    enabled: 1,
    planner_visible: 0,
    content: '# WHAT: Owner-only action.',
  },
  {
    key: 'TEST_ROW',
    type: 'fn',
    category: 'test',
    enabled: 1,
    planner_visible: 1,
    content: '# WHAT: Deliberately broken scratch row.',
  },
  {
    key: 'DISABLED',
    type: 'fn',
    category: 'math',
    enabled: 0,
    planner_visible: 1,
    content: '# WHAT: Disabled.',
  },
];

test('every projection is compiled from one normalized catalogue snapshot', async () => {
  const manifest = await compileProjectionManifest(rows);
  assert.match(manifest.catalogue_snapshot_sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(manifest.projections.discovery.ids, ['ADD', 'OWNER_ONLY']);
  assert.deepEqual(manifest.projections.contract.ids, ['ADD', 'OWNER_ONLY']);
  assert.deepEqual(manifest.projections.docs.ids, ['ADD', 'OWNER_ONLY']);
  assert.deepEqual(manifest.projections.cli.ids, ['ADD', 'OWNER_ONLY']);
  assert.deepEqual(manifest.projections.mcp.ids, ['ADD']);
  assert.deepEqual(manifest.projections.skill.ids, ['ADD']);
  assert.equal(manifest.rows.ADD.projections.mcp.included, true);
  assert.equal(manifest.rows.OWNER_ONLY.projections.mcp.reason, 'planner_visible=0');
  assert.equal(manifest.rows.TEST_ROW.projections.discovery.reason, 'scratch/test row');
  assert.equal(manifest.rows.DISABLED.projections.discovery.reason, 'enabled=0');
});

test('MCP row selection uses the same compiler policy as the manifest', () => {
  assert.deepEqual(projectionRows(rows, 'mcp').map((row) => row.key), ['ADD']);
});
