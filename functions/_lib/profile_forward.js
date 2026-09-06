
import { logEvent } from './event_log.js';
import { buildNowIso } from './build_time.js';

const DEFAULT_PIXEL_ID = '27209526152071970';
const DEFAULT_GRAPH_VERSION = 'v22.0';
const KLAVIYO_REVISION = '2024-10-15';

// Meta's standard event names where the first-party type has an obvious counterpart; anything
// else goes through as a custom event under its own name.
export const META_EVENT_NAMES = Object.freeze({
  PAGE_VIEW: 'PageView', ARTICLE_READ: 'ViewContent', PRODUCT_VIEW: 'ViewContent', ADD_TO_CART: 'AddToCart',
  CHECKOUT_STARTED: 'InitiateCheckout', ORDER_CREATED: 'Purchase', PAYMENT_SUCCEEDED: 'Purchase',
  SMS_VERIFIED: 'CompleteRegistration', CUSTOMER_IDENTIFIED: 'Lead', CTA_CLICK: 'Contact', SUBSCRIPTION_STARTED: 'Subscribe',
});

function err(code, message, extra = {}) { return 'ERR:' + code + ' ' + JSON.stringify({ ok: false, error: code, message: String(message || code), ...extra }); }
function ok(o) { return JSON.stringify({ ok: true, ...o }); }
const enc = new TextEncoder();
export async function sha256Hex(s) { const d = await crypto.subtle.digest('SHA-256', enc.encode(String(s))); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); }

export function normalizeEmail(v) { const s = String(v || '').trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null; }
export function normalizePhone(v) { const s = String(v || '').replace(/[^\d+]/g, ''); if (!s) return null; const d = s.replace(/^\+/, ''); return /^\d{7,15}$/.test(d) ? d : null; }

async function setting(env, key, fallback = null) {
  try { const r = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first(); return r?.value == null || r.value === '' ? fallback : String(r.value); } catch { return fallback; }
}

// Build the Meta CAPI body for one first-party event. Pure, so it is testable.
export async function metaEventBody(ev, { pixelTestCode = null, sourceUrl = null } = {}) {
  const payload = ev.payload || {};
  const email = normalizeEmail(payload.email); const phone = normalizePhone(payload.phone);
  const user_data = { external_id: [await sha256Hex(ev.profile_id || '')] };
  if (email) user_data.em = [await sha256Hex(email)];
  if (phone) user_data.ph = [await sha256Hex(phone)];
  if (payload.fbp) user_data.fbp = String(payload.fbp);
  if (payload.fbc) user_data.fbc = String(payload.fbc);
  const custom = {};
  for (const [k, v] of Object.entries(payload)) if (!['email', 'phone', 'fbp', 'fbc'].includes(k) && v != null && typeof v !== 'object') custom[k] = String(v).slice(0, 200);
  custom.first_party_event_id = ev.id;
  const body = {
    data: [{
      event_name: META_EVENT_NAMES[ev.event_type] || ev.event_type,
      event_time: Math.floor(Date.parse(ev.ts || new Date().toISOString()) / 1000),
      event_id: ev.id,
      action_source: 'website',
      event_source_url: sourceUrl || ev.url || 'https://miscsubjects.com/',
      user_data,
      custom_data: custom,
    }],
  };
  if (pixelTestCode) body.test_event_code = pixelTestCode;
  return body;
}

// Klaviyo Create Event body. external_id is a first-class Klaviyo identifier, so no PII is needed.
export function klaviyoEventBody(ev) {
  const payload = ev.payload || {};
  const profile = { external_id: ev.profile_id };
  const email = normalizeEmail(payload.email); const phone = normalizePhone(payload.phone);
  if (email) profile.email = email;
  if (phone) profile.phone_number = '+' + phone;
  const properties = { first_party_event_id: ev.id, source: ev.source || 'build', url: ev.url || null };
  for (const [k, v] of Object.entries(payload)) if (!['email', 'phone'].includes(k) && v != null) properties[k] = typeof v === 'object' ? JSON.stringify(v) : v;
  return {
    data: {
      type: 'event',
      attributes: {
        properties, time: ev.ts || new Date().toISOString(), unique_id: ev.id,
        metric: { data: { type: 'metric', attributes: { name: ev.event_type } } },
        profile: { data: { type: 'profile', attributes: profile } },
      },
    },
  };
}

async function loadEvent(env, ref) {
  const s = String(ref || '').trim();
  let id = s;
  if (s.startsWith('{')) {
    // The event-bridge payload: {source,key,action,status,trace_id,event_id,...} where event_id is the
    // LEDGER row of the PROFILE_EVENT receipt; that row's response names the traffic_events id.
    let p; try { p = JSON.parse(s); } catch { return { error: 'BAD_REQUEST', message: 'body is neither an evt_ id nor a JSON payload' }; }
    if (p.event_id && String(p.event_id).startsWith('evt_')) id = p.event_id;
    else if (p.profile_event_id) id = p.profile_event_id;
    else if (p.event_id) {
      const row = await env.LEDGER.prepare('SELECT response_json FROM events WHERE id = ?').bind(String(p.event_id)).first().catch(() => null);
      let resp = {}; try { resp = JSON.parse(row?.response_json || '{}'); } catch {}
      id = resp.event_id || resp.profile_event_id || null;
      if (!id) return { error: 'SESSION_NOT_FOUND', message: `ledger row ${p.event_id} names no first-party event` };
    }
  }
  if (!id || !String(id).startsWith('evt_')) return { error: 'BAD_REQUEST', message: 'a first-party event id (evt_…) is required' };
  const row = await env.DB.prepare('SELECT * FROM traffic_events WHERE id = ?').bind(id).first();
  if (!row) return { error: 'SESSION_NOT_FOUND', message: `no first-party event ${id}` };
  let payload = {}; try { payload = JSON.parse(row.payload_json || '{}'); } catch {}
  return { ev: { ...row, payload } };
}

export function makeProfileForwardFnMap() {
  return {
    // PROFILE_EVENT_FORWARD — `evt_…` or the event-bridge payload JSON, optionally `evt_…|meta,klaviyo`
    async profileEventForward(env, raw) {
      const s = String(raw == null ? '' : raw).trim();
      let ref = s, only = null;
      if (!s.startsWith('{') && s.includes('|')) { const i = s.indexOf('|'); ref = s.slice(0, i).trim(); only = s.slice(i + 1).trim(); }
      const enabled = await setting(env, 'profile_forward_enabled', '1');
      if (enabled !== '1') return err('PROVIDER_UNAVAILABLE', 'forwarding is switched off (settings.profile_forward_enabled != 1); nothing left the build');
      const loaded = await loadEvent(env, ref);
      if (loaded.error) return err(loaded.error, loaded.message);
      const ev = loaded.ev;
      const wanted = String(only || await setting(env, 'profile_forwarders', 'meta,klaviyo')).toLowerCase().split(/[,\s]+/).filter(Boolean);
      const results = {};

      if (wanted.includes('meta')) {
        // Which pixel and which token are configuration, not code: settings.meta_pixel_id names the
        // dataset, and every Meta token bound to the build is tried in order until one owns it. The
        // token that worked is recorded by NAME only.
        const tokens = [['META_CAPI_TOKEN', env.META_CAPI_TOKEN], ['META_PIXEL_TOKEN', env.META_PIXEL_TOKEN], ['META_ACCESS_TOKEN', env.META_ACCESS_TOKEN]].filter(([, v]) => v);
        const pixel = await setting(env, 'meta_pixel_id', DEFAULT_PIXEL_ID);
        const version = env.META_API_VERSION || DEFAULT_GRAPH_VERSION;
        if (!tokens.length) results.meta = { ok: false, error: 'PROVIDER_UNAVAILABLE', message: 'no Meta token is bound' };
        else {
          const body = await metaEventBody(ev, { pixelTestCode: await setting(env, 'meta_test_event_code', null) });
          const attempts = [];
          for (const [name, token] of tokens) {
            try {
              const r = await fetch(`https://graph.facebook.com/${version}/${pixel}/events?access_token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
              const j = await r.json().catch(() => ({}));
              if (r.ok && Number(j.events_received) >= 1) {
                results.meta = { ok: true, events_received: j.events_received, fbtrace_id: j.fbtrace_id || null, event_name: body.data[0].event_name, test_event_code: body.test_event_code || null, pixel_id: pixel, token_used: name, identifiers_sent: Object.keys(body.data[0].user_data) };
                break;
              }
              attempts.push({ token: name, status: r.status, message: String(j?.error?.message || JSON.stringify(j)).slice(0, 200) });
            } catch (e) { attempts.push({ token: name, message: e.message }); }
          }
          if (!results.meta) results.meta = { ok: false, error: 'PROVIDER_UNAVAILABLE', pixel_id: pixel, attempts };
        }
      }
      if (wanted.includes('klaviyo')) {
        const key = env.KLAVIYO_KEY;
        if (!key) results.klaviyo = { ok: false, error: 'PROVIDER_UNAVAILABLE', message: 'KLAVIYO_KEY is not bound' };
        else {
          const body = klaviyoEventBody(ev);
          try {
            const r = await fetch('https://a.klaviyo.com/api/events/', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', revision: KLAVIYO_REVISION, authorization: 'Klaviyo-API-Key ' + key }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
            const text = await r.text();
            results.klaviyo = r.status === 202 || r.ok
              ? { ok: true, status: r.status, metric: ev.event_type, external_id: ev.profile_id, identifiers_sent: Object.keys(body.data.attributes.profile.data.attributes) }
              : { ok: false, error: 'PROVIDER_UNAVAILABLE', status: r.status, message: text.slice(0, 300) };
          } catch (e) { results.klaviyo = { ok: false, error: 'PROVIDER_UNAVAILABLE', message: e.message }; }
        }
      }
      const anyOk = Object.values(results).some((x) => x.ok);
      // The forward is recorded ON the event row as attribution the destination has now been told about.
      try {
        const prev = (() => { try { return JSON.parse(ev.attribution_json || '{}'); } catch { return {}; } })();
        prev.forwarded = { ...(prev.forwarded || {}), ...Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { ok: v.ok, at: buildNowIso(), ref: v.fbtrace_id || v.status || null }])) };
        await env.DB.prepare('UPDATE traffic_events SET attribution_json = ? WHERE id = ?').bind(JSON.stringify(prev), ev.id).run();
      } catch {}
      const led = await logEvent(env, {
        source: 'identity', key: 'PROFILE_EVENT_FORWARD', action: anyOk ? 'event_forwarded' : 'event_forward_failed', direction: 'out', status: anyOk ? 200 : 502,
        request: { event_id: ev.id, event_type: ev.event_type, profile_id: ev.profile_id, destinations: wanted },
        response: results,
      });
      if (!led) return err('LEDGER_WRITE_FAILED', 'forwarded but the ledger refused the receipt', { event_id: ev.id, results });
      if (!anyOk) return err('PROVIDER_UNAVAILABLE', 'no destination accepted the event', { event_id: ev.id, results, ledger_event_id: led });
      return ok({ event_id: ev.id, event_type: ev.event_type, profile_id: ev.profile_id, results, ledger_event_id: led, note: 'the first-party row is canonical; each destination is a consumer' });
    },
  };
}
