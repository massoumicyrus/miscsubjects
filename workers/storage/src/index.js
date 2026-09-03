// miscsubjects-storage — the storage agent. Owns reference sprawl (vendored API docs, the
// old build, any bulk reference) so the kernel's deploy artifact stays lean. Bytes live
// in R2; a small queryable index lives in D1. Reached only via the STORE service binding
// from the Pages project (functions/api/store/[[path]].js) — no public route. Writes
// require the STORE_KEY header (attached by that proxy).
//
// Routes (pathname seen by the Worker):
//   GET    /f?path=<p>  | /f/<p>   -> fetch one object body
//   GET    /search?q=<q>           -> index lookup (path/tag LIKE %q%)
//   GET    /list?prefix=<p>        -> enumerate indexed paths under prefix
//   PUT    /f?path=<p>  | /f/<p>   -> store object + upsert index row (authed)
//   DELETE /f?path=<p>  | /f/<p>   -> remove object + index row (authed)

const SCHEMA = `CREATE TABLE IF NOT EXISTS store_index (
  path TEXT PRIMARY KEY,
  size INTEGER,
  sha  TEXT,
  tag  TEXT,
  ts   TEXT
)`;

function json(o, s) { return new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } }); }

async function ensure(env) { try { await env.DB.prepare(SCHEMA).run(); } catch (e) { /* table may already exist */ } }

function authed(request, env) {
  const got = (request.headers.get('x-store-key') || request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return !!env.STORE_KEY && got === env.STORE_KEY;
}

function fkey(url, p) {
  if (p.startsWith('/f/')) return decodeURIComponent(p.slice(3));
  return url.searchParams.get('path') || '';
}

async function sha256(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    await ensure(env);

    if (request.method === 'GET' && (p === '/f' || p.startsWith('/f/'))) {
      const key = fkey(url, p);
      if (!key) return json({ error: 'path required' }, 400);
      const obj = await env.R2.get(key);
      if (!obj) return json({ error: 'not_found', path: key }, 404);
      const body = await obj.text();
      return new Response(body, { headers: { 'content-type': obj.httpMetadata?.contentType || 'text/plain; charset=utf-8' } });
    }

    if (request.method === 'GET' && p === '/search') {
      const q = (url.searchParams.get('q') || '').trim();
      const toks = q.split(/\s+/).filter(Boolean).slice(0, 8);
      let r;
      if (toks.length === 0) {
        r = await env.DB.prepare('SELECT path, size, tag, ts FROM store_index ORDER BY path LIMIT 100').all();
      } else {
        const clause = toks.map(() => '(path LIKE ? OR tag LIKE ?)').join(' OR ');
        const binds = [];
        for (const t of toks) { binds.push('%' + t + '%', '%' + t + '%'); }
        r = await env.DB.prepare('SELECT path, size, tag, ts FROM store_index WHERE ' + clause + ' ORDER BY path LIMIT 100').bind(...binds).all();
      }
      const results = r.results || [];
      return json({ q, count: results.length, results });
    }

    if (request.method === 'GET' && p === '/list') {
      const prefix = url.searchParams.get('prefix') || '';
      const r = await env.DB.prepare(
        'SELECT path, size, tag, ts FROM store_index WHERE path LIKE ? ORDER BY path LIMIT 1000'
      ).bind(prefix + '%').all();
      const results = r.results || [];
      return json({ prefix, count: results.length, results });
    }

    if (request.method === 'PUT' && (p === '/f' || p.startsWith('/f/'))) {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      const key = fkey(url, p);
      if (!key) return json({ error: 'path required' }, 400);
      const buf = await request.arrayBuffer();
      const ct = request.headers.get('content-type') || 'text/plain; charset=utf-8';
      const tag = url.searchParams.get('tag') || key.split('/')[0] || '';
      await env.R2.put(key, buf, { httpMetadata: { contentType: ct } });
      const sha = await sha256(buf);
      await env.DB.prepare(
        'INSERT OR REPLACE INTO store_index (path, size, sha, tag, ts) VALUES (?, ?, ?, ?, ?)'
      ).bind(key, buf.byteLength, sha, tag, new Date().toISOString()).run();
      return json({ ok: true, path: key, size: buf.byteLength, sha, tag });
    }

    if (request.method === 'DELETE' && (p === '/f' || p.startsWith('/f/'))) {
      if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
      const key = fkey(url, p);
      if (!key) return json({ error: 'path required' }, 400);
      await env.R2.delete(key);
      await env.DB.prepare('DELETE FROM store_index WHERE path = ?').bind(key).run();
      return json({ ok: true, deleted: key });
    }

    return json({ error: 'no_route', method: request.method, path: p }, 404);
  },
};
