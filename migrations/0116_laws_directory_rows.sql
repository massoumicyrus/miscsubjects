-- 0116: Laws directory rows (fix: single quotes doubled inside SQL string literals)

INSERT OR REPLACE INTO directory (key, type, target, content, category, updated_at, enabled, planner_visible) VALUES
('LAWS_LIST', 'flow', '', '# List all enabled laws with violation counts. Use when asked "what are the rules" or "show me the laws".
D1_QUERY: SELECT key, level, category, rule, violations, enabled FROM laws WHERE enabled=1 ORDER BY level DESC, key', 'laws', datetime('now'), 1, 1),
('LAWS_GET', 'flow', '', '# Read one law by key. Use when asked about a specific rule.
D1_QUERY: SELECT * FROM laws WHERE key=''$1''', 'laws', datetime('now'), 1, 1),
('LAWS_ADD', 'flow', '', '# Add a new mutable law. $1=key, $2=category, $3=rule text, $4=rationale. Only mutable laws can be added this way; immutable laws require a migration.
D1_EXEC: INSERT OR REPLACE INTO laws (key, level, category, rule, rationale, binding_on, can_be_modified_by, added_by, added_at, enabled) VALUES (''$1'', ''mutable'', ''$2'', ''$3'', ''$4'', ''["all"]'', ''["USER", "BUILD"]'', ''user'', datetime(''now''), 1)', 'laws', datetime('now'), 1, 1),
('LAWS_EDIT', 'flow', '', '# Edit a mutable law. $1=key, $2=new rule text, $3=new rationale. Cannot edit immutable laws.
D1_EXEC: UPDATE laws SET rule=''$2'', rationale=''$3'', updated_at=datetime(''now'') WHERE key=''$1'' AND level=''mutable''', 'laws', datetime('now'), 1, 1),
('LAWS_DELETE', 'flow', '', '# Delete a mutable law. $1=key. Cannot delete immutable laws.
D1_EXEC: DELETE FROM laws WHERE key=''$1'' AND level=''mutable''', 'laws', datetime('now'), 1, 1),
('LAWS_VIOLATION', 'flow', '', '# Log a law violation. $1=law_key, $2=agent_id, $3=session_id, $4=trace_id, $5=what_happened, $6=mitigated(0/1). Auto-increments violation count.
D1_EXEC: INSERT INTO law_violations (law_key, agent_id, session_id, trace_id, what_happened, mitigated, logged_at) VALUES (''$1'', ''$2'', ''$3'', ''$4'', ''$5'', $6, datetime(''now'')); UPDATE laws SET violations = violations + 1, last_violation_at = datetime(''now'') WHERE key=''$1''', 'laws', datetime('now'), 1, 1),
('TASKS_ADD', 'flow', '', '# Add a new task to the queue. $1=title/ask, $2=description, $3=priority(P0/P1/P2/P3), $4=assigned_to_agent/role. Stores a structured JSON job so the cron runner can execute it.
D1_EXEC: INSERT INTO tasks (created_at, status, body, source, trace) VALUES (datetime(''now''), ''open'', json_object(''ask'', ''$1'', ''role'', COALESCE(''$4'',''writer''), ''priority'', ''$3'', ''notes'', ''$2''), COALESCE(''$4'',''writer''), ''$3'')', 'tasks', datetime('now'), 1, 1),
('TASKS_LIST', 'flow', '', '# List all open tasks. Use when asked "what are my tasks" or "show me the backlog".
D1_QUERY: SELECT id, created_at, status, body, source, trace FROM tasks WHERE status=''open'' ORDER BY id DESC LIMIT 200', 'tasks', datetime('now'), 1, 1),
('TASKS_ASSIGN', 'flow', '', '# Assign a task to an agent. $1=task_id, $2=agent_name. Updates the source field to indicate assignment.
D1_EXEC: UPDATE tasks SET source=''assigned:$2'' WHERE id=$1', 'tasks', datetime('now'), 1, 1),
('NOW', 'flow', '', '# Return current UTC timestamp. Use when the build needs to know the time of day.
D1_QUERY: SELECT datetime(''now'') as now, date(''now'') as today, strftime(''%H:%M:%S'', ''now'') as time', 'time', datetime('now'), 1, 1),
('BUILD_MESSAGE', 'flow', '', '# Send a message to the build itself. $1=message text. This creates a self-referential loop: the build routes the message back to itself as if it were a new inbound turn.
BLOOIO_TURN_PHASE_A:$1', 'routing', datetime('now'), 1, 1),
('AGENT_BRIDGE', 'flow', '', '# Route a message from one agent to another. $1=source_agent, $2=target_agent, $3=message. Creates a turn that appears to come from the source agent, routed to the target agent.
BLOOIO_TURN_PHASE_A:[agent_bridge from $1 to $2] $3', 'routing', datetime('now'), 1, 1),
('CRON_LIST', 'flow', '', '# List existing cron jobs by querying the Cloudflare API. Returns scheduled jobs for this account.
CF: cron_triggers_get|<CLOUDFLARE_ACCOUNT_ID>|loop-safe-miscsubjects', 'cron', datetime('now'), 1, 1),
('PEPTIDE_ROUTER', 'flow', '', '# Before replying about a peptide, check if an internal article exists. $1=peptide name (e.g., bpc-157, tb-500, ara-290). Use when user asks about peptides or supplements.
D1_QUERY: SELECT slug, title, body_html FROM pages WHERE slug LIKE ''%$1%'' OR title LIKE ''%$1%'' LIMIT 1', 'content', datetime('now'), 1, 1);
