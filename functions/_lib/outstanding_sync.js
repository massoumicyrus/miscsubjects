import { buildNowIso, buildSinceIso } from './build_time.js';
import { logEvent } from './event_log.js';
import { syncHealth } from './ledger_sync.js';

const REPO = '[OWNER_HANDLE]/miscsubjects-pages';
const BASE = 'https://miscsubjects.com';
const OWNER_PHONE = '[OWNER_PHONE]';
// theloopway.com because it resolves and is verified today. [OWNER_EMAIL] is the real primary, but the
// .co delegation to ns1/ns2.dnsimple.com is lame (nameservers answer REFUSED), so nothing reaches it
// until that is repaired at the registrar. Not a wrong address. See functions/api/email/send.js.
const DEFAULT_OWNER_EMAIL = '[OWNER_EMAIL]';

function clip(value, max = 240) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function mdEscape(value) {
  return String(value == null ? '' : value).replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

async function setting(env, key) {
  try {
    const row = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();
    return row && row.value != null ? String(row.value) : '';
  } catch { return ''; }
}

async function ownerEmail(env) {
  const configured =
    (await setting(env, 'outstanding_sync_email')) ||
    (await setting(env, 'owner_email')) ||
    env.EMAIL_FORWARD ||
    DEFAULT_OWNER_EMAIL;
  return String(configured).trim() || DEFAULT_OWNER_EMAIL;
}

function ghHeaders(env) {
  return {
    Authorization: 'Bearer ' + env.GITHUB_TOKEN,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'miscsubjects-outstanding-sync',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function collectGithubIssues(env) {
  if (!env.GITHUB_TOKEN) return { error: 'no GITHUB_TOKEN', open_count: 0, issues: [] };
  const issues = [];
  for (let page = 1; page <= 10; page++) {
    const r = await fetch(
      `https://api.github.com/repos/${REPO}/issues?state=open&per_page=100&page=${page}&sort=updated&direction=desc`,
      { headers: ghHeaders(env) },
    );
    if (!r.ok) return { error: 'github ' + r.status + ': ' + (await r.text()).slice(0, 500), open_count: issues.length, issues };
    const batch = (await r.json()).filter((i) => !i.pull_request);
    issues.push(...batch.map((i) => ({
      number: i.number,
      title: i.title,
      url: i.html_url,
      labels: (i.labels || []).map((l) => l.name || String(l)),
      created_at: i.created_at,
      updated_at: i.updated_at,
      state: i.state,
      assignees: (i.assignees || []).map((a) => a.login),
    })));
    if (batch.length < 100) break;
  }
  const byLabel = {};
  for (const issue of issues) {
    const labels = issue.labels.length ? issue.labels : ['unlabeled'];
    for (const label of labels) byLabel[label] = (byLabel[label] || 0) + 1;
  }
  return {
    repo: REPO,
    open_count: issues.length,
    by_label: Object.entries(byLabel).sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n })),
    issues,
  };
}

function parseTask(row) {
  const job = parseJson(row.body, null);
  const title = job && (job.ask || job.title || job.item || job.body || job.slug || job.github_url);
  return {
    id: row.id,
    status: row.status,
    source: row.source || 'unknown',
    created_at: row.created_at,
    google_task_id: row.google_task_id || null,
    trace_id: row.trace_id || null,
    title: clip(title || row.body, 500),
    job: job || row.body,
  };
}

async function collectTasks(env) {
  const rows = (await env.DB.prepare(
    "SELECT id,status,source,created_at,google_task_id,trace_id,body FROM tasks WHERE status IN ('open','running') ORDER BY CASE status WHEN 'running' THEN 0 ELSE 1 END, id DESC LIMIT 5000",
  ).all()).results || [];
  const tasks = rows.map(parseTask);
  const bySource = {};
  const byStatus = {};
  for (const task of tasks) {
    bySource[task.source] = (bySource[task.source] || 0) + 1;
    byStatus[task.status] = (byStatus[task.status] || 0) + 1;
  }
  return {
    total_returned: tasks.length,
    truncated_at: tasks.length >= 5000 ? 5000 : null,
    by_status: byStatus,
    by_source: Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([source, n]) => ({ source, n })),
    running: tasks.filter((t) => t.status === 'running'),
    tasks,
  };
}

async function collectKimi(env) {
  const kimiWhere = "LOWER(COALESCE(agent,'')) LIKE '%kimi%' OR LOWER(COALESCE(source,'')) LIKE '%kimi%' OR LOWER(COALESCE(dispatch_key,'')) LIKE '%kimi%'";
  const stats = (await env.DB.prepare(
    `SELECT agent, source, dispatch_key, COUNT(*) n, MAX(ts) last_ts FROM agent_turns WHERE ${kimiWhere} GROUP BY agent, source, dispatch_key ORDER BY n DESC`,
  ).all()).results || [];
  const recent = (await env.DB.prepare(
    `SELECT id,ts,agent,source,session,cwd,input_kind,substr(user_input,1,500) user_input,substr(assistant_text,1,700) assistant_text,n_tools,files_json,trace_id FROM agent_turns WHERE ${kimiWhere} ORDER BY id DESC LIMIT 30`,
  ).all()).results || [];
  const kimiTurns = await env.DB.prepare('SELECT COUNT(*) n, MAX(ts) last_ts FROM kimi_turns').first().catch(() => null);
  const cliTurns = stats
    .filter((r) => String(r.agent || '') === 'kimi')
    .reduce((sum, r) => sum + Number(r.n || 0), 0);
  const desktopTurns = stats
    .filter((r) => /desktop|work/i.test(String(r.agent || '') + ' ' + String(r.source || '')))
    .reduce((sum, r) => sum + Number(r.n || 0), 0);
  return {
    stats,
    cli_turns: cliTurns,
    desktop_turns: desktopTurns,
    total_turns: stats.reduce((sum, r) => sum + Number(r.n || 0), 0),
    kimi_turns: { count: Number(kimiTurns?.n || 0), last_ts: kimiTurns?.last_ts || null },
    recent: recent.map((r) => ({
      ...r,
      files: parseJson(r.files_json, []),
      files_json: undefined,
    })),
  };
}

async function collectProblems(env) {
  const since = buildSinceIso(168);
  const errors = (await env.LEDGER.prepare(
    'SELECT source,key,COUNT(*) errors,MAX(ts) last_ts FROM events WHERE ts > ? AND status >= 400 GROUP BY source,key ORDER BY errors DESC LIMIT 20',
  ).bind(since).all()).results || [];
  const briefs = (await env.LEDGER.prepare(
    "SELECT ts,response_preview FROM events WHERE key='GOVERNOR_BRIEF' ORDER BY ts DESC LIMIT 5",
  ).all()).results || [];
  const memoryRaw = await setting(env, 'governor_memory');
  const restatement = await env.DB.prepare(
    "SELECT COUNT(*) n FROM agent_turns WHERE ts > ? AND input_kind='human' AND (user_input LIKE '%RESTAT%' OR user_input LIKE '%ALREADY SAID%' OR user_input LIKE '%ALREADY TOLD%' OR user_input LIKE '%OVER & OVER%' OR user_input LIKE '%OVER AND OVER%' OR user_input LIKE '%AGAIN AND AGAIN%')",
  ).bind(since).first().catch(() => null);
  let corners = [];
  try { corners = await syncHealth(env); } catch {}
  return {
    window_hours: 168,
    errors,
    governor_memory: parseJson(memoryRaw, {}),
    recent_governor_briefs: briefs.map((b) => ({ ts: b.ts, preview: b.response_preview })),
    owner_restatement_pain_7d: Number(restatement?.n || 0),
    sync_corners: corners,
  };
}

async function storeReport(env, report, markdown) {
  const stamp = report.generated_at.replace(/[:]/g, '-');
  const keyBase = `sync/outstanding/${stamp}`;
  const out = {
    json_key: null,
    markdown_key: null,
    latest_api: BASE + '/api/outstanding-sync?latest=1',
    fresh_api: BASE + '/api/outstanding-sync',
  };
  if (!env.R2) return out;
  out.json_key = keyBase + '.json';
  out.markdown_key = keyBase + '.md';
  await env.R2.put(out.json_key, JSON.stringify(report, null, 2), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  await env.R2.put(out.markdown_key, markdown, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
  if (env.KV) await env.KV.put('outstanding_sync:latest', JSON.stringify({ json_key: out.json_key, markdown_key: out.markdown_key, generated_at: report.generated_at }));
  return out;
}

export async function loadLatestOutstandingSync(env) {
  const raw = env.KV ? await env.KV.get('outstanding_sync:latest') : null;
  const meta = parseJson(raw, null);
  if (!meta || !meta.json_key || !env.R2) return null;
  const obj = await env.R2.get(meta.json_key);
  if (!obj) return null;
  const report = parseJson(await obj.text(), null);
  let markdown = '';
  if (meta.markdown_key) {
    const md = await env.R2.get(meta.markdown_key);
    if (md) markdown = await md.text();
  }
  return { meta, report, markdown };
}

function lineTask(task) {
  return `- #${task.id} [${task.status}] ${task.source}: ${clip(task.title, 220)}${task.trace_id ? ` (trace ${task.trace_id})` : ''}`;
}

function lineIssue(issue) {
  const labels = issue.labels.length ? ` [${issue.labels.join(', ')}]` : '';
  return `- #${issue.number}${labels} ${issue.title} - ${issue.url}`;
}

export function renderOutstandingMarkdown(report, opts = {}) {
  const full = !!opts.full;
  const taskLimit = full ? report.tasks.tasks.length : Math.min(report.tasks.tasks.length, 250);
  const issueLimit = full ? report.github.issues.length : report.github.issues.length;
  const sources = report.tasks.by_source.map((r) => `- ${r.source}: ${r.n}`).join('\n') || '- none';
  const statuses = Object.entries(report.tasks.by_status).map(([status, n]) => `- ${status}: ${n}`).join('\n') || '- none';
  const labels = (report.github.by_label || []).slice(0, 30).map((r) => `- ${r.label}: ${r.n}`).join('\n') || '- none';
  const kimiStats = (report.kimi.stats || []).map((r) => `- ${r.agent || 'kimi'} / ${r.source || '?'}: ${r.n} turns; last ${r.last_ts || 'unknown'}`).join('\n') || '- none';
  const errors = (report.problems.errors || []).map((r) => `- ${r.source || '?'} / ${r.key || '?'}: ${r.errors}; last ${r.last_ts}`).join('\n') || '- none';
  const recurrence = Object.entries(report.problems.governor_memory || {})
    .sort((a, b) => Number(b[1]?.count || 0) - Number(a[1]?.count || 0))
    .slice(0, 20)
    .map(([k, v]) => `- ${k}: ${v.count || 0}; last ${v.last || 'unknown'}`)
    .join('\n') || '- none';
  const syncCorners = (report.problems.sync_corners || []).map((c) => `- ${c.id}: ${c.state}${c.age_s == null ? '' : ` (${c.age_s}s)`}`).join('\n') || '- none';
  const stored = report.stored || {};
  const links = [
    `- Tasks admin: ${BASE}/admin/tasks`,
    `- Kimi admin: ${BASE}/admin/kimi`,
    `- Agent forum: ${BASE}/admin/ledger?forum=1`,
    `- Ledger: ${BASE}/admin/ledger?cards=1`,
    `- GitHub issues: https://github.com/${REPO}/issues`,
    stored.latest_api ? `- Latest full report API: ${stored.latest_api}` : '',
    stored.json_key ? `- R2 JSON key: ${stored.json_key}` : '',
    stored.markdown_key ? `- R2 Markdown key: ${stored.markdown_key}` : '',
  ].filter(Boolean).join('\n');

  return [
    '# Outstanding Sync',
    '',
    `Generated: ${report.generated_at}`,
    '',
    '## Counts',
    '',
    `- GitHub open issues: ${report.github.open_count}${report.github.error ? ` (${report.github.error})` : ''}`,
    `- Open/running tasks returned: ${report.tasks.total_returned}${report.tasks.truncated_at ? ` (truncated at ${report.tasks.truncated_at})` : ''}`,
    `- Kimi CLI rows: ${report.kimi.cli_turns}`,
    `- Kimi Desktop rows: ${report.kimi.desktop_turns}`,
    `- Kimi total rows: ${report.kimi.total_turns}`,
    `- Restatement-pain turns in 7d: ${report.problems.owner_restatement_pain_7d}`,
    '',
    '## Links',
    '',
    links,
    '',
    '## Task Status',
    '',
    statuses,
    '',
    '## Task Sources',
    '',
    sources,
    '',
    '## Running Tasks',
    '',
    report.tasks.running.length ? report.tasks.running.map(lineTask).join('\n') : '- none',
    '',
    `## Tasks (${taskLimit} of ${report.tasks.tasks.length})`,
    '',
    report.tasks.tasks.slice(0, taskLimit).map(lineTask).join('\n') || '- none',
    !full && report.tasks.tasks.length > taskLimit ? `\n- ${report.tasks.tasks.length - taskLimit} more tasks in the full report.` : '',
    '',
    '## GitHub Labels',
    '',
    labels,
    '',
    `## GitHub Issues (${issueLimit} of ${report.github.issues.length})`,
    '',
    report.github.issues.slice(0, issueLimit).map(lineIssue).join('\n') || '- none',
    '',
    '## Kimi Sync',
    '',
    kimiStats,
    '',
    'Recent Kimi turns:',
    '',
    (report.kimi.recent || []).slice(0, full ? 30 : 12).map((r) => `- ${r.id} ${r.ts} ${r.agent}/${r.source}: ${clip(r.user_input, 180)}`).join('\n') || '- none',
    '',
    '## Historical Problem Classes',
    '',
    recurrence,
    '',
    '## Recent 7d Errors',
    '',
    errors,
    '',
    '## Sync Corners',
    '',
    syncCorners,
  ].join('\n');
}

export async function collectOutstandingSync(env, opts = {}) {
  const report = {
    generated_at: buildNowIso(),
    repo: REPO,
    github: await collectGithubIssues(env),
    tasks: await collectTasks(env),
    kimi: await collectKimi(env),
    problems: await collectProblems(env),
    stored: null,
  };
  let markdown = renderOutstandingMarkdown(report, { full: true });
  if (opts.store !== false) {
    report.stored = await storeReport(env, report, markdown);
    markdown = renderOutstandingMarkdown(report, { full: true });
    if (env.R2 && report.stored?.markdown_key) {
      await env.R2.put(report.stored.markdown_key, markdown, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
      await env.R2.put(report.stored.json_key, JSON.stringify(report, null, 2), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
    }
  }
  return {
    report,
    markdown,
    email_markdown: renderOutstandingMarkdown(report, { full: false }),
  };
}

export async function sendOutstandingSync(env, modeArg) {
  const mode = String(modeArg || '').toLowerCase().trim();
  const collected = await collectOutstandingSync(env, { store: true });
  if (mode === 'dry') return JSON.stringify({ ok: true, dry: true, report: collected.report }, null, 2);
  const { dispatch } = await import('../api/dispatch.js');
  const to = await ownerEmail(env);
  const subject = '[SYNC] outstanding issues/tasks/Kimi - ' + collected.report.generated_at.slice(0, 16);
  let email = '';
  let text = '';
  try {
    email = String((await dispatch(env, 'EMAIL_SEND', `${to}|${subject}|${collected.email_markdown}`, { actor: 'outstanding-sync' }))?.result || '');
  } catch (e) {
    email = 'ERR:' + (e && e.message || e);
  }
  try {
    const msg = [
      'Outstanding sync emailed.',
      `GitHub ${collected.report.github.open_count}.`,
      `Tasks ${collected.report.tasks.total_returned}.`,
      `Kimi ${collected.report.kimi.total_turns}.`,
      collected.report.stored?.latest_api || BASE + '/api/outstanding-sync?latest=1',
    ].join(' ');
    text = String((await dispatch(env, 'SEND_BY_CHANNEL', `blooio|${OWNER_PHONE}|${msg}`, { actor: 'outstanding-sync' }))?.result || '');
  } catch (e) {
    text = 'ERR:' + (e && e.message || e);
  }
  const eventId = await logEvent(env, {
    source: 'sync',
    key: 'OUTSTANDING_SYNC_EMAIL',
    action: 'sync_email',
    direction: 'out',
    status: String(email).startsWith('ERR:') ? 500 : 200,
    actor: 'outstanding-sync',
    request: { mode, repo: REPO },
    response: {
      subject,
      email: clip(email, 500),
      text: clip(text, 500),
      counts: {
        github_open: collected.report.github.open_count,
        tasks: collected.report.tasks.total_returned,
        kimi_turns: collected.report.kimi.total_turns,
      },
      stored: collected.report.stored,
    },
  });
  return JSON.stringify({
    ok: !String(email).startsWith('ERR:'),
    subject,
    email: clip(email, 500),
    imessage: clip(text, 500),
    event: eventId,
    counts: {
      github_open: collected.report.github.open_count,
      tasks: collected.report.tasks.total_returned,
      kimi_turns: collected.report.kimi.total_turns,
      kimi_desktop_turns: collected.report.kimi.desktop_turns,
    },
    stored: collected.report.stored,
  }, null, 2);
}
