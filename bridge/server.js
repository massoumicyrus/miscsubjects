// Mac-side bridge for miscsubjects' terminal annex.
// One process. One route. One auth header. One global deny-glob. Standing-order
// full HTTP logging to miscsubjects via MISC_INGEST_URL.
//
// POST /exec   { cmd, args[], cwd?, stdin?, env?, timeout?, shell?, stream? }
//                 → { ok, exit, stdout, stderr, duration_ms, cmd, args, cwd }
// GET  /health → { ok, ts, pid, node, key_set, ingest_set, deny_globs, installed_cli[] }
//
// Every call requires header x-terminal-key matching TERMINAL_KEY.
// Every call POSTs the full request/response to MISC_INGEST_URL (event_log_ingest).

const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const KEY = process.env.TERMINAL_KEY || "";
const INGEST = process.env.MISC_INGEST_URL || "";
const PORT = parseInt(process.env.BRIDGE_PORT || "3000", 10);
const HOST = process.env.BRIDGE_HOST || "127.0.0.1";

// The absolute "do not physically brick the Mac" floor. Per the owner's stated target
// state (TERMINAL_ANNEX.md), permission tiers and security gating are deferred —
// this list is brick-prevention only, not security. shutdown/halt/reboot stay
// because a FileVault login screen kills remote access until the owner is at the Mac.
const DENY_GLOBS = [
  /\brm\s+-rf\s+(\/|~)(\s|$|\/\s*$)/,
  /\brm\s+-rf\s+\/(usr|System|Library|bin|sbin|etc|var|private|Applications|Users)\/?(\s|$)/,
  /\bdd\s+if=.*of=\/dev\/(r?disk|sd)/,
  /\bmkfs\b/,
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
  /\bshutdown\b/,
  /\bhalt\b/,
  /\breboot\b/,
  />\s*\/dev\/(sd[a-z]|r?disk[0-9])/,
];

const ALLOWED_SHELL = process.env.ALLOW_SHELL_TRUE === "1";

const app = express();

app.use((req, res, next) => {
  const got = req.headers["x-terminal-key"] || "";
  if (!KEY || got !== KEY) return res.status(401).json({ ok: false, error: "unauthorized" });
  next();
});

// Route-level parser: the global express.json() sits below the /mcp proxy mount so it
// cannot swallow proxied bodies — but that left /exec with req.body undefined and every
// call failing "cmd required". Parse here, on this route only.
app.post("/exec", express.json({ limit: "20mb" }), async (req, res) => {
  const body = req.body || {};
  const cmd = body.cmd;
  const args = Array.isArray(body.args) ? body.args.map(String) : [];
  const cwd = body.cwd || process.env.HOME;
  const stdin = body.stdin || "";
  const extraEnv = body.env || {};
  const timeoutMs = Math.min(parseInt(body.timeout || 600000, 10), 1800000);
  const useShell = body.shell === true && ALLOWED_SHELL;
  const stream = body.stream === true;
  const trace_id = body.trace_id || req.headers["x-trace-id"] || "";

  if (!cmd) return res.status(400).json({ ok: false, error: "cmd required" });

  const fullLine = useShell ? String(cmd) : [cmd, ...args].join(" ");
  const hit = DENY_GLOBS.find((rx) => rx.test(fullLine));
  if (hit) {
    const out = { ok: false, error: "denied by global deny-glob", deny_glob: String(hit), line: fullLine };
    ingest({ kind: "exec_denied", trace_id, ...out, ts: Date.now() });
    return res.status(403).json(out);
  }

  const t0 = Date.now();
  let child;
  try {
    child = spawn(useShell ? cmd : cmd, useShell ? [] : args, {
      cwd,
      env: { ...process.env, ...extraEnv },
      shell: useShell,
    });
  } catch (e) {
    const out = { ok: false, error: "spawn_failed", message: String(e.message || e) };
    ingest({ kind: "exec_spawn_err", trace_id, cmd, args, cwd, ...out, ts: Date.now() });
    return res.status(500).json(out);
  }

  let stdout = "";
  let stderr = "";
  let killed = false;

  child.stdout.on("data", (d) => {
    const s = d.toString();
    stdout += s;
    if (stream) ingest({ kind: "stdout_chunk", trace_id, cmd, args, chunk: s, ts: Date.now() });
  });
  child.stderr.on("data", (d) => {
    const s = d.toString();
    stderr += s;
    if (stream) ingest({ kind: "stderr_chunk", trace_id, cmd, args, chunk: s, ts: Date.now() });
  });
  if (stdin) {
    try {
      child.stdin.write(stdin);
      child.stdin.end();
    } catch (e) {
      stderr += `\n[bridge: stdin write failed: ${e.message}]`;
    }
  }

  const timer = setTimeout(() => {
    killed = true;
    try {
      child.kill("SIGKILL");
    } catch {}
  }, timeoutMs);

  child.on("close", (code, signal) => {
    clearTimeout(timer);
    const duration_ms = Date.now() - t0;
    const out = {
      ok: code === 0 && !killed,
      exit: code,
      signal: signal || null,
      killed_by_timeout: killed,
      stdout,
      stderr,
      duration_ms,
      cmd,
      args,
      cwd,
      shell: useShell,
    };
    ingest({ kind: "exec_complete", trace_id, request: { cmd, args, cwd, env_keys: Object.keys(extraEnv), shell: useShell, timeout: timeoutMs }, response: out, ts: Date.now() });
    res.json(out);
  });

  child.on("error", (err) => {
    clearTimeout(timer);
    const out = { ok: false, error: "child_error", message: String(err.message || err), stdout, stderr };
    ingest({ kind: "exec_child_err", trace_id, cmd, args, cwd, ...out, ts: Date.now() });
    if (!res.headersSent) res.status(500).json(out);
  });
});

const http = require("http");

// Proxy to the local Playwright MCP server (SSE/Streamable HTTP).
function proxyToMcp(req, res) {
  const targetPath = req.originalUrl || req.url;
  const proxyReq = http.request(
    {
      hostname: "localhost",
      port: 8931,
      path: targetPath,
      method: req.method,
      headers: {
        "content-type": req.headers["content-type"] || "application/json",
        accept: req.headers["accept"] || "application/json, text/event-stream",
        "mcp-session-id": req.headers["mcp-session-id"] || "",
        host: "localhost:8931",
      },
    },
    (proxyRes) => {
      res.status(proxyRes.statusCode);
      for (const [k, v] of Object.entries(proxyRes.headers)) {
        try { res.setHeader(k, v); } catch {}
      }
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", (e) => {
    if (!res.headersSent) res.status(502).json({ ok: false, error: "mcp_proxy_error", message: e.message });
  });
  req.pipe(proxyReq);
}

app.use("/mcp", proxyToMcp);

app.use(express.json({ limit: "20mb" }));
app.use(express.text({ limit: "20mb", type: "text/*" }));

app.get("/health", async (req, res) => {
  const probes = ["node", "npm", "bun", "git", "gh", "claude", "codex", "gemini", "grok", "aider", "plandex", "interpreter", "goose", "openhands", "rg", "fd", "jq", "yq", "ffmpeg", "pandoc", "sqlite3", "tesseract", "osascript", "screencapture", "pbcopy", "pbpaste", "say", "open", "caffeinate", "defaults", "launchctl", "cloudflared", "wrangler"];
  const present = {};
  for (const bin of probes) {
    present[bin] = await which(bin);
  }
  res.json({
    ok: true,
    ts: Date.now(),
    pid: process.pid,
    node: process.version,
    key_set: !!KEY,
    ingest_set: !!INGEST,
    shell_true_allowed: ALLOWED_SHELL,
    deny_globs: DENY_GLOBS.map(String),
    installed_cli: present,
    home: process.env.HOME,
    path: process.env.PATH,
  });
});

app.get("/", (req, res) => res.type("text/plain").send("miscsubjects bridge alive"));

app.listen(PORT, HOST, () => {
  console.log(`[bridge] listening ${HOST}:${PORT}  key_set=${!!KEY}  ingest_set=${!!INGEST}  shell_true_allowed=${ALLOWED_SHELL}`);
});

function ingest(payload) {
  if (!INGEST) return;
  const body = JSON.stringify({ source: "bridge", host: require("os").hostname(), ...payload });
  const headers = { "Content-Type": "application/json", "x-terminal-key": KEY };
  fetch(INGEST, { method: "POST", headers, body }).catch((e) => {
    console.error("[bridge] ingest_err", e.message);
  });
}

function which(bin) {
  return new Promise((resolve) => {
    const c = spawn("/usr/bin/which", [bin]);
    let out = "";
    c.stdout.on("data", (d) => (out += d));
    c.on("close", (code) => resolve(code === 0 ? out.trim() : null));
    c.on("error", () => resolve(null));
  });
}
