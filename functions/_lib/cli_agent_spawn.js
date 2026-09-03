// Cross-agent CLI spawn — headless or interactive Mac sessions via bridge /exec.
import { logEvent } from './event_log.js';
import { insertAgentTurn } from './agent_turn_log.js';

const BRIDGE = 'https://agent.cannibal.capital/exec';
const SPAWN_SCRIPT = '/Users/owner/miscsubjects-pages/hooks/cli-agent-spawn.sh';
const DEFAULT_CWD = '/Users/owner/miscsubjects-pages';
const TIMEOUT = 1200000;

export const SPAWN_AGENTS = {
  kimi: { label: 'Kimi Code', dispatchKey: 'CLI_KIMI' },
  gemini: { label: 'Gemini CLI', dispatchKey: 'CLI_GEMINI' },
  codex: { label: 'Codex', dispatchKey: 'CLI_CODEX' },
  grok: { label: 'Grok CLI', dispatchKey: 'CLI_GROK_XAI' },
  'grok-sa': { label: 'Grok superagent', dispatchKey: 'CLI_GROK_SA' },
  claude: { label: 'Claude Code', dispatchKey: 'CLI_CLAUDE_CODE' },
  aider: { label: 'Aider', dispatchKey: 'CLI_AIDER' },
};

export function normalizeSpawnAgent(agent) {
  const a = String(agent || '').toLowerCase().trim().replace(/_/g, '-');
  if (a === 'grok-xai' || a === 'grok-cli') return 'grok';
  if (a === 'grok-sa' || a === 'superagent') return 'grok-sa';
  if (a === 'claude-code' || a === 'claude') return 'claude';
  return a;
}

export function buildSpawnBridgeBody({ agent, prompt, cwd, mode, delivery, trace_id, timeout_ms }) {
  const a = normalizeSpawnAgent(agent);
  if (!SPAWN_AGENTS[a]) throw new Error('unknown agent: ' + agent);
  const m = String(mode || 'auto').toLowerCase();
  const d = String(delivery || 'headless').toLowerCase();
  if (!['readonly', 'auto', 'plan'].includes(m)) throw new Error('mode must be readonly|auto|plan');
  if (!['headless', 'terminal', 'async'].includes(d)) throw new Error('delivery must be headless|terminal|async');
  const timeout = Math.min(Math.max(parseInt(timeout_ms || TIMEOUT, 10) || TIMEOUT, 15000), TIMEOUT);
  const writeLaw = 'WRITE LAW (mandatory): before editing ANY repo file, claim it — GET https://miscsubjects.com/api/dispatch?invoke=FILE_CLAIM&body=claim|<path>|' + a + ':<your-session>|90 — and release it when done. DENIED means another session holds it: read fresh and coordinate, do not edit. Unclaimed multi-editing is reported to the governor.\n\n';
  const body = {
    cmd: 'bash',
    args: [SPAWN_SCRIPT, a, cwd || DEFAULT_CWD, m, d],
    cwd: cwd || DEFAULT_CWD,
    stdin: writeLaw + String(prompt || ''),
    timeout,
  };
  if (trace_id) body.trace_id = String(trace_id);
  return { agent: a, dispatchKey: SPAWN_AGENTS[a].dispatchKey, body };
}

export function parseSpawnResult(agent, bridgeJson) {
  const a = normalizeSpawnAgent(agent);
  const out = bridgeJson || {};
  const text = String(out.stdout || '') + '\n' + String(out.stderr || '');
  let session = null;
  const patterns = [
    /To resume this session:\s*kimi\s+-[rS]\s+(session_[a-f0-9-]+)/i,
    /session[_-]([a-f0-9-]{8,})/i,
    /"sessionId"\s*:\s*"([^"]+)"/,
  ];
  for (const rx of patterns) {
    const m = text.match(rx);
    if (m) { session = m[1].startsWith('session_') ? m[1] : m[1]; break; }
  }
  let spawnMeta = null;
  const metaLine = text.split('\n').find((l) => l.includes('AGENT_SPAWN_JSON:'));
  if (metaLine) {
    try { spawnMeta = JSON.parse(metaLine.replace(/^.*AGENT_SPAWN_JSON:/, '')); } catch {}
  }
  return {
    ok: !!out.ok,
    agent: a,
    session: spawnMeta?.session || session,
    delivery: spawnMeta?.delivery || 'headless',
    mode: spawnMeta?.mode || 'auto',
    exit: out.exit,
    duration_ms: out.duration_ms,
    stdout: String(out.stdout || '').slice(0, 12000),
    stderr: String(out.stderr || '').slice(0, 4000),
    spawn: spawnMeta,
  };
}

export async function spawnCliAgent(env, opts) {
  const { agent, prompt, cwd, mode, delivery, trace_id, timeout_ms } = opts || {};
  if (!prompt || !String(prompt).trim()) throw new Error('prompt required');
  const built = buildSpawnBridgeBody({ agent, prompt, cwd, mode, delivery, trace_id, timeout_ms });
  const headers = { 'content-type': 'application/json' };
  if (env && env.TERMINAL_KEY) headers['x-terminal-key'] = env.TERMINAL_KEY;
  if (trace_id) headers['x-trace-id'] = String(trace_id);
  const resp = await fetch(BRIDGE, { method: 'POST', headers, body: JSON.stringify(built.body) });
  const j = await resp.json().catch(() => ({}));
  const parsed = parseSpawnResult(built.agent, j);
  const d = String(delivery || 'headless').toLowerCase();
  const result = { ...parsed, status: parsed.spawn?.status || (d === 'async' ? 'running' : 'done'), trace_id: trace_id || null, dispatch_key: built.dispatchKey };
  await logEvent(env, {
    source: 'cli-spawn', key: built.dispatchKey, action: 'spawn', direction: 'out',
    status: resp.status, trace_id: trace_id || null, actor: built.agent,
    request: { url: BRIDGE, method: 'POST', headers: { 'x-terminal-key': '<REDACTED>' }, body: built.body },
    response: result,
  });

  // Assemble slave turn into shared ledger so codex/grok/kimi/etc spawns are visible in agent_turns (humanoid sync).
  try {
    await insertAgentTurn(env, {
      agent: built.agent,
      source: 'cli-spawn',
      dispatch_key: built.dispatchKey,
      ts: new Date().toISOString(),
      session: parsed.session || trace_id || null,
      cwd: cwd || DEFAULT_CWD,
      input_kind: 'human',
      user_input: String(prompt || '').slice(0, 8000),
      assistant_text: String(parsed.stdout || parsed.stderr || '').slice(0, 6000),
      n_tools: 0,
      tools_json: '[]',
      commands_json: '[]',
      files_json: '[]',
      trace_id: trace_id || null,
    });
  } catch (e) {
    // best effort; do not break spawn
  }

  return result;
}