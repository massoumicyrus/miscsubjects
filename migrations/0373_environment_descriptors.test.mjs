import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

test('0373 upgrades directory rows into canonical environment descriptors', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE directory (
      key TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('fn','http','agent','flow')),
      target TEXT, auth TEXT, content TEXT, updated_at TEXT NOT NULL,
      category TEXT, allowed_categories TEXT, seq INTEGER,
      enabled INTEGER DEFAULT 1, planner_visible INTEGER DEFAULT 1,
      planner_rank INTEGER DEFAULT 100, input_schema TEXT, examples TEXT,
      includes TEXT, sensitive INTEGER DEFAULT 0, runner TEXT,
      created_at TEXT, price_usd REAL, meter_unit TEXT
    );
    CREATE TABLE directory_versions (
      key TEXT NOT NULL, version INTEGER NOT NULL, content TEXT NOT NULL,
      content_hash TEXT NOT NULL, actor TEXT, ts TEXT NOT NULL,
      PRIMARY KEY (key, version)
    );
  `);
  db.exec(readFileSync(new URL('./0373_environment_descriptors.sql', import.meta.url), 'utf8'));

  const columns = db.prepare('PRAGMA table_info(directory)').all().map((row) => row.name);
  assert.equal(columns.includes('object_kind'), true);
  assert.equal(columns.includes('descriptor_json'), true);
  assert.equal(columns.includes('descriptor_rev'), true);
  assert.equal(columns.includes('descriptor_hash'), true);

  const refs = db.prepare("SELECT json_extract(descriptor_json,'$.ref') ref FROM directory WHERE object_kind IN ('environment','page','law','external_system') ORDER BY ref").all().map((row) => row.ref);
  assert.equal(refs.includes('environment://miscsubjects'), true);
  assert.equal(refs.includes('page://admin/sheets'), true);
  assert.equal(refs.includes('law://design/D08'), true);
  assert.equal(refs.includes('external://google/sheets'), true);

  // The two primitives the environment is made of are themselves registered objects with
  // declared operations: the directory (nouns) and the ledger (verbs).
  const primitives = Object.fromEntries(db.prepare("SELECT json_extract(descriptor_json,'$.ref') ref, descriptor_json FROM directory WHERE object_kind IN ('store','ledger')").all().map((row) => [row.ref, JSON.parse(row.descriptor_json)]));
  assert.deepEqual(Object.keys(primitives).sort(), ['directory://catalog', 'ledger://events']);
  assert.deepEqual(primitives['directory://catalog'].operations.map((op) => op.id), ['list', 'read', 'create', 'edit', 'replace', 'delete', 'invoke', 'project']);
  assert.equal(primitives['directory://catalog'].operations.find((op) => op.id === 'edit').concurrency, 'expected_descriptor_rev');
  assert.deepEqual(primitives['ledger://events'].operations.map((op) => op.id), ['list', 'read', 'turn', 'changes', 'project']);
  const sheetOps = JSON.parse(db.prepare("SELECT descriptor_json FROM directory WHERE key='PAGE_ADMIN_SHEETS'").get().descriptor_json).operations.map((op) => op.id);
  for (const id of ['create_view', 'run_view', 'pin_write', 'append', 'redefine_view', 'delete']) assert.equal(sheetOps.includes(id), true, id);

  const sheets = db.prepare("SELECT descriptor_json FROM directory WHERE key='PAGE_ADMIN_SHEETS'").get();
  const descriptor = JSON.parse(sheets.descriptor_json);
  assert.equal(descriptor.parent_ref, 'page://admin');
  assert.deepEqual(descriptor.governance.direct, ['law://sheets/S01']);
  assert.equal(descriptor.comparables[0].dimensions.includes('programmability'), true);
  assert.equal(descriptor.comparables[0].differences.length > 0, true);
});
