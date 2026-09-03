#!/usr/bin/env node
// THE FAILURE VAULT GATE (owner order 2026-08-04). Reads failure-vault.json and fails the
// commit/deploy if any vaulted failure mode has been reintroduced: a required needle lost,
// a banned pattern back in a file. Every failure mode the owner names gets ONE entry in the
// vault, the same turn — after that it cannot recur without failing this gate loudly.
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const vault = JSON.parse(readFileSync(ROOT + '/failure-vault.json', 'utf8'));
const failures = [];

for (const entry of vault.entries) {
  for (const [file, rules] of Object.entries(entry.files || {})) {
    let text = '';
    try {
      text = readFileSync(ROOT + '/' + file, 'utf8');
    } catch {
      failures.push(`FAILURE_VAULT ${entry.id}: file MISSING — ${file}`);
      continue;
    }
    for (const needle of rules.must_contain || []) {
      if (!text.includes(needle)) failures.push(`FAILURE_VAULT ${entry.id}: ${file} lost required "${needle}"`);
    }
    for (const banned of rules.must_not_contain || []) {
      if (text.includes(banned)) failures.push(`FAILURE_VAULT ${entry.id}: ${file} reintroduced banned "${banned}"`);
    }
  }
  // Some defects are a SHAPE, not a string. `s.summary || s.quote` is the defect that hid the FDA's
  // own words behind our paragraph, and it can come back written five ways. A literal needle cannot
  // express that; a pattern can. Entries carrying `forbidden` were previously read and silently
  // ignored, which is worse than not having them — the vault reported ok on a rule it never ran.
  for (const rule of entry.forbidden || []) {
    if (!rule || !rule.file || !rule.must_not_match) {
      failures.push(`FAILURE_VAULT ${entry.id}: malformed forbidden rule — needs {file, must_not_match, why}`);
      continue;
    }
    let text = '';
    try {
      text = readFileSync(ROOT + '/' + rule.file, 'utf8');
    } catch {
      failures.push(`FAILURE_VAULT ${entry.id}: forbidden rule targets a MISSING file — ${rule.file}`);
      continue;
    }
    let re;
    try {
      re = new RegExp(rule.must_not_match, rule.flags || '');
    } catch (e) {
      failures.push(`FAILURE_VAULT ${entry.id}: forbidden pattern is not a valid regex — ${String(e.message)}`);
      continue;
    }
    const hit = text.match(re);
    if (hit) {
      failures.push(
        `FAILURE_VAULT ${entry.id}: ${rule.file} matches forbidden pattern /${rule.must_not_match}/ `
        + `at "${String(hit[0]).slice(0, 60)}" — ${rule.why || 'this shape is the defect'}`,
      );
    }
  }
}

if (failures.length) {
  for (const f of failures) console.error(f);
  console.error('The failure vault blocked this change. Each entry is an owner-named failure mode; fix the regression, never the gate.');
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, law: 'FAILURE_VAULT', entries: vault.entries.length }));
