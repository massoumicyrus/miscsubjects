ALTER TABLE capabilities ADD COLUMN contract_hash TEXT;

CREATE TABLE IF NOT EXISTS oip_work (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  title TEXT NOT NULL,
  asker TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('asked','promised','done','closed','cancelled')),
  promise_actor TEXT,
  promised_at TEXT,
  done_by TEXT,
  done_at TEXT,
  closed_by TEXT,
  closed_at TEXT,
  receipt_id TEXT,
  evidence_json TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_oip_work_asker_state ON oip_work(asker, state, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_oip_work_promisor_state ON oip_work(promise_actor, state, updated_at DESC);
