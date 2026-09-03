-- OIP v0.1 — invocation events on LEDGER (loop-shared-events).
-- Query: GET /api/invocations ?trace_id ?object_id ?material ?waste ?limit

CREATE TABLE IF NOT EXISTS invocations (
  id                TEXT PRIMARY KEY,
  ts                TEXT NOT NULL,
  trace_id          TEXT,
  object_id         TEXT NOT NULL,
  object_type       TEXT,
  runner            TEXT,
  actor             TEXT,
  material          INTEGER DEFAULT 0,
  waste             INTEGER DEFAULT 0,
  tokens_in         INTEGER DEFAULT 0,
  tokens_out        INTEGER DEFAULT 0,
  cost_usd          REAL DEFAULT 0,
  material_outputs  INTEGER DEFAULT 0,
  event_id          TEXT,
  invocation_json   TEXT
);

CREATE INDEX IF NOT EXISTS invocations_ts_idx ON invocations (ts DESC);
CREATE INDEX IF NOT EXISTS invocations_trace_idx ON invocations (trace_id);
CREATE INDEX IF NOT EXISTS invocations_object_idx ON invocations (object_id, ts DESC);
CREATE INDEX IF NOT EXISTS invocations_waste_idx ON invocations (waste, ts DESC);