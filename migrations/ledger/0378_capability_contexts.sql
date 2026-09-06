-- LEDGER (miscsubjects-events). Applied by hand: ship.mjs applies root migrations to the content
-- database only.  npx wrangler d1 execute miscsubjects-events --remote --file migrations/ledger/0378_capability_contexts.sql
--
-- The mutable half of a capability, beside the immutable capabilities row it binds. Revoking a
-- device, expiring a browser session or tightening a policy edits THIS row; no token is reissued.

CREATE TABLE IF NOT EXISTS capability_contexts (
  fingerprint            TEXT PRIMARY KEY,                     -- capabilities.fingerprint
  tenant_id              TEXT,
  profile_id             TEXT,                                 -- traffic_profiles.id (human or model actor)
  actor_kind             TEXT,
  device_ids_json        TEXT NOT NULL DEFAULT '[]',
  session_ids_json       TEXT NOT NULL DEFAULT '[]',           -- browser-model sessions, sheet sessions, support cases
  state_handles_json     TEXT NOT NULL DEFAULT '[]',           -- state://… work handles
  sheet_ids_json         TEXT NOT NULL DEFAULT '[]',
  origins_json           TEXT NOT NULL DEFAULT '[]',
  require_verification_s INTEGER,                              -- step-up: human verification within N seconds
  require_pop            INTEGER NOT NULL DEFAULT 0,           -- proof of possession: device signature required
  policy_json            TEXT NOT NULL DEFAULT '[]',           -- [{field, op, value}] over profile/device state
  policy_rev             INTEGER NOT NULL DEFAULT 1,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  updated_by             TEXT
);
CREATE INDEX IF NOT EXISTS capability_contexts_profile ON capability_contexts(profile_id);

-- Proof-of-possession nonces. A primary-key insert consumes a nonce; a second insert is a replay.
CREATE TABLE IF NOT EXISTS pop_nonces (
  nonce       TEXT PRIMARY KEY,
  device_id   TEXT,
  fingerprint TEXT,
  ts          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pop_nonces_ts ON pop_nonces(ts);
