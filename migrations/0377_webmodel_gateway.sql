-- Browser-model execution gateway: durable sessions, durable turns, and the shared state
-- handle that lets one model pick up where another left off without pasting a transcript.
--
-- These are new tables, not a fork of an existing abstraction: `sessions` is the CLI-agent
-- session table (agent/cwd/goal) and `agent_turns` is the hook-fed turn log for CLI agents.
-- Neither can hold a conversation_url, a provider turn id, or a capture method, and widening
-- them would have put browser state into a table three other loops already read.

CREATE TABLE IF NOT EXISTS webmodel_sessions (
  session_id               TEXT PRIMARY KEY,
  provider                 TEXT NOT NULL,
  provider_model           TEXT,
  profile_id               TEXT NOT NULL DEFAULT 'default',
  conversation_url         TEXT,
  provider_conversation_id TEXT,
  state                    TEXT NOT NULL DEFAULT 'new',   -- new|ready|running|complete|auth_required|failed|closed
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  last_turn_id             TEXT,
  state_handle             TEXT,
  metadata_json            TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS webmodel_sessions_provider ON webmodel_sessions(provider, state);
CREATE INDEX IF NOT EXISTS webmodel_sessions_handle ON webmodel_sessions(state_handle);

CREATE TABLE IF NOT EXISTS webmodel_turns (
  turn_id           TEXT PRIMARY KEY,
  session_id        TEXT NOT NULL,
  ordinal           INTEGER NOT NULL,
  provider          TEXT NOT NULL,
  user_content      TEXT NOT NULL,
  assistant_content TEXT,
  started_at        TEXT,
  completed_at      TEXT,
  capture_method    TEXT,
  provider_turn_id  TEXT,
  status            TEXT NOT NULL,                        -- complete|failed
  failure_code      TEXT,
  raw_ref           TEXT,
  raw_digest        TEXT,
  prompt_digest     TEXT,
  response_digest   TEXT,
  conversation_url  TEXT,
  invocation_id     TEXT,
  ledger_event_id   TEXT,
  state_handle      TEXT,
  request_id        TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS webmodel_turns_session ON webmodel_turns(session_id, ordinal);
CREATE INDEX IF NOT EXISTS webmodel_turns_handle ON webmodel_turns(state_handle);
CREATE UNIQUE INDEX IF NOT EXISTS webmodel_turns_request ON webmodel_turns(request_id);

CREATE TABLE IF NOT EXISTS state_handles (
  handle     TEXT PRIMARY KEY,                            -- state://<id>
  objective  TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'open',                -- open|closed
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS state_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  handle     TEXT NOT NULL,
  ts         TEXT NOT NULL,
  kind       TEXT NOT NULL,                               -- objective|note|turn|artifact|open_question|receipt
  actor      TEXT,                                        -- chatgpt-web | claude-web | agent:<name> | owner
  summary    TEXT NOT NULL,
  ref        TEXT,
  weight     INTEGER NOT NULL DEFAULT 5
);
CREATE INDEX IF NOT EXISTS state_entries_handle ON state_entries(handle, id);
