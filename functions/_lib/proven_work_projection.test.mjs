import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProvenWorkProjection, formatProvenWorkDrop, redactProvenWorkValue } from './proven_work_projection.js';

test('the public proof projection redacts unrelated identity and credentials', () => {
  const safe = redactProvenWorkValue({
    input: '[OWNER_EMAIL] [OWNER_PHONE] /Users/owner/work',
    headers: 'x-terminal-key: secret-value Authorization: Bearer abc.def.ghi',
    hash: '836db3665a28',
  });
  const text = JSON.stringify(safe);
  assert.doesNotMatch(text, /the owner@dsco\.co|[OWNER_PHONE]|[OWNER_HANDLE]|secret-value|abc\.def\.ghi/);
  assert.match(text, /836db3665a28/);
});

test('the projection explains its boundary and supports prove-or-disprove verdicts', () => {
  const out = buildProvenWorkProjection({
    slug: 'proven-work-example-one',
    manifest: {
      work_id: 'PW-0001',
      requirements: [
        { id: 'formation', status: 'PASS' },
        { id: 'replay', status: 'PARTIAL' },
      ],
      evidence: { agent_turn_ids: [7326] },
    },
    formationRecords: [{ id: 7326, user_input: 'safe input', tools_json: '[]' }],
  });
  assert.equal(out._self.schema, 'oip/proven-work-projection/1');
  assert.equal(out.evaluation.status, 'PARTIAL');
  assert.deepEqual(out.response_contract.allowed_verdicts, [
    'SUPPORTED_BY_RECORD',
    'MISSING_EVIDENCE',
    'CONTRADICTED_BY_RECORD',
  ]);
  assert.deepEqual(out.evaluation.unresolved, ['replay']);
  assert.equal(out.formation_records[0].id, 7326);
});

test('the outgoing block wraps an existing fixed-body delegated token without storing it in the article', () => {
  const block = formatProvenWorkDrop({
    slug: 'proven-work-example-one',
    workId: 'PW-0001',
    status: 'PARTIAL',
    minted: {
      scope: 'row:WEB_FETCH',
      max_uses: 'unlimited',
      expires_at: '2026-08-10T00:00:00Z',
      fingerprint: 'cap_123',
      share_token: 'sh.example',
      invoke_url: 'https://miscsubjects.com/api/dispatch?invoke=WEB_FETCH&share=sh.example',
      explain_url: 'https://miscsubjects.com/api/dispatch?explain=1&share=sh.example',
      ledger_url: 'https://miscsubjects.com/api/invocations?actor=cap:cap_123',
    },
  });
  assert.match(block, /\[PROVEN_WORK_DROP\]/);
  assert.match(block, /token: sh\.example/);
  assert.match(block, /SUPPORTED_BY_RECORD/);
  assert.match(block, /fixed_to: GET https:\/\/miscsubjects\.com\/api\/proven-work\/proven-work-example-one/);
  assert.match(block, /receipt_rule: each inspection returns its own proof\.public_receipt/);
  assert.doesNotMatch(block, /receipts: https:\/\/miscsubjects\.com\/api\/invocations/);
});
