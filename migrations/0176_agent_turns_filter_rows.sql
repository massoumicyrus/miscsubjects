-- 0176_agent_turns_filter_rows.sql — queryable issue filters on agent_turns.
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'AGENT_TURNS_ISSUES',
  'fn',
  'd1Query',
  '',
  '# WHAT: agent turns matching issue tags (risk, protected, file_edit, unaudited, audit_fail). $1 = tag, $2 = limit.
# WHEN_TO_USE: "show risky agent turns", "unaudited codex turns", filterable issue triage.
# EX: [AGENT_TURNS_ISSUES]risk|20[/AGENT_TURNS_ISSUES]  [AGENT_TURNS_ISSUES]protected|10[/AGENT_TURNS_ISSUES]
["SELECT id, ts, agent, source, session, trace_id, tags_json, substr(user_input,1,200) AS user_input, substr(assistant_text,1,300) AS assistant_text, audit_verdict FROM agent_turns WHERE tags_json LIKE ''%\"'' || ''$1'' || ''\"%'' ORDER BY id DESC LIMIT COALESCE(NULLIF(''$2'',''''),20)"]',
  'log',
  82,
  1,
  1,
  datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, content=excluded.content,
  category=excluded.category, enabled=excluded.enabled, updated_at=excluded.updated_at;

INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'AGENT_TURNS_FILTER',
  'fn',
  'd1Query',
  '',
  '# WHAT: multi-filter agent turn query. $1=agent|all, $2=tag|risk|all, $3=limit.
# WHEN_TO_USE: cross-agent issue board, "gemini risk turns", audit backlog.
# EX: [AGENT_TURNS_FILTER]codex|risk|15[/AGENT_TURNS_FILTER]  [AGENT_TURNS_FILTER]all|unaudited|50[/AGENT_TURNS_FILTER]
["SELECT id, ts, agent, source, trace_id, tags_json, audit_verdict, n_tools, substr(user_input,1,180) AS user_input FROM agent_turns WHERE (''$1'' = ''all'' OR agent = ''$1'') AND (''$2'' = ''all'' OR tags_json LIKE ''%\"'' || ''$2'' || ''\"%'') ORDER BY id DESC LIMIT COALESCE(NULLIF(''$3'',''''),30)"]',
  'log',
  82,
  1,
  1,
  datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, content=excluded.content,
  category=excluded.category, enabled=excluded.enabled, updated_at=excluded.updated_at;