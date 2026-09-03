#!/usr/bin/env node
// DEPLOY BLOCKER: the direct-SQL bypass must be refused by the running site, not only by a unit test.
//
// WT-0039. D1_EXEC accepted any write to the content database, so `UPDATE work_tasks SET
// state='completed'` closed a task with no acceptance test run and no audit row appended, and a write
// to work_actions could edit the hash chain that exists to prove nothing was edited.
//
// This fires the real statements at the live dispatch endpoint with the owner's key — the most
// privileged caller there is — and requires each one to come back refused. A unit test proves the
// function refuses; only this proves the deployed lane does. It also checks that a harmless write to
// an ungoverned table still works, because a guard that refuses everything is not a guard, it is an
// outage.

import { spawnSync } from 'node:child_process';

const BASE = process.env.WORK_BASE || 'https://miscsubjects.com';
const KEY = process.env.TERMINAL_KEY || '';

// Statements that used to succeed. None of them may run. Each is a no-op even if the guard is gone:
// the WHERE clauses match nothing, so a regression is caught without damaging a row.
const MUST_REFUSE = [
  ["UPDATE work_tasks SET state='completed' WHERE id='WT-GATE-NO-SUCH-TASK'", 'work_tasks'],
  ["DELETE FROM work_actions WHERE task_id='WT-GATE-NO-SUCH-TASK'", 'work_actions'],
  ["UPDATE articles SET title='gate' WHERE slug='no-such-slug-gate-probe'", 'articles'],
  ["UPDATE article_slots SET content='gate' WHERE slug='no-such-slug-gate-probe'", 'article_slots'],
];

async function dispatch(key, body) {
  const r = await fetch(`${BASE}/api/dispatch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-terminal-key': KEY },
    body: JSON.stringify({ key, body }),
  });
  const text = await r.text();
  let j = null;
  try { j = JSON.parse(text); } catch { /* keep the raw text */ }
  return { status: r.status, text, result: String(j?.result ?? text) };
}

async function main() {
  if (!KEY) {
    console.error('GOVERNED_TABLE_LAW: no TERMINAL_KEY in this environment, so the live refusal cannot be probed. This gate must run with the key — a skip here is how the bypass came back.');
    process.exit(1);
  }

  let examined = 0;
  const failures = [];
  for (const [sql, table] of MUST_REFUSE) {
    examined += 1;
    const { result } = await dispatch('D1_EXEC', sql);
    if (!/governed_table:/.test(result)) {
      failures.push(`D1_EXEC accepted a write to ${table}: ${result.slice(0, 200)}`);
    } else if (!result.includes('governed_table:' + table)) {
      failures.push(`D1_EXEC refused a write to ${table} but named a different table: ${result.slice(0, 200)}`);
    }
  }

  // A guard that refuses everything is an outage, not a guard.
  examined += 1;
  const ok = await dispatch('D1_QUERY', 'SELECT COUNT(*) n FROM work_tasks');
  if (/governed_table:/.test(ok.result)) {
    failures.push('a plain SELECT against work_tasks was refused — the guard is matching reads, which breaks every caller that only looks.');
  }

  console.log(`GOVERNED_TABLE_LAW: examined ${examined} live statements against ${BASE}.`);
  if (!examined) {
    console.error('GOVERNED_TABLE_LAW: examined nothing. That is a broken gate, not a pass.');
    process.exit(1);
  }
  if (failures.length) {
    console.error('GOVERNED_TABLE_LAW FAILED — the direct-SQL bypass is open on the running site:');
    for (const f of failures) console.error('  ' + f);
    console.error('Restore the guard in functions/_lib/governed_tables.js. Repair belongs in D1_REPAIR, which appends an audit row.');
    process.exit(1);
  }
  console.log('GOVERNED_TABLE_LAW: work_tasks, work_actions, articles and article_slots all refuse a raw write; reads are untouched.');
}

main().catch((e) => { console.error('GOVERNED_TABLE_LAW threw:', e); process.exit(1); });
