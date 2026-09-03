CREATE TABLE IF NOT EXISTS chain_checkpoints (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  cutoff_ts    TEXT NOT NULL,           -- ts of the last event folded (chain order = ts,id asc)
  cutoff_id    TEXT NOT NULL,           -- id of the last event folded (tiebreaker)
  event_count  INTEGER NOT NULL,        -- total events folded through this checkpoint
  leaves_added INTEGER NOT NULL,        -- events folded in THIS checkpoint
  head         TEXT NOT NULL,           -- running chain head after this checkpoint
  prev_head    TEXT NOT NULL,           -- head of the prior checkpoint ('genesis' for seq 1)
  checkpoint_hash TEXT NOT NULL,        -- sha256(prev_head|cutoff_ts|cutoff_id|event_count|head)
  sealed_at    TEXT NOT NULL,
  sealed_by    TEXT
);
