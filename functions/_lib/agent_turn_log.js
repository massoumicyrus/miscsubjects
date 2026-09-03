import { computeAgentTurnTags } from './agent_turn_flags.js';
import { buildNowIso, buildSinceIso } from './build_time.js';
import { logEvent } from './event_log.js';

const R2_CUTOFF = 10240;
const ASSIST_PREVIEW = 6000;
const INPUT_PREVIEW = 8000;

function preview(str, max) {
  const s = str == null ? '' : String(str);
  return s.length > max ? s.slice(0, max) : s;
}

async function sha256Hex(str) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str || '')));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

function agentFromDispatchKey(key) {
  const k = String(key || '');
  const map = {
    CLI_CLAUDE_CODE: 'claude',
    CLI_CODEX: 'codex',
    CLI_GROK_XAI: 'grok',
    CLI_GROK_SA: 'grok-sa',
    CLI_GEMINI: 'gemini',
    CLI_OPENAI: 'openai',
    CLI_AIDER: 'aider',
    CLI_PLANDEX: 'plandex',
    CLI_INTERPRETER: 'interpreter',
    CLI_GOOSE: 'goose',
    CLI_OPENHANDS: 'openhands',
    CLI_GH_COPILOT: 'copilot',
    CLI_KIMI: 'kimi',
  };
  if (map[k]) return map[k];
  if (k.startsWith('CLI_')) return k.slice(4).toLowerCase().replace(/_/g, '-');
  return null;
}

export function isCliAgentKey(key) {
  return !!agentFromDispatchKey(key);
}

export function cliActorForKey(key) {
  const a = agentFromDispatchKey(key);
  return a ? 'cli:' + a : null;
}

function cliLedgerSource(agent) {
  if (agent === 'grok') return 'grok-cli';
  if (agent === 'claude') return 'claude-code';
  if (agent === 'codex') return 'codex-cli';
  return 'cli-' + agent;
}

function traceForCliTurn(rec, agent, turnKey) {
  if (rec.trace_id) return String(rec.trace_id);
  if (turnKey) return 'gc_' + String(turnKey).replace(/:/g, '_').slice(0, 160);
  if (rec.session) return 'gc_' + String(rec.session).slice(0, 160);
  return 'gc_' + agent + '_' + Date.now();
}

/** Every CLI turn → two ledger events (IN user, OUT assistant), same as blooio in/out. */
async function logCliTurnToLedger(env, rec, agent, turnKey, rowId) {
  if (!env || !env.LEDGER) return;
  const trace = traceForCliTurn(rec, agent, turnKey);
  const ts = String(rec.ts || buildNowIso());
  const source = cliLedgerSource(agent);
  const key = rec.dispatch_key || ('CLI_' + String(agent || 'unknown').toUpperCase().replace(/-/g, '_'));
  const userRaw = rec.user_input != null ? String(rec.user_input) : '';
  const assistRaw = rec.assistant_text != null ? String(rec.assistant_text) : (rec.stdout != null ? String(rec.stdout) : '');
  const legacyId = rowId != null ? String(rowId) : (turnKey || null);
  const inputPointer = {
    path: rec.prompt_path || rec.user_input_path || rec.topic_path || null,
    sha256: rec.user_input_sha256 || rec.prompt_sha256 || null,
    chars: Number(rec.user_input_chars || userRaw.length || 0),
  };
  const assistantPointer = {
    path: rec.assistant_path || rec.stdout_path || rec.transcript_path || null,
    sha256: rec.assistant_sha256 || null,
    chars: Number(rec.assistant_chars || assistRaw.length || 0),
  };

  const hasTools = (rec.tools && rec.tools.length) || Number(rec.n_tools || 0) > 0;
  const hasFiles = (rec.files_changed && rec.files_changed.length) || (rec.files && rec.files.length);
  const hasCommands = (rec.commands && rec.commands.length);

  if (userRaw.trim()) {
    await logEvent(env, {
      ts,
      source,
      key,
      action: 'turn_in',
      direction: 'IN',
      route: '/api/agent_log',
      trace_id: trace,
      actor: agent,
      request: JSON.stringify({
        session: rec.session || null,
        cwd: rec.cwd || null,
        input_kind: rec.input_kind || 'human',
        turn_key: turnKey || null,
        text: userRaw,
        pointer: inputPointer.path || inputPointer.sha256 ? inputPointer : null,
      }),
      legacy_table: 'agent_turns',
      legacy_id: legacyId,
    });
  }
  if (assistRaw.trim() || hasTools || hasFiles || hasCommands) {
    await logEvent(env, {
      ts,
      source,
      key,
      action: 'turn_out',
      direction: 'OUT',
      route: '/api/agent_log',
      trace_id: trace,
      actor: agent,
      response: JSON.stringify({
        text: assistRaw,
        n_tools: Number(rec.n_tools || (rec.tools || []).length || 0),
        tools: rec.tools || [],
        files: rec.files_changed || rec.files || [],
        commands: rec.commands || [],
        pointer: assistantPointer.path || assistantPointer.sha256 ? assistantPointer : null,
      }),
      legacy_table: 'agent_turns',
      legacy_id: legacyId,
    });
  }
}

/** grok-cli / claude-cli token spend → LEDGER source=grok-cli action=spend */
async function logCliSpend(env, rec, agent, turnKey, rowId, trace) {
  if (!env || !env.LEDGER) return;
  const ticks = rec.cost_usd_ticks != null ? Number(rec.cost_usd_ticks) : null;
  const costUsd = rec.cost_usd != null ? Number(rec.cost_usd) : (ticks != null ? ticks / 1e10 : null);
  const peak = rec.context_tokens_peak != null ? Number(rec.context_tokens_peak) : null;
  const ti = rec.tokens_in != null ? Number(rec.tokens_in) : null;
  const to = rec.tokens_out != null ? Number(rec.tokens_out) : null;
  if (costUsd == null && ticks == null && peak == null && ti == null && to == null) return;
  await logEvent(env, {
    ts: String(buildNowIso()),
    source: cliLedgerSource(agent),
    key: 'CLI_SPEND',
    action: 'spend',
    direction: 'OUT',
    route: '/api/agent_log',
    trace_id: trace,
    actor: agent,
    request: JSON.stringify({
      turn_key: turnKey || null,
      session: rec.session || null,
      model_id: rec.model_id || null,
      legacy_table: 'agent_turns',
      legacy_id: rowId != null ? String(rowId) : null,
    }),
    response: JSON.stringify({
      model_id: rec.model_id || null,
      tokens_in: ti,
      tokens_out: to,
      context_tokens_peak: peak,
      cost_usd: costUsd,
      cost_usd_ticks: ticks,
      cost_estimated: rec.cost_estimated ? 1 : 0,
    }),
    legacy_table: 'agent_turns',
    legacy_id: rowId != null ? String(rowId) : null,
  });
}

export async function insertAgentTurn(env, r) {
  if (!env || !env.DB) throw new Error('no DB binding');
  const rec = r || {};
  const agent = String(rec.agent || agentFromDispatchKey(rec.dispatch_key) || 'unknown');
  const cliSource = cliLedgerSource(agent);
  const turnKey = rec.turn_key == null ? null : String(rec.turn_key);
  if (turnKey) {
    const dup = await env.DB.prepare(
      'SELECT id FROM agent_turns WHERE agent = ? AND turn_key = ? LIMIT 1'
    ).bind(agent, turnKey).first();
    if (dup) return { ok: true, agent, deduped: true, id: dup.id };
  }
  const rawUserInput = rec.user_input == null ? '' : String(rec.user_input);
  let assistant = rec.assistant_text != null ? String(rec.assistant_text) : '';
  if (!assistant && rec.stdout != null) assistant = String(rec.stdout);
  const assistantRaw = assistant;
  const userInputHash = rec.user_input_sha256 || rec.prompt_sha256 || (rawUserInput ? await sha256Hex(rawUserInput) : null);
  const assistantHash = rec.assistant_sha256 || (assistantRaw ? await sha256Hex(assistantRaw) : null);
  // Idempotency by CONTENT — the live CLI hook and the JSONL backfill log the same turn with
  // different (or absent) turn_keys; without this the same exchange lands twice. Dedup on the
  // exact input+assistant hashes so a re-ingest of the same turn is a no-op.
  if (userInputHash && assistantHash) {
    const dupContent = await env.DB.prepare(
      'SELECT id FROM agent_turns WHERE agent = ? AND user_input_sha256 = ? AND assistant_sha256 = ? LIMIT 1'
    ).bind(agent, userInputHash, assistantHash).first();
    if (dupContent) return { ok: true, agent, deduped: true, id: dupContent.id };
  }
  const promptPath = rec.prompt_path || rec.user_input_path || rec.topic_path || null;
  const assistantPath = rec.assistant_path || rec.stdout_path || rec.transcript_path || null;
  let r2Stdout = null;
  if (env.R2 && assistant.length > R2_CUTOFF) {
    const id = 'at_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    r2Stdout = 'agent_turns/' + id + '.txt';
    try {
      await env.R2.put(r2Stdout, assistant);
      assistant = assistant.slice(0, ASSIST_PREVIEW) + '\n…[truncated → R2:' + r2Stdout + ']';
    } catch {
      r2Stdout = null;
      assistant = preview(assistant, ASSIST_PREVIEW);
    }
  } else {
    assistant = preview(assistant, ASSIST_PREVIEW);
  }
  const userInput = preview(rawUserInput, INPUT_PREVIEW);
  const tags = computeAgentTurnTags({ ...rec, agent });
  const traceId = traceForCliTurn(rec, agent, turnKey);
  const baseBind = [
    String(rec.ts || buildNowIso()),
    agent,
    String(['dispatch', 'spawn', 'verify', 'import', 'backfill'].includes(String(rec.source || '')) ? rec.source : (cliSource || rec.source || 'hook')),
    rec.session == null ? null : String(rec.session),
    traceId,
    rec.cwd == null ? null : String(rec.cwd),
    String(rec.input_kind || 'human'),
    userInput,
    Number(rec.user_input_chars || userInput.length || 0),
    assistant,
    // THE LEDGER BLINDNESS, AT ITS SOURCE.
    //
    // This was Number(rec.n_tools || 0). A caller that sends the tools array and no separate count —
    // which every misc turn does — stored a populated tools_json beside n_tools 0, so the ledger
    // recorded that a turn happened and not what it did. 152 turns were in that state, and four
    // model comments across three articles named it as the defect that breaks inheritance: the next
    // model cannot read what the last one used. The count is derivable from the array being written
    // on the very next line, and the tag path above was already deriving it exactly this way. One
    // expression did it and the other did not.
    Number(rec.n_tools || (rec.tools || []).length || 0),
    JSON.stringify(rec.tools || []),
    JSON.stringify(rec.commands || []),
    JSON.stringify(rec.files_changed || rec.files || []),
    r2Stdout,
    rec.dispatch_key == null ? null : String(rec.dispatch_key),
    turnKey,
    JSON.stringify(tags),
    userInputHash,
    assistantHash,
    promptPath == null ? null : String(promptPath),
    assistantPath == null ? null : String(assistantPath),
  ];
  let ins;
  const hasUsage = rec.model_id != null || rec.tokens_in != null || rec.tokens_out != null
    || rec.context_tokens_peak != null || rec.cost_usd != null || rec.cost_usd_ticks != null;
  if (hasUsage) {
    try {
      ins = await env.DB.prepare(
        `INSERT INTO agent_turns
         (ts, agent, source, session, trace_id, cwd, input_kind, user_input, user_input_chars,
          assistant_text, n_tools, tools_json, commands_json, files_json, r2_stdout_key, dispatch_key,
          turn_key, tags_json, user_input_sha256, assistant_sha256, prompt_path, assistant_path,
          model_id, tokens_in, tokens_out, context_tokens_peak, cost_usd, cost_usd_ticks, cost_estimated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        ...baseBind,
        rec.model_id == null ? null : String(rec.model_id),
        rec.tokens_in == null ? null : Number(rec.tokens_in),
        rec.tokens_out == null ? null : Number(rec.tokens_out),
        rec.context_tokens_peak == null ? null : Number(rec.context_tokens_peak),
        rec.cost_usd == null ? null : Number(rec.cost_usd),
        rec.cost_usd_ticks == null ? null : Number(rec.cost_usd_ticks),
        rec.cost_estimated ? 1 : 0,
      ).run();
    } catch {
      ins = null;
    }
  }
  if (!ins) {
    ins = await env.DB.prepare(
      `INSERT INTO agent_turns
       (ts, agent, source, session, trace_id, cwd, input_kind, user_input, user_input_chars,
        assistant_text, n_tools, tools_json, commands_json, files_json, r2_stdout_key, dispatch_key,
        turn_key, tags_json, user_input_sha256, assistant_sha256, prompt_path, assistant_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(...baseBind).run();
  }
  const rowId = ins && ins.meta && ins.meta.last_row_id != null ? ins.meta.last_row_id : null;
  await logCliTurnToLedger(env, rec, agent, turnKey, rowId);
  await logCliSpend(env, rec, agent, turnKey, rowId, traceId);
  try {
    const { onCliTurnComplete } = await import("./article_automation.js");
    await onCliTurnComplete(env, { agent, session: rec.session, turn_key: turnKey });
  } catch {}
  return { ok: true, agent, tags, id: rowId, trace_id: traceId };
}

/** Idempotent: write turn_in/turn_out ledger events for agent_turns rows missing them. */
export async function syncCliTurnsToLedger(env, opts = {}) {
  if (!env || !env.LEDGER || !env.DB) return { synced: 0, error: 'missing bindings' };
  const agent = String(opts.agent || 'grok');
  const limit = Math.min(parseInt(opts.limit || '800', 10) || 800, 5000);
  const r = await env.DB.prepare(
    `SELECT id, ts, agent, session, cwd, input_kind, user_input, assistant_text, n_tools,
            tools_json, commands_json, files_json, dispatch_key, turn_key,
            user_input_sha256, assistant_sha256, prompt_path, assistant_path
     FROM agent_turns WHERE agent = ? ORDER BY id DESC LIMIT ?`
  ).bind(agent, limit).all();
  let synced = 0;
  for (const row of (r.results || [])) {
    const legacyId = String(row.id);
    const exists = await env.LEDGER.prepare(
      `SELECT id FROM events WHERE legacy_table = ? AND legacy_id = ? AND action = ? LIMIT 1`
    ).bind('agent_turns', legacyId, 'turn_in').first();
    if (exists) continue;
    let tools = [];
    let commands = [];
    let files = [];
    try { tools = JSON.parse(row.tools_json || '[]'); } catch {}
    try { commands = JSON.parse(row.commands_json || '[]'); } catch {}
    try { files = JSON.parse(row.files_json || '[]'); } catch {}
    await logCliTurnToLedger(env, {
      ts: row.ts,
      session: row.session,
      cwd: row.cwd,
      input_kind: row.input_kind,
      user_input: row.user_input,
      assistant_text: row.assistant_text,
      n_tools: row.n_tools,
      tools,
      commands,
      files_changed: files,
      dispatch_key: row.dispatch_key,
      turn_key: row.turn_key,
      user_input_sha256: row.user_input_sha256,
      assistant_sha256: row.assistant_sha256,
      prompt_path: row.prompt_path,
      assistant_path: row.assistant_path,
    }, agent, row.turn_key, row.id);
    synced++;
  }
  return { ok: true, agent, scanned: (r.results || []).length, synced };
}

export async function logAgentTurnFromDispatch(env, key, body, result, trace) {
  const agent = agentFromDispatchKey(key);
  if (!agent) return null;
  try {
    const text = String(result == null ? '' : result);
    let assistant = text;
    let userInput = String(body == null ? '' : body);
    if (text.startsWith('HTTP ') && text.includes(':')) {
      const idx = text.indexOf(':');
      assistant = text.slice(idx + 1);
    }
    if (assistant.startsWith('{')) {
      try {
        const j = JSON.parse(assistant);
        if (j && typeof j === 'object') {
          if (j.stdout) assistant = String(j.stdout);
          if (j.stderr && !assistant) assistant = String(j.stderr);
        }
      } catch {}
    }
    const parts = userInput.split('|');
    if (parts.length > 1 && key.startsWith('CLI_')) userInput = parts[0];
    return await insertAgentTurn(env, {
      agent,
      source: 'dispatch',
      trace_id: trace || null,
      user_input: userInput,
      assistant_text: assistant,
      dispatch_key: key,
      input_kind: 'dispatch',
      n_tools: 0,
    });
  } catch {
    return null;
  }
}
