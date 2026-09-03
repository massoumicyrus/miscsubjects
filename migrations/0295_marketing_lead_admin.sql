-- Owner-facing lead review and exact-copy approval gate.
-- Approval is separate from sending, expires quickly, is single-use, and is invalidated by edits.
CREATE TABLE IF NOT EXISTS lead_send_approvals (
  lead_id INTEGER PRIMARY KEY,
  draft_hash TEXT NOT NULL,
  approval_token TEXT NOT NULL UNIQUE,
  approved_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  approved_via TEXT NOT NULL DEFAULT 'admin/marketing'
);
CREATE INDEX IF NOT EXISTS idx_lead_send_approvals_token ON lead_send_approvals(approval_token);

UPDATE directory SET
  content = '# WHAT: Send ONE lead''s already-saved email through the owner-reviewed Marketing admin.
# WHEN_TO_USE: only after the owner reviewed the exact recipient, subject, and body in Admin → Marketing → Leads, approved that exact copy, and separately clicked Send.
# SAFETY: literal CONFIRM alone is insufficient. $4 must be a current, unexpired, single-use approval token tied to the saved recipient+subject+body hash. Editing copy invalidates approval. Terminal keys/share tokens cannot mint approval.
# ARGS: $1=CONFIRM, $2=lead id, $3=from local-part, $4=owner-browser exact-copy approval token.
["$1","$2","$3","$4"]',
  updated_at = datetime('now')
WHERE key = 'LEADS_SEND';

UPDATE directory SET
  content = '# WHAT: Batch outreach sending is disabled.
# WHEN_TO_USE: never; use the owner-reviewed individual send path in Admin → Marketing → Leads.
# SAFETY: always returns batch_send_disabled and sends nothing until a campaign-level exact-copy review surface is explicitly built and approved.
["$1","$2"]',
  updated_at = datetime('now')
WHERE key = 'LEADS_SEND_BATCH';

UPDATE directory SET
  content = '# WHAT: Send an email through Cloudflare Email Sending via the sibling worker.
# WHEN_TO_USE: the owner explicitly asks to send/write/reply/forward an email.
# SAFETY: owner/internal recipients remain available. Every external recipient requires the server-signed, exact-copy Marketing approval proof; terminal/share credentials alone are refused.
# ARGS: to | subject | text
{"to":"$1","subject":"$2","text":"$3+","from":"build@miscsubjects.com"}',
  updated_at = datetime('now')
WHERE key = 'EMAIL_SEND';

INSERT OR IGNORE INTO directory_tests
  (key, kind, args, tier, expect_kind, expect_value, expected_text, note)
VALUES
  ('LEADS_SEND', 'inverse', 'CONFIRM|131|wholesale', 2, 'contains',
   'owner_browser_approval_required|Nothing sent',
   'Even literal CONFIRM cannot send without an owner-browser approval token tied to the exact saved copy.',
   'owner correction 2026-07-19: prior unauthorized email sends must never recur'),
  ('LEADS_SEND_BATCH', 'inverse', 'CONFIRM|25', 2, 'contains',
   'batch_send_disabled|Nothing sent',
   'Batch sending is disabled and a CONFIRM token cannot cause a blast.',
   'owner correction 2026-07-19: no bulk send without a campaign review surface'),
  ('EMAIL_SEND', 'inverse', 'prospect@example.com|Unapproved outreach|This must not send', 2, 'contains',
   'owner_marketing_approval_required|sent.*false',
   'A direct terminal/tool email to an external recipient is refused without the server-signed Marketing approval proof.',
   'owner correction 2026-07-19: generic email transport cannot bypass owner review'),
  ('ROUTER', 'e2e', 'I want to inspect and edit lead email copy in the Marketing admin, but I am not authorizing any email to be sent', 4, 'reply_ok',
   'Marketing|review|edit|approval|nothing sent|does not send',
   'Routes the owner to the review-only lead workspace and does not invoke any send row.',
   'owner correction 2026-07-19: review, editing, and approval are distinct from send authorization');
