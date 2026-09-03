// Public read + guarded append for the work-turns transcript.
//   GET  /api/work-turns/<task>          -> the sanitized, hash-chained turns as JSON (keyless)
//   GET  /api/work-turns/<task>/verify   -> recompute the chain, report the first break (keyless)
//   POST /api/work-turns/<task>          -> append one turn (owner only; sanitized server-side)
import { appendTurn, loadTurns, verifyTurnsChain } from '../../_lib/work_turns.js';
import { isBuildAuthed } from '../../_lib/admin_session.js';

function json(o, s = 200) {
  return new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': s === 200 ? 'public, max-age=30' : 'no-store' } });
}
function parts(context) {
  const raw = context.params?.path;
  return (Array.isArray(raw) ? raw.map(String) : String(raw || '').split('/')).filter(Boolean);
}

export async function onRequestGet(context) {
  const p = parts(context);
  const taskId = String(p[0] || '').toUpperCase();
  if (!/^WT-\d{4}$/.test(taskId)) return json({ error: 'task_id_required', example: '/api/work-turns/WT-0090' }, 400);
  if (String(p[1] || '').toLowerCase() === 'verify') {
    return json({ _self: { what: 'Recompute the work-turns hash chain and report the first break.' }, task_id: taskId, ...(await verifyTurnsChain(context.env, taskId)) });
  }
  const turns = await loadTurns(context.env, taskId);
  return json({
    _ai_door: { see: `https://miscsubjects.com/work-turns/${taskId}`, note: 'The operator instructions and tool calls behind this work, sanitized and hash-chained. Read-only; no write surface is exposed.' },
    _self: { schema: 'miscsubjects/work-turns/1', what: 'A curated, secret-stripped, hash-chained transcript of the session behind a work object.', verify: `https://miscsubjects.com/api/work-turns/${taskId}/verify` },
    task_id: taskId, count: turns.length, turns,
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const p = parts(context);
  const taskId = String(p[0] || '').toUpperCase();
  if (!/^WT-\d{4}$/.test(taskId)) return json({ error: 'task_id_required' }, 400);
  if (!(await isBuildAuthed(request, env))) return json({ error: 'not_found' }, 404);
  let body = {};
  try { body = JSON.parse(await request.text() || '{}'); } catch { return json({ error: 'body_must_be_json' }, 400); }
  if (Array.isArray(body.turns)) {
    const out = [];
    for (const t of body.turns) out.push(await appendTurn(env, { taskId, ...t }));
    return json({ ok: true, appended: out.length, results: out });
  }
  const result = await appendTurn(env, { taskId, ...body });
  return json(result, result.error ? 422 : 200);
}
