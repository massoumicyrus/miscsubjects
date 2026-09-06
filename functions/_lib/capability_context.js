// CAPABILITY CONTEXT — the mutable half of authority.
//
// The signed share token is IMMUTABLE authority: what may be done, for how long, how many times,
// under which ancestor. That is the right shape for a bearer credential and the wrong shape for
// everything that changes after minting: which device presents it, whether that device is still
// trusted, whether the human behind it verified recently, which browser-model session or state
// handle it was issued for, which origin it may be exercised from.
//
// So the context lives in a second, server-side record keyed by the capability fingerprint:
//
//   TOKEN               says what may be done                  (immutable, signed, existing)
//   CAPABILITY_CONTEXT  says who/what it belongs to and where  (mutable, this file)
//   PROFILE / DEVICE    the current presenter                  (traffic_profiles / traffic_devices)
//   POLICY DECISION     may THIS invocation execute now?       (evaluateContext, pure)
//   LEDGER              records the decision and the execution (source: authz)
//
// An invocation succeeds only when AUTHORITY_VALID (every existing gate) AND CONTEXT_VALID (this).
// A cryptographically valid token copied into another browser fails here, by name, not as a 403.
//
// Every denial is one of the named codes below. They are never collapsed into a generic refusal,
// because the person reading the explain surface needs to know WHICH condition failed.

import { logEvent } from './event_log.js';
import { buildNowIso } from './build_time.js';

export const CONTEXT_CODES = Object.freeze([
  'VALID_TOKEN_WRONG_CONTEXT',   // umbrella, used only when nothing more specific applies
  'DEVICE_NOT_APPROVED',         // presenter named no device, an unknown device, or an untrusted one
  'DEVICE_REVOKED',              // the device was trusted and has since been revoked
  'DEVICE_TRUST_EXPIRED',        // trust had a TTL and it passed
  'SESSION_NOT_APPROVED',        // the context binds sessions and this is not one of them
  'PROFILE_MISMATCH',            // the presenting device belongs to a different profile
  'PROFILE_BLOCKED',             // the bound profile carries a block
  'TURNSTILE_REQUIRED',          // step-up: no human verification recorded on this device
  'TURNSTILE_STALE',             // step-up: verification older than the context allows
  'ORIGIN_MISMATCH',             // exercised from an origin the context does not allow
  'STATE_HANDLE_MISMATCH',       // the context binds work handles and this is not one of them
  'POP_REQUIRED',                // the context requires proof of possession and none was presented
  'POP_INVALID',                 // the signature did not verify against the device's public key
  'POP_STALE',                   // the signed timestamp is outside the window
  'POP_REPLAY',                  // the nonce was already used
  'POLICY_DENIED',               // a profile-state policy rule failed
  'CONTEXT_STORE_UNAVAILABLE',   // the context could not be read; fail closed
]);

export const POP_WINDOW_S = 300;
const LIST_FIELDS = ['device_ids', 'session_ids', 'state_handles', 'sheet_ids', 'origins'];

// ---------------------------------------------------------------- presenter

// What the current request carries about WHO is presenting the token. Headers first, then the
// query string, then a JSON body. Nothing here is trusted on its own: a device id is a claim that
// the device row and, when required, a signature turn into a fact.
export function presenterFromRequest(request, extra = {}) {
  const h = (n) => { try { return request?.headers?.get(n) || ''; } catch { return ''; } };
  let q = null;
  try { q = new URL(request.url).searchParams; } catch { q = null; }
  const body = extra.body && typeof extra.body === 'object' ? extra.body : {};
  const pick = (...vals) => { for (const v of vals) { const s = String(v == null ? '' : v).trim(); if (s) return s; } return null; };
  let origin = h('origin');
  if (!origin) { const ref = h('referer'); if (ref) { try { origin = new URL(ref).origin; } catch { origin = ''; } } }
  return {
    device_id: pick(h('x-device-id'), q?.get('device'), body.device_id),
    session_id: pick(h('x-session-id'), q?.get('session'), body.session_id),
    webmodel_session_id: pick(h('x-webmodel-session'), body.webmodel_session_id, extra.webmodel_session_id),
    state_handle: pick(h('x-state-handle'), q?.get('state'), body.state_handle, extra.state_handle),
    origin: origin || null,
    pop: (h('x-device-signature') || body.device_signature) ? {
      signature: pick(h('x-device-signature'), body.device_signature),
      nonce: pick(h('x-device-nonce'), body.device_nonce),
      ts: pick(h('x-device-ts'), body.device_ts),
    } : null,
  };
}

// ---------------------------------------------------------------- storage

function parseCtxRow(row) {
  if (!row) return null;
  const j = (v, d) => { try { const x = JSON.parse(v == null ? '' : v); return x == null ? d : x; } catch { return d; } };
  return {
    fingerprint: row.fingerprint,
    tenant_id: row.tenant_id || null,
    profile_id: row.profile_id || null,
    actor_kind: row.actor_kind || null,
    device_ids: j(row.device_ids_json, []),
    session_ids: j(row.session_ids_json, []),
    state_handles: j(row.state_handles_json, []),
    sheet_ids: j(row.sheet_ids_json, []),
    origins: j(row.origins_json, []),
    require_verification_s: row.require_verification_s == null ? null : Number(row.require_verification_s),
    require_pop: Number(row.require_pop) === 1,
    policy: j(row.policy_json, []),
    policy_rev: Number(row.policy_rev) || 1,
    created_at: row.created_at, updated_at: row.updated_at, updated_by: row.updated_by || null,
  };
}

export async function getContext(env, fingerprint) {
  if (!env?.LEDGER || !fingerprint) return { ok: true, ctx: null };
  try {
    const row = await env.LEDGER.prepare('SELECT * FROM capability_contexts WHERE fingerprint = ?').bind(String(fingerprint)).first();
    return { ok: true, ctx: parseCtxRow(row) };
  } catch (e) {
    // A table that does not exist yet is "no context" — the feature is additive. Anything else
    // is a store failure and fails closed at the gate.
    if (/no such table/i.test(String(e?.message || ''))) return { ok: true, ctx: null };
    return { ok: false, ctx: null, error: String(e?.message || e) };
  }
}

export function normalizeContextInput(input) {
  const src = input && typeof input === 'object' ? input : {};
  const list = (v) => {
    if (v == null || v === '') return [];
    const arr = Array.isArray(v) ? v : String(v).split(/[,\s]+/);
    return [...new Set(arr.map((x) => String(x).trim()).filter(Boolean))];
  };
  const out = {
    tenant_id: src.tenant_id ? String(src.tenant_id) : null,
    profile_id: src.profile_id ? String(src.profile_id) : null,
    actor_kind: src.actor_kind ? String(src.actor_kind) : null,
    device_ids: list(src.device_ids ?? src.device_id),
    session_ids: list(src.session_ids ?? src.session_id),
    state_handles: list(src.state_handles ?? src.state_handle),
    sheet_ids: list(src.sheet_ids ?? src.sheet_id),
    origins: list(src.origins ?? src.origin).map((o) => o.replace(/\/+$/, '').toLowerCase()),
    require_verification_s: src.require_verification_s == null || src.require_verification_s === '' ? null : Math.max(1, parseInt(src.require_verification_s, 10) || 0) || null,
    require_pop: src.require_pop === true || src.require_pop === 1 || src.require_pop === '1' || src.require_pop === 'true',
    policy: Array.isArray(src.policy) ? src.policy.filter((r) => r && typeof r === 'object' && r.field && r.op) : [],
  };
  return out;
}

// A child context may only NARROW its parent: the same profile and tenant, a subset of every
// list, a verification window no longer than the parent's, proof of possession kept if the
// parent required it, and every parent policy rule carried forward. Widening is refused by name.
export function contextNarrows(parent, child) {
  if (!parent) return { ok: true };
  if (parent.profile_id && child.profile_id !== parent.profile_id) return { ok: false, why: 'profile_widened', field: 'profile_id' };
  if (parent.tenant_id && child.tenant_id !== parent.tenant_id) return { ok: false, why: 'tenant_widened', field: 'tenant_id' };
  for (const f of LIST_FIELDS) {
    const P = parent[f] || [];
    if (!P.length) continue;
    const C = child[f] || [];
    if (!C.length) return { ok: false, why: 'binding_dropped', field: f };
    for (const v of C) if (!P.includes(v)) return { ok: false, why: 'binding_widened', field: f, value: v };
  }
  if (parent.require_verification_s != null) {
    if (child.require_verification_s == null || child.require_verification_s > parent.require_verification_s) return { ok: false, why: 'verification_window_widened', field: 'require_verification_s' };
  }
  if (parent.require_pop && !child.require_pop) return { ok: false, why: 'pop_dropped', field: 'require_pop' };
  const key = (r) => JSON.stringify([r.field, r.op, r.value ?? null]);
  const childKeys = new Set((child.policy || []).map(key));
  for (const r of parent.policy || []) if (!childKeys.has(key(r))) return { ok: false, why: 'policy_rule_dropped', field: 'policy', rule: r };
  return { ok: true };
}

export async function bindContext(env, fingerprint, input, { by = 'owner', parent = null } = {}) {
  if (!env?.LEDGER) return { ok: false, error: 'CONTEXT_STORE_UNAVAILABLE' };
  const ctx = normalizeContextInput(input);
  if (parent) {
    const n = contextNarrows(parent, ctx);
    if (!n.ok) return { ok: false, error: 'CONTEXT_WIDENS_PARENT', detail: n };
  }
  const existing = await getContext(env, fingerprint);
  const rev = (existing.ctx?.policy_rev || 0) + 1;
  const now = buildNowIso();
  try {
    await env.LEDGER.prepare(
      `INSERT INTO capability_contexts
         (fingerprint, tenant_id, profile_id, actor_kind, device_ids_json, session_ids_json, state_handles_json,
          sheet_ids_json, origins_json, require_verification_s, require_pop, policy_json, policy_rev, created_at, updated_at, updated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(fingerprint) DO UPDATE SET
         tenant_id = excluded.tenant_id, profile_id = excluded.profile_id, actor_kind = excluded.actor_kind,
         device_ids_json = excluded.device_ids_json, session_ids_json = excluded.session_ids_json,
         state_handles_json = excluded.state_handles_json, sheet_ids_json = excluded.sheet_ids_json,
         origins_json = excluded.origins_json, require_verification_s = excluded.require_verification_s,
         require_pop = excluded.require_pop, policy_json = excluded.policy_json, policy_rev = excluded.policy_rev,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    ).bind(
      String(fingerprint), ctx.tenant_id, ctx.profile_id, ctx.actor_kind,
      JSON.stringify(ctx.device_ids), JSON.stringify(ctx.session_ids), JSON.stringify(ctx.state_handles),
      JSON.stringify(ctx.sheet_ids), JSON.stringify(ctx.origins), ctx.require_verification_s, ctx.require_pop ? 1 : 0,
      JSON.stringify(ctx.policy), rev, existing.ctx?.created_at || now, now, String(by),
    ).run();
  } catch (e) { return { ok: false, error: 'CONTEXT_STORE_UNAVAILABLE', detail: String(e?.message || e) }; }
  const ev = await logEvent(env, {
    source: 'authz', key: 'CAP_CONTEXT_BIND', action: 'context_bound', direction: 'in', status: 200, actor: by,
    request: { fingerprint, policy_rev: rev, parent: parent?.fingerprint || null },
    response: { ...ctx, policy_rev: rev },
  });
  return { ok: true, ctx: { ...ctx, fingerprint, policy_rev: rev }, ledger_event_id: ev };
}

export async function unbindContext(env, fingerprint, { by = 'owner' } = {}) {
  if (!env?.LEDGER) return { ok: false, error: 'CONTEXT_STORE_UNAVAILABLE' };
  try { await env.LEDGER.prepare('DELETE FROM capability_contexts WHERE fingerprint = ?').bind(String(fingerprint)).run(); }
  catch (e) { return { ok: false, error: 'CONTEXT_STORE_UNAVAILABLE', detail: String(e?.message || e) }; }
  const ev = await logEvent(env, { source: 'authz', key: 'CAP_CONTEXT_UNBIND', action: 'context_unbound', direction: 'in', status: 200, actor: by, request: { fingerprint }, response: { unbound: true } });
  return { ok: true, ledger_event_id: ev };
}

// ---------------------------------------------------------------- the pure decision

function flatView({ profile, device, tenant_id }) {
  const tags = (() => { try { return JSON.parse(profile?.tags_json || '[]'); } catch { return []; } })();
  const attrs = (() => { try { return JSON.parse(profile?.attrs_json || '{}'); } catch { return {}; } })();
  const v = {
    'tenant': tenant_id || null,
    'profile.id': profile?.id || null, 'profile.kind': profile?.kind || null,
    'profile.known': Number(profile?.known) === 1, 'profile.customer': Number(profile?.customer) === 1,
    'profile.tags': tags, 'profile.blocked': tags.includes('blocked') || attrs.blocked === true,
    'device.id': device?.id || null, 'device.trusted': Number(device?.trusted) === 1,
  };
  for (const [k, val] of Object.entries(attrs)) v['profile.attrs.' + k] = val;
  return v;
}

function ruleHolds(rule, view) {
  const actual = view[rule.field];
  const want = rule.value;
  switch (String(rule.op)) {
    case 'eq': return actual === want || String(actual) === String(want);
    case 'ne': return !(actual === want || String(actual) === String(want));
    case 'in': return Array.isArray(want) && want.some((w) => actual === w || String(actual) === String(w));
    case 'contains': return Array.isArray(actual) ? actual.includes(want) : String(actual == null ? '' : actual).includes(String(want));
    case 'exists': return actual != null && actual !== '';
    case 'gte': return Number(actual) >= Number(want);
    case 'lte': return Number(actual) <= Number(want);
    case 'true': return actual === true;
    case 'false': return actual === false || actual == null;
    default: return false;
  }
}

// Given the context, the presenter and the rows behind them, decide. No I/O; every path is a
// named code and a list of the checks that ran, so an explain surface and a denial say the same
// thing.
export function evaluateContext({ ctx, presenter, device, profile, popResult, nowMs = Date.now(), rowSensitive = false }) {
  const checks = [];
  const deny = (code, detail) => { checks.push({ check: code, ok: false, detail }); return { ok: false, code, detail, checks }; };
  const pass = (check, detail) => checks.push({ check, ok: true, detail });
  if (!ctx) return { ok: true, code: null, applied: false, checks };
  const p = presenter || {};

  // Device binding.
  if (ctx.device_ids.length) {
    if (!p.device_id) return deny('DEVICE_NOT_APPROVED', 'context binds devices and the request named none (x-device-id)');
    if (!ctx.device_ids.includes(p.device_id)) return deny('DEVICE_NOT_APPROVED', `device ${p.device_id} is not in the bound set`);
    if (!device) return deny('DEVICE_NOT_APPROVED', `device ${p.device_id} has no record`);
    if (device.revoked_at) return deny('DEVICE_REVOKED', `revoked ${device.revoked_at}${device.trust_reason ? ' (' + device.trust_reason + ')' : ''}`);
    if (Number(device.trusted) !== 1) return deny('DEVICE_NOT_APPROVED', `device ${p.device_id} is registered but not trusted`);
    if (device.trust_expires_at && Date.parse(device.trust_expires_at) <= nowMs) return deny('DEVICE_TRUST_EXPIRED', `trust expired ${device.trust_expires_at}`);
    pass('device', p.device_id);
  }
  // Profile: the device must belong to the bound profile, and the profile must not be blocked.
  if (ctx.profile_id) {
    if (device && device.profile_id && device.profile_id !== ctx.profile_id) return deny('PROFILE_MISMATCH', `device belongs to ${device.profile_id}, context is bound to ${ctx.profile_id}`);
    if (!profile) return deny('PROFILE_MISMATCH', `bound profile ${ctx.profile_id} has no record`);
    if (profile.merged_into) return deny('PROFILE_MISMATCH', `profile ${ctx.profile_id} was merged into ${profile.merged_into}; rebind`);
    const view = flatView({ profile, device, tenant_id: ctx.tenant_id });
    if (view['profile.blocked']) return deny('PROFILE_BLOCKED', `profile ${ctx.profile_id} is blocked`);
    pass('profile', ctx.profile_id);
  }
  // Sessions: a browser-model session, a sheet session, a support case — one opaque id space.
  if (ctx.session_ids.length) {
    const presented = [p.session_id, p.webmodel_session_id].filter(Boolean);
    if (!presented.length) return deny('SESSION_NOT_APPROVED', 'context binds sessions and the request named none');
    if (!presented.some((s) => ctx.session_ids.includes(s))) return deny('SESSION_NOT_APPROVED', `session ${presented.join(',')} is not in the bound set`);
    pass('session', presented.find((s) => ctx.session_ids.includes(s)));
  }
  if (ctx.state_handles.length) {
    if (!p.state_handle || !ctx.state_handles.includes(p.state_handle)) return deny('STATE_HANDLE_MISMATCH', `context is bound to ${ctx.state_handles.join(',')}; request carried ${p.state_handle || 'none'}`);
    pass('state_handle', p.state_handle);
  }
  if (ctx.origins.length) {
    const o = String(p.origin || '').replace(/\/+$/, '').toLowerCase();
    if (!o || !ctx.origins.includes(o)) return deny('ORIGIN_MISMATCH', `origin ${o || 'none'} is not in ${ctx.origins.join(',')}`);
    pass('origin', o);
  }
  // Step-up: recent human verification on the presenting device.
  if (ctx.require_verification_s != null) {
    const at = device?.last_verification ? Date.parse(device.last_verification) : NaN;
    if (!Number.isFinite(at)) return deny('TURNSTILE_REQUIRED', `no human verification recorded on ${p.device_id || 'the device'}; complete /verify-device`);
    const age = Math.floor((nowMs - at) / 1000);
    if (age > ctx.require_verification_s) return deny('TURNSTILE_STALE', `verification is ${age}s old; this capability requires one within ${ctx.require_verification_s}s`);
    pass('human_verification', `${age}s ago via ${device?.verification_method || 'unknown'}`);
  }
  // Proof of possession: the device signed this exact request with the key registered on it.
  if (ctx.require_pop) {
    if (!popResult) return deny('POP_REQUIRED', 'context requires a device signature (x-device-signature, x-device-nonce, x-device-ts)');
    if (!popResult.ok) return deny(popResult.code || 'POP_INVALID', popResult.detail || 'signature did not verify');
    pass('proof_of_possession', popResult.detail || 'verified');
  }
  // Profile-state policy.
  if (ctx.policy.length) {
    const view = flatView({ profile, device, tenant_id: ctx.tenant_id });
    for (const rule of ctx.policy) {
      if (!ruleHolds(rule, view)) return deny('POLICY_DENIED', `rule ${rule.field} ${rule.op} ${JSON.stringify(rule.value ?? null)} failed (actual ${JSON.stringify(view[rule.field] ?? null)})`);
    }
    pass('policy', `${ctx.policy.length} rule(s) hold`);
  }
  void rowSensitive;
  return { ok: true, code: null, applied: true, checks };
}

// ---------------------------------------------------------------- proof of possession

const enc = new TextEncoder();
async function sha256Hex(s) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(String(s == null ? '' : s)));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function b64urlToBytes(s) {
  const t = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// The signed message is exactly this, so a signature over one request cannot be moved to another:
//   <fingerprint>|<capability key>|<sha256 of the body>|<nonce>|<unix seconds>
export async function popMessage({ fingerprint, key, body, nonce, ts }) {
  return `${fingerprint}|${key}|${await sha256Hex(body == null ? '' : body)}|${nonce}|${ts}`;
}

export async function verifyPop(env, { device, presenter, fingerprint, key, body, nowMs = Date.now() }) {
  const pop = presenter?.pop;
  if (!pop || !pop.signature) return { ok: false, code: 'POP_REQUIRED', detail: 'no signature presented' };
  if (!device?.public_key_jwk) return { ok: false, code: 'POP_INVALID', detail: 'the device has no registered public key' };
  const ts = Number(pop.ts);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > POP_WINDOW_S) return { ok: false, code: 'POP_STALE', detail: `signed at ${pop.ts}; window is ${POP_WINDOW_S}s` };
  if (!pop.nonce || String(pop.nonce).length < 8) return { ok: false, code: 'POP_INVALID', detail: 'nonce missing or too short' };
  let jwk;
  try { jwk = typeof device.public_key_jwk === 'string' ? JSON.parse(device.public_key_jwk) : device.public_key_jwk; } catch { return { ok: false, code: 'POP_INVALID', detail: 'registered public key is not valid JWK' }; }
  let valid = false;
  try {
    const pub = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const msg = await popMessage({ fingerprint, key, body, nonce: pop.nonce, ts });
    valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64urlToBytes(pop.signature), enc.encode(msg));
  } catch (e) { return { ok: false, code: 'POP_INVALID', detail: 'verify threw: ' + String(e?.message || e) }; }
  if (!valid) return { ok: false, code: 'POP_INVALID', detail: 'ECDSA P-256 signature did not verify' };
  // Replay protection: the nonce is consumed by a primary-key insert; a second use conflicts.
  if (env?.LEDGER) {
    try {
      await env.LEDGER.prepare('INSERT INTO pop_nonces (nonce, device_id, fingerprint, ts) VALUES (?,?,?,?)').bind(String(pop.nonce), device.id, fingerprint, buildNowIso()).run();
    } catch (e) {
      if (/UNIQUE|constraint/i.test(String(e?.message || ''))) return { ok: false, code: 'POP_REPLAY', detail: `nonce ${String(pop.nonce).slice(0, 12)}… was already used` };
      return { ok: false, code: 'POP_INVALID', detail: 'nonce store failed: ' + String(e?.message || e) };
    }
  }
  return { ok: true, detail: 'ECDSA P-256 over the request, nonce consumed' };
}

// ---------------------------------------------------------------- the gate

async function loadDevice(env, id) {
  if (!env?.DB || !id) return null;
  try { return await env.DB.prepare('SELECT * FROM traffic_devices WHERE id = ?').bind(String(id)).first(); } catch { return null; }
}
async function loadProfile(env, id) {
  if (!env?.DB || !id) return null;
  try { return await env.DB.prepare('SELECT * FROM traffic_profiles WHERE id = ?').bind(String(id)).first(); } catch { return null; }
}

// Decide, then record the decision, then answer. Returns { ok:true, applied } or
// { ok:false, status, reason:<CODE>, note, checks, ledger_event_id }. Every denial is a receipt.
export async function contextGateCheck(env, cap, presenter, { key, body, row } = {}) {
  if (!cap?.fingerprint) return { ok: true, applied: false };
  const got = await getContext(env, cap.fingerprint);
  if (!got.ok) {
    const ev = await logEvent(env, { source: 'authz', key: key || 'CAPABILITY', action: 'context_decision', direction: 'in', status: 503, actor: 'cap:' + cap.fingerprint, request: { fingerprint: cap.fingerprint, attempted_key: key }, response: { decision: 'deny', code: 'CONTEXT_STORE_UNAVAILABLE', detail: got.error } });
    return { ok: false, status: 503, reason: 'CONTEXT_STORE_UNAVAILABLE', note: 'the capability context could not be read; authority alone is not enough when a context exists', ledger_event_id: ev };
  }
  const ctx = got.ctx;
  if (!ctx) return { ok: true, applied: false };
  const device = presenter?.device_id ? await loadDevice(env, presenter.device_id) : null;
  const profile = ctx.profile_id ? await loadProfile(env, ctx.profile_id) : (device?.profile_id ? await loadProfile(env, device.profile_id) : null);
  let popResult = null;
  if (ctx.require_pop) popResult = await verifyPop(env, { device, presenter, fingerprint: cap.fingerprint, key, body });
  const verdict = evaluateContext({ ctx, presenter, device, profile, popResult, rowSensitive: Number(row?.sensitive) === 1 });
  const decision = {
    decision: verdict.ok ? 'allow' : 'deny', code: verdict.code, detail: verdict.detail || null, checks: verdict.checks,
    fingerprint: cap.fingerprint, attempted_key: key || null, policy_rev: ctx.policy_rev,
    profile_id: ctx.profile_id || profile?.id || null, device_id: presenter?.device_id || null,
    session_id: presenter?.session_id || presenter?.webmodel_session_id || null, state_handle: presenter?.state_handle || null,
    origin: presenter?.origin || null, verification_at: device?.last_verification || null,
  };
  decision.decision_hash = 'sha256:' + await sha256Hex(JSON.stringify(decision));
  const ev = await logEvent(env, {
    source: 'authz', key: key || 'CAPABILITY', action: 'context_decision', direction: 'in', status: verdict.ok ? 200 : 403,
    actor: 'cap:' + cap.fingerprint, request: { fingerprint: cap.fingerprint, attempted_key: key, policy_rev: ctx.policy_rev, presenter: { device_id: decision.device_id, session_id: decision.session_id, state_handle: decision.state_handle, origin: decision.origin } },
    response: decision,
  });
  if (verdict.ok) return { ok: true, applied: true, checks: verdict.checks, ledger_event_id: ev, decision_hash: decision.decision_hash };
  return {
    ok: false, status: verdict.code === 'POLICY_DENIED' || verdict.code === 'PROFILE_BLOCKED' ? 403 : 401, reason: verdict.code,
    note: `VALID_TOKEN_WRONG_CONTEXT: the token is live and in scope; this invocation was refused because ${verdict.detail}. No execution occurred. Explain: CAP_CONTEXT_GET ${cap.fingerprint}.`,
    checks: verdict.checks, ledger_event_id: ev, decision_hash: decision.decision_hash,
  };
}

// The explain surface: the context as bound, and — when a presenter is supplied — the decision
// that presenter would get right now, without executing anything and without consuming a nonce.
export async function explainContext(env, cap, presenter = null) {
  const got = await getContext(env, cap?.fingerprint);
  if (!got.ok) return { context: null, error: 'CONTEXT_STORE_UNAVAILABLE' };
  if (!got.ctx) return { context: null, effective_decision: { decision: 'allow', code: null, note: 'no context bound; authority checks alone apply' } };
  const ctx = got.ctx;
  const device = presenter?.device_id ? await loadDevice(env, presenter.device_id) : null;
  const profile = ctx.profile_id ? await loadProfile(env, ctx.profile_id) : null;
  const verdict = presenter ? evaluateContext({ ctx, presenter, device, profile, popResult: ctx.require_pop ? { ok: false, code: 'POP_REQUIRED', detail: 'explain does not verify signatures' } : null }) : null;
  return {
    context: ctx,
    bound: {
      profile: profile ? { id: profile.id, kind: profile.kind, known: Number(profile.known) === 1, customer: Number(profile.customer) === 1, tags: JSON.parse(profile.tags_json || '[]') } : null,
      devices: ctx.device_ids, sessions: ctx.session_ids, state_handles: ctx.state_handles, origins: ctx.origins,
      human_verification_within_s: ctx.require_verification_s, proof_of_possession: ctx.require_pop, policy: ctx.policy,
    },
    presenter: presenter || null,
    device: device ? { id: device.id, profile_id: device.profile_id, trusted: Number(device.trusted) === 1, trusted_at: device.trusted_at, revoked_at: device.revoked_at, trust_expires_at: device.trust_expires_at, last_verification: device.last_verification, verification_method: device.verification_method, has_public_key: !!device.public_key_jwk } : null,
    effective_decision: verdict ? { decision: verdict.ok ? 'allow' : 'deny', code: verdict.code, detail: verdict.detail || null, checks: verdict.checks } : null,
  };
}
