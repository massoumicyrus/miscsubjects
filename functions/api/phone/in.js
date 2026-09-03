import { dispatch } from '../dispatch.js';

// /api/phone/in — the universal inbound endpoint for iOS Shortcuts, Siri, PWA share-sheet, NFC,
// and any other phone-side trigger. Body shape (any subset; only `action` required):
//   { source, device, action, text, url, clipboard, image, location, voice_url, payload }
//
// Logged to `phone_events` for audit + ledger. Routed to a directory key by `action`:
//   share_url     → PHONE_SHARE_URL_HANDLE     (body: text|url)
//   share_text    → PHONE_SHARE_TEXT_HANDLE    (body: text)
//   share_image   → PHONE_SHARE_IMAGE_HANDLE   (body: image_url|caption)
//   voice_note    → PHONE_VOICE_NOTE_HANDLE    (body: voice_url)
//   build_voice   → BUILD_VOICE_IN             (body: voice_url — Mac hotkey → Grok whore, not ROUTER)
//   clipboard     → PHONE_CLIPBOARD_HANDLE     (body: clipboard_text)
//   location      → PHONE_LOCATION_HANDLE      (body: lat,lng|label)
//   photo         → PHONE_SHARE_IMAGE_HANDLE   (body: image_url|caption)
//   approval      → PHONE_APPROVAL_RESOLVE     (body: approval_id|approve|deny)
//   ask           → ROUTER                      (body: text — natural-language to ROUTER, same as iMessage)
//   shortcut_run  → SHORTCUT_RUN               (body: payload_json — arbitrary)
// Unknown actions → stored in phone_events, dispatched to ROUTER with the raw text.

function senderTag(m) {
  const from = String(m.from || '[OWNER_PHONE]');
  return `[channel ios_shortcut 1:1 · from ${from}]\nNow: ${m.text || ''}`;
}

const ROUTING = {
  share_url:    { key: 'PHONE_SHARE_URL_HANDLE',    pick: m => `${m.text || ''}|${m.url || ''}` },
  share_text:   { key: 'PHONE_SHARE_TEXT_HANDLE',   pick: m => String(m.text || '') },
  share_image:  { key: 'PHONE_SHARE_IMAGE_HANDLE',  pick: m => `${m.image || ''}|${m.text || ''}` },
  photo:        { key: 'PHONE_SHARE_IMAGE_HANDLE',  pick: m => `${m.image || ''}|${m.text || ''}` },
  voice_note:   { key: 'PHONE_VOICE_NOTE_HANDLE',   pick: m => String(m.voice_url || m.url || '') },
  build_voice:  { key: 'BUILD_VOICE_IN',            pick: m => String(m.voice_url || m.url || '') },
  clipboard:    { key: 'PHONE_CLIPBOARD_HANDLE',    pick: m => String(m.clipboard || m.text || '') },
  location:     { key: 'PHONE_LOCATION_HANDLE',     pick: m => String(m.location || '') },
  approval:     { key: 'PHONE_APPROVAL_RESOLVE',    pick: m => `${m.approval_id || m.id || ''}|${m.decision || ''}` },
  ask:          { key: 'ROUTER',                    pick: senderTag },
  shortcut_run: { key: 'SHORTCUT_RUN',              pick: m => JSON.stringify(m.payload || m) },
};

function json(o, status) { return new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json' } }); }

async function authed(request, env) {
  const got = request.headers.get('x-phone-token') || request.headers.get('authorization') || '';
  const want = env.PHONE_TOKEN || env.BLOOIO_API_KEY || '';
  if (!want) return false;
  const bare = got.replace(/^Bearer\s+/i, '');
  return bare === want;
}

export async function onRequestPost({ request, env }) {
  if (!await authed(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const action = String(body.action || '').toLowerCase();
  const ts = new Date().toISOString();
  let log_id = null;
  try {
    const ins = await env.DB.prepare(
      'INSERT INTO phone_events (ts, source, device, action, payload_json) VALUES (?, ?, ?, ?, ?)'
    ).bind(ts, String(body.source || 'unknown'), String(body.device || 'unknown'), action, JSON.stringify(body)).run();
    log_id = ins.meta && ins.meta.last_row_id || null;
  } catch (e) { /* never fail the request on log */ }

  const route = ROUTING[action];
  let dispatched = null, result = null, trace = null;
  try {
    if (route) {
      const r = await dispatch(env, route.key, route.pick(body));
      dispatched = route.key; result = r && r.result; trace = r && r.trace;
    } else {
      // unknown action → still route raw text to ROUTER so phone never silently no-ops
      const r = await dispatch(env, 'ROUTER', senderTag(body));
      dispatched = 'ROUTER'; result = r && r.result; trace = r && r.trace;
    }
    if (log_id) {
      try { await env.DB.prepare('UPDATE phone_events SET result = ? WHERE id = ?').bind(String(result || '').slice(0, 2000), log_id).run(); } catch {}
    }
    return json({ ok: true, action, dispatched, trace, log_id, result: String(result || '').slice(0, 1500) });
  } catch (e) {
    return json({ ok: false, action, error: String(e && e.message || e) }, 500);
  }
}

export function onRequestGet() {
  return new Response('POST { action, ... } with x-phone-token header. Actions: share_url, share_text, share_image, voice_note, clipboard, location, photo, approval, ask, shortcut_run.', { headers: { 'content-type': 'text/plain' } });
}
