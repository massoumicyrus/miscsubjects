-- Automation loop: turn a proven invocation into a standing job that fires itself on a
-- schedule and ledgers a receipt each time. The "do it → offer to automate → it runs in the
-- background" piece. Config lives here (miscsubjects-content, binding DB); the sibling cron calls
-- AUTOMATE_RUN_DUE every tick; each run is a normal ledgered invocation with a receipt.
CREATE TABLE IF NOT EXISTS automations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  every_min INTEGER NOT NULL DEFAULT 60,
  key TEXT NOT NULL,
  body TEXT DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  last_run TEXT,
  last_receipt TEXT,
  runs INTEGER DEFAULT 0,
  created_by TEXT
);

INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at) VALUES
('AUTOMATE_ADD', 'fn', 'automateAdd', '',
'# WHAT: Automate a capability — make it fire itself every N minutes and ledger a receipt each run. Turns a one-off action into a standing background job.
# WHEN_TO_USE: "automate this", "do this every morning/hour", "keep doing X", "run this on a schedule".
# ARGS: name | every_minutes | KEY | body   (body is whatever that KEY takes; may contain pipes)
# EX: [AUTOMATE_ADD]morning ping|1440|SEND_BY_CHANNEL|blooio|[OWNER_PHONE]|automated good morning[/AUTOMATE_ADD]
["$1","$2","$3","$4+"]', 'automation', 20, 1, 1, datetime('now')),
('AUTOMATE_LIST', 'fn', 'automateList', '',
'# WHAT: List every automation — id, name, schedule, target key, enabled, last run, run count.
# WHEN_TO_USE: "what''s automated", "list my automations", "what runs on a schedule".
# ARGS: none
# EX: [AUTOMATE_LIST][/AUTOMATE_LIST]
[]', 'automation', 20, 1, 1, datetime('now')),
('AUTOMATE_TOGGLE', 'fn', 'automateToggle', '',
'# WHAT: Turn an automation on or off by id (paused, not deleted).
# WHEN_TO_USE: "pause that automation", "turn it back on", "stop the morning ping".
# ARGS: id | 1|0
# EX: [AUTOMATE_TOGGLE]3|0[/AUTOMATE_TOGGLE]
["$1","$2"]', 'automation', 20, 1, 1, datetime('now')),
('AUTOMATE_DELETE', 'fn', 'automateDelete', '',
'# WHAT: Delete an automation by id.
# WHEN_TO_USE: "remove that automation", "delete the scheduled job".
# ARGS: id
# EX: [AUTOMATE_DELETE]3[/AUTOMATE_DELETE]
["$1"]', 'automation', 20, 1, 1, datetime('now')),
('AUTOMATE_RUN_DUE', 'fn', 'automateRunDue', '',
'# WHAT: Fire every enabled automation whose interval has elapsed; ledger a receipt for each. Called by the cron each tick; safe to call manually.
# WHEN_TO_USE: "run due automations now", or the cron calls it automatically.
# ARGS: none
# EX: [AUTOMATE_RUN_DUE][/AUTOMATE_RUN_DUE]
[]', 'automation', 60, 0, 1, datetime('now'));
