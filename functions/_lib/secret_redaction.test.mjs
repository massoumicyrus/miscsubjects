import assert from 'node:assert/strict';
import test from 'node:test';

import { redactMirrorPreview } from './secret_redaction.js';

test('ledger mirror previews replace configured and shaped credentials', () => {
  const env = {
    GITHUB_TOKEN: ['github', 'pat', 'current', '12345678901234567890'].join('_'),
    MCP_TOKEN: 'mcp-current-secret-1234567890',
  };
  const input = `token=${env.GITHUB_TOKEN} mcp=${env.MCP_TOKEN} key=sk-ant-api03-${'A'.repeat(40)}`;
  const output = redactMirrorPreview(input, env);
  assert.equal(output.includes(env.GITHUB_TOKEN), false);
  assert.equal(output.includes(env.MCP_TOKEN), false);
  assert.equal(output.includes('sk-ant-api03-'), false);
  assert.match(output, /\[REDACTED:GITHUB_TOKEN\]/);
  assert.match(output, /\[REDACTED:MCP_TOKEN\]/);
  assert.match(output, /\[REDACTED:credential\]/);
});

test('ordinary receipt prose is unchanged', () => {
  const input = 'PROVEN_MATERIAL_RESULT: 12 rows returned in 31 ms';
  assert.equal(redactMirrorPreview(input, {}), input);
});
