-- 0130: Add the PROTOCOL_RUN dispatch key so cron/agents can drive one protocol tick at a time.
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, allowed_categories, planner_visible, planner_rank, enabled, updated_at) VALUES
('PROTOCOL_RUN', 'fn', 'protocolRun', '', '# WHAT: Run one protocol tick for a role. $1=role (writer|reviewer|source_hunt|...). Claims the next open task, executes it (default /api/protocol/write), and marks it done or reopened.
# WHEN_TO_USE: cron or manual trigger to advance the protocol pipeline one step.
# ARGS: $1=role (default writer)
# EX: [PROTOCOL_RUN]writer[/PROTOCOL_RUN]
["$1"]', 'protocol', NULL, 1, 1, 1, datetime('now'));
