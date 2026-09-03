import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuditTapGoDropMarkdown } from './unified_handoff.js';

const cap = { short_code: 'AUDIT01', share_token: 'sh.AUDIT.edit.0.TEST', fingerprint: 'cap_audit_test', expires_at: '2099-01-01T00:00:00Z', max_uses: 100 };

test('build audit copy is a compact graph assignment rather than a repeated verdict', () => {
  const drop = buildAuditTapGoDropMarkdown('https://miscsubjects.com', cap);
  assert.match(drop, /^https:\/\/miscsubjects\.com\/a\/opos-formal-audit\n/);
  assert.match(drop, /# OPOS NORMANDY COMPARISON SLOT/);
  assert.match(drop, /Full capability: sh\.AUDIT\.edit\.0\.TEST/);
  for (const route of ['api/build-audit', 'api/build-landscape', 'opos-formal-audit\/claims', 'opos-formal-audit\/sources', 'opos-formal-audit\/discourse', 'voxel-batch']) assert.match(drop, new RegExp(route));
  assert.match(drop, /The global-rank boundary is already stored/i);
  assert.match(drop, /Repeating that boundary/i);
  assert.match(drop, /## WORK THAT STARTS FROM THIS DROP/);
  assert.match(drop, /capability effect/i);
  assert.match(drop, /failure effect/i);
  assert.match(drop, /value effect/i);
  assert.doesNotMatch(drop, /living comparison|frontier|unmeasured zone|make the ruler|substrate|agentic-native/i);
  assert.match(drop, /api\/articles\/constitution\?format=markdown/);
  assert.doesNotMatch(drop, /## AUDIT TASK|## RESPONSE SHAPE|complete result|Lead with|Finish with|Evaluate OPOS/i);
  assert.ok(drop.length < 4500, `compact graph access record: ${drop.length}`);
});

test('build audit copy reserves a Normandy slot and makes repeat-only output incomplete', () => {
  const text = buildAuditTapGoDropMarkdown('https://miscsubjects.com', {
    short_code: 'AUDIT01', share_token: 'sh.test', fingerprint: 'cap_test', expires_at: '2099', max_uses: 100,
  }, {
    assignment_id: 'norm-1', axis: 'outside_contribution', required_slot: 'outside_evidence', snapshot_hash: 'abc',
    contract: 'https://miscsubjects.com/api/normandy?assignment=norm-1',
    target: { slug: 'field-openclaw', name: 'OpenClaw', article: 'https://miscsubjects.com/a/field-openclaw', machine: 'https://miscsubjects.com/api/articles/field-openclaw' },
    existing_axis_cells: { claims: [], sources: [] },
  });
  assert.match(text, /Assignment: norm-1/);
  assert.match(text, /Empty slot: outside_evidence/);
  assert.match(text, /Repeating that boundary/);
  assert.match(text, /exact owner-facing answer is stored as an article contribution/i);
  assert.match(text, /near-duplicate answers and claims are rejected/i);
  assert.match(text, /assignment status completed/);
});
