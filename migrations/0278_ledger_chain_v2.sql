-- Normalized-time transparency chain. V1 is preserved forever because published heads may
-- already be anchored elsewhere. V2 replays every event from genesis in UTC epoch order so
-- mixed ISO forms (`Z` and explicit offsets) cannot strand late events behind a text cursor.
CREATE TABLE IF NOT EXISTS chain_v2_checkpoints (
  seq             INTEGER PRIMARY KEY AUTOINCREMENT,
  cutoff_epoch    INTEGER NOT NULL,
  cutoff_ts       TEXT NOT NULL,
  cutoff_id       TEXT NOT NULL,
  event_count     INTEGER NOT NULL,
  leaves_added    INTEGER NOT NULL,
  head            TEXT NOT NULL,
  prev_head       TEXT NOT NULL,
  checkpoint_hash TEXT NOT NULL,
  sealed_at       TEXT NOT NULL,
  sealed_by       TEXT
);

CREATE INDEX IF NOT EXISTS idx_chain_v2_cutoff
  ON chain_v2_checkpoints(cutoff_epoch, cutoff_id);
