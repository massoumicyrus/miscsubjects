-- Pre-flight rule table used by WATCH_ACTION / sensitive rows.
CREATE TABLE IF NOT EXISTS watch_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_key TEXT,
  pattern_body TEXT,
  action TEXT DEFAULT 'deny',
  reason TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
