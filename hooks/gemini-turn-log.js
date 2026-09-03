#!/usr/bin/env node
// Gemini CLI per-turn capture. Register via `gemini hooks migrate` (Stop hook) or run from backfill.
// Reads ~/.gemini/tmp/<project>/chats/session-*.jsonl
// Test: node hooks/gemini-turn-log.js --test <session.jsonl>
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readStdin, loadDedup, saveDedup, postRecord, shouldSkip, markDone, stripGeminiContext } = require('./_lib/agent-turn-common.js');

const GEMINI_HOME = process.env.GEMINI_HOME || path.join(os.homedir(), '.gemini');
const DEDUP_FILE = path.join(os.homedir(), '.miscsubjects', 'gemini_turn_dedup.json');

function projectSlug(cwd) {
  const c = String(cwd || process.env.GEMINI_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || '').replace(/\/$/, '');
  if (!c) return '';
  return path.basename(c);
}

function latestSessionPath(cwd) {
  const slug = projectSlug(cwd);
  if (!slug) return null;
  const chats = path.join(GEMINI_HOME, 'tmp', slug, 'chats');
  if (!fs.existsSync(chats)) return null;
  let best = null;
  let bestM = 0;
  for (const f of fs.readdirSync(chats)) {
    if (!f.startsWith('session-') || !f.endsWith('.jsonl')) continue;
    const p = path.join(chats, f);
    const m = fs.statSync(p).mtimeMs;
    if (m > bestM) { bestM = m; best = p; }
  }
  return best;
}

function msgText(msg, includeFn) {
  const parts = [];
  for (const c of msg.content || []) {
    if (c.text) parts.push(c.text);
    else if (includeFn && c.functionResponse) parts.push(JSON.stringify(c.functionResponse).slice(0, 300));
  }
  return parts.join('\n');
}

function isUserTurn(msg) {
  if (msg.type !== 'user') return false;
  const text = msgText(msg, false);
  if (!text.trim()) return false;
  if (text.includes('<session_context>')) return false;
  return true;
}

function rebuildMessages(lines) {
  let messages = [];
  let sessionId = 'unknown';
  let cwd = '';
  for (const l of lines) {
    let ev; try { ev = JSON.parse(l); } catch { continue; }
    if (ev.sessionId) sessionId = ev.sessionId;
    if (ev.$set && Array.isArray(ev.$set.messages)) messages = ev.$set.messages;
    if (ev.type === 'user' || ev.type === 'gemini') messages.push(ev);
    if (ev.content && typeof ev.content === 'string' && (ev.type === 'gemini' || ev.type === 'user')) messages.push(ev);
    const ws = String(ev.content || '');
    const m = ws.match(/Workspace Directories:\*\*\s*\n\s*-\s*(\S+)/);
    if (m) cwd = m[1];
  }
  return { messages, sessionId, cwd };
}

function extractLastTurn(messages) {
  const turns = [];
  let cur = null;
  const toolById = new Map();

  for (const msg of messages) {
    const type = msg.type;
    const text = typeof msg.content === 'string' ? msg.content : msgText(msg, false);
    if (type === 'user' && isUserTurn(msg)) {
      const userInput = stripGeminiContext(text);
      if (!userInput) continue;
      if (cur) turns.push(cur);
      cur = {
        user_input: userInput,
        input_kind: text.includes('<session_context>') ? 'system' : 'human',
        assistant_parts: [],
        tools: [],
        commands: [],
        files: new Set(),
        ts: msg.timestamp || new Date().toISOString(),
        turn_key: msg.id || msg.timestamp,
      };
      toolById.clear();
      continue;
    }
    if (!cur) continue;
    if (type === 'gemini') {
      if (text) cur.assistant_parts.push(text);
      for (const tc of msg.toolCalls || []) {
        const id = tc.id || ('t' + cur.tools.length);
        const name = tc.name || 'tool';
        const args = tc.args || {};
        const row = { id, name, summary: JSON.stringify(args).slice(0, 400), result: '' };
        toolById.set(id, row);
        cur.tools.push(row);
        if (/shell|bash|run_terminal/i.test(name) && args.command) cur.commands.push(args.command);
        if (/write|edit|replace/i.test(name) && (args.path || args.file_path)) cur.files.add(args.path || args.file_path);
      }
    }
    if (type === 'user' && Array.isArray(msg.content)) {
      for (const c of msg.content) {
        const fr = c.functionResponse;
        if (!fr) continue;
        const row = toolById.get(fr.id);
        if (row) row.result = String(JSON.stringify(fr.response || fr).slice(0, 500));
      }
    }
  }
  if (cur && cur.user_input) turns.push(cur);
  return turns.length ? turns[turns.length - 1] : null;
}

function buildRecord(turn, sessionId, cwd) {
  return {
    agent: 'gemini',
    source: 'hook',
    dispatch_key: 'CLI_GEMINI',
    ts: turn.ts,
    session: sessionId,
    cwd,
    input_kind: turn.input_kind,
    user_input: turn.user_input.slice(0, 8000),
    user_input_chars: turn.user_input.length,
    assistant_text: turn.assistant_parts.join('\n').trim().slice(0, 6000),
    n_tools: turn.tools.length,
    tools: turn.tools,
    commands: turn.commands.slice(0, 50),
    files_changed: [...turn.files],
    turn_key: String(turn.turn_key),
  };
}

const testIdx = process.argv.indexOf('--test');
let sessionPath, sessionId, cwd;
if (testIdx > -1) {
  sessionPath = process.argv[testIdx + 1];
} else {
  let hook = {};
  try { hook = JSON.parse(readStdin() || '{}'); } catch {}
  sessionPath = hook.transcript_path || hook.session_path || process.env.GEMINI_SESSION_FILE || '';
  sessionId = hook.session_id || hook.sessionId || '';
  cwd = hook.cwd || process.env.GEMINI_WORKSPACE || process.env.GEMINI_PROJECT_DIR || '';
  if (!sessionPath) sessionPath = latestSessionPath(cwd) || '';
}

if (!sessionPath || !fs.existsSync(sessionPath)) process.exit(0);
const lines = fs.readFileSync(sessionPath, 'utf8').trim().split('\n');
const meta = rebuildMessages(lines);
sessionId = sessionId || meta.sessionId;
cwd = cwd || meta.cwd || '';
const turn = extractLastTurn(meta.messages);
if (!turn || !turn.user_input.trim()) process.exit(0);
const record = buildRecord(turn, sessionId, cwd);

if (testIdx > -1) { console.log(JSON.stringify(record, null, 2)); process.exit(0); }

const dedup = loadDedup(DEDUP_FILE);
if (shouldSkip(dedup, sessionId, record.turn_key)) process.exit(0);
markDone(dedup, sessionId, record.turn_key);
saveDedup(DEDUP_FILE, dedup);
postRecord(record);
process.exit(0);