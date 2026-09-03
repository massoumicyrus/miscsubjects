-- LEDGER TRANSPARENCY CHAIN (owner order 2026-07-17, answers obj-136): a hash chain over
-- every ledger event so an external DKIM-signed email committing to the head makes the
-- ledger's immutability verifiable by any third party. Checkpoints are periodic seals:
-- each folds the new events since the last cursor into a running head and links the prior
-- checkpoint, so the chain is append-only and cheap to publish + verify. Lives in the LEDGER
-- db (loop-shared-events) alongside the events it seals.
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
