-- Normalized cross-build event ledger. Lives in D1 `miscsubjects-events`, bound as `LEDGER`.
-- One row per outbound HTTP call, agent call, dispatch step, or webhook in/out.
-- Bodies >10 KB go to R2; D1 stores preview + size + r2_key only.

CREATE TABLE IF NOT EXISTS events (
  id              TEXT PRIMARY KEY,
  ts              TEXT NOT NULL,
  build           TEXT,
  source          TEXT NOT NULL,
  key             TEXT,
  route           TEXT,
  actor           TEXT,
  action          TEXT,
  direction       TEXT,
  status          INTEGER,
  trace_id        TEXT,
  step            INTEGER,
  parent          TEXT,
  request_preview TEXT,
  response_preview TEXT,
  request_size    INTEGER,
  response_size   INTEGER,
  request_json    TEXT,
  response_json   TEXT,
  r2_request_key  TEXT,
  r2_response_key TEXT,
  legacy_table    TEXT,
  legacy_id       TEXT
);

CREATE INDEX IF NOT EXISTS events_ts_idx        ON events (ts DESC);
CREATE INDEX IF NOT EXISTS events_source_ts_idx ON events (source, ts DESC);
CREATE INDEX IF NOT EXISTS events_key_ts_idx    ON events (key, ts DESC);
CREATE INDEX IF NOT EXISTS events_trace_idx     ON events (trace_id);
