function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const key = params.key;
  const method = request.method;

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
    const row = await env.DB.prepare(
      'SELECT key, value, description, updated_at FROM settings WHERE key = ?'
    ).bind(key).first();
    if (!row) return json({ error: 'not found' }, 404);
    return json(row);
  }

  if (method === 'PUT') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
    if (body.value === undefined) return json({ error: 'value required' }, 400);
    const ts = new Date().toISOString();
    await env.DB.prepare(
      'INSERT OR REPLACE INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)'
    ).bind(key, String(body.value), body.description ?? null, ts).run();
    const row = await env.DB.prepare(
      'SELECT key, value, description, updated_at FROM settings WHERE key = ?'
    ).bind(key).first();
    return json(row);
  }

  if (method === 'PATCH') {
    const existing = await env.DB.prepare(
      'SELECT key, value, description, updated_at FROM settings WHERE key = ?'
    ).bind(key).first();
    if (!existing) return json({ error: 'not found — use PUT to create' }, 404);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
    const ts = new Date().toISOString();
    let newValue = existing.value;
    if (body.value !== undefined) {
      try {
        const existingJson = JSON.parse(existing.value);
        const patch = typeof body.value === 'object' ? body.value : JSON.parse(body.value);
        newValue = JSON.stringify({ ...existingJson, ...patch });
      } catch {
        newValue = String(body.value);
      }
    }
    const newDesc = body.description !== undefined ? body.description : existing.description;
    await env.DB.prepare(
      'UPDATE settings SET value = ?, description = ?, updated_at = ? WHERE key = ?'
    ).bind(newValue, newDesc, ts, key).run();
    const row = await env.DB.prepare(
      'SELECT key, value, description, updated_at FROM settings WHERE key = ?'
    ).bind(key).first();
    return json(row);
  }

  if (method === 'DELETE') {
    const result = await env.DB.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
    if (result.meta.changes === 0) return json({ error: 'not found' }, 404);
    return json({ deleted: key });
  }

  return json({ error: 'method not allowed' }, 405);
}
