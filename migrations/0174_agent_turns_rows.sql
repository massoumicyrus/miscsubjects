-- 0174_agent_turns_rows.sql — query rows for universal agent turn log.
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'AGENT_TURNS',
  'fn',
  'd1Query',
  '',
  '# WHAT: last N agent turns across all CLI agents (claude, codex, grok, …). $1 = agent id or "all", $2 = limit (default 5).
# WHEN_TO_USE: "what did codex do", "show agent turns", cross-agent audit.
# EX: [AGENT_TURNS]claude|5[/AGENT_TURNS]  [AGENT_TURNS]all|10[/AGENT_TURNS]
["SELECT id, ts, agent, source, trace_id, substr(user_input,1,200) AS user_input, substr(assistant_text,1,400) AS assistant_text, dispatch_key FROM agent_turns WHERE (''$1'' = ''all'' OR agent = ''$1'') ORDER BY id DESC LIMIT COALESCE(NULLIF(''$2'',''''),5)"]',
  'log',
  80,
  1,
  1,
  datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, content=excluded.content,
  category=excluded.category, enabled=excluded.enabled, updated_at=excluded.updated_at;

INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'AGENT_TURNS_TRACE',
  'fn',
  'd1Query',
  '',
  '# WHAT: agent turns linked to one ledger trace_id. $1 = trace_id, $2 = limit (default 20).
# WHEN_TO_USE: "what CLI agents ran on this trace", incident/debug linkage.
# EX: [AGENT_TURNS_TRACE]t_abc123|10[/AGENT_TURNS_TRACE]
["SELECT id, ts, agent, source, dispatch_key, substr(user_input,1,200) AS user_input, substr(assistant_text,1,500) AS assistant_text FROM agent_turns WHERE trace_id = ''$1'' ORDER BY id ASC LIMIT COALESCE(NULLIF(''$2'',''''),20)"]',
  'log',
  80,
  1,
  1,
  datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, content=excluded.content,
  category=excluded.category, enabled=excluded.enabled, updated_at=excluded.updated_at;