// CLI Agent Team Room — multi-agent transcript discussion via Mac bridge.
import { SPAWN_AGENTS } from './cli_agent_spawn.js';

const BRIDGE = 'https://agent.cannibal.capital/exec';
const GROUP_SCRIPT = '/Users/owner/miscsubjects-pages/hooks/cli-agent-group.sh';
const DEFAULT_CWD = '/Users/owner/miscsubjects-pages';
const DEFAULT_AGENTS = ['kimi', 'gemini', 'codex'];
const TIMEOUT = 3600000;

export function normalizeGroupAgents(agents) {
  if (!agents) return DEFAULT_AGENTS;
  if (Array.isArray(agents)) return agents.map((a) => String(a).toLowerCase().trim()).filter(Boolean);
  return String(agents).split(/[,|]/).map((a) => a.toLowerCase().trim()).filter(Boolean);
}

export function buildGroupBridgeBody({ topic, agents, cwd, mode, delivery, trace_id }) {
  const list = normalizeGroupAgents(agents);
  for (const a of list) {
    if (!SPAWN_AGENTS[a]) throw new Error('unknown agent in team: ' + a);
  }
  const m = String(mode || 'readonly').toLowerCase();
  const d = String(delivery || 'headless').toLowerCase();
  if (!['readonly', 'auto', 'plan'].includes(m)) throw new Error('mode must be readonly|auto|plan');
  if (!['headless', 'terminal'].includes(d)) throw new Error('delivery must be headless|terminal');
  const body = {
    cmd: 'bash',
    args: [GROUP_SCRIPT, list.join(','), cwd || DEFAULT_CWD, m, d],
    cwd: cwd || DEFAULT_CWD,
    stdin: String(topic || ''),
    timeout: TIMEOUT,
  };
  if (trace_id) body.trace_id = String(trace_id);
  return { agents: list, body };
}

export function parseGroupResult(bridgeJson) {
  const out = bridgeJson || {};
  const text = String(out.stdout || '') + '\n' + String(out.stderr || '');
  let groupMeta = null;
  const line = text.split('\n').reverse().find((l) => l.includes('GROUP_JSON:'));
  if (line) {
    try { groupMeta = JSON.parse(line.replace(/^.*GROUP_JSON:/, '')); } catch {}
  }
  return {
    ok: !!out.ok || !!groupMeta?.ok,
    exit: out.exit,
    duration_ms: out.duration_ms,
    stdout: String(out.stdout || '').slice(0, 16000),
    stderr: String(out.stderr || '').slice(0, 4000),
    group: groupMeta,
  };
}

export async function runCliAgentGroup(env, opts) {
  const { topic, agents, cwd, mode, delivery, trace_id } = opts || {};
  if (!topic || !String(topic).trim()) throw new Error('topic required');
  const built = buildGroupBridgeBody({ topic, agents, cwd, mode, delivery, trace_id });
  const headers = { 'content-type': 'application/json' };
  if (env && env.TERMINAL_KEY) headers['x-terminal-key'] = env.TERMINAL_KEY;
  if (trace_id) headers['x-trace-id'] = String(trace_id);
  const resp = await fetch(BRIDGE, { method: 'POST', headers, body: JSON.stringify(built.body) });
  const j = await resp.json().catch(() => ({}));
  const parsed = parseGroupResult(j);
  return { ...parsed, trace_id: trace_id || null, agents: built.agents, dispatch_key: 'CLI_GROUP' };
}