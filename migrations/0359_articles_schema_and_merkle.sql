-- 0359 — TWO SCHEMA DEBTS PAID (SPEC_SKILL_EVIDENCE_GRAPH.md Phases 0.3 and 5).
--
-- PART A — THE ARTICLES SCHEMA, RECORDED (Phase 0.3).
-- Migration 0061 declared articles as (slug, title, subject, published, created_at, updated_at).
-- Production has carried body, meta, hero, status and sources for months — the code reads them
-- everywhere — and NO migration ever recorded the ALTERs. The schema of the single most
-- important table was unreproducible from this repo. Following the 0355 convention, the ALTERs
-- below are RECORDED, NOT EXECUTED against the live database (the columns already exist there;
-- re-running ADD COLUMN would fail). A fresh database bootstrap MUST run them. They are kept as
-- executable statements behind the marker so a bootstrap script can strip the marker and apply.
--
-- RECORDED_NOT_EXECUTED_ON_LIVE >>>
-- ALTER TABLE articles ADD COLUMN body TEXT;
-- ALTER TABLE articles ADD COLUMN meta TEXT;
-- ALTER TABLE articles ADD COLUMN hero TEXT;
-- ALTER TABLE articles ADD COLUMN status TEXT;
-- ALTER TABLE articles ADD COLUMN sources TEXT;
-- <<< RECORDED_NOT_EXECUTED_ON_LIVE

-- PART B — MERKLE STORAGE FOR THE TRANSPARENCY CHAIN (Phase 5). [LEDGER database]
-- The chain is a linear hash chain: tamper-evident, but a verifier must re-hash everything to
-- check anything — no inclusion proof for one event, no consistency proof between two heads.
-- Storing each sealed batch's leaf digests lets /api/chain/proof serve an O(log n) RFC-6962-style
-- audit path without re-reading event payloads, and lets checkpoints carry a Merkle root and an
-- ES256 signature (the home federation key), which is what independent witnesses countersign.
-- Coverage begins at the first seal after this ships; earlier checkpoints remain linear-verified.
CREATE TABLE IF NOT EXISTS chain_merkle_leaves (
  seq         INTEGER NOT NULL,   -- chain_v2_checkpoints.seq this leaf was sealed under
  idx         INTEGER NOT NULL,   -- 0-based position within that seal batch
  event_id    TEXT NOT NULL,
  leaf_digest TEXT NOT NULL,      -- the same leaf_digest the /leaves endpoint serves
  PRIMARY KEY (seq, idx)
);
CREATE INDEX IF NOT EXISTS idx_chain_merkle_event ON chain_merkle_leaves (event_id);

CREATE TABLE IF NOT EXISTS chain_checkpoint_signatures (
  seq         INTEGER PRIMARY KEY, -- chain_v2_checkpoints.seq
  merkle_root TEXT NOT NULL,       -- RFC-6962-style root over that seal's leaf digests
  payload     TEXT NOT NULL,       -- the exact canonical string that was signed
  alg         TEXT NOT NULL DEFAULT 'ES256',
  kid         TEXT,
  signature   TEXT NOT NULL,       -- base64url ECDSA-P256/SHA-256 over payload
  signed_at   TEXT NOT NULL
);
