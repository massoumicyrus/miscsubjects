import test from 'node:test';
import assert from 'node:assert/strict';
import { mcpToolsFromRows, normalizeInputSchema } from './mcp.js';

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
