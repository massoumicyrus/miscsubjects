// THE VERIFICATION DOOR — where anyone, human or model, verifies a send and countersigns it.
//
//   GET  /api/verify                     the public send ledger: chain verification over EVERY row,
//                                        totals, recent sends, and the witness contract
//   GET  /api/verify/<snd_id>            one proof: the row, its chain linkage, the work evidence,
//                                        engagement, witnesses so far, and how to countersign
//   POST /api/verify/<snd_id>/witness    { agent, model?, verdict?, note? } → keyless. A token is
//                                        minted FOR the caller and its countersignature is appended
//                                        to the same hash chain. No key, no account.
//   GET  /api/verify/<snd_id>/witness?agent=…&verdict=…&note=…   the same write over GET, for
//                                        web-based models whose transport cannot POST (the lesson
//                                        the comment ledger already learned: one door, two verbs)
//   POST /api/verify/backfill            owner-gated: append rows for sends that predate the ledger
//
// Reads are public and keyless: a ledger nobody can read verifies nothing. The chain is verified
// over ALL rows on every index read — never over the page being displayed (the work-audit lesson:
// verifying a window reports "valid" while an overwritten row sits below it).

import { isBuildAuthed } from '../../_lib/admin_session.js';
import { verifyChain, getProof, witnessSign, backfillFromEmailSends, WITNESS_VERDICTS } from '../../_lib/send_proof.js';

const BASE = 'https://miscsubjects.com';

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    },
  });
}

function witnessContract(id) {
  return {
    what: 'Countersign this send: you verified the receipt, the chain, and the evidence — or you found they do not hold. Either way, sign what you found.',
    step_1_verify: 'Recompute: this row\'s hash = sha256(prev_hash + "|" + canonical payload). The payload field order is documented at GET ' + BASE + '/api/verify (field "chain").',
    step_2_sign: {
      method: 'POST', url: BASE + '/api/verify/' + id + '/witness',
      body: { agent: '<your name>', model: '<your model id>', verdict: 'VERIFIED | CONTRADICTED | INCONCLUSIVE', note: '<what you checked and what you found>' },
      get_transport: BASE + '/api/verify/' + id + '/witness?agent=<you>&verdict=VERIFIED&note=<what you checked>',
      auth: 'none — a token is minted for you and its fingerprint is recorded on your signature',
    },
    returns: 'your witness row id, its chain hash, and the fingerprint of the token that signed for you',
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean); // api, verify, ...
  const seg = parts.slice(2);
  const method = request.method.toUpperCase();

  try {
    if (method === 'GET' && seg.length === 0) {
      const chain = await verifyChain(env);
      const totals = await env.DB.prepare(
        `SELECT kind, COUNT(*) n FROM send_ledger GROUP BY kind`,
      ).all();
      const recent = (await env.DB.prepare(
        `SELECT proof_id, kind, ts, recipient_domain, recipient_sha256, subject, body_sha256, prev_hash, hash
           FROM send_ledger WHERE kind != 'witness' ORDER BY id DESC LIMIT 100`,
      ).all()).results || [];
      return json({
        _self: {
          schema: 'miscsubjects/send-ledger/1',
          what: 'The public, append-only, hash-chained ledger of every email this build has sent. Every outbound external message carries a /verify/snd_… receipt minted here BEFORE it leaves; a message without one was not sent by this build (email_send_law rule 5 refuses it at the send path).',
          human_projection: BASE + '/verify',
          why: 'A claim of verifiability with no verification surface is a false statement. This surface is where the claim is cashed.',
        },
        chain: {
          ...chain,
          how_to_recompute: 'For each row in id order: hash = sha256(prev_hash + "|" + JSON.stringify({proof_id,kind,parent_proof,ts,recipient_domain,recipient_sha256,subject,body_sha256,evidence,agent,model,verdict,note,capability})) — nulls for absent fields, field order exactly as listed.',
        },
        privacy: 'Recipients appear as domain + sha256(lowercased address). If you hold the address, hash it and match your row; the ledger cannot be harvested as a mailing list.',
        totals: Object.fromEntries((totals.results || []).map((r) => [r.kind, r.n])),
        count: recent.length,
        sends: recent.map((r) => ({ ...r, verify: BASE + '/api/verify/' + r.proof_id })),
        witness_contract: witnessContract('<snd_id>'),
      });
    }

    if (method === 'POST' && seg[0] === 'backfill') {
      if (!(await isBuildAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const body = await request.json().catch(() => ({}));
      const r = await backfillFromEmailSends(env, body.limit || 500);
      return json({ ok: true, ...r });
    }

    const id = seg[0];
    if (!id) return json({ ok: false, error: 'no_such_route' }, 404);

    if (seg[1] === 'witness' && (method === 'POST' || method === 'GET')) {
      const body = method === 'POST'
        ? await request.json().catch(() => ({}))
        : {
            agent: url.searchParams.get('agent'),
            model: url.searchParams.get('model'),
            verdict: url.searchParams.get('verdict'),
            note: url.searchParams.get('note'),
          };
      // A GET with no agent is a read of the contract, not a malformed write.
      if (method === 'GET' && !body.agent) return json({ proof_id: id, ...witnessContract(id), allowed_verdicts: WITNESS_VERDICTS });
      const r = await witnessSign(env, id, body);
      return json(r, r.ok ? 201 : (r.status || 400));
    }

    if (method === 'GET' && seg.length === 1) {
      const p = await getProof(env, id);
      if (!p) {
        return json({
          ok: false, error: 'no_such_proof', proof_id: id,
          meaning: 'No row with this id exists on the send ledger. A message citing this receipt was NOT sent by this build — treat it as someone copying the format without the machinery.',
          ledger: BASE + '/api/verify',
        }, 404);
      }
      let evidence = null;
      try { evidence = JSON.parse(p.row.evidence || 'null'); } catch { evidence = p.row.evidence; }
      return json({
        _self: { schema: 'miscsubjects/send-proof/1', ledger: BASE + '/api/verify', human_projection: BASE + '/verify/' + id },
        proof: {
          proof_id: p.row.proof_id, kind: p.row.kind, ts: p.row.ts,
          recipient_domain: p.row.recipient_domain,
          recipient_sha256: p.row.recipient_sha256,
          subject: p.row.subject,
          body_sha256: p.row.body_sha256,
          evidence,
          prev_hash: p.row.prev_hash, hash: p.row.hash,
        },
        check_yourself: {
          recipient: 'sha256(lowercase(the address you received this at)) must equal recipient_sha256',
          body: 'sha256(the exact plain-text body you received) must equal body_sha256',
          chain: 'this row hashes prev_hash + its canonical payload; the full chain verifies at ' + BASE + '/api/verify',
        },
        engagement: p.engagement,
        witnesses: p.witnesses,
        witness_contract: witnessContract(id),
      });
    }

    return json({ ok: false, error: 'no_such_route', see: BASE + '/api/verify' }, 404);
  } catch (e) {
    return json({ ok: false, error: 'verify_route_threw', detail: String(e?.message || e) }, 500);
  }
}
