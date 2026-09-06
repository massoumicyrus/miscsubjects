import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { parsePath, normalizeView, instantiateTemplate, parseRef, runView, TEMPLATES } from './sheet_views.js';

test('a column path is a source column with an optional JSON path', () => {
  assert.deepEqual(parsePath('ts'), { col: 'ts', json: null });
  assert.deepEqual(parsePath('request_json.body.messages[0].content'), { col: 'request_json', json: '$.body.messages[0].content' });
  assert.equal(parsePath('drop table'), null);
});

test('normalizeView keeps only real columns and gives payload columns the json format', () => {
  const v = normalizeView({ source: 'ledger', columns: ['ts', 'request_json', 'nope', { path: 'response_json.usage.total_tokens', format: 'number' }] });
  assert.deepEqual(v.columns.map((c) => c.path), ['ts', 'request_json', 'response_json.usage.total_tokens']);
  assert.equal(v.columns[0].format, 'time');
  assert.equal(v.columns[1].format, 'json');
  assert.equal(v.columns[2].format, 'number');
  assert.equal(v.order, 'desc');
});

test('every template instantiates and fills its parameter', () => {
  for (const t of TEMPLATES) {
    const inst = instantiateTemplate(t.id, t.param ? 'X_PARAM' : undefined);
    assert.ok(inst && inst.view.columns.length, t.id);
    if (t.param) assert.ok(JSON.stringify(inst.view).includes('X_PARAM'), t.id + ' fills {{' + t.param.name + '}}');
  }
});

test('pin refs parse to directory fields, sheet cells and settings', () => {
  assert.deepEqual(parseRef('directory/ROUTER/content'), { kind: 'directory', key: 'ROUTER', field: 'content' });
  assert.deepEqual(parseRef('sheet/sh_89pbg3gd/AA7'), { kind: 'sheet', sheet_id: 'sh_89pbg3gd', cell: 'AA7' });
  assert.deepEqual(parseRef('settings/grok_temperature'), { kind: 'settings', key: 'grok_temperature' });
  assert.equal(parseRef('directory/ROUTER/content; DROP'), null);
});

// A D1-shaped adapter over an in-memory SQLite so runView is judged by the rows it returns from
// real SQL, not by the SQL text it composed.
function d1(db) {
  return {
    prepare(sql) {
      const stmt = db.prepare(sql);
      let binds = [];
      return {
        bind(...b) { binds = b; return this; },
        async all() { return { results: stmt.all(...binds) }; },
        async first() { return stmt.get(...binds) || null; },
        async run() { const r = stmt.run(...binds); return { success: true, meta: { changes: r.changes } }; },
      };
    },
  };
}

test('a directory view projects environment descriptor fields by JSON path', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE directory (key TEXT PRIMARY KEY, type TEXT, updated_at TEXT, object_kind TEXT, descriptor_json TEXT, descriptor_rev INTEGER, descriptor_hash TEXT);
    INSERT INTO directory VALUES ('PAGE_ADMIN_SHEETS','http','2026-09-05T00:00:00Z','page',
      json_object('ref','page://admin/sheets','governance',json_object('direct',json_array('law://sheets/S01')),
        'comparables',json_array(json_object('target_ref','external://google/sheets','dimensions',json_array('programmability')))),
      2,'sha256:abc');
    INSERT INTO directory VALUES ('ADD','fn','2026-09-04T00:00:00Z','capability',NULL,1,NULL);`);
  const view = normalizeView({ source: 'directory', columns: [
    'key', 'descriptor_json.ref', 'descriptor_json.governance.direct', 'descriptor_json.comparables[0].dimensions', 'descriptor_rev', 'descriptor_hash',
  ], filters: [{ field: 'object_kind', op: '=', value: 'page' }] });
  assert.deepEqual(view.columns.map((c) => c.path), ['key', 'descriptor_json.ref', 'descriptor_json.governance.direct', 'descriptor_json.comparables[0].dimensions', 'descriptor_rev', 'descriptor_hash']);
  const out = await runView({ DB: d1(db) }, view);
  assert.equal(out.ok, true, out.detail);
  assert.equal(out.rows.length, 1);
  assert.deepEqual(out.rows[0], ['PAGE_ADMIN_SHEETS', 'page://admin/sheets', '["law://sheets/S01"]', '["programmability"]', '2', 'sha256:abc']);
  assert.equal(out.meta[0].href, '/admin/directory/PAGE_ADMIN_SHEETS');
});
