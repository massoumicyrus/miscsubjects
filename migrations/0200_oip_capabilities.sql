-- OIP v0.3 — OIP-Caps: delegated-agency capability records (miscsubjects-events / LEDGER).
-- The signed share token stays the wire credential (sh.<exp>.<scope>.<uses>.<nonce>.<sig>);
-- this table holds the claims the token cannot carry: purpose, actor, issuer, risk ceiling,
-- owner gate, optional fixed body, and revocation. Keyed by fingerprint = cap_<sha256(token)[0:16]>.
-- A token with no row here is a pre-v0.3 legacy share link and keeps its old behavior.
CREATE TABLE IF NOT EXISTS capabilities (
  fingerprint   TEXT PRIMARY KEY,
  nonce         TEXT,
  ts            TEXT,
  expires_at    TEXT,
  scope         TEXT,
  row_key       TEXT,
  max_uses      INTEGER DEFAULT 0,
  purpose       TEXT,
  actor         TEXT,
  issuer        TEXT,
  risk_ceiling  TEXT DEFAULT 'low',
  owner_gate    INTEGER DEFAULT 0,
  body_fixed    TEXT,
  revoked       INTEGER DEFAULT 0,
  revoked_ts    TEXT,
  mint_event_id TEXT
);
CREATE INDEX IF NOT EXISTS capabilities_nonce_idx ON capabilities(nonce);
