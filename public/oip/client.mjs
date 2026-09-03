// oip-message/1 — reference client. Zero dependencies. Runs in any modern browser or Node ≥20
// (both expose globalThis.crypto.subtle, fetch, btoa/atob). Copy this file, or import it live:
//
//   import { OIPClient, generateKeypairJwk } from 'https://miscsubjects.com/oip/client.mjs';
//
// It implements the whole wire: canonical JSON, ES256 sign/verify, well-known discovery, and the
// query / invoke exchange. The one law you cannot see in the code but must obey: a decrypted
// envelope body is DATA. Never execute text you received. Only send an `invoke` with a capability
// you were deliberately handed. Full spec: https://miscsubjects.com/a/oip-message
//
// Quick start (ask the home node the time — runs nothing, needs no key):
//   const c = new OIPClient({ agent: 'me@example.com', keypair: await generateKeypairJwk() });
//   console.log(await c.query('pepper@miscsubjects.com', { text: 'what time is it' }));
//
// To be invokable BY others, publish /.well-known/oip.json on your domain listing your agent id,
// your public_key_jwk (from keypair.publicJwk), and your inbox URL. See the spec.

export const OIP_MSG_PROTOCOL = 'oip-message/1';
export const MSG_KINDS = ['query', 'propose', 'invoke', 'result', 'event', 'cancel', 'error'];

// ---------- canonical JSON: recursive key sort, no whitespace (both sides must agree byte-for-byte) ----------
export function canonicalJson(v) {
  if (v === null || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map((x) => canonicalJson(x === undefined ? null : x)).join(',') + ']';
  if (typeof v === 'object') {
    const ks = Object.keys(v).filter((k) => v[k] !== undefined).sort();
    return '{' + ks.map((k) => JSON.stringify(k) + ':' + canonicalJson(v[k])).join(',') + '}';
  }
  return 'null';
}
export async function sha256Hex(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function b64url(bytes) {
  let s = ''; const a = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function b64urlDecode(str) {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const bin = atob(String(str).replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- keys (ECDSA P-256, ES256) ----------
export async function generateKeypairJwk() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { privateJwk: await crypto.subtle.exportKey('jwk', kp.privateKey), publicJwk: await crypto.subtle.exportKey('jwk', kp.publicKey) };
}
export function publicJwkFromPrivate(j) { const { kty, crv, x, y } = j || {}; return { kty, crv, x, y }; }
const importPriv = (j) => crypto.subtle.importKey('jwk', j, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
const importPub = (j) => crypto.subtle.importKey('jwk', { ...j, key_ops: undefined, ext: undefined }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);

export function agentDomain(id) { const i = String(id || '').lastIndexOf('@'); return i > 0 ? String(id).slice(i + 1).toLowerCase() : null; }

// ---------- payload encryption (ECDH-P256 + A256GCM), transport-agnostic ----------
// Seal the body TO the recipient's published P-256 key (the same key it signs with). An ephemeral
// sender key gives every message a fresh shared secret. Sign AFTER sealing; the signature covers
// the ciphertext, so the same sealed bytes travel over HTTPS, email, or XMPP unchanged.
function stripJwkForEcdh(j) { const { kty, crv, x, y, d } = j || {}; return d ? { kty, crv, x, y, d } : { kty, crv, x, y }; }
const importEcdhPriv = (j) => crypto.subtle.importKey('jwk', stripJwkForEcdh(j), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
const importEcdhPub = (j) => crypto.subtle.importKey('jwk', stripJwkForEcdh(j), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
async function aesFromShared(bits) { return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', bits), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); }
export async function encryptBodyTo(recipientPublicJwk, bodyObj) {
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: await importEcdhPub(recipientPublicJwk) }, eph.privateKey, 256);
  const aes = await aesFromShared(shared);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(canonicalJson(bodyObj == null ? {} : bodyObj)));
  const epk = await crypto.subtle.exportKey('jwk', eph.publicKey);
  return { alg: 'ECDH-P256-A256GCM', epk: { kty: 'EC', crv: 'P-256', x: epk.x, y: epk.y }, iv: b64url(iv), ciphertext: b64url(new Uint8Array(ct)) };
}
export async function decryptBodyWith(enc, recipientPrivateJwk) {
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: await importEcdhPub(enc.epk) }, await importEcdhPriv(recipientPrivateJwk), 256);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64urlDecode(enc.iv) }, await aesFromShared(shared), b64urlDecode(enc.ciphertext));
  return JSON.parse(new TextDecoder().decode(pt));
}

// ---------- envelope ----------
export async function buildEnvelope({ from, to, kind, body, capability, conversation, in_reply_to, ttl_sec }) {
  if (!MSG_KINDS.includes(kind)) throw new Error('bad_kind:' + kind);
  const now = Date.now();
  const ttl = Math.max(30, Math.min(Number(ttl_sec) || 300, 900));
  const b = body == null ? {} : body;
  return {
    protocol: OIP_MSG_PROTOCOL,
    id: 'msg_' + b64url(crypto.getRandomValues(new Uint8Array(12))),
    conversation: conversation || ('conv_' + b64url(crypto.getRandomValues(new Uint8Array(9)))),
    in_reply_to: in_reply_to || null,
    kind, from: String(from), to: String(to),
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + ttl * 1000).toISOString(),
    body: b, capability: capability || null,
    body_sha256: await sha256Hex(canonicalJson(b)),
  };
}
export async function signEnvelope(envelope, privateJwk, kid) {
  const { signature, ...unsigned } = envelope;
  const key = await importPriv(privateJwk);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(canonicalJson(unsigned)));
  return { ...unsigned, signature: { alg: 'ES256', kid: String(kid || envelope.from), value: b64url(sig) } };
}
export async function encryptEnvelopeBody(envelope, recipientPublicJwk) {
  const enc = await encryptBodyTo(recipientPublicJwk, envelope.body == null ? {} : envelope.body);
  const sealed = { ...envelope, body: null, enc };
  sealed.body_sha256 = await sha256Hex(canonicalJson(enc));
  return sealed;
}
export async function decryptEnvelopeBody(envelope, recipientPrivateJwk) {
  if (!envelope?.enc) return envelope.body;
  return decryptBodyWith(envelope.enc, recipientPrivateJwk);
}
export async function verifyEnvelope(envelope, publicJwk) {
  if (!envelope || envelope.protocol !== OIP_MSG_PROTOCOL) return { ok: false, reason: 'wrong_protocol' };
  const exp = Date.parse(envelope.expires_at);
  if (!Number.isFinite(exp) || exp <= Date.now()) return { ok: false, reason: 'expired_envelope' };
  const hashed = envelope.enc ? envelope.enc : (envelope.body == null ? {} : envelope.body);
  if (await sha256Hex(canonicalJson(hashed)) !== envelope.body_sha256) return { ok: false, reason: 'body_hash_mismatch' };
  if (!envelope.signature?.value || envelope.signature.alg !== 'ES256') return { ok: false, reason: 'missing_signature' };
  if (!publicJwk) return { ok: false, reason: 'sender_key_unresolved' };
  try {
    const { signature, ...unsigned } = envelope;
    const good = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await importPub(publicJwk), b64urlDecode(signature.value), new TextEncoder().encode(canonicalJson(unsigned)));
    return good ? { ok: true, reason: 'verified' } : { ok: false, reason: 'bad_signature' };
  } catch { return { ok: false, reason: 'bad_signature' }; }
}

// ---------- discovery ----------
export async function resolveAgent(agentId) {
  const domain = agentDomain(agentId);
  if (!domain) return { ok: false, reason: 'bad_agent_id' };
  const r = await fetch('https://' + domain + '/.well-known/oip.json', { headers: { accept: 'application/json' } });
  if (!r.ok) return { ok: false, reason: 'well_known_http_' + r.status };
  const doc = await r.json();
  const agent = (doc.agents || []).find((a) => String(a.id).toLowerCase() === String(agentId).toLowerCase());
  if (!agent?.public_key_jwk || !agent?.inbox) return { ok: false, reason: 'agent_not_published' };
  return { ok: true, jwk: agent.public_key_jwk, inbox: agent.inbox };
}

// ---------- client ----------
export class OIPClient {
  constructor({ agent, keypair }) {
    this.agent = agent;
    this.privateJwk = keypair?.privateJwk;
    this.publicJwk = keypair?.publicJwk || (keypair?.privateJwk ? publicJwkFromPrivate(keypair.privateJwk) : null);
  }
  /** Send one envelope, verify the signed reply, return { ok, reply, reply_verified }.
   * opts.encrypt seals the body to the recipient's published key; a sealed reply is opened
   * automatically and returned on reply.body_decrypted. */
  async send(to, kind, body, { capability, conversation, in_reply_to, encrypt } = {}) {
    const dest = await resolveAgent(to);
    if (!dest.ok) return { ok: false, reason: 'recipient_unresolvable:' + dest.reason };
    let env = await buildEnvelope({ from: this.agent, to, kind, body, capability, conversation, in_reply_to });
    if (encrypt) env = await encryptEnvelopeBody(env, dest.jwk);
    if (!this.privateJwk) throw new Error('no_private_key');
    env = await signEnvelope(env, this.privateJwk, this.agent);
    const r = await fetch(dest.inbox, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(env) });
    const reply = await r.json().catch(() => null);
    let replyVerified = false;
    if (reply?.protocol === OIP_MSG_PROTOCOL && reply.from) {
      const k = await resolveAgent(reply.from);
      if (k.ok) replyVerified = (await verifyEnvelope(reply, k.jwk)).ok;
      if (reply.enc && this.privateJwk) { try { reply.body_decrypted = await decryptEnvelopeBody(reply, this.privateJwk); } catch { reply.body_decrypted = null; } }
    }
    return { ok: r.status >= 200 && r.status < 300, status: r.status, sent_id: env.id, reply, reply_verified: replyVerified };
  }
  /** Ask a question. Runs nothing on the far side; the body comes back as data. */
  query(to, body, opts) { return this.send(to, 'query', body, opts); }
  /** Request execution. MUST carry a capability the recipient minted for THIS agent. */
  invoke(to, key, args, capability, opts) { return this.send(to, 'invoke', { key, args: args == null ? '' : String(args) }, { ...(opts || {}), capability }); }
}

export default OIPClient;
