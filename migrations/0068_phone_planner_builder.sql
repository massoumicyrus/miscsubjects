-- Phone surface + planner threads + builder queue + approvals.
-- 2026-06-12. All tables on the main D1 (binding `DB`), not on LEDGER.

CREATE TABLE IF NOT EXISTS phone_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  source TEXT,              -- 'ios_shortcut' | 'siri' | 'pwa' | 'webhook'
  device TEXT,              -- 'owner_iphone' | etc
  action TEXT,              -- 'share_url' | 'share_text' | 'share_image' | 'voice_note' | 'clipboard' | 'location' | 'photo' | 'approval' | etc
  payload_json TEXT,        -- raw inbound JSON, redacted secrets
  result TEXT
);
CREATE INDEX IF NOT EXISTS phone_events_ts_idx ON phone_events(ts);
CREATE INDEX IF NOT EXISTS phone_events_action_idx ON phone_events(action, ts);

CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  source TEXT,              -- agent key that requested approval
  trace_id TEXT,            -- dispatch trace
  action TEXT,              -- short verb: 'deploy' | 'send_outreach' | 'delete' | 'pay' | 'edit_row'
  summary TEXT,             -- one-line human description
  resume_key TEXT,          -- directory key to dispatch on approve
  resume_body TEXT,         -- body to pass to dispatch on approve
  status TEXT NOT NULL,     -- 'pending' | 'approved' | 'denied' | 'expired'
  decided_by TEXT           -- phone | manual | timeout
);
CREATE INDEX IF NOT EXISTS approvals_status_idx ON approvals(status, created_at);

CREATE TABLE IF NOT EXISTS builder_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL,     -- 'idea' | 'queued' | 'in_progress' | 'blocked' | 'done' | 'wont'
  priority INTEGER,         -- 1 (next) .. 9 (someday)
  title TEXT NOT NULL,      -- one-line summary
  body TEXT,                -- the actual want / spec / context
  blocker TEXT,             -- if blocked, why
  proof TEXT                -- link / exhibit when done
);
CREATE INDEX IF NOT EXISTS builder_queue_status_idx ON builder_queue(status, priority);

CREATE TABLE IF NOT EXISTS threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL,     -- 'open' | 'paused' | 'closed'
  title TEXT NOT NULL,
  body TEXT,                -- running notes, append-only
  tags TEXT                 -- comma-separated
);
CREATE INDEX IF NOT EXISTS threads_status_idx ON threads(status, updated_at);
