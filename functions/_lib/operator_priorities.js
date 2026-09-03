// Operator priorities — the humanoid sync surface every model loads on entry.
// Operator object: profile + human-scale backlog + cross-model resume + agent sync health.

import { buildNowIso } from './build_time.js';
import { syncHealth } from './ledger_sync.js';
import { loadOwnerProfile, ownerProfileMarkdown } from './unified_handoff.js';
import { buildResume, resumeMarkdown } from './object_contract.js';

const BASE = 'https://miscsubjects.com';

const MACHINE_TASK_SOURCES = new Set([
  'oip-review',
  'writer',
  'writer-queue',
  'source-hunt',
  'oip-write',
  'oip-revise',
]);

const AGENT_SLAVES = ['grok', 'claude', 'kimi', 'kimi-desktop', 'codex', 'gemini'];

function clip(s, n) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
}

function parseJson(v, fb) {
  try { return JSON.parse(v || ''); } catch { return fb; }
}

async function collectHumanTasks(env) {
  const rows = (await env.DB.prepare(
    "SELECT id, status, source, created_at, trace_id, body FROM tasks WHERE status IN ('open','running') ORDER BY CASE status WHEN 'running' THEN 0 ELSE 1 END, id DESC LIMIT 5000",
  ).all()).results || [];
  const human = [];
  const machine = [];
  for (const row of rows) {
    const src = String(row.source || 'unknown');
    const job = parseJson(row.body, null);
    const title = clip(
      job && (job.ask || job.title || job.item || job.body || job.slug || job.github_url) || row.body,
      400,
    );
    const item = { id: row.id, status: row.status, source: src, title, trace_id: row.trace_id || null, created_at: row.created_at };
    if (MACHINE_TASK_SOURCES.has(src)) machine.push(item);
    else human.push(item);
  }
  return {
    human_count: human.length,
    machine_count: machine.length,
    human_tasks: human.slice(0, 40),
    machine_by_source: machine.reduce((m, t) => { m[t.source] = (m[t.source] || 0) + 1; return m; }, {}),
  };
}

async function collectAgentSync(env) {
  const stats = (await env.DB.prepare(
    `SELECT agent, COUNT(*) n, MAX(ts) last_ts FROM agent_turns WHERE agent IN (${AGENT_SLAVES.map(() => '?').join(',')}) GROUP BY agent`,
  ).bind(...AGENT_SLAVES).all()).results || [];
  const byAgent = Object.fromEntries(AGENT_SLAVES.map((a) => [a, { turns: 0, last_ts: null, stale: true }]));
  const now = Date.now();
  for (const r of stats) {
    const last = r.last_ts ? new Date(r.last_ts).getTime() : 0;
    const ageH = last ? (now - last) / 3600000 : null;
    byAgent[r.agent] = {
      turns: Number(r.n || 0),
      last_ts: r.last_ts || null,
      stale: ageH == null || ageH > 48,
      age_hours: ageH == null ? null : Math.round(ageH * 10) / 10,
    };
  }
  return { agents: byAgent, slaves: AGENT_SLAVES };
}

async function collectRecentTurns(env, limit = 12) {
  const rows = (await env.DB.prepare(
    'SELECT ts, agent, source, user_input, assistant_text, tools_json, files_json, commands_json, audit_verdict FROM agent_turns ORDER BY id DESC LIMIT ?',
  ).bind(limit).all()).results || [];
  return rows;
}

async function collectBlockers(env) {
  const blockers = [];
  try {
    const fda = await env.DB.prepare(
      "SELECT COUNT(*) n FROM agent_turns WHERE user_input LIKE '%Full Disk Access%' OR assistant_text LIKE '%Full Disk Access%' ORDER BY id DESC LIMIT 1",
    ).first();
    if (Number(fda?.n || 0) > 0) {
      blockers.push({ id: 'imessage_fda', note: 'iMessage full-history import blocked until claude.app has Full Disk Access (restart app after toggle).' });
    }
  } catch {}
  return blockers;
}

export async function buildOperatorPriorities(env) {
  const profile = await loadOwnerProfile(env);
  const tasks = await collectHumanTasks(env);
  const agentSync = await collectAgentSync(env);
  const turns = await collectRecentTurns(env, 12);
  const resume = buildResume(turns, []);
  let syncCorners = [];
  try { syncCorners = await syncHealth(env); } catch {}
  const blockers = await collectBlockers(env);

  const staleAgents = AGENT_SLAVES.filter((a) => agentSync.agents[a]?.stale);
  const machineTotal = Object.values(tasks.machine_by_source).reduce((s, n) => s + n, 0);

  return {
    protocol: 'OIP',
    version: '0.6',
    kind: 'priorities',
    generated_at: buildNowIso(),
    principle:
      'The operator is a machine object — not a chat persona. Every model reads this on entry: who the operator is, what they actually owe (human-scale), what every slave last did, and where to continue. Build ↔ operator sync = this URL + ledger + agent_turns.',
    operator: {
      object: 'humanoid',
      meaning: 'Operator synced with the build — profile, backlog, threads, and cross-model memory are one read.',
      profile_url: BASE + '/api/dispatch?profile=1&format=markdown',
      resume_url: BASE + '/api/dispatch?resume=1&format=markdown',
      ledger_url: BASE + '/admin/ledger?cards=1',
      agents_url: BASE + '/admin/agents',
      thread_state_url: BASE + '/api/protocol/thread-state?target=operator',
    },
    profile,
    backlog: {
      human_open: tasks.human_count,
      machine_open: machineTotal,
      human_tasks: tasks.human_tasks,
      machine_by_source: tasks.machine_by_source,
      note: 'Human backlog excludes machine queues (oip-review, writer, writer-queue, source-hunt). Machine work runs in background — do not surface it as owner debt.',
    },
    slaves: agentSync,
    stale_agents: staleAgents,
    resume: resume.recent_turns,
    blockers,
    sync_corners: syncCorners,
    load_order: [
      'GET ?priorities=1 (this)',
      'GET ?profile=1',
      'GET ?resume=1',
      'GET /api/protocol/thread-state?target=operator',
      'POST material updates to /api/protocol/thread-update when you learn something new',
    ],
  };
}

export function prioritiesMarkdown(p) {
  const lines = [
    '## §PRIORITIES — operator humanoid (every model reads this on entry)',
    '',
    '**Principle:** ' + p.principle,
    '',
    '**Operator object:** ' + p.operator.meaning,
    '',
    ownerProfileMarkdown(p.profile),
    '',
    '### Human backlog (' + p.backlog.human_open + ' open — machine queues excluded)',
  ];
  if (!p.backlog.human_tasks.length) lines.push('- none');
  else for (const t of p.backlog.human_tasks) {
    lines.push('- #' + t.id + ' [' + t.status + '] ' + t.source + ': ' + t.title + (t.trace_id ? ' (trace ' + t.trace_id + ')' : ''));
  }
  lines.push('', '### Machine queues (background — not owner debt): ' + p.backlog.machine_open);
  for (const [src, n] of Object.entries(p.backlog.machine_by_source || {})) lines.push('- ' + src + ': ' + n);
  lines.push('', '### Slaves (cross-model sync)');
  for (const a of p.slaves.slaves) {
    const s = p.slaves.agents[a] || {};
    const flag = s.stale ? 'STALE' : 'live';
    lines.push('- **' + a + '** · ' + (s.turns || 0) + ' turns · last ' + (s.last_ts || 'never') + ' · ' + flag);
  }
  if (p.stale_agents.length) {
    lines.push('', '**Stale slaves (turns not landing):** ' + p.stale_agents.join(', ') + ' — run POST /api/agent_ledger_sync before continuing.');
  }
  lines.push('', '### Cross-model resume (newest first)');
  for (const t of (p.resume || [])) {
    lines.push('- **' + (t.ts || '') + ' · ' + t.agent + '** — asked: ' + clip(t.asked, 120));
    lines.push('  - did: ' + t.did);
  }
  if (p.blockers.length) {
    lines.push('', '### Blockers');
    for (const b of p.blockers) lines.push('- **' + b.id + ':** ' + b.note);
  }
  lines.push('', '### Sync corners');
  for (const c of (p.sync_corners || [])) lines.push('- ' + c.id + ': ' + c.state + (c.age_s != null ? ' (' + c.age_s + 's)' : ''));
  lines.push('', '### URLs');
  lines.push('- Profile: ' + p.operator.profile_url);
  lines.push('- Resume: ' + p.operator.resume_url);
  lines.push('- Ledger: ' + p.operator.ledger_url);
  lines.push('- Agents: ' + p.operator.agents_url);
  lines.push('- Thread state: ' + p.operator.thread_state_url);
  lines.push('', '*Self-explaining. Derived from owner_rules + agent_turns + tasks — not hand-written.*');
  return lines.join('\n');
}