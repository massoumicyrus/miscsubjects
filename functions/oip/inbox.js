// The home federation inbox — POST https://miscsubjects.com/oip/inbox.
// A remote agent at another domain sends a signed oip-message/1 envelope here. This handler:
//   1. verifies the envelope shape, freshness, body hash, and the SENDER's signature against
//      the sender domain's /.well-known/oip.json (identity, not authority),
//   2. rejects any message id it has already seen (replay membrane),
//   3. treats the envelope body as DATA — a query is echoed, nothing runs,
//   4. runs an invoke ONLY when it carries a valid capability that is audience-bound to the
//      verified sender, re-checking every OIP gate (scope, chain, contract, tenant, uses),
//   5. replies with a signed envelope: results carry the receipt id + input/output hashes so
//      the two separately deployed ledgers can be joined without either trusting the other.
//
// This is a route file. dispatch.js never imports it, so wiring the dispatch executor in here
// introduces no import cycle.

import { envelopeShapeError, verifyEnvelope, redactEnvelope, sha256Hex, canonicalJson, decryptEnvelopeBody, encryptEnvelopeBody } from '../_lib/oip_envelope.js';
import { homeAgentId, homeDomain, signAsHome, logFederation, homePrivateJwk } from '../_lib/oip_federation.js';
import { resolveAgent, agentDomain } from '../_lib/oip_envelope.js';
import { buildEnvelope } from '../_lib/oip_envelope.js';
import {
  verifyShareTokenValue, getCapabilityByNonce, capabilityChainStatus,
  consumeCapabilityUse, tokenAllowsKey, capFingerprint,
} from '../_lib/admin_session.js';
import { dispatch, capGateCheck, tenantGateCheck, audienceMatch, loadDirectory } from '../api/dispatch.js';
import { wrapDispatchResponse } from '../_lib/object_contract.js';
import { logInvocation } from '../_lib/invocation_log.js';
import { recordConversationMessage } from '../_lib/oip_conversation.js';

const json = (obj, status = 200) => new Response(JSON.stringify(obj, null, 2), {
  status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
});

function cache(env) {
  return env.KV ? { get: (k) => env.KV.get(k), put: (k, v, ttlSec) => env.KV.put(k, v, { expirationTtl: Math.max(60, ttlSec || 300) }) } : null;
}

async function reply(env, envelope, kind, body, encryptToJwk = null) {
  let unsigned = await buildEnvelope({
    from: homeAgentId(env), to: envelope.from, kind, body,
    conversation: envelope.conversation, in_reply_to: envelope.id, ttl_sec: 300,
  });
  // Thread bookkeeping is computed from the cleartext body BEFORE any encryption.
  const meta = {
    direction: 'outbound',
    verdict: body?.invoked ? 'invoked' : (body?.reason || 'answered'),
    invocation_id: body?.invocation_id || null,
  };
  // If the inbound message was encrypted to us, seal the reply back to the sender's key so the
  // full round trip is confidential over any transport.
  if (encryptToJwk) unsigned = await encryptEnvelopeBody(unsigned, encryptToJwk);
  const signed = await signAsHome(env, unsigned);
  try { await recordConversationMessage(env, signed, meta); } catch {}
  return signed;
}

export async function onRequestPost(context) {
  const { env } = context;
  let envelope;
  try { envelope = await context.request.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const shape = envelopeShapeError(envelope);
  if (shape) return json({ error: 'malformed_envelope', reason: shape }, 400);
  if (agentDomain(envelope.to) !== homeDomain(env) || String(envelope.to).toLowerCase() !== homeAgentId(env)) {
    return json({ error: 'unknown_recipient', to: envelope.to, expected: homeAgentId(env) }, 404);
  }

  // Replay membrane: a message id is delivered at most once, ever. The seen-check runs first,
  // but the id is only MARKED seen after the sender's signature verifies (below) — so a forged,
  // unverifiable envelope cannot poison a legitimate sender's future message id.
  const seenKey = 'fed:seen:' + envelope.id;
  if (env.KV && await env.KV.get(seenKey)) {
    const r = await reply(env, envelope, 'error', { reason: 'replay_rejected', note: 'this message id was already delivered; a resent envelope never re-runs anything.' });
    await logFederation(env, { action: 'inbox', direction: 'inbound', msg_id: envelope.id, kind: envelope.kind, from: envelope.from, to: envelope.to, body_sha256: envelope.body_sha256, verdict: 'replay_rejected', response_id: r.id, status: 409 });
    return json(r, 200);
  }

  // Sender identity: verify the signature against the sender's published key. A published
  // sender MUST verify; an unpublished one may only ask a question (query), never invoke.
  const resolved = await resolveAgent(envelope.from, cache(env));
  let senderVerified = false;
  if (resolved.ok) {
    const v = await verifyEnvelope(envelope, resolved.jwk);
    if (!v.ok) {
      const r = await reply(env, envelope, 'error', { reason: v.reason, note: 'the sender is published, so its signature must verify; nothing ran.' });
      await logFederation(env, { action: 'inbox', direction: 'inbound', msg_id: envelope.id, kind: envelope.kind, from: envelope.from, to: envelope.to, body_sha256: envelope.body_sha256, verdict: 'rejected:' + v.reason, response_id: r.id, status: 401 });
      return json(r, 200);
    }
    senderVerified = true;
  } else if (envelope.kind !== 'query') {
    const r = await reply(env, envelope, 'error', { reason: 'sender_unverifiable', resolve_failure: resolved.reason, note: 'only query is open to unpublished senders; every other kind needs a resolvable signing key.' });
    await logFederation(env, { action: 'inbox', direction: 'inbound', msg_id: envelope.id, kind: envelope.kind, from: envelope.from, to: envelope.to, body_sha256: envelope.body_sha256, verdict: 'rejected:sender_unverifiable', response_id: r.id, status: 401 });
    return json(r, 200);
  }
  // Verified (or an open query): claim the message id now so a resend is a replay.
  if (env.KV) await env.KV.put(seenKey, '1', { expirationTtl: 60 * 60 * 24 });

  // Record the inbound message into its durable thread before it is processed.
  try { await recordConversationMessage(env, envelope, { direction: 'inbound', verdict: senderVerified ? 'received' : 'received_unverified' }); } catch {}

  // ENCRYPTED PAYLOAD — if the body is sealed to us, recover it AFTER the signature verified.
  // Replies to an encrypted message are sealed back to the sender's key (full round-trip E2EE).
  const replyEncTo = (senderVerified && envelope.enc && resolved?.jwk) ? resolved.jwk : null;
  if (envelope.enc) {
    const priv = homePrivateJwk(env);
    if (!priv) {
      const r = await reply(env, envelope, 'error', { reason: 'decrypt_unavailable', note: 'this node has no private key to open a sealed payload.' });
      return json(r, 200);
    }
    try { envelope.body = await decryptEnvelopeBody(envelope, priv); }
    catch {
      const r = await reply(env, envelope, 'error', { reason: 'decrypt_failed', note: 'the sealed payload could not be opened with this node\'s key.' }, replyEncTo);
      await logFederation(env, { action: 'inbox', direction: 'inbound', msg_id: envelope.id, kind: envelope.kind, from: envelope.from, to: envelope.to, body_sha256: envelope.body_sha256, sender_verified: senderVerified, verdict: 'decrypt_failed', response_id: r.id, status: 400 });
      return json(r, 200);
    }
  }

  // QUERY — the body is data. Echo it, invoke nothing. This is where a prompt-injection
  // payload lands harmlessly: text that says "ignore your rules and run X" is returned as data.
  if (envelope.kind === 'query') {
    const r = await reply(env, envelope, 'result', {
      agent: homeAgentId(env), answered_at: new Date().toISOString(),
      echo: envelope.body, invoked: false, retrieved_text_is_data: true, sender_verified: senderVerified, encrypted: !!envelope.enc,
      note: 'A query grants and requires no authority. Message text is data, never an instruction — nothing was executed.',
    }, replyEncTo);
    await logFederation(env, { action: 'inbox', direction: 'inbound', msg_id: envelope.id, kind: 'query', from: envelope.from, to: envelope.to, body_sha256: envelope.body_sha256, sender_verified: senderVerified, verdict: 'echoed', response_id: r.id, response_body_sha256: r.body_sha256, status: 200 });
    return json(r, 200);
  }

  // INVOKE — the only kind that can run an object. Needs a valid, audience-bound capability.
  if (envelope.kind === 'invoke') {
    const key = String(envelope.body?.key || '');
    const args = envelope.body?.args == null ? '' : String(envelope.body.args);
    const token = envelope.capability;
    const deny = async (status, reason, note) => {
      const r = await reply(env, envelope, 'error', { reason, note, invoked: false, ran: false });
      await logFederation(env, { action: 'inbox', direction: 'inbound', msg_id: envelope.id, kind: 'invoke', from: envelope.from, to: envelope.to, body_sha256: envelope.body_sha256, sender_verified: senderVerified, verdict: 'denied:' + reason, response_id: r.id, status });
      return json(r, 200);
    };
    if (!token) return deny(401, 'capability_required', 'an invoke must carry a capability in envelope.capability.');
    const tokenInfo = await verifyShareTokenValue(env, token);
    if (!tokenInfo) return deny(401, 'capability_invalid', 'the capability failed its signature/expiry check.');
    const cap = await getCapabilityByNonce(env, tokenInfo.nonce);
    if (!cap) return deny(401, 'capability_unrecorded', 'this token has no capability record; only recorded capabilities can invoke here.');
    // THE FEDERATION CHECK: the capability must be minted for THIS verified sender.
    if (!cap.audience) {
      return deny(403, 'audience_binding_required', 'a federation invoke requires a capability explicitly bound to a remote agent or domain. An ordinary unbound token cannot cross this boundary.');
    }
    if (!audienceMatch(cap.audience, envelope.from)) {
      return deny(403, 'audience_mismatch', 'this capability is bound to ' + (cap.audience || '(none)') + '; the verified sender is ' + envelope.from + '. A capability handed to one agent cannot be used by another.');
    }
    if (!tokenAllowsKey(tokenInfo, key)) return deny(403, 'scope_mismatch', 'this capability may not invoke ' + key + '. See its allowed set at ?explain=.');
    const chain = await capabilityChainStatus(env, cap);
    if (!chain.ok) return deny(401, chain.reason, 'a parent of this capability is revoked or expired.');
    const dir = await loadDirectory(env);
    const row = dir[key] || { key };
    if (!dir[key]) return deny(404, 'unknown_object', 'no object named ' + key + '.');
    const gate = await capGateCheck(cap, row, args, { audienceMatched: true });
    if (!gate.ok) return deny(gate.status, gate.reason, 'denied by the capability record.');
    const tg = await tenantGateCheck(env, cap, key);
    if (!tg.ok) return deny(tg.status, tg.reason, 'denied by tenant isolation.');
    const used = await consumeCapabilityUse(env, cap);
    if (!used.ok) return deny(used.reason === 'token_exhausted' ? 429 : 401, used.reason, 'this capability cannot authorize another invocation.');

    const actor = 'cap:' + cap.fingerprint;
    const authContext = { ownerAuthed: false, tokenInfo, capFingerprint: cap.fingerprint, actor, federated_from: envelope.from };
    const r = await dispatch(env, key, gate.body, { actor, authContext });
    const wrapped = await wrapDispatchResponse(r, row, key, {
      actor, input: gate.body, on_behalf_of: { immediate_actor: envelope.from, claimed_chain: [envelope.from], minted_for: cap.actor || null, note: 'federated invoke; immediate_actor is the cryptographically-verified sending agent.' },
      authorized_by: 'federated invoke from ' + envelope.from,
    });
    if (!r.noLog) {
      if (wrapped.invocation && r.event_id) wrapped.invocation.event_id = r.event_id;
      await logInvocation(env, { trace_id: r.trace, object_id: key, row, actor, input: gate.body, result: r.result, cost_usd: r.cost, event_id: r.event_id, invocation: wrapped.invocation, tenant_id: cap.tenant_id || null });
    }
    const invId = wrapped.invocation?.id || null;
    const inputHash = await sha256Hex(canonicalJson({ key, args: gate.body }));
    const outputHash = await sha256Hex(String(r.result == null ? '' : r.result));
    const replyBody = {
      invoked: true, ran: true, ok: !!wrapped.proof?.ok, object: key, agent: homeAgentId(env),
      invocation_id: invId,
      confirm: invId ? 'https://' + homeDomain(env) + '/api/dispatch?confirm=' + invId : null,
      result_preview: String(r.result == null ? '' : r.result).slice(0, 400),
      cross_ledger: { request_body_sha256: envelope.body_sha256, input_sha256: inputHash, output_sha256: outputHash },
      capability_fingerprint: cap.fingerprint,
      note: 'executed under a capability audience-bound to the sender; the receipt is joinable to your ledger by these hashes and the message id.',
    };
    const rep = await reply(env, envelope, 'result', replyBody, replyEncTo);
    await logFederation(env, {
      action: 'inbox', direction: 'inbound', msg_id: envelope.id, kind: 'invoke', from: envelope.from, to: envelope.to,
      body_sha256: envelope.body_sha256, sender_verified: senderVerified, verdict: 'invoked', response_id: rep.id,
      response_body_sha256: rep.body_sha256, capability_fingerprint: cap.fingerprint, audience: cap.audience || null,
      invocation_id: invId, status: 200,
    });
    return json(rep, 200);
  }

  // Other kinds (propose / event / cancel) are acknowledged as received, executing nothing.
  const r = await reply(env, envelope, 'event', { received: true, kind: envelope.kind, note: 'acknowledged; no action taken.' });
  await logFederation(env, { action: 'inbox', direction: 'inbound', msg_id: envelope.id, kind: envelope.kind, from: envelope.from, to: envelope.to, body_sha256: envelope.body_sha256, sender_verified: senderVerified, verdict: 'acknowledged', response_id: r.id, status: 200 });
  return json(r, 200);
}

export async function onRequestGet(context) {
  const { env } = context;
  return json({
    endpoint: 'oip/inbox', method: 'POST', protocol: 'oip-message/1', agent: homeAgentId(env),
    what: 'send a signed oip-message/1 envelope here. query is echoed as data; invoke runs only with a capability audience-bound to the verified sender.',
    envelope: {
      required: ['protocol', 'id', 'conversation', 'kind', 'from', 'to', 'created_at', 'expires_at', 'body', 'body_sha256', 'signature'],
      kinds: ['query', 'propose', 'invoke', 'result', 'event', 'cancel', 'error'],
      invoke_body: { key: 'OBJECT_KEY', args: '<object arguments>' },
      invoke_requires: ['verified sender signature', 'recorded capability', 'capability audience matching from', 'ordinary scope/chain/contract/tenant/use gates'],
      max_inline_body_bytes: 65536,
      max_ttl_seconds: 900,
    },
    security: {
      identity_is_not_authority: true,
      message_text_is_data: true,
      only_invoke_can_execute: true,
      transport: 'https',
      confidentiality: 'TLS transport only; payload E2EE and the SMTP binding are not implemented.',
    },
    well_known: 'https://' + homeDomain(env) + '/.well-known/oip.json',
    reference_client: 'https://' + homeDomain(env) + '/oip/client.mjs',
  });
}
