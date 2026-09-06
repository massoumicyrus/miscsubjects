import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveEffectiveGovernance } from './governance_resolver.js';

const catalog = [
  {
    ref: 'environment://miscsubjects', kind: 'environment',
    governance: { direct: ['law://work/W01'] },
  },
  {
    ref: 'page://admin', kind: 'page', parent_ref: 'environment://miscsubjects',
    governance: { direct: ['law://design/D08'] },
  },
  {
    ref: 'page://admin/sheets', kind: 'page', parent_ref: 'page://admin',
    governance: { direct: ['law://sheets/S01'] },
  },
  { ref: 'law://work/W01', kind: 'law', revision: 4, hash: 'work-4', title: 'Work exists as objects' },
  { ref: 'law://design/D08', kind: 'law', revision: 7, hash: 'design-7', title: 'Location before options' },
  { ref: 'law://sheets/S01', kind: 'law', revision: 2, hash: 'sheets-2', title: 'Cells remain arbitrary values' },
];

test('resolveEffectiveGovernance separates direct and inherited rules and explains every path', () => {
  const got = resolveEffectiveGovernance(catalog, 'page://admin/sheets');
  assert.deepEqual(got.direct.map((r) => r.rule_ref), ['law://sheets/S01']);
  assert.deepEqual(got.inherited.map((r) => r.rule_ref), ['law://design/D08', 'law://work/W01']);
  assert.deepEqual(got.effective.map((r) => r.rule_ref), [
    'law://sheets/S01', 'law://design/D08', 'law://work/W01',
  ]);
  assert.deepEqual(got.effective[1].applies_because, [
    'page://admin/sheets part_of page://admin',
    'page://admin governed_by law://design/D08',
  ]);
  assert.equal(got.effective[1].rule_revision, 7);
  assert.equal(got.effective[1].rule_hash, 'design-7');
  assert.deepEqual(got.unresolved, []);
});

test('resolveEffectiveGovernance reports missing rules instead of silently dropping them', () => {
  const got = resolveEffectiveGovernance([
    { ref: 'page://x', kind: 'page', governance: { direct: ['law://missing/M1'] } },
  ], 'page://x');
  assert.deepEqual(got.unresolved, [{ ref: 'law://missing/M1', reason: 'rule_not_registered' }]);
  assert.equal(got.effective.length, 0);
});

test('resolveEffectiveGovernance applies explicit scoped overrides without erasing history', () => {
  const got = resolveEffectiveGovernance(catalog.concat({
    ref: 'page://admin/sheets/private', kind: 'page', parent_ref: 'page://admin/sheets',
    governance: {
      direct: [],
      overrides: [{ rule_ref: 'law://design/D08', reason: 'private machine-only route' }],
    },
  }), 'page://admin/sheets/private');
  assert.equal(got.effective.some((r) => r.rule_ref === 'law://design/D08'), false);
  assert.deepEqual(got.overridden, [{
    rule_ref: 'law://design/D08',
    reason: 'private machine-only route',
    declared_by: 'page://admin/sheets/private',
  }]);
});

test('resolveEffectiveGovernance reports ancestry cycles', () => {
  const got = resolveEffectiveGovernance([
    { ref: 'page://a', kind: 'page', parent_ref: 'page://b' },
    { ref: 'page://b', kind: 'page', parent_ref: 'page://a' },
  ], 'page://a');
  assert.equal(got.conflicts[0].type, 'governance_cycle');
});
