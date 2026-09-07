// Mechanical tests for the capability context: the pure decision, narrowing, proof of possession.
// node scripts/capability-context.test.mjs
import assert from 'node:assert/strict';
import { evaluateContext, contextNarrows, normalizeContextInput, presenterFromRequest, popMessage, verifyPop, CONTEXT_CODES } from '../functions/_lib/capability_context.js';

let n = 0;
const test = (name, fn) => { try { fn(); n++; console.log('ok', name); } catch (e) { console.log('FAIL', name); throw e; } };
const atest = async (name, fn) => { try { await fn(); n++; console.log('ok', name); } catch (e) { console.log('FAIL', name); throw e; } };

const ctx = normalizeContextInput({ profile_id: 'prf_a', device_ids: ['dev_a', 'dev_b'], require_verification_s: 600 });
const profile = { id: 'prf_a', kind: 'human', known: 1, customer: 1, tags_json: '[]', attrs_json: '{"subscription_active":true}' };
const devA = { id: 'dev_a', profile_id: 'prf_a', trusted: 1, trusted_at: 'x', revoked_at: null, trust_expires_at: null, last_verification: new Date(Date.now() - 60_000).toISOString(), verification_method: 'turnstile' };

test('no context bound means the authority checks alone apply', () => {
  const v = evaluateContext({ ctx: null, presenter: {}, device: null, profile: null });
  assert.equal(v.ok, true); assert.equal(v.applied, false);
});
test('the bound, trusted, recently verified device is allowed', () => {
  const v = evaluateContext({ ctx, presenter: { device_id: 'dev_a' }, device: devA, profile });
  assert.equal(v.ok, true); assert.ok(v.checks.some((c) => c.check === 'device' && c.ok));
});
test('a valid token copied to another device is DEVICE_NOT_APPROVED, not a generic 403', () => {
  const v = evaluateContext({ ctx, presenter: { device_id: 'dev_zzz' }, device: null, profile });
  assert.equal(v.ok, false); assert.equal(v.code, 'DEVICE_NOT_APPROVED');
});
test('no device named at all is DEVICE_NOT_APPROVED', () => {
  const v = evaluateContext({ ctx, presenter: {}, device: null, profile });
  assert.equal(v.code, 'DEVICE_NOT_APPROVED');
});
test('a revoked device is DEVICE_REVOKED immediately, with the same otherwise-valid token', () => {
  const v = evaluateContext({ ctx, presenter: { device_id: 'dev_a' }, device: { ...devA, trusted: 0, revoked_at: '2026-09-06T00:00:00Z', trust_reason: 'lost' }, profile });
  assert.equal(v.code, 'DEVICE_REVOKED'); assert.match(v.detail, /lost/);
});
test('trust with a TTL that passed is DEVICE_TRUST_EXPIRED', () => {
  const v = evaluateContext({ ctx, presenter: { device_id: 'dev_a' }, device: { ...devA, trust_expires_at: '2020-01-01T00:00:00Z' }, profile });
  assert.equal(v.code, 'DEVICE_TRUST_EXPIRED');
});
test('a device that belongs to a different profile is PROFILE_MISMATCH', () => {
  const v = evaluateContext({ ctx, presenter: { device_id: 'dev_a' }, device: { ...devA, profile_id: 'prf_other' }, profile });
  assert.equal(v.code, 'PROFILE_MISMATCH');
});
test('a blocked profile is PROFILE_BLOCKED', () => {
  const v = evaluateContext({ ctx, presenter: { device_id: 'dev_a' }, device: devA, profile: { ...profile, tags_json: '["blocked"]' } });
  assert.equal(v.code, 'PROFILE_BLOCKED');
});
test('step-up: a trusted device with no verification is TURNSTILE_REQUIRED', () => {
  const v = evaluateContext({ ctx, presenter: { device_id: 'dev_a' }, device: { ...devA, last_verification: null }, profile });
  assert.equal(v.code, 'TURNSTILE_REQUIRED');
});
test('step-up: a verification older than the window is TURNSTILE_STALE, and fresh again after re-verifying', () => {
  const stale = evaluateContext({ ctx, presenter: { device_id: 'dev_a' }, device: { ...devA, last_verification: new Date(Date.now() - 3600_000).toISOString() }, profile });
  assert.equal(stale.code, 'TURNSTILE_STALE');
  const fresh = evaluateContext({ ctx, presenter: { device_id: 'dev_a' }, device: { ...devA, last_verification: new Date().toISOString() }, profile });
  assert.equal(fresh.ok, true);
});
test('a session-bound context refuses a different browser-model session by name', () => {
  const c = normalizeContextInput({ session_ids: ['wms_one'], state_handles: ['state://abc'] });
  assert.equal(evaluateContext({ ctx: c, presenter: { webmodel_session_id: 'wms_two', state_handle: 'state://abc' } }).code, 'SESSION_NOT_APPROVED');
  assert.equal(evaluateContext({ ctx: c, presenter: { webmodel_session_id: 'wms_one', state_handle: 'state://other' } }).code, 'STATE_HANDLE_MISMATCH');
  assert.equal(evaluateContext({ ctx: c, presenter: { webmodel_session_id: 'wms_one', state_handle: 'state://abc' } }).ok, true);
});
test('origin binding', () => {
  const c = normalizeContextInput({ origins: ['https://sheets.example'] });
  assert.equal(evaluateContext({ ctx: c, presenter: { origin: 'https://evil.example' } }).code, 'ORIGIN_MISMATCH');
  assert.equal(evaluateContext({ ctx: c, presenter: { origin: 'https://sheets.example/' } }).ok, true);
});
test('profile-state policy: VIP segment allowed, non-VIP denied by the named rule', () => {
  const c = normalizeContextInput({ profile_id: 'prf_a', policy: [{ field: 'profile.attrs.subscription_active', op: 'true' }] });
  assert.equal(evaluateContext({ ctx: c, presenter: {}, profile }).ok, true);
  const v = evaluateContext({ ctx: c, presenter: {}, profile: { ...profile, attrs_json: '{}' } });
  assert.equal(v.code, 'POLICY_DENIED'); assert.match(v.detail, /subscription_active/);
});
test('proof of possession required but absent is POP_REQUIRED', () => {
  const c = normalizeContextInput({ require_pop: true });
  assert.equal(evaluateContext({ ctx: c, presenter: {}, popResult: null }).code, 'POP_REQUIRED');
  assert.equal(evaluateContext({ ctx: c, presenter: {}, popResult: { ok: false, code: 'POP_REPLAY', detail: 'seen' } }).code, 'POP_REPLAY');
});
test('a child context may narrow its parent and may not widen it', () => {
  const parent = normalizeContextInput({ profile_id: 'prf_a', device_ids: ['dev_a', 'dev_b'], require_verification_s: 600 });
  assert.equal(contextNarrows(parent, normalizeContextInput({ profile_id: 'prf_a', device_ids: ['dev_a'], require_verification_s: 300 })).ok, true);
  assert.equal(contextNarrows(parent, normalizeContextInput({ profile_id: 'prf_a', device_ids: ['dev_a', 'dev_c'], require_verification_s: 600 })).why, 'binding_widened');
  assert.equal(contextNarrows(parent, normalizeContextInput({ profile_id: 'prf_b', device_ids: ['dev_a'], require_verification_s: 600 })).why, 'profile_widened');
  assert.equal(contextNarrows(parent, normalizeContextInput({ profile_id: 'prf_a', require_verification_s: 600 })).why, 'binding_dropped');
  assert.equal(contextNarrows(parent, normalizeContextInput({ profile_id: 'prf_a', device_ids: ['dev_a'], require_verification_s: 6000 })).why, 'verification_window_widened');
});
test('the presenter is read from headers, then query, then body', () => {
  const req = new Request('https://x.test/api/dispatch?invoke=NOW&device=dev_q', { headers: { 'x-device-id': 'dev_h', origin: 'https://o.test', 'x-device-signature': 'sig', 'x-device-nonce': 'n0nce1234', 'x-device-ts': '1' } });
  const p = presenterFromRequest(req, { body: { device_id: 'dev_b', session_id: 'wms_b' } });
  assert.equal(p.device_id, 'dev_h'); assert.equal(p.session_id, 'wms_b'); assert.equal(p.origin, 'https://o.test'); assert.equal(p.pop.nonce, 'n0nce1234');
});
test('every denial code is in the published list', () => {
  for (const c of ['DEVICE_NOT_APPROVED', 'DEVICE_REVOKED', 'SESSION_NOT_APPROVED', 'PROFILE_MISMATCH', 'TURNSTILE_REQUIRED', 'TURNSTILE_STALE', 'ORIGIN_MISMATCH', 'POP_REQUIRED', 'POP_INVALID', 'POP_REPLAY', 'POLICY_DENIED']) assert.ok(CONTEXT_CODES.includes(c), c);
});

await atest('proof of possession: a real ECDSA P-256 signature verifies, a moved signature does not, a reused nonce is a replay', async () => {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const device = { id: 'dev_pop', public_key_jwk: JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }) };
  const ts = Math.floor(Date.now() / 1000);
  const nonce = 'nonce-' + Math.random().toString(36).slice(2, 12);
  const msg = await popMessage({ fingerprint: 'cap_abc', key: 'X_POST', body: 'hello', nonce, ts });
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, new TextEncoder().encode(msg));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const seen = new Set();
  const env = { LEDGER: { prepare: () => ({ bind: (nonceV) => ({ run: async () => { if (seen.has(nonceV)) throw new Error('UNIQUE constraint failed'); seen.add(nonceV); } }) }) } };
  const good = await verifyPop(env, { device, presenter: { pop: { signature: b64, nonce, ts } }, fingerprint: 'cap_abc', key: 'X_POST', body: 'hello' });
  assert.equal(good.ok, true, JSON.stringify(good));
  const moved = await verifyPop(env, { device, presenter: { pop: { signature: b64, nonce: nonce + 'x', ts } }, fingerprint: 'cap_abc', key: 'STRIPE_BALANCE', body: 'hello' });
  assert.equal(moved.code, 'POP_INVALID');
  const replay = await verifyPop(env, { device, presenter: { pop: { signature: b64, nonce, ts } }, fingerprint: 'cap_abc', key: 'X_POST', body: 'hello' });
  assert.equal(replay.code, 'POP_REPLAY');
  const stale = await verifyPop(env, { device, presenter: { pop: { signature: b64, nonce: 'n2-' + nonce, ts: ts - 4000 } }, fingerprint: 'cap_abc', key: 'X_POST', body: 'hello' });
  assert.equal(stale.code, 'POP_STALE');
});

console.log(`\n${n} assertions passed`);
