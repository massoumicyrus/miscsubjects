// The home federation ledger — GET https://miscsubjects.com/oip/ledger.
// This endpoint's own evidence of every federated exchange: message ids, kinds, verdicts, and
// body hashes. It is joinable to the peer's ledger (oip-peer.../oip/ledger) by message id and
// body_sha256 — two separately deployed nodes proving they saw the same exchange, neither
// controlling the other. Public and sanitized: never the raw capability, never private payload.

import { readFederationLedger, homeDomain } from '../_lib/oip_federation.js';

const json = (obj, status = 200) => new Response(JSON.stringify(obj, null, 2), {
  status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
});

export async function onRequestGet(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  const out = await readFederationLedger(env, { msg: url.searchParams.get('msg'), limit: url.searchParams.get('limit') });
  if (!out.ok) return json({ ok: false, error: out.error || 'unavailable' }, 500);
  return json({
    ok: true,
    node: homeDomain(env),
    peer_ledger: 'https://oip-peer.owner-account.workers.dev/oip/ledger',
    join_note: 'match records to the peer by msg_id and body_sha256 to prove both nodes saw the same exchange.',
    ...out,
  });
}
