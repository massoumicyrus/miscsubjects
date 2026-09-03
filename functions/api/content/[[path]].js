// REST API over content_items + content_versions + content_comments.
// Routes:
//   GET    /api/content                  list (?type ?status ?section ?tag ?q ?limit)
//   POST   /api/content                  create
//   GET    /api/content/types            distinct types + counts
//   GET    /api/content/search?q=        search title/body/tags
//   GET    /api/content/<slug>           one item
//   PATCH  /api/content/<slug>           update (snapshots a new version)
//   DELETE /api/content/<slug>           delete item + its versions + comments
//   GET    /api/content/<slug>/versions  version history
//   GET    /api/content/<slug>/comments  model comments
//   POST   /api/content/<slug>/comments  add a model comment

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}
function authed(request, env) { return !!env.TERMINAL_KEY && (request.headers.get('x-terminal-key') || '') === env.TERMINAL_KEY; }
function nowIso() { return new Date().toISOString(); }
function slugify(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function asJsonString(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return null; }
}

async function listItems(env, url) {
  const titleExact = url.searchParams.get('title');
  if (titleExact) {
    const r = await env.DB.prepare('SELECT * FROM content_items WHERE title = ?').bind(titleExact).first();
    return r ? json({ item: parseRow(r) }) : json({ error: 'not found', title: titleExact }, 404);
  }
  const type = url.searchParams.get('type');
  const status = url.searchParams.get('status');
  const section = url.searchParams.get('section');
  const tag = url.searchParams.get('tag');
  const q = url.searchParams.get('q');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '2000', 10) || 2000, 5000);
  const where = [];
  const binds = [];
  if (type) { where.push('type = ?'); binds.push(type); }
  if (status) { where.push('status = ?'); binds.push(status); }
  if (section) { where.push('section = ?'); binds.push(section); }
  if (tag) { where.push('tags_json LIKE ?'); binds.push('%"' + tag + '"%'); }
  if (q) { where.push('(title LIKE ? OR body_md LIKE ? OR tags_json LIKE ?)'); binds.push('%' + q + '%', '%' + q + '%', '%' + q + '%'); }
  const sql = 'SELECT slug, type, title, section, status, tags_json, source_doc, source_order, updated_at FROM content_items'
    + (where.length ? ' WHERE ' + where.join(' AND ') : '')
    + ' ORDER BY type ASC, (source_order IS NULL), source_order ASC, slug ASC LIMIT ' + limit;
  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return json({ count: (rows.results || []).length, items: rows.results || [] });
}

async function typeCounts(env) {
  const rows = await env.DB.prepare(
    'SELECT type, COUNT(*) AS n FROM content_items GROUP BY type ORDER BY n DESC'
  ).all();
  return json({ types: rows.results || [] });
}

function parseRow(r) {
  if (!r) return r;
  return {
    ...r,
    body_json: r.body_json ? safeParse(r.body_json) : null,
    tags: r.tags_json ? safeParse(r.tags_json) : [],
  };
}
function safeParse(s) { try { return JSON.parse(s); } catch { return s; } }

async function getItem(env, slug) {
  const r = await env.DB.prepare('SELECT * FROM content_items WHERE slug = ?').bind(slug).first();
  if (!r) return json({ error: 'not found' }, 404);
  return json({ item: parseRow(r) });
}

async function createItem(env, body) {
  const slug = slugify(body.slug || body.title);
  const type = String(body.type || '').trim();
  const title = String(body.title || '').trim();
  if (!slug || !type || !title) return json({ error: 'slug (or title), type, and title required' }, 400);
  const section = body.section != null ? String(body.section) : null;
  const body_md = body.body_md != null ? String(body.body_md) : '';
  const body_json = asJsonString(body.body_json);
  const status = body.status || 'active';
  const tags_json = asJsonString(body.tags ?? body.tags_json) || '[]';
  const source_doc = body.source_doc != null ? String(body.source_doc) : null;
  const source_order = body.source_order != null ? parseInt(body.source_order, 10) : null;
  const ts = nowIso();
  try {
    await env.DB.prepare(
      `INSERT INTO content_items(slug,type,title,section,body_md,body_json,status,tags_json,source_doc,source_order,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(slug, type, title, section, body_md, body_json, status, tags_json, source_doc, source_order, ts, ts).run();
  } catch (e) {
    return json({ error: 'insert failed: ' + e.message }, 400);
  }
  const row = await env.DB.prepare('SELECT * FROM content_items WHERE slug=?').bind(slug).first();
  await snapshot(env, row, 1, 'create', body.created_by || 'operator', ts);
  return json({ item: parseRow(row), version: 1 });
}

async function snapshot(env, row, version, note, by, ts) {
  await env.DB.prepare(
    `INSERT INTO content_versions(item_slug,version,snapshot_json,change_note,created_by,created_at)
     VALUES (?,?,?,?,?,?)`
  ).bind(row.slug, version, JSON.stringify(row), note || null, by || 'operator', ts).run();
}

async function updateItem(env, slug, body) {
  const cur = await env.DB.prepare('SELECT * FROM content_items WHERE slug=?').bind(slug).first();
  if (!cur) return json({ error: 'not found' }, 404);
  // body_json is MERGED field-by-field (not replaced), so editing one field (a price, a
  // definition) keeps the rest. Pass body_json_replace:true to overwrite wholesale.
  let mergedBodyJson = cur.body_json;
  if (body.body_json !== undefined) {
    if (body.body_json_replace) { mergedBodyJson = asJsonString(body.body_json); }
    else {
      let curObj = {}; try { curObj = cur.body_json ? JSON.parse(cur.body_json) : {}; } catch {}
      const incoming = typeof body.body_json === 'string' ? safeParse(body.body_json) : body.body_json;
      mergedBodyJson = JSON.stringify({ ...curObj, ...(incoming && typeof incoming === 'object' ? incoming : {}) });
    }
  }
  const next = {
    type: body.type != null ? String(body.type) : cur.type,
    title: body.title != null ? String(body.title) : cur.title,
    section: body.section !== undefined ? (body.section == null ? null : String(body.section)) : cur.section,
    body_md: body.body_md != null ? String(body.body_md) : cur.body_md,
    body_json: mergedBodyJson,
    status: body.status != null ? String(body.status) : cur.status,
    tags_json: (body.tags ?? body.tags_json) !== undefined ? (asJsonString(body.tags ?? body.tags_json) || '[]') : cur.tags_json,
    source_doc: body.source_doc !== undefined ? (body.source_doc == null ? null : String(body.source_doc)) : cur.source_doc,
    source_order: body.source_order !== undefined ? (body.source_order == null ? null : parseInt(body.source_order, 10)) : cur.source_order,
  };
  const ts = nowIso();
  await env.DB.prepare(
    `UPDATE content_items SET type=?, title=?, section=?, body_md=?, body_json=?, status=?, tags_json=?, source_doc=?, source_order=?, updated_at=? WHERE slug=?`
  ).bind(next.type, next.title, next.section, next.body_md, next.body_json, next.status, next.tags_json, next.source_doc, next.source_order, ts, slug).run();
  const row = await env.DB.prepare('SELECT * FROM content_items WHERE slug=?').bind(slug).first();
  const v = await env.DB.prepare('SELECT MAX(version) AS v FROM content_versions WHERE item_slug=?').bind(slug).first();
  const nextVer = (v?.v || 0) + 1;
  await snapshot(env, row, nextVer, body.change_note || 'update', body.created_by || 'operator', ts);
  return json({ item: parseRow(row), version: nextVer });
}

async function deleteItem(env, slug) {
  const r = await env.DB.prepare('SELECT slug FROM content_items WHERE slug=?').bind(slug).first();
  if (!r) return json({ error: 'not found' }, 404);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM content_comments WHERE item_slug=?').bind(slug),
    env.DB.prepare('DELETE FROM content_versions WHERE item_slug=?').bind(slug),
    env.DB.prepare('DELETE FROM content_items WHERE slug=?').bind(slug),
  ]);
  return json({ deleted: slug });
}

async function listVersions(env, slug) {
  const rows = await env.DB.prepare(
    'SELECT version, change_note, created_by, created_at FROM content_versions WHERE item_slug=? ORDER BY version DESC'
  ).bind(slug).all();
  return json({ slug, versions: rows.results || [] });
}

async function getVersion(env, slug, version) {
  const r = await env.DB.prepare(
    'SELECT * FROM content_versions WHERE item_slug=? AND version=?'
  ).bind(slug, parseInt(version, 10)).first();
  if (!r) return json({ error: 'not found' }, 404);
  return json({ version: r.version, change_note: r.change_note, created_by: r.created_by, created_at: r.created_at, snapshot: safeParse(r.snapshot_json) });
}

async function listComments(env, slug) {
  const rows = await env.DB.prepare(
    'SELECT id, model_name, comment_type, comment_md, proposed_patch_json, created_at FROM content_comments WHERE item_slug=? ORDER BY created_at DESC'
  ).bind(slug).all();
  return json({ slug, comments: (rows.results || []).map(c => ({ ...c, proposed_patch: c.proposed_patch_json ? safeParse(c.proposed_patch_json) : null })) });
}

async function addComment(env, slug, body) {
  const item = await env.DB.prepare('SELECT slug FROM content_items WHERE slug=?').bind(slug).first();
  if (!item) return json({ error: 'item not found' }, 404);
  const model_name = String(body.model_name || 'operator').trim();
  const comment_type = body.comment_type != null ? String(body.comment_type) : null;
  const comment_md = String(body.comment_md || '');
  const patch = asJsonString(body.proposed_patch ?? body.proposed_patch_json);
  if (!comment_md && !patch) return json({ error: 'comment_md or proposed_patch required' }, 400);
  const ts = nowIso();
  const res = await env.DB.prepare(
    `INSERT INTO content_comments(item_slug,model_name,comment_type,comment_md,proposed_patch_json,created_at) VALUES (?,?,?,?,?,?)`
  ).bind(slug, model_name, comment_type, comment_md, patch, ts).run();
  return json({ slug, id: res.meta?.last_row_id ?? null, model_name, comment_type, created_at: ts });
}

async function handle(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const mutates = (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE');
  if (mutates && !authed(request, env)) return json({ error: 'unauthorized' }, 401);
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization',
    } });
  }
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean); // ['api','content', slugOrSpecial?, op?]
  const a = parts[2];
  const op = parts[3];

  if (!a) {
    if (method === 'GET') return listItems(env, url);
    if (method === 'POST') return createItem(env, await request.json().catch(() => ({})));
    if (method === 'PATCH' && url.searchParams.get('title')) {
      const t = url.searchParams.get('title');
      const row = await env.DB.prepare('SELECT slug FROM content_items WHERE title = ?').bind(t).first();
      if (!row) return json({ error: 'not found', title: t }, 404);
      return updateItem(env, row.slug, await request.json().catch(() => ({})));
    }
    return json({ error: 'method not allowed' }, 405);
  }
  if (a === 'types' && method === 'GET') return typeCounts(env);
  if (a === 'search' && method === 'GET') return listItems(env, url);

  // E-code: /api/content/E52 resolves to id 52 (get/patch/delete)
  const eMatch = a && /^e\d+$/i.test(a);
  if (eMatch && !op) {
    const row = await env.DB.prepare('SELECT slug FROM content_items WHERE id=?').bind(parseInt(a.slice(1), 10)).first();
    if (!row) return json({ error: 'not found', code: a }, 404);
    if (method === 'GET') return getItem(env, row.slug);
    if (method === 'PATCH') return updateItem(env, row.slug, await request.json().catch(() => ({})));
    if (method === 'DELETE') return deleteItem(env, row.slug);
  }

  // a == slug
  if (!op) {
    if (method === 'GET') return getItem(env, a);
    if (method === 'PATCH') return updateItem(env, a, await request.json().catch(() => ({})));
    if (method === 'DELETE') return deleteItem(env, a);
    return json({ error: 'method not allowed' }, 405);
  }
  if (op === 'versions' && method === 'GET') {
    const ver = parts[4];
    return ver ? getVersion(env, a, ver) : listVersions(env, a);
  }
  if (op === 'comments') {
    if (method === 'GET') return listComments(env, a);
    if (method === 'POST') return addComment(env, a, await request.json().catch(() => ({})));
  }
  return json({ error: 'method not allowed: ' + method + ' ' + url.pathname }, 405);
}

export async function onRequest(context) {
  try { return await handle(context.request, context.env); }
  catch (e) { return json({ error: 'unhandled: ' + (e?.message || String(e)) }, 500); }
}
