// Ingest one agent turn from hooks or bridge wrappers into agent_turns.
// POST {agent, ts, session, trace_id, cwd, input_kind, user_input, assistant_text, tools, commands, files_changed, stdout, dispatch_key, source}
import { insertAgentTurn } from '../_lib/agent_turn_log.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  let r;
  try { r = await request.json(); } catch { return j({ error: 'bad json' }, 400); }
  if (!r.agent && !r.dispatch_key) return j({ error: 'agent or dispatch_key required' }, 400);
  try {
    const out = await insertAgentTurn(env, r);
    return j({ ok: true, agent: out.agent, id: out.id || null, deduped: !!out.deduped });
  } catch (e) { return j({ error: String(e && e.message || e) }, 500); }
}

function j(o, status) {
  return new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json' } });
}
