CREATE TABLE IF NOT EXISTS send_ledger (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  proof_id       TEXT NOT NULL UNIQUE,   -- snd_... (send) | wit_... (witness countersignature)
  kind           TEXT NOT NULL,          -- email_send | email_send_backfill | witness
  parent_proof   TEXT,                   -- witness rows: the snd_... they verify
  ts             TEXT NOT NULL,
  recipient_domain TEXT,
  recipient_sha256 TEXT,                 -- sha256(lowercased address), no salt: verifiable by anyone holding the address
  subject        TEXT,
  body_sha256    TEXT,                   -- sha256 of the final plain-text body as sent (verify token included)
  evidence       TEXT,                   -- JSON: how the work was done — lead provenance, tracked-send id, article refs
  agent          TEXT,                   -- witness rows: who verified
  model          TEXT,
  verdict        TEXT,                   -- witness rows: VERIFIED | CONTRADICTED | INCONCLUSIVE
  note           TEXT,
  capability     TEXT,                   -- witness rows: fingerprint of the token that signed (never the secret)
  prev_hash      TEXT NOT NULL DEFAULT 'genesis',
  hash           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_send_ledger_parent ON send_ledger(parent_proof);
CREATE INDEX IF NOT EXISTS idx_send_ledger_kind_ts ON send_ledger(kind, ts);
