function json(o, s) { return new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } }); }
function authed(request, env) { return !!env.TERMINAL_KEY && (request.headers.get('x-terminal-key') || '') === env.TERMINAL_KEY; }

const ARTICLE_BACKGROUND_LOCK_KEY = 'article_background_writes_locked';
const LOCKED_AUTORUN_KEYS = new Set([
  'selftest_autorun',
  'protocol_autorun',
  'writer_queue_autorun',
  'source_hunt_autorun',
  'article_qa_autorun',
  'oip_review_autorun',
  'editorial_board_autorun',
  'graph_grow_autorun',
]);
function flagEnables(value) { return /^(1|true|on|yes)$/i.test(String(value || '').trim()); }
async function articleBackgroundWritesLocked(env) {
  return (await env.KV.get(ARTICLE_BACKGROUND_LOCK_KEY)) === '1';
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const u = new URL(request.url);
  if (!env.KV) return json({ error: 'no KV binding' }, 500);

  if (u.searchParams.get('list')) {
    if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
    const prefix = u.searchParams.get('prefix') || undefined;
    const limit = Math.min(parseInt(u.searchParams.get('limit') || '1000', 10) || 1000, 1000);
    const cursor = u.searchParams.get('cursor') || undefined;
    const r = await env.KV.list({ prefix, limit, cursor });
    return json({ keys: (r.keys || []).map(k => ({ name: k.name, expiration: k.expiration || null, metadata: k.metadata || null })), list_complete: r.list_complete, cursor: r.cursor || null });
  }

  const key = u.searchParams.get('key') || '';
  if (!key) return json({ error: 'key required' }, 400);

  if (key === 'repo:snapshot:current' && !authed(request, env)) {
    const snap = await env.KV.get(key, 'json');
    if (!snap) return json({ error: 'not found', key }, 404);
    return json({ sha: snap.sha, ts: snap.ts, byte_count: snap.byte_count });
  }
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);

  const v = await env.KV.get(key);
  if (v == null) return json({ error: 'not found', key }, 404);
  let isJson = false; try { JSON.parse(v); isJson = true; } catch {}
  return new Response(v, { headers: { 'content-type': isJson ? 'application/json' : 'text/plain; charset=utf-8' } });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  if (!env.KV) return json({ error: 'no KV binding' }, 500);
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  const u = new URL(request.url);
  const key = u.searchParams.get('key') || '';
  if (!key) return json({ error: 'key required' }, 400);
  const value = await request.text();
  if (key === ARTICLE_BACKGROUND_LOCK_KEY && !flagEnables(value)) {
    return json({ error: 'locked', reason: 'article_background_writes_locked cannot be disabled through /api/kv' }, 423);
  }
  if (key === 'selftest_master' && flagEnables(value)) {
    return json({ error: 'locked', reason: 'selftest_master ON only via /api/selftest set_master + confirm ENABLE SELFTEST' }, 423);
  }
  if (key === 'selftest_autorun' && flagEnables(value)) {
    return json({ error: 'locked', reason: 'selftest_autorun ON only via /api/selftest set_autorun + confirm ENABLE SELFTEST AUTORUN' }, 423);
  }
  if (LOCKED_AUTORUN_KEYS.has(key) && flagEnables(value) && await articleBackgroundWritesLocked(env)) {
    return json({ error: 'locked', reason: 'background article writing and self-testing are disabled by the owner' }, 423);
  }
  const ttl = parseInt(u.searchParams.get('ttl') || '', 10);
  const opts = {};
  if (Number.isFinite(ttl) && ttl > 0) opts.expirationTtl = ttl;
  await env.KV.put(key, value, opts);
  return json({ ok: true, key, bytes: value.length, ttl: opts.expirationTtl || null });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!env.KV) return json({ error: 'no KV binding' }, 500);
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
  const u = new URL(request.url);
  const key = u.searchParams.get('key') || '';
  if (!key) return json({ error: 'key required' }, 400);
  if (key === ARTICLE_BACKGROUND_LOCK_KEY) {
    return json({ error: 'locked', reason: 'article_background_writes_locked cannot be deleted through /api/kv' }, 423);
  }
  if (key === 'selftest_master') {
    return json({ error: 'locked', reason: 'selftest_master cannot be deleted — set_master off or kill' }, 423);
  }
  await env.KV.delete(key);
  return json({ ok: true, key, deleted: true });
}
