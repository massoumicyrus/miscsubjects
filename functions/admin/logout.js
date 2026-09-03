// GET /admin/logout — the Sign out link on every public topbar and in the admin shell.
// Clears the session cookie and returns to the front of the site, so front↔back tabbing
// (Sign in → Admin ↔ View site → Sign out) closes cleanly. Exempted in adminGate.
import { clearSessionCookie } from '../_lib/admin_session.js';

export async function onRequestGet() {
  return new Response(null, {
    status: 302,
    headers: { location: '/', 'set-cookie': clearSessionCookie() },
  });
}
