// Spawn a coding CLI agent on the Mac (new session). POST {agent, prompt, cwd?, mode?, delivery?, trace_id?}
// mode: readonly|auto|plan — readonly uses plan/sandbox where supported
// delivery: headless|terminal — terminal opens a new Terminal.app tab
import { spawnCliAgent, SPAWN_AGENTS } from '../_lib/cli_agent_spawn.js';
import { insertAgentTurn } from '../_lib/agent_turn_log.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return j({ error: 'bad json' }, 400); }
  const prompt = body.prompt || body.task || body.query;
  if (!prompt) return j({ error: 'prompt required' }, 400);
  if (!body.agent) return j({ error: 'agent required', agents: Object.keys(SPAWN_AGENTS) }, 400);
  try {
    const out = await spawnCliAgent(env, {
      agent: body.agent,
      prompt,
      cwd: body.cwd,
      mode: body.mode || (body.readonly ? 'readonly' : 'auto'),
      delivery: body.delivery || (body.terminal === true ? 'terminal' : 'headless'),
      trace_id: body.trace_id,
    });
    try {
      await insertAgentTurn(env, {
        agent: out.agent,
        source: 'spawn',
        trace_id: out.trace_id,
        cwd: body.cwd,
        user_input: prompt,
        assistant_text: out.stdout,
        session: out.session,
        dispatch_key: out.dispatch_key,
        input_kind: 'spawn',
        turn_key: 'spawn:' + (out.spawn?.run_id || Date.now()),
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
    agents: SPAWN_AGENTS,
    usage: {
      post: '{ agent, prompt, cwd?, mode?: readonly|auto, delivery?: headless|terminal, trace_id? }',
      dispatch: '[CLI_SPAWN]agent|prompt|cwd|mode[/CLI_SPAWN]',
      example: 'POST /api/agent_spawn {"agent":"kimi","mode":"readonly","prompt":"audit the build end-to-end, read only"}',
    },
  });
}

function j(o, status) {
  return new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json' } });
}