function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}
function authed(request, env) { return !!env.TERMINAL_KEY && (request.headers.get('x-terminal-key') || '') === env.TERMINAL_KEY; }

export async function onRequest(context) {
  const { request, env, params } = context;
  const slug = params.slug;
  const method = request.method;
  const url = new URL(request.url);

  const mutates = (method === 'PUT' || method === 'PATCH' || method === 'DELETE');
  if (mutates && !authed(request, env)) return json({ error: 'unauthorized' }, 401);

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
        'access-control-allow-headers': 'Content-Type, Authorization',
      },
    });
  }

  if (method === 'GET') {
    if (url.searchParams.get('versions') === '1') {
      const result = await env.DB.prepare(
        'SELECT id, slug, version, title, body_html, created_at, actor FROM pages_versions WHERE slug = ? ORDER BY version DESC'
      ).bind(slug).all();
      return json({ data: result.results, count: result.results.length });
    }
    const row = await env.DB.prepare(
      'SELECT slug, title, body_html, version, updated_at FROM pages WHERE slug = ?'
    ).bind(slug).first();
    if (!row) return json({ error: 'not found' }, 404);
    return json(row);
  }

  if (method === 'PUT') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
    if (body.body_html === undefined) return json({ error: 'body_html required' }, 400);
    const ts = new Date().toISOString();
    const existing = await env.DB.prepare('SELECT version FROM pages WHERE slug = ?').bind(slug).first();
    const nextVersion = (existing?.version || 0) + 1;
    await env.DB.prepare(
      'INSERT OR REPLACE INTO pages (slug, title, body_html, version, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(slug, body.title ?? existing?.title ?? null, String(body.body_html), nextVersion, ts).run();
    await env.DB.prepare(
      'INSERT INTO pages_versions (slug, version, title, body_html, created_at, actor) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(slug, nextVersion, body.title ?? null, String(body.body_html), ts, body.actor || 'api').run();
    const row = await env.DB.prepare(
      'SELECT slug, title, body_html, version, updated_at FROM pages WHERE slug = ?'
    ).bind(slug).first();
    return json(row);
  }

  if (method === 'PATCH') {
    const existing = await env.DB.prepare(
      'SELECT slug, title, body_html, version FROM pages WHERE slug = ?'
    ).bind(slug).first();
    if (!existing) return json({ error: 'not found — use PUT to create' }, 404);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
    const ts = new Date().toISOString();
    const newTitle = body.title !== undefined ? body.title : existing.title;
    const newHtml = body.body_html !== undefined ? String(body.body_html) : existing.body_html;
    const nextVersion = existing.version + 1;
    await env.DB.prepare(
      'UPDATE pages SET title = ?, body_html = ?, version = ?, updated_at = ? WHERE slug = ?'
    ).bind(newTitle, newHtml, nextVersion, ts, slug).run();
    await env.DB.prepare(
      'INSERT INTO pages_versions (slug, version, title, body_html, created_at, actor) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(slug, nextVersion, newTitle, newHtml, ts, body.actor || 'api').run();
    const row = await env.DB.prepare(
      'SELECT slug, title, body_html, version, updated_at FROM pages WHERE slug = ?'
    ).bind(slug).first();
    return json(row);
  }

  if (method === 'DELETE') {
    const result = await env.DB.prepare('DELETE FROM pages WHERE slug = ?').bind(slug).run();
    if (result.meta.changes === 0) return json({ error: 'not found' }, 404);
    return json({ deleted: slug });
  }

  return json({ error: 'method not allowed' }, 405);
}
