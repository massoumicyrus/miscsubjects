import assert from 'node:assert/strict';
import test from 'node:test';

import { redactText } from './redact-v2-secrets.mjs';

test('redacts known and shaped credentials without retaining their bytes', () => {
  const known = 'known-current-secret-1234567890';
  const shaped = `sk-ant-api03-${'B'.repeat(40)}`;
  const result = redactText(`a=${known}\nb=${shaped}\n`, {
    secretValues: [{ name: 'TERMINAL_KEY', value: known }],
  });
  assert.equal(result.text.includes(known), false);
  assert.equal(result.text.includes(shaped), false);
  assert.match(result.text, /\[REDACTED:known_secret:TERMINAL_KEY\]/);
  assert.match(result.text, /\[REDACTED:anthropic_api_key\]/);
  assert.equal(result.replacements, 2);
});

test('leaves placeholders and hashes unchanged', () => {
  const input = `TOKEN=<TOKEN>\nsha256=${'a'.repeat(64)}\n`;
  assert.deepEqual(redactText(input), { text: input, replacements: 0, rules: {} });
});
