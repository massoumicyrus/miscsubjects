-- 0360 — SESSION CASES: the ledger turned inside out (owner directive, 2026-08-28).
--
-- THE OBJECT. The owner's articulation: "I make a prompt to you, it goes on the ledger — my
-- input, your thoughts, your output, your tools used, the raw payloads in and out. The proof
-- object is that internal ledger turned inside out, less anything sensitive." A SESSION CASE is
-- one whole session or loop run published as a single object: every turn from agent_turns (the
-- per-turn input/output SHA-256 commitments were already stored at ingest), every tool call
-- resolvable through the existing events/invocations machinery, under a CLASSIFICATION POLICY
-- that is code, not prose. Private items still publish their hash commitment, so a cold model can
-- authenticate information it is not allowed to read: the commitment is on a ledger event, the
-- event chains into the transparency chain, the chain is Merkle-checkpointed, signed, witnessed,
-- and drand/Bitcoin-anchored. That is the "bitcoin-like" property, without a token.
--
-- Naming (owner asked for the term to be revised): the public product remains PROVEN WORK; this
-- object is an EXECUTION CASE scoped to a session — a SESSION CASE, id SC-####. "Proof of work"
-- is not used: it is Bitcoin's mining term and would misread to every technical visitor.
CREATE TABLE IF NOT EXISTS session_cases (
  case_id       TEXT NOT NULL,               -- SC-0001
  revision      INTEGER NOT NULL DEFAULT 1,  -- re-assembly appends, never overwrites
  title         TEXT NOT NULL,
  objective     TEXT,                        -- what the owner asked for, in the owner's words
  session       TEXT,                        -- agent_turns.session this case covers
  trace_id      TEXT,
  agent         TEXT,
  manifest_json TEXT NOT NULL,               -- schema oip/session-case/1 (functions/_lib/session_case.js)
  manifest_hash TEXT NOT NULL,               -- sha256(manifest_json) — committed to the event ledger at store time
  -- SALTED COMMITMENTS FOR WITHHELD CONTENT (RFC 9901 discipline). A bare SHA-256 of a short
  -- prompt is NOT private — it can be recovered by guess-and-hash. Withheld turns therefore
  -- publish sha256(salt ‖ original) and the salts live HERE, never served. Reveal-later: hand a
  -- verifier the original plus its salt; they recompute. private_json = {"<turn_key>": {"salt":…}}
  private_json  TEXT,
  disclosure    TEXT NOT NULL DEFAULT 'public' CHECK (disclosure IN ('public','hash_only','private')),
  actor         TEXT,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (case_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_session_cases_session ON session_cases (session);

-- The mastermind surface: typed, manifest-pinned interactions — never a feed. A comment binds to
-- the exact case revision it was written against (manifest_hash), same discipline as
-- content_block_comments and skill_version_comments.
CREATE TABLE IF NOT EXISTS case_comments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id       TEXT NOT NULL,
  manifest_hash TEXT NOT NULL,
  stance        TEXT NOT NULL CHECK (stance IN ('question','objection','suggestion','reproduction_request','attestation','correction','note')),
  body          TEXT NOT NULL,
  actor         TEXT NOT NULL,
  actor_kind    TEXT NOT NULL DEFAULT 'model' CHECK (actor_kind IN ('model','build','human')),
  fingerprint   TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','superseded')),
  answered_by   TEXT,
  ts            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_case_comments_case ON case_comments (case_id, status);
