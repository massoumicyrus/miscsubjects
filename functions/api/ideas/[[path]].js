// Idea Preservation System — Macro to Micro
// POST ideas, link them, track them from raw → implemented

function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
}
function nowIso() { return new Date().toISOString(); }
function authed(request, env) {
  return !!env.TERMINAL_KEY && (request.headers.get('x-terminal-key') || '') === env.TERMINAL_KEY;
}

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function listIdeas(env, level, status, tag) {
  let sql = 'SELECT id, level, title, status, parent_id, tags, links, source, author, created_at, updated_at FROM ideas';
  const where = [];
  const binds = [];
  if (level) { where.push('level = ?'); binds.push(level); }
  if (status) { where.push('status = ?'); binds.push(status); }
  if (tag) { where.push('tags LIKE ?'); binds.push('%"' + tag + '"%'); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT 500';
  const r = await env.DB.prepare(sql).bind(...binds).all();
  return json({ ideas: r.results || [] });
}

async function getIdea(env, id) {
  const row = await env.DB.prepare('SELECT * FROM ideas WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'not found' }, 404);
  const children = await env.DB.prepare('SELECT id, level, title, status, created_at FROM ideas WHERE parent_id = ? ORDER BY created_at').bind(id).all();
  return json({ idea: row, children: children.results || [] });
}

async function createIdea(env, b) {
  const id = b.id || 'idea_' + crypto.randomUUID().replace(/-/g, '');
  const level = String(b.level || 'meso');
  const title = String(b.title || '').trim();
  const body = String(b.body || '');
  if (!title) return json({ error: 'title required' }, 400);
  const tags = JSON.stringify(b.tags || []);
  const links = JSON.stringify(b.links || []);
  const source = String(b.source || 'rest');
  const author = String(b.author || 'anonymous');
  const parent_id = b.parent_id || null;
  const status = 'raw';
  const ts = nowIso();
  const contentHash = await sha256([id, level, title, body, tags, links, source, author, ts].join('|'));
  await env.DB.prepare(
    `INSERT INTO ideas (id, level, title, body, status, parent_id, tags, links, source, author, hash, prev_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, level, title, body, status, parent_id, tags, links, source, author, contentHash, 'genesis', ts, ts).run();
  return json({ id, level, title, status, hash: contentHash, created_at: ts });
}

async function updateIdea(env, id, b) {
  const row = await env.DB.prepare('SELECT * FROM ideas WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'not found' }, 404);
  const title = b.title != null ? String(b.title) : row.title;
  const body = b.body != null ? String(b.body) : row.body;
  const status = b.status != null ? String(b.status) : row.status;
  const tags = b.tags != null ? JSON.stringify(b.tags) : row.tags;
  const links = b.links != null ? JSON.stringify(b.links) : row.links;
  const ts = nowIso();
  const prevHash = row.hash;
  const newHash = await sha256([id, row.level, title, body, tags, links, row.source, row.author, ts, prevHash].join('|'));
  await env.DB.prepare(
    `UPDATE ideas SET title=?, body=?, status=?, tags=?, links=?, hash=?, prev_hash=?, updated_at=? WHERE id=?`
  ).bind(title, body, status, tags, links, newHash, prevHash, ts, id).run();
  return json({ id, status, hash: newHash, prev_hash: prevHash, updated_at: ts });
}

async function handle(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const id = parts[2];
  
  if (method === 'GET' && !id) {
    return listIdeas(env, url.searchParams.get('level'), url.searchParams.get('status'), url.searchParams.get('tag'));
  }
  if (method === 'POST' && !id) {
    if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
    const b = await request.json().catch(() => ({}));
    return createIdea(env, b);
  }
  if (method === 'GET' && id) {
    return getIdea(env, id);
  }
  if (method === 'PATCH' && id) {
    if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
    const b = await request.json().catch(() => ({}));
    return updateIdea(env, id, b);
  }
  if (method === 'DELETE' && id) {
    if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);
    return updateIdea(env, id, { status: 'archived' });
  }
  return json({ error: 'method not allowed' }, 405);
}

export async function onRequest(context) {
  try { return await handle(context.request, context.env); }
  catch (e) { return json({ error: 'unhandled: ' + (e?.message || String(e)) }, 500); }
}
