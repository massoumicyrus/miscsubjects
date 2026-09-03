// HttpOnly admin session cookies — exchange TERMINAL_KEY once per device.
// Signing secret: ADMIN_SESSION_SECRET (preferred) or TERMINAL_KEY fallback.

export const COOKIE_NAME = 'ms_admin';
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 60; // 60 days

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function b64url(bytes) {
  const bin = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < bin.length; i++) s += String.fromCharCode(bin[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(str) {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sessionSecret(env) {
  return String(env.ADMIN_SESSION_SECRET || env.TERMINAL_KEY || '');
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function signPayload(secret, payload) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return b64url(sig);
}

async function verifySig(secret, payload, sig) {
  try {
    const key = await hmacKey(secret);
    return crypto.subtle.verify('HMAC', key, b64urlDecode(sig), new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}

export function terminalKeyOk(request, env) {
  if (!env.TERMINAL_KEY) return false;
  if ((request.headers.get('x-terminal-key') || '') === env.TERMINAL_KEY) return true;
  // A URL is the only thing you can hand a browsing LLM — accept the key as a query param too
  // (?terminal_key= or ?tk=) so a plain GET of a URL authenticates, no custom header needed.
  try {
    const u = new URL(request.url);
    const qk = u.searchParams.get('terminal_key') || u.searchParams.get('tk') || '';
    if (qk && qk === env.TERMINAL_KEY) return true;
  } catch {}
  return false;
}

export async function verifyAdminCookie(request, env) {
  const secret = sessionSecret(env);
  if (!secret) return false;
  const token = parseCookies(request.headers.get('cookie'))[COOKIE_NAME];
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!(await verifySig(secret, payload, sig))) return false;
  const parts = payload.split('.');
  if (parts[0] !== 'v1' || parts.length < 3) return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  return true;
}

export async function isBuildAuthed(request, env) {
  if (terminalKeyOk(request, env)) return true;
  return verifyAdminCookie(request, env);
}

// ---- Share tokens: a plain-URL alternative to handing a model the raw terminal key ----
// A short-lived, HMAC-signed token you can paste into ANY URL (?share=...). It expires,
// it never contains the terminal key, and a cautious model (ChatGPT) will fetch a URL that
// carries an opaque token far more readily than one with your real secret in it.
export const SHARE_TOKEN_DEFAULT_TTL_SEC = 60 * 60 * 24; // 24 hours — links shouldn't die mid-session
export const SHARE_TOKEN_MAX_TTL_SEC = 60 * 60 * 24 * 7; // 7 days (hard cap)

// scope: 'read' = GET self-model / resume / ask / key.
//        'act'  = also invoke ANY row (POST or GET /api/dispatch?invoke=…).
//        'row:KEY' = invoke exactly ONE row (KEY) and nothing else — a delegated single authority.
// maxUses: 0 = unlimited; N = the link works for N invocations then dies (one-shot = 1).
export async function mintShareToken(env, { ttlSec, scope, maxUses } = {}) {
  const secret = sessionSecret(env);
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.min(
    Math.max(parseInt(ttlSec, 10) || SHARE_TOKEN_DEFAULT_TTL_SEC, 60),
    SHARE_TOKEN_MAX_TTL_SEC,
  );
  const exp = now + ttl;
  let sc = 'read';
  if (scope === 'act') sc = 'act';
  else if (typeof scope === 'string' && scope.startsWith('row:') && scope.slice(4).trim()) sc = 'row:' + scope.slice(4).trim();
  else if (typeof scope === 'string' && scope.startsWith('rows:') && scope.slice(5).trim()) sc = 'rows:' + scope.slice(5).trim().replace(/\s+/g, '');
  else if (typeof scope === 'string' && scope.startsWith('pfx:') && scope.slice(4).trim()) sc = 'pfx:' + scope.slice(4).trim();
  // pool:<workspace-slug>:<role> — a workspace-pool credential. It names no rows itself;
  // the allowed set is resolved at exercise time from the workspace object's declared
  // capability pool, so authority follows the WORK and can never exceed what the workspace
  // declares. Slugs and roles are dot-free by construction (the payload splits on '.').
  else if (typeof scope === 'string' && scope.startsWith('pool:') && scope.slice(5).trim()) {
    sc = 'pool:' + scope.slice(5).trim().replace(/\s+/g, '').replace(/\./g, '');
  }
  const uses = Math.max(0, parseInt(maxUses, 10) || 0);
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(9)));
  const payload = `sh.${exp}.${sc}.${uses}.${nonce}`;
  const sig = await signPayload(secret, payload);
  return { token: `${payload}.${sig}`, exp, ttl, scope: sc, maxUses: uses, nonce };
}

// Resolve short ?share= codes (sshort:KV) to the full signed token string.
// Short codes are dotless; full tokens always contain dots. Fail-safe: unknown → as-is.
export async function resolveShareTokenString(env, raw) {
  const t = String(raw || '').trim();
  if (!t || !env?.KV) return t;
  if (t.includes('.') || t.length > 16 || !/^[a-z0-9]+$/i.test(t)) return t;
  try {
    const full = await env.KV.get('sshort:' + t.toLowerCase());
    if (full) return String(full);
  } catch { /* ignore */ }
  return t;
}

// If request carries a short ?share= code, return a new Request with the full token.
export async function expandShortShare(env, request) {
  if (!env || !request) return request;
  let u;
  try { u = new URL(request.url); } catch { return request; }
  const raw = u.searchParams.get('share') || '';
  const full = await resolveShareTokenString(env, raw);
  if (!full || full === raw) return request;
  u.searchParams.set('share', full);
  return new Request(u.toString(), request);
}

// Verify a ?share= token off the request URL. Returns { scope, rowKey, maxUses, nonce, exp } or null.
// scope is normalized to 'read' | 'act' | 'row' (with rowKey set). Does NOT consume a use.
// Short share codes are expanded here so every read/act gate (dispatch, invocations, events) works.
export async function verifyShareToken(request, env) {
  let token = '';
  try { token = new URL(request.url).searchParams.get('share') || ''; } catch { return null; }
  return verifyShareTokenValue(env, token);
}

// Same verification as verifyShareToken, but on a raw token STRING rather than a request URL.
// Used by the federation inbox, where the capability travels inside the message body, not the URL.
export async function verifyShareTokenValue(env, tokenRaw) {
  const secret = sessionSecret(env);
  if (!secret) return null;
  let token = String(tokenRaw || '');
  if (!token) return null;
  token = await resolveShareTokenString(env, token);
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!(await verifySig(secret, payload, sig))) return null;
  const parts = payload.split('.');
  if (parts[0] !== 'sh') return null;
  let rawScope, uses, nonce;
  if (parts.length >= 5) { rawScope = parts[2]; uses = parseInt(parts[3], 10) || 0; nonce = parts[4]; }
  else if (parts.length === 4) { rawScope = parts[2]; uses = 0; nonce = parts[3]; }
  else return null;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  let scope = 'read', rowKey = null, rowKeys = null, prefix = null, pool = null;
  if (rawScope === 'act') scope = 'act';
  else if (rawScope && rawScope.startsWith('row:')) { scope = 'row'; rowKey = rawScope.slice(4); }
  else if (rawScope && rawScope.startsWith('rows:')) { scope = 'rows'; rowKeys = rawScope.slice(5).split(',').filter(Boolean); }
  else if (rawScope && rawScope.startsWith('pfx:')) { scope = 'pfx'; prefix = rawScope.slice(4); }
  else if (rawScope && rawScope.startsWith('pool:')) {
    // pool:<workspace>:<role>. Unresolved pool tokens allow NOTHING (tokenAllowsKey denies
    // until resolvePoolToken has loaded the workspace's declared set) — fail closed.
    const rest = rawScope.slice(5).split(':');
    scope = 'pool';
    pool = { workspace: String(rest[0] || '').toLowerCase(), role: String(rest[1] || 'observer').toLowerCase() };
  }
  return {
    scope, rowKey, rowKeys, prefix, pool, maxUses: uses, nonce, exp,
    // Fingerprint the resolved signed token, never its short KV alias. Callers use this
    // for actor attribution and capability-record lookup after either credential form.
    fingerprint: await capFingerprint(token),
  };
}

// Does this verified token permit invoking `key`? act = any; row/rows/pfx = bounded set.
export function tokenAllowsKey(t, key) {
  if (!t) return false;
  if (t.scope === 'act') return true;
  if (t.scope === 'row') return t.rowKey === key;
  if (t.scope === 'rows') return Array.isArray(t.rowKeys) && t.rowKeys.includes(key);
  if (t.scope === 'pfx') return typeof t.prefix === 'string' && !!t.prefix && String(key).startsWith(t.prefix);
  // A pool token's allowed set exists only after resolution against the workspace object
  // (resolvePoolToken fills rowKeys from the workspace's declared role grant). Unresolved
  // pool tokens allow nothing: the credential without the work behind it is not authority.
  if (t.scope === 'pool') return Array.isArray(t.rowKeys) && t.rowKeys.includes(key);
  return false;
}

// ONE TOKEN, EVERY TRANSPORT (owner law, 2026-07-29). The signed share/cap token is THE
// credential. A caller may present it as ?share=<token> in a browser URL, as
// Authorization: Bearer <token> in curl, or as x-write-token — all three resolve here to
// the same verified record. Browser GET and curl are interchangeable by design: web-based
// models that fall back to curl stop failing on transport mismatch.
export async function verifyTokenAnyTransport(request, env) {
  let candidates = [];
  try {
    const u = new URL(request.url);
    const s = u.searchParams.get('share');
    if (s) candidates.push(s);
  } catch {}
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (bearer) candidates.push(bearer);
  const wt = (request.headers.get('x-write-token') || '').trim();
  if (wt) candidates.push(wt);
  for (const c of candidates) {
    const v = await verifyShareTokenValue(env, c);
    if (v) return v;
  }
  return null;
}

// ---- OIP-Caps (v0.3): capability records — the claims a token cannot carry ----
// Fingerprint = cap_<sha256(token)[0:16 hex]>. Never store or ledger the raw token.

export async function capFingerprint(token) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(token || '')));
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return 'cap_' + hex.slice(0, 16);
}

/** Parse a share token WITHOUT consuming or gating — for explain. Returns structure + sig verdict. */
export async function parseShareTokenRaw(env, token) {
  const t = String(token || '');
  const dot = t.lastIndexOf('.');
  if (!t.startsWith('sh.') || dot < 1) return null;
  const payload = t.slice(0, dot);
  const sig = t.slice(dot + 1);
  const parts = payload.split('.');
  if (parts.length < 4) return null;
  const exp = Number(parts[1]);
  let rawScope, uses, nonce;
  if (parts.length >= 5) { rawScope = parts[2]; uses = parseInt(parts[3], 10) || 0; nonce = parts[4]; }
  else { rawScope = parts[2]; uses = 0; nonce = parts[3]; }
  let scope = 'read', rowKey = null, rowKeys = null, prefix = null;
  if (rawScope === 'act') scope = 'act';
  else if (rawScope && rawScope.startsWith('row:')) { scope = 'row'; rowKey = rawScope.slice(4); }
  else if (rawScope && rawScope.startsWith('rows:')) { scope = 'rows'; rowKeys = rawScope.slice(5).split(',').filter(Boolean); }
  else if (rawScope && rawScope.startsWith('pfx:')) { scope = 'pfx'; prefix = rawScope.slice(4); }
  const secret = sessionSecret(env);
  const sigValid = secret ? await verifySig(secret, payload, sig) : false;
  const now = Math.floor(Date.now() / 1000);
  return { scope, rowKey, maxUses: uses, nonce, exp, sigValid, expired: !Number.isFinite(exp) || exp < now };
}

export async function saveCapability(env, cap) {
  if (!env?.LEDGER) return false;
  try {
    await env.LEDGER.prepare(
      `INSERT INTO capabilities
       (fingerprint, nonce, ts, expires_at, scope, row_key, max_uses, purpose, actor, issuer,
        risk_ceiling, owner_gate, body_fixed, revoked, mint_event_id, tenant_id,
        parent_fingerprint, delegation_depth, max_body_bytes, contract_hash, audience)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      cap.fingerprint, cap.nonce, cap.ts, cap.expires_at, cap.scope, cap.row_key || null,
      Number(cap.max_uses) || 0, cap.purpose || null, cap.actor || null, cap.issuer || null,
      cap.risk_ceiling === 'high' ? 'high' : 'low', cap.owner_gate ? 1 : 0,
      cap.body_fixed == null ? null : String(cap.body_fixed), cap.mint_event_id || null,
      cap.tenant_id || null,
      cap.parent_fingerprint || null, Number(cap.delegation_depth) || 0,
      Math.max(0, Number(cap.max_body_bytes) || 0),
      cap.contract_hash || null,
      cap.audience ? String(cap.audience).toLowerCase() : null,
    ).run();
    return true;
  } catch {
    return false;
  }
}

// ── Multi-tenancy ──────────────────────────────────────────────────────────────
// A tenant is an isolation boundary. Owner plane = no tenant_id (or 't_root').
export function normalizeTenantId(id) {
  const s = String(id || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!s) return null;
  return s.startsWith('t_') ? s : 't_' + s;
}
export function isOwnerTenant(id) {
  const s = String(id || '').trim();
  return !s || s === 't_root' || s === 'owner';
}
export async function createTenant(env, t) {
  if (!env?.LEDGER) return null;
  const tenant_id = normalizeTenantId(t.tenant_id || t.name);
  if (!tenant_id) return null;
  try {
    await env.LEDGER.prepare(
      `INSERT INTO tenants (tenant_id, name, status, allow_keys, allow_prefixes, risk_ceiling, owner_actor, created_event_id)
       VALUES (?, ?, 'active', ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id) DO UPDATE SET name=excluded.name, allow_keys=excluded.allow_keys,
         allow_prefixes=excluded.allow_prefixes, risk_ceiling=excluded.risk_ceiling`,
    ).bind(
      tenant_id, t.name || tenant_id,
      String(t.allow_keys || '').replace(/\s+/g, ''),
      String(t.allow_prefixes || '').replace(/\s+/g, ''),
      t.risk_ceiling === 'high' ? 'high' : 'low',
      t.owner_actor || 'owner', t.created_event_id || null,
    ).run();
    return await getTenant(env, tenant_id);
  } catch { return null; }
}
export async function getTenant(env, tenantId) {
  if (!env?.LEDGER || isOwnerTenant(tenantId)) return null;
  try { return await env.LEDGER.prepare('SELECT * FROM tenants WHERE tenant_id = ?').bind(String(tenantId)).first(); }
  catch { return null; }
}
export async function listTenants(env) {
  if (!env?.LEDGER) return [];
  try { return (await env.LEDGER.prepare('SELECT * FROM tenants ORDER BY created_at DESC').all())?.results || []; }
  catch { return []; }
}
export async function setTenantStatus(env, tenantId, status) {
  if (!env?.LEDGER) return false;
  try {
    const r = await env.LEDGER.prepare('UPDATE tenants SET status = ? WHERE tenant_id = ?')
      .bind(status === 'suspended' ? 'suspended' : 'active', String(tenantId)).run();
    return (r.meta?.changes || 0) > 0;
  } catch { return false; }
}
// The isolation rule: does this tenant allow invoking `key`? Owner plane always true.
export function tenantAllowsKey(tenant, key) {
  if (!tenant) return true;                              // owner plane
  if (String(tenant.status) === 'suspended') return false;
  const k = String(key || '');
  const keys = String(tenant.allow_keys || '');
  if (keys === '*') return true;
  const keyList = keys.split(',').map((x) => x.trim()).filter(Boolean);
  if (keyList.includes(k)) return true;
  const pfx = String(tenant.allow_prefixes || '').split(',').map((x) => x.trim()).filter(Boolean);
  return pfx.some((p) => p && k.startsWith(p));
}
// Fingerprints belonging to a tenant — used to isolate its ledger/receipts.
export async function tenantFingerprints(env, tenantId) {
  if (!env?.LEDGER || isOwnerTenant(tenantId)) return [];
  try {
    const r = await env.LEDGER.prepare('SELECT fingerprint FROM capabilities WHERE tenant_id = ?').bind(String(tenantId)).all();
    return (r?.results || []).map((x) => x.fingerprint);
  } catch { return []; }
}

export async function getCapabilityByNonce(env, nonce) {
  if (!env?.LEDGER || !nonce) return null;
  try { return await env.LEDGER.prepare('SELECT * FROM capabilities WHERE nonce = ?').bind(String(nonce)).first(); }
  catch { return null; }
}

export async function getCapabilityByFingerprint(env, fingerprint) {
  if (!env?.LEDGER || !fingerprint) return null;
  try { return await env.LEDGER.prepare('SELECT * FROM capabilities WHERE fingerprint = ?').bind(String(fingerprint)).first(); }
  catch { return null; }
}

export async function revokeCapability(env, fingerprint) {
  if (!env?.LEDGER || !fingerprint) return false;
  try {
    const r = await env.LEDGER.prepare('UPDATE capabilities SET revoked = 1, revoked_ts = ? WHERE fingerprint = ? AND revoked = 0')
      .bind(new Date().toISOString(), String(fingerprint)).run();
    return (r.meta?.changes || 0) > 0;
  } catch {
    return false;
  }
}

/** OIP v0.8 — membrane revocation: revoking a capability revokes every descendant minted
 * from it by attenuation (parent_fingerprint chain, breadth-first, depth-capped). Returns
 * { revoked: [...fingerprints], root_was_live } — the root is included when it was live. */
export async function revokeCascade(env, fingerprint) {
  if (!env?.LEDGER || !fingerprint) return { revoked: [], root_was_live: false };
  const revoked = [];
  const rootLive = await revokeCapability(env, fingerprint);
  if (rootLive) revoked.push(String(fingerprint));
  let frontier = [String(fingerprint)];
  for (let depth = 0; depth < 6 && frontier.length; depth++) {
    const next = [];
    for (const fp of frontier) {
      let rows = [];
      try {
        rows = (await env.LEDGER.prepare('SELECT fingerprint FROM capabilities WHERE parent_fingerprint = ? AND revoked = 0')
          .bind(fp).all())?.results || [];
      } catch { rows = []; }
      for (const row of rows) {
        if (await revokeCapability(env, row.fingerprint)) {
          revoked.push(row.fingerprint);
          next.push(row.fingerprint);
        }
      }
    }
    frontier = next;
  }
  return { revoked, root_was_live: rootLive };
}

/** OIP v0.8.1 — validate the complete recorded delegation chain on every use.
 * Cascade revocation remains the eager path; this is the fail-closed membrane that
 * makes a concurrently inserted child unusable whenever an ancestor is invalid. */
export async function capabilityChainStatus(env, capOrFingerprint) {
  if (!env?.LEDGER) return { ok: false, reason: 'capability_store_unavailable', chain: [] };
  let cap = typeof capOrFingerprint === 'string'
    ? await getCapabilityByFingerprint(env, capOrFingerprint)
    : capOrFingerprint;
  if (!cap?.fingerprint) return { ok: false, reason: 'capability_missing', chain: [] };
  const chain = [];
  const seen = new Set();
  const leafDepth = Number(cap.delegation_depth) || 0;
  for (let hop = 0; hop <= 6; hop++) {
    if (!cap?.fingerprint) return { ok: false, reason: 'ancestor_missing', chain };
    if (seen.has(cap.fingerprint)) return { ok: false, reason: 'delegation_cycle', chain };
    seen.add(cap.fingerprint);
    chain.push(cap);
    const expectedDepth = leafDepth - hop;
    if ((Number(cap.delegation_depth) || 0) !== expectedDepth) {
      return { ok: false, reason: 'delegation_depth_mismatch', chain };
    }
    if (Number(cap.revoked)) return { ok: false, reason: hop ? 'ancestor_revoked' : 'revoked', chain };
    const exp = Date.parse(String(cap.expires_at || ''));
    if (!Number.isFinite(exp) || exp <= Date.now()) {
      return { ok: false, reason: hop ? 'ancestor_expired' : 'expired', chain };
    }
    const parent = String(cap.parent_fingerprint || '');
    if (!parent) {
      if (expectedDepth !== 0) return { ok: false, reason: 'ancestor_missing', chain };
      return { ok: true, reason: 'live', chain };
    }
    if (expectedDepth <= 0) return { ok: false, reason: 'unexpected_parent', chain };
    cap = await getCapabilityByFingerprint(env, parent);
  }
  return { ok: false, reason: 'delegation_too_deep', chain };
}

/** Reserve a bounded slice of a parent's remaining authority for one child.
 * The conditional UPDATE is the concurrency boundary: sibling mints cannot jointly
 * reserve more than max_uses. Unlimited parents need no quantitative reservation. */
export async function reserveCapabilityUses(env, parentCap, requestedUses) {
  const n = Math.max(0, Number(requestedUses) || 0);
  if (!parentCap?.fingerprint || n < 1) return { ok: true, reserved: 0, remaining: null };
  const chain = await capabilityChainStatus(env, parentCap);
  if (!chain.ok) return { ok: false, reason: chain.reason, reserved: 0 };
  const max = Number(parentCap.max_uses) || 0;
  if (max <= 0) return { ok: true, reserved: 0, remaining: 'unlimited' };
  try {
    const legacy = env.KV ? (parseInt(await env.KV.get('share_use:' + parentCap.nonce), 10) || 0) : 0;
    if (legacy > 0) {
      await env.LEDGER.prepare(
        'UPDATE capabilities SET uses_consumed = MAX(COALESCE(uses_consumed,0), ?) WHERE fingerprint = ?',
      ).bind(legacy, parentCap.fingerprint).run();
    }
    const row = await env.LEDGER.prepare(
      `UPDATE capabilities
       SET uses_reserved = COALESCE(uses_reserved,0) + ?
       WHERE fingerprint = ? AND revoked = 0
         AND COALESCE(uses_consumed,0) + COALESCE(uses_reserved,0) + ? <= max_uses
       RETURNING max_uses, uses_consumed, uses_reserved`,
    ).bind(n, parentCap.fingerprint, n).first();
    if (!row) return { ok: false, reason: 'parent_exhausted', reserved: 0 };
    return { ok: true, reserved: n, remaining: Math.max(0, Number(row.max_uses) - Number(row.uses_consumed || 0) - Number(row.uses_reserved || 0)) };
  } catch {
    return { ok: false, reason: 'capability_budget_store_error', reserved: 0 };
  }
}

export async function releaseCapabilityReservation(env, parentFingerprint, reservedUses) {
  const n = Math.max(0, Number(reservedUses) || 0);
  if (!env?.LEDGER || !parentFingerprint || n < 1) return true;
  try {
    await env.LEDGER.prepare(
      'UPDATE capabilities SET uses_reserved = MAX(0, COALESCE(uses_reserved,0) - ?) WHERE fingerprint = ?',
    ).bind(n, String(parentFingerprint)).run();
    return true;
  } catch { return false; }
}

/** Consume one direct use from a recorded capability after validating every ancestor.
 * Child authority was already reserved from its parent at mint time, so only the leaf
 * counter advances here. Existing KV counts are folded forward before the atomic update. */
export async function consumeCapabilityUse(env, cap) {
  if (!cap?.fingerprint || !cap?.nonce || !env?.LEDGER) return { ok: false, reason: 'capability_missing' };
  const chain = await capabilityChainStatus(env, cap);
  if (!chain.ok) return { ok: false, reason: chain.reason };
  try {
    const legacy = env.KV ? (parseInt(await env.KV.get('share_use:' + cap.nonce), 10) || 0) : 0;
    if (legacy > 0) {
      await env.LEDGER.prepare(
        'UPDATE capabilities SET uses_consumed = MAX(COALESCE(uses_consumed,0), ?) WHERE fingerprint = ?',
      ).bind(legacy, cap.fingerprint).run();
    }
    const row = await env.LEDGER.prepare(
      `UPDATE capabilities
       SET uses_consumed = COALESCE(uses_consumed,0) + 1
       WHERE fingerprint = ? AND revoked = 0
         AND (max_uses <= 0 OR COALESCE(uses_consumed,0) + COALESCE(uses_reserved,0) < max_uses)
       RETURNING max_uses, uses_consumed, uses_reserved`,
    ).bind(cap.fingerprint).first();
    if (!row) return { ok: false, reason: 'token_exhausted' };
    if (env.KV) {
      try { await env.KV.put('share_use:' + cap.nonce, String(row.uses_consumed), { expirationTtl: SHARE_TOKEN_MAX_TTL_SEC }); } catch {}
    }
    return {
      ok: true,
      used: Number(row.uses_consumed) || 0,
      reserved: Number(row.uses_reserved) || 0,
      remaining: Number(row.max_uses) > 0
        ? Math.max(0, Number(row.max_uses) - Number(row.uses_consumed || 0) - Number(row.uses_reserved || 0))
        : 'unlimited',
    };
  } catch { return { ok: false, reason: 'capability_budget_store_error' }; }
}

/** How many uses a token has consumed (D1 is authoritative; KV is legacy compatibility). */
export async function shareUseCount(env, nonce) {
  if (!nonce) return 0;
  let kv = 0, d1 = 0;
  if (env?.KV) kv = parseInt(await env.KV.get('share_use:' + nonce), 10) || 0;
  if (env?.LEDGER) {
    try { d1 = Number((await env.LEDGER.prepare('SELECT uses_consumed FROM capabilities WHERE nonce = ?').bind(String(nonce)).first())?.uses_consumed) || 0; } catch {}
  }
  return Math.max(kv, d1);
}

/** Decode tier from token payload for handoff banners (display only — verifyShareToken for auth). */
export function parseShareTokenScope(token) {
  const t = String(token || '');
  if (!t.startsWith('sh.')) return { tier: 'unknown', scope: 'unknown', label: 'unknown token' };
  const dot = t.lastIndexOf('.');
  const payload = dot > 0 ? t.slice(0, dot) : t;
  const parts = payload.split('.');
  if (parts.length < 3) return { tier: 'unknown', scope: 'unknown', label: 'malformed token' };
  const raw = parts[2];
  if (raw === 'act') return { tier: 'write', scope: 'act', label: 'WRITE (act) — invoke + mutate via ?invoke= or POST' };
  if (raw && raw.startsWith('row:')) {
    const rk = raw.slice(4);
    return { tier: 'write', scope: 'row', rowKey: rk, label: 'WRITE (row:' + rk + ') — single capability only' };
  }
  if (raw && raw.startsWith('rows:')) {
    const set = raw.slice(5);
    return { tier: 'write', scope: 'rows', rowKeys: set.split(','), label: 'WRITE (rows) — only this set: ' + set };
  }
  if (raw && raw.startsWith('pfx:')) {
    const pfx = raw.slice(4);
    return { tier: 'write', scope: 'pfx', prefix: pfx, label: 'WRITE (pfx:' + pfx + ') — only capabilities starting ' + pfx };
  }
  return { tier: 'read', scope: 'read', label: 'READ — browse only; ?invoke= and POST blocked' };
}

// Consume one use of a bounded token at invoke time. Returns false when exhausted.
// Unlimited (maxUses<=0) always true. Uses KV as the counter, keyed by the token nonce.
export async function consumeShareUse(env, nonce, maxUses) {
  if (!maxUses || maxUses <= 0) {
    // Still count unlimited invokes so ?explain=1 reports real used (not stuck at 0).
    if (nonce) await recordShareUse(env, nonce);
    return true;
  }
  if (!env.KV) return false; // bounded token but no counter store → fail closed
  const k = 'share_use:' + nonce;
  const cur = parseInt(await env.KV.get(k), 10) || 0;
  if (cur >= maxUses) return false;
  await env.KV.put(k, String(cur + 1), { expirationTtl: SHARE_TOKEN_MAX_TTL_SEC });
  return true;
}

/** Increment share_use counter for observability (unlimited tokens). No-op without KV/nonce. */
export async function recordShareUse(env, nonce) {
  if (!env?.KV || !nonce) return 0;
  const k = 'share_use:' + nonce;
  const cur = parseInt(await env.KV.get(k), 10) || 0;
  const next = cur + 1;
  try {
    await env.KV.put(k, String(next), { expirationTtl: SHARE_TOKEN_MAX_TTL_SEC });
  } catch { /* ignore */ }
  return next;
}

// Read-tier: full admin (key/cookie) OR a read/act share token. (row tokens do NOT grant read.)
export async function buildReadAuthed(request, env) {
  if (await isBuildAuthed(request, env)) return true;
  const s = await verifyShareToken(request, env);
  return !!(s && (s.scope === 'read' || s.scope === 'act'));
}

// Act-tier: full admin OR a share token minted with scope=act.
export async function buildActAuthed(request, env) {
  if (await isBuildAuthed(request, env)) return true;
  const s = await verifyShareToken(request, env);
  return !!(s && s.scope === 'act');
}

export async function createSessionCookie(env) {
  const secret = sessionSecret(env);
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_MAX_AGE_SEC;
  const payload = `v1.${exp}.${now}`;
  const sig = await signPayload(secret, payload);
  const secure = true;
  const maxAge = SESSION_MAX_AGE_SEC;
  // SameSite=Lax, not Strict. Strict withholds the cookie on ANY navigation that arrives from
  // another app — a link opened from Messages, mail, a chat — so /admin loaded from a link was
  // always logged out, and signing in again did not help because the next link failed the same
  // way. Lax still sends it only on top-level GET navigation: cross-site POST/PUT/PATCH/DELETE
  // carry no cookie, which is the CSRF protection that actually matters here, and every
  // mutating admin route is one of those verbs.
  return `${COOKIE_NAME}=${encodeURIComponent(`${payload}.${sig}`)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function wantsJson(request) {
  const accept = request.headers.get('accept') || '';
  const ct = request.headers.get('content-type') || '';
  return accept.includes('application/json') || ct.includes('application/json');
}

/** Gate /admin/* except /admin/login. Returns Response to short-circuit or null to continue. */
// Normalize a request path for gate matching. Cloudflare Pages resolves `/ADMIN/…`, `//admin/…`,
// and `/admin/./…` to the same function, so a raw `startsWith('/admin')` check is bypassable.
// Lowercase, collapse repeated slashes, and resolve `.`/`..` segments before matching.
export function normalizeGatePath(pathname) {
  let p = String(pathname || '').toLowerCase().replace(/\/{2,}/g, '/');
  const out = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { out.pop(); continue; }
    out.push(seg);
  }
  return '/' + out.join('/');
}

export async function adminGate(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = normalizeGatePath(url.pathname);

  if (!(path === '/admin' || path.startsWith('/admin/'))) return null;
  if (path === '/admin/login' || path.startsWith('/admin/login/')) return null;
  if (path === '/admin/logout') return null; // signing out must always work, authed or not

  if (await isBuildAuthed(request, context.env)) return null;

  // Delegated capabilities never open /admin. Admin pages expose terminal history, raw
  // events, settings, and owner controls; capability tokens act only through their named
  // dispatch rows and public proof routes.

  const jsonClient =
    wantsJson(request) ||
    request.method !== 'GET' ||
    url.searchParams.has('data') ||
    url.searchParams.has('cards') ||
    url.searchParams.has('turns') ||
    url.searchParams.has('categories');
  if (jsonClient) {
    return new Response(JSON.stringify({ error: 'unauthorized', login: '/admin/login' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const next = encodeURIComponent(path + url.search);
  return Response.redirect(`${url.origin}/admin/login?next=${next}`, 302);
}
