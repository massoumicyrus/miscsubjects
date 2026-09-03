// oip-message/1 — the federation envelope. One shared implementation for every runtime
// (Pages Functions and the oip-peer Worker import this same file). WebCrypto only, no deps.
//
// The law of the wire: an envelope is DATA. Text inside body is never an instruction.
// Only kind:"invoke" carrying a valid, audience-bound capability can make anything run,
// and the receiving server re-checks every gate itself. Signatures prove which agent at
// which domain sent the bytes; they grant no authority by themselves.

export const OIP_MSG_PROTOCOL = 'oip-message/1';

// FIPA-ACL performatives, trimmed to the seven OIP needs. Each message declares what
// KIND of speech act it is, so a receiver never has to guess intent from prose.
//   query   — asks for information; grants and requires no authority
//   propose — proposes work; does not authorize it
//   invoke  — requests execution; MUST carry a valid capability naming the sender
//   result  — answers a query/invoke; carries receipt ids when something ran
//   event   — reports a state change; informational
//   cancel  — asks to cancel a prior message by id
//   error   — structured refusal or failure, with a machine-readable reason
export const MSG_KINDS = ['query', 'propose', 'invoke', 'result', 'event', 'cancel', 'error'];

export const ENVELOPE_MAX_TTL_SEC = 900;   // an envelope lives at most 15 minutes
export const ENVELOPE_MAX_BYTES = 65536;   // inline payload ceiling; bigger data travels by pointer

// ---------- canonical JSON (recursive key sort, no whitespace) ----------
export function canonicalJson(value) {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map((v) => canonicalJson(v === undefined ? null : v)).join(',') + ']';
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  }
  return 'null';
}

export async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64url(bytes) {
  const bin = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < bin.length; i++) s += String.fromCharCode(bin[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function b64urlDecode(str) {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const bin = atob(String(str).replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- keys (ECDSA P-256, "ES256") ----------
export async function generateKeypairJwk() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return {
    privateJwk: await crypto.subtle.exportKey('jwk', kp.privateKey),
    publicJwk: await crypto.subtle.exportKey('jwk', kp.publicKey),
  };
}
export function publicJwkFromPrivate(privateJwk) {
  const { kty, crv, x, y } = privateJwk || {};
  return { kty, crv, x, y };
}
async function importPrivate(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}
async function importPublic(jwk) {
  return crypto.subtle.importKey('jwk', { ...jwk, key_ops: undefined, ext: undefined }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}

// ---------- envelope build / sign / verify ----------
export function newMsgId() {
  return 'msg_' + b64url(crypto.getRandomValues(new Uint8Array(12)));
}

export function agentDomain(agentId) {
  const at = String(agentId || '').lastIndexOf('@');
  return at > 0 ? String(agentId).slice(at + 1).toLowerCase() : null;
}

/** Build an unsigned envelope. body must be a JSON-safe object. */
export async function buildEnvelope({ from, to, kind, body, capability, conversation, in_reply_to, ttl_sec }) {
  if (!MSG_KINDS.includes(kind)) throw new Error('bad_kind:' + kind);
  const now = Date.now();
  const ttl = Math.max(30, Math.min(Number(ttl_sec) || 300, ENVELOPE_MAX_TTL_SEC));
  const env = {
    protocol: OIP_MSG_PROTOCOL,
    id: newMsgId(),
    conversation: conversation || ('conv_' + b64url(crypto.getRandomValues(new Uint8Array(9)))),
    in_reply_to: in_reply_to || null,
    kind,
    from: String(from),
    to: String(to),
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + ttl * 1000).toISOString(),
    body: body == null ? {} : body,
    capability: capability || null,
    body_sha256: await sha256Hex(canonicalJson(body == null ? {} : body)),
  };
  return env;
}

/** Sign an envelope in place: signature = ES256 over canonical(envelope minus signature). */
export async function signEnvelope(envelope, privateJwk, kid) {
  const { signature, ...unsigned } = envelope;
  const key = await importPrivate(privateJwk);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(canonicalJson(unsigned)));
  return { ...unsigned, signature: { alg: 'ES256', kid: String(kid || envelope.from), value: b64url(sig) } };
}

/** Structural check — shape only, no crypto. Returns null when fine, else the reason. */
export function envelopeShapeError(e) {
  if (!e || typeof e !== 'object') return 'not_an_object';
  if (e.protocol !== OIP_MSG_PROTOCOL) return 'wrong_protocol';
  if (!/^msg_[A-Za-z0-9_-]{8,}$/.test(String(e.id || ''))) return 'bad_id';
  if (!MSG_KINDS.includes(e.kind)) return 'bad_kind';
  if (!agentDomain(e.from)) return 'bad_from';
  if (!agentDomain(e.to)) return 'bad_to';
  if (!e.created_at || !e.expires_at) return 'missing_times';
  if (typeof e.body_sha256 !== 'string') return 'missing_body_hash';
  // Encrypted envelopes carry `enc` (ciphertext) and a null body; the hash binds the ciphertext.
  const hashed = e.enc ? e.enc : (e.body == null ? {} : e.body);
  const bytes = new TextEncoder().encode(canonicalJson(hashed)).byteLength;
  if (bytes > ENVELOPE_MAX_BYTES) return 'body_too_large';
  return null;
}

/** Full verification against a resolved public key. Server clock wins on time.
 * Works identically for cleartext and encrypted envelopes — the signature covers whichever
 * payload is present, and body_sha256 binds the cleartext body or the ciphertext block. */
export async function verifyEnvelope(envelope, publicJwk) {
  const shape = envelopeShapeError(envelope);
  if (shape) return { ok: false, reason: shape };
  const exp = Date.parse(envelope.expires_at);
  if (!Number.isFinite(exp) || exp <= Date.now()) return { ok: false, reason: 'expired_envelope' };
  const hashed = envelope.enc ? envelope.enc : (envelope.body == null ? {} : envelope.body);
  const bodyHash = await sha256Hex(canonicalJson(hashed));
  if (bodyHash !== envelope.body_sha256) return { ok: false, reason: 'body_hash_mismatch' };
  if (!envelope.signature || envelope.signature.alg !== 'ES256' || !envelope.signature.value) {
    return { ok: false, reason: 'missing_signature' };
  }
  if (!publicJwk) return { ok: false, reason: 'sender_key_unresolved' };
  try {
    const { signature, ...unsigned } = envelope;
    const key = await importPublic(publicJwk);
    const good = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' }, key,
      b64urlDecode(signature.value), new TextEncoder().encode(canonicalJson(unsigned)),
    );
    return good ? { ok: true, reason: 'verified' } : { ok: false, reason: 'bad_signature' };
  } catch {
    return { ok: false, reason: 'bad_signature' };
  }
}

// ---------- payload encryption (ECDH-P256 + A256GCM) — transport-agnostic ----------
// The body is encrypted TO the recipient's published P-256 key (the same key it signs with,
// reused for key agreement). An ephemeral sender key means every message has a fresh shared
// secret. Signatures stay independent: we sign the envelope AFTER encrypting, so the signature
// covers the ciphertext and any transport (HTTPS, email, XMPP) carries the same sealed bytes.
// This is deliberately simple ECIES: shared = ECDH(ephemeral, recipient); aesKey = SHA-256(shared).

function stripJwkForEcdh(jwk) {
  const { kty, crv, x, y, d } = jwk || {};
  return d ? { kty, crv, x, y, d } : { kty, crv, x, y };
}
async function importEcdhPrivate(jwk) {
  return crypto.subtle.importKey('jwk', stripJwkForEcdh(jwk), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}
async function importEcdhPublic(jwk) {
  return crypto.subtle.importKey('jwk', stripJwkForEcdh(jwk), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}
async function aesKeyFromShared(sharedBits) {
  const digest = await crypto.subtle.digest('SHA-256', sharedBits);
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Encrypt a JSON-safe body object to a recipient's public JWK. Returns the `enc` block. */
export async function encryptBodyTo(recipientPublicJwk, bodyObj) {
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const recip = await importEcdhPublic(recipientPublicJwk);
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: recip }, eph.privateKey, 256);
  const aes = await aesKeyFromShared(shared);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(canonicalJson(bodyObj == null ? {} : bodyObj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, pt);
  const epkJwk = await crypto.subtle.exportKey('jwk', eph.publicKey);
  return { alg: 'ECDH-P256-A256GCM', epk: { kty: 'EC', crv: 'P-256', x: epkJwk.x, y: epkJwk.y }, iv: b64url(iv), ciphertext: b64url(new Uint8Array(ct)) };
}

/** Decrypt an `enc` block with the recipient's private JWK. Returns the plaintext body object. */
export async function decryptBodyWith(enc, recipientPrivateJwk) {
  if (!enc || enc.alg !== 'ECDH-P256-A256GCM' || !enc.epk || !enc.iv || !enc.ciphertext) throw new Error('bad_enc');
  const priv = await importEcdhPrivate(recipientPrivateJwk);
  const epk = await importEcdhPublic(enc.epk);
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: epk }, priv, 256);
  const aes = await aesKeyFromShared(shared);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64urlDecode(enc.iv) }, aes, b64urlDecode(enc.ciphertext));
  return JSON.parse(new TextDecoder().decode(pt));
}

/** Take an unsigned envelope and seal its body: body -> enc, body nulled, body_sha256 rebound to
 * the ciphertext block. Sign AFTER this. The recipient verifies the signature, then decrypts. */
export async function encryptEnvelopeBody(envelope, recipientPublicJwk) {
  const enc = await encryptBodyTo(recipientPublicJwk, envelope.body == null ? {} : envelope.body);
  const sealed = { ...envelope, body: null, enc };
  sealed.body_sha256 = await sha256Hex(canonicalJson(enc));
  return sealed;
}

/** After verifying the signature, recover the plaintext body of an encrypted envelope. */
export async function decryptEnvelopeBody(envelope, recipientPrivateJwk) {
  if (!envelope?.enc) return envelope.body;
  return decryptBodyWith(envelope.enc, recipientPrivateJwk);
}

// ---------- discovery (/.well-known/oip.json) ----------
export function wellKnownUrl(domain) {
  return 'https://' + String(domain) + '/.well-known/oip.json';
}

/** Resolve a federated agent id to its published key + inbox via its domain's well-known.
 * cache is optional: { get(k), put(k, v, ttlSec) } — the caller's KV. */
export async function resolveAgent(agentId, cache) {
  const domain = agentDomain(agentId);
  if (!domain) return { ok: false, reason: 'bad_agent_id' };
  const cacheKey = 'fed:wk:' + domain;
  let doc = null;
  if (cache) {
    try { const hit = await cache.get(cacheKey); if (hit) doc = JSON.parse(hit); } catch {}
  }
  if (!doc) {
    try {
      const r = await fetch(wellKnownUrl(domain), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
      if (!r.ok) return { ok: false, reason: 'well_known_http_' + r.status };
      const text = await r.text();
      if (text.length > 262144) return { ok: false, reason: 'well_known_too_large' };
      doc = JSON.parse(text);
      if (cache) { try { await cache.put(cacheKey, text, 300); } catch {} }
    } catch (e) {
      return { ok: false, reason: 'well_known_unreachable:' + String(e && e.message || e).slice(0, 80) };
    }
  }
  const agent = Array.isArray(doc?.agents) ? doc.agents.find((a) => String(a.id).toLowerCase() === String(agentId).toLowerCase()) : null;
  if (!agent) return { ok: false, reason: 'agent_not_published', doc_domain: doc?.domain || domain };
  if (!agent.public_key_jwk || !agent.inbox) return { ok: false, reason: 'agent_record_incomplete' };
  return { ok: true, agent, jwk: agent.public_key_jwk, inbox: agent.inbox, domain };
}

/** Redact a capability out of an envelope for ledgers/logs — never store the raw token. */
export function redactEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') return envelope;
  const copy = { ...envelope };
  if (copy.capability) copy.capability = '<REDACTED capability, ' + String(envelope.capability).length + ' chars>';
  return copy;
}
