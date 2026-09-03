-- OIP v0.8.1 — authoritative quantitative delegation accounting (LEDGER).
-- Child budgets are reserved from parents; direct uses are counted atomically in D1.
ALTER TABLE capabilities ADD COLUMN uses_consumed INTEGER DEFAULT 0;
ALTER TABLE capabilities ADD COLUMN uses_reserved INTEGER DEFAULT 0;

-- Fold already-minted live v0.8 children into their parents conservatively. Existing
-- KV use counters are synchronized lazily by the invocation/reservation gate.
UPDATE capabilities
SET uses_reserved = COALESCE((
  SELECT SUM(CASE WHEN child.max_uses > 0 THEN child.max_uses ELSE 0 END)
  FROM capabilities AS child
  WHERE child.parent_fingerprint = capabilities.fingerprint
    AND COALESCE(child.revoked, 0) = 0
), 0);

CREATE INDEX IF NOT EXISTS capabilities_parent_live_idx
  ON capabilities(parent_fingerprint, revoked, expires_at);
