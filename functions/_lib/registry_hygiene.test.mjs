import assert from 'node:assert/strict';
import test from 'node:test';

import { registryHygieneViolation } from './registry_hygiene.js';

test('new malicious or unusable catalogue rows fail closed', () => {
  assert.equal(
    registryHygieneViolation({ content: '', auth: 'required', sensitive: 0 }).code,
    'missing_description',
  );
  assert.equal(
    registryHygieneViolation({ content: '# WHAT: Run shell.', auth: 'required', sensitive: 1 }).code,
    'high_risk_missing_schema',
  );
  assert.equal(
    registryHygieneViolation({ content: '# WHAT: Public read.', auth: '', sensitive: 0 }).code,
    'keyless_missing_examples',
  );
});

test('documented authenticated rows pass the shared create/update gate', () => {
  assert.equal(
    registryHygieneViolation({
      content: '# WHAT: Add two numbers.',
      auth: 'required',
      sensitive: 0,
      input_schema: '{"type":"object"}',
    }),
    null,
  );
});
