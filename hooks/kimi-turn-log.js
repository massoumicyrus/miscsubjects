#!/usr/bin/env node
// Kimi Code CLI per-turn capture from ~/.kimi-code/sessions/**/agents/main/wire.jsonl
// Test: node hooks/kimi-turn-log.js --test <wire.jsonl>              → last turn record
//       node hooks/kimi-turn-log.js --test-all <wire.jsonl>          → JSON array of all turns
//       node hooks/kimi-turn-log.js --export <out.jsonl> <wire.jsonl> → all turns as JSONL
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readStdin, loadDedup, saveDedup, postRecord, shouldSkip, markDone } = require('./_lib/agent-turn-common.js');

const KIMI_HOME = process.env.KIMI_HOME || path.join(os.homedir(), '.kimi-code');
const DEDUP_FILE = path.join(os.homedir(), '.miscsubjects', 'kimi_turn_dedup.json');
const SYNC_STATE_FILE = path.join(os.homedir(), '.miscsubjects', 'kimi_sync_state.json');
const LOCAL_LOG = path.join(os.homedir(), '.miscsubjects', 'kimi_turns.jsonl');

function promptText(input) {
  return (input || []).map((p) => p.text || '').join('\n').trim();
}

function legacyTs(ev) {
  const raw = ev && (ev.timestamp || ev.time);
  if (typeof raw === 'number') {
    const ms = raw > 1000000000000 ? raw : raw * 1000;
    return new Date(ms).toISOString();
  }
  if (raw) return new Date(raw).toISOString();
  return new Date().toISOString();
}

function extractLegacyTurns(lines) {
  const turns = [];
  let cur = null;
  for (const l of lines) {
    let ev; try { ev = JSON.parse(l); } catch { continue; }
    const msg = ev.message || {};
    const type = msg.type || ev.type;
    const payload = msg.payload || ev.payload || {};
    if (type === 'TurnBegin') {
      if (cur && cur.user_input) turns.push(cur);
      cur = {
        user_input: String(payload.user_input || '').trim(),
        input_kind: 'human',
        assistant_parts: [],
        tools: [],
        commands: [],
        files: new Set(),
        ts: legacyTs(ev),
        turn_key: String(ev.timestamp || ev.time || turns.length),
        turn_id: '',
      };
      continue;
    }
    if (!cur) continue;
    if (type === 'ContentPart') {
      if (payload.type === 'text' && payload.text) cur.assistant_parts.push(String(payload.text));
      continue;
    }
    if (type === 'ToolCall') {
      const id = payload.id || payload.tool_call_id || ('t' + cur.tools.length);
      const name = payload.name || payload.tool || 'tool';
      const args = payload.args || payload.arguments || {};
      cur.tools.push({ id, name, summary: JSON.stringify(args).slice(0, 400), result: '' });
      const command = args.command || payload.command;
      if (command) cur.commands.push(command);
      const filePath = args.path || args.file_path || payload.path;
      if (filePath && /write|edit/i.test(name)) cur.files.add(filePath);
      continue;
    }
    if (type === 'ToolResult') {
      const id = payload.id || payload.tool_call_id;
      const row = cur.tools.find((t) => t.id === id);
      if (row) row.result = String(payload.output || payload.result || '').slice(0, 500);
      continue;
    }
    if (type === 'TurnEnd') {
      cur.ts = legacyTs(ev);
      if (cur.user_input) turns.push(cur);
      cur = null;
    }
  }
  if (cur && cur.user_input) turns.push(cur);
  return turns
    .map((turn, idx) => ({ ...turn, turn_index: idx }))
    .filter((turn) => turn.user_input.trim());
}

function extractTurns(lines) {
  if (lines.some((l) => /"message"\s*:\s*\{/.test(l) && /"TurnBegin"/.test(l))) {
    return extractLegacyTurns(lines);
  }
  const turns = [];
  let cur = null;
  const toolById = new Map();
  let sessionId = 'unknown';
  let cwd = '';

  for (const l of lines) {
    let ev; try { ev = JSON.parse(l); } catch { continue; }
    if (ev.type === 'turn.prompt') {
      const text = promptText(ev.input);
      if (!text || text.startsWith('<system-reminder>')) {
        if (cur) turns.push(cur);
        cur = null;
        continue;
      }
      if (cur) turns.push(cur);
      const origin = ev.origin?.kind || 'human';
      cur = {
        user_input: text,
        input_kind: origin === 'user' ? 'human' : origin,
        assistant_parts: [],
        tools: [],
        commands: [],
        files: new Set(),
        ts: new Date(ev.time || Date.now()).toISOString(),
        turn_key: String(ev.time || turns.length),
        turn_id: '',
      };
      toolById.clear();
      continue;
    }
    if (!cur) continue;
    const e = ev.event || {};
    if (e.type === 'tool.call') {
      const id = e.toolCallId || e.uuid || ('t' + cur.tools.length);
      const name = e.name || 'tool';
      const args = e.args || {};
      const row = { id, name, summary: JSON.stringify(args).slice(0, 400), result: '' };
      toolById.set(id, row);
      cur.tools.push(row);
      if (name === 'Bash' && args.command) cur.commands.push(args.command);
      if ((name === 'Write' || name === 'Edit') && args.path) cur.files.add(args.path);
    }
    if (e.type === 'tool.result') {
      const row = toolById.get(e.toolCallId);
      if (row) row.result = String(e.result?.output || JSON.stringify(e.result || '')).slice(0, 500);
    }
    if (e.type === 'content.part' && e.part?.type === 'text' && e.part.text) {
      cur.assistant_parts.push(e.part.text);
    }
    if (e.type === 'step.end') {
      cur.turn_key = (e.turnId || cur.turn_key) + ':' + (e.step || '1');
      cur.ts = new Date(ev.time || Date.now()).toISOString();
    }
  }
  if (cur && cur.user_input) turns.push(cur);

  return turns
    .map((turn, idx) => ({ ...turn, turn_index: idx }))
    .filter((turn) => turn.user_input.trim());
}

function sessionDirName(sessionId) {
  const s = String(sessionId || '').trim();
  if (!s) return '';
  return s.startsWith('session_') ? s : 'session_' + s;
}

function wirePathFromIndex(sessionId) {
  const idx = path.join(KIMI_HOME, 'session_index.jsonl');
  if (!fs.existsSync(idx)) return null;
  const sid = sessionDirName(sessionId);
  for (const line of fs.readFileSync(idx, 'utf8').trim().split('\n')) {
    if (!line) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row.sessionId !== sid && row.sessionId !== sessionId) continue;
    const p = path.join(row.sessionDir, 'agents', 'main', 'wire.jsonl');
    if (fs.existsSync(p)) return { wire: p, cwd: row.workDir || '', sessionId: row.sessionId };
  }
  return null;
}

function wirePath(sessionId) {
  if (!sessionId) return null;
  const fromIdx = wirePathFromIndex(sessionId);
  if (fromIdx) return fromIdx.wire;
  const base = path.join(KIMI_HOME, 'sessions');
  const dir = sessionDirName(sessionId);
  try {
    for (const wd of fs.readdirSync(base)) {
      const p = path.join(base, wd, dir, 'agents', 'main', 'wire.jsonl');
      if (fs.existsSync(p)) return p;
      for (const ent of fs.readdirSync(path.join(base, wd))) {
        if (ent === dir || ent.includes(sessionId.replace(/^session_/, ''))) {
          const q = path.join(base, wd, ent, 'agents', 'main', 'wire.jsonl');
          if (fs.existsSync(q)) return q;
        }
      }
    }
  } catch {}
  return null;
}

function turnKeyFor(turn, sessionId) {
  return String(sessionId) + ':' + turn.turn_index + ':' + turn.turn_key;
}

function buildRecord(turn, sessionId, cwd) {
  const assistant = turn.assistant_parts.join('\n').trim();
  return {
    agent: 'kimi',
    source: 'hook',
    dispatch_key: 'CLI_KIMI',
    ts: turn.ts,
    session: sessionId,
    cwd: cwd || turn.cwd || '',
    input_kind: turn.input_kind,
    user_input: turn.user_input.slice(0, 8000),
    user_input_chars: turn.user_input.length,
    assistant_text: assistant.slice(0, 6000),
    n_tools: turn.tools.length,
    tools: turn.tools.map((t) => ({ id: t.id, name: t.name, summary: t.summary, result: t.result })),
    commands: turn.commands.slice(0, 50),
    files_changed: [...turn.files],
    turn_key: turnKeyFor(turn, sessionId),
  };
}

function loadSyncState() {
  try { return JSON.parse(fs.readFileSync(SYNC_STATE_FILE, 'utf8')); } catch { return { files: {} }; }
}

function saveSyncState(state) {
  try {
    fs.mkdirSync(path.dirname(SYNC_STATE_FILE), { recursive: true });
    fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

function syncedKeysForFile(state, filePath) {
  const row = state.files[filePath];
  if (!row) return new Set();
  if (Array.isArray(row.synced_keys)) return new Set(row.synced_keys);
  if (row.last_turn_key) return new Set([row.last_turn_key]);
  return new Set();
}

function markSynced(state, filePath, turnKey) {
  if (!state.files[filePath]) state.files[filePath] = { synced_keys: [] };
  const keys = state.files[filePath].synced_keys || [];
  if (!keys.includes(turnKey)) keys.push(turnKey);
  if (keys.length > 2000) state.files[filePath].synced_keys = keys.slice(-2000);
  else state.files[filePath].synced_keys = keys;
  state.files[filePath].last_turn_key = turnKey;
  state.files[filePath].mtimeMs = fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : 0;
}

function postTurnRecord(record) {
  try { fs.mkdirSync(path.dirname(LOCAL_LOG), { recursive: true }); fs.appendFileSync(LOCAL_LOG, JSON.stringify(record) + '\n'); } catch {}
  const { execSync } = require('child_process');
  for (const url of ['https://miscsubjects.com/api/kimi_log', 'https://miscsubjects.com/api/agent_log']) {
    try {
      execSync('curl -s -m 8 -X POST ' + url + ' -H "content-type: application/json" --data-binary @-',
        { input: JSON.stringify(record), stdio: ['pipe', 'ignore', 'ignore'] });
    } catch {}
  }
}

function syncFile(wirePath, sessionId, cwd, state, source) {
  const lines = fs.readFileSync(wirePath, 'utf8').trim().split('\n').filter(Boolean);
  const turns = extractTurns(lines);
  if (!turns.length) return 0;
  sessionId = sessionId || 'unknown';
  const synced = syncedKeysForFile(state, wirePath);
  let posted = 0;
  for (const turn of turns) {
    const record = buildRecord(turn, sessionId, cwd);
    record.source = source || record.source;
    if (synced.has(record.turn_key)) continue;
    postTurnRecord(record);
    markSynced(state, wirePath, record.turn_key);
    synced.add(record.turn_key);
    posted++;
  }
  return posted;
}

// --- main ---
if (require.main !== module) {
  module.exports = { extractTurns, buildRecord, turnKeyFor, syncFile, wirePath, wirePathFromIndex };
} else {
const testIdx = process.argv.indexOf('--test');
const testAllIdx = process.argv.indexOf('--test-all');
const exportIdx = process.argv.indexOf('--export');
let wireFile, sessionId, cwd;

if (testIdx > -1 || testAllIdx > -1 || exportIdx > -1) {
  wireFile = exportIdx > -1 ? process.argv[process.argv.length - 1] : process.argv[(testAllIdx > -1 ? testAllIdx : testIdx) + 1];
} else {
  let hook = {};
  try { hook = JSON.parse(readStdin() || '{}'); } catch {}
  sessionId = hook.session_id || hook.sessionId || '';
  cwd = hook.cwd || '';
  const idxHit = sessionId ? wirePathFromIndex(sessionId) : null;
  wireFile = hook.transcript_path || hook.wire_path || idxHit?.wire || wirePath(sessionId) || '';
  if (idxHit?.cwd) cwd = cwd || idxHit.cwd;
  if (idxHit?.sessionId) sessionId = sessionId || idxHit.sessionId;
}

if (!wireFile || !fs.existsSync(wireFile)) process.exit(0);

const sidFromPath = wireFile.match(/(session_[a-f0-9-]+)/i);
if (sidFromPath) sessionId = sessionId || sidFromPath[1];

const lines = fs.readFileSync(wireFile, 'utf8').trim().split('\n').filter(Boolean);
const turns = extractTurns(lines);
if (!turns.length) process.exit(0);

sessionId = sessionId || turns[turns.length - 1].sessionId || 'unknown';

if (testAllIdx > -1 || exportIdx > -1) {
  const outPath = exportIdx > -1 ? process.argv[exportIdx + 1] : null;
  const linesOut = turns.map((turn) => JSON.stringify(buildRecord(turn, sessionId, cwd)));
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, linesOut.join('\n') + (linesOut.length ? '\n' : ''));
    if (testAllIdx > -1) process.stdout.write(String(linesOut.length) + '\n');
  } else {
    for (const line of linesOut) process.stdout.write(line + '\n');
  }
  process.exit(0);
}

if (testIdx > -1) {
  const turn = turns[turns.length - 1];
  console.log(JSON.stringify(buildRecord(turn, sessionId, cwd), null, 2));
  process.exit(0);
}

const dedup = loadDedup(DEDUP_FILE);
const lastTurn = turns[turns.length - 1];
const lastRecord = buildRecord(lastTurn, sessionId, cwd);
if (shouldSkip(dedup, sessionId, lastRecord.turn_key)) process.exit(0);
markDone(dedup, sessionId, lastRecord.turn_key);
saveDedup(DEDUP_FILE, dedup);

const state = loadSyncState();
syncFile(wireFile, sessionId, cwd, state, 'hook');
saveSyncState(state);
process.exit(0);
}
