
const enc = new TextEncoder();

export function b64url(bytes) {
  const s = typeof bytes === 'string' ? bytes : String.fromCharCode(...new Uint8Array(bytes));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64urlDecode(s) {
  const t = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  return atob(t + '='.repeat((4 - (t.length % 4)) % 4));
}

export async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(String(text)));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function hmacB64(secret, text) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return b64url(sig);
}
export async function hmacHex(secret, text) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function timingSafeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function newJti() {
  try { return 'g_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20); } catch { return 'g_' + Math.random().toString(36).slice(2, 14) + Date.now().toString(36); }
}

/** Sign an arbitrary compact payload: "v1.<payload>.<sig>". */
export async function signPayload(secret, payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = await hmacB64(secret, 'v1.' + body);
  return `v1.${body}.${sig}`;
}
/** Verify and decode; returns { ok, payload } or { ok:false, error }. */
export async function verifyPayload(secret, token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return { ok: false, error: 'malformed' };
  const expect = await hmacB64(secret, 'v1.' + parts[1]);
  if (!timingSafeEqual(expect, parts[2])) return { ok: false, error: 'bad_signature' };
  try { return { ok: true, payload: JSON.parse(b64urlDecode(parts[1])) }; } catch { return { ok: false, error: 'bad_payload' }; }
}

/**
 * Issue a grant token. Fields: tenant, aud (host), dest (destination id), sub (profile id), dev
 * (device id), rev (ruleset revision), dec (decision id), ttl_s, one_time, reason, path (optional
 * bound path prefix).
 */
export async function issueGrant(secret, { tenant, aud, dest, sub, dev, rev, dec, ttl_s = 300, one_time = true, reason = '', path = null, now = Date.now() }) {
  if (!secret) throw new Error('TRAFFIC_GRANT_SECRET missing');
  if (!aud || !dest) throw new Error('grant needs aud and dest');
  const ttl = Math.max(5, Math.min(86400, Number(ttl_s) || 300));
  const payload = { jti: newJti(), t: tenant || 't_root', aud: String(aud).toLowerCase(), dest: String(dest), sub: sub || null, dev: dev || null, rev: rev ?? null, dec: dec || null, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + ttl, ot: one_time ? 1 : 0, why: String(reason || '').slice(0, 120), path: path || null };
  return { token: await signPayload(secret, payload), payload };
}

/** Verify a grant against an expected audience/destination. Does not consult the store. */
export async function verifyGrant(secret, token, { aud, dest = null, now = Date.now() } = {}) {
  const v = await verifyPayload(secret, token);
  if (!v.ok) return v;
  const p = v.payload || {};
  if (!p.jti || !p.aud || !p.dest || !p.exp) return { ok: false, error: 'incomplete' };
  if (aud && String(aud).toLowerCase() !== String(p.aud).toLowerCase()) return { ok: false, error: 'audience_mismatch', payload: p };
  if (dest && String(dest) !== String(p.dest)) return { ok: false, error: 'destination_mismatch', payload: p };
  if (Math.floor(now / 1000) > Number(p.exp)) return { ok: false, error: 'expired', payload: p };
  return { ok: true, payload: p };
}

/** Signed short cookie values (turnstile pass, grant session, ack). */
export async function signCookie(secret, obj) { return signPayload(secret, obj); }
export async function readCookie(secret, value) {
  const v = await verifyPayload(secret, value);
  return v.ok ? v.payload : null;
}

/** Keyed hash for identifiers (email, phone, customer ids). Lowercase-trimmed before hashing. */
export async function identifierHash(secret, kind, value) {
  const norm = String(value ?? '').trim().toLowerCase();
  if (!norm) return null;
  return (await sha256Hex(`${secret}|id|${kind}|${norm}`)).slice(0, 40);
}

/** A display form that never reveals the identifier: "j***@example.com", "+1***4626", "cus_***9Q". */
export function maskIdentifier(kind, value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (s.includes('@')) { const [u, d] = s.split('@'); return (u[0] || '*') + '***@' + d; }
  if (/^\+?\d{6,}$/.test(s)) return s.slice(0, 2) + '***' + s.slice(-4);
  if (s.length <= 4) return '***';
  return s.slice(0, Math.min(4, s.length - 2)) + '***' + s.slice(-2);
}
