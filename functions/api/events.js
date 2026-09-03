// EVENTS API — every input in & output out, as clean JSON, each with a link.
//   GET /api/events                  -> latest events (preview of in/out + link to full)
//   filters: ?source ?key ?trace_id ?direction ?action ?actor ?route ?q ?limit (<=500)
//   GET /api/events/<id>             -> the FULL request + response (in & out)  [events/[id].js]
const BASE = 'https://miscsubjects.com';
import { redactPublicSecrets } from '../_lib/public_secret_guard.js';
import { isBuildAuthed } from '../_lib/admin_session.js';
function json(o, s = 200) { return new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } }); }

export async function onRequestGet(context) {
  const { env, request } = context;
  if (!(await isBuildAuthed(request, env))) return json({ error: 'not_found' }, 404);
  if (!env.LEDGER) return json({ error: 'LEDGER binding missing', count: 0, events: [] }, 500);
  const p = new URL(request.url).searchParams;
  const limit = Math.min(parseInt(p.get('limit') || '50', 10) || 50, 500);
  const where = [], binds = [];
  for (const f of ['source', 'key', 'trace_id', 'direction', 'action', 'actor', 'route']) {
    const v = p.get(f); if (v) { where.push(`${f} = ?`); binds.push(v); }
  }
  if (p.get('q')) { const q = '%' + p.get('q') + '%'; where.push('(request_preview LIKE ? OR response_preview LIKE ?)'); binds.push(q, q); }
  const sql = 'SELECT id, ts, source, key, route, actor, action, direction, status, trace_id, step, ' +
    'request_preview, response_preview, request_size, response_size FROM events' +
    (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY ts DESC LIMIT ?';
  binds.push(limit);
  let r;
  try { r = await env.LEDGER.prepare(sql).bind(...binds).all(); }
  catch (e) { return json({ error: String(e && e.message || e), count: 0, events: [] }, 500); }
  const events = (r.results || []).map(e => ({
    id: e.id, ts: e.ts, source: e.source, key: e.key, route: e.route, actor: e.actor,
    action: e.action, direction: e.direction, status: e.status, trace_id: e.trace_id, step: e.step,
    in: redactPublicSecrets(e.request_preview, env), out: redactPublicSecrets(e.response_preview, env),
    request_size: e.request_size, response_size: e.response_size,
    truncated: (e.request_size > 500 || e.response_size > 500),
    links: { full: `${BASE}/api/events/${e.id}`, trace: `${BASE}/api/events?trace_id=${e.trace_id || ''}` }
  }));
  return json({ count: events.length, limit, events });
}
