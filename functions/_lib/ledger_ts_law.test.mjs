import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/.test(name) && !/\.test\.mjs$/.test(name)) out.push(p);
  }
  return out;
}

test('every direct INSERT INTO events stamps ts with the build clock, never toISOString()', () => {
  const offenders = [];
  for (const file of [...walk(join(ROOT, 'functions')), ...walk(join(ROOT, 'scripts'))]) {
    const src = readFileSync(file, 'utf8');
    if (!/INSERT INTO events\b/.test(src)) continue;
    if (file.endsWith('event_log.js')) continue;
    const stampsRight = /buildNowIso\(\)|pacificIso\(\)/.test(src);
    // A UTC stamp anywhere near the insert is the failure this guards; a file may still use
    // toISOString for things that are not ledger timestamps, so only the ts binding is judged.
    // Judge only the ledger row's own stamp: a `ts` variable bound into the insert, or a UTC
    // stamp appearing inside the insert's bind list (up to its .run()/.first()).
    let utcTs = /(?:const|let|var)\s+ts\s*=\s*new Date\(\)\.toISOString\(\);/.test(src);
    for (const m of src.matchAll(/INSERT INTO events\b/g)) {
      const tail = src.slice(m.index, m.index + 1500);
      const end = tail.search(/\.run\(\)|\.first\(\)|\.all\(\)|\n\s*\n/);
      if (/new Date\(\)\.toISOString\(\)/.test(tail.slice(0, end > 0 ? end : 600))) utcTs = true;
    }
    if (!stampsRight || utcTs) offenders.push(file.replace(ROOT + '/', ''));
  }
  assert.deepEqual(offenders, [], 'these files write ledger rows with a UTC timestamp — stamp with buildNowIso() (functions) or pacificIso() (scripts)');
});
