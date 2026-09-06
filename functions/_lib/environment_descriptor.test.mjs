import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseObjectRef,
  normalizeEnvironmentDescriptor,
  validateEnvironmentDescriptor,
  descriptorFromDirectoryRow,
} from './environment_descriptor.js';

test('parseObjectRef accepts canonical object references and rejects embedded credentials', () => {
  assert.deepEqual(parseObjectRef('page://admin/sheets'), {
    ref: 'page://admin/sheets',
    scheme: 'page',
    address: 'admin/sheets',
  });
  assert.equal(parseObjectRef('https://token@example.com/private'), null);
  assert.equal(parseObjectRef('page://'), null);
});

test('descriptorFromDirectoryRow preserves one canonical identity and exact operations', () => {
  const row = {
    key: 'PAGE_ADMIN_SHEETS',
    type: 'http',
    target: 'GET https://miscsubjects.com/admin/sheets',
    content: '# WHAT: Mutable workbook surface.',
    category: 'page',
    enabled: 1,
    object_kind: 'page',
    descriptor_rev: 3,
    descriptor_hash: 'hash-3',
    descriptor_json: JSON.stringify({
      ref: 'page://admin/sheets',
      title: 'Sheets',
      parent_ref: 'page://admin',
      operations: [{ id: 'read', method: 'GET', href: '/admin/sheets' }],
      governance: { direct: ['law://design/D08'] },
    }),
  };
  const got = descriptorFromDirectoryRow(row);
  assert.equal(got.ref, 'page://admin/sheets');
  assert.equal(got.kind, 'page');
  assert.equal(got.revision, 3);
  assert.equal(got.hash, 'hash-3');
  assert.deepEqual(got.operations, [{ id: 'read', method: 'GET', href: '/admin/sheets' }]);
  assert.equal(got.directory_key, 'PAGE_ADMIN_SHEETS');
});

test('normalizeEnvironmentDescriptor distinguishes unknown from missing registration', () => {
  const got = normalizeEnvironmentDescriptor({ ref: 'source://functions/x.js', kind: 'source' });
  assert.equal(got.schema.status, 'unknown');
  assert.equal(got.governance.status, 'unknown');
  assert.equal(got.comparables.status, 'unknown');
  assert.deepEqual(got.operations, []);
});

test('validateEnvironmentDescriptor refuses vague comparable relationships', () => {
  const result = validateEnvironmentDescriptor({
    ref: 'page://admin/sheets',
    kind: 'page',
    relationships: [{ type: 'related_to', target_ref: 'external://google/sheets' }],
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /related_to/);
});
