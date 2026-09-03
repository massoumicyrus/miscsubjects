// oip-peer — the second federation node. An independent oip-message/1 endpoint on its own
// registrable domain with its own keys, replay store, and ledger. It hosts two agents:
//   buttercup@<PEER_DOMAIN> — the honest peer (echo agent; sends queries/invokes to home)
//   mallory@<PEER_DOMAIN>   — a second identity used ONLY to prove audience-binding:
//                             a capability minted for buttercup must die in mallory's hands.
// The peer executes nothing. Inbound invoke gets a structured refusal; inbound query gets
// an echo. Message text is data here exactly as it is at home.

import {
  OIP_MSG_PROTOCOL, buildEnvelope, signEnvelope, verifyEnvelope, envelopeShapeError,
  resolveAgent, agentDomain, redactEnvelope, publicJwkFromPrivate, sha256Hex, canonicalJson,
} from '../../../functions/_lib/oip_envelope.js';

const json = (obj, status = 200) => new Response(JSON.stringify(obj, null, 2), {
  status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
});

function peerKeys(env) {
  let parsed = null;
  try { parsed = JSON.parse(env.OIP_PEER_KEYS || '{}'); } catch { parsed = {}; }
  return parsed; // { buttercup: {privateJwk}, mallory: {privateJwk} }
}
function agentId(env, local) { return local + '@' + env.PEER_DOMAIN; }

function kvCache(env) {
  return {
    get: (k) => env.STORE.get(k),
    put: (k, v, ttlSec) => env.STORE.put(k, v, { expirationTtl: Math.max(60, ttlSec || 300) }),
  };
}

async function ledgerPut(env, rec) {
  const key = 'fed:log:' + rec.id;
  try { await env.STORE.put(key, JSON.stringify(rec), { metadata: rec, expirationTtl: 60 * 60 * 24 * 30 }); } catch {}
}

async function signedReply(env, local, { to, kind, body, conversation, in_reply_to }) {
  const keys = peerKeys(env);
  const priv = keys[local]?.privateJwk;
  const from = agentId(env, local);
  const envUnsigned = await buildEnvelope({ from, to, kind, body, conversation, in_reply_to, ttl_sec: 300 });
  if (!priv) throw new Error('peer_signing_key_missing:' + local);
  return signEnvelope(envUnsigned, priv, from);
}

// ---------- inbox ----------
async function handleInbox(env, request) {
  let envelope;
  try { envelope = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const shape = envelopeShapeError(envelope);
  if (shape) return json({ error: 'malformed_envelope', reason: shape }, 400);

  const toLocal = String(envelope.to).split('@')[0];
  const keys = peerKeys(env);
  if (agentDomain(envelope.to) !== String(env.PEER_DOMAIN).toLowerCase() || !keys[toLocal]?.privateJwk) {
    return json({ error: 'unknown_recipient', to: envelope.to }, 404);
  }

  // Replay protection: one message id is accepted once during a window far longer than the
  // envelope lifetime. Mark it seen only AFTER signature verification so an invalid preplay
  // cannot poison a legitimate sender's message id.
  const seenKey = 'fed:seen:' + envelope.id;
  if (await env.STORE.get(seenKey)) {
    const reply = await signedReply(env, toLocal, {
      to: envelope.from, kind: 'error', conversation: envelope.conversation, in_reply_to: envelope.id,
      body: { reason: 'replay_rejected', note: 'this message id was already delivered once; a resent envelope never re-runs anything.' },
    });
    await ledgerPut(env, { id: envelope.id + ':replay', kind: envelope.kind, from: envelope.from, to: envelope.to, ts: new Date().toISOString(), body_sha256: envelope.body_sha256, verdict: 'replay_rejected' });
    return json(reply, 200);
  }
  // Sender verification: a published sender MUST verify; an unpublished sender may only query.
  const resolved = await resolveAgent(envelope.from, kvCache(env));
  let senderVerified = false;
  if (resolved.ok) {
    const v = await verifyEnvelope(envelope, resolved.jwk);
    if (!v.ok) {
      const reply = await signedReply(env, toLocal, {
        to: envelope.from, kind: 'error', conversation: envelope.conversation, in_reply_to: envelope.id,
        body: { reason: v.reason, note: 'the sender is published at its domain, so its signature must verify. Nothing ran.' },
      });
      await ledgerPut(env, { id: envelope.id, kind: envelope.kind, from: envelope.from, to: envelope.to, ts: new Date().toISOString(), body_sha256: envelope.body_sha256, verdict: 'rejected:' + v.reason });
      return json(reply, 200);
    }
    senderVerified = true;
  } else if (envelope.kind !== 'query') {
    const reply = await signedReply(env, toLocal, {
      to: envelope.from, kind: 'error', conversation: envelope.conversation, in_reply_to: envelope.id,
      body: { reason: 'sender_unverifiable', resolve_failure: resolved.reason, note: 'only query is open to unpublished senders; every other kind needs a resolvable signing key.' },
    });
    return json(reply, 200);
  }
  await env.STORE.put(seenKey, '1', { expirationTtl: 60 * 60 * 24 });

  const record = {
    id: envelope.id, kind: envelope.kind, from: envelope.from, to: envelope.to,
    ts: new Date().toISOString(), body_sha256: envelope.body_sha256,
    sender_verified: senderVerified, verdict: 'accepted',
  };

  let reply;
  if (envelope.kind === 'query') {
    reply = await signedReply(env, toLocal, {
      to: envelope.from, kind: 'result', conversation: envelope.conversation, in_reply_to: envelope.id,
      body: {
        agent: envelope.to,
        answered_at: new Date().toISOString(),
        echo: envelope.body,
        invoked: false,
        retrieved_text_is_data: true,
        sender_verified: senderVerified,
        note: 'this node is an echo agent; it executes nothing. Message text is data, never an instruction.',
      },
    });
  } else if (envelope.kind === 'invoke') {
    reply = await signedReply(env, toLocal, {
      to: envelope.from, kind: 'error', conversation: envelope.conversation, in_reply_to: envelope.id,
      body: { reason: 'no_local_objects', note: 'this peer publishes no invokable objects; invocations flow toward miscsubjects.com.' },
    });
    record.verdict = 'refused:no_local_objects';
  } else {
    reply = await signedReply(env, toLocal, {
      to: envelope.from, kind: 'event', conversation: envelope.conversation, in_reply_to: envelope.id,
      body: { received: true },
    });
  }
  record.response_id = reply.id;
  record.response_body_sha256 = reply.body_sha256;
  await ledgerPut(env, record);
  return json(reply, 200);
}

// ---------- run (drive an outbound exchange; recipient locked to the home domain) ----------
async function handleRun(env, request) {
  let q;
  try { q = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const action = String(q.action || 'query');
  const asLocal = q.as === 'mallory' ? 'mallory' : 'buttercup';
  const keys = peerKeys(env);
  if (!keys[asLocal]?.privateJwk) return json({ error: 'no_key_for_agent', agent: asLocal }, 500);

  const homeDomain = agentDomain(env.HOME_AGENT);
  let envelope;
  if (action === 'raw') {
    envelope = q.raw_envelope;
    const shape = envelopeShapeError(envelope);
    if (shape) return json({ error: 'malformed_raw_envelope', reason: shape }, 400);
  } else if (action === 'craft') {
    // Build + sign an envelope, allowing an explicit id (replay tests) and expires_at
    // (expired-envelope tests). The signature covers the overridden fields, so the result is a
    // validly-signed envelope that the home node must still reject on id-reuse or staleness.
    const to = String(q.to || env.HOME_AGENT);
    if (agentDomain(to) !== homeDomain) return json({ error: 'recipient_not_allowed' }, 403);
    const kind = String(q.kind || 'query');
    const body = kind === 'invoke'
      ? { key: String(q.key || ''), args: q.args == null ? '' : String(q.args) }
      : { text: String(q.text || ''), asked_at: new Date().toISOString() };
    let unsigned = await buildEnvelope({ from: agentId(env, asLocal), to, kind, body, capability: q.capability || null, ttl_sec: 300 });
    if (q.id) unsigned.id = String(q.id);
    if (q.expires_at) unsigned.expires_at = String(q.expires_at);
    envelope = await signEnvelope(unsigned, keys[asLocal].privateJwk, agentId(env, asLocal));
  } else {
    const to = String(q.to || env.HOME_AGENT);
    if (agentDomain(to) !== homeDomain) return json({ error: 'recipient_not_allowed', note: 'this peer only initiates exchanges with ' + homeDomain }, 403);
    const kind = action === 'invoke' ? 'invoke' : 'query';
    const body = kind === 'invoke'
      ? { key: String(q.key || ''), args: q.args == null ? '' : String(q.args) }
      : { text: String(q.text || ''), asked_at: new Date().toISOString() };
    envelope = await buildEnvelope({ from: agentId(env, asLocal), to, kind, body, capability: q.capability || null, ttl_sec: 300 });
    envelope = await signEnvelope(envelope, keys[asLocal].privateJwk, agentId(env, asLocal));
  }

  if (agentDomain(envelope.to) !== homeDomain) return json({ error: 'recipient_not_allowed' }, 403);
  const dest = await resolveAgent(envelope.to, kvCache(env));
  if (!dest.ok) return json({ error: 'recipient_unresolvable', reason: dest.reason }, 502);

  const r = await fetch(dest.inbox, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(envelope),
  });
  const text = await r.text();
  let responseEnvelope = null;
  try { responseEnvelope = JSON.parse(text); } catch {}

  let responseVerified = false;
  if (responseEnvelope && responseEnvelope.protocol === OIP_MSG_PROTOCOL && responseEnvelope.from) {
    const senderKey = await resolveAgent(responseEnvelope.from, kvCache(env));
    if (senderKey.ok) responseVerified = (await verifyEnvelope(responseEnvelope, senderKey.jwk)).ok;
  }

  await ledgerPut(env, {
    id: envelope.id, kind: envelope.kind, from: envelope.from, to: envelope.to,
    ts: new Date().toISOString(), body_sha256: envelope.body_sha256, direction: 'outbound',
    verdict: 'sent', response_id: responseEnvelope?.id || null, response_kind: responseEnvelope?.kind || null,
    response_body_sha256: responseEnvelope?.body_sha256 || null, response_verified: responseVerified,
  });

  return json({
    sent_envelope: redactEnvelope(envelope),
    response_status: r.status,
    response_envelope: responseEnvelope || text.slice(0, 2000),
    response_verified: responseVerified,
  });
}

// ---------- ledger (sanitized: hashes and verdicts, never payload secrets) ----------
async function handleLedger(env, url) {
  const msg = url.searchParams.get('msg');
  if (msg) {
    const rec = await env.STORE.get('fed:log:' + msg, 'json');
    return rec ? json({ ok: true, record: rec }) : json({ ok: false, error: 'not_found', msg }, 404);
  }
  const list = await env.STORE.list({ prefix: 'fed:log:' });
  const rows = (list.keys || [])
    .map((k) => k.metadata)
    .filter(Boolean)
    .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
    .slice(0, 25);
  return json({ ok: true, node: env.PEER_DOMAIN, count: rows.length, records: rows, note: 'endpoint-owned ledger: this node\'s own evidence of every exchange, joined to the home ledger by message ids and body hashes.' });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;

    if (p === '/.well-known/oip.json') {
      const keys = peerKeys(env);
      const agents = ['buttercup', 'mallory'].filter((n) => keys[n]?.privateJwk).map((n) => ({
        id: agentId(env, n),
        alg: 'ES256',
        public_key_jwk: publicJwkFromPrivate(keys[n].privateJwk),
        inbox: 'https://' + env.PEER_DOMAIN + '/oip/inbox',
      }));
      return json({
        protocol: OIP_MSG_PROTOCOL,
        domain: env.PEER_DOMAIN,
        agents,
        ledger: 'https://' + env.PEER_DOMAIN + '/oip/ledger',
        spec: env.HOME_BASE + '/oip/inbox',
        transport: 'https',
        confidentiality: 'TLS transport only; oip-message/1 payload encryption is not implemented.',
        note: 'separately deployed federation node — own keys, own replay store, own ledger; currently under the same operator as the home test node.',
      });
    }
    if (p === '/oip/inbox' && request.method === 'POST') return handleInbox(env, request);
    if (p === '/oip/run' && request.method === 'POST') return handleRun(env, request);
    if (p === '/oip/ledger') return handleLedger(env, url);

    return json({
      node: 'oip-peer',
      protocol: OIP_MSG_PROTOCOL,
      domain: env.PEER_DOMAIN,
      what: 'second federation node for the Object Invocation Protocol — proves oip-message/1 exchanges across two separately deployed instances on two domains under one operator.',
      endpoints: {
        well_known: 'https://' + env.PEER_DOMAIN + '/.well-known/oip.json',
        inbox: 'POST https://' + env.PEER_DOMAIN + '/oip/inbox (an oip-message/1 envelope)',
        ledger: 'https://' + env.PEER_DOMAIN + '/oip/ledger',
      },
      spec: env.HOME_BASE + '/oip/inbox',
      federation_proof: env.HOME_BASE + '/api/dispatch?fedtest=1&format=markdown',
    });
  },
};
