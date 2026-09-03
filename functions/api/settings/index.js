function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  const result = await env.DB.prepare(
    'SELECT key, value, description, updated_at FROM settings ORDER BY key ASC'
  ).all();
  return json({ data: result.results, count: result.results.length });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch {
    return json({ error: 'invalid json' }, 400);
  }
  const { key, value, description } = body;
  if (!key || value === undefined) return json({ error: 'key and value required' }, 400);
  const ts = new Date().toISOString();
  try {
    await env.DB.prepare(
      'INSERT INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)'
    ).bind(key, String(value), description ?? null, ts).run();
  } catch {
    return json({ error: 'key already exists — use PUT to overwrite' }, 409);
  }
  const row = await env.DB.prepare(
    'SELECT key, value, description, updated_at FROM settings WHERE key = ?'
  ).bind(key).first();
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
