// /api/audit — CharlieOS claim auditor.
// POST submits a claim; GET retrieves a prior audit by public_id.

import { runAudit, publicId, hashKey, nowIso } from '../_lib/audit_engine.js';

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), { status, headers: { 'content-type': 'application/json' } });
}

async function upsertUserKey(env, key, nickname) {
  if (!key) return null;
  const h = await hashKey(key);
  const ts = nowIso();
  try {
    await env.DB.prepare(
      'INSERT INTO user_keys (key_hash, nickname, created_at, last_seen_at) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(key_hash) DO UPDATE SET last_seen_at=excluded.last_seen_at'
    ).bind(h, nickname || null, ts, ts).run();
  } catch {}
  return h;
}

export async function onRequestPost(context) {
  const { env, request } = context;
  let body = {};
  try { body = await request.json(); } catch {}

  const claim = String(body.claim || body.text || '').trim();
  if (!claim) return json({ error: 'claim is required' }, 400);
  if (claim.length > 2000) return json({ error: 'claim too long (max 2000 chars)' }, 400);

  const ctx = String(body.context || '').trim();
  const mode = String(body.mode || 'audit').toLowerCase();
  const userKey = String(request.headers.get('x-user-key') || '').trim();
  const nickname = String(body.nickname || '').trim();
  const userKeyHash = await upsertUserKey(env, userKey, nickname);

  const ts = nowIso();
  const pid = await publicId(claim, ts);

  try {
    await env.DB.prepare(
      'INSERT INTO audit_jobs (ts, public_id, user_key_hash, claim, context, mode, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(ts, pid, userKeyHash, claim, ctx, mode, 'pending', ts, ts).run();
  } catch (e) {
    return json({ error: 'database error: ' + (e?.message || String(e)) }, 500);
  }

  let result;
  try {
    result = await runAudit(env, claim, ctx);
    await env.DB.prepare(
      'UPDATE audit_jobs SET status=?, verdict=?, confidence=?, reasoning=?, evidence_json=?, ledger_hash=?, updated_at=? WHERE public_id=?'
    ).bind('done', result.verdict, result.confidence, result.reasoning, JSON.stringify(result.evidence), result.ledger_hash, nowIso(), pid).run();
  } catch (e) {
    const err = String(e?.message || String(e));
    await env.DB.prepare("UPDATE audit_jobs SET status='error', reasoning=?, updated_at=? WHERE public_id=?").bind(err, nowIso(), pid).run();
    return json({ error: err, public_id: pid }, 500);
  }

  return json({ public_id: pid, claim, context: ctx, ...result });
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const pid = String(url.searchParams.get('id') || '').trim();
  if (!pid) return json({ error: 'id required' }, 400);

  const row = await env.DB.prepare(
    'SELECT public_id, claim, context, mode, status, verdict, confidence, reasoning, evidence_json, ledger_hash, created_at, updated_at FROM audit_jobs WHERE public_id=?'
  ).bind(pid).first();
  if (!row) return json({ error: 'not found' }, 404);

  return json({
    public_id: row.public_id,
    claim: row.claim,
    context: row.context,
    mode: row.mode,
    status: row.status,
    verdict: row.verdict,
    confidence: row.confidence,
    reasoning: row.reasoning,
    evidence: JSON.parse(row.evidence_json || '[]'),
    ledger_hash: row.ledger_hash,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}
