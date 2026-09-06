import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
test('0376 adds invocation_curl beside invocation', () => {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE directory (key TEXT PRIMARY KEY, invocation TEXT);");
  db.exec(readFileSync(new URL('./0376_directory_invocation_curl.sql', import.meta.url), 'utf8'));
  assert.ok(db.prepare('PRAGMA table_info(directory)').all().map((r) => r.name).includes('invocation_curl'));
});
