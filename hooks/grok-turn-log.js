#!/usr/bin/env node
// Grok Build per-turn capture. Register as a Stop hook (Grok runs it when a turn ends).
// Reads ~/.grok/sessions/<encoded-cwd>/<sessionId>/updates.jsonl, extracts every finished
// turn (user input + tools + files + assistant text), POSTs new ones to /api/agent_log.
// Test: node hooks/grok-turn-log.js --test [updates.jsonl]           → last turn record
//       node hooks/grok-turn-log.js --test-all [updates.jsonl]      → JSON array of all turns
const fs = require("fs");
const os = require("os");
const path = require("path");
const { readStdin, loadDedup, saveDedup, postRecord } = require("./_lib/agent-turn-common.js");

const GROK_HOME = process.env.GROK_HOME || path.join(os.homedir(), ".grok");
const SYNC_STATE_FILE = path.join(os.homedir(), ".miscsubjects", "grok_sync_state.json");
const LOCAL_LOG = path.join(os.homedir(), ".miscsubjects", "grok_turns.jsonl");

function tsFrom(ev) {
  const t = Number(ev.timestamp || 0);
  if (!t) return new Date().toISOString();
  return new Date(t < 1e12 ? t * 1000 : t).toISOString();
}

/** USD per million tokens [input, output] — estimate when Grok Build omits cost ticks. */
const PPM = {
  "grok-composer-2.5-fast": [1.0, 2.0],
  "grok-composer-2.5": [1.0, 2.0],
  "grok-build-0.1": [1.0, 2.0],
  "grok-4.3": [1.25, 2.5],
};

function estimateCostUsd(modelId, tokensIn, tokensOut) {
  const m = String(modelId || "grok-composer-2.5-fast");
  const ppm = PPM[m] || PPM["grok-composer-2.5-fast"];
  const ti = Math.max(0, Number(tokensIn || 0));
  const to = Math.max(0, Number(tokensOut || 0));
  return Math.round((ti * ppm[0] + to * ppm[1]) / 1e6 * 1e8) / 1e8;
}

function metaFrom(ev) {
  return ev.params?._meta || ev._meta || {};
}

function encodeCwd(cwd) {
  return encodeURIComponent(String(cwd || "").replace(/\/$/, "") || "/");
}

function cwdFromUpdatesPath(updatesPath) {
  const m = String(updatesPath || "").match(/sessions\/([^/]+)\//);
  if (!m) return "";
  try { return decodeURIComponent(m[1]); } catch { return ""; }
}

function sessionUpdatesPath(sessionId, cwd) {
  if (!sessionId) return null;
  const base = path.join(GROK_HOME, "sessions");
  if (cwd) {
    const p = path.join(base, encodeCwd(cwd), sessionId, "updates.jsonl");
    if (fs.existsSync(p)) return p;
  }
  try {
    for (const group of fs.readdirSync(base)) {
      const p = path.join(base, group, sessionId, "updates.jsonl");
      if (fs.existsSync(p)) return p;
    }
  } catch {}
  return null;
}

function stripUserInput(text) {
  return String(text || "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<command-[a-z-]+>[\s\S]*?<\/command-[a-z-]+>/g, "")
    .trim();
}

function toolSummary(title, raw) {
  if (!raw || typeof raw !== "object") return "";
  if (title === "Shell" && raw.command) return String(raw.command).slice(0, 1000);
  if ((title === "Read" || title === "Write" || title === "StrReplace") && raw.path) return String(raw.path);
  if (title === "Grep" && raw.pattern) return String(raw.pattern).slice(0, 500);
  if (title === "Glob" && raw.glob_pattern) return String(raw.glob_pattern).slice(0, 500);
  return JSON.stringify(raw).slice(0, 300);
}

function resultPreview(upd) {
  const parts = [];
  for (const c of upd.content || []) {
    const t = c.content?.text || c.content;
    if (typeof t === "string" && t) parts.push(t);
  }
  const ro = upd.rawOutput || {};
  if (ro.output_for_prompt) parts.push(String(ro.output_for_prompt).slice(0, 400));
  else if (ro.type === "Bash" && ro.command) parts.push(String(ro.command).slice(0, 200));
  return parts.join("\n").slice(0, 500);
}

function extractTurns(lines) {
  const events = [];
  for (const l of lines) { try { events.push(JSON.parse(l)); } catch {} }
  const turns = [];
  let cur = null;
  const toolById = new Map();

  for (const ev of events) {
    if (ev.method !== "session/update") continue;
    const upd = ev.params?.update || {};
    const kind = upd.sessionUpdate;
    const sessionId = ev.params?.sessionId || "unknown";

    if (kind === "user_message_chunk") {
      if (cur) turns.push(cur);
      const raw = String(upd.content?.text || "");
      let inputKind = "human";
      if (raw.includes("<task-notification>") || raw.startsWith("[Request interrupted")) inputKind = "system_task";
      else if (raw.includes("<summary_content>") || raw.includes("Your conversation was summarized")) inputKind = "system_summary";
      const userInput = stripUserInput(raw);
      cur = {
        sessionId,
        user_input: userInput,
        raw_user_input: raw,
        input_kind: inputKind,
        assistant_parts: [],
        tools: [],
        commands: [],
        files: new Set(),
        ts: tsFrom(ev),
        turnStartMs: null,
        cwd: "",
        model_id: metaFrom(ev).modelId || null,
        context_tokens_start: Number(metaFrom(ev).totalTokens || 0) || 0,
        context_tokens_peak: Number(metaFrom(ev).totalTokens || 0) || 0,
        usage: null,
      };
      toolById.clear();
      continue;
    }
    if (!cur) continue;

    const meta = metaFrom(ev);
    if (meta.turnStartMs) cur.turnStartMs = meta.turnStartMs;
    if (meta.modelId) cur.model_id = meta.modelId;
    if (meta.totalTokens) {
      const t = Number(meta.totalTokens || 0);
      if (t > cur.context_tokens_peak) cur.context_tokens_peak = t;
    }

    if (kind === "turn_completed") {
      const u = upd.usage || meta.usage || null;
      if (u) cur.usage = u;
      if (upd.model_id) cur.model_id = upd.model_id;
      if (upd.total_cost_usd_ticks) cur.cost_usd_ticks = Number(upd.total_cost_usd_ticks);
      if (upd.total_cost_usd) cur.cost_usd = Number(upd.total_cost_usd);
    }

    if (kind === "agent_message_chunk") {
      const t = upd.content?.text;
      if (t) cur.assistant_parts.push(t);
    }

    if (kind === "tool_call") {
      const id = upd.toolCallId || ("t" + cur.tools.length);
      const title = upd.title || "tool";
      const raw = upd.rawInput || {};
      const row = { id, name: title, summary: toolSummary(title, raw), result: "" };
      toolById.set(id, row);
      cur.tools.push(row);
      if (title === "Shell" && raw.command) cur.commands.push(raw.command);
      if ((title === "Write" || title === "StrReplace" || title === "Edit") && raw.path) cur.files.add(raw.path);
      for (const loc of (upd.locations || [])) if (loc.path) cur.files.add(loc.path);
    }

    if (kind === "tool_call_update" && upd.status === "completed") {
      const id = upd.toolCallId;
      const row = toolById.get(id);
      if (row) row.result = resultPreview(upd);
      const raw = upd.rawInput || {};
      if (raw.path) cur.files.add(raw.path);
      for (const loc of (upd.locations || [])) if (loc.path) cur.files.add(loc.path);
      if (raw.variant === "CursorShell" && raw.command) {
        if (!cur.commands.includes(raw.command)) cur.commands.push(raw.command);
      }
    }
  }
  if (cur) turns.push(cur);

  return turns
    .map((turn, idx) => ({ ...turn, turn_index: idx }))
    .filter((turn) => turn.user_input.trim() || turn.raw_user_input.trim());
}

function loadSyncState() {
  try { return JSON.parse(fs.readFileSync(SYNC_STATE_FILE, "utf8")); } catch { return { files: {} }; }
}

function saveSyncState(state) {
  try {
    fs.mkdirSync(path.dirname(SYNC_STATE_FILE), { recursive: true });
    fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

function turnKeyFor(turn, sessionId) {
  return String(sessionId) + ":" + turn.turn_index + ":" + (turn.turnStartMs || turn.ts);
}

function buildRecord(turn, sessionId, cwd) {
  const assistant = turn.assistant_parts.join("\n").trim();
  const userInput = turn.user_input || stripUserInput(turn.raw_user_input);
  const modelId = turn.model_id || "grok-composer-2.5-fast";
  const usage = turn.usage || {};
  let tokensIn = usage.input_tokens ?? usage.inputTokens ?? null;
  let tokensOut = usage.output_tokens ?? usage.outputTokens ?? null;
  let costUsdTicks = turn.cost_usd_ticks ?? usage.cost_in_usd_ticks ?? usage.cost_usd_ticks ?? null;
  let costUsd = turn.cost_usd ?? (costUsdTicks != null ? Number(costUsdTicks) / 1e10 : null);
  let costEstimated = false;
  const peak = Number(turn.context_tokens_peak || 0);
  const start = Number(turn.context_tokens_start || 0);
  if (tokensIn == null && peak > start) tokensIn = peak - start;
  if (tokensOut == null && assistant) tokensOut = Math.min(assistant.length * 2, 8000);
  if (costUsd == null && (tokensIn || tokensOut)) {
    costUsd = estimateCostUsd(modelId, tokensIn, tokensOut);
    costUsdTicks = Math.round(costUsd * 1e10);
    costEstimated = true;
  }
  const rec = {
    agent: "grok",
    source: "hook",
    dispatch_key: "CLI_GROK_XAI",
    ts: turn.ts,
    session: sessionId,
    cwd: cwd || turn.cwd || "",
    input_kind: turn.input_kind,
    user_input: userInput.slice(0, 8000),
    user_input_chars: userInput.length,
    assistant_text: assistant.slice(0, 6000),
    n_tools: turn.tools.length,
    tools: turn.tools.map((t) => ({ name: t.name, summary: t.summary, result: t.result })),
    commands: turn.commands.slice(0, 50),
    files_changed: [...turn.files],
    turn_key: turnKeyFor(turn, sessionId),
  };
  if (modelId) rec.model_id = modelId;
  if (peak) rec.context_tokens_peak = peak;
  if (tokensIn != null) rec.tokens_in = tokensIn;
  if (tokensOut != null) rec.tokens_out = tokensOut;
  if (costUsd != null) rec.cost_usd = costUsd;
  if (costUsdTicks != null) rec.cost_usd_ticks = costUsdTicks;
  if (costEstimated) rec.cost_estimated = true;
  return rec;
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
  try { fs.mkdirSync(path.dirname(LOCAL_LOG), { recursive: true }); fs.appendFileSync(LOCAL_LOG, JSON.stringify(record) + "\n"); } catch {}
  const { execSync } = require("child_process");
  for (const url of ["https://miscsubjects.com/api/grok_log", "https://miscsubjects.com/api/agent_log"]) {
    try {
      execSync("curl -s -m 8 -X POST " + url + " -H 'content-type: application/json' --data-binary @-",
        { input: JSON.stringify(record), stdio: ["pipe", "ignore", "ignore"] });
    } catch {}
  }
}

function syncFile(updatesPath, sessionId, cwd, state, source) {
  const lines = fs.readFileSync(updatesPath, "utf8").trim().split("\n").filter(Boolean);
  const turns = extractTurns(lines);
  if (!turns.length) return 0;
  sessionId = sessionId || turns[turns.length - 1].sessionId;
  cwd = cwd || cwdFromUpdatesPath(updatesPath);
  const synced = syncedKeysForFile(state, updatesPath);
  let posted = 0;
  for (const turn of turns) {
    const record = buildRecord(turn, sessionId, cwd);
    record.source = source || record.source;
    if (synced.has(record.turn_key)) continue;
    postTurnRecord(record);
    markSynced(state, updatesPath, record.turn_key);
    synced.add(record.turn_key);
    posted++;
  }
  return posted;
}

// --- main ---
if (require.main !== module) {
  module.exports = { extractTurns, buildRecord, turnKeyFor, syncFile, cwdFromUpdatesPath };
} else {
const testIdx = process.argv.indexOf("--test");
const testAllIdx = process.argv.indexOf("--test-all");
const exportIdx = process.argv.indexOf("--export");
let updatesPath, sessionId, cwd;

if (testIdx > -1 || testAllIdx > -1 || exportIdx > -1) {
  updatesPath = exportIdx > -1 ? process.argv[process.argv.length - 1] : process.argv[(testAllIdx > -1 ? testAllIdx : testIdx) + 1];
} else {
  let hook = {};
  try { hook = JSON.parse(readStdin() || "{}"); } catch {}
  sessionId = hook.sessionId || hook.session_id || process.env.GROK_SESSION_ID || "";
  cwd = hook.cwd || hook.workspaceRoot || process.env.GROK_WORKSPACE_ROOT || process.env.CLAUDE_PROJECT_DIR || "";
  updatesPath = hook.updates_path || hook.transcript_path || sessionUpdatesPath(sessionId, cwd);
}

if (!updatesPath || !fs.existsSync(updatesPath)) process.exit(0);

const lines = fs.readFileSync(updatesPath, "utf8").trim().split("\n").filter(Boolean);
const turns = extractTurns(lines);
if (!turns.length) process.exit(0);

sessionId = sessionId || turns[turns.length - 1].sessionId;
cwd = cwd || cwdFromUpdatesPath(updatesPath);

if (testAllIdx > -1 || exportIdx > -1) {
  const outPath = exportIdx > -1 ? process.argv[exportIdx + 1] : null;
  const linesOut = turns.map((turn) => JSON.stringify(buildRecord(turn, sessionId, cwd)));
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, linesOut.join("\n") + (linesOut.length ? "\n" : ""));
    if (testAllIdx > -1) process.stdout.write(String(linesOut.length) + "\n");
  } else {
    for (const line of linesOut) process.stdout.write(line + "\n");
  }
  process.exit(0);
}

if (testIdx > -1) {
  const turn = turns[turns.length - 1];
  console.log(JSON.stringify(buildRecord(turn, sessionId, cwd), null, 2));
  process.exit(0);
}

const state = loadSyncState();
syncFile(updatesPath, sessionId, cwd, state, "hook");
saveSyncState(state);
process.exit(0);
}