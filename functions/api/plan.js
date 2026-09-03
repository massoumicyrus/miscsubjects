// /api/plan — the planning board store. GET lists tasks; POST mutates.
// POST {action:'add', text, owner?, lane?, note?} | {action:'done'|'doing'|'reopen', id}
//      | {action:'note', id, note} | {action:'lane', id, lane}
function json(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } }); }
const now = () => new Date().toISOString();

export async function planList(env) {
  const r = await env.DB.prepare('SELECT * FROM plan_items ORDER BY CASE lane WHEN ?1 THEN 0 WHEN ?2 THEN 1 WHEN ?3 THEN 2 ELSE 3 END, CASE status WHEN ?4 THEN 0 WHEN ?5 THEN 1 ELSE 2 END, id')
    .bind('in_motion', 'needs_you', 'next', 'doing', 'open').all();
  return r.results || [];
}

export async function onRequestGet(context) { return json({ items: await planList(context.env) }); }

export async function onRequestPost(context) {
  const { request, env } = context;
  const b = await request.json().catch(() => ({}));
  const a = String(b.action || '').toLowerCase();
  try {
    if (a === 'add') {
      if (!b.text) return json({ error: 'text required' }, 400);
      const res = await env.DB.prepare('INSERT INTO plan_items (text,status,owner,lane,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
        .bind(String(b.text), 'open', String(b.owner || 'the owner'), String(b.lane || 'next'), b.note ? String(b.note) : null, now(), now()).run();
      return json({ added: res.meta?.last_row_id ?? null });
    }
    const id = parseInt(b.id, 10);
    if (!id) return json({ error: 'id required' }, 400);
    if (a === 'done' || a === 'doing' || a === 'reopen') {
      const status = a === 'reopen' ? 'open' : a;
      await env.DB.prepare('UPDATE plan_items SET status=?, updated_at=? WHERE id=?').bind(status, now(), id).run();
      return json({ id, status });
    }
    if (a === 'note') { await env.DB.prepare('UPDATE plan_items SET note=?, updated_at=? WHERE id=?').bind(String(b.note || ''), now(), id).run(); return json({ id, noted: true }); }
    if (a === 'lane') { await env.DB.prepare('UPDATE plan_items SET lane=?, updated_at=? WHERE id=?').bind(String(b.lane || 'next'), now(), id).run(); return json({ id, lane: b.lane }); }
    return json({ error: 'unknown action' }, 400);
  } catch (e) { return json({ error: e.message }, 500); }
}
