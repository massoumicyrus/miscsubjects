CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES (
  'system_prompt',
  'You are a helpful assistant.'
);

CREATE TABLE IF NOT EXISTS blooio_dedup (
  message_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
