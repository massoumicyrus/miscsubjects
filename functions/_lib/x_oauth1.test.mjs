import assert from 'node:assert/strict';
import test from 'node:test';
import * as oauth from './x_oauth1.js';

test('a 401 with a live read credential names rejected write authority and the repair', () => {
  assert.equal(typeof oauth.xWriteFailureMessage, 'function');
  assert.equal(
    oauth.xWriteFailureMessage(401, '{"title":"Unauthorized"}', 200),
    'ERR:x_post:write_authority_rejected: X read authentication is live (GET /2/users/me = 200), but POST /2/tweets returned 401. Restore Read and write permission for the X app or replace the deployed access-token pair; then verify X_WHOAMI and retry once.'
  );
});

test('a 401 with a rejected read probe names an invalid credential pair', () => {
  assert.equal(typeof oauth.xWriteFailureMessage, 'function');
  assert.equal(
    oauth.xWriteFailureMessage(401, '{"title":"Unauthorized"}', 401),
    'ERR:x_post:credential_pair_invalid: X rejected both POST /2/tweets and GET /2/users/me. Replace X_ACCESS_TOKEN and X_ACCESS_SECRET in the deployed runtime, verify X_WHOAMI returns 200, then retry once.'
  );
});
