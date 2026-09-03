-- 0178_cli_spawn_kimi.sql — cross-agent CLI spawn (Kimi + universal CLI_SPAWN row).
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'CLI_KIMI',
  'http',
  'POST https://agent.cannibal.capital/exec',
  'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
  '# Run Moonshot Kimi Code CLI non-interactively on the Mac. Args: task|cwd. Creates a new session; resume id printed at end. readonly audits: use CLI_SPAWN with mode readonly instead.
{"cmd":"bash","args":["/Users/owner/miscsubjects-pages/hooks/cli-agent-spawn.sh","kimi","$2","auto","headless"],"cwd":"$2","stdin":"$1","timeout":1200000}',
  'cli',
  50,
  1,
  1,
  datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth, content=excluded.content,
  category=excluded.category, planner_rank=excluded.planner_rank, enabled=excluded.enabled, updated_at=excluded.updated_at;

INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'CLI_SPAWN',
  'fn',
  'cliAgentSpawn',
  '',
  '# WHAT: spawn any coding CLI agent on the Mac in a NEW session. Args: agent|prompt|cwd|mode|delivery
# agent: kimi|gemini|codex|grok|grok-sa|claude|aider
# mode: readonly (plan/sandbox, no writes) | auto
# delivery: headless (default) | terminal (opens Terminal.app tab)
# WHEN_TO_USE: cross-agent audit, second opinion, delegate repo work to another model.
# EX: [CLI_SPAWN]kimi|audit miscsubjects build end-to-end read only|/Users/owner/miscsubjects-pages|readonly|headless[/CLI_SPAWN]
# EX: [CLI_SPAWN]gemini|review STATE.md for sprawl|/Users/owner/miscsubjects-pages|readonly|headless[/CLI_SPAWN]
["$1","$2","$3","$4","$5"]',
  'cli',
  15,
  1,
  1,
  datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, content=excluded.content,
  category=excluded.category, planner_rank=excluded.planner_rank, planner_visible=excluded.planner_visible,
  enabled=excluded.enabled, updated_at=excluded.updated_at;

INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'AGENT_SPAWN_CLI',
  'fn',
  'cliAgentSpawn',
  '',
  '# Alias of CLI_SPAWN for router tags. Args: agent|prompt|cwd|mode|delivery
["$1","$2","$3","$4","$5"]',
  'cli',
  15,
  1,
  1,
  datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, content=excluded.content,
  category=excluded.category, enabled=excluded.enabled, updated_at=excluded.updated_at;