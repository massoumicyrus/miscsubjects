import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuditDropMarkdown, buildAuditMarkdown, buildAuditRecord } from './build_audit.js';

function binding() {
  return { prepare() { return { async first() { return { total: 1 }; }, async all() { return { results: [] }; } }; } };
}

test('build truth record separates four columns and uses the article graph', async () => {
  const record = await buildAuditRecord({ DB: binding(), LEDGER: binding() }, 'https://miscsubjects.com/api/build-audit');
  assert.equal(record.schema, 'miscsubjects-build-truth-record/2.0');
  assert.deepEqual(record.truth_columns.map(x => x.id), ['field_claim', 'field_evidence', 'build_claim', 'build_evidence']);
  assert.ok(record.truth_board.length >= 8);
  assert.ok(record.truth_board.every(row => row.field_claim && row.field_evidence && row.build_claim && row.build_evidence));
  assert.ok(record.truth_board.some(row => row.axis === 'runtime_and_durability'));
  assert.ok(!record.truth_board.some(row => row.axis === 'durable_work'));
  assert.match(record.subject.claim_voxels, /opos-formal-audit\/claims/);
  assert.match(record.subject.discourse, /opos-formal-audit\/discourse/);
  assert.match(record.subject.landscape_table, /build-landscape/);
  assert.match(record.current_result.primary_failure, /Repair/);
  assert.match(record.current_result.benchmark_boundary, /outcome superiority unknown/i);
  assert.match(record.material_identity.smallest_durable_unit, /addressable object/i);
});

test('markdown is evidence record rather than model-directed prompt', async () => {
  const record = await buildAuditRecord({ DB: binding(), LEDGER: binding() }, 'https://miscsubjects.com/api/build-audit');
  const md = buildAuditMarkdown(record);
  for (const text of ['FIELD CLAIM', 'FIELD EVIDENCE', 'BUILD CLAIM', 'BUILD EVIDENCE', 'Voxel graph and outside-model record']) assert.match(md, new RegExp(text));
  assert.doesNotMatch(md, /AUDIT TASK|RESPONSE SHAPE|Required output|Lead with|Finish with|Evaluate OPOS|\byou must\b/i);
  assert.match(md, /voxel-challenge/);
  assert.equal(buildAuditDropMarkdown(record), md);
});
