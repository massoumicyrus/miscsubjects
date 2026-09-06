import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveComparables, validateComparable } from './environment_comparables.js';

const edge = {
  target_ref: 'external://google/sheets',
  dimensions: ['arbitrary grid state', 'programmability', 'discoverability'],
  basis: 'Both expose a mutable grid and stable operations.',
  similarities: ['cells retain arbitrary values', 'operations are documented'],
  differences: ['this sheet can project ledger objects by canonical ref'],
  sources: ['https://developers.google.com/apps-script/guides/sheets'],
  status: 'verified',
  verified_at: '2026-09-05',
};

test('validateComparable requires dimensions, basis, similarities, differences, and evidence status', () => {
  assert.equal(validateComparable(edge).ok, true);
  const bad = validateComparable({ target_ref: 'external://google/sheets', status: 'verified' });
  assert.equal(bad.ok, false);
  assert.match(bad.errors.join('\n'), /dimensions/);
  assert.match(bad.errors.join('\n'), /differences/);
  assert.match(bad.errors.join('\n'), /sources/);
});

test('resolveComparables explains similarities and material differences on named dimensions', () => {
  const got = resolveComparables([
    { ref: 'page://admin/sheets', kind: 'page', comparables: [edge] },
    { ref: 'external://google/sheets', kind: 'external_system', title: 'Google Sheets' },
  ], 'page://admin/sheets');
  assert.equal(got.comparables.length, 1);
  assert.equal(got.comparables[0].target.title, 'Google Sheets');
  assert.deepEqual(got.comparables[0].dimensions, edge.dimensions);
  assert.deepEqual(got.comparables[0].differences, edge.differences);
  assert.equal(got.unresolved.length, 0);
});

test('resolveComparables filters by dimension and does not inherit an undeclared parent comparison', () => {
  const got = resolveComparables([
    { ref: 'page://admin', kind: 'page', comparables: [edge] },
    { ref: 'page://admin/sheets', kind: 'page', parent_ref: 'page://admin' },
    { ref: 'external://google/sheets', kind: 'external_system', title: 'Google Sheets' },
  ], 'page://admin/sheets', { dimension: 'programmability' });
  assert.deepEqual(got.comparables, []);
});

test('resolveComparables inherits only dimensions explicitly declared inheritable', () => {
  const got = resolveComparables([
    {
      ref: 'page://admin', kind: 'page',
      comparables: [{ ...edge, inheritable_dimensions: ['discoverability'] }],
    },
    { ref: 'page://admin/sheets', kind: 'page', parent_ref: 'page://admin' },
    { ref: 'external://google/sheets', kind: 'external_system', title: 'Google Sheets' },
  ], 'page://admin/sheets', { dimension: 'discoverability' });
  assert.equal(got.comparables.length, 1);
  assert.equal(got.comparables[0].inherited_from, 'page://admin');
});
