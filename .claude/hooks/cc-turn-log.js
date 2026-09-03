#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");

function readStdin() { try { return fs.readFileSync(0, "utf8"); } catch { return ""; } }

let transcriptPath, sessionId = "unknown", cwd = "";
const testIdx = process.argv.indexOf("--test");
if (testIdx > -1) {
  transcriptPath = process.argv[testIdx + 1];
} else {
  let hook = {};
  try { hook = JSON.parse(readStdin() || "{}"); } catch {}
  transcriptPath = hook.transcript_path;
  sessionId = hook.session_id || sessionId;
  cwd = hook.cwd || "";
}
if (!transcriptPath || !fs.existsSync(transcriptPath)) { process.exit(0); }

const lines = fs.readFileSync(transcriptPath, "utf8").trim().split("\n");
const recs = [];
for (const l of lines) { try { recs.push(JSON.parse(l)); } catch {} }

// Find the last HUMAN turn: the last user record whose message.content is a plain string
// (tool_result user records carry arrays). Everything after it = my actions this turn.
let startIdx = -1;
for (let i = recs.length - 1; i >= 0; i--) {
  const r = recs[i];
  if (r.type === "user" && typeof (r.message && r.message.content) === "string") { startIdx = i; break; }
}
if (startIdx === -1) process.exit(0);

const turn = recs[startIdx];
const rawInput = String(turn.message.content || "");
// Metadata can't tell human input from system re-invocations (all promptSource=sdk) — use content.
const trimmed = rawInput.trim();
let inputKind = "human";
let userInput;
if (trimmed.startsWith("<task-notification>")) {
  inputKind = "system_task";
  const id = (rawInput.match(/<task-id>([^<]+)<\/task-id>/) || [])[1] || "";
  const summary = (rawInput.match(/<summary>([^<]*)<\/summary>/) || [])[1] || "";
  userInput = ("[background task " + id + " completed] " + summary).trim();
} else if (trimmed.startsWith("[Request interrupted")) {
  inputKind = "interrupt";
  userInput = trimmed.slice(0, 200);
} else {
  userInput = rawInput
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<command-[a-z-]+>[\s\S]*?<\/command-[a-z-]+>/g, "")
    .trim();
}
cwd = cwd || turn.cwd || "";
sessionId = (sessionId === "unknown" && turn.sessionId) ? turn.sessionId : sessionId;

// Map tool_use_id -> result preview (tool_result records arrive as later user records).
const resultById = {};
for (let i = startIdx + 1; i < recs.length; i++) {
  const r = recs[i];
  if (r.type !== "user" || !r.message || !Array.isArray(r.message.content)) continue;
  for (const c of r.message.content) {
    if (c.type !== "tool_result") continue;
    let txt = c.content;
    if (Array.isArray(txt)) txt = txt.map(x => (x && x.text) || "").join("");
    resultById[c.tool_use_id] = String(txt || "").slice(0, 500);
  }
}
const tools = [];
const filesChanged = new Set();
const commands = [];
const assistantTextParts = [];
for (let i = startIdx + 1; i < recs.length; i++) {
  const r = recs[i];
  if (r.type !== "assistant" || !r.message || !Array.isArray(r.message.content)) continue;
  for (const c of r.message.content) {
    if (c.type === "text" && c.text) { assistantTextParts.push(c.text); continue; }
    if (c.type !== "tool_use") continue;
    const inp = c.input || {};
    let summary = "";
    if (c.name === "Bash") { summary = inp.command || ""; commands.push(inp.command || ""); }
    else if (c.name === "Edit" || c.name === "Write" || c.name === "NotebookEdit") { summary = inp.file_path || ""; if (inp.file_path) filesChanged.add(inp.file_path); }
    else if (c.name === "Read") { summary = inp.file_path || ""; }
    else { summary = JSON.stringify(inp).slice(0, 200); }
    tools.push({ name: c.name, summary: String(summary).slice(0, 1000), result: (resultById[c.id] || "").slice(0, 400) });
  }
}
const assistantText = assistantTextParts.join("\n").slice(0, 6000);

const record = {
  ts: new Date().toISOString(),
  session: sessionId,
  cwd,
  input_kind: inputKind,
  user_input: userInput.slice(0, 8000),
  user_input_chars: userInput.length,
  assistant_text: assistantText,
  n_tools: tools.length,
  tools,
  commands: commands.slice(0, 50),
  files_changed: [...filesChanged],
};

if (testIdx > -1) { console.log(JSON.stringify(record, null, 2)); process.exit(0); }

// real run: append locally, POST cc_log (cc_turns + agent_turns) and agent_log (universal)
try { fs.appendFileSync(os.homedir() + "/.claude/cc_turns.jsonl", JSON.stringify(record) + "\n"); } catch {}
const agentRec = { ...record, agent: "claude", source: "hook", dispatch_key: "CLI_CLAUDE_CODE", trace_id: process.env.TRACE_ID || "" };
for (const url of ["https://miscsubjects.com/api/cc_log", "https://miscsubjects.com/api/agent_log"]) {
  try {
    execSync("curl -s -m 8 -X POST " + url + " -H 'content-type: application/json' --data-binary @-",
      { input: JSON.stringify(url.includes("agent_log") ? agentRec : record), stdio: ["pipe", "ignore", "ignore"] });
  } catch {}
}
process.exit(0);
