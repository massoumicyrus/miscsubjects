// Manual issue reflex trigger. POST { brief, agents?, cwd?, mode?, delivery?, fingerprint? }
import { triggerIssueReflex } from '../_lib/issue_reflex.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return j({ error: 'bad json' }, 400); }
  const brief = body.brief || body.topic || body.prompt;
  if (!brief) return j({ error: 'brief required' }, 400);
  try {
    const out = await triggerIssueReflex(env, {
      brief,
      agents: body.agents,
      cwd: body.cwd,
      mode: body.mode || 'readonly',
      delivery: body.delivery || 'headless',
      fingerprint: body.fingerprint || null,
      trace_id: body.trace_id,
      source: body.source || 'api',
    });
    return j(out);
  } catch (e) {
    return j({ error: String(e && e.message || e) }, 500);
  }
}

export async function onRequestGet() {
  return j({
    name: 'Issue reflex',
    auto_triggers: ['selftest run complete with failures', 'owner blooio message matching build/code heuristics'],
    post: '{ brief, agents?: "kimi,codex", mode?: readonly, delivery?: headless }',
    dispatch: '[CLI_REFLEX]brief|agents|cwd|mode|delivery[/CLI_REFLEX]',
  });
}

function j(o, s) {
  return new Response(JSON.stringify(o, null, 2), { status: s || 200, headers: { 'content-type': 'application/json' } });
}