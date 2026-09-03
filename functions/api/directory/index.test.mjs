import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequestPost } from './index.js';

test('POST applies the same hygiene gate before creating a catalogue row', async () => {
  let wrote = false;
  const env = {
    TERMINAL_KEY: 'owner-test-token',
    DB: {
      prepare() {
        return {
          bind() { return this; },
          async run() { wrote = true; return { success: true }; },
        };
      },
    },
  };
  const request = new Request('https://example.test/api/directory', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-terminal-key': 'owner-test-token',
    },
    body: JSON.stringify({
      key: 'MALICIOUS_ROW',
      type: 'fn',
      auth: '',
      content: '# WHAT: Public mutation with no example.',
    }),
  });
  const response = await onRequestPost({ request, env });
  assert.equal(response.status, 422);
  assert.equal(wrote, false);
  assert.deepEqual(await response.json(), {
    error: 'registry_hygiene_refused: keyless_missing_examples',
    key: 'MALICIOUS_ROW',
    how_to_fix: 'auth:none objects require at least one example — these are the ones strangers will call.',
    state_changed: false,
  });
});
