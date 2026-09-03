function json(o, s) { return new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } }); }
function authed(request, env) { return !!env.TERMINAL_KEY && (request.headers.get('x-terminal-key') || '') === env.TERMINAL_KEY; }
function keyOf(context) {
  const p = context.params && context.params.path;
  if (Array.isArray(p)) return p.join('/');
  return String(p || '');
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.R2) return json({ error: 'no R2 binding' }, 500);
  const u = new URL(request.url);

  if (u.searchParams.get('list')) {
    if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
    const prefix = u.searchParams.get('prefix') || undefined;
    const limit = Math.min(parseInt(u.searchParams.get('limit') || '1000', 10) || 1000, 1000);
    const cursor = u.searchParams.get('cursor') || undefined;
    const r = await env.R2.list({ prefix, limit, cursor });
    return json({
      objects: (r.objects || []).map(o => ({
        key: o.key, size: o.size,
        uploaded: o.uploaded ? o.uploaded.toISOString() : null,
        etag: o.etag || null, httpEtag: o.httpEtag || null,
        contentType: (o.httpMetadata && o.httpMetadata.contentType) || null,
      })),
      truncated: !!r.truncated, cursor: r.cursor || null,
    });
  }

  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  const key = keyOf(context);
  if (!key) return json({ error: 'key required' }, 400);
  const obj = await env.R2.get(key);
  if (!obj) return json({ error: 'not found', key }, 404);
  const headers = new Headers();
  const ct = (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream';
  headers.set('content-type', ct);
  if (obj.size != null) headers.set('content-length', String(obj.size));
  if (obj.httpEtag) headers.set('etag', obj.httpEtag);
  return new Response(obj.body, { headers });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  if (!env.R2) return json({ error: 'no R2 binding' }, 500);
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  const key = keyOf(context);
  if (!key) return json({ error: 'key required' }, 400);
  const ct = request.headers.get('content-type') || 'application/octet-stream';
  const buf = await request.arrayBuffer();
  await env.R2.put(key, buf, { httpMetadata: { contentType: ct } });
  return json({ ok: true, key, bytes: buf.byteLength, contentType: ct });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!env.R2) return json({ error: 'no R2 binding' }, 500);
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  const key = keyOf(context);
  if (!key) return json({ error: 'key required' }, 400);
  await env.R2.delete(key);
  return json({ ok: true, key, deleted: true });
}
