-- Migration 0049 — Terminal Annex catalog (TERMINAL_ANNEX.md Phases E, F, I).
-- ~50 rows across LOCAL_* / CLI_* / DESKTOP_* / BROWSER_* / MCP_* / REPO_* +
-- SCOUT agent + ROUTER/OPS prompt appends + capability_tests G1-G7.
-- All bridge rows POST to https://agent.cannibal.capital/exec with
-- auth headers:{"x-terminal-key":"$TERMINAL_KEY"}; content = '# docs' + JSON body
-- template ($1/$2/$N+ positionals; ${VAR} survives for Mac-side shell expansion).
-- No permission_tier anywhere per the owner's stated target state.

-- ───────────────────────── DOMAIN: LOCAL_* (filesystem + macOS surface) ─────

INSERT INTO directory (key, type, target, auth, content, category, planner_rank, updated_at) VALUES
('LOCAL_READ', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Read a file on the owner''s Mac (first 100000 bytes). Args: path. when_to_use: "show me <file>", reading config/code/logs on his machine. For repo files prefer the prepended repo snapshot first.
{"cmd":"sh","args":["-lc","head -c 100000 $1"],"timeout":30000}', 'terminal', 50, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_WRITE', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Write (overwrite) a file on the Mac. Args: path|content (content is everything after the first pipe — pipes inside survive). Echoes the written content back. when_to_use: dropping a script, a note, a config on his machine.
{"cmd":"tee","args":["$1"],"stdin":"$2+","timeout":30000}', 'terminal', 55, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_EDIT', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Exact-string replace in a file on the Mac (python3 str.replace, all occurrences). Args: path|old|new. Prints the replacement count. when_to_use: surgical one-line config/code edits. For multi-step edits use CLI_CLAUDE_CODE.
{"cmd":"python3","args":["-c","import sys\np,old,new=sys.argv[1],sys.argv[2],sys.argv[3]\ns=open(p).read()\nopen(p,''w'').write(s.replace(old,new))\nprint(''replaced'',s.count(old))","$1","$2","$3+"],"timeout":30000}', 'terminal', 55, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_GREP', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# ripgrep on the Mac, line numbers, max 50 hits per file. Args: pattern|path. Exit 1 with empty stdout = no matches (not an error). when_to_use: "find where X is defined", searching any tree on his machine.
{"cmd":"rg","args":["-n","--max-count","50","$1","$2"],"timeout":30000}', 'terminal', 50, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_LIST', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# ls -la a path on the Mac. Args: path (empty = home). when_to_use: "what is in <dir>", checking a file exists.
{"cmd":"sh","args":["-lc","ls -la $1"],"timeout":15000}', 'terminal', 50, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_PS', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Running processes on the Mac, filtered. Args: filter (empty = first 50 of everything). when_to_use: "what''s running on my mac", "is X running".
{"cmd":"sh","args":["-lc","ps aux | grep -i \"$1\" | grep -v \"grep -i\" | head -50; true"],"timeout":15000}', 'terminal', 50, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_PORTS', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Listening TCP ports on the Mac (lsof). No args. when_to_use: "what''s listening", debugging a port clash.
{"cmd":"sh","args":["-lc","lsof -iTCP -sTCP:LISTEN -P -n | head -60"],"timeout":15000}', 'terminal', 55, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_LAUNCHD', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# launchctl on the Mac. Args: the launchctl arguments, e.g. "list" or "kickstart -k gui/501/com.the owner.grok-bridge". when_to_use: restarting the bridge or tunnel, inspecting launch agents.
{"cmd":"sh","args":["-lc","launchctl $1+"],"timeout":30000}', 'terminal', 60, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_SCREENSHOT', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Screenshot the Mac''s screen, upload to R2, return {url} at miscsubjects.com/img/up/. No args. Needs macOS Screen Recording permission granted to the bridge''s shell once. when_to_use: "screenshot my screen", "what''s on my mac right now".
{"cmd":"sh","args":["-lc","f=/tmp/shot-$(date +%s).png; screencapture -x \"$f\" && curl -sS -X PUT --data-binary @\"$f\" -H \"x-terminal-key: ${TERMINAL_KEY}\" \"https://miscsubjects.com/api/file_upload?key=$(basename \"$f\")\""],"timeout":60000}', 'terminal', 50, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_CLIPBOARD_GET', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Read the Mac clipboard (pbpaste). No args. when_to_use: "what''s on my clipboard".
{"cmd":"pbpaste","args":[],"timeout":10000}', 'terminal', 60, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_CLIPBOARD_SET', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Put text on the Mac clipboard (pbcopy). Args: the text (pipes survive). when_to_use: "copy X to my clipboard".
{"cmd":"pbcopy","args":[],"stdin":"$1+","timeout":10000}', 'terminal', 60, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_OPEN', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# macOS open: launch an app, file, or URL on the Mac. Args: target, e.g. "https://x.com" or "-a Safari". when_to_use: "open X on my mac".
{"cmd":"sh","args":["-lc","open $1+"],"timeout":15000}', 'terminal', 60, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_SAY', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Speak text aloud on the Mac (say). Args: the text. when_to_use: audible ping at the desk.
{"cmd":"say","args":["$1+"],"timeout":60000}', 'terminal', 70, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_OSASCRIPT', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Run one line of AppleScript on the Mac (osascript -e). Args: the script. Needs Accessibility for UI scripting. when_to_use: app automation — "pause Spotify", "get Safari''s front tab URL".
{"cmd":"osascript","args":["-e","$1+"],"timeout":60000}', 'terminal', 60, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_CAFFEINATE', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Keep the Mac awake for N seconds (caffeinate -dimsu, backgrounded). Args: seconds. when_to_use: before long CLI_* jobs so the bridge stays reachable.
{"cmd":"sh","args":["-lc","(caffeinate -dimsu -t $1 >/dev/null 2>&1 &) && echo keeping Mac awake for $1 seconds"],"timeout":10000}', 'terminal', 65, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_OCR', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# OCR an image to text (tesseract). Args: a local path on the Mac OR an https URL (downloaded first). when_to_use: reading text out of a screenshot or photo.
{"cmd":"sh","args":["-lc","in=/tmp/ocr-in-$(date +%s); case \"$1\" in http*) curl -sSL \"$1\" -o \"$in\";; *) cp $1 \"$in\";; esac; tesseract \"$in\" - 2>/dev/null"],"timeout":60000}', 'terminal', 60, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LOCAL_DOWNLOAD', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Download a URL to a path on the Mac. Args: url|path. when_to_use: pulling an installer, asset, or dataset onto his machine.
{"cmd":"sh","args":["-lc","curl -sSL \"$1\" -o $2 && ls -la $2"],"timeout":300000}', 'terminal', 60, strftime('%Y-%m-%dT%H:%M:%fZ','now'))

ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- ───────────────────────── DOMAIN: CLI_* (agentic CLI workers) ──────────────

INSERT INTO directory (key, type, target, auth, content, category, planner_rank, updated_at) VALUES
('CLI_CLAUDE_CODE', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Run Claude Code headless on the Mac — a full coding agent with file edit + shell. Args: task|cwd (cwd empty = home; use /Users/owner/miscsubjects-pages for the build repo). Strongest worker for multi-step repo reasoning: reviews, refactors, debugging. 20-min cap. On flag errors run LOCAL_HELP claude.
{"cmd":"claude","args":["-p","$1","--output-format","text","--dangerously-skip-permissions"],"cwd":"$2","timeout":1200000}', 'cli', 20, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('CLI_CODEX', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Run OpenAI Codex CLI non-interactively on the Mac. Args: task|cwd. Second opinion / parallel worker to CLI_CLAUDE_CODE. Needs OpenAI auth on the Mac (codex login). On flag errors run LOCAL_HELP codex.
{"cmd":"codex","args":["exec","--full-auto","$1"],"cwd":"$2","timeout":1200000}', 'cli', 55, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('CLI_GEMINI', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Run Google Gemini CLI non-interactively on the Mac. Args: task|cwd. Good for long-context summarization of big trees. Needs Google auth on the Mac. On flag errors run LOCAL_HELP gemini.
{"cmd":"gemini","args":["-p","$1","--yolo"],"cwd":"$2","timeout":1200000}', 'cli', 55, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('CLI_GROK_XAI', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Run xAI''s official Grok CLI (~/.grok/bin/grok) non-interactively. Args: task|cwd. Uses the owner''s xAI auth. Flags may drift — on error run LOCAL_HELP grok and EDIT_ROW this template.
{"cmd":"/Users/owner/.grok/bin/grok","args":["-p","$1"],"cwd":"$2","timeout":1200000}', 'cli', 55, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('CLI_GROK_SA', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Run the superagent-ai grok-cli build (~/.superagent-grok/bin/grok, via bun). Args: task|cwd. Parallel install to the xAI CLI — never collides with it. On error run LOCAL_HELP on the full path.
{"cmd":"bun","args":["/Users/owner/.superagent-grok/bin/grok","--prompt","$1"],"cwd":"$2","timeout":1200000}', 'cli', 60, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('CLI_AIDER', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Run Aider (git-aware pair programmer) one-shot on the Mac. Args: task|cwd. Makes edits without committing (--no-auto-commits). Needs a model API key in the Mac env. On flag errors run LOCAL_HELP aider.
{"cmd":"aider","args":["--message","$1","--yes-always","--no-auto-commits"],"cwd":"$2","timeout":1200000}', 'cli', 60, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('CLI_PLANDEX', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Run Plandex on the Mac. Args: task|cwd. NOT INSTALLED YET (plandex.ai unreachable 2026-06-11) — installing it makes this row live without edits.
{"cmd":"plandex","args":["tell","$1"],"cwd":"$2","timeout":1200000}', 'cli', 80, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('CLI_INTERPRETER', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Run Open Interpreter (local code execution agent) one-shot. Args: task. Needs a model API key in the Mac env. On flag errors run LOCAL_HELP interpreter.
{"cmd":"interpreter","args":["-y","$1"],"timeout":1200000}', 'cli', 65, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('CLI_GOOSE', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Run Block''s goose agent. Args: task|cwd. NOT INSTALLED YET — brew install block-goose-cli (or see github.com/block/goose) makes this row live.
{"cmd":"goose","args":["run","-t","$1"],"cwd":"$2","timeout":1200000}', 'cli', 80, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('CLI_OPENHANDS', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Run OpenHands (all-hands.dev) agent. Args: task|cwd. NOT INSTALLED YET — pip3 install --user openhands-ai makes this row live.
{"cmd":"openhands","args":["-t","$1"],"cwd":"$2","timeout":1200000}', 'cli', 80, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('CLI_GH_COPILOT', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# gh copilot suggest — one-line shell suggestions. Args: question. Needs the gh-copilot extension (gh extension install github/gh-copilot).
{"cmd":"gh","args":["copilot","suggest","$1"],"timeout":60000}', 'cli', 75, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('CLI_GH', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Run any gh (GitHub CLI) command on the Mac with the owner''s auth. Args: the gh arguments, e.g. "pr list --repo [OWNER_HANDLE]/miscsubjects-pages" or "run list --limit 5". when_to_use: PRs, issues, Actions runs, releases — richer than the GITHUB_* HTTP rows.
{"cmd":"sh","args":["-lc","gh $1+"],"timeout":120000}', 'cli', 40, strftime('%Y-%m-%dT%H:%M:%fZ','now'))

ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- ───────────────────────── DOMAIN: DESKTOP_* / BROWSER_* ────────────────────

INSERT INTO directory (key, type, target, auth, content, category, planner_rank, updated_at) VALUES
('DESKTOP_SHOT', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Alias of LOCAL_SCREENSHOT: screenshot the Mac, upload to R2, return {url}. No args. Needs Screen Recording granted once.
{"cmd":"sh","args":["-lc","f=/tmp/shot-$(date +%s).png; screencapture -x \"$f\" && curl -sS -X PUT --data-binary @\"$f\" -H \"x-terminal-key: ${TERMINAL_KEY}\" \"https://miscsubjects.com/api/file_upload?key=$(basename \"$f\")\""],"timeout":60000}', 'desktop', 55, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('DESKTOP_CLICK', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Click at screen coordinates on the Mac (System Events). Args: x|y. Needs Accessibility granted once. Take DESKTOP_SHOT first to find coordinates.
{"cmd":"osascript","args":["-e","tell application \"System Events\" to click at {$1, $2}"],"timeout":15000}', 'desktop', 60, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('DESKTOP_TYPE', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Type text into the focused app on the Mac (System Events keystroke). Args: the text (avoid double quotes — they break the AppleScript literal). Needs Accessibility granted once.
{"cmd":"osascript","args":["-e","tell application \"System Events\" to keystroke \"$1\""],"timeout":15000}', 'desktop', 60, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('BROWSER_FETCH', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Fetch a URL from the Mac (curl, first 20000 bytes). Args: url. when_to_use: reading a page/API from the owner''s own IP instead of Cloudflare''s.
{"cmd":"sh","args":["-lc","curl -sSL \"$1\" | head -c 20000"],"timeout":60000}', 'desktop', 55, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('BROWSER_PLAYWRIGHT', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Run a Playwright CLI command on the Mac (npx -y playwright …). Args: the playwright arguments, e.g. "screenshot https://x.com /tmp/x.png". First run downloads browsers (~2 min). For full browser automation absorb the playwright MCP server via MCP_PROBE.
{"cmd":"sh","args":["-lc","npx -y playwright $1+"],"timeout":600000}', 'desktop', 65, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('BROWSER_USE', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Run the browser-use agent (AI browser driver). Args: task. NOT INSTALLED YET — pip3 install --user browser-use + an API key in the Mac env makes this row live.
{"cmd":"sh","args":["-lc","python3 -m browser_use \"$1\""],"timeout":600000}', 'desktop', 80, strftime('%Y-%m-%dT%H:%M:%fZ','now'))

ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- COMPUTER_USE_REMOTE — documented stub (sandboxed-VM loop, not the Mac).
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, updated_at) VALUES
('COMPUTER_USE_REMOTE', 'fn', 'noop', '',
'# Anthropic computer-use (sandboxed VM, NOT the owner''s Mac). Not wired: needs ANTHROPIC_API_KEY plus a VM loop the directory cannot express in one call. For the owner''s Mac use DESKTOP_SHOT / DESKTOP_CLICK / DESKTOP_TYPE.
["COMPUTER_USE_REMOTE is not wired yet. Needs ANTHROPIC_API_KEY + a VM loop. Use DESKTOP_SHOT/DESKTOP_CLICK/DESKTOP_TYPE for the Mac."]', 'desktop', 90, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- ───────────────────────── DOMAIN: MCP_* (MCP server absorption) ────────────

INSERT INTO directory (key, type, target, auth, content, category, planner_rank, updated_at) VALUES
('MCP_LIST', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# List MCP servers registered with the xAI grok CLI on the Mac. No args. If the subcommand drifted, run LOCAL_HELP grok.
{"cmd":"sh","args":["-lc","~/.grok/bin/grok mcp list 2>&1"],"timeout":60000}', 'mcp', 50, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('MCP_ADD', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Register an MCP server with the grok CLI. Args: name|command (e.g. fetch|npx -y @modelcontextprotocol/server-fetch). Follow with MCP_TEST to read its tools/list.
{"cmd":"sh","args":["-lc","~/.grok/bin/grok mcp add $1 $2+ 2>&1"],"timeout":120000}', 'mcp', 55, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('MCP_TEST', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Connect to a registered MCP server and return its tools/list. Args: name. Each listed tool becomes one ADD_ROW proposal (key MCP_<server>_<tool>).
{"cmd":"sh","args":["-lc","~/.grok/bin/grok mcp test $1 2>&1"],"timeout":120000}', 'mcp', 55, strftime('%Y-%m-%dT%H:%M:%fZ','now'))

ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- Named MCP server stubs: each documents the exact MCP_PROBE call that wires it.
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, updated_at) VALUES
('MCP_FS', 'fn', 'noop', '', '# Filesystem MCP server — read/write/list anywhere on disk over MCP. Not wired yet: run [MCP_PROBE]fs|npx -y @modelcontextprotocol/server-filesystem /Users/owner[/MCP_PROBE]. Until then LOCAL_READ/LOCAL_WRITE/LOCAL_LIST cover the same ground.
["MCP_FS not wired. Run [MCP_PROBE]fs|npx -y @modelcontextprotocol/server-filesystem /Users/owner[/MCP_PROBE]. LOCAL_READ/LOCAL_WRITE/LOCAL_LIST already cover files."]', 'mcp', 85, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('MCP_GITHUB', 'fn', 'noop', '', '# GitHub MCP server — repos/PRs/issues over MCP. Not wired yet: run [MCP_PROBE]github|npx -y @modelcontextprotocol/server-github[/MCP_PROBE]. Until then CLI_GH and the GITHUB_* rows cover it.
["MCP_GITHUB not wired. Run [MCP_PROBE]github|npx -y @modelcontextprotocol/server-github[/MCP_PROBE]. CLI_GH + GITHUB_* rows already cover GitHub."]', 'mcp', 85, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('MCP_FETCH', 'fn', 'noop', '', '# Fetch MCP server — URL to markdown. Not wired yet: run [MCP_PROBE]fetch|npx -y @modelcontextprotocol/server-fetch[/MCP_PROBE]. Until then BROWSER_FETCH covers it.
["MCP_FETCH not wired. Run [MCP_PROBE]fetch|npx -y @modelcontextprotocol/server-fetch[/MCP_PROBE]. BROWSER_FETCH already fetches URLs."]', 'mcp', 85, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('MCP_BRAVE_SEARCH', 'fn', 'noop', '', '# Brave Search MCP server — web search over MCP (needs BRAVE_API_KEY). Not wired yet: run [MCP_PROBE]brave|env BRAVE_API_KEY=<key> npx -y @modelcontextprotocol/server-brave-search[/MCP_PROBE]. Grok''s built-in web_search already covers search.
["MCP_BRAVE_SEARCH not wired. Needs BRAVE_API_KEY. Grok web_search already covers this."]', 'mcp', 90, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('MCP_MEMORY', 'fn', 'noop', '', '# Memory MCP server — cross-session knowledge graph. Not wired yet: run [MCP_PROBE]memory|npx -y @modelcontextprotocol/server-memory[/MCP_PROBE]. KV_* rows + convo memory already persist state.
["MCP_MEMORY not wired. Run [MCP_PROBE]memory|npx -y @modelcontextprotocol/server-memory[/MCP_PROBE]. KV_* rows already persist state."]', 'mcp', 90, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('MCP_SEQUENTIAL', 'fn', 'noop', '', '# Sequential-thinking MCP server — structured reasoning helper. Not wired yet: run [MCP_PROBE]seq|npx -y @modelcontextprotocol/server-sequential-thinking[/MCP_PROBE].
["MCP_SEQUENTIAL not wired. Run [MCP_PROBE]seq|npx -y @modelcontextprotocol/server-sequential-thinking[/MCP_PROBE]."]', 'mcp', 90, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('MCP_PLAYWRIGHT', 'fn', 'noop', '', '# Playwright MCP server — full scriptable browser over MCP. Not wired yet: run [MCP_PROBE]playwright|npx -y @playwright/mcp[/MCP_PROBE]. BROWSER_PLAYWRIGHT covers one-shot CLI use.
["MCP_PLAYWRIGHT not wired. Run [MCP_PROBE]playwright|npx -y @playwright/mcp[/MCP_PROBE]. BROWSER_PLAYWRIGHT covers one-shot use."]', 'mcp', 85, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('MCP_COMPUTER_USE', 'fn', 'noop', '', '# Anthropic computer-use MCP. Not wired: needs ANTHROPIC_API_KEY + a sandboxed VM. DESKTOP_* rows cover the owner''s Mac.
["MCP_COMPUTER_USE not wired. Needs ANTHROPIC_API_KEY + VM. DESKTOP_* rows cover the Mac."]', 'mcp', 90, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- ───────────────────────── DOMAIN: REPO_* + flows (continuous absorption) ───

INSERT INTO directory (key, type, target, auth, content, category, planner_rank, updated_at) VALUES
('REPO_SNAPSHOT', 'fn', 'kvGetJson',  '',
'# Read the current repo snapshot from KV: {sha, ts, byte_count, content}. No args. The same snapshot is already prepended to every agent prompt — call this only when you need the raw blob explicitly (e.g. to grep it with code).
["repo:snapshot:current"]', 'repo', 60, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('REPO_ABSORB', 'flow', '', '',
'# Absorb a GitHub repo into directory rows on the owner''s voice command. Args: a GitHub URL or owner/repo plus any extra instruction. Hands the job to SCOUT, which clones to ~/_absorbed/, reads README/AGENTS.md, ADD_ROWs working rows, smokes one call, reports.
SCOUT:Absorb this GitHub repo into directory rows. Clone it to ~/_absorbed/ via LOCAL_EXEC, read its README and AGENTS.md/SKILL.md via LOCAL_READ, then ADD_ROW one working row per useful capability (CLI_<NAME> shape, bridge conventions), smoke-test one row, and report what you added in [REPLY]: $1+', 'repo', 55, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('MCP_PROBE', 'flow', '', '',
'# Wire an MCP server end-to-end: register it, read its tools/list, have SCOUT ADD_ROW one row per tool. Args: name|install-command (e.g. fetch|npx -y @modelcontextprotocol/server-fetch).
MCP_ADD:$1|$2+ > MCP_TEST:$1 > SCOUT:This is the tools/list output of the MCP server named $1. For each tool, ADD_ROW a directory row MCP_$1_<tool> (http row POSTing to the bridge that invokes the tool via ~/.grok/bin/grok mcp call, or a documented stub if invocation is not possible yet), then report what you added in [REPLY]. Output: $PREV', 'mcp', 55, strftime('%Y-%m-%dT%H:%M:%fZ','now'))

ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- ───────────────────────── SCOUT agent (Phase I3 / F4) ──────────────────────

INSERT INTO directory (key, type, target, auth, content, category, allowed_categories, planner_rank, updated_at) VALUES
('SCOUT', 'agent', 'grok-4.3', 'bearer:GROK_API_KEY',
'You are SCOUT — you hunt new tools for the owner''s build and absorb them as directory rows: agentic CLIs, MCP servers, useful GitHub repos.

The user sees ONLY [REPLY]...[/REPLY]. READ moves (search, clone, read files) emit ONLY tool tags — no [REPLY]/[DONE] until the results come back next turn. Then phrase [REPLY] and end [DONE].

TOOLS: [GITHUB_SEARCH_CODE]query[/GITHUB_SEARCH_CODE] · [GITHUB_REPO_GET]owner/repo[/GITHUB_REPO_GET] · [GITHUB_GET_FILE]args[/GITHUB_GET_FILE] · [GITHUB_LIST_TREE]args[/GITHUB_LIST_TREE] · web search (built in when enabled) · [LOCAL_EXEC]shell line on the owner''s Mac[/LOCAL_EXEC] (clone to ~/_absorbed/<name>, run --help, npx -y <pkg>) · [LOCAL_READ]path[/LOCAL_READ] · [MCP_ADD]name|cmd[/MCP_ADD] · [MCP_TEST]name[/MCP_TEST] · [ADD_ROW]key|type|target|auth|content[/ADD_ROW] · [EDIT_ROW]same[/EDIT_ROW].

JOB SHAPES:
1. "find me an MCP / CLI / tool for X": search, return up to 5 candidates ranked by stars, last-commit recency, and fit. For each: one line on what it does + the exact ADD_ROW or MCP_PROBE call that absorbs it. Put the ranked list in [REPLY].
2. "absorb <repo or server>": clone/install on the Mac via LOCAL_EXEC, read README + AGENTS.md/SKILL.md, ADD_ROW working rows, smoke-test one call, report what you added and the smoke result in [REPLY].

ROW CONVENTIONS (follow exactly): http rows → target "METHOD url", auth one of bearer:ENV / basic:ENV / headers:{"k":"$ENV"} / query:param=ENV, content = "# one-paragraph docs incl. when_to_use" then a JSON body template with $1/$2/$N+ positionals. Mac commands run as rows POSTing {"cmd":"sh","args":["-lc","…"]} to https://agent.cannibal.capital/exec with auth headers:{"x-terminal-key":"$TERMINAL_KEY"}. Never include a permission_tier field. Never overwrite an existing key with ADD_ROW — check [TOOLS_SEARCH]key[/TOOLS_SEARCH] first.',
'llm', '*', 30,
strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  allowed_categories=excluded.allowed_categories,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- ───────────────────────── Phase F: ROUTER + OPS prompt appends ─────────────
-- Append-only edits (idempotent: skipped if the marker text already exists).

UPDATE directory SET
  content = content || '

[TERMINUS]...[/TERMINUS] — terminal / Mac / infrastructure: running commands or scripts on the owner''s Mac, files or processes on his machine, coding agents (claude/codex/gemini/aider) working a repo, screenshots of his screen, installed apps, bridge health, deploys, Cloudflare or GitHub surgery, "audit yourself", "burn down". Same rule as the other modes: tag body = the entire input, no [REPLY].

Messages starting with /t, /exec, /terminal, /run or /help never reach you — the channel adapter pre-dispatches them straight to the Mac bridge.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key = 'ROUTER' AND content NOT LIKE '%[TERMINUS]...%';

UPDATE directory SET
  content = content || '

TERMINAL ANNEX — the owner''s Mac is now a tool surface. LOCAL_* rows run shell lines, files, processes, clipboard, screenshots on his Mac through the bridge ([LOCAL_EXEC]any shell line[/LOCAL_EXEC] is the universal one). CLI_* rows run whole coding agents — [CLI_CLAUDE_CODE]task|/Users/owner/miscsubjects-pages[/CLI_CLAUDE_CODE] is the strongest for repo work; prefer CLI_<AGENT> over LOCAL_EXEC for anything multi-step on a repo. DESKTOP_* clicks/types/screenshots. MCP_* + [MCP_PROBE]name|install-cmd[/MCP_PROBE] absorb MCP servers; [REPO_ABSORB]repo[/REPO_ABSORB] absorbs GitHub repos. Discover all of it with [TOOLS_IN]terminal|30[/TOOLS_IN], [TOOLS_IN]cli|20[/TOOLS_IN], [TOOLS_SEARCH]query|20[/TOOLS_SEARCH]. When a CLI errors with an unknown flag: [LOCAL_HELP]binary[/LOCAL_HELP] then EDIT_ROW the template. Heavy terminal/infrastructure asks: hand to [TERMINUS]full context[/TERMINUS] exactly like you hand creative work to [ARCADS].',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key = 'OPS' AND content NOT LIKE '%TERMINAL ANNEX%';

UPDATE directory SET
  allowed_categories = allowed_categories || ',terminal,cli,desktop,mcp,repo',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key = 'OPS' AND allowed_categories NOT LIKE '%terminal%';

-- TWOCHAT_SEND: text is the LAST arg — carry embedded pipes with $3+ so /t
-- terminal output (which often contains |) is not truncated on WhatsApp.
UPDATE directory SET
  content = REPLACE(content, '"text":"$3"', '"text":"$3+"'),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key = 'TWOCHAT_SEND' AND content LIKE '%"text":"$3"%';

-- ───────────────────────── Phase G: capability_tests rows ───────────────────

INSERT OR REPLACE INTO capability_tests (seq, feature, prompt, expect) VALUES
(17, 'G1 terminal prefix /t', '/t echo hello world', 'Reply contains "hello world" — channel adapter pre-dispatches LOCAL_EXEC through the bridge, no ROUTER turn.'),
(18, 'G2 LOCAL_PS via OPS/TERMINUS', 'whats running on my mac right now', 'Routed turn calls LOCAL_PS (or LOCAL_EXEC ps) and replies with a readable process summary.'),
(19, 'G3 screenshot', 'screenshot my screen', 'LOCAL_SCREENSHOT fires; reply carries a https://miscsubjects.com/img/up/... link (fails until macOS Screen Recording is granted).'),
(20, 'G4 CLI_CLAUDE_CODE review', 'have claude review the last commit in miscsubjects-pages', 'CLI_CLAUDE_CODE runs on the repo; reply is a multi-paragraph review.'),
(21, 'G5 self-extension ADD_ROW', 'make a tool that lists my open cloudflare workers', 'Agent reuses CF_WORKERS_LIST or ADD_ROWs a new row, smokes it, and replies with the result.'),
(22, 'G6 self-audit', 'audit yourself - what did you do in the last hour', 'Agent reads LEDGER tails (GROK_LEDGER_TAIL / LOG_TAIL) and replies with a narrative summary.'),
(23, 'G7 TERMINUS end-to-end deploy', 'terminus: check the latest deploy of miscsubjects and redeploy if needed', 'ROUTER routes [TERMINUS]; TERMINUS checks CF_PAGES_DEPLOYMENTS / runs the deploy via LOCAL_EXEC without any confirm gate, replies with the result.');
