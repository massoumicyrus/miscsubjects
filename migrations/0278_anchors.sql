-- PORTABLE IMMUTABILITY ANCHORS (owner order 2026-07-17): a model tags an opaque packet hash
-- (no data revealed) against public surfaces it does not control — a drand randomness beacon
-- round, the latest Bitcoin block, this ledger's chain head, and wall-clock. The anchor binds
-- the packet to values that could not be precomputed, so it cannot be backdated; posting it to
-- any other ledger gives anteriority. Any ledger holding the anchor recomputes anchor_id and
-- re-checks the public surfaces to verify or prove tamper. Lives in the LEDGER db.
CREATE TABLE IF NOT EXISTS anchors (
  anchor_id      TEXT PRIMARY KEY,     -- sha256(canonical preimage)
  packet_hash    TEXT NOT NULL,        -- the opaque commitment the model chose (reveals no data)
  label          TEXT,                 -- optional model-supplied tag (what this packet is)
  anchored_at    TEXT NOT NULL,
  actor          TEXT,
  actor_cap      TEXT,
  canonical      TEXT NOT NULL,        -- the exact sha256 preimage (surfaces inline, no data)
  surfaces_json  TEXT NOT NULL,        -- {drand, bitcoin, miscsubjects_chain} as captured
  event_id       TEXT                  -- the ledger event this anchor folded into (enters the chain)
);
CREATE INDEX IF NOT EXISTS idx_anchors_packet ON anchors(packet_hash);
