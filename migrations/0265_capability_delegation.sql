-- OIP v0.8 — delegation that can only narrow (LEDGER db: miscsubjects-events).
-- A child capability records its parent; revoking a parent cascades to every
-- descendant (the membrane). delegation_depth caps the chain at 5.
ALTER TABLE capabilities ADD COLUMN parent_fingerprint TEXT;
ALTER TABLE capabilities ADD COLUMN delegation_depth INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS capabilities_parent_idx ON capabilities(parent_fingerprint);
