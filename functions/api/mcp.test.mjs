import test from 'node:test';
import assert from 'node:assert/strict';
import { MANUAL_RESOURCE_URI, mcpResourcesFromCatalog, mcpToolsFromRows, normalizeInputSchema, readMcpResource } from './mcp.js';
import { descriptorFromDirectoryRow } from '../_lib/environment_descriptor.js';

test('MCP schemas remain valid for strict Moonshot/Kimi clients', () => {
  const out = normalizeInputSchema({
    type: 'object',
    required: ['missing', 'nested'],
    properties: {
      nested: { description: 'legacy property without a type' },
      choice: { anyOf: [{ type: 'null' }, { type: 'string', description: 'value' }] },
    },
    additionalProperties: false,
  });
  assert.equal(out.type, 'object');
  assert.deepEqual(out.properties.missing, { type: 'string' });
  assert.equal(out.properties.nested.type, 'string');
  assert.equal(out.properties.choice.type, 'string');
  assert.equal('anyOf' in out.properties.choice, false);
  assert.equal('additionalProperties' in out, false);
});

test('array and scalar legacy schemas become object-root tool schemas', () => {
  const array = normalizeInputSchema({ type: 'array', items: [{ description: 'first' }] });
  assert.equal(array.type, 'object');
  assert.equal(array.properties.arg1.type, 'string');
  const scalar = normalizeInputSchema('legacy');
  assert.equal(scalar.type, 'object');
  assert.equal(scalar.properties.body.type, 'string');
});

test('MCP tools are selected by the canonical projection policy', () => {
  const tools = mcpToolsFromRows([
    { key: 'ADD', type: 'fn', category: 'math', enabled: 1, planner_visible: 1, content: '# WHAT: Add.' },
    { key: 'OWNER_ONLY', type: 'fn', enabled: 1, planner_visible: 0, content: '# WHAT: Private.' },
    { key: 'TEST_ROW', type: 'fn', enabled: 1, planner_visible: 1, content: '# WHAT: Scratch.' },
  ]);
  assert.deepEqual(tools.map((tool) => tool.name), ['ADD']);
});

const catalog = [
  { key: 'PAGE_ADMIN', object_kind: 'page', descriptor_rev: 1, descriptor_hash: 'sha256:a', descriptor_json: JSON.stringify({ ref: 'page://admin', title: 'Admin', governance: { direct: ['law://design/D08'] } }) },
  { key: 'PAGE_ADMIN_SHEETS', object_kind: 'page', descriptor_rev: 2, descriptor_hash: 'sha256:b', descriptor_json: JSON.stringify({
    ref: 'page://admin/sheets', title: 'Sheets', summary: 'Grid over directory and ledger.', parent_ref: 'page://admin', governance: { direct: ['law://sheets/S01'] },
    comparables: [{ target_ref: 'external://google/sheets', dimensions: ['programmability'], basis: 'grid grammar', similarities: ['cells'], differences: ['refs'], sources: ['https://developers.google.com/apps-script/guides/sheets'], status: 'verified' }],
  }) },
  { key: 'LAW_DESIGN_D08', object_kind: 'law', descriptor_rev: 3, descriptor_hash: 'sha256:c', descriptor_json: JSON.stringify({ ref: 'law://design/D08', title: 'Location before options' }) },
  { key: 'LAW_SHEETS_S01', object_kind: 'law', descriptor_rev: 1, descriptor_hash: 'sha256:d', descriptor_json: JSON.stringify({ ref: 'law://sheets/S01', title: 'Cells remain arbitrary' }) },
].map(descriptorFromDirectoryRow);

test('MCP resources are the environment descriptors plus the manual, compiled from the catalog', () => {
  const resources = mcpResourcesFromCatalog(catalog);
  assert.equal(resources[0].uri, MANUAL_RESOURCE_URI);
  assert.equal(resources[0].mimeType, 'text/markdown');
  const sheets = resources.find((r) => r.uri === 'page://admin/sheets');
  assert.equal(sheets.name, 'Sheets');
  assert.match(sheets.description, /rev 2 sha256:b/);
  assert.equal(resources.length, 1 + catalog.length);
});

test('reading an MCP resource returns the object with resolved governance and comparables', () => {
  const read = readMcpResource(catalog, 'page://admin/sheets');
  const body = JSON.parse(read.contents[0].text);
  assert.equal(body.ref, 'page://admin/sheets');
  assert.deepEqual(body.governance.effective.map((r) => r.rule_ref), ['law://sheets/S01', 'law://design/D08']);
  assert.deepEqual(body.governance.inherited[0].applies_because, ['page://admin/sheets part_of page://admin', 'page://admin governed_by law://design/D08']);
  assert.deepEqual(body.comparables.comparables[0].dimensions, ['programmability']);
  assert.match(readMcpResource(catalog, MANUAL_RESOURCE_URI).contents[0].text, /## Sources of truth/);
  assert.equal(readMcpResource(catalog, 'page://nowhere'), null);
});
