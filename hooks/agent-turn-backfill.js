#!/usr/bin/env node
// Backfill prior agent sessions into D1 via /api/agent_log — zero repo bloat.
// Reads local session stores only; state tracked in ~/.miscsubjects/agent_backfill_state.json
// Usage:
//   node hooks/agent-turn-backfill.js              # all agents, incremental
//   node hooks/agent-turn-backfill.js --agent grok # one agent
//   node hooks/agent-turn-backfill.js --dry-run
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const STATE_FILE = path.join(os.homedir(), '.miscsubjects', 'agent_backfill_state.json');
const REPO = path.dirname(path.dirname(__filename));
const HOOKS = path.join(REPO, 'hooks');
const AGENT_LOG_URL = process.env.MISC_AGENT_LOG_URL || 'https://miscsubjects.com/api/agent_log';

function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { files: {} }; } }
function saveState(s) { fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

function postRecord(record) {
  try {
    execSync('curl -s -m 12 -X POST ' + AGENT_LOG_URL + ' -H "content-type: application/json" --data-binary @-',
      { input: JSON.stringify(record), stdio: ['pipe', 'pipe', 'ignore'] });
    return true;
  } catch { return false; }
}

function runHook(script, file, extra) {
  const r = spawnSync('node', [path.join(HOOKS, script), '--test', file], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout.trim()) return null;
  try {
    const rec = JSON.parse(r.stdout);
    rec.source = 'backfill';
    if (extra) Object.assign(rec, extra);
    rec.turn_key = 'bf:' + rec.agent + ':' + path.basename(file) + ':' + (rec.turn_key || '0');
    return rec;
  } catch { return null; }
}

function runHookAll(script, file) {
  if (script === 'grok-turn-log.js') {
    try {
      const grok = require(path.join(HOOKS, 'grok-turn-log.js'));
      const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
      const turns = grok.extractTurns(lines);
      if (!turns.length) return [];
      const sessionId = turns[turns.length - 1].sessionId;
      const cwd = grok.cwdFromUpdatesPath(file);
      return turns.map((turn) => grok.buildRecord(turn, sessionId, cwd));
    } catch { return []; }
  }
  if (script === 'kimi-turn-log.js') {
    try {
      const kimi = require(path.join(HOOKS, 'kimi-turn-log.js'));
      const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
      const turns = kimi.extractTurns(lines);
      if (!turns.length) return [];
      const sessionId = sessionIdFromKimiPath(file);
      const cwd = '';
      return turns.map((turn) => kimi.buildRecord(turn, sessionId, cwd));
    } catch { return []; }
  }
  const tmp = path.join(os.tmpdir(), 'agent-turn-export-' + process.pid + '.jsonl');
  try {
    const r = spawnSync('node', [path.join(HOOKS, script), '--export', tmp, file], { encoding: 'utf8' });
    if (r.status !== 0 || !fs.existsSync(tmp)) return [];
    const rows = [];
    for (const line of fs.readFileSync(tmp, 'utf8').trim().split('\n')) {
      if (!line) continue;
      try { rows.push(JSON.parse(line)); } catch {}
    }
    return rows;
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

function walk(dir, pattern, out, limit) {
  if (!fs.existsSync(dir) || out.length >= limit) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (out.length >= limit) break;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, pattern, out, limit);
    else if (pattern.test(ent.name)) out.push(p);
  }
}

function sessionIdFromKimiPath(file) {
  const sidFromPath = String(file || '').match(/(session_[a-f0-9-]+)/i);
  if (sidFromPath) return sidFromPath[1];
  const parts = String(file || '').split(path.sep).filter(Boolean);
  const idx = parts.lastIndexOf('sessions');
  if (idx > -1 && parts[idx + 2]) return parts[idx + 2];
  return path.basename(path.dirname(file || '')) || 'unknown';
}

function backfillGrok(state, dry) {
  const base = path.join(os.homedir(), '.grok', 'sessions');
  const files = [];
  walk(base, /^updates\.jsonl$/, files, 200);
  let n = 0;
  for (const f of files) {
    const key = 'grok:' + f;
    const st = fs.statSync(f);
    const prev = state.files[key];
    const syncedCount = typeof prev === 'object' && prev != null ? (prev.synced_count || 0) : (prev === st.mtimeMs ? 1 : 0);
    const records = runHookAll('grok-turn-log.js', f);
    if (!records.length) continue;
    let posted = 0;
    for (let i = syncedCount; i < records.length; i++) {
      const rec = { ...records[i], source: 'backfill' };
      rec.turn_key = 'bf:grok:' + f + ':' + rec.turn_key;
      if (!dry && postRecord(rec)) posted++;
      else if (dry) posted++;
    }
    if (posted || dry) {
      if (!dry) state.files[key] = { mtimeMs: st.mtimeMs, synced_count: records.length };
      n += posted;
    }
  }
  return n;
}

function backfillGemini(state, dry) {
  const base = path.join(os.homedir(), '.gemini', 'tmp');
  const files = [];
  walk(base, /^session-.*\.jsonl$/, files, 300);
  let n = 0;
  for (const f of files) {
    const key = 'gemini:' + f;
    const st = fs.statSync(f);
    if (state.files[key] === st.mtimeMs) continue;
    const rec = runHook('gemini-turn-log.js', f);
    if (!rec || !rec.user_input) continue;
    rec.turn_key = 'bf:gemini:' + f + ':' + rec.turn_key;
    if (!dry && postRecord(rec)) { state.files[key] = st.mtimeMs; n++; }
    else if (dry) n++;
  }
  return n;
}

function backfillCodex(state, dry) {
  const base = path.join(os.homedir(), '.codex', 'sessions');
  const files = [];
  walk(base, /^rollout-.*\.jsonl$/, files, 300);
  let n = 0;
  for (const f of files) {
    const key = 'codex:' + f;
    const st = fs.statSync(f);
    if (state.files[key] === st.mtimeMs) continue;
    const rec = runHook('codex-turn-log.js', f);
    if (!rec) continue;
    rec.turn_key = 'bf:codex:' + f + ':' + rec.turn_key;
    if (!dry && postRecord(rec)) { state.files[key] = st.mtimeMs; n++; }
    else if (dry) n++;
  }
  return n;
}

function backfillKimi(state, dry) {
  const roots = [
    { base: path.join(os.homedir(), '.kimi-code', 'sessions'), agent: 'kimi', source: 'backfill' },
    { base: path.join(os.homedir(), '.kimi', 'sessions'), agent: 'kimi-desktop', source: 'desktop-backfill' },
  ];
  const files = [];
  for (const root of roots) {
    const bucket = [];
    walk(root.base, /^wire\.jsonl$/, bucket, 600);
    for (const f of bucket) files.push({ file: f, agent: root.agent, source: root.source });
  }
  let n = 0;
  for (const item of files) {
    const f = item.file;
    const key = 'kimi:' + f;
    const st = fs.statSync(f);
    const prev = state.files[key];
    const syncedCount = typeof prev === 'object' && prev != null ? (prev.synced_count || 0) : (prev === st.mtimeMs ? 1 : 0);
    const records = runHookAll('kimi-turn-log.js', f);
    if (!records.length) continue;
    let posted = 0;
    for (let i = syncedCount; i < records.length; i++) {
      const rec = { ...records[i], agent: item.agent, source: item.source };
      rec.turn_key = 'bf:' + item.agent + ':' + f + ':' + rec.turn_key;
      if (!dry && postRecord(rec)) posted++;
      else if (dry) posted++;
    }
    if (posted || dry) {
      if (!dry) state.files[key] = { mtimeMs: st.mtimeMs, synced_count: records.length };
      n += posted;
    }
  }
  return n;
}

function backfillClaudeJsonl(state, dry) {
  const f = path.join(os.homedir(), '.claude', 'cc_turns.jsonl');
  if (!fs.existsSync(f)) return 0;
  const st = fs.statSync(f);
  const key = 'claude:jsonl';
  if (state.files[key] === st.mtimeMs) return 0;
  let n = 0;
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n');
  for (const line of lines.slice(-500)) {
    let rec; try { rec = JSON.parse(line); } catch { continue; }
    rec.agent = 'claude';
    rec.source = 'backfill';
    rec.dispatch_key = 'CLI_CLAUDE_CODE';
    rec.turn_key = 'bf:claude:jsonl:' + (rec.turn_key || rec.ts || n);
    if (!dry && postRecord(rec)) n++;
    else if (dry) n++;
  }
  if (!dry && n) state.files[key] = st.mtimeMs;
  return n;
}

const agentArg = process.argv.indexOf('--agent');
const agent = agentArg > -1 ? process.argv[agentArg + 1] : 'all';
const dry = process.argv.includes('--dry-run');
const state = loadState();
const runners = {
  grok: backfillGrok,
  gemini: backfillGemini,
  codex: backfillCodex,
  kimi: backfillKimi,
  claude: backfillClaudeJsonl,
};
let total = 0;
if (agent === 'all') {
  for (const fn of Object.values(runners)) total += fn(state, dry);
} else if (runners[agent]) {
  total += runners[agent](state, dry);
} else {
  console.error('Unknown agent:', agent);
  process.exit(1);
}
if (!dry) saveState(state);
console.log(JSON.stringify({ ok: true, agent, dry_run: dry, posted: total }));
