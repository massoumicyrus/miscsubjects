/**
 * Public email tracking endpoint (no auth — email clients hit it directly).
 *   GET /api/t/o/<id>.gif        → record an open, return a 1x1 transparent gif
 *   GET /api/t/c/<id>?u=<b64url> → record a click, 302 to the decoded URL
 * Writes to the email_sends table (migration 0325). Keyless by necessity; it only ever
 * increments counters on an existing tracking id, so there is nothing to abuse.
 */
import { hashVisitorIp } from '../../_lib/jci.js';
import { logEvent } from '../../_lib/event_log.js';

// Tie email tracking to JCI (owner order 2026-07-30): every open/click also writes a
// ledger event under source 'jci' with the SAME ip:<hash> actor convention JCI traffic
// uses — so a click on a tracked letter joins to that visitor's site sessions, and
// "who clicked, when, and what they did on the site after" is one query.
async function jciEmailEvent(env, request, key, esId, extra) {
  try {
    const ip = request.headers.get('cf-connecting-ip') || '';
    const hashed = await hashVisitorIp(ip);
    await logEvent(env, {
      source: 'jci', key, action: 'email', direction: 'in', status: 200,
      actor: hashed ? 'ip:' + hashed : 'unknown',
      request: { es_id: esId, useragent: request.headers.get('user-agent') || '', ...extra },
      response: { ok: true },
    });
  } catch { /* tracking must never break the pixel/redirect */ }
}

const PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

function pixel() {
  return new Response(PIXEL, {
    headers: {
      'content-type': 'image/gif',
      'cache-control': 'no-store, no-cache, must-revalidate, private',
      pragma: 'no-cache', expires: '0',
    },
  });
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const parts = Array.isArray(params.path) ? params.path : String(params.path || '').split('/').filter(Boolean);
  const kind = parts[0];
  const id = String(parts[1] || '').replace(/\.(gif|png|jpg)$/i, '');
  const now = new Date().toISOString();

  if (kind === 'o') {
    if (id && env.DB) {
      try {
        await env.DB.prepare(
          'UPDATE email_sends SET opens=opens+1, first_open_at=COALESCE(first_open_at,?), last_open_at=? WHERE id=?'
        ).bind(now, now, id).run();
      } catch { /* tolerate */ }
      context.waitUntil(jciEmailEvent(env, request, 'JCI_EMAIL_OPEN', id, {}));
    }
    return pixel();
  }

  if (kind === 'c') {
    const u = new URL(request.url).searchParams.get('u') || '';
    // Fallback is the build's own site — a venture domain here put LeoResearch on
    // build-letter clicks (identity law, owner-caught 2026-07-30).
    let target = 'https://miscsubjects.com';
    try { const d = atob(decodeURIComponent(u)); if (/^https?:\/\//i.test(d)) target = d; } catch { /* fall through */ }
    if (id && env.DB) {
      try {
        const row = await env.DB.prepare('SELECT click_log FROM email_sends WHERE id=?').bind(id).first();
        let log = []; try { log = JSON.parse(row?.click_log || '[]'); } catch { log = []; }
        log.push({ ts: now, url: target }); if (log.length > 50) log = log.slice(-50);
        await env.DB.prepare(
          'UPDATE email_sends SET clicks=clicks+1, first_click_at=COALESCE(first_click_at,?), last_click_at=?, click_log=? WHERE id=?'
        ).bind(now, now, JSON.stringify(log), id).run();
      } catch { /* tolerate */ }
      context.waitUntil(jciEmailEvent(env, request, 'JCI_EMAIL_CLICK', id, { url: target }));
    }
    return new Response(null, { status: 302, headers: { location: target, 'cache-control': 'no-store' } });
  }

  return new Response(JSON.stringify({ ok: true, endpoint: '/api/t/{o|c}/<id>' }), { headers: { 'content-type': 'application/json' } });
}
