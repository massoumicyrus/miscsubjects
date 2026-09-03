#!/usr/bin/env node

const BASE = process.env.WORK_BASE || 'https://miscsubjects.com';
const TERMINAL = ['completed', 'cancelled', 'superseded', 'accepted'];

export function findImpossible(tasks) {
  const byId = new Map(tasks.map((t) => [t.task_id || t.id, t]));
  const testsOf = (t) => (Array.isArray(t?.acceptance_tests) ? t.acceptance_tests
    : Array.isArray(t?.acceptance) ? t.acceptance : []);
  let examined = 0;
  const impossible = [];
  for (const t of tasks) {
    const state = String(t.state || '').toLowerCase();
    if (TERMINAL.includes(state)) continue;
    examined += 1;
    if (testsOf(t).length) continue;
    const parent = byId.get(t.parent_task || t.parent_id);
    if (parent && testsOf(parent).length) continue;
    impossible.push({ id: t.task_id || t.id, state, kind: t.kind, parent: t.parent_task || t.parent_id || null });
  }
  return { examined, impossible };
}

async function main() {
  // Cache-bust: a gate that reads yesterday's projection is not measuring today's deploy.
  const url = `${BASE}/api/work?gate=${Date.now()}`;
  let res;
  try {
    res = await fetch(url, { headers: { 'user-agent': 'work-acceptance-gate/1', 'cache-control': 'no-cache' } });
  } catch (e) {
    console.error(`WORK_ACCEPTANCE_LAW: could not reach ${url} — ${e.message}`);
    process.exit(1);
  }
  if (res.status !== 200) {
    console.error(`WORK_ACCEPTANCE_LAW: ${url} answered HTTP ${res.status}. The work object must be readable for this gate to mean anything.`);
    process.exit(1);
  }
  const doc = await res.json();
  const tasks = Array.isArray(doc.tasks) ? doc.tasks
    : Array.isArray(doc.work?.tasks) ? doc.work.tasks
      : Object.values(doc).find((v) => Array.isArray(v) && v[0]?.task_id) || [];

  if (!tasks.length) {
    console.error('WORK_ACCEPTANCE_LAW: the work object listed no tasks. Either the projection changed shape or the query is wrong — a gate that examines nothing passes everything.');
    process.exit(1);
  }

  const { examined, impossible } = findImpossible(tasks);

  console.log(`WORK_ACCEPTANCE_LAW: examined ${examined} non-terminal task${examined === 1 ? '' : 's'} of ${tasks.length} total.`);
  if (!examined) {
    console.error('WORK_ACCEPTANCE_LAW: zero non-terminal tasks examined. That is not a clean bill of health, it is a broken gate.');
    process.exit(1);
  }
  if (impossible.length) {
    console.error(`WORK_ACCEPTANCE_LAW FAILED — ${impossible.length} task(s) can never be completed because no test could close them:`);
    for (const t of impossible) {
      console.error(`  ${t.id} (${t.kind}, ${t.state})${t.parent ? ` parent ${t.parent} has none either` : ' and it has no parent to inherit from'}`);
    }
    console.error('Give each one acceptance tests that measure the object under test. Do not delete the task, and do not relax runAcceptance — an agent asserting completion is not evidence.');
    process.exit(1);
  }
  console.log('WORK_ACCEPTANCE_LAW: every open task has a test that can close it.');
}

// Importing this file for its findImpossible() must not fire the network gate.
if (process.argv[1] && process.argv[1].endsWith('check-work-acceptance.mjs')) {
  main().catch((e) => { console.error('WORK_ACCEPTANCE_LAW threw:', e); process.exit(1); });
}
