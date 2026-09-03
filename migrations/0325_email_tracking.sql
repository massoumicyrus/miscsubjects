-- Email open/click tracking. Every tracked send inserts one row; the public pixel + click
-- endpoints (functions/api/t/[[path]].js) update it. Gives sent-email visibility + engagement
-- without a third-party (Mailgun/SendGrid) — the send already goes through our own sibling worker.
CREATE TABLE IF NOT EXISTS email_sends (
  id TEXT PRIMARY KEY,               -- tracking id (also the pixel/click token)
  lead_id INTEGER,                   -- null for owner tests / non-lead sends
  to_email TEXT NOT NULL,
  from_email TEXT,
  subject TEXT,
  body TEXT,                         -- final body as sent (links already wrapped)
  kind TEXT NOT NULL DEFAULT 'outreach',  -- outreach | test | draft-review
  sent_at TEXT NOT NULL,
  send_status INTEGER,               -- HTTP status from the send hop
  opens INTEGER NOT NULL DEFAULT 0,
  first_open_at TEXT,
  last_open_at TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  first_click_at TEXT,
  last_click_at TEXT,
  click_log TEXT                     -- JSON array of {ts,url}
);
CREATE INDEX IF NOT EXISTS idx_email_sends_sent_at ON email_sends(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_sends_lead ON email_sends(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_to ON email_sends(to_email);

-- Directory rows for the tracked-send + sent-visibility tools (runners in fn_runners.js).
INSERT INTO directory (key,type,target,auth,content,category,enabled,planner_visible,planner_rank,sensitive,created_at,updated_at)
VALUES (
  'EMAIL_SEND_TRACKED','fn','emailSendTracked','',
  '# WHAT: Send a tracked email (open pixel + wrapped click links) and record it in email_sends.
# WHEN_TO_USE: any owner-authorized send where you want open/click visibility.
# ARGS: $1 = JSON {to, subject, body, kind?, lead_id?, from?, from_name?, reply_to?}.
# EX: [EMAIL_SEND_TRACKED]{"to":"[REDACTED_EMAIL]","subject":"hi","body":"see https://leoresearch.com"}[/EMAIL_SEND_TRACKED]
["$1"]',
  'leads',1,1,20,0,datetime('now'),datetime('now')
) ON CONFLICT(key) DO UPDATE SET target=excluded.target, content=excluded.content, updated_at=datetime('now');

INSERT INTO directory (key,type,target,auth,content,category,enabled,planner_visible,planner_rank,sensitive,created_at,updated_at)
VALUES (
  'EMAILS_SENT','fn','emailsSent','',
  '# WHAT: List recent sent emails with open/click engagement + totals (sent-email visibility).
# WHEN_TO_USE: see everything sent and who opened/clicked.
# ARGS: $1 = limit (default 50).
# EX: [EMAILS_SENT]50[/EMAILS_SENT]
["$1"]',
  'leads',1,1,20,0,datetime('now'),datetime('now')
) ON CONFLICT(key) DO UPDATE SET target=excluded.target, content=excluded.content, updated_at=datetime('now');

-- Contact-object accessors (leads exposed as canonical contact objects).
INSERT INTO directory (key,type,target,auth,content,category,enabled,planner_visible,planner_rank,sensitive,created_at,updated_at)
VALUES ('CONTACT_GET','fn','contactGet','',
  '# WHAT: Get a lead as a canonical CONTACT object (channels, fit score, signals, provenance).
# ARGS: $1 = lead id or contact:<id>.
# EX: [CONTACT_GET]811[/CONTACT_GET]
["$1"]','leads',1,1,20,0,datetime('now'),datetime('now'))
ON CONFLICT(key) DO UPDATE SET target=excluded.target, content=excluded.content, updated_at=datetime('now');

INSERT INTO directory (key,type,target,auth,content,category,enabled,planner_visible,planner_rank,sensitive,created_at,updated_at)
VALUES ('CONTACTS_LIST','fn','contactsList','',
  '# WHAT: List contact objects with optional filter.
# ARGS: $1 = JSON {status?,segment?,city?,limit?} or a bare status word.
# EX: [CONTACTS_LIST]drafted[/CONTACTS_LIST]
["$1"]','leads',1,1,20,0,datetime('now'),datetime('now'))
ON CONFLICT(key) DO UPDATE SET target=excluded.target, content=excluded.content, updated_at=datetime('now');
