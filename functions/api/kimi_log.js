// Ingest one Kimi CLI turn from the Stop hook (hooks/kimi-turn-log.js) into kimi_turns + agent_turns.
// POST {ts, session, cwd, user_input, user_input_chars, n_tools, tools, commands, files_changed, trace_id, turn_key, input_kind, assistant_text}
import { insertAgentTurn } from '../_lib/agent_turn_log.js';
import { buildNowIso } from '../_lib/build_time.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  let r;
  try { r = await request.json(); } catch { return j({ error: 'bad json' }, 400); }
  try {
    const turnKey = r.turn_key == null ? null : String(r.turn_key);
    if (turnKey) {
      const dup = await env.DB.prepare('SELECT id FROM kimi_turns WHERE turn_key = ? LIMIT 1').bind(turnKey).first();
      if (dup) {
        try {
          await insertAgentTurn(env, {
            ...r,
            agent: 'kimi',
            source: 'hook',
            dispatch_key: 'CLI_KIMI',
            files_changed: r.files_changed,
            n_tools: Number(r.n_tools || 0),
          });
        } catch {}
        return j({ ok: true, deduped: true, id: dup.id });
      }
    }
    const ins = await env.DB.prepare(
      `INSERT INTO kimi_turns (ts, session, cwd, input_kind, user_input, user_input_chars, assistant_text, n_tools, tools_json, commands_json, files_json, system_prompt, turn_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      r.system_prompt == null ? null : String(r.system_prompt).slice(0, 60000),
      turnKey
    ).run();
    try {
      await insertAgentTurn(env, {
        ...r,
        agent: 'kimi',
        source: 'hook',
        dispatch_key: 'CLI_KIMI',
        files_changed: r.files_changed,
        n_tools: Number(r.n_tools || 0),
      });
    } catch {}
    return j({ ok: true, id: ins && ins.meta && ins.meta.last_row_id });
  } catch (e) { return j({ error: String(e && e.message || e) }, 500); }
}

function j(o, status) {
  return new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json' } });
}
