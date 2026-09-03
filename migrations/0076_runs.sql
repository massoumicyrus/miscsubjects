-- 0076_runs.sql — the queue. Every model run / suggestion is a row you can approve or deny.
CREATE TABLE IF NOT EXISTS runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,                 -- condition | demand_api | studio | council | rewrite | ad | image | peptide_added | setup
  request     TEXT,                          -- what was asked / the source (peptide name, question)
  model       TEXT,                          -- who produced it
  target      TEXT,                          -- tissue / slug / column, optional
  output      TEXT,                          -- the result
  status      TEXT NOT NULL DEFAULT 'pending',-- pending | approved | denied | edited | done | info
  note        TEXT,                          -- decision note / created slug / where-to-get-key
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status, type);
CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at DESC);
