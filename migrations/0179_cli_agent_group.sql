-- 0179_cli_agent_group.sql — CLI Agent Team Room (multi-agent transcript discussion).
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'CLI_GROUP',
  'fn',
  'cliAgentGroup',
  '',
  '# WHAT: CLI Agent Team Room — agents chat in sequence on a shared transcript (superior build solutions).
# Args: agents|topic|cwd|mode|delivery
# agents: comma-separated team (default kimi,gemini,codex) — also grok, claude, aider
# mode: readonly (default) | auto
# delivery: headless | terminal (terminal opens live team-room tail -f transcript)
# WHEN_TO_USE: cross-agent debate, audit synthesis, second opinions, architecture review as a team.
# EX: [CLI_GROUP]kimi,gemini,codex|What are the top 5 gaps in agent_turn logging and how do we fix them?|/Users/owner/miscsubjects-pages|readonly|terminal[/CLI_GROUP]
["$1","$2","$3","$4","$5"]',
  'cli',
  12,
  1,
  1,
  datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, content=excluded.content,
  category=excluded.category, planner_rank=excluded.planner_rank, planner_visible=excluded.planner_visible,
  enabled=excluded.enabled, updated_at=excluded.updated_at;