-- Bootstrap schema for miscsubjects-content.
-- Applied by scripts/ship.mjs before incremental migrations so foundational tables
-- exist on a fresh database. All statements must be idempotent (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS agents (
  id          TEXT PRIMARY KEY,
  goal        TEXT,
  brain       TEXT,
  status      TEXT,
  steps       INTEGER,
  last_action TEXT,
  created     TEXT,
  updated     TEXT
);
