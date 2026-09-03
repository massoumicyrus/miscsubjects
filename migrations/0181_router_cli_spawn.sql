-- ROUTER: expose CLI_SPAWN + CLI_KIMI for tier-7 delegate selftests.
UPDATE directory SET content = REPLACE(content,
  '[CLI_GH]gh args[/CLI_GH] runs the GitHub CLI.
For repo work, prefer CLI_CLAUDE_CODE over LOCAL_EXEC.',
  '[CLI_GH]gh args[/CLI_GH] runs the GitHub CLI.
[CLI_KIMI]task|cwd[/CLI_KIMI] runs Kimi Code CLI headless.
[CLI_SPAWN]agent|prompt|cwd|mode|delivery[/CLI_SPAWN] spawns any Mac coding CLI (kimi|gemini|codex|grok|claude|aider). Use for open a ticket, ask a coding agent, delegate repo work. mode=readonly for audits.
For repo work, prefer CLI_SPAWN or CLI_CLAUDE_CODE over LOCAL_EXEC.'),
  updated_at = datetime('now')
WHERE key = 'ROUTER';

UPDATE directory SET content = REPLACE(content,
  '- open a repair ticket / ask a coding agent → actually call [CLI_CLAUDE_CODE]task|cwd[/CLI_CLAUDE_CODE] (or the right CLI_* row); never claim a ticket exists without creating it.',
  '- open a repair ticket / ask a coding agent / delegate repo work → [CLI_SPAWN]agent|prompt|cwd|mode|delivery[/CLI_SPAWN] (agent=kimi|claude|codex|gemini|grok|aider; mode=readonly for audits; delivery=headless). Or use a specific CLI_* row; never claim a ticket exists without creating it.'),
  updated_at = datetime('now')
WHERE key = 'ROUTER';