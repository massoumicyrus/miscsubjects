-- SEND_LEDGER — the public, hash-chained proof-of-work ledger for outbound mail.
--
-- THE FAILURE (owner, 2026-08-11): outreach emails told recipients their AI agents could verify
-- the work on the site, and nothing on the site or in the email could verify anything. No token
-- in the body, no public record of who was emailed, no way for an agent to check the machinery
-- that found the recipient or to countersign what it checked. The claims were unfalsifiable and
-- the work indistinguishable from anyone copying it.
--
-- THE INVARIANT: every outbound external email is one row here, minted at the send path before
-- the message leaves, carrying a proof id the body must contain (email_send_law rule 5 refuses a
-- body without one). Each row hashes prev_hash + its payload, so the ledger is append-only and
-- any agent can recompute the chain. A witness row (kind='witness') is a countersignature bound
-- to its parent send, appended keylessly by any model that verified it.
--
-- Privacy: the recipient appears as domain + sha256 of the lowercased address. Anyone holding
-- the address (the recipient, their agent) can confirm their row; nobody can harvest a list.
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
