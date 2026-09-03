/**
 * GitHub issue loop API — same shape as /api/tasks + /api/protocol/run for articles.
 *   GET  /api/github-loop?stats=1          counts + mirror status
 *   GET  /api/github-loop?format=widgets   sideways issue cards
 *   POST /api/github-loop/run              one tick (close oldest [auto], then open one) via Mac
 *   POST /api/github-loop/sync             mirror open [auto] issues → tasks table
 */
import { isBuildAuthed } from '../../_lib/admin_session.js';
import { dispatch } from '../dispatch.js';
import { normalizeWidget, renderRail, vaultStyles } from '../../_lib/vault_widgets.js';
import {
  fetchGithubIssues,
  syncGithubIssuesToTasks,
  githubLoopStats,
  issueWidgets,
} from '../../_lib/github_loop.js';

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function htmlPage(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
:root{--bg:#f6f7f9;--ink:#111;--ink-soft:#445;--muted:#667;--line:#dde1e6;--line-strong:#c8cdd3;--accent:#0a52d0;--accent-soft:#e8f0fe;--sans:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 var(--sans);padding:24px}
${vaultStyles()}
</style></head><body>${body}</body></html>`;
}

const TICK_CMD =
  'cd /Users/owner/miscsubjects-pages && /Users/owner/.nvm/versions/node/v24.16.0/bin/node scripts/tick.mjs 2>&1';

async function handle(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const seg = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean)[2] || '';

  if (method === 'GET' && !seg) {
    if (url.searchParams.get('stats') === '1') {
      if (!(await isBuildAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      return json(await githubLoopStats(env));
    }
    if (url.searchParams.get('format') === 'widgets') {
      const { issues, error } = await fetchGithubIssues(env, { state: 'all', perPage: 40 });
      const auto = issues.filter((i) => /^\[(auto|build|audit)/i.test(i.title || ''));
      const widgets = issueWidgets(auto).map((w) => normalizeWidget('github-issue', w));
      const stats = await githubLoopStats(env);
      const page = htmlPage(
        'GitHub loop',
        `<div class="vault-shell"><section class="vault-hero"><div><h1>GitHub loop</h1><p>Open/close [auto] tickets like article tasks — ${stats.github?.auto_open ?? '?'} open, ${stats.github?.auto_closed ?? '?'} closed.</p></div><div class="vault-actions"><a href="/api/github-loop?stats=1">Stats JSON</a><a href="/api/tasks?format=widgets">Tasks</a><a href="https://github.com/[OWNER_HANDLE]/miscsubjects-pages/issues">GitHub</a></div></section>${renderRail('Issues', widgets, '/api/github-loop?format=widgets')}</div>`,
      );
      return new Response(page, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    return json(await githubLoopStats(env));
  }

  if (!(await isBuildAuthed(request, env))) return json({ error: 'unauthorized — x-terminal-key required' }, 401);

  if (method === 'POST' && (seg === 'sync' || !seg && url.searchParams.get('sync') === '1')) {
    return json(await syncGithubIssuesToTasks(env));
  }

  if (method === 'POST' && (seg === 'run' || !seg)) {
    const sync = await syncGithubIssuesToTasks(env);
    let tick = { skipped: true, reason: 'bridge' };
    try {
      const raw = await dispatch(env, 'LOCAL_EXEC', TICK_CMD);
      const m = String(raw?.result || raw || '').match(/^HTTP (\d+):([\s\S]*)$/);
      if (m) {
        let j;
        try { j = JSON.parse(m[2]); } catch { j = { stdout: m[2] }; }
        let parsed = null;
        try {
          const out = String(j.stdout || '').trim();
          const line = out.split('\n').filter((x) => x.startsWith('{')).pop();
          if (line) parsed = JSON.parse(line);
        } catch {}
        tick = { ok: j.ok, exit: j.exit, parsed, stdout_tail: String(j.stdout || '').slice(-800) };
      } else {
        tick = { raw: String(raw?.result || raw || '').slice(0, 1200) };
      }
    } catch (e) {
      tick = { error: String(e?.message || e) };
    }
    const after = await syncGithubIssuesToTasks(env);
    return json({ ts: new Date().toISOString(), sync_before: sync, tick, sync_after: after });
  }

  return json({ error: 'not found: ' + method + ' ' + url.pathname }, 404);
}

export async function onRequest(context) {
  try {
    return await handle(context.request, context.env);
  } catch (e) {
    return json({ error: 'unhandled: ' + (e?.message || String(e)) }, 500);
  }
}