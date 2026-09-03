-- 0180_issue_reflex.sql — auto-escalate build/code issues to CLI coding agents.
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'CLI_REFLEX',
  'fn',
  'cliIssueReflex',
  '',
  '# WHAT: Issue reflex — spawn scoped CLI agent team on a build/code brief (background).
# Auto-fired by selftest failures + owner blooio build messages. Manual use OK.
# Args: brief|agents|cwd|mode|delivery
# agents default kimi,codex. delivery headless (fast) or terminal (live transcript).
# EX: [CLI_REFLEX]Selftest t8 failed on blooio reply path — best fix?|kimi,codex|/Users/owner/miscsubjects-pages|readonly|headless[/CLI_REFLEX]
["$1","$2","$3","$4","$5"]',
  'cli',
  11,
  1,
  1,
  datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, content=excluded.content,
  category=excluded.category, planner_rank=excluded.planner_rank, planner_visible=excluded.planner_visible,
  enabled=excluded.enabled, updated_at=excluded.updated_at;