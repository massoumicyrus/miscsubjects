// Write an adversarial audit verdict back onto a logged turn (called by scripts/cc-audit.sh).
// POST {turn_id, verdict, note, engine}
export async function onRequestPost(context) {
  const { request, env } = context;
  let r;
  try { r = await request.json(); } catch { return j({ error: 'bad json' }, 400); }
  if (!r.turn_id) return j({ error: 'turn_id required' }, 400);
  try {
    const res = await env.DB.prepare(
      'UPDATE cc_turns SET audit_verdict=?, audit_note=?, audit_engine=? WHERE id=?'
    ).bind(String(r.verdict || ''), String(r.note || ''), String(r.engine || ''), Number(r.turn_id)).run();
    return j({ ok: true, changes: res.meta.changes });
  } catch (e) { return j({ error: String(e && e.message || e) }, 500); }
}
function j(o, s) { return new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } }); }
