import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

test('0375 adds invocation, last_status, last_response, test_state (untested by default) and tested_at', () => {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE directory (key TEXT PRIMARY KEY, type TEXT, content TEXT, updated_at TEXT); INSERT INTO directory VALUES ('ADD','fn','# WHAT: add','2026-09-06T00:00:00Z');");
  db.exec(readFileSync(new URL('./0375_directory_invocation.sql', import.meta.url), 'utf8'));
  const cols = db.prepare('PRAGMA table_info(directory)').all().map((r) => r.name);
  for (const c of ['invocation', 'last_status', 'last_response', 'test_state', 'tested_at']) assert.ok(cols.includes(c), c);
  assert.equal(db.prepare("SELECT test_state FROM directory WHERE key='ADD'").get().test_state, '🟡 untested');
});
