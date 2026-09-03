-- Discourse index (owner ship-order 2026-07-16, W12+W17 §5): the per-slug derivation of
-- OBJECTION_LOG / review / voxel-mutation receipts. Source of truth stays the ledger;
-- this table is the fold the widgets render from.
CREATE TABLE IF NOT EXISTS discourse (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  target_div TEXT,
  family TEXT,
  claimed_model TEXT,
  actor_cap TEXT,
  stance TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  answer TEXT,
  answered_by TEXT,
  independently_raised INTEGER NOT NULL DEFAULT 0,
  canonical_of TEXT,
  similarity REAL,
  content_hash TEXT,
  filed_at TEXT NOT NULL,
  source_ref TEXT
);
CREATE INDEX IF NOT EXISTS idx_discourse_slug ON discourse(slug, status);
CREATE INDEX IF NOT EXISTS idx_discourse_family ON discourse(family);
