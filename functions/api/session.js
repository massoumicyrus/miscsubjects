import { verifyAdminCookie } from '../_lib/admin_session.js';

export async function onRequestGet({ request, env }) {
  let authed = false;
  try { authed = !!(await verifyAdminCookie(request, env)); } catch {}
  return new Response(JSON.stringify({ authed }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
