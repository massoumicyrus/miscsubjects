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
