import { buildNowIso } from './build_time.js';

export async function getWork(env, id) {
  if (!env?.LEDGER || !id) return null;
  try { return await env.LEDGER.prepare('SELECT * FROM oip_work WHERE id=?').bind(String(id)).first(); }
  catch { return null; }
}

export async function createWork(env, { id, title, asker }) {
  if (!env?.LEDGER || !title || !asker) return { ok: false, status: 400, error: 'title_and_asker_required' };
  const workId = String(id || ('work_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16)));
  const now = buildNowIso();
  try {
    await env.LEDGER.prepare(`INSERT INTO oip_work (id,created_at,updated_at,title,asker,state,version) VALUES (?,?,?,?,?,'asked',1)`)
      .bind(workId, now, now, String(title).slice(0, 1000), String(asker)).run();
    return { ok: true, work: await getWork(env, workId) };
  } catch (e) { return { ok: false, status: 409, error: 'work_create_failed', detail: String(e?.message || e) }; }
}

export async function transitionWork(env, id, action, actor, details = {}) {
  if (!env?.LEDGER || !id || !actor) return { ok: false, status: 400, error: 'id_and_actor_required' };
  const work = await getWork(env, id);
  if (!work) return { ok: false, status: 404, error: 'work_not_found' };
  const a = String(action || '').toLowerCase(), who = String(actor), now = buildNowIso();
  let row = null;
  try {
    if (a === 'promise') {
      row = await env.LEDGER.prepare(`UPDATE oip_work SET state='promised',updated_at=?,promise_actor=?,promised_at=?,version=version+1 WHERE id=? AND state='asked' RETURNING *`).bind(now, who, now, String(id)).first();
    } else if (a === 'done') {
      row = await env.LEDGER.prepare(`UPDATE oip_work SET state='done',updated_at=?,done_by=?,done_at=?,receipt_id=?,evidence_json=?,version=version+1 WHERE id=? AND state='promised' AND promise_actor=? RETURNING *`)
        .bind(now, who, now, details.receipt_id || null, details.evidence == null ? null : JSON.stringify(details.evidence), String(id), who).first();
    } else if (a === 'close') {
      row = await env.LEDGER.prepare(`UPDATE oip_work SET state='closed',updated_at=?,closed_by=?,closed_at=?,version=version+1 WHERE id=? AND state='done' AND asker=? RETURNING *`).bind(now, who, now, String(id), who).first();
    } else if (a === 'cancel') {
      row = await env.LEDGER.prepare(`UPDATE oip_work SET state='cancelled',updated_at=?,version=version+1 WHERE id=? AND state IN ('asked','promised') AND asker=? RETURNING *`).bind(now, String(id), who).first();
    } else return { ok: false, status: 400, error: 'unknown_work_action' };
    if (row) return { ok: true, work: row };
    const current = await getWork(env, id);
    const sameState = (a === 'promise' && current?.state === 'asked') || (a === 'done' && current?.state === 'promised') || (a === 'close' && current?.state === 'done') || (a === 'cancel' && ['asked', 'promised'].includes(current?.state));
    const identityError = a === 'done' ? 'only_promisor_can_mark_done' : a === 'close' ? 'only_asker_can_close' : a === 'cancel' ? 'only_asker_can_cancel' : 'transition_denied';
    return { ok: false, status: sameState ? 403 : 409, error: sameState ? identityError : 'invalid_transition:' + current?.state, work: current };
  } catch (e) { return { ok: false, status: 500, error: 'work_transition_failed', detail: String(e?.message || e) }; }
}
