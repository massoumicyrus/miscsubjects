import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeNarrows } from './dispatch.js';

test('general act cannot attenuate across explicit voxel authority boundary', () => {
  assert.equal(scopeNarrows('act', 'row:VOXEL_RATIFY'), false);
  assert.equal(scopeNarrows('act', 'rows:NOW,VOXEL_EDIT'), false);
  assert.equal(scopeNarrows('act', 'pfx:VOXEL_'), false);
  assert.equal(scopeNarrows('act', 'row:VOXEL_BATCH'), true);
  assert.equal(scopeNarrows('act', 'row:NOW'), true);
});

test('already explicit parent may still attenuate within its exact authority', () => {
  assert.equal(scopeNarrows('rows:VOXEL_EDIT,VOXEL_RATIFY', 'row:VOXEL_RATIFY'), true);
  assert.equal(scopeNarrows('row:VOXEL_RATIFY', 'row:VOXEL_EDIT'), false);
});
