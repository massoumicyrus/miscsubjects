-- Fix tool descriptions to match the build pattern: WHAT, WHEN_TO_USE, ARGS, EX
-- Focus on the most commonly used tools first.

-- Core tools that every model needs to know
UPDATE directory SET content = '# WHAT: Append a task to the build queue. Useful when the model cannot do something now and needs to remember it.
# WHEN_TO_USE: the user says "remind me", "add a task", "todo", or the model needs to defer work.
# ARGS: body=$1 (the task text). Optional: priority as second arg.
# EX: [ADDTASK]review the stripe code[/ADDTASK]
["$1","ADDTASK"]'
WHERE key = 'ADDTASK';

UPDATE directory SET content = '# WHAT: Insert a new row into the directory (tools, agents, flows).
# WHEN_TO_USE: creating a new tool, agent, or flow from the model.
# ARGS: key|type|target|auth|content. Everything after the 4th pipe is content.
# EX: [ADD_ROW]MY_TOOL|fn|myFn||# What it does\n["$1"][/ADD_ROW]
["$1","$2","$3","$4","$5+"]'
WHERE key = 'ADD_ROW';

UPDATE directory SET content = '# WHAT: Run a shell command on the owner Mac.
# WHEN_TO_USE: any file operation, git command, system check, or script execution.
# ARGS: $1 = the shell command (pipes, &&, redirects allowed).
# EX: [LOCAL_EXEC]ls -la ~/Desktop[/LOCAL_EXEC] [LOCAL_EXEC]git status[/LOCAL_EXEC]
{"command":"$1"}'
WHERE key = 'LOCAL_EXEC';

UPDATE directory SET content = '# WHAT: Read a file on the owner Mac.
# WHEN_TO_USE: the user says "show me", "read", "what is in", "display".
# ARGS: $1 = absolute path.
# EX: [LOCAL_READ]/Users/owner/STATE.md[/LOCAL_READ]
{"path":"$1"}'
WHERE key = 'LOCAL_READ';

UPDATE directory SET content = '# WHAT: Read one directory row by key.
# WHEN_TO_USE: the user asks about a specific tool, agent, or setting.
# ARGS: $1 = the row key.
# EX: [DIR_GET]ROUTER[/DIR_GET]
{"key":"$1"}'
WHERE key = 'DIR_GET';

UPDATE directory SET content = '# WHAT: Search the directory for tools by keyword.
# WHEN_TO_USE: the user asks "do you have X", "find a tool", or the model needs a capability.
# ARGS: keyword|limit (limit optional, default 20).
# EX: [TOOLS_SEARCH]deploy|5[/TOOLS_SEARCH]
{"q":"$1","limit":"$2"}'
WHERE key = 'TOOLS_SEARCH';

UPDATE directory SET content = '# WHAT: List all tool categories.
# WHEN_TO_USE: the user asks "what can you do" or "what categories".
# ARGS: none.
# EX: [CATEGORIES][/CATEGORIES]
{}'
WHERE key = 'CATEGORIES';

UPDATE directory SET content = '# WHAT: Edit an existing directory row (upsert).
# WHEN_TO_USE: changing a tool definition, updating a prompt, or fixing a row.
# ARGS: key|type|target|auth|content. Everything after the 4th pipe is content.
# EX: [EDIT_ROW]ROUTER|agent|grok-4.3|bearer:GROK_API_KEY|new prompt here[/EDIT_ROW]
["$1","$2","$3","$4","$5+"]'
WHERE key = 'EDIT_ROW';

UPDATE directory SET content = '# WHAT: Delete a directory row.
# WHEN_TO_USE: removing a tool that is broken, stale, or unwanted.
# ARGS: $1 = the row key.
# EX: [DEL_ROW]OLD_TOOL[/DEL_ROW]
{"key":"$1"}'
WHERE key = 'DEL_ROW';

UPDATE directory SET content = '# WHAT: Run a SELECT query on the D1 database.
# WHEN_TO_USE: any read operation on D1 tables.
# ARGS: $1 = SQL query. Subsequent args are bound parameters.
# EX: [D1_QUERY]SELECT * FROM directory WHERE key = ?[/D1_QUERY]
["$1","$2+"]'
WHERE key = 'D1_QUERY';

UPDATE directory SET content = '# WHAT: Run a non-SELECT D1 query (INSERT/UPDATE/DELETE).
# WHEN_TO_USE: writing data to D1.
# ARGS: $1 = SQL. Subsequent args are bound parameters.
# EX: [D1_EXEC]UPDATE directory SET content = ? WHERE key = ?[/D1_EXEC]
["$1","$2+"]'
WHERE key = 'D1_EXEC';

-- Disable rows that are clearly garbage: {{SHARED}} with no content, auto-generated noise
UPDATE directory SET enabled = 0, planner_visible = 0 WHERE content LIKE '{{SHARED}}' AND target LIKE '%grok-4.3%';

-- Disable rows that have no description at all (just JSON or empty)
UPDATE directory SET enabled = 0, planner_visible = 0 
WHERE (content IS NULL OR content = '' OR content LIKE '[%') 
AND key NOT IN ('ADDTASK','KV_LIST','KV_GET_JSON','KV_PUT_JSON','KV_APPEND','R2_PUT','R2_GET','R2_DEL','R2_LIST','REGEX_PARSE');

-- Fix the GAPI_ rows that are just "# WHAT:" with no invoke pattern
UPDATE directory SET content = '# WHAT: Google Workspace API call (auto-generated, likely unused). 
# WHEN_TO_USE: Google Workspace integration.
# ARGS: varies by endpoint. Check docs.
# EX: [GAPI_EXAMPLE]param[/GAPI_EXAMPLE]
' || content, planner_visible = 0 WHERE key LIKE 'GAPI_%' AND planner_visible = 1;

-- Fix CF row to be clear
UPDATE directory SET content = '# WHAT: Cloudflare REST API unified entrypoint. 256+ operations.
# WHEN_TO_USE: any Cloudflare API call (KV, D1, R2, Workers, DNS, etc.).
# ARGS: operation|account_id|... (first arg selects the sub-operation from the target_map).
# EX: [CF]kv_list_keys|my_account_id[/CF] [CF]d1_query|my_account_id|my_db_id|SELECT * FROM t[/CF]
' || content WHERE key = 'CF';
