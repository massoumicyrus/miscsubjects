// GET /api/events/<id> — the FULL event: complete request (in) and response (out),
// pulling the overflow body from R2 when it was too big to inline.
// Read-tier gated (terminal key / admin cookie / ?share= read-or-act token).
import { readEventFull } from '../../_lib/event_log.js';
import { isBuildAuthed } from '../../_lib/admin_session.js';
import { redactPublicSecrets } from '../../_lib/public_secret_guard.js';
const BASE = 'https://miscsubjects.com';
function json(o, s = 200) { return new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } }); }

function parse(v) { if (v == null) return null; try { return JSON.parse(v); } catch { return v; } }

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const id = String(params.id || '');
  if (!(await isBuildAuthed(request, env))) return json({ error: 'not_found' }, 404);
  if (!env.LEDGER) return json({ error: 'LEDGER binding missing' }, 500);
  let e;
  try { e = await readEventFull(env, id); } catch (err) { return json({ error: String(err && err.message || err) }, 500); }
  if (!e) return json({ error: 'event not found: ' + id }, 404);
  return json({
    id: e.id, ts: e.ts, source: e.source, key: e.key, route: e.route, actor: e.actor,
    action: e.action, direction: e.direction, status: e.status, trace_id: e.trace_id, step: e.step, parent: e.parent,
    in: redactPublicSecrets(parse(e.request_json), env), out: redactPublicSecrets(parse(e.response_json), env),
    links: { trace: `${BASE}/api/events?trace_id=${e.trace_id || ''}`, list: `${BASE}/api/events` }
  });
}
