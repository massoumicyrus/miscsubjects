// POST /api/device/verify {token, device_id} — Turnstile as step-up authorization.
//
// The browser widget yields a token; this route sends it to Cloudflare's siteverify with the
// secret that lives only in the Pages env (TURNSTILE_SECRET_KEY), and on success records the
// verification INSTANT on the device row. Capability contexts that require human verification
// within N seconds read that instant. Nothing trusts client-side completion; nothing here stores
// the token; the device id is a first-party identifier, never a fingerprint.

import { buildNowIso } from '../../_lib/build_time.js';
import { logEvent } from '../../_lib/event_log.js';
import { recordProfileEvent } from '../../_lib/identity_fns.js';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
}

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ ok: false, error: 'BAD_REQUEST', message: 'JSON body {token, device_id} required' }, 400); }
  const token = String(b?.token || '').trim();
  const deviceId = String(b?.device_id || '').trim();
  if (!token || token.length > 2048) return json({ ok: false, error: 'BAD_REQUEST', message: 'token required' }, 400);
  if (!/^dev_[0-9a-f]{6,}$/.test(deviceId)) return json({ ok: false, error: 'BAD_REQUEST', message: 'device_id (dev_…) required' }, 400);
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return json({ ok: false, error: 'PROVIDER_UNAVAILABLE', message: 'TURNSTILE_SECRET_KEY is not bound' }, 503);
  const device = await env.DB.prepare('SELECT id, profile_id, tenant_id, revoked_at FROM traffic_devices WHERE id = ?').bind(deviceId).first().catch(() => null);
  if (!device) return json({ ok: false, error: 'DEVICE_NOT_APPROVED', message: `no device ${deviceId}; register it first (DEVICE_REGISTER)` }, 404);
  if (device.revoked_at) return json({ ok: false, error: 'DEVICE_REVOKED', message: 'a revoked device cannot step up' }, 403);

  const form = new FormData();
  form.set('secret', secret); form.set('response', token);
  const ip = request.headers.get('cf-connecting-ip'); if (ip) form.set('remoteip', ip);
  let verdict;
  try { const r = await fetch(SITEVERIFY, { method: 'POST', body: form }); verdict = await r.json(); }
  catch (e) { return json({ ok: false, error: 'PROVIDER_UNAVAILABLE', message: 'siteverify unreachable: ' + e.message }, 502); }
  const codes = verdict['error-codes'] || [];
  if (!verdict.success) {
    await logEvent(env, { source: 'identity', key: 'DEVICE_VERIFY', action: 'human_verification_failed', direction: 'in', status: 403, request: { device_id: deviceId, hostname: verdict.hostname || null }, response: { error_codes: codes } });
    return json({ ok: false, error: 'TURNSTILE_REQUIRED', message: 'the challenge did not verify', error_codes: codes }, 403);
  }
  const now = buildNowIso();
  try { await env.DB.prepare('UPDATE traffic_devices SET last_verification = ?, verification_method = ?, last_seen = ? WHERE id = ?').bind(now, 'turnstile', now, deviceId).run(); }
  catch (e) { return json({ ok: false, error: 'DURABLE_WRITE_FAILED', message: e.message }, 500); }
  await recordProfileEvent(env, { profile_id: device.profile_id, device_id: deviceId, event_type: 'TURNSTILE_PASS', payload: { hostname: verdict.hostname || null, challenge_ts: verdict.challenge_ts || null, action: verdict.action || null }, source: 'turnstile', tenant_id: device.tenant_id || 't_root' }).catch(() => {});
  const ev = await logEvent(env, { source: 'identity', key: 'DEVICE_VERIFY', action: 'human_verification_recorded', direction: 'in', status: 200, request: { device_id: deviceId, hostname: verdict.hostname || null, action: verdict.action || null }, response: { last_verification: now, method: 'turnstile' } });
  if (!ev) return json({ ok: false, error: 'LEDGER_WRITE_FAILED', message: 'verification recorded but the ledger refused the receipt' }, 500);
  return json({ ok: true, device_id: deviceId, last_verification: now, method: 'turnstile', hostname: verdict.hostname || null, ledger_event_id: ev });
}
