-- 0110: Tool cleanup — consolidate NPM, disable GAPI, add missing rows, fix broken descriptions

-- 1. Disable all google_api rows (auto-generated GAPI_* + Google REST surface, likely unused)
UPDATE directory SET enabled = 0 WHERE category = 'google_api';

-- 2. Delete all individual NPM_* rows (66 rows → 1 unified row)
DELETE FROM directory WHERE key LIKE 'NPM_%';

-- 3. Create unified NPM row
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, updated_at, enabled, planner_visible) VALUES
('NPM', 'http', 'POST https://agent.<bridge-domain>/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# WHAT: Run any npm command on the Mac bridge. Args: command + args (e.g. "install --save-dev typescript" or "audit --fix").
# WHEN_TO_USE: package management, dependency install, npm audit, npm publish, npm run, etc.
# ARGS: command + args
# EX: [NPM]install --save-dev typescript[/NPM]
{"cmd":"sh","args":["-lc","cd /Users/owner/miscsubjects-pages && npm $1+"],"timeout":300000}', 'npm', datetime('now'), 1, 1);

-- 4. Fix broken KV_DEL description (truncated in 0108)
UPDATE directory SET content = '# WHAT: KV delete by key. e.g. directory:snapshot
# WHEN_TO_USE: invalidate a cached value (e.g. after manual edits to a row that got cached)
# ARGS: $1
# EX: [KV_DEL]arg1[/KV_DEL]
["$1"]' WHERE key = 'KV_DEL';

-- 5. Update THREAD_GET to standard format (never updated in 0108)
UPDATE directory SET content = '# WHAT: Read one thread fully.
# WHEN_TO_USE: you need to read a thread
# ARGS: id
# EX: [THREAD_GET]42[/THREAD_GET]
["$1"]' WHERE key = 'THREAD_GET';

-- 6. Add missing agent limit rows (referenced by ROUTER but never created as directory rows)
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, updated_at, enabled, planner_visible) VALUES
('SET_TOOL_LOOPS', 'fn', 'setAgentLimits', '', '# WHAT: Set how many tool calls the agent may make per turn (1-40). Arg: the number.
# WHEN_TO_USE: the owner says "more tool loops" / "less tool loops" / "max 15 tools".
# ARGS: $1
# EX: [SET_TOOL_LOOPS]15[/SET_TOOL_LOOPS]
["$1",null,null,null]', 'limits', datetime('now'), 1, 1),
('SET_MEMORY_WINDOW', 'fn', 'setAgentLimits', '', '# WHAT: Set how many prior turns the agent recalls (0-100). Arg: the number.
# WHEN_TO_USE: the owner says "remember more messages" / "keep the last 30".
# ARGS: $1
# EX: [SET_MEMORY_WINDOW]30[/SET_MEMORY_WINDOW]
[null,"$1",null,null]', 'limits', datetime('now'), 1, 1),
('SET_DEPTH_CAP', 'fn', 'setAgentLimits', '', '# WHAT: Set max recursion depth (1-10). Arg: the number.
# WHEN_TO_USE: the owner says "deeper reasoning" / "only 2 levels deep".
# ARGS: $1
# EX: [SET_DEPTH_CAP]5[/SET_DEPTH_CAP]
[null,null,"$1",null]', 'limits', datetime('now'), 1, 1),
('SET_COST_CAP', 'fn', 'setAgentLimits', '', '# WHAT: Set per-turn USD cost cap (min 0.01). Arg: dollars.
# WHEN_TO_USE: the owner says "cheaper turns" / "cap cost at $0.50".
# ARGS: $1
# EX: [SET_COST_CAP]0.50[/SET_COST_CAP]
[null,null,null,"$1"]', 'limits', datetime('now'), 1, 1),
('GET_AGENT_LIMITS', 'fn', 'getAgentLimits', '', '# WHAT: Read current agent limits: tool_loops, memory_window, depth_cap, cost_cap_usd.
# WHEN_TO_USE: the owner asks "what are my limits" / "what are your caps".
# ARGS: none
# EX: [GET_AGENT_LIMITS][/GET_AGENT_LIMITS]
[]', 'limits', datetime('now'), 1, 1);

-- 7. Add LOCAL_HELP (referenced by many CLI_* / LOCAL_* tools but never defined as a row)
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, updated_at, enabled, planner_visible) VALUES
('LOCAL_HELP', 'http', 'POST https://agent.<bridge-domain>/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# WHAT: Print the --help / -h / man page of a binary on the Mac. Args: binary name.
# WHEN_TO_USE: "how do I use X", "what flags does X have", "X --help".
# ARGS: $1
# EX: [LOCAL_HELP]claude[/LOCAL_HELP]
{"cmd":"sh","args":["-lc","$1 --help 2>&1 || $1 -h 2>&1 || man $1 2>&1 | head -100"],"timeout":30000}', 'terminal', datetime('now'), 1, 1);

-- 8. Add CODE_AUDIT agent row (referenced by ROUTER, exists as prompt file only)
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, allowed_categories, planner_rank, updated_at, enabled, planner_visible) VALUES
('CODE_AUDIT', 'agent', 'grok-4.3', 'bearer:GROK_API_KEY',
'You are CODE_AUDIT — auditor of the repo at /Users/owner/miscsubjects-pages. You find code/files NOT in use and propose exact removals. You propose; never edit or delete.

Always use absolute paths rooted at /Users/owner/miscsubjects-pages (the Mac default cwd is the HOME dir, not the repo). Budget ~20 loops: inventory first, then targeted greps, then propose by loop 15.

Loop 1 inventory: [LOCAL_EXEC]git ls-files | sed ''s#/.*##'' | sort | uniq -c[/LOCAL_EXEC]
Then per suspect: [LOCAL_LIST]/Users/owner/miscsubjects-pages/<dir>[/LOCAL_LIST], [LOCAL_READ]<abs path>[/LOCAL_READ], [LOCAL_GREP]<symbol-or-filename>|/Users/owner/miscsubjects-pages[/LOCAL_GREP].

UNUSED = a functions/ file for a route nothing links to or that duplicates another; an exported function never imported; a FN_MAP handler with no directory row and no internal caller; backup/dup files (*.backup.md, *.sql.bak, duplicate migration numbers); reference-only trees not in the runtime (archive/, apps-script/, docs/); test/junk directory rows. VERIFY each with a grep this run and quote the grep count in your reasoning. NEVER claim unused without the grep.

By loop 15 (or sooner if done) emit your reply as a numbered list; each item: path | why unused (grep evidence) | exact removal (rm <abs path> / DEL_ROW <key> / move out of repo). Then say audit complete. Converge — do not loop forever.

TOOLS: [LOCAL_EXEC]<shell line>[/LOCAL_EXEC] · [LOCAL_LIST]<path>[/LOCAL_LIST] · [LOCAL_READ]<path>[/LOCAL_READ] · [LOCAL_GREP]<pattern>|<path>[/LOCAL_GREP] · [TOOLS_SEARCH]<keyword>|10[/TOOLS_SEARCH] · [DIRECTORY]<category>[/DIRECTORY]', 'llm', '*', 30, datetime('now'), 1, 1);

-- 9. Add CC_MIRROR agent row (referenced by ROUTER, exists as prompt file only)
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, allowed_categories, planner_rank, updated_at, enabled, planner_visible) VALUES
('CC_MIRROR', 'agent', 'grok-4.3', 'bearer:GROK_API_KEY',
'You are CC_MIRROR. You learn from Claude Code''s sessions on this repo and propose how THIS build could do the same work itself.

Load Claude Code''s recent activity FIRST: [D1_QUERY]SELECT id, ts, session, user_input, tools_json, files_json FROM cc_turns ORDER BY id DESC LIMIT 5[/D1_QUERY].

For the most recent turn: (a) summarize what the user asked Claude Code and what Claude Code did — which tools, which files. (b) For each capability Claude Code used (edit a file, run a shell command, query D1, deploy, patch a directory row), check whether THIS build has an equivalent tool: [TOOLS_SEARCH]<capability keyword>|10[/TOOLS_SEARCH]. (c) Note what the build HAS (the exact key) and what it LACKS.

Then PROPOSE 2-4 concrete edits or features the build could make to solve the same problem or similar ones in the same area — each one line: the exact tool it would use (FILE_PUT / EDIT_ROW / ADD_ROW / LOCAL_WRITE / DIR_PATCH) and what it would change. You PROPOSE; you do not execute unless told.

Reply with four short sections: WHAT CLAUDE CODE DID / WHAT I HAVE / WHAT I LACK / PROPOSALS. Converge within your loop budget, then say mirror complete.', 'llm', '*', 30, datetime('now'), 1, 1);
