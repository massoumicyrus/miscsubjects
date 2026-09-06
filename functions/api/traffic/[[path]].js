// TRAFFIC ENGINE — the API. Three audiences, three auth rules:
//   • owner (x-terminal-key): config writes, ruleset activation, profile operations, the unified
//     profile view, identity linking, decisions, metrics, explain, replay, retention, JCI import.
//   • visitor (no auth, tied to the decision/cookie): Turnstile verify, acknowledgement, SMS
//     squeeze status poll and tap beacon.
//   • messaging platform (x-traffic-webhook-key): the inbound SMS webhook that closes the funnel.
//
// Every write goes through the store's canonical paths; this file only routes and authorizes.

import { terminalKeyOk } from '../../_lib/admin_session.js';
import {
  writeConfig, activateRuleset, profileOp, profileView, linkIdentifiers, getDecision,
  metrics, runRetention, recordAck, tenantOf, ledger, loadSnapshot, appendEvent,
} from '../../_lib/traffic/store.js';
import { buildNowIso } from '../../_lib/build_time.js';
import { explain, replay } from '../../_lib/traffic/engine.js';
import { verifyTurnstile, turnstileCookieValue } from '../../_lib/traffic/turnstile.js';
import { codeStatus, recordTap, handleInbound } from '../../_lib/traffic/funnel.js';
import { SIGNAL_CATALOG } from '../../_lib/traffic/signals.js';

const J = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o, null, 2), { status, headers: { ...J, ...extra } });
const cookie = (name, val, maxAge) => `${name}=${encodeURIComponent(val)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure; HttpOnly`;

function readCookie(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function owner(request, env) { return terminalKeyOk(request, env); }
function tenantFrom(env, body, url) { return tenantOf((body && body.tenant) || url.searchParams.get('t') || env.TRAFFIC_TENANT || 't_root'); }
async function bodyOf(request) { try { return await request.json(); } catch { return {}; } }

export async function onRequest(context) {
  try {
    return await route(context);
  } catch (e) {
    // A traffic API or webhook must fail with a named error, never an opaque 500.
    try { await ledger(context.env, { key: 'TRAFFIC_API_ERROR', action: 'error', status: 500, route: new URL(context.request.url).pathname, request: { method: context.request.method }, response: { error: String(e && e.message || e) } }); } catch { /* ledger optional */ }
    return json({ ok: false, error: 'TRAFFIC_ERROR', message: String(e && e.message || e).slice(0, 500) }, 500);
  }
}

async function route(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/traffic\/?/, '').split('/').filter(Boolean);
  const seg = (i) => parts[i] || '';
  const method = request.method.toUpperCase();
  const secret = env.TRAFFIC_GRANT_SECRET || env.TERMINAL_KEY || '';

  // ---------- visitor: Turnstile verification (posted by the challenge page) ----------
  if (seg(0) === 'turnstile' && seg(1) === 'verify' && method === 'POST') {
    const b = await bodyOf(request);
    const deviceId = readCookie(request, 'ms_did');
    const v = await verifyTurnstile(env, { token: b.token, remoteip: request.headers.get('cf-connecting-ip') || null, idempotencyKey: b.decision_id || null });
    if (!v.ok) return json({ ok: false, error: 'turnstile_failed', error_codes: v.error_codes }, 200);
    const ck = await turnstileCookieValue(secret, { deviceId, verifiedAtMs: Date.now(), hostname: url.hostname });
    const tenant = tenantOf(env.TRAFFIC_TENANT || 't_root');
    // Capture the verification into the visitor's tracked data — the human-check result becomes a
    // first-party event and stamps the device, so it shows up on the unified profile and next
    // decision (we keep the verdict/challenge_ts, never the single-use token itself).
    const now = buildNowIso();
    let profileId = null;
    if (deviceId) {
      try {
        const dev = await env.DB.prepare('SELECT profile_id FROM traffic_devices WHERE tenant_id=? AND id=?').bind(tenant, deviceId).first();
        profileId = dev?.profile_id || null;
        await env.DB.prepare("UPDATE traffic_devices SET last_verification=?, verification_method='turnstile' WHERE tenant_id=? AND id=?").bind(now, tenant, deviceId).run();
      } catch { /* device row optional */ }
    }
    try { await appendEvent(env, { tenant, kind: 'turnstile_pass', event_type: 'TURNSTILE_PASS', profile_id: profileId, device_id: deviceId, decision_id: b.decision_id || null, source: 'turnstile', payload: { hostname: v.hostname, challenge_ts: v.challenge_ts, action: v.action, cdata: v.cdata } }); } catch { /* event optional */ }
    await ledger(env, { key: 'TRAFFIC_TURNSTILE', action: 'pass', route: '/api/traffic/turnstile/verify', trace_id: b.decision_id || null, request: { hostname: v.hostname, challenge_ts: v.challenge_ts }, response: { ok: true, device_id: deviceId, profile_id: profileId } });
    let redirect = typeof b.return_to === 'string' && b.return_to.startsWith('/') ? b.return_to : '/';
    return json({ ok: true, redirect }, 200, { 'set-cookie': cookie('ms_tsv', ck, Number(env.TURNSTILE_MAX_AGE_S || 86400)) });
  }

  // ---------- visitor: one-time acknowledgement ----------
  if (seg(0) === 'ack' && method === 'POST') {
    let b; const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) b = await bodyOf(request);
    else { const f = await request.formData(); b = Object.fromEntries([...f.entries()]); }
    const deviceId = readCookie(request, 'ms_did');
    const tenant = tenantOf(env.TRAFFIC_TENANT || 't_root');
    const r = await recordAck(env, { tenant, policy_key: b.policy, policy_version: b.version, profile_id: null, device_id: deviceId, source: 'page' });
    const back = typeof b.return_to === 'string' && b.return_to.startsWith('/') ? b.return_to : '/';
    if (!(request.headers.get('content-type') || '').includes('application/json')) return new Response(null, { status: 302, headers: { location: back } });
    return json({ ok: true, ack_id: r, redirect: back });
  }

  // ---------- visitor: SMS squeeze status + tap beacon ----------
  if (seg(0) === 'sms' && seg(1) === 'status' && method === 'GET') {
    const tenant = tenantOf(url.searchParams.get('t') || env.TRAFFIC_TENANT || 't_root');
    const r = await codeStatus(env, { tenant, code: url.searchParams.get('code'), deviceId: readCookie(request, 'ms_did') });
    return json(r);
  }
  if (seg(0) === 'sms' && seg(1) === 'tap' && method === 'POST') {
    const b = await bodyOf(request);
    const tenant = tenantOf(env.TRAFFIC_TENANT || 't_root');
    const r = await recordTap(env, { tenant, code: b.code, kind: b.kind });
    return json(r);
  }

  // ---------- messaging platform: inbound SMS webhook ----------
  if (seg(0) === 'sms' && seg(1) === 'inbound' && method === 'POST') {
    const key = request.headers.get('x-traffic-webhook-key') || url.searchParams.get('key') || '';
    if (!env.TRAFFIC_SMS_WEBHOOK_KEY || key !== env.TRAFFIC_SMS_WEBHOOK_KEY) return json({ ok: false, error: 'unauthorized' }, 401);
    const b = await bodyOf(request);
    const tenant = tenantFrom(env, b, url);
    const r = await handleInbound(env, {
      tenant, from: b.from || b.sender || b.phone, text: b.text || b.body || b.message, channel: b.channel || 'blooio',
      raw: b, inboundEventId: b.event_id || b.id || null, waitUntil: context.waitUntil ? context.waitUntil.bind(context) : null,
    });
    return json(r, r.ok === false && r.reason === 'unauthorized' ? 401 : 200);
  }

  if (!owner(request, env)) return json({ ok: false, error: 'owner_auth_required', how: 'send x-terminal-key' }, 401);

  if (seg(0) === 'signals' && method === 'GET') return json({ ok: true, count: SIGNAL_CATALOG.length, signals: SIGNAL_CATALOG });

  // config write: POST /api/traffic/config {table,id?,patch,reason?}
  if (seg(0) === 'config' && method === 'POST') {
    const b = await bodyOf(request);
    const r = await writeConfig(env, { table: b.table, id: b.id || null, patch: b.patch || {}, tenant: tenantFrom(env, b, url), actor: b.actor || 'owner', reason: b.reason || '' });
    return json(r, r.ok ? 200 : 400);
  }

  // ruleset activation: POST /api/traffic/rulesets/<id>/activate
  if (seg(0) === 'rulesets' && seg(2) === 'activate' && method === 'POST') {
    const b = await bodyOf(request);
    const r = await activateRuleset(env, { tenant: tenantFrom(env, b, url), id: seg(1), actor: b.actor || 'owner', note: b.note || '' });
    return json(r, r.ok ? 200 : 400);
  }

  // identity link: POST /api/traffic/profiles/link {identifiers,device_id?,profile_id?}
  if (seg(0) === 'profiles' && seg(1) === 'link' && method === 'POST') {
    const b = await bodyOf(request);
    const r = await linkIdentifiers(env, { tenant: tenantFrom(env, b, url), identifiers: b.identifiers || [], device_id: b.device_id || null, profile_id: b.profile_id || null, source: b.source || 'api', secret, actor: b.actor || 'owner' });
    return json(r, r.ok ? 200 : 400);
  }

  // profile operation: POST /api/traffic/profiles/<id>/<op>
  if (seg(0) === 'profiles' && seg(1) && seg(2) && method === 'POST') {
    const b = await bodyOf(request);
    const r = await profileOp(env, { tenant: tenantFrom(env, b, url), profile_id: seg(1), op: seg(2), args: b.args || b || {}, actor: b.actor || 'owner', reason: b.reason || '' });
    return json(r, r.ok ? 200 : 400);
  }

  // the unified visitor profile: GET /api/traffic/profiles/<id>
  if (seg(0) === 'profiles' && seg(1) && !seg(2) && method === 'GET') {
    const r = await profileView(env, { tenant: tenantFrom(env, null, url), profile_id: seg(1) });
    return r ? json({ ok: true, ...r }) : json({ ok: false, error: 'profile_not_found' }, 404);
  }

  if (seg(0) === 'decisions' && seg(1) && method === 'GET') {
    const r = await getDecision(env, { tenant: tenantFrom(env, null, url), decision_id: seg(1) });
    return r ? json({ ok: true, decision: r }) : json({ ok: false, error: 'decision_not_found' }, 404);
  }

  if (seg(0) === 'metrics' && method === 'GET') {
    const r = await metrics(env, { tenant: tenantFrom(env, null, url), since_hours: Number(url.searchParams.get('since_hours')) || 24, ruleset_id: url.searchParams.get('ruleset_id') || null, campaign_id: url.searchParams.get('campaign_id') || null });
    return json({ ok: true, metrics: r });
  }

  if (seg(0) === 'explain') {
    let sim;
    if (method === 'POST') { const b = await bodyOf(request); sim = b.sim || b || {}; }
    else sim = Object.fromEntries(url.searchParams.entries());
    const r = await explain(env, { tenant: tenantFrom(env, sim, url), sim });
    return json(r);
  }

  if (seg(0) === 'replay' && seg(1)) {
    const r = await replay(env, { tenant: tenantFrom(env, null, url), decision_id: seg(1), against: url.searchParams.get('against') || 'both' });
    return json(r, r.ok ? 200 : 404);
  }

  if (seg(0) === 'retention' && seg(1) === 'run' && method === 'POST') {
    const b = await bodyOf(request);
    const r = await runRetention(env, { tenant: tenantFrom(env, b, url), days: b.days || null, actor: b.actor || 'owner' });
    return json({ ok: true, ...r });
  }

  return json({ ok: false, error: 'unknown_route', path: '/' + parts.join('/'), method, routes: ['POST config', 'POST rulesets/<id>/activate', 'POST profiles/link', 'POST profiles/<id>/<op>', 'GET profiles/<id>', 'GET decisions/<id>', 'GET metrics', 'GET|POST explain', 'GET replay/<id>', 'POST retention/run', 'GET signals', 'POST turnstile/verify', 'POST ack', 'GET sms/status', 'POST sms/tap', 'POST sms/inbound'] }, 404);
}
