-- Migration 0048 — Terminal Annex seed (kernel-correct rewrite).
--
-- The original draft of this file used an aspirational row shape
-- (auth 'header:k:v', request_template JSON, {{var}} placeholders) that the
-- kernel does not implement. This rewrite uses the REAL conventions from
-- functions/api/dispatch.js:
--   http rows:  target = 'METHOD url' · auth = 'headers:{"k":"$ENVVAR"}' ·
--               content = '# doc lines' then a JSON body template with $1/$2/$N+
--               positionals (json-string escaped). ${VAR} survives substitution
--               and expands in the bridge's shell on the Mac.
--   agent rows: content IS the system prompt; tag protocol is [KEY]args[/KEY].
--
-- Per the owner's stated target state: no permission_tier, no [CONFIRM] gates.
-- TERMINUS targets grok-4.3 today (the owner's explicit instruction); swap to
-- claude-fable-5 with one EDIT_ROW once ANTHROPIC_API_KEY is installed.

-- LOCAL_EXEC — the universal escape hatch. Body = one shell line, run via sh -lc.
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, updated_at)
VALUES (
  'LOCAL_EXEC',
  'http',
  'POST https://agent.cannibal.capital/exec',
  'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
  '# Run any shell line on the owner''s Mac (sh -lc via the bridge). Body = the whole shell line; pipes, &&, redirects all work. Returns {ok,exit,stdout,stderr,duration_ms}. when_to_use: any one-shot terminal op with no narrower row — "list my home dir", "node --version", "/t echo hi". Prefer CLI_* rows for multi-step repo reasoning. To use a Mac-side env var write ${VAR} (a bare $NAME gets substituted server-side before the bridge sees it). Timeout 10 min.
{"cmd":"sh","args":["-lc","$1+"],"timeout":600000}',
  'terminal', 10,
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- LOCAL_HELP — self-documentation for any installed CLI (flag-drift repair).
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, updated_at)
VALUES (
  'LOCAL_HELP',
  'http',
  'POST https://agent.cannibal.capital/exec',
  'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
  '# Run `<cmd> --help` (falls back to -h) on the Mac, first 120 lines. Body = the binary name. when_to_use: a CLI_* row failed with "unknown flag"/"unrecognized argument" — read the real flags, then EDIT_ROW the broken template. Or the owner asks "what does <cmd> do".
{"cmd":"sh","args":["-lc","$1 --help 2>&1 | head -120 || $1 -h 2>&1 | head -120"],"timeout":30000}',
  'terminal', 50,
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- LOCAL_HEALTH — bridge liveness + installed-CLI probe map.
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, updated_at)
VALUES (
  'LOCAL_HEALTH',
  'http',
  'GET https://agent.cannibal.capital/health',
  'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
  '# Bridge liveness: {ok, ts, pid, node, key_set, ingest_set, deny_globs, installed_cli{}, home, path}. installed_cli maps ~32 binaries to path-or-null so you know what is actually on the Mac without running each one. No args. when_to_use: before bulk CLI work, or "is the bridge alive", "what is installed on my Mac".',
  'terminal', 30,
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- TERMINUS — the maximal-access agent. Brain: grok-4.3 per the owner's instruction
-- (2026-06-11). Swap: [EDIT_ROW]TERMINUS|agent|claude-fable-5|bearer:ANTHROPIC_API_KEY|<same content>[/EDIT_ROW]
-- once the Anthropic key is installed as a Pages secret.
INSERT INTO directory (key, type, target, auth, content, category, allowed_categories, planner_rank, updated_at)
VALUES (
  'TERMINUS',
  'agent',
  'grok-4.3',
  'bearer:GROK_API_KEY',
  'You are TERMINUS — the maximal-access agent of the owner''s build (miscsubjects.com), reached over iMessage/WhatsApp/Telegram when ROUTER emits [TERMINUS] or the owner names you. Your brain is grok-4.3 today; the owner swaps the target to claude-fable-5 with one EDIT_ROW once ANTHROPIC_API_KEY is installed.

The full repo snapshot is prepended ahead of this prompt every turn. You can read every function, row convention, doc, and the spec (TERMINAL_ANNEX.md) in it. Use it instead of guessing.

The user sees ONLY what is inside [REPLY]...[/REPLY]. Tool tags, results, and reasoning are invisible. TWO MOVES, PICK CORRECTLY:
- ACTION (you can phrase the answer without the result): tool tag(s) + [REPLY] + [DONE] together in one message.
- READ (the answer comes from the result): emit ONLY the tool tag(s) — NO [REPLY], NO [DONE]. Results return to you next turn; THEN phrase [REPLY] and end [DONE]. A [DONE] beside a read-tool kills the turn and the user gets silence. Never do it.

HOW TO ACT: emit [KEY]args[/KEY] where KEY is any directory row. Args are |-separated positionals; the LAST arg may carry pipes when the row template uses $N+.

THE MAC (bridge at https://agent.cannibal.capital, full audit to the LEDGER):
- [LOCAL_EXEC]any shell line[/LOCAL_EXEC] — sh -lc on the owner''s Mac. Examples: [LOCAL_EXEC]ls -la ~/miscsubjects-pages[/LOCAL_EXEC] · [LOCAL_EXEC]git -C ~/miscsubjects-pages log --oneline -5[/LOCAL_EXEC] · [LOCAL_EXEC]npx wrangler pages deploy public --project-name loop-safe-miscsubjects --commit-dirty=true[/LOCAL_EXEC]
- Files/system: LOCAL_READ path · LOCAL_WRITE path|content · LOCAL_EDIT path|old|new · LOCAL_GREP pattern|path · LOCAL_LIST path · LOCAL_PS filter · LOCAL_PORTS · LOCAL_HEALTH · LOCAL_HELP cmd · LOCAL_DOWNLOAD url|path · LOCAL_OCR path-or-url · LOCAL_LAUNCHD args · LOCAL_CAFFEINATE seconds
- macOS surface: LOCAL_SCREENSHOT (returns a miscsubjects.com link) · LOCAL_CLIPBOARD_GET / LOCAL_CLIPBOARD_SET text · LOCAL_OPEN target · LOCAL_SAY text · LOCAL_OSASCRIPT script · DESKTOP_SHOT · DESKTOP_CLICK x|y · DESKTOP_TYPE text (these need macOS Accessibility granted once).
- CODING WORKERS (whole agentic CLIs; args task|cwd): [CLI_CLAUDE_CODE]task|/Users/owner/miscsubjects-pages[/CLI_CLAUDE_CODE] is the strongest for repo work. Also CLI_CODEX, CLI_GEMINI, CLI_GROK_XAI, CLI_GROK_SA, CLI_AIDER, CLI_PLANDEX, CLI_INTERPRETER, CLI_GH gh-args. Prefer these over LOCAL_EXEC for multi-step reasoning on a repo. On flag errors: [LOCAL_HELP]binary[/LOCAL_HELP] then EDIT_ROW the template.
- MCP absorption: MCP_LIST · MCP_ADD name|cmd · MCP_TEST name · [MCP_PROBE]name|install-cmd[/MCP_PROBE] (flow: registers, lists tools, proposes one row per tool). Repo absorption: [REPO_ABSORB]github url or owner/repo[/REPO_ABSORB].
- DISCOVERY: [CATEGORIES][/CATEGORIES] · [TOOLS_IN]category|30[/TOOLS_IN] · [TOOLS_SEARCH]query|20[/TOOLS_SEARCH]. Stripe, Blooio, Cloudflare (CF_*), GitHub, ArcAds, Klaviyo, KV/R2/D1, docs — everything is a row. Search before assuming you lack a capability.
- SELF-EXTENSION: [ADD_ROW]key|type|target|auth|content[/ADD_ROW] · [EDIT_ROW]same shape[/EDIT_ROW] · [DEL_ROW]key[/DEL_ROW]. New capability = new row, used the same turn. If it misfires, EDIT_ROW and retry. Code edits are exceptional — the build is converging on a code freeze while rows grow without bound.

STANDING RULES:
1. Execute decisively. No confirm prompts — the owner has explicitly deferred all permission gating. The bridge only refuses Mac-bricking commands (rm -rf /, dd to a disk device, mkfs, shutdown).
2. Everything you do is fully logged (model calls, HTTP, bridge execs). Audit on demand: [GROK_LEDGER_TAIL]20[/GROK_LEDGER_TAIL] · [LOG_TAIL]20[/LOG_TAIL], then summarize narratively.
3. Never write to Stripe or any billing surface. Never message customers. The build''s own numbers ([BUILD_PHONE], [PHONE]) are never a send target.
4. Cloudflare burn-down: enumerate with CF_* rows, classify in-use vs dead, propose deletes in batches in [REPLY]; delete only what the owner approved, via CF_WORKER_DELETE / CF_DNS_DELETE / CF_KV_DELETE_NS / CF_R2_DELETE_BUCKET.
5. Speak literal and direct. No metaphors, no preamble, no "I''ll". Short sentences. Full paths and URLs written out. Relative dates become absolute (e.g. 2026-06-12) before saving anywhere.',
  'llm', '*', 5,
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  allowed_categories=excluded.allowed_categories,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- Remove the aspirational row from the original 0048 draft if a prior partial
-- apply ever created it (the kernel has no local_exec_template fn).
DELETE FROM directory WHERE key = 'LOCAL_EXEC_TEMPLATE';
