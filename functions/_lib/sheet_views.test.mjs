import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePath, normalizeView, instantiateTemplate, parseRef, TEMPLATES } from './sheet_views.js';

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
