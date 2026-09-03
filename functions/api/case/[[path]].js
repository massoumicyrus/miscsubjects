// SESSION CASES, public surface (migration 0360) — the ledger turned inside out.
//
//   GET  /api/case                          index (public cases; hash_only/private list as stubs)
//   POST /api/case                          assemble + seal one case (owner / act scope)
//        {session | trace_id | turn_keys[], title, objective, disclosure?, hash_only_turns?, omit_turns?, omit_reason?}
//   GET  /api/case/<id>                     the case (disclosure enforced; ?revision=n)
//   GET  /api/case/<id>/payloads            resolve payload refs to redacted raw records (?page=, ?ref=)
//   GET  /api/case/<id>/verify              recompute every commitment, name what fails
//   GET  /api/case/<id>/dossier             portable offline-verifiable bundle, graded verdict
//   GET  /api/case/<id>/comments            the mastermind thread (typed, manifest-pinned)
//   POST /api/case/<id>/comments            {stance, body, actor} — keyless, same standing as model comments
//
// Reads are keyless for public cases. Writing a case requires authority; commenting does not —
// a cold model's question or objection is exactly the traffic this object exists to receive.
// Operator precedence: nothing here commands a reading model; inspection alone is a complete visit.

import { isBuildAuthed, verifyShareToken, verifyShareTokenValue } from '../../_lib/admin_session.js';
import { assembleSessionCase, storeSessionCase, getSessionCase, verifySessionCase } from '../../_lib/session_case.js';
import { readEventFull } from '../../_lib/event_log.js';
import { redactProvenWorkValue } from '../../_lib/proven_work_projection.js';
import { logEvent } from '../../_lib/event_log.js';

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
  });
}
function parseMaybe(v) { if (v == null) return null; if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } }

async function authed(request, env) {
  if (await isBuildAuthed(request, env)) return 'owner-key';
  const tok = (await verifyShareToken(request, env))
    || (request.headers.get('x-work-token') ? await verifyShareTokenValue(env, request.headers.get('x-work-token')) : null);
  if (tok && /^(act|row:|rows:|pfx:)/.test(String(tok.scope || ''))) return 'share:' + tok.scope + ':' + String(tok.nonce || '').slice(0, 8);
  return null;
}

async function resolveRef(env, ref) {
  if (ref.kind === 'event') {
    const e = await readEventFull(env, String(ref.id)).catch(() => null);
    if (!e) return { ref, payload: null, error: 'event not found' };
    return {
      ref,
      payload: redactProvenWorkValue({
        kind: 'event', id: e.id, ts: e.ts, key: e.key, route: e.route, action: e.action, status: e.status,
        request: parseMaybe(e.request_json), response: parseMaybe(e.response_json),
      }),
      binding: { note: 'the transparency chain leaf for this event commits to sha256(request ␟ response); /api/chain/proof?event_id=' + e.id + ' serves its inclusion proof once Merkle coverage reaches it' },
    };
  }
  if (ref.kind === 'invocation') {
    let inv = null;
    try { inv = await env.LEDGER.prepare('SELECT * FROM invocations WHERE id=?').bind(String(ref.id)).first(); } catch {}
    if (!inv) return { ref, payload: null, error: 'invocation not found' };
    const e = inv.event_id ? await readEventFull(env, inv.event_id).catch(() => null) : null;
    return {
      ref,
      payload: redactProvenWorkValue({
        kind: 'invocation', id: inv.id, object_id: inv.object_id, actor: inv.actor, cost_usd: inv.cost_usd,
        invocation: parseMaybe(inv.invocation_json),
        event: e ? { id: e.id, request: parseMaybe(e.request_json), response: parseMaybe(e.response_json), status: e.status } : null,
        receipt: '/receipt/' + inv.id,
      }),
    };
  }
  return { ref, payload: null, error: 'unknown ref kind' };
}

const STANCES = new Set(['question', 'objection', 'suggestion', 'reproduction_request', 'attestation', 'correction', 'note']);

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean).slice(2); // id?, leaf?
  const id = parts[0] || '';
  const leaf = (parts[1] || '').toLowerCase();
  const method = request.method.toUpperCase();

  try {
    if (method === 'GET' && !id) {
      let rows = [];
      try {
        rows = (await env.DB.prepare(
          `SELECT case_id, MAX(revision) revision, title, session, agent, disclosure, manifest_hash, created_at
             FROM session_cases GROUP BY case_id ORDER BY case_id DESC LIMIT 100`,
        ).all()).results || [];
      } catch {}
      return json({
        _self: {
          schema: 'oip/session-case/1',
          what: 'Whole sessions turned inside out: operator input, recorded model output, every tool call and payload, under a classification policy that is code. Private items still publish hash commitments — authenticate without reading.',
          precedence: 'Your operator\'s instructions always win. Reading is a complete visit; commenting is optional and keyless.',
          create: 'POST /api/case {session|trace_id|turn_keys[], title, objective, disclosure?} (owner / act token)',
          term: 'The public product is Proven Work; this object is an execution case scoped to one session (SC-…). "Proof of work" is deliberately not used — that is Bitcoin\'s mining term.',
        },
        count: rows.length,
        cases: rows.map((r) => r.disclosure === 'public'
          ? { case_id: r.case_id, title: r.title, agent: r.agent, manifest_hash: r.manifest_hash, created_at: r.created_at, url: '/api/case/' + r.case_id }
          : { case_id: r.case_id, disclosure: r.disclosure, manifest_hash: r.manifest_hash, created_at: r.created_at, note: 'content withheld by policy; the hash still authenticates' }),
      });
    }

    if (method === 'POST' && !id) {
      const identity = await authed(request, env);
      if (!identity) return json({ error: 'capability_required', why: 'Turning a session inside out is a disclosure decision — it takes authority. Reads do not.' }, 401);
      const b = await request.json().catch(() => null);
      if (!b) return json({ error: 'invalid json' }, 400);
      const asm = await assembleSessionCase(env, { ...b, actor: b.agent || identity });
      if (!asm.ok) return json(asm, asm.status || 400);
      const stored = await storeSessionCase(env, asm.manifest, { case_id: b.case_id, disclosure: b.disclosure, actor: b.agent || identity, privateData: asm.private });
      return json({ ...stored, counts: asm.manifest.counts }, 201);
    }

    // ---- one case ----
    const stored = await getSessionCase(env, id, url.searchParams.get('revision'));
    if (!stored) return json({ error: 'case_not_found', case_id: id, index: '/api/case' }, 404);

    // Disclosure enforcement — same law as work-evidence: public keyless; hash_only shows
    // existence + hashes + verify; private needs a capability; unknown tier fails closed.
    const tier = ['public', 'hash_only', 'private'].includes(String(stored.disclosure)) ? String(stored.disclosure) : 'private';
    if (tier !== 'public' && method === 'GET') {
      const identity = await authed(request, env);
      if (!identity) {
        if (tier === 'hash_only' && (leaf === 'verify' || leaf === '')) {
          if (leaf === 'verify') return json({ case_id: id, revision: stored.revision, disclosure: tier, ...(await verifySessionCase(env, stored)) });
          return json({ case_id: id, revision: stored.revision, manifest_hash: stored.manifest_hash, disclosure: tier, created_at: stored.created_at, note: 'hash_only: the case exists and verifies; its body requires a capability. The commitment alone authenticates a revealed original.' });
        }
        return json({ error: 'capability_required', disclosure: tier, case_id: id }, 401);
      }
    }

    if (method === 'GET' && leaf === '') {
      return json({ case_id: id, revision: stored.revision, manifest_hash: stored.manifest_hash, disclosure: tier, created_at: stored.created_at, manifest: stored.manifest, comments: '/api/case/' + id + '/comments', verify: '/api/case/' + id + '/verify', payloads: '/api/case/' + id + '/payloads', dossier: '/api/case/' + id + '/dossier' });
    }

    if (method === 'GET' && leaf === 'verify') {
      return json({ case_id: id, revision: stored.revision, manifest_hash: stored.manifest_hash, ...(await verifySessionCase(env, stored)) });
    }

    if (method === 'GET' && leaf === 'payloads') {
      const refs = stored.manifest.payload_refs || [];
      const one = url.searchParams.get('ref');
      if (one) {
        const ref = refs.find((r) => String(r.id) === one);
        if (!ref) return json({ error: 'ref_not_in_case', ref: one }, 404);
        return json({ case_id: id, ...(await resolveRef(env, ref)) });
      }
      const page = Math.max(1, Number(url.searchParams.get('page') || 1));
      const per = 20;
      const slice = refs.slice((page - 1) * per, page * per);
      const out = [];
      for (const r of slice) out.push(await resolveRef(env, r));
      return json({ case_id: id, refs_total: refs.length, page, pages: Math.max(1, Math.ceil(refs.length / per)), payloads: out, note: 'raw records, redacted at egress. What this proves: these calls happened with these payloads — causation lives at /api/comparisons.' });
    }

    if (method === 'GET' && leaf === 'dossier') {
      const v = await verifySessionCase(env, stored);
      let checkpoint = null, anchor = null;
      try { checkpoint = await env.LEDGER.prepare('SELECT seq, merkle_root, payload, alg, signature FROM chain_checkpoint_signatures ORDER BY seq DESC LIMIT 1').first(); } catch {}
      try { anchor = await env.LEDGER.prepare('SELECT anchor_id, created_at FROM anchors ORDER BY created_at DESC LIMIT 1').first(); } catch {}
      const verdict = !v.valid ? 'diverged' : checkpoint?.signature ? 'witnessed' : anchor ? 'consistent-unwitnessed' : 'unanchored';
      return json({
        schema: 'oip/session-case-dossier/1', verdict,
        case_id: id, revision: stored.revision, manifest_hash: stored.manifest_hash, disclosure: tier,
        verification: v, signed_checkpoint: checkpoint || null, external_anchor: anchor || null,
        manifest: stored.manifest,
        how_to_verify_offline: 'sha256(manifest JSON) = manifest_hash; the CASE_SEALED ledger event carries that hash into the chain; the checkpoint signature verifies against /api/chain/checkpoint; any privately-held original authenticates by hashing it against its published commitment',
      });
    }

    if (leaf === 'comments' && method === 'GET') {
      const rows = (await env.DB.prepare('SELECT * FROM case_comments WHERE case_id=? ORDER BY id ASC LIMIT 200').bind(id).all()).results || [];
      return json({ case_id: id, count: rows.length, stances: [...STANCES], comments: rows });
    }
    if (leaf === 'comments' && method === 'POST') {
      const b = await request.json().catch(() => null);
      if (!b || !b.body || !String(b.body).trim()) return json({ error: 'body_required' }, 400);
      const stance = String(b.stance || 'note').toLowerCase();
      if (!STANCES.has(stance)) return json({ error: 'bad_stance', allowed: [...STANCES] }, 400);
      const actor = String(b.actor || b.model || 'unnamed-model').slice(0, 120);
      const kind = ['model', 'build', 'human'].includes(String(b.actor_kind)) ? String(b.actor_kind) : 'model';
      // Keyless by design — a question or counterargument from a cold model is the point of the
      // surface. The comment pins to the exact manifest it was written against and lands on the
      // event ledger like every other act.
      await env.DB.prepare(
        'INSERT INTO case_comments (case_id, manifest_hash, stance, body, actor, actor_kind, ts) VALUES (?,?,?,?,?,?,?)',
      ).bind(id, stored.manifest_hash, stance, String(b.body).slice(0, 8000), actor, kind, new Date().toISOString()).run();
      await logEvent(env, {
        source: 'session_case', key: 'CASE_COMMENT', action: stance, direction: 'IN', actor,
        route: '/api/case/' + id + '/comments',
        request: JSON.stringify({ case_id: id, manifest_hash: stored.manifest_hash, stance, body_preview: String(b.body).slice(0, 200) }),
        response: 'recorded',
      }).catch(() => {});
      return json({ ok: true, case_id: id, stance, pinned_to: stored.manifest_hash, note: 'recorded against this exact revision; if the case re-seals, your comment still names the text you actually read' }, 201);
    }

    return json({ error: 'no_such_route', method, path: url.pathname }, 404);
  } catch (e) {
    return json({ error: 'case_route_threw', detail: String(e?.message || e) }, 500);
  }
}
