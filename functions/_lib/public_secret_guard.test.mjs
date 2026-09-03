import test from 'node:test';
import assert from 'node:assert/strict';

import {
  publicSecretFinding,
  publicSecretFindingAndRevoke,
  publicSecret404,
  redactPublicSecrets,
} from './public_secret_guard.js';

test('public evidence rejects bearer material but permits proof identifiers', () => {
  assert.equal(publicSecretFinding('cap_3814fd9a5a6174b5'), null);
  assert.equal(publicSecretFinding('inv_uuu7u2gcos'), null);
  assert.equal(publicSecretFinding('https://miscsubjects.com/api/dispatch?confirm=inv_uuu7u2gcos'), null);

  assert.equal(publicSecretFinding('sh.1999999999.rows:NOW,RELAY_POST_APPEND,X_POST.50.nonceNonce.abcdefghijklmnopqrstuvwxyz123456')?.class, 'signed_capability');
  assert.equal(publicSecretFinding('https://miscsubjects.com/web/run/NOW?share=abc1234')?.class, 'short_share');
  assert.equal(publicSecretFinding('must not persist share=abc1234')?.class, 'short_share');
  assert.equal(publicSecretFinding('Authorization: Bearer abcdefghijklmnopqrstuvwxyz')?.class, 'backend_credential');
  assert.equal(publicSecretFinding('macaroon=abcdefghijklmnopqrstuvwxyz')?.class, 'backend_credential');
  assert.equal(publicSecretFinding('caveat_key=abcdefghijklmnopqrstuvwxyz')?.class, 'backend_credential');
});

test('live signed capabilities are revoked when they reach public ingress', async () => {
  const token = 'sh.1999999999.rows:NOW,RELAY_POST_APPEND,X_POST.50.nonceNonce.abcdefghijklmnopqrstuvwxyz123456';
  const statements = [];
  const env = {
    LEDGER: {
      prepare(sql) {
        return {
          bind(...args) {
            statements.push({ sql, args });
            return { run: async () => ({ meta: { changes: sql.startsWith('UPDATE capabilities') ? 1 : 1 } }) };
          },
        };
      },
    },
  };
  const finding = await publicSecretFindingAndRevoke({ token }, env, { route: '/public-test' });
  assert.equal(finding.class, 'signed_capability');
  assert.equal(finding.revoked.length, 1);
  assert.ok(statements.some((entry) => entry.sql.startsWith('UPDATE capabilities')));
  assert.ok(statements.some((entry) => entry.sql.includes('INSERT INTO events')));
  assert.ok(statements.every((entry) => !JSON.stringify(entry.args).includes(token)));
});

test('redaction preserves public proof while removing private authority', () => {
  const value = redactPublicSecrets({
    proof: 'inv_uuu7u2gcos cap_3814fd9a5a6174b5',
    url: 'https://miscsubjects.com/web/run/NOW?share=abc1234',
    token: 'private-value',
  });
  assert.equal(value.proof, 'inv_uuu7u2gcos cap_3814fd9a5a6174b5');
  assert.match(value.url, /REDACTED_ACCESS_TOKEN/);
  assert.equal(value.token, '<REDACTED_CREDENTIAL>');
});

test('blocked public payload receives only a generic 404', async () => {
  const response = publicSecret404();
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'not_found' });
});
