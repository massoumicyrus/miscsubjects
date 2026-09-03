// CLI Agent Team Room — agents debate a topic in a shared transcript.
// POST { topic, agents?, cwd?, mode?, delivery?, trace_id? }
import { runCliAgentGroup } from '../_lib/cli_agent_group.js';
import { SPAWN_AGENTS } from '../_lib/cli_agent_spawn.js';
import { insertAgentTurn } from '../_lib/agent_turn_log.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return j({ error: 'bad json' }, 400); }
  const topic = body.topic || body.prompt || body.task || body.query;
  if (!topic) return j({ error: 'topic required' }, 400);
  try {
    const out = await runCliAgentGroup(env, {
      topic,
      agents: body.agents,
      cwd: body.cwd,
      mode: body.mode || (body.readonly ? 'readonly' : 'readonly'),
      delivery: body.delivery || (body.terminal === true ? 'terminal' : 'headless'),
      trace_id: body.trace_id,
    });
    try {
      await insertAgentTurn(env, {
        agent: 'cli-group',
        source: 'group',
        trace_id: out.trace_id,
        cwd: body.cwd,
        user_input: topic,
        assistant_text: out.stdout,
        prompt_path: out.group?.topic_path || null,
        assistant_path: out.group?.transcript_path || null,
        session: out.group?.group_id || null,
        dispatch_key: 'CLI_GROUP',
        input_kind: 'group',
        turn_key: 'group:' + (out.group?.group_id || Date.now()),
        n_tools: 0,
      });
    } catch {}
    return j({ ok: out.ok, ...out });
  } catch (e) {
    return j({ error: String(e && e.message || e) }, 500);
  }
}

export async function onRequestGet() {
  return j({
    name: 'CLI Agent Team Room',
    agents: Object.keys(SPAWN_AGENTS),
    default_team: ['kimi', 'gemini', 'codex'],
    usage: {
      post: '{ topic, agents?: "kimi,gemini,codex", cwd?, mode?: readonly|auto, delivery?: headless|terminal }',
      dispatch: '[CLI_GROUP]agents|topic|cwd|mode|delivery[/CLI_GROUP]',
      example: 'POST /api/agent_group {"topic":"superior solutions for agent_turn logging","agents":["kimi","gemini","codex"],"delivery":"terminal"}',
    },
  });
}

function j(o, status) {
  return new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json' } });
}
