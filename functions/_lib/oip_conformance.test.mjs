import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('C36 bypasses stale article HTML when proving the current blind-model surface', async () => {
  const source = await readFile(new URL('./oip_conformance.js', import.meta.url), 'utf8');
  const clause = source.slice(source.indexOf('// C36'), source.indexOf('// C37'));
  assert.match(clause, /\/a\/philosophy\?conformance=/);
  assert.doesNotMatch(clause, /cache:\s*"no-store"/);
});
