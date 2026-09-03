CREATE TABLE IF NOT EXISTS session_cases (
  case_id       TEXT NOT NULL,               -- SC-0001
  revision      INTEGER NOT NULL DEFAULT 1,  -- re-assembly appends, never overwrites
  title         TEXT NOT NULL,
  objective     TEXT,                        -- what the it was asked for, in the the stated failure
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
