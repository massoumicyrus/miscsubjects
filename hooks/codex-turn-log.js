#!/usr/bin/env node
// Codex lifecycle capture + historical backfill from ~/.codex/sessions/**/rollout-*.jsonl.
// Every user turn becomes one agent_turns row, grouped by Codex session and carrying model,
// token usage, tools, commands, files, and the final assistant output.
// Test:     node hooks/codex-turn-log.js --test <rollout.jsonl>
// Backfill: node hooks/codex-turn-log.js --backfill
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { readStdin, loadDedup, saveDedup, postRecord, shouldSkip, markDone } = require('./_lib/agent-turn-common.js');

const CODEX_DIR = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const DEDUP_FILE = path.join(os.homedir(), '.miscsubjects', 'codex_turn_dedup.json');

function textOf(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((x) => x?.text || x?.content || '').join('\n');
  return value == null ? '' : JSON.stringify(value);
}

function parseToolInput(item) {
  const raw = typeof item.input === 'string' ? item.input : (item.arguments || '');
  let args = {};
  try { args = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch {}
  let name = String(item.name || 'tool');
  const nested = String(raw || '').match(/tools\.([a-zA-Z0-9_]+)/);
  if (name === 'exec' && nested) name = nested[1];
  let summary = args.cmd || args.command || args.path || args.file_path || '';
  if (!summary && name === 'exec_command') {
    const cmd = String(raw || '').match(/cmd\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (cmd) { try { summary = JSON.parse('"' + cmd[1] + '"'); } catch { summary = cmd[1]; } }
  }
  if (!summary) summary = String(raw || '').slice(0, 900);
  return { name, summary: String(summary).slice(0, 1000), raw: String(raw || '') };
}

function extractFiles(raw, summary, name) {
  const out = [];
  const s = String(raw || '') + '\n' + String(summary || '');
  const pathPatterns = [
    /(?:path|file_path)\s*[:=]\s*["']([^"']+)["']/g,
    /^\*{3} (?:Add|Update|Delete) File: (.+)$/gm,
  ];
  for (const re of pathPatterns) {
    let m;
    while ((m = re.exec(s))) if (m[1] && !m[1].includes('\n')) out.push(m[1]);
  }
  if (/apply_patch|edit|write/i.test(name) && summary.startsWith('/')) out.push(summary);
  return out;
}

function extractTurns(lines, source = 'hook') {
  let session = 'unknown';
  let cwd = '';
  let originator = '';
  let cliVersion = '';
  let pendingContext = {};
  let current = null;
  const turns = [];

  function finish() {
    if (!current || !current.user_input.trim()) return;
    for (const tool of current.tools) {
      if (current.results.has(tool.call_id)) tool.result = current.results.get(tool.call_id).slice(0, 500);
      delete tool.call_id;
    }
    const assistant = current.assistant.length ? current.assistant : current.agentMessages;
    turns.push({
      agent: 'codex', source, dispatch_key: 'CLI_CODEX', ts: current.ts,
      session, cwd: current.cwd || cwd, input_kind: 'human',
      user_input: current.user_input.slice(0, 8000), user_input_chars: current.user_input.length,
      assistant_text: assistant.join('\n').trim().slice(0, 6000),
      n_tools: current.tools.length, tools: current.tools,
      commands: current.commands.slice(0, 50), files_changed: [...current.files],
      turn_key: current.turn_key,
      model_id: current.model || null,
      tokens_in: current.tokensIn || null,
      tokens_out: current.tokensOut || null,
      context_tokens_peak: current.contextPeak || null,
      trace_id: 'codex_' + session + '_' + current.turn_key,
      runtime: { originator, cli_version: cliVersion },
    });
  }

  for (const line of lines) {
    let ev; try { ev = typeof line === 'string' ? JSON.parse(line) : line; } catch { continue; }
    const p = ev.payload || {};
    if (ev.type === 'session_meta') {
      session = p.id || p.session_id || session;
      cwd = p.cwd || cwd;
      originator = p.originator || originator;
      cliVersion = p.cli_version || cliVersion;
      continue;
    }
    if (ev.type === 'turn_context') {
      pendingContext = { turn_id: p.turn_id || '', model: p.model || '', cwd: p.cwd || cwd };
      if (current) {
        current.model = p.model || current.model;
        current.cwd = p.cwd || current.cwd;
      }
      continue;
    }
    if (ev.type === 'event_msg' && p.type === 'user_message') {
      finish();
      const key = p.client_id || p.turn_id || ev.timestamp || String(turns.length + 1);
      current = {
        ts: ev.timestamp || new Date().toISOString(), turn_key: String(key),
        user_input: String(p.message || ''), cwd: pendingContext.cwd || cwd,
        model: pendingContext.model || '', assistant: [], agentMessages: [], tools: [],
        commands: [], files: new Set(), results: new Map(), tokensIn: 0, tokensOut: 0, contextPeak: 0,
      };
      continue;
    }
    if (!current) continue;
    if (ev.type === 'event_msg' && p.type === 'agent_message' && p.message) {
      current.agentMessages.push(String(p.message));
    }
    if (ev.type === 'event_msg' && p.type === 'token_count' && p.info?.last_token_usage) {
      const u = p.info.last_token_usage;
      current.tokensIn += Number(u.input_tokens || 0);
      current.tokensOut += Number(u.output_tokens || 0);
      current.contextPeak = Math.max(current.contextPeak, Number(u.total_tokens || 0));
    }
    if (ev.type !== 'response_item') continue;
    if (p.type === 'message' && p.role === 'assistant') {
      for (const c of (p.content || [])) if (c.type === 'output_text' && c.text) current.assistant.push(c.text);
      continue;
    }
    if (p.type === 'custom_tool_call' || p.type === 'function_call') {
      const parsed = parseToolInput(p);
      const callId = p.call_id || p.id || ('tool_' + current.tools.length);
      current.tools.push({ call_id: callId, name: parsed.name, summary: parsed.summary, result: '' });
      if (parsed.name === 'exec_command' && parsed.summary) current.commands.push(parsed.summary);
      for (const file of extractFiles(parsed.raw, parsed.summary, parsed.name)) current.files.add(file);
      continue;
    }
    if (p.type === 'custom_tool_call_output' || p.type === 'function_call_output') {
      current.results.set(p.call_id || p.id || '', textOf(p.output).slice(0, 500));
    }
  }
  finish();
  return turns;
}

function latestRollout() {
  try {
    const dbs = fs.readdirSync(CODEX_DIR).filter((f) => /^state_.*\.sqlite$/.test(f))
      .map((f) => path.join(CODEX_DIR, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    for (const db of dbs) {
      const found = execSync(`sqlite3 "${db}" "SELECT rollout_path FROM threads WHERE archived = 0 ORDER BY updated_at DESC, recency_at DESC LIMIT 1;"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (found && fs.existsSync(found)) return found;
    }
  } catch {}
  return null;
}

function allRollouts(dir) {
  const out = [];
  function walk(p) {
    let entries = [];
    try { entries = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) walk(full);
      else if (/^rollout-.*\.jsonl$/.test(e.name)) out.push(full);
    }
  }
  walk(dir);
  return out.sort();
}

async function postMany(records, concurrency = 8) {
  let posted = 0, deduped = 0, failed = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < records.length) {
      const rec = records[cursor++];
      try {
        const res = await fetch(process.env.MISC_AGENT_LOG_URL || 'https://miscsubjects.com/api/agent_log', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rec),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) failed++; else if (body.deduped) deduped++; else posted++;
      } catch { failed++; }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { records: records.length, posted, deduped, failed };
}

async function main() {
  const testAt = process.argv.indexOf('--test');
  if (testAt > -1) {
    const file = process.argv[testAt + 1];
    const turns = extractTurns(fs.readFileSync(file, 'utf8').trim().split('\n'), 'backfill');
    console.log(JSON.stringify(turns, null, 2));
    return;
  }
  if (process.argv.includes('--backfill')) {
    const records = [];
    for (const file of allRollouts(path.join(CODEX_DIR, 'sessions'))) {
      const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
      records.push(...extractTurns(lines, 'backfill'));
    }
    const result = await postMany(records);
    console.log(JSON.stringify(result));
    if (result.failed) process.exitCode = 1;
    return;
  }

  let hook = {};
  try { hook = JSON.parse(readStdin() || '{}'); } catch {}
  const rollout = hook.transcript_path || hook.rollout_path || process.env.CODEX_ROLLOUT_PATH || latestRollout();
  if (!rollout || !fs.existsSync(rollout)) return;
  const turns = extractTurns(fs.readFileSync(rollout, 'utf8').trim().split('\n'), 'hook');
  const record = turns[turns.length - 1];
  if (!record) return;
  if (hook.session_id) record.session = hook.session_id;
  if (hook.turn_id) record.turn_key = hook.turn_id;
  if (hook.cwd) record.cwd = hook.cwd;
  if (hook.model) record.model_id = hook.model;
  const dedup = loadDedup(DEDUP_FILE);
  if (shouldSkip(dedup, record.session, record.turn_key)) return;
  if (postRecord(record)) {
    markDone(dedup, record.session, record.turn_key);
    saveDedup(DEDUP_FILE, dedup);
  }
}

if (require.main === module) main().catch((err) => { console.error(err); process.exitCode = 1; });
module.exports = { extractTurns, parseToolInput, allRollouts };
