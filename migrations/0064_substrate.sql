-- 0064_substrate.sql — the MCP substrate + self-describing directory + runner registry + sessions.
-- Outward surface lives in functions/api/mcp.js. This seeds the inward + bootstrap rows.

-- 1. Every capability row declares where it executes. Runners become replaceable.
ALTER TABLE directory ADD COLUMN runner TEXT;

-- 2. Stateful terminal agents: state lives in rows, not inside a framework.
CREATE TABLE IF NOT EXISTS sessions (
  session_id    TEXT PRIMARY KEY,
  agent         TEXT,
  cwd           TEXT,
  goal          TEXT,
  status        TEXT,
  last_event_id TEXT,
  created_at    TEXT,
  updated_at    TEXT
);

-- 3. Cannibalization rows — turn external patterns into native directory rows.
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('MCP_TOOL_CALL','fn','mcpToolCall','','# Proxy one tool call into an external MCP server (Streamable HTTP JSON-RPC). Args: server_url|tool_name|auth_env_var|args_json
["$1","$2","$4+","$3"]','capability',40,1,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('MCP_IMPORT','fn','mcpImport','','# Cannibalize an MCP server: read its tools/list and emit a proposed directory row per tool (GAP-checked vs existing keys). PROPOSE only — returns SQL; apply with D1_EXEC or wrangler. Args: server_url|category|auth_env_var
["$1","$2","$3"]','capability',40,1,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('SKILL_IMPORT','fn','skillImport','','# Cannibalize a SKILL.md (frontmatter name+description, markdown body) into a proposed agent row. PROPOSE only. Args: source(url|r2:key|raw)|model|category
["$1","$2","$3"]','capability',40,1,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('AGENT_IMPORT','fn','agentImport','','# Cannibalize an agent definition (md frontmatter name/description/model/tools) into a proposed agent row. PROPOSE only. Args: source(url|r2:key|raw)|category
["$1","$2"]','capability',40,1,1,datetime('now'));

-- 4. Self-describing manifest — any cold client bootstraps from one call.
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('MANIFEST','fn','directoryManifest','','# Self-describing directory: every callable row with description, runner, risk, requires_approval, status, input_schema, examples. The bootstrap contract for any client. Args: category(optional)
["$1"]','directory',45,1,1,datetime('now'));

-- 5. Session rows — start / read / patch / rehydrate a stateful terminal agent.
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('SESSION_START','fn','sessionStart','','# Start (or upsert) a stateful agent session. Args: session_id|agent|cwd|goal
["$1","$2","$3","$4+"]','session',45,1,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('SESSION_GET','fn','sessionGet','','# Read a session row. Args: session_id
["$1"]','session',45,1,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('SESSION_UPDATE','fn','sessionUpdate','','# Patch a session (agent|cwd|goal|status|last_event_id). Args: session_id|patch_json
["$1","$2+"]','session',45,1,1,datetime('now'));

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('SESSION_RESUME','fn','sessionResume','','# Rehydrate a cold terminal agent: session row + recent LEDGER events (actor=session_id). Args: session_id|limit
["$1","$2"]','session',45,1,1,datetime('now'));

-- 6. Backfill the runner column for every row (runs last so the new rows are covered).
UPDATE directory SET runner = CASE
  WHEN target LIKE '%agent.<bridge-domain>%' OR key LIKE 'LOCAL\_%' ESCAPE '\' THEN 'mac'
  WHEN target LIKE '%workers.dev%' OR key LIKE 'SIBLING\_%' ESCAPE '\' THEN 'sibling'
  WHEN key LIKE 'APPS\_SCRIPT%' ESCAPE '\' OR key LIKE 'GOOGLE\_%' ESCAPE '\' THEN 'apps_script'
  ELSE 'edge'
END
WHERE runner IS NULL OR runner = '';
