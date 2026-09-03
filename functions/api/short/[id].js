const BASE = 'https://miscsubjects.com';

function json(o, s) { return new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } }); }
function authed(request, env) { return !!env.TERMINAL_KEY && (request.headers.get('x-terminal-key') || '') === env.TERMINAL_KEY; }

async function resolve(env, shortId) {
  const r = await fetch(`${BASE}/api/inventory?short_id=${encodeURIComponent(shortId)}`);
  if (!r.ok) return null;
  return await r.json();
}

function fwdAuth(env) { return { 'x-terminal-key': env.TERMINAL_KEY || '' }; }

export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  const row = await resolve(env, String(params.id));
  if (!row) return json({ error: 'no row for short_id', short_id: String(params.id) }, 404);

  // Fetch the actual content from the underlying read URL.
  const r = await fetch(row.read, { headers: fwdAuth(env) });
  const ct = r.headers.get('content-type') || '';
  let content;
  if (ct.includes('application/json')) content = await r.json();
  else content = await r.text();

  return json({
    short_id: row.short_id, kind: row.kind, name: row.name,
    read: row.read, edit: row.edit, edit_method: row.edit_method, edit_body: row.edit_body,
    status: r.status, content,
  });
}

export async function onRequestPut(context) { return forwardEdit(context, 'PUT'); }
export async function onRequestPatch(context) { return forwardEdit(context, 'PATCH'); }
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  const row = await resolve(env, String(params.id));
  if (!row) return json({ error: 'no row for short_id', short_id: String(params.id) }, 404);
  const r = await fetch(row.edit, { method: 'DELETE', headers: fwdAuth(env) });
  const text = await r.text();
  return new Response(text, { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json' } });
}

async function forwardEdit(context, defaultMethod) {
  const { request, env, params } = context;
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  const row = await resolve(env, String(params.id));
  if (!row) return json({ error: 'no row for short_id', short_id: String(params.id) }, 404);
  // Use the surface's declared edit_method (PATCH for directory/article/page, PUT for settings/kv/r2/file).
  const method = row.edit_method || defaultMethod;
  const body = await request.text();
  const ct = request.headers.get('content-type') || 'application/json';
  const r = await fetch(row.edit, { method, headers: { 'content-type': ct, ...fwdAuth(env) }, body });
  const text = await r.text();
  return new Response(text, { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json' } });
}
