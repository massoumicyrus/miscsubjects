// Ingest one Claude Code turn from the Stop hook (~/.claude/cc-turn-log.js) into cc_turns + agent_turns.
// POST {ts, session, cwd, user_input, user_input_chars, n_tools, tools, commands, files_changed, trace_id}
import { insertAgentTurn } from '../_lib/agent_turn_log.js';

import { buildNowIso, buildSinceIso } from '../_lib/build_time.js';
export async function onRequestPost(context) {
  const { request, env } = context;
  let r;
  try { r = await request.json(); } catch { return j({ error: 'bad json' }, 400); }
  try {
    await env.DB.prepare(
      `INSERT INTO cc_turns (ts, session, cwd, input_kind, user_input, user_input_chars, assistant_text, n_tools, tools_json, commands_json, files_json, system_prompt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      String(buildNowIso()),
      String(r.session || ''),
      String(r.cwd || ''),
      String(r.input_kind || 'human'),
      String(r.user_input || '').slice(0, 8000),
      Number(r.user_input_chars || 0),
      String(r.assistant_text || '').slice(0, 6000),
      Number(r.n_tools || 0),
      JSON.stringify(r.tools || []),
      JSON.stringify(r.commands || []),
      JSON.stringify(r.files_changed || []),
      r.system_prompt == null ? null : String(r.system_prompt).slice(0, 60000)
    ).run();
    try {
      await insertAgentTurn(env, {
        ...r,
        agent: 'claude',
        source: 'hook',
        dispatch_key: 'CLI_CLAUDE_CODE',
        files_changed: r.files_changed,
        n_tools: Number(r.n_tools || 0),
      });
    } catch {}
    return j({ ok: true });
  } catch (e) { return j({ error: String(e && e.message || e) }, 500); }
}
function j(o, status) { return new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json' } }); }
