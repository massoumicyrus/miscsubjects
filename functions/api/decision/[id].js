import { isBuildAuthed } from '../../_lib/admin_session.js';
const json = (o, status = 200) => new Response(JSON.stringify(o, null, 2), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' } });
export async function onRequestGet({ request, env, params }) {
  const id = String(params.id || '').replace(/^decision:\/\//, '').trim();
  if (!id) return json({ error: 'BAD_REQUEST' }, 400);
  let row;
  try { row = await env.LEDGER.prepare("SELECT id, ts, key, status, request_json, response_json FROM events WHERE id = ? AND action = 'context_decision'").bind(id).first(); }
  catch (e) { return json({ error: 'LEDGER_LOOKUP_FAILED', note: 'the ledger did not answer; the decision may exist', detail: String(e?.message || e) }, 503); }
  if (!row) return json({ error: 'DECISION_NOT_FOUND', id }, 404);
  const full = await isBuildAuthed(request, env);
  let d = {}, rq = {}; try { d = JSON.parse(row.response_json || '{}'); } catch {} try { rq = JSON.parse(row.request_json || '{}'); } catch {}
  return json({ decision: 'decision://' + row.id, at: row.ts, key: row.key, status: row.status, outcome: d.decision, code: d.code, policy_rev: d.policy_rev, policies_applied: d.policies_applied || rq.policies_applied || [], decision_hash: d.decision_hash, checks: full ? d.checks : (d.checks || []).map((c) => ({ check: c.check, ok: c.ok })), detail: full ? d.detail : undefined, presenter: full ? rq.presenter : undefined, disclosure: full ? 'owner' : 'public' });
}
