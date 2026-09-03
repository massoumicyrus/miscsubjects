// Home-side federation helpers (miscsubjects.com). Pure — imports only the envelope lib and
// admin_session, never dispatch.js, so nothing here can create an import cycle. The inbound
// handler that actually runs objects lives in functions/oip/inbox.js and wires in the dispatch
// executor. This file owns identity, keys, the well-known doc, outbound send, and the fed ledger.

import {
  OIP_MSG_PROTOCOL, buildEnvelope, signEnvelope, verifyEnvelope,
  resolveAgent, agentDomain, publicJwkFromPrivate, redactEnvelope, sha256Hex, canonicalJson,
} from './oip_envelope.js';
import { logEvent } from './event_log.js';
import { recordConversationMessage } from './oip_conversation.js';

export function homeAgentId(env) {
  return String(env.OIP_HOME_AGENT || 'pepper@miscsubjects.com').toLowerCase();
}
export function homeDomain(env) {
  return agentDomain(homeAgentId(env)) || 'miscsubjects.com';
}
export function homeInboxUrl(env) {
  return 'https://' + homeDomain(env) + '/oip/inbox';
}

/** The home private signing key (JWK) from the OIP_HOME_KEY Pages secret. Null if unset. */
export function homePrivateJwk(env) {
  try {
    const j = JSON.parse(env.OIP_HOME_KEY || 'null');
    return j?.privateJwk || j || null;   // accept {privateJwk} or a bare JWK
  } catch { return null; }
}

/** The published well-known document for this domain. Public key only — never the private key. */
export function buildHomeWellKnown(env) {
  const priv = homePrivateJwk(env);
  const agents = priv ? [{
    id: homeAgentId(env),
    alg: 'ES256',
    public_key_jwk: publicJwkFromPrivate(priv),
    inbox: homeInboxUrl(env),
    invokes: true,
    note: 'the home agent — it runs invocations against real objects, subject to every capability gate.',
  }] : [];
  return {
    protocol: OIP_MSG_PROTOCOL,
    domain: homeDomain(env),
    agents,
    ledger: 'https://' + homeDomain(env) + '/oip/ledger',
    spec: 'https://' + homeDomain(env) + '/oip/inbox',
    federation_proof: 'https://' + homeDomain(env) + '/api/dispatch?fedtest=1&format=markdown',
    transport: 'https',
    confidentiality: 'TLS transport only; payload E2EE and the SMTP binding are not implemented.',
    note: 'Object Invocation Protocol federation node. Envelopes are data; only a signed invoke carrying a valid, audience-bound capability runs anything, and every gate is re-checked here.',
  };
}

const kvCache = (env) => env.KV ? {
  get: (k) => env.KV.get(k),
  put: (k, v, ttlSec) => env.KV.put(k, v, { expirationTtl: Math.max(60, ttlSec || 300) }),
} : null;

/** Sign an envelope as the home agent. */
export async function signAsHome(env, envelope) {
  const priv = homePrivateJwk(env);
  if (!priv) throw new Error('home_key_unset');
  return signEnvelope(envelope, priv, homeAgentId(env));
}

/** Build + sign + POST an envelope from the home agent to a federated recipient, verifying the
 * signed reply. Returns { ok, sent, response_envelope, response_verified, reason }. */
export async function sendFromHome(env, { to, kind, body, capability, conversation, in_reply_to, ttl_sec }) {
  const priv = homePrivateJwk(env);
  if (!priv) return { ok: false, reason: 'home_key_unset' };
  const dest = await resolveAgent(String(to), kvCache(env));
  if (!dest.ok) return { ok: false, reason: 'recipient_unresolvable:' + dest.reason };
  let envelope = await buildEnvelope({ from: homeAgentId(env), to, kind, body, capability, conversation, in_reply_to, ttl_sec });
  envelope = await signAsHome(env, envelope);
  let r, text;
  try {
    r = await fetch(dest.inbox, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(envelope) });
    text = await r.text();
  } catch (e) {
    return { ok: false, reason: 'inbox_unreachable:' + String(e && e.message || e).slice(0, 80), sent: redactEnvelope(envelope) };
  }
  let responseEnvelope = null;
  try { responseEnvelope = JSON.parse(text); } catch {}
  let responseVerified = false;
  if (responseEnvelope && responseEnvelope.protocol === OIP_MSG_PROTOCOL && responseEnvelope.from) {
    const senderKey = await resolveAgent(responseEnvelope.from, kvCache(env));
    if (senderKey.ok) responseVerified = (await verifyEnvelope(responseEnvelope, senderKey.jwk)).ok;
  }
  await logFederation(env, {
    action: 'send', direction: 'outbound', msg_id: envelope.id, kind: envelope.kind,
    from: envelope.from, to: envelope.to, body_sha256: envelope.body_sha256,
    response_id: responseEnvelope?.id || null, response_kind: responseEnvelope?.kind || null,
    response_body_sha256: responseEnvelope?.body_sha256 || null, response_verified: responseVerified,
    status: r.status,
  });
  // Track both sides of the exchange in the durable thread.
  try {
    await recordConversationMessage(env, envelope, { direction: 'outbound', verdict: 'sent' });
    if (responseEnvelope?.protocol === OIP_MSG_PROTOCOL && responseVerified) {
      await recordConversationMessage(env, responseEnvelope, {
        direction: 'inbound',
        verdict: responseEnvelope.body?.invoked ? 'invoked' : (responseEnvelope.body?.reason || 'answered'),
        invocation_id: responseEnvelope.body?.invocation_id || null,
      });
    }
  } catch {}
  return { ok: r.status >= 200 && r.status < 300, status: r.status, sent: redactEnvelope(envelope), response_envelope: responseEnvelope || text.slice(0, 1500), response_verified: responseVerified };
}

/** Build a cold-contact email drop: a self-explaining message a stranger's agent can act on from
 * an ordinary inbox. It carries a signed `propose` envelope (the offer) plus a capability the
 * recipient can invoke once they stand up a node. Returns the full email text (human + machine
 * block). The capability is minted by the caller and passed in; here we only sign the envelope. */
export async function buildColdContactEmail(env, { to, key, capability, capExplainUrl, purpose, argsHint }) {
  const proposeBody = {
    offer: purpose || ('You may run the "' + key + '" action, once, on ' + homeDomain(env) + '.'),
    action: key,
    args_hint: argsHint || null,
    capability_note: 'The capability below is bound to your domain and permits exactly this one action. Inspect it before use.',
    steps: [
      '1. Read the protocol: https://' + homeDomain(env) + '/a/oip-message',
      '2. Verify THIS message: check its signature against https://' + homeDomain(env) + '/.well-known/oip.json (kid ' + homeAgentId(env) + ').',
      '3. Inspect the authority you were granted: GET ' + (capExplainUrl || 'the explain URL below'),
      '4. Stand up your own node (10 minutes): https://' + homeDomain(env) + '/a/oip-node-kit — publish /.well-known/oip.json with your agent id + public key.',
      '5. Ask a question first if you want (reply with a signed `query` envelope), then execute: send a signed `invoke` for "' + key + '" carrying the capability.',
      '6. Reply with proof: the result envelope you get back carries the receipt id; keep it. Both sides can prove the exchange.',
    ],
    decide: 'To accept, do step 5. To decline, reply with a `result` whose body is {"decision":"reject"}. To ask first, reply with a `query`.',
    capability,
  };
  let envelope = await buildEnvelope({ from: homeAgentId(env), to, kind: 'propose', body: proposeBody, ttl_sec: 900 });
  envelope = await signAsHome(env, envelope);
  const block = '-----BEGIN OIP MESSAGE-----\n' + JSON.stringify(envelope, null, 2) + '\n-----END OIP MESSAGE-----';
  const text =
`Subject: An agent-to-agent request you can verify and act on (Object Invocation Protocol)

Hello,

This is a machine-verifiable request sent by ${homeAgentId(env)}. It is safe to read: reading it
grants nothing, and nothing runs unless your agent deliberately sends back a signed invocation
carrying the capability included here. The capability is scoped to ONE action, is bounded and
revocable, and every use is recorded on both sides.

What is offered: ${proposeBody.offer}

How your agent handles this (no account, no shared key):
${proposeBody.steps.map((s) => '  ' + s).join('\n')}

Reference client (zero dependencies): https://${homeDomain(env)}/oip/client.mjs
Protocol spec:                        https://${homeDomain(env)}/a/oip-message
Inspect the exact authority:          ${capExplainUrl || '(explain URL)'}

The machine message follows. Your agent verifies its signature, then decides.

${block}
`;
  return { envelope, block, text, conversation: envelope.conversation };
}

/** One federation ledger record → the shared events table (source 'federation'). Sanitized:
 * message ids, kinds, verdicts, and body hashes — never the raw capability or private payload. */
export async function logFederation(env, rec) {
  return logEvent(env, {
    source: 'federation',
    key: rec.action === 'send' ? 'FED_SEND' : 'FED_INBOX',
    action: rec.verdict || rec.action || 'fed',
    actor: rec.from || null,
    direction: rec.direction || 'inbound',
    status: typeof rec.status === 'number' ? rec.status : null,
    trace_id: rec.msg_id || null,
    request: {
      msg_id: rec.msg_id, kind: rec.kind, from: rec.from, to: rec.to,
      body_sha256: rec.body_sha256, sender_verified: rec.sender_verified,
      capability_fingerprint: rec.capability_fingerprint || null, audience: rec.audience || null,
    },
    response: {
      verdict: rec.verdict || null, response_id: rec.response_id || null,
      response_kind: rec.response_kind || null, response_body_sha256: rec.response_body_sha256 || null,
      response_verified: rec.response_verified ?? null, invocation_id: rec.invocation_id || null,
      reason: rec.reason || null,
    },
  });
}

/** Read the home federation ledger — recent FED_INBOX / FED_SEND events, sanitized. */
export async function readFederationLedger(env, { msg, limit } = {}) {
  if (!env?.LEDGER) return { ok: false, error: 'no_ledger' };
  const cap = Math.max(1, Math.min(Number(limit) || 25, 100));
  try {
    if (msg) {
      const row = await env.LEDGER.prepare(
        "SELECT id, ts, key, actor, action, direction, status, trace_id, request_json, response_json FROM events WHERE source='federation' AND trace_id=? ORDER BY ts DESC LIMIT 5",
      ).bind(String(msg)).all();
      return { ok: true, node: homeDomain(env), msg, records: (row.results || []).map(fedRow) };
    }
    const rows = await env.LEDGER.prepare(
      "SELECT id, ts, key, actor, action, direction, status, trace_id, request_json, response_json FROM events WHERE source='federation' ORDER BY ts DESC LIMIT ?",
    ).bind(cap).all();
    return { ok: true, node: homeDomain(env), count: (rows.results || []).length, records: (rows.results || []).map(fedRow) };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e).slice(0, 120) };
  }
}
function fedRow(r) {
  let req = null, res = null;
  try { req = JSON.parse(r.request_json || 'null'); } catch {}
  try { res = JSON.parse(r.response_json || 'null'); } catch {}
  return {
    ts: r.ts, kind: r.key, verdict: r.action, direction: r.direction, status: r.status,
    msg_id: r.trace_id, from: req?.from || null, to: req?.to || null,
    body_sha256: req?.body_sha256 || null, sender_verified: req?.sender_verified ?? null,
    audience: req?.audience || null, response_id: res?.response_id || null,
    response_body_sha256: res?.response_body_sha256 || null, invocation_id: res?.invocation_id || null,
    reason: res?.reason || null,
  };
}

export { sha256Hex, canonicalJson, resolveAgent, verifyEnvelope, agentDomain };
