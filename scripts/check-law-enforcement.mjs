#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { enforcementReport, enforcementSummary, redundancyReport, ACCEPTED_DISTINCT } from '../functions/_lib/law_enforcement.js';

const failures = [];
const rows = enforcementReport();
const summary = enforcementSummary();

// 1. EVERY CLAUSE DECLARES HOW IT BINDS. Either a named check, or a written reason it cannot have
//    one. Silence is what turns a law into a wish, so silence is the failure.
// THE RATCHET. 244 clauses were undeclared the day this gate was written. Failing the deploy on
//    all of them would stop the site rather than bind it, and a gate that has to be switched off to
//    ship is the decorative kind. So the debt is recorded in scripts/law-enforcement-baseline.json
//    and this gate enforces two things that together make the number fall and never rise: adding a
//    clause without a declaration fails immediately, and declaring one requires the baseline to be
//    lowered in the same commit. The debt is visible, it is dated, and it is one-directional.
const undeclared = rows.filter((r) => !r.declared);
const baselinePath = new URL('./law-enforcement-baseline.json', import.meta.url);
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
if (undeclared.length > baseline.undeclared) {
  const added = undeclared.filter((r) => !baseline.keys.includes(r.key));
  failures.push(
    `${undeclared.length} clauses are undeclared; the recorded debt is ${baseline.undeclared}. `
    + `${added.length} clause(s) were added to a law without saying how they bind:\n`
    + added.slice(0, 10).map((r) => `      ${r.law} ${r.id} — ${r.title}`).join('\n')
    + `\n      Add each to DECLARATIONS in functions/_lib/law_enforcement.js with either\n`
    + `        { enforced_by: '<real function or script>', surface: 'write-path'|'deploy'|'audit' }\n`
    + `      or { unenforced: '<why no machine check can decide this>' }.`,
  );
}
if (undeclared.length < baseline.undeclared) {
  failures.push(
    `${baseline.undeclared - undeclared.length} clause(s) were declared since the baseline was written, `
    + `but scripts/law-enforcement-baseline.json still records ${baseline.undeclared}. Lower it to `
    + `${undeclared.length} in this commit — the debt only counts if the number is true.`,
  );
}

// 2. A DECLARATION MAY NOT LIE. enforced_by has to name something; surface has to be real.
const VALID = new Set(['write-path', 'deploy', 'audit']);
for (const r of rows) {
  if (!r.declared) continue;
  if (r.enforced && !VALID.has(r.surface)) {
    failures.push(`${r.law} ${r.id} claims enforcement by ${r.enforced_by} but its surface is ${JSON.stringify(r.surface)}; must be write-path, deploy or audit`);
  }
  if (!r.enforced && !String(r.unenforced_reason || '').trim()) {
    failures.push(`${r.law} ${r.id} — ${r.title} is declared but names neither a check nor a reason it cannot have one`);
  }
}

const WRITE_PATH_SOURCES = ['functions/api/articles/[[path]].js'];
{
  const sources = WRITE_PATH_SOURCES.map((p) => {
    try { return readFileSync(new URL('../' + p, import.meta.url), 'utf8'); } catch { return ''; }
  }).join('\n');
  for (const r of rows) {
    if (!r.declared || !r.enforced || r.surface !== 'write-path') continue;
    for (const fn of String(r.enforced_by).match(/\b[a-z_][\w]*\.([A-Za-z_][\w]*)/g) || []) {
      const name = fn.split('.')[1];
      if (!sources.includes(name)) {
        failures.push(
          `${r.law} ${r.id} — ${r.title} declares "${r.enforced_by}" at the write path, but `
          + `${WRITE_PATH_SOURCES.join(', ')} never mentions ${name}. Either call it there, or move the `
          + 'declaration to the surface that really runs it. A clause is enforced where it is called, '
          + 'never where it is claimed.',
        );
      }
    }
  }
}

// 3. ANTI-REDUNDANCY, WITH THE GUARD. Clauses sharing one check are one clause wearing several
//    titles. The guard is that merging must lose no enforcement — which is automatic when a single
//    check already covers all of them, so these groups are always safe to merge. A group stays only
//    if somebody writes down why the clauses must remain separate.
for (const g of redundancyReport()) {
  if (ACCEPTED_DISTINCT[g.key]) continue;
  if (!g.merge_preserves_enforcement) continue;   // the guard: never trade an enforcement for words
  if (baseline.redundancy_open.includes(g.key)) continue;  // ratcheted like the debt above
  failures.push(
    `${g.law}: ${g.clauses.length} clauses are enforced by the one check ${g.shared_check} —\n`
    + g.clauses.map((c) => `      ${c.id} ${c.title}`).join('\n')
    + `\n      Merge them into the shortest wording that still says everything, or add "${g.key}" to\n`
    + '      ACCEPTED_DISTINCT with the reason they must stay apart.',
  );
}

const openNow = redundancyReport().map((g) => g.key);
for (const k of baseline.redundancy_open) {
  if (!openNow.includes(k)) failures.push(`redundancy group ${k} is resolved but scripts/law-enforcement-baseline.json still lists it — remove it in this commit.`);
}

console.log(`LAW_ENFORCEMENT: ${summary.total_clauses} clauses across ${Object.keys(summary.by_law).length} laws — `
  + `${summary.enforced} enforced (${summary.enforced_share}%), ${summary.declared_unenforced} declared unenforced, `
  + `${summary.undeclared} undeclared`);
for (const [law, s] of Object.entries(summary.by_law)) {
  console.log(`  ${law.padEnd(9)} ${String(s.enforced).padStart(3)}/${String(s.total).padEnd(4)} enforced   ${s.undeclared} undeclared`);
}

if (failures.length) {
  console.error('\nLAW_ENFORCEMENT FAILED\n');
  for (const f of failures) console.error('  - ' + f + '\n');
  process.exit(1);
}
console.log('LAW_ENFORCEMENT: every clause declares how it binds.');
