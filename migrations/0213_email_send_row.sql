-- Canonical email send row. Proxies through /api/email/send to the sibling Worker EMAIL binding.

INSERT INTO directory (key, type, target, auth, content, category, enabled, planner_visible, planner_rank, updated_at)
VALUES (
  'EMAIL_SEND',
  'http',
  'POST https://miscsubjects.com/api/email/send',
  'headers:{"Content-Type":"application/json","x-terminal-key":"$TERMINAL_KEY"}',
  '# WHAT: Send an email through Cloudflare Email Sending via the sibling worker.
# WHEN_TO_USE: the owner asks to send/write/reply/forward an email.
# ARGS: to | subject | text
# EX: [EMAIL_SEND][OWNER_EMAIL]|OIP proof|This email was sent by the build.[/EMAIL_SEND]
{"to":"$1","subject":"$2","text":"$3+","from":"build@miscsubjects.com"}',
  'email',
  1,
  1,
  35,
  datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type,
  target=excluded.target,
  auth=excluded.auth,
  content=excluded.content,
  category=excluded.category,
  enabled=excluded.enabled,
  planner_visible=excluded.planner_visible,
  planner_rank=excluded.planner_rank,
  updated_at=excluded.updated_at;

INSERT OR IGNORE INTO directory_tests (key, kind, args, tier, expect_kind, expect_value, expected_text, note)
VALUES
('ROUTER','e2e','how do I send an email from the build',2,'route_ok','EMAIL_SEND','Routes email to EMAIL_SEND, not invoice or Blooio.','email send route');
