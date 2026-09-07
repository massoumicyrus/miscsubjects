// TRAFFIC ENGINE — the API. Three audiences, three auth rules:
//   • owner (x-terminal-key): config writes, ruleset activation, profile operations, the unified
//     profile view, identity linking, decisions, metrics, explain, replay, retention, JCI import.
//   • visitor (no auth, tied to the decision/cookie): Turnstile verify, acknowledgement, SMS
//     squeeze status poll and tap beacon.
//   • messaging platform (x-traffic-webhook-key): the inbound SMS webhook that closes the funnel.
//
// Every write goes through the store's canonical paths; this file only routes and authorizes.

import { terminalKeyOk, isBuildAuthed } from '../../_lib/admin_session.js';
import {
  writeConfig, activateRuleset, profileOp, profileView, linkIdentifiers, getDecision,
  metrics, runRetention, recordAck, tenantOf, ledger, loadSnapshot, appendEvent,
} from '../../_lib/traffic/store.js';
import { buildNowIso } from '../../_lib/build_time.js';
import { explain, replay } from '../../_lib/traffic/engine.js';
import { verifyTurnstile, turnstileCookieValue } from '../../_lib/traffic/turnstile.js';
import { codeStatus, recordTap, handleInbound } from '../../_lib/traffic/funnel.js';
import { SIGNAL_CATALOG } from '../../_lib/traffic/signals.js';
import { parsePlainRule, ruleToPlain, FIELD_ALIASES } from '../../_lib/traffic/plain_rules.js';
import { importJciPage, finalizeHistory, seedPopulations } from '../../_lib/traffic/jci_import.js';

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

  if (!(await isBuildAuthed(request, env))) return json({ ok: false, error: 'owner_auth_required', how: 'send x-terminal-key or sign in to /admin' }, 401);

  if (seg(0) === 'signals' && method === 'GET') return json({ ok: true, count: SIGNAL_CATALOG.length, signals: SIGNAL_CATALOG });

  // every captured field, its plain-English name, type, meaning and example values — for the console
  if (seg(0) === 'fields' && method === 'GET') {
    const byPath = {}; for (const [alias, path] of FIELD_ALIASES) if (!byPath[path]) byPath[path] = alias;
    const fields = SIGNAL_CATALOG.map((s) => ({
      field: byPath[s.key] || s.key, path: s.key, group: s.group, type: s.type, sync: !!s.sync, source: s.source,
      description: s.description, values: s.values || s.enum || null,
    }));
    return json({ ok: true, count: fields.length, groups: [...new Set(fields.map((f) => f.group))], fields, aliases: FIELD_ALIASES });
  }

  // list squeeze-page variants (for version testing) — optionally by campaign
  if (seg(0) === 'squeeze' && method === 'GET') {
    const t = tenantFrom(env, null, url);
    const cid = url.searchParams.get('campaign_id');
    const rows = (await env.DB.prepare(cid
      ? 'SELECT id, campaign_id, name, enabled, version, weight, status, headline, cta_text, message_template, updated_at FROM traffic_squeeze_pages WHERE tenant_id=? AND campaign_id=? ORDER BY weight DESC, id'
      : 'SELECT id, campaign_id, name, enabled, version, weight, status, headline, cta_text, message_template, updated_at FROM traffic_squeeze_pages WHERE tenant_id=? ORDER BY campaign_id, id').bind(...(cid ? [t, cid] : [t])).all()).results || [];
    return json({ ok: true, count: rows.length, squeeze_pages: rows });
  }

  // list rulesets (for the console picker) with their entry patterns and destinations
  if (seg(0) === 'rulesets' && !seg(1) && method === 'GET') {
    const t = tenantFrom(env, null, url);
    const [rs, dests, camps] = await env.DB.batch([
      env.DB.prepare('SELECT id, name, state, revision, entry_json, default_destination, campaign_id, fail_mode FROM traffic_rulesets WHERE tenant_id=? ORDER BY updated_at DESC').bind(t),
      env.DB.prepare('SELECT id, name, type, url, enabled, health, campaign_id FROM traffic_destinations WHERE tenant_id=?').bind(t),
      env.DB.prepare('SELECT id, name, sms_phone, sms_channel, blocked_capture, approved_destination FROM traffic_campaigns WHERE tenant_id=?').bind(t),
    ]);
    return json({ ok: true, rulesets: (rs.results || []).map((r) => ({ ...r, entry: JSON.parse(r.entry_json || '[]') })), destinations: dests.results || [], campaigns: camps.results || [] });
  }

  // THE DATA GRID: one row per decision (visitor hit), a column for every captured field, populated
  // from the ledger (traffic_decisions.signals_json). This is the JCI-style populated-columns view.
  if (seg(0) === 'grid' && method === 'GET') {
    const t = tenantFrom(env, null, url);
    const per = Math.min(200, Math.max(10, Number(url.searchParams.get('per_page')) || 50));
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const getPath = (o, p) => { const parts = String(p).split(/\.|\[|\]/).filter(Boolean); let v = o; for (const k of parts) { if (v == null) return null; v = v[k]; } return v; };
    const flat = (v) => v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    // leading decision columns, then every signal field from the catalog
    const decisionCols = [
      ['ts', 'time'], ['mode', 'mode'], ['host', 'host'], ['path', 'path'], ['entry', 'entry'],
      ['experience', 'experience'], ['outcome', 'outcome'], ['destination_id', 'destination'], ['reason', 'reason'],
      ['profile_id', 'profile'], ['device_id', 'device id'], ['ruleset_id', 'ruleset'],
    ];
    const byPath = {}; for (const [alias, p] of FIELD_ALIASES) if (!byPath[p]) byPath[p] = alias;
    const signalCols = SIGNAL_CATALOG.map((s) => [s.key, byPath[s.key] || s.key]);
    const columns = [...decisionCols.map(([k, l]) => ({ key: k, label: l, group: 'decision' })), ...signalCols.map(([k, l], i) => ({ key: 'sig:' + k, label: l, group: SIGNAL_CATALOG[i].group }))];
    const total = (await env.DB.prepare('SELECT COUNT(*) n FROM traffic_decisions WHERE tenant_id=?').bind(t).first())?.n || 0;
    const rows = (await env.DB.prepare('SELECT * FROM traffic_decisions WHERE tenant_id=? ORDER BY ts DESC LIMIT ? OFFSET ?').bind(t, per, (page - 1) * per).all()).results || [];
    const out = rows.map((d) => {
      const sig = (() => { try { return JSON.parse(d.signals_json || '{}'); } catch { return {}; } })();
      const r = {};
      for (const [k] of decisionCols) r[k] = flat(d[k]);
      for (const s of SIGNAL_CATALOG) r['sig:' + s.key] = flat(getPath(sig, s.key));
      return r;
    });
    return json({ ok: true, columns, rows: out, total, page, per_page: per, pages: Math.max(1, Math.ceil(total / per)) });
  }

  // read the active/named ruleset's rules as plain English
  if (seg(0) === 'rules' && seg(1) === 'plain' && method === 'GET') {
    const t = tenantFrom(env, null, url);
    const rsId = url.searchParams.get('ruleset_id');
    const rows = (await env.DB.prepare(rsId
      ? 'SELECT * FROM traffic_rules WHERE tenant_id=? AND ruleset_id=? ORDER BY priority, id'
      : 'SELECT * FROM traffic_rules WHERE tenant_id=? ORDER BY ruleset_id, priority, id').bind(...(rsId ? [t, rsId] : [t])).all()).results || [];
    return json({ ok: true, count: rows.length, rules: rows.map((r) => ({ id: r.id, ruleset_id: r.ruleset_id, name: r.name, priority: r.priority, enabled: !!r.enabled, shadow: !!r.shadow, plain: ruleToPlain(r), condition: JSON.parse(r.condition_json || '{}'), actions: JSON.parse(r.actions_json || '[]') })) });
  }

  // declare a rule in plain English: POST /api/traffic/rule/plain {ruleset_id, text, name?, priority?}
  if (seg(0) === 'rule' && seg(1) === 'plain' && method === 'POST') {
    const b = await bodyOf(request);
    if (!b.ruleset_id) return json({ ok: false, error: 'ruleset_id_required' }, 400);
    const parsed = parsePlainRule(b.text || '');
    if (parsed.error) return json({ ok: false, error: 'parse_failed', message: parsed.error, hint: 'e.g. "if country is KP then block"' }, 400);
    const r = await writeConfig(env, { table: 'traffic_rules', tenant: tenantFrom(env, b, url), actor: b.actor || 'owner', reason: 'plain: ' + b.text, patch: {
      __create: true, ruleset_id: b.ruleset_id, name: b.name || b.text.slice(0, 60), priority: b.priority != null ? Number(b.priority) : 50,
      on_match: b.on_match || 'stop', condition_json: JSON.stringify(parsed.condition), actions_json: JSON.stringify(parsed.actions),
    } });
    return json(r.ok ? { ok: true, id: r.id, compiled: parsed, plain: ruleToPlain({ condition: parsed.condition, actions: parsed.actions }), note: 'activate the ruleset to make it live' } : r, r.ok ? 200 : 400);
  }

  // seed the whitelist/blacklist from JustCloakIt history: import a batch, then seed memberships.
  // Returns a cursor; call again (or via automation) to walk the full 2026-07→08 corpus.
  if (seg(0) === 'seed-history' && method === 'POST') {
    const b = await bodyOf(request);
    const t = tenantFrom(env, b, url);
    const imp = await importJciPage(env, { tenant: t, cursor: b.import_cursor || null, limit: Number(b.limit) || 400 });
    await finalizeHistory(env, { tenant: t }).catch(() => {});
    const seed = await seedPopulations(env, { tenant: t, cursor: b.seed_cursor || null, limit: Number(b.seed_limit) || 2000 });
    const counts = await env.DB.prepare("SELECT SUM(CASE WHEN population='approved_history' THEN 1 ELSE 0 END) whitelist, SUM(CASE WHEN population='blocked_history' THEN 1 ELSE 0 END) blacklist FROM traffic_memberships WHERE tenant_id=? AND superseded_at IS NULL").bind(t).first().catch(() => ({}));
    return json({ ok: true, imported: imp.imported, import_cursor: imp.cursor, import_done: imp.done, seeded: seed.seeded, seed_cursor: seed.cursor, seed_done: seed.done, whitelist: counts?.whitelist || 0, blacklist: counts?.blacklist || 0 });
  }

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
