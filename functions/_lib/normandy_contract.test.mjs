import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completeNormandyAssignment,
  findClaimDuplicate,
  normandyMarkdown,
  readNormandyAssignment,
  reserveNormandyAssignment,
} from './normandy_contract.js';

function mockEnv() {
  const assignments = [];
  const articles = [
    { slug: 'field-openclaw', title: 'OpenClaw', updated_at: '2026-07-21T00:00:00Z', meta: JSON.stringify({ claims: [], sources: [], source_head: 'genesis' }) },
    { slug: 'opos-formal-audit', title: 'OPOS', updated_at: '2026-07-21T00:00:00Z', meta: JSON.stringify({ claims: [], sources: [], source_head: 'genesis' }) },
  ];
  return {
    assignments,
    DB: {
      prepare(sql) {
        let values = [];
        return {
          bind(...args) { values = args; return this; },
          async all() {
            if (sql.includes('FROM articles')) return { results: articles };
            if (sql.includes('SELECT slot_key FROM normandy_assignments')) return { results: assignments.filter(row => row.status === 'open').map(row => ({ slot_key: row.slot_key })) };
            return { results: [] };
          },
          async first() {
            if (sql.includes('FROM normandy_assignments WHERE id=')) return assignments.find(row => row.id === values[0]) || null;
            return null;
          },
          async run() {
            if (sql.startsWith('INSERT INTO normandy_assignments')) {
              assignments.push({ id: values[0], slot_key: values[1], target_slug: values[2], target_name: values[3], axis: values[4], required_slot: values[5], status: 'open', capability_fingerprint: values[6], snapshot_hash: values[7], snapshot_json: values[8], result_json: null });
            }
            if (sql.startsWith('UPDATE normandy_assignments')) {
              const row = assignments.find(item => item.id === values[1]);
              if (row) { row.status = 'completed'; row.result_json = values[0]; }
            }
            return { success: true };
          },
        };
      },
    },
  };
}

test('each Normandy mint reserves a different empty target-axis slot', async () => {
  const env = mockEnv();
  const one = await reserveNormandyAssignment(env, 'https://miscsubjects.com', 'cap-one');
  const two = await reserveNormandyAssignment(env, 'https://miscsubjects.com', 'cap-two');
  assert.notEqual(one.slot_key, two.slot_key);
  assert.equal(one.target.slug, 'field-openclaw');
  assert.equal(one.required_slot, 'outside_evidence');
  assert.match(normandyMarkdown(one), /Repeating it does not complete this assignment/);
});

test('Normandy assignment stays addressable and records new graph ids on completion', async () => {
  const env = mockEnv();
  const assignment = await reserveNormandyAssignment(env, 'https://miscsubjects.com', 'cap-one');
  const complete = await completeNormandyAssignment(env, assignment.assignment_id, 'cap-one', { object_ids: ['s-new', 'c-new'] });
  assert.equal(complete.status, 'completed');
  const read = await readNormandyAssignment(env, 'https://miscsubjects.com', assignment.assignment_id);
  assert.equal(read.status, 'completed');
  assert.deepEqual(read.result.object_ids, ['s-new', 'c-new']);
});

test('exact and near-repeat claims resolve to the stored claim', () => {
  const claims = [{ id: 'c1', text: 'Invisible private systems prevent a global rank.' }];
  assert.equal(findClaimDuplicate(claims, 'Invisible private systems prevent a global rank.').claim.id, 'c1');
  assert.equal(findClaimDuplicate(claims, 'Private invisible systems prevent any global rank.').claim.id, 'c1');
  assert.equal(findClaimDuplicate(claims, 'OpenClaw stores sessions in SQLite.'), null);
});
