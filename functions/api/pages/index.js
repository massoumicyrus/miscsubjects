function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  const result = await env.DB.prepare(
    'SELECT slug, title, body_html, version, updated_at FROM pages ORDER BY slug ASC'
  ).all();
  return json({ data: result.results, count: result.results.length });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch {
    return json({ error: 'invalid json' }, 400);
  }
  const { slug, title, body_html } = body;
  if (!slug || body_html === undefined) return json({ error: 'slug and body_html required' }, 400);
  const ts = new Date().toISOString();
  try {
    await env.DB.prepare(
      'INSERT INTO pages (slug, title, body_html, version, updated_at) VALUES (?, ?, ?, 1, ?)'
    ).bind(slug, title ?? null, String(body_html), ts).run();
    await env.DB.prepare(
      'INSERT INTO pages_versions (slug, version, title, body_html, created_at, actor) VALUES (?, 1, ?, ?, ?, ?)'
    ).bind(slug, title ?? null, String(body_html), ts, 'api').run();
  } catch {
    return json({ error: 'slug already exists — use PUT to overwrite' }, 409);
  }
  const row = await env.DB.prepare(
    'SELECT slug, title, body_html, version, updated_at FROM pages WHERE slug = ?'
  ).bind(slug).first();
  return json(row, 201);
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
    },
  });
}
