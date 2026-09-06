// IDENTITY AS DIRECTORY CAPABILITIES — profiles, devices, identifiers, events, capability contexts.
//
// One profile object for everything that presents itself to the build: a human customer, a
// browser-model session, an API agent, a service, a device, an automated workflow. The tables are
// the traffic engine's own (traffic_profiles / traffic_devices / traffic_identifiers /
// traffic_events), so the customer graph the routing engine writes and the actor graph the
// authority plane reads are one graph. There is no separate "OIP user profile".
//
// Nothing here stores a raw identifier: phones and emails are hashed with a server secret and kept
// as a masked display form. Nothing here stores a bearer token, a cookie or a device fingerprint.

import { logEvent } from './event_log.js';
import { buildNowIso } from './build_time.js';
import { getContext, bindContext, unbindContext, normalizeContextInput, contextNarrows, explainContext, presenterFromRequest } from './capability_context.js';

const PROFILE_KINDS = ['human', 'model', 'service', 'device', 'workflow'];
const ID_KINDS = ['phone', 'email', 'customer_id', 'stripe_customer', 'bigcommerce_customer', 'klaviyo_profile', 'blooio_contact', 'external'];

function err(code, message, extra = {}) { return 'ERR:' + code + ' ' + JSON.stringify({ ok: false, error: code, message: String(message || code), ...extra }); }
function ok(o) { return JSON.stringify({ ok: true, ...o }); }
function newId(prefix) { const b = crypto.getRandomValues(new Uint8Array(9)); return prefix + '_' + [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); }
const enc = new TextEncoder();
async function sha256Hex(s) { const d = await crypto.subtle.digest('SHA-256', enc.encode(String(s))); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function identifierSecret(env) { return env.TRAFFIC_GRANT_SECRET || env.ADMIN_SESSION_SECRET || env.TERMINAL_KEY || ''; }
export async function identifierHash(secret, kind, value) { const norm = String(value ?? '').trim().toLowerCase(); if (!norm) return null; return (await sha256Hex(`${secret}|id|${kind}|${norm}`)).slice(0, 40); }
export function maskIdentifier(kind, value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (s.includes('@')) { const [u, d] = s.split('@'); return (u[0] || '*') + '***@' + d; }
  if (/^\+?\d{6,}$/.test(s)) return s.slice(0, 2) + '***' + s.slice(-4);
  if (s.length <= 4) return '***';
  return s.slice(0, Math.min(4, s.length - 2)) + '***' + s.slice(-2);
}

// Body grammar shared with the gateway: JSON object, or `first|second|rest with pipes intact`.
export function parseFields(raw, names) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return {};
  if (s.startsWith('{')) { try { return JSON.parse(s); } catch { return { _bad_json: true }; } }
  const out = {};
  let rest = s;
  for (let i = 0; i < names.length; i++) {
    if (i === names.length - 1) { out[names[i]] = rest; break; }
    const k = rest.indexOf('|');
    if (k < 0) { out[names[i]] = rest; rest = ''; break; }
    out[names[i]] = rest.slice(0, k).trim(); rest = rest.slice(k + 1);
  }
  return out;
}

function tenantOf(env) { return env?.TRACE_CTX?.authContext?.tenant_id || 't_root'; }
function actorOf(env) { return env?.TRACE_CTX?.authContext?.actor || 'owner'; }
function ownerOnly(env) { return !!env?.TRACE_CTX?.authContext?.ownerAuthed; }

export async function ensureProfile(env, { id, kind = 'human', display = null, attrs = {}, tags = [], tenant_id = 't_root' }) {
  const now = buildNowIso();
  const pid = id || newId('prf');
  const existing = await env.DB.prepare('SELECT * FROM traffic_profiles WHERE id = ?').bind(pid).first().catch(() => null);
  if (existing) return { profile: existing, created: false };
  const a = { ...(attrs || {}) };
  if (display) a.display = display;
  await env.DB.prepare(
    `INSERT INTO traffic_profiles (id, tenant_id, kind, known, customer, tags_json, attrs_json, visit_count, first_seen, last_seen, created_at, updated_at, version)
     VALUES (?,?,?,?,0,?,?,0,?,?,?,?,1)`,
  ).bind(pid, tenant_id, PROFILE_KINDS.includes(kind) ? kind : 'human', kind === 'human' ? 0 : 1, JSON.stringify(tags || []), JSON.stringify(a), now, now, now, now).run();
  const profile = await env.DB.prepare('SELECT * FROM traffic_profiles WHERE id = ?').bind(pid).first();
  return { profile, created: true };
}

// A browser-model or API-model session is an ACTOR, not a human. One stable profile per
// (provider, surface, browser profile) so every turn is attributable to the same actor across
// sessions, and never confused with a customer.
export async function ensureModelActor(env, { provider, surface = 'browser_web', profile_id = 'default', model = null }) {
  const id = `prf_model_${String(provider).toLowerCase()}_${surface}_${String(profile_id).replace(/[^a-z0-9_-]/gi, '_').toLowerCase()}`;
  const r = await ensureProfile(env, { id, kind: 'model', display: `${provider} (${surface})`, attrs: { provider, surface, browser_profile: profile_id, model }, tags: ['model', provider], tenant_id: 't_root' });
  if (!r.created) await env.DB.prepare('UPDATE traffic_profiles SET last_seen = ?, visit_count = visit_count + 1 WHERE id = ?').bind(buildNowIso(), id).run().catch(() => {});
  return r.profile;
}

export async function recordProfileEvent(env, { profile_id, device_id = null, session_id = null, event_type, payload = {}, source = 'build', url = null, tenant_id = 't_root' }) {
  const now = buildNowIso();
  const id = newId('evt');
  const payloadJson = JSON.stringify(payload || {});
  await env.DB.prepare(
    `INSERT INTO traffic_events (id, tenant_id, ts, kind, event_type, profile_id, device_id, session_id, url, source, payload_json, evidence_hash, ingested_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(id, tenant_id, now, 'event', String(event_type), profile_id || null, device_id, session_id, url, source, payloadJson, 'sha256:' + await sha256Hex(payloadJson), now).run();
  if (profile_id) await env.DB.prepare('UPDATE traffic_profiles SET last_seen = ?, updated_at = ? WHERE id = ?').bind(now, now, profile_id).run().catch(() => {});
  if (device_id) await env.DB.prepare('UPDATE traffic_devices SET last_seen = ? WHERE id = ?').bind(now, device_id).run().catch(() => {});
  return id;
}

export function makeIdentityFnMap() {
  return {
    // PROFILE_NEW — `kind|display|attrs_json` or JSON {kind, display, attrs, tags, id}
    async profileNew(env, raw) {
      const b = parseFields(raw, ['kind', 'display', 'attrs']);
      if (b._bad_json) return err('BAD_REQUEST', 'body started with { but is not valid JSON');
      const kind = String(b.kind || 'human').toLowerCase();
      if (!PROFILE_KINDS.includes(kind)) return err('BAD_REQUEST', `kind must be one of ${PROFILE_KINDS.join(', ')}`);
      let attrs = {};
      if (b.attrs && typeof b.attrs === 'object') attrs = b.attrs;
      else if (b.attrs) { try { attrs = JSON.parse(b.attrs); } catch { return err('BAD_REQUEST', 'attrs must be JSON'); } }
      let r;
      try { r = await ensureProfile(env, { id: b.id || null, kind, display: b.display || null, attrs, tags: b.tags || [], tenant_id: tenantOf(env) }); }
      catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await logEvent(env, { source: 'identity', key: 'PROFILE_NEW', action: r.created ? 'profile_created' : 'profile_exists', direction: 'in', status: 200, actor: actorOf(env), request: { kind, display: b.display || null }, response: { profile_id: r.profile.id } });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'profile written but the ledger refused the receipt', { profile_id: r.profile.id });
      return ok({ profile_id: r.profile.id, kind: r.profile.kind, created: r.created, ledger_event_id: ev });
    },

    // PROFILE_360 — `profile_id|n` : the unified view a permitted agent gets instead of five lookups.
    async profile360(env, raw) {
      const b = parseFields(raw, ['profile_id', 'n']);
      const pid = String(b.profile_id || '').trim();
      if (!pid) return err('BAD_REQUEST', 'profile_id required');
      const n = Math.min(Math.max(parseInt(b.n || 20, 10) || 20, 1), 100);
      const p = await env.DB.prepare('SELECT * FROM traffic_profiles WHERE id = ?').bind(pid).first();
      if (!p) return err('SESSION_NOT_FOUND', `no profile ${pid}`);
      const devices = (await env.DB.prepare('SELECT id, trusted, trusted_at, revoked_at, trust_expires_at, trust_reason, last_verification, verification_method, label, class, browser, os, first_seen, last_seen, visit_count, CASE WHEN public_key_jwk IS NULL THEN 0 ELSE 1 END AS has_public_key FROM traffic_devices WHERE profile_id = ? ORDER BY last_seen DESC').bind(pid).all()).results || [];
      const identifiers = (await env.DB.prepare('SELECT kind, value_masked, match_type, match_method, confidence, source, first_seen, last_seen, active FROM traffic_identifiers WHERE profile_id = ? AND active = 1 ORDER BY first_seen').bind(pid).all()).results || [];
      const events = (await env.DB.prepare('SELECT ts, event_type, device_id, session_id, url, source, payload_json FROM traffic_events WHERE profile_id = ? ORDER BY ts DESC LIMIT ?').bind(pid, n).all()).results || [];
      let contexts = [], decisions = [];
      try { contexts = (await env.LEDGER.prepare('SELECT fingerprint, device_ids_json, session_ids_json, state_handles_json, require_verification_s, require_pop, policy_rev, updated_at FROM capability_contexts WHERE profile_id = ? ORDER BY updated_at DESC LIMIT 50').bind(pid).all()).results || []; } catch {}
      try { decisions = (await env.LEDGER.prepare("SELECT ts, key, status, response_json FROM events WHERE source = 'authz' AND action = 'context_decision' AND response_json LIKE ? ORDER BY ts DESC LIMIT ?").bind('%"profile_id":"' + pid + '"%', n).all()).results || []; } catch {}
      let model_sessions = [];
      try { model_sessions = (await env.DB.prepare('SELECT session_id, provider, state, conversation_url, last_turn_id, updated_at FROM webmodel_sessions WHERE metadata_json LIKE ? ORDER BY updated_at DESC LIMIT 20').bind('%"actor_profile_id":"' + pid + '"%').all()).results || []; } catch {}
      const parse = (v, d) => { try { return JSON.parse(v); } catch { return d; } };
      return ok({
        profile: { id: p.id, tenant_id: p.tenant_id, kind: p.kind, known: Number(p.known) === 1, customer: Number(p.customer) === 1, tags: parse(p.tags_json, []), attrs: parse(p.attrs_json, {}), visit_count: p.visit_count, first_seen: p.first_seen, last_seen: p.last_seen, merged_into: p.merged_into || null, version: p.version },
        devices, identifiers, events: events.map((e) => ({ ...e, payload: parse(e.payload_json, {}), payload_json: undefined })),
        capability_contexts: contexts.map((c) => ({ ...c, device_ids: parse(c.device_ids_json, []), session_ids: parse(c.session_ids_json, []), state_handles: parse(c.state_handles_json, []), device_ids_json: undefined, session_ids_json: undefined, state_handles_json: undefined })),
        access_decisions: decisions.map((d) => { const r = parse(d.response_json, {}); return { ts: d.ts, key: d.key, decision: r.decision, code: r.code, detail: r.detail, device_id: r.device_id }; }),
        model_sessions,
      });
    },

    // PROFILE_IDENTIFY — `profile_id|kind|value|source` : join an identifier to a profile. Stored hashed + masked, never raw.
    async profileIdentify(env, raw) {
      const b = parseFields(raw, ['profile_id', 'kind', 'value', 'source']);
      if (b._bad_json) return err('BAD_REQUEST', 'body started with { but is not valid JSON');
      const pid = String(b.profile_id || '').trim(); const kind = String(b.kind || '').toLowerCase().trim(); const value = String(b.value || '').trim();
      if (!pid || !kind || !value) return err('BAD_REQUEST', 'profile_id, kind and value are required');
      if (!ID_KINDS.includes(kind)) return err('BAD_REQUEST', `kind must be one of ${ID_KINDS.join(', ')}`);
      const p = await env.DB.prepare('SELECT id FROM traffic_profiles WHERE id = ?').bind(pid).first();
      if (!p) return err('SESSION_NOT_FOUND', `no profile ${pid}`);
      const secret = identifierSecret(env);
      if (!secret) return err('DURABLE_WRITE_FAILED', 'no identifier secret bound; refusing to store an unhashed identifier');
      const hash = await identifierHash(secret, kind, value);
      const masked = maskIdentifier(kind, value);
      const now = buildNowIso();
      // The same identifier already on ANOTHER profile is a merge question, not a silent overwrite.
      const clash = await env.DB.prepare('SELECT profile_id FROM traffic_identifiers WHERE kind = ? AND value_hash = ? AND active = 1 AND profile_id != ?').bind(kind, hash, pid).first();
      if (clash) return err('PROFILE_MISMATCH', `this ${kind} is already joined to profile ${clash.profile_id}; merge profiles explicitly instead`, { other_profile_id: clash.profile_id });
      try {
        await env.DB.prepare(
          `INSERT INTO traffic_identifiers (id, tenant_id, profile_id, kind, value_hash, value_masked, match_type, match_method, confidence, source, first_seen, last_seen, active, provenance_json)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?)
           ON CONFLICT(profile_id, kind, value_hash) DO UPDATE SET last_seen = excluded.last_seen, active = 1`,
        ).bind(newId('idn'), tenantOf(env), pid, kind, hash, masked, 'deterministic', b.method || 'declared', 1.0, String(b.source || actorOf(env)), now, now, JSON.stringify({ by: actorOf(env), at: now })).run();
        await env.DB.prepare('UPDATE traffic_profiles SET known = 1, updated_at = ?, version = version + 1 WHERE id = ?').bind(now, pid).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const evid = await recordProfileEvent(env, { profile_id: pid, event_type: kind === 'phone' ? 'SMS_VERIFIED' : 'CUSTOMER_IDENTIFIED', payload: { kind, value_masked: masked, source: b.source || null }, source: String(b.source || 'build'), tenant_id: tenantOf(env) }).catch(() => null);
      const ev = await logEvent(env, { source: 'identity', key: 'PROFILE_IDENTIFY', action: 'identifier_joined', direction: 'in', status: 200, actor: actorOf(env), request: { profile_id: pid, kind, value_masked: masked, source: b.source || null }, response: { value_hash: hash, event_id: evid } });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'identifier joined but the ledger refused the receipt');
      return ok({ profile_id: pid, kind, value_masked: masked, value_hash: hash, profile_event_id: evid, ledger_event_id: ev });
    },

    // PROFILE_EVENT — `profile_id|event_type|payload_json` or JSON {profile_id, device_id, session_id, event_type, payload, url, source}
    async profileEvent(env, raw) {
      const b = parseFields(raw, ['profile_id', 'event_type', 'payload']);
      if (b._bad_json) return err('BAD_REQUEST', 'body started with { but is not valid JSON');
      const pid = String(b.profile_id || '').trim(); const type = String(b.event_type || '').trim().toUpperCase();
      if (!pid || !type) return err('BAD_REQUEST', 'profile_id and event_type are required');
      let payload = {};
      if (b.payload && typeof b.payload === 'object') payload = b.payload;
      else if (b.payload) { try { payload = JSON.parse(b.payload); } catch { payload = { text: String(b.payload) }; } }
      const p = await env.DB.prepare('SELECT id FROM traffic_profiles WHERE id = ?').bind(pid).first();
      if (!p) return err('SESSION_NOT_FOUND', `no profile ${pid}`);
      let id;
      try { id = await recordProfileEvent(env, { profile_id: pid, device_id: b.device_id || null, session_id: b.session_id || null, event_type: type, payload, url: b.url || null, source: b.source || actorOf(env), tenant_id: tenantOf(env) }); }
      catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await logEvent(env, { source: 'identity', key: 'PROFILE_EVENT', action: 'profile_event', direction: 'in', status: 200, actor: actorOf(env), request: { profile_id: pid, event_type: type, device_id: b.device_id || null }, response: { event_id: id } });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'event written but the ledger refused the receipt', { event_id: id });
      return ok({ profile_id: pid, event_id: id, event_type: type, ledger_event_id: ev });
    },

    // DEVICE_REGISTER — `profile_id|label|public_key_jwk_json` : a first-party device identifier, untrusted until DEVICE_TRUST.
    async deviceRegister(env, raw) {
      const b = parseFields(raw, ['profile_id', 'label', 'public_key_jwk']);
      if (b._bad_json) return err('BAD_REQUEST', 'body started with { but is not valid JSON');
      const pid = String(b.profile_id || '').trim();
      if (!pid) return err('BAD_REQUEST', 'profile_id required');
      const p = await env.DB.prepare('SELECT id FROM traffic_profiles WHERE id = ?').bind(pid).first();
      if (!p) return err('SESSION_NOT_FOUND', `no profile ${pid}`);
      let jwk = null;
      if (b.public_key_jwk && typeof b.public_key_jwk === 'object') jwk = b.public_key_jwk;
      else if (b.public_key_jwk) { try { jwk = JSON.parse(b.public_key_jwk); } catch { return err('BAD_REQUEST', 'public_key_jwk must be a JWK object'); } }
      if (jwk) {
        if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y) return err('BAD_REQUEST', 'public key must be an EC P-256 JWK with x and y');
        if (jwk.d) return err('BAD_REQUEST', 'that JWK carries a PRIVATE key (d); register only the public half');
        try { await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); } catch (e) { return err('BAD_REQUEST', 'public key did not import: ' + e.message); }
      }
      const id = b.id || newId('dev');
      const now = buildNowIso();
      try {
        await env.DB.prepare(
          `INSERT INTO traffic_devices (id, tenant_id, profile_id, trusted, label, class, browser, os, first_seen, last_seen, visit_count, meta_json, public_key_jwk)
           VALUES (?,?,?,0,?,?,?,?,?,?,0,?,?)`,
        ).bind(id, tenantOf(env), pid, b.label || null, b.class || null, b.browser || null, b.os || null, now, now, '{}', jwk ? JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }) : null).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      await recordProfileEvent(env, { profile_id: pid, device_id: id, event_type: 'DEVICE_REGISTERED', payload: { label: b.label || null, has_public_key: !!jwk }, tenant_id: tenantOf(env) }).catch(() => {});
      const ev = await logEvent(env, { source: 'identity', key: 'DEVICE_REGISTER', action: 'device_registered', direction: 'in', status: 200, actor: actorOf(env), request: { profile_id: pid, label: b.label || null, has_public_key: !!jwk }, response: { device_id: id, trusted: false } });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'device written but the ledger refused the receipt', { device_id: id });
      return ok({ device_id: id, profile_id: pid, trusted: false, has_public_key: !!jwk, ledger_event_id: ev, next: `DEVICE_TRUST ${id}|<reason>|<ttl_seconds>` });
    },

    // DEVICE_TRUST — `device_id|reason|ttl_s` ; DEVICE_REVOKE — `device_id|reason` ; DEVICE_VERIFY_RECORD — `device_id|method`
    async deviceTrust(env, raw) {
      if (!ownerOnly(env)) return err('OWNER_REQUIRED', 'trusting a device is an owner action');
      const b = parseFields(raw, ['device_id', 'reason', 'ttl_s']);
      const id = String(b.device_id || '').trim(); if (!id) return err('BAD_REQUEST', 'device_id required');
      const d = await env.DB.prepare('SELECT * FROM traffic_devices WHERE id = ?').bind(id).first();
      if (!d) return err('SESSION_NOT_FOUND', `no device ${id}`);
      const now = buildNowIso();
      const ttl = parseInt(b.ttl_s, 10);
      const until = Number.isFinite(ttl) && ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null;
      try { await env.DB.prepare('UPDATE traffic_devices SET trusted = 1, revoked_at = NULL, trusted_at = ?, trust_reason = ?, trust_expires_at = ? WHERE id = ?').bind(now, b.reason || 'manual', until, id).run(); }
      catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      await recordProfileEvent(env, { profile_id: d.profile_id, device_id: id, event_type: 'DEVICE_TRUSTED', payload: { reason: b.reason || 'manual', until }, tenant_id: d.tenant_id }).catch(() => {});
      const ev = await logEvent(env, { source: 'identity', key: 'DEVICE_TRUST', action: 'device_trusted', direction: 'in', status: 200, actor: actorOf(env), request: { device_id: id, reason: b.reason || 'manual', ttl_s: ttl || null }, response: { trusted: true, trust_expires_at: until } });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'trust written but the ledger refused the receipt');
      return ok({ device_id: id, profile_id: d.profile_id, trusted: true, trusted_at: now, trust_expires_at: until, ledger_event_id: ev });
    },
    async deviceRevoke(env, raw) {
      if (!ownerOnly(env)) return err('OWNER_REQUIRED', 'revoking a device is an owner action');
      const b = parseFields(raw, ['device_id', 'reason']);
      const id = String(b.device_id || '').trim(); if (!id) return err('BAD_REQUEST', 'device_id required');
      const d = await env.DB.prepare('SELECT * FROM traffic_devices WHERE id = ?').bind(id).first();
      if (!d) return err('SESSION_NOT_FOUND', `no device ${id}`);
      const now = buildNowIso();
      try { await env.DB.prepare('UPDATE traffic_devices SET trusted = 0, revoked_at = ?, trust_reason = ? WHERE id = ?').bind(now, b.reason || 'revoked', id).run(); }
      catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      await recordProfileEvent(env, { profile_id: d.profile_id, device_id: id, event_type: 'DEVICE_REVOKED', payload: { reason: b.reason || 'revoked' }, tenant_id: d.tenant_id }).catch(() => {});
      const ev = await logEvent(env, { source: 'identity', key: 'DEVICE_REVOKE', action: 'device_revoked', direction: 'in', status: 200, actor: actorOf(env), request: { device_id: id, reason: b.reason || 'revoked' }, response: { trusted: false, revoked_at: now } });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'revocation written but the ledger refused the receipt');
      return ok({ device_id: id, profile_id: d.profile_id, trusted: false, revoked_at: now, ledger_event_id: ev, note: 'every capability context bound to this device now denies with DEVICE_REVOKED; the profile and its other devices are untouched' });
    },
    async deviceVerifyRecord(env, raw) {
      if (!ownerOnly(env)) return err('OWNER_REQUIRED', 'recording a verification by hand is an owner action; humans verify at /verify-device');
      const b = parseFields(raw, ['device_id', 'method']);
      const id = String(b.device_id || '').trim(); if (!id) return err('BAD_REQUEST', 'device_id required');
      const d = await env.DB.prepare('SELECT * FROM traffic_devices WHERE id = ?').bind(id).first();
      if (!d) return err('SESSION_NOT_FOUND', `no device ${id}`);
      const now = buildNowIso();
      try { await env.DB.prepare('UPDATE traffic_devices SET last_verification = ?, verification_method = ? WHERE id = ?').bind(now, b.method || 'owner_recorded', id).run(); }
      catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      await recordProfileEvent(env, { profile_id: d.profile_id, device_id: id, event_type: 'TURNSTILE_PASS', payload: { method: b.method || 'owner_recorded' }, tenant_id: d.tenant_id }).catch(() => {});
      const ev = await logEvent(env, { source: 'identity', key: 'DEVICE_VERIFY_RECORD', action: 'human_verification_recorded', direction: 'in', status: 200, actor: actorOf(env), request: { device_id: id, method: b.method || 'owner_recorded' }, response: { last_verification: now } });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'verification written but the ledger refused the receipt');
      return ok({ device_id: id, last_verification: now, verification_method: b.method || 'owner_recorded', ledger_event_id: ev });
    },

    // CAP_CONTEXT_BIND — `fingerprint|json` : attach the mutable binding to an existing capability.
    async capContextBind(env, raw) {
      const b = parseFields(raw, ['fingerprint', 'context']);
      if (b._bad_json) return err('BAD_REQUEST', 'body started with { but is not valid JSON');
      const fp = String(b.fingerprint || '').trim();
      if (!fp.startsWith('cap_')) return err('BAD_REQUEST', 'fingerprint (cap_…) required');
      let input = b.context;
      if (typeof input === 'string') { try { input = JSON.parse(input); } catch { return err('BAD_REQUEST', 'context must be a JSON object: {profile_id, device_ids, session_ids, state_handles, origins, require_verification_s, require_pop, policy}'); } }
      if (!input && b.profile_id !== undefined) input = b;   // JSON body form: fields at top level
      if (!input || typeof input !== 'object') return err('BAD_REQUEST', 'context object required');
      const cap = await env.LEDGER.prepare('SELECT * FROM capabilities WHERE fingerprint = ?').bind(fp).first().catch(() => null);
      if (!cap) return err('SESSION_NOT_FOUND', `no capability ${fp}`);
      const auth = env?.TRACE_CTX?.authContext || {};
      if (!auth.ownerAuthed && auth.capFingerprint !== cap.parent_fingerprint) return err('OWNER_REQUIRED', 'only the owner or the holder of this capability\'s parent may bind its context');
      let parent = null;
      if (cap.parent_fingerprint) { const pg = await getContext(env, cap.parent_fingerprint); if (!pg.ok) return err('CONTEXT_STORE_UNAVAILABLE', pg.error); parent = pg.ctx ? { ...pg.ctx, fingerprint: cap.parent_fingerprint } : null; }
      const norm = normalizeContextInput(input);
      if (norm.profile_id) { const p = await env.DB.prepare('SELECT id FROM traffic_profiles WHERE id = ?').bind(norm.profile_id).first(); if (!p) return err('SESSION_NOT_FOUND', `no profile ${norm.profile_id}`); }
      for (const d of norm.device_ids) { const row = await env.DB.prepare('SELECT id, profile_id FROM traffic_devices WHERE id = ?').bind(d).first(); if (!row) return err('SESSION_NOT_FOUND', `no device ${d}`); if (norm.profile_id && row.profile_id !== norm.profile_id) return err('PROFILE_MISMATCH', `device ${d} belongs to ${row.profile_id}, not ${norm.profile_id}`); }
      const r = await bindContext(env, fp, norm, { by: actorOf(env), parent });
      if (!r.ok) return err(r.error, r.error === 'CONTEXT_WIDENS_PARENT' ? `a child context may only narrow its parent: ${JSON.stringify(r.detail)}` : (r.detail || r.error), { detail: r.detail || null });
      return ok({ fingerprint: fp, context: r.ctx, ledger_event_id: r.ledger_event_id, explain: `CAP_CONTEXT_GET ${fp}` });
    },
    // CAP_CONTEXT_GET — `fingerprint|device_id|session_id|state_handle|origin` : the binding, and the decision that presenter would get now.
    async capContextGet(env, raw) {
      const b = parseFields(raw, ['fingerprint', 'device_id', 'session_id', 'state_handle', 'origin']);
      const fp = String(b.fingerprint || '').trim();
      if (!fp.startsWith('cap_')) return err('BAD_REQUEST', 'fingerprint (cap_…) required');
      const cap = await env.LEDGER.prepare('SELECT fingerprint, scope, row_key, expires_at, revoked, max_uses, uses_consumed, tenant_id, parent_fingerprint, risk_ceiling, owner_gate, audience FROM capabilities WHERE fingerprint = ?').bind(fp).first().catch(() => null);
      if (!cap) return err('SESSION_NOT_FOUND', `no capability ${fp}`);
      const presenter = (b.device_id || b.session_id || b.state_handle || b.origin) ? { device_id: b.device_id || null, session_id: b.session_id || null, webmodel_session_id: null, state_handle: b.state_handle || null, origin: b.origin || null, pop: null } : null;
      const x = await explainContext(env, cap, presenter);
      return ok({ capability: { ...cap, revoked: Number(cap.revoked) === 1, owner_gate: Number(cap.owner_gate) === 1, expired: Date.parse(cap.expires_at || '') <= Date.now() }, ...x });
    },
    async capContextUnbind(env, raw) {
      if (!ownerOnly(env)) return err('OWNER_REQUIRED', 'unbinding a context is an owner action');
      const fp = String(parseFields(raw, ['fingerprint']).fingerprint || '').trim();
      if (!fp.startsWith('cap_')) return err('BAD_REQUEST', 'fingerprint (cap_…) required');
      const r = await unbindContext(env, fp, { by: actorOf(env) });
      if (!r.ok) return err(r.error, r.detail || r.error);
      return ok({ fingerprint: fp, unbound: true, ledger_event_id: r.ledger_event_id });
    },
    // ACCESS_DECISIONS — `fingerprint_or_profile_or_device|n` : the recorded context decisions.
    async accessDecisions(env, raw) {
      const b = parseFields(raw, ['id', 'n']);
      const id = String(b.id || '').trim();
      const n = Math.min(Math.max(parseInt(b.n || 20, 10) || 20, 1), 100);
      let rows;
      try {
        rows = id
          ? (await env.LEDGER.prepare("SELECT id, ts, key, status, actor, response_json FROM events WHERE source = 'authz' AND action = 'context_decision' AND (actor = ? OR response_json LIKE ? OR response_json LIKE ?) ORDER BY ts DESC LIMIT ?").bind('cap:' + id, '%"profile_id":"' + id + '"%', '%"device_id":"' + id + '"%', n).all()).results
          : (await env.LEDGER.prepare("SELECT id, ts, key, status, actor, response_json FROM events WHERE source = 'authz' AND action = 'context_decision' ORDER BY ts DESC LIMIT ?").bind(n).all()).results;
      } catch (e) { return err('CONTEXT_STORE_UNAVAILABLE', e.message); }
      const out = (rows || []).map((r) => { let d = {}; try { d = JSON.parse(r.response_json || '{}'); } catch {} return { ledger_event_id: r.id, ts: r.ts, capability: r.key, fingerprint: d.fingerprint, decision: d.decision, code: d.code, detail: d.detail, device_id: d.device_id, profile_id: d.profile_id, session_id: d.session_id, policy_rev: d.policy_rev, decision_hash: d.decision_hash }; });
      return ok({ count: out.length, decisions: out });
    },
  };
}

export { presenterFromRequest, contextNarrows };
