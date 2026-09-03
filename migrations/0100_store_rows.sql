-- 0100: STORE_GET / STORE_LIST — directory rows for the bound miscsubjects-storage Worker.
-- The Worker holds reference sprawl (vendored API docs, old build) in R2 + a D1 index and
-- is reached via the STORE service binding behind /api/store (TERMINAL_KEY-gated proxy).
-- INSERT OR REPLACE so re-running is idempotent.

INSERT OR REPLACE INTO directory (key, type, target, auth, content, updated_at, category, enabled, planner_visible) VALUES
('STORE_GET', 'http', 'GET https://miscsubjects.com/api/store/f?path=$1', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# WHAT: fetch one reference file from the storage Worker (vendored docs, old build, etc).
# WHEN_TO_USE: an agent needs a doc/file that was moved off the repo into the store.
# ARGS: $1 = path, e.g. docs/api/openai/sections/012_agent_builder.md
# EX: [STORE_GET]docs/api/openai/sections/012_agent_builder.md[/STORE_GET]
# TESTS:
# POSITIVE: {"key":"STORE_GET","body":"docs/api/openai/sections/012_agent_builder.md"} -> HTTP 200 with the doc body
# INVERSE: {"key":"STORE_GET","body":"does/not/exist"} -> HTTP 404 not_found',
datetime('now'), 'storage', 1, 1),

('STORE_LIST', 'http', 'GET https://miscsubjects.com/api/store/list?prefix=$1', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# WHAT: list the reference files in storage (path,size,tag,ts). $1 optional path prefix.
# ARGS: $1 = optional prefix, e.g. docs/api/openai
# EX: [STORE_LIST]docs/api/openai[/STORE_LIST]
# TESTS: {"key":"STORE_LIST","body":""} -> HTTP 200, results array of file paths',
datetime('now'), 'storage', 1, 1);
