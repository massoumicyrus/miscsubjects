import { isBuildAuthed } from '../_lib/admin_session.js';
import { collectOutstandingSync, loadLatestOutstandingSync, sendOutstandingSync } from '../_lib/outstanding_sync.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function text(body, contentType = 'text/plain; charset=utf-8', status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': contentType, 'cache-control': 'no-store' },
  });
}

async function authed(request, env) {
  return isBuildAuthed(request, env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
  const url = new URL(request.url);
  const format = String(url.searchParams.get('format') || '').toLowerCase();
  if (url.searchParams.get('latest') === '1') {
    const latest = await loadLatestOutstandingSync(env);
    if (!latest) return json({ error: 'no latest outstanding sync report' }, 404);
    if (format === 'markdown' || format === 'md') return text(latest.markdown || '', 'text/markdown; charset=utf-8');
    return json(latest);
  }
  const collected = await collectOutstandingSync(env, { store: false });
  if (format === 'markdown' || format === 'md') return text(collected.markdown, 'text/markdown; charset=utf-8');
  return json(collected.report);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
  const body = await request.json().catch(() => ({}));
  const mode = body.mode || new URL(request.url).searchParams.get('mode') || '';
  const out = await sendOutstandingSync(env, mode);
  try { return json(JSON.parse(out)); } catch { return text(out); }
}
