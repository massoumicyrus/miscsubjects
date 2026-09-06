import assert from 'node:assert/strict';
import test from 'node:test';
import { sheetDescriptor, sheetRef, sheetSelfMarkdown, sheetSelfPayload } from './sheet_self.js';

const sheet = { id: 'sh_abc123', title: 'Agents', rows: 1, cols: 4, used_rows: 0, used_cols: 0, cell_count: 0, visibility: 'public', updated_at: '2026-09-06T00:00:00Z',
  col_meta: { view: { source: 'directory', columns: [{ path: 'key' }, { path: 'content' }], filters: [{ field: 'type', op: '=', value: 'agent' }], limit: 300, order: 'desc' }, pins: [{ label: 'ROUTER', ref: 'directory/ROUTER/content' }] } };

test('a sheet describes itself: ref, own links, webhook address, operations, authority, receipts', () => {
  const self = sheetSelfPayload(sheet, { origin: 'https://example.test', authority: 'public read' });
  assert.equal(self.ref, 'sheet://sh_abc123');
  assert.equal(sheetRef('x'), 'sheet://x');
  assert.equal(self.kind, 'view_sheet');
  assert.equal(self.links.human, 'https://example.test/sheet/sh_abc123');
  assert.equal(self.links.webhook, 'https://example.test/api/sheets/sh_abc123/values:append');
  assert.equal(self.links.self_markdown, 'https://example.test/api/sheets/sh_abc123/self?format=markdown');
  const ids = self.operations.map((o) => o.id);
  for (const id of ['read_self', 'read_values', 'run_view', 'write_values', 'append', 'pin_write', 'redefine', 'delete']) assert.ok(ids.includes(id), id);
  assert.equal(self.operations.find((o) => o.id === 'read_values').authority, 'public — no credential');
  assert.match(self.operations.find((o) => o.id === 'append').authority, /token minted for this sheet/);
  assert.match(self.authority.token_for_this_sheet, /mint_share=1&scope=sheet:sh_abc123/);
  assert.equal(self.pins.length, 1);
  assert.doesNotMatch(JSON.stringify(self), /sh\.\d{10}\./, 'no token is ever embedded');
});

test('a private stored grid requires authority for reads and has no view lane', () => {
  const self = sheetSelfPayload({ ...sheet, visibility: 'private', col_meta: {} }, { origin: 'https://example.test' });
  assert.equal(self.kind, 'sheet');
  assert.equal(self.view, null);
  assert.equal(self.operations.some((o) => o.id === 'run_view'), false);
  assert.match(self.operations.find((o) => o.id === 'read_values').authority, /owner authority/);
});

test('the markdown form carries the same links and operations for a model reading over the web', () => {
  const md = sheetSelfMarkdown(sheetSelfPayload(sheet, { origin: 'https://example.test', authority: 'none' }));
  assert.match(md, /^# Agents  \(`sheet:\/\/sh_abc123`\)/);
  assert.ok(md.includes('- webhook: https://example.test/api/sheets/sh_abc123/values:append'));
  assert.ok(md.includes('`append`: `POST https://example.test/api/sheets/sh_abc123/values:append`'));
  assert.ok(md.includes('## View'));
});

test('the environment-object form has the universal fields and typed relationships', () => {
  const d = sheetDescriptor(sheet, { origin: 'https://example.test' });
  assert.equal(d.schema_version, 'miscsubjects/environment-object/1');
  assert.equal(d.parent_ref, 'page://admin/sheets');
  assert.deepEqual(d.governance.direct, ['law://sheets/S01']);
  assert.deepEqual(d.relationships.map((r) => r.type + ' ' + r.target_ref), ['part_of page://admin/sheets', 'projects directory://catalog', 'recorded_by ledger://events']);
  assert.equal(d.representations.webhook, 'https://example.test/api/sheets/sh_abc123/values:append');
});
