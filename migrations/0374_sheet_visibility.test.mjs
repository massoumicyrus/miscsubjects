import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

test('0374 gives every sheet a visibility that defaults to private', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('./0365_user_sheets.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('./0371_sheet_sort_order.sql', import.meta.url), 'utf8'));
  db.exec("INSERT INTO user_sheets (id,title,created_at,updated_at) VALUES ('sh_a','A','2026-09-06T00:00:00Z','2026-09-06T00:00:00Z')");
  db.exec(readFileSync(new URL('./0374_sheet_visibility.sql', import.meta.url), 'utf8'));
  assert.equal(db.prepare("SELECT visibility FROM user_sheets WHERE id='sh_a'").get().visibility, 'private');
  db.exec("UPDATE user_sheets SET visibility='public' WHERE id='sh_a'");
  assert.equal(db.prepare("SELECT visibility FROM user_sheets WHERE id='sh_a'").get().visibility, 'public');
});
