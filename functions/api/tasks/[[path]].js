// Tasks — the writer/build job queue, exposed over REST (formalizes ADDTASK/TASK_LIST/DONETASK).
// One row in the existing `tasks` table = one job; the full JSON job is stored in tasks.body,
// the role/phase in tasks.source.
//
//   POST /api/tasks               { phase|role, model, system_prompt, ask, post_to, item, ... }  -> { id }
//   GET  /api/tasks   ?status=open                                                               -> list
//   GET  /api/tasks   ?format=widgets                                                            -> HTML page of sideways task cards
//   GET  /api/tasks/next ?role=writer                                                            -> next open job
//   POST /api/tasks/<id>/done     { result? }                                                    -> mark done
//   POST /api/tasks/<id>/reopen                                                                  -> mark open
// Mutating calls require header x-terminal-key.

import { isBuildAuthed } from '../../_lib/admin_session.js';
import { normalizeWidget, renderRail, vaultStyles } from '../../_lib/vault_widgets.js';
import { invocationStats } from '../../_lib/invocation_log.js';
import { logEvent } from '../../_lib/event_log.js';
import { humanizeTask } from '../../_lib/task_text.js';

function json(o, status = 200) { return new Response(JSON.stringify(o, null, 2), { status, headers: { 'content-type': 'application/json' } }); }
async function authed(request, env) { return isBuildAuthed(request, env); }
function nowIso() { return new Date().toISOString(); }
function parseTask(r) {
  let job = null; try { job = JSON.parse(r.body); } catch {}
  return {
    id: r.id, status: r.status, role: r.source, created_at: r.created_at,
    google_task_id: r.google_task_id || null, trace_id: r.trace_id || null,
    parent_id: r.parent_id ?? null,
    human: humanizeTask(job ?? r.body, r.source, r.id),
    job: job || r.body,
  };
}
const TASK_COLS = 'id, status, body, source, created_at, google_task_id, trace_id, parent_id';

function taskWidgets(rows) {
  return rows.map(r => {
    const t = parseTask(r);
    const summary = (t.job && (t.job.ask || t.job.item || t.job.title || t.job.body)) || String(t.job || '').slice(0, 200);
    return normalizeWidget('task', {
      id: 'task:' + t.id,
      title: t.role + ' #' + t.id,
      body: summary,
      ts: t.created_at,
      status: t.status + (t.google_task_id ? ' · gtask' : ''),
      href: '/admin/tasks',
      api: '/api/tasks/' + t.id
    });
  });
}

function htmlPage(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>
:root{--bg:#f6f7f9;--ink:#111;--ink-soft:#445;--muted:#667;--line:#dde1e6;--line-strong:#c8cdd3;--accent:#0a52d0;--accent-soft:#e8f0fe;--sans:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 var(--sans);padding:24px}
${vaultStyles()}
</style></head><body>${body}</body></html>`;
}

async function create(env, b) {
  const ts = nowIso();
  const role = String(
    b.role || b.phase || (String(b.post_to || '').includes('/write') ? 'writer' : 'writer-queue'),
  );
  const traceId = b.trace_id ? String(b.trace_id) : 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const r = await env.DB.prepare('INSERT INTO tasks (created_at, status, body, source, trace_id) VALUES (?,?,?,?,?)').bind(ts, 'open', JSON.stringify(b), role, traceId).run();
  const out = { id: r.meta.last_row_id, status: 'open', role, created_at: ts, trace_id: traceId };
  await logEvent(env, {
    source: 'tasks', key: 'TASK_CREATE', action: 'task_create', direction: 'in', status: 200,
    trace_id: traceId, request: b, response: out,
  });
  return out;
}
async function taskStats(env) {
  const rows =
    (
      await env.DB.prepare(
        "SELECT status, source, body FROM tasks WHERE status IN ('open','running','done')",
      ).all()
    ).results || [];
  const byStatus = {};
  const bySource = {};
  const byPostTo = {};
  let open = 0;
  let running = 0;
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    if (r.status === 'open') open++;
    if (r.status === 'running') running++;
    const src = String(r.source || 'unknown').toLowerCase();
    bySource[src] = (bySource[src] || 0) + 1;
    let postTo = '?';
    try {
      postTo = JSON.parse(r.body || '{}').post_to || '?';
    } catch {}
    const key = src + ' · ' + postTo;
    byPostTo[key] = (byPostTo[key] || 0) + 1;
  }
  const invocations = await invocationStats(env, 24);
  return {
    total_rows: rows.length,
    open,
    running,
    by_status: byStatus,
    by_source: bySource,
    by_source_post_to: byPostTo,
    invocations_24h: invocations,
    note: 'Full queue depth — list endpoint still caps at 100 rows per status.',
    cron: 'writer_queue_autorun=1 → ~1 task/min via sibling cron',
    github_loop: 'github_loop_autorun=1 → ~1 issue tick/min via sibling → POST /api/github-loop/run',
    observe: {
      admin: '/admin/tasks?data=1',
      next: '/api/protocol/next?role=writer-queue',
      manual_tick: 'POST /api/protocol/run?role=writer-queue',
      github_loop_widgets: '/api/github-loop?format=widgets',
      github_loop_stats: '/api/github-loop?stats=1',
      waste: '/api/invocations?waste=1',
    },
  };
}
async function list(env, status) {
  const st = String(status || 'open');
  const rows = (await env.DB.prepare('SELECT id, status, body, source, created_at, google_task_id, trace_id, parent_id FROM tasks WHERE status=? ORDER BY id DESC LIMIT 100').bind(st).all()).results || [];
  return { status: st, count: rows.length, tasks: rows.map(parseTask) };
}
async function nextTask(env, role) {
  const want = String(role || '').toLowerCase().trim();
  let rows = [];
  if (want === 'writer-queue') {
    const { WRITER_QUEUE_ORDER_SQL, writerQueueBindParams, writerQueueInClause } = await import('../../_lib/writer_queue_roles.js');
    rows = (await env.DB.prepare(
      "SELECT id, status, body, source, created_at, google_task_id, trace_id FROM tasks WHERE status='open' AND LOWER(COALESCE(source,'')) IN (" + writerQueueInClause() + ") ORDER BY " + WRITER_QUEUE_ORDER_SQL + " LIMIT 1"
    ).bind(...writerQueueBindParams()).all()).results || [];
  } else if (want) {
    rows = (await env.DB.prepare("SELECT id, status, body, source, created_at, google_task_id, trace_id FROM tasks WHERE status='open' AND LOWER(COALESCE(source,'')) LIKE ? ORDER BY id LIMIT 1").bind('%' + want + '%').all()).results || [];
  } else {
    rows = (await env.DB.prepare("SELECT id, status, body, source, created_at, google_task_id, trace_id FROM tasks WHERE status='open' ORDER BY id LIMIT 1").all()).results || [];
  }
  if (rows.length) return parseTask(rows[0]);
  // fallback: role declared inside the JSON body rather than on source
  if (want) {
    const scan = (await env.DB.prepare("SELECT id, status, body, source, created_at, google_task_id, trace_id FROM tasks WHERE status='open' ORDER BY id DESC LIMIT 100").all()).results || [];
    for (const r of scan) { const t = parseTask(r); const jrole = String((t.job && (t.job.role || t.job.phase)) || '').toLowerCase(); if (jrole.includes(want)) return t; }
  }
  return { task: null, note: 'no open task' + (want ? ' for role ' + want : '') };
}
async function setStatus(env, id, status, result) {
  const a = await env.DB.prepare('SELECT id, status, source, trace_id FROM tasks WHERE id=?').bind(Number(id)).first();
  if (!a) return { error: 'task not found: ' + id };
  await env.DB.prepare('UPDATE tasks SET status=?, trace=COALESCE(?, trace) WHERE id=?').bind(status, result != null ? String(result).slice(0, 4000) : null, Number(id)).run();
  await logEvent(env, {
    source: 'tasks', key: 'TASK_' + status.toUpperCase(), action: 'task_' + status, direction: 'in', status: 200,
    trace_id: a.trace_id || null,
    request: { id: Number(id), from: a.status, to: status, result: result != null ? String(result).slice(0, 4000) : null },
    response: { id: Number(id), status },
  });
  return { id: Number(id), status, trace_id: a.trace_id || null };
}
// Edit a task: merge JSON fields into body, and/or set status / parent_id / source.
async function editTask(env, id, patch) {
  const a = await env.DB.prepare('SELECT id, body, status, source, parent_id, trace_id FROM tasks WHERE id=?').bind(Number(id)).first();
  if (!a) return { error: 'task not found: ' + id };
  let job = {}; try { job = JSON.parse(a.body || '{}'); if (!job || typeof job !== 'object') job = { text: a.body }; } catch { job = { text: a.body }; }
  if (patch.text != null) job.text = String(patch.text);
  if (patch.title != null) job.title = String(patch.title);
  if (patch.job && typeof patch.job === 'object') job = { ...job, ...patch.job };
  const status = patch.status != null ? String(patch.status) : a.status;
  const source = patch.source != null ? String(patch.source) : a.source;
  const parent = patch.parent_id === null ? null : (patch.parent_id != null ? Number(patch.parent_id) : a.parent_id);
  await env.DB.prepare('UPDATE tasks SET body=?, status=?, source=?, parent_id=? WHERE id=?')
    .bind(JSON.stringify(job), status, source, parent, Number(id)).run();
  await logEvent(env, {
    source: 'tasks', key: 'TASK_EDIT', action: 'task_edit', direction: 'in', status: 200, trace_id: a.trace_id || null,
    request: { id: Number(id), patch }, response: { id: Number(id), status, source, parent_id: parent },
  });
  const row = await env.DB.prepare('SELECT ' + TASK_COLS + ' FROM tasks WHERE id=?').bind(Number(id)).first();
  return parseTask(row);
}
async function deleteTask(env, id) {
  const a = await env.DB.prepare('SELECT id, status, source, body, trace_id FROM tasks WHERE id=?').bind(Number(id)).first();
  if (!a) return { error: 'task not found: ' + id };
  // Orphan children up to top level so a deleted parent never hides live subtasks.
  await env.DB.prepare('UPDATE tasks SET parent_id=NULL WHERE parent_id=?').bind(Number(id)).run();
  await env.DB.prepare('DELETE FROM tasks WHERE id=?').bind(Number(id)).run();
  await logEvent(env, {
    source: 'tasks', key: 'TASK_DELETE', action: 'task_delete', direction: 'in', status: 200, trace_id: a.trace_id || null,
    request: { id: Number(id), was: { status: a.status, source: a.source } }, response: { id: Number(id), deleted: true },
  });
  return { id: Number(id), deleted: true };
}
async function threadTask(env, id, parentId) {
  const pid = parentId == null || parentId === '' ? null : Number(parentId);
  if (pid != null && pid === Number(id)) return { error: 'a task cannot be its own parent' };
  if (pid != null) {
    const p = await env.DB.prepare('SELECT id FROM tasks WHERE id=?').bind(pid).first();
    if (!p) return { error: 'parent task not found: ' + pid };
  }
  return editTask(env, id, { parent_id: pid });
}

async function handle(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean); // ['api','tasks', seg?, sub?]
  const seg = parts[2];
  const sub = (parts[3] || '').toLowerCase();
  const mutates = (method !== 'GET');
  if (mutates && !(await authed(request, env))) return json({ error: 'unauthorized — header x-terminal-key required' }, 401);

  if (method === 'GET' && !seg) {
    if (url.searchParams.get('stats') === '1') {
      if (!(await authed(request, env))) return json({ error: 'unauthorized — header x-terminal-key required' }, 401);
      return json(await taskStats(env));
    }
    const status = url.searchParams.get('status');
    const fmt = url.searchParams.get('format');
    const rows = (await env.DB.prepare('SELECT id, status, body, source, created_at, google_task_id, trace_id, parent_id FROM tasks WHERE status=? ORDER BY id DESC LIMIT 100').bind(String(status || 'open')).all()).results || [];
    if (fmt === 'widgets') {
      const widgets = taskWidgets(rows);
      const page = htmlPage('Tasks widgets', `<div class="vault-shell"><section class="vault-hero"><div><h1>Tasks widgets</h1><p>Sideways cards for every job in the queue.</p></div><div class="vault-actions"><a href="/api/tasks?format=json">JSON</a><a href="/admin/tasks">Admin</a></div></section>${renderRail('Tasks', widgets, '/api/tasks?format=json')}</div>`);
      return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    return json({ status: String(status || 'open'), count: rows.length, tasks: rows.map(parseTask) });
  }
  if (method === 'GET' && seg === 'next') return json(await nextTask(env, url.searchParams.get('role')));
  if (method === 'POST' && !seg) { const b = await request.json().catch(() => ({})); return json(await create(env, b)); }
  if (method === 'POST' && seg && sub === 'done') { const b = await request.json().catch(() => ({})); const out = await setStatus(env, seg, 'done', b.result); return json(out, out.error ? 404 : 200); }
  if (method === 'POST' && seg && sub === 'reopen') { const out = await setStatus(env, seg, 'open', null); return json(out, out.error ? 404 : 200); }
  if (method === 'POST' && seg && sub === 'thread') { const b = await request.json().catch(() => ({})); const out = await threadTask(env, seg, b.parent_id); return json(out, out.error ? 404 : 200); }
  if ((method === 'PATCH' || (method === 'POST' && sub === 'edit')) && seg) { const b = await request.json().catch(() => ({})); const out = await editTask(env, seg, b); return json(out, out.error ? 404 : 200); }
  if ((method === 'DELETE' || (method === 'POST' && sub === 'delete')) && seg) { const out = await deleteTask(env, seg); return json(out, out.error ? 404 : 200); }
  if (method === 'POST' && seg === 'reset-stuck') {
    const r = await env.DB.prepare("UPDATE tasks SET status='open' WHERE status='running'").run();
    return json({ ok: true, reset_stuck_tasks: r.meta?.changes ?? 0 });
  }
  if (method === 'POST' && seg === 'purge-stale-writes') {
    const r = await env.DB.prepare(
      "UPDATE tasks SET status='cancelled' WHERE status='open' AND LOWER(COALESCE(source,''))='writer' AND id < ?",
    ).bind(Number((await request.json().catch(() => ({}))).before_id || 1950)).run();
    return json({ ok: true, cancelled_stale_writes: r.meta?.changes ?? 0 });
  }
  if (method === 'POST' && seg === 'purge-tail') {
    const r = await env.DB.prepare(
      "UPDATE tasks SET status='cancelled' WHERE status='open' AND (" +
        "body LIKE '%/api/protocol/fill-slots%' OR " +
        "body LIKE '%/api/protocol/critique%' OR " +
        "body LIKE '%/api/protocol/poll%' OR " +
        "body LIKE '%/api/protocol/collaborate%' OR " +
        "body LIKE '%/api/protocol/synthesize-body%'" +
      ")",
    ).run();
    return json({ ok: true, cancelled_tail_tasks: r.meta?.changes ?? 0 });
  }
  return json({ error: 'not found: ' + method + ' ' + url.pathname }, 404);
}

export async function onRequest(context) {
  try { return await handle(context.request, context.env); }
  catch (e) { return json({ error: 'unhandled: ' + (e && e.message || String(e)) }, 500); }
}
