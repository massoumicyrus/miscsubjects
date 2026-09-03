// T13 — declared internal position. Every directory row/tool/agent has a slug (its
// key). Invoke the slug via REST at this declared place:
//   GET  /s/<slug>          → resolve: what the slug maps to + how to invoke it
//   POST /s/<slug> {body}   → act on it: dispatch the slug, return the result
// Resolution is authoritative against the directory table; the DirectoryDO registry is
// the durable mirror used by the dashboard.
import { dispatch } from '../api/dispatch.js';
import { deriveInvoke, renderInvokeText } from '../_lib/invoke_spec.js';

function json(o, status) {
  return new Response(JSON.stringify(o, null, 2), { status: status || 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const slug = String(params.slug);
  const row = await env.DB.prepare('SELECT key, type, target, auth, content, category FROM directory WHERE key = ?').bind(slug).first();
  if (!row) return json({ ok: false, slug, error: 'no_such_slug' }, 404);
  const spec = row.type === 'agent'
    ? { note: 'agent — send it a message as the body; it replies and may emit tools.' }
    : deriveInvoke(row);
  return json({
    ok: true, slug, type: row.type, target: row.target, category: row.category,
    // Exactly what it is and exactly how to call it — derived from this row's own definition.
    invoke: spec,
    invoke_readme: row.type === 'agent' ? null : renderInvokeText(spec, null),
  });
}

export async function onRequestPost(context) {
  const { env, params, request } = context;
  const slug = String(params.slug);
  let body = '';
  try { const b = await request.json(); body = b && b.body != null ? String(b.body) : ''; } catch { body = await request.text(); }
  const r = await dispatch(env, slug, body, {});
  return json({ ok: true, slug, trace: r.trace, result: r.result, cost: r.cost });
}
