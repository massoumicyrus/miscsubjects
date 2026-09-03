import {
  clearSessionCookie,
  createSessionCookie,
  terminalKeyOk,
} from '../../_lib/admin_session.js';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...extraHeaders },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.TERMINAL_KEY) return json({ error: 'TERMINAL_KEY not configured' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const key = String(body?.key || '');
  if (!key || key !== env.TERMINAL_KEY) {
    return json({ error: 'invalid key' }, 401);
  }

  const cookie = await createSessionCookie(env);
  if (!cookie) return json({ error: 'session unavailable' }, 503);

  return json(
    { ok: true, expires_days: 60 },
    200,
    { 'set-cookie': cookie },
  );
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, DELETE, OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}