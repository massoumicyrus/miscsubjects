/** GET /api/session — ungated boolean session probe for the public header's auth flip.
 * The homepage previously fetched /admin/api/session, which the admin gate 302s to the
 * login page — so "Sign in" never flipped to "Sign out" for a signed-in owner (repeated
 * owner complaint, fixed 2026-08-04). Returns only {authed}; no identity, no token
 * material, no cache. */
import { verifyAdminCookie } from '../_lib/admin_session.js';

export async function onRequestGet({ request, env }) {
  let authed = false;
  try { authed = !!(await verifyAdminCookie(request, env)); } catch {}
  return new Response(JSON.stringify({ authed }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
