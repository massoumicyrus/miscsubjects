import { clearSessionCookie } from '../../_lib/admin_session.js';

export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'set-cookie': clearSessionCookie(),
    },
  });
}

export async function onRequestGet() {
  return new Response(null, {
    status: 302,
    headers: {
      location: '/admin/login',
      'set-cookie': clearSessionCookie(),
    },
  });
}