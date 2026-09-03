CREATE TABLE IF NOT EXISTS directory (
  key        TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('fn','http','agent','flow')),
  target     TEXT,
  auth       TEXT,
  content    TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     TEXT NOT NULL,
  trace  TEXT NOT NULL,
  step   INTEGER NOT NULL,
  parent INTEGER,
  key    TEXT,
  type   TEXT,
  input  TEXT,
  output TEXT
);

CREATE INDEX IF NOT EXISTS idx_log_trace ON log(trace, step);
