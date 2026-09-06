// GET|POST /api/profile/event — the first-party behavioural beacon.
//
// A page, a product view, an add-to-cart, a CTA click: one row in traffic_events under the
// visitor's first-party device id (cookie ms_dev, minted here on first sight), joined to a
// profile that starts unknown and becomes known when an identifier is joined (PROFILE_IDENTIFY).
// No third-party pixel is canonical; Meta/GA/Klaviyo are downstream consumers of THIS row.
// Nothing here reads browser fingerprints, and nothing here accepts a raw identifier.

import { ensureProfile, recordProfileEvent } from '../../_lib/identity_fns.js';
import { buildNowIso } from '../../_lib/build_time.js';

const ALLOWED = new Set(['PAGE_VIEW', 'PRODUCT_VIEW', 'CTA_CLICK', 'ADD_TO_CART', 'CHECKOUT_STARTED', 'ARTICLE_READ', 'SMS_COMPOSER_OPEN', 'EXPERIMENT_EXPOSURE', 'CUSTOM']);
const json = (o, status, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...extra } });

function readCookie(request, name) {
  const c = request.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function newId(prefix) { const b = crypto.getRandomValues(new Uint8Array(9)); return prefix + '_' + [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); }

async function handle(request, env, params) {
  const type = String(params.type || params.event_type || 'PAGE_VIEW').toUpperCase();
  if (!ALLOWED.has(type)) return json({ ok: false, error: 'BAD_REQUEST', message: `event type must be one of ${[...ALLOWED].join(', ')}` }, 400);
  let deviceId = String(params.device || params.device_id || readCookie(request, 'ms_dev') || '').trim();
  let setCookie = null;
  let device = /^dev_[0-9a-f]{6,}$/.test(deviceId) ? await env.DB.prepare('SELECT id, profile_id FROM traffic_devices WHERE id = ?').bind(deviceId).first().catch(() => null) : null;
  if (!device) {
    // First sight: an unknown human profile and an untrusted device, both first-party ids.
    const { profile } = await ensureProfile(env, { kind: 'human', attrs: { origin: 'beacon' } });
    deviceId = newId('dev');
    const now = buildNowIso();
    await env.DB.prepare('INSERT INTO traffic_devices (id, tenant_id, profile_id, trusted, class, first_seen, last_seen, visit_count, meta_json) VALUES (?,?,?,0,?,?,?,1,?)')
      .bind(deviceId, 't_root', profile.id, /mobile/i.test(request.headers.get('user-agent') || '') ? 'mobile' : 'desktop', now, now, '{}').run();
    device = { id: deviceId, profile_id: profile.id };
    setCookie = `ms_dev=${deviceId}; Path=/; Max-Age=${86400 * 400}; SameSite=Lax; Secure; HttpOnly`;
  }
  const url = String(params.url || request.headers.get('referer') || '').slice(0, 500) || null;
  const payload = {};
  for (const k of ['product', 'sku', 'value', 'variant', 'campaign', 'label']) if (params[k] != null && params[k] !== '') payload[k] = String(params[k]).slice(0, 200);
  const id = await recordProfileEvent(env, { profile_id: device.profile_id, device_id: device.id, event_type: type, payload, url, source: 'beacon' });
  return json({ ok: true, event_id: id, device_id: device.id, profile_id: device.profile_id, event_type: type }, 200, setCookie ? { 'set-cookie': setCookie } : {});
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  return handle(request, env, Object.fromEntries(u.searchParams.entries()));
}
export async function onRequestPost({ request, env }) {
  let b = {}; try { b = await request.json(); } catch {}
  return handle(request, env, b || {});
}
