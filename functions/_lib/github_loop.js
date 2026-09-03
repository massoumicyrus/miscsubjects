/** GitHub issue loop — mirror of writer-queue: open/close tickets, visible as tasks + widgets. */
import { logEvent } from './event_log.js';

const REPO = '[OWNER_HANDLE]/miscsubjects-pages';

function ghHeaders(token) {
  return {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'miscsubjects-github-loop',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export async function fetchGithubIssues(env, { state = 'all', perPage = 50 } = {}) {
  if (!env.GITHUB_TOKEN) return { error: 'no GITHUB_TOKEN', issues: [] };
  const r = await fetch(
    `https://api.github.com/repos/${REPO}/issues?state=${state}&per_page=${perPage}&sort=updated&direction=desc`,
    { headers: ghHeaders(env.GITHUB_TOKEN) },
  );
  if (!r.ok) return { error: 'github ' + r.status, detail: await r.text(), issues: [] };
  const issues = (await r.json()).filter((i) => !i.pull_request);
  return { issues };
}

export async function syncGithubIssuesToTasks(env) {
  const { issues, error } = await fetchGithubIssues(env, { state: 'open', perPage: 100 });
  if (error) return { error, created: 0, closed: 0 };

  const autoOpen = issues.filter((i) => /^\[auto\]/i.test(i.title || ''));
  const openNums = new Set(autoOpen.map((i) => i.number));
  let created = 0;
  let reopened = 0;

  for (const iss of autoOpen) {
    const gid = 'gh-' + iss.number;
    const existing = await env.DB.prepare(
      'SELECT id, status FROM tasks WHERE google_task_id=? LIMIT 1',
    ).bind(gid).first();
    const job = {
      role: 'github-loop',
      phase: 'open',
      ask: iss.title,
      github_issue: iss.number,
      github_url: iss.html_url,
      labels: (iss.labels || []).map((l) => l.name),
      updated_at: iss.updated_at,
    };
    const ts = new Date().toISOString();
    if (!existing) {
      // trace_id = gh issue id: the task, its ledger events, and any agent turn
      // spawned with this trace all join on one chain.
      await env.DB.prepare(
        'INSERT INTO tasks (created_at, status, body, source, google_task_id, trace_id) VALUES (?,?,?,?,?,?)',
      ).bind(ts, 'open', JSON.stringify(job), 'github-loop', gid, gid).run();
      created++;
    } else if (existing.status === 'done' || existing.status === 'cancelled') {
      await env.DB.prepare('UPDATE tasks SET status=?, body=? WHERE id=?')
        .bind('open', JSON.stringify(job), existing.id).run();
      reopened++;
    }
  }

  const tracked = (
    await env.DB.prepare(
      "SELECT id, google_task_id, status FROM tasks WHERE source='github-loop' AND google_task_id LIKE 'gh-%' AND status IN ('open','running')",
    ).all()
  ).results || [];
  let closed = 0;
  for (const t of tracked) {
    const num = parseInt(String(t.google_task_id || '').replace(/^gh-/, ''), 10);
    if (!num || openNums.has(num)) continue;
    await env.DB.prepare('UPDATE tasks SET status=?, trace=? WHERE id=?')
      .bind('done', 'closed on GitHub', t.id).run();
    closed++;
  }

  try {
    await env.DB.prepare(
      "UPDATE tasks SET status='open' WHERE source='github-loop' AND status='running' AND datetime(created_at) < datetime('now', '-20 minutes')",
    ).run();
  } catch {}

  const stats = await githubLoopStats(env);
  if (created || reopened || closed) {
    await logEvent(env, {
      source: 'github', key: 'GH_ISSUE_SYNC', action: 'sync', direction: 'in', status: 200,
      request: { repo: REPO, open_auto_issues: autoOpen.map((i) => i.number) },
      response: { created, reopened, closed },
    });
  }
  return { created, reopened, closed, ...stats };
}

export async function githubLoopStats(env) {
  const { issues } = await fetchGithubIssues(env, { state: 'all', perPage: 100 });
  const auto = issues.filter((i) => /^\[auto\]/i.test(i.title || ''));
  const openAuto = auto.filter((i) => i.state === 'open');
  const closedAuto = auto.filter((i) => i.state === 'closed');
  const auditOpen = openAuto.filter((i) => /\[audit/i.test(i.title || ''));
  const tasks = (
    await env.DB.prepare(
      "SELECT status, COUNT(*) AS n FROM tasks WHERE source='github-loop' GROUP BY status",
    ).all()
  ).results || [];
  const byStatus = Object.fromEntries(tasks.map((r) => [r.status, r.n]));
  const autorun = env.KV ? await env.KV.get('github_loop_autorun') : null;
  return {
    github: {
      auto_open: openAuto.length,
      auto_closed: closedAuto.length,
      audit_open: auditOpen.length,
      build_open: issues.filter((i) => i.state === 'open' && /^\[build\]/i.test(i.title || '')).length,
      newest_open: openAuto[0] ? { number: openAuto[0].number, title: openAuto[0].title } : null,
    },
    tasks_mirror: byStatus,
    autorun: autorun === '1',
    observe: {
      widgets: '/api/github-loop?format=widgets',
      stats: '/api/github-loop?stats=1',
      manual_tick: 'POST /api/github-loop/run',
      tasks: '/api/tasks?status=open&role=github-loop',
      github: 'https://github.com/[OWNER_HANDLE]/miscsubjects-pages/issues',
    },
    cron: 'github_loop_autorun=1 → sibling every 5m → tick (bridge-only resolve)',
    models: 'grok ↔ kimi only',
    caps: { max_open: 3, audit_snip: 1200, merge_max_lines: 80 },
  };
}

export function issueWidgets(issues) {
  return issues.map((iss) => ({
    id: 'gh:' + iss.number,
    title: '#' + iss.number + ' · ' + (iss.state === 'open' ? 'OPEN' : 'CLOSED'),
    body: iss.title,
    ts: iss.updated_at,
    status: iss.state + ((iss.labels || []).map((l) => l.name).includes('code-audit') ? ' · audit' : ''),
    href: iss.html_url,
    api: iss.url,
  }));
}