-- OIP v0.2 — receipt lineage on invocations (miscsubjects-events / LEDGER).
-- replay_of   = this invocation re-fired that invocation id, same object + same recorded input
-- repairs     = this invocation is the corrected re-fire of that failed invocation id
-- repaired_by = set on the OLD invocation when a repair lands (reverse link)
ALTER TABLE invocations ADD COLUMN replay_of TEXT;
ALTER TABLE invocations ADD COLUMN repairs TEXT;
ALTER TABLE invocations ADD COLUMN repaired_by TEXT;
CREATE INDEX IF NOT EXISTS invocations_replay_idx ON invocations(replay_of);
CREATE INDEX IF NOT EXISTS invocations_repairs_idx ON invocations(repairs);
