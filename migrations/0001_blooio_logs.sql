CREATE TABLE IF NOT EXISTS blooio_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  direction TEXT NOT NULL,
  payload TEXT NOT NULL,
  response TEXT
);
