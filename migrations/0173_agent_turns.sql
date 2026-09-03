-- 0173_agent_turns.sql — universal per-turn log for all CLI coding agents (mirror cc_turns + agent + trace_id).
-- Fed by hooks (.claude/hooks, hooks/*) and dispatch-side capture on CLI_* rows.
-- Heavy stdout → R2 via r2_stdout_key; previews stay in assistant_text.
-- Revert: DROP TABLE agent_turns;
CREATE TABLE IF NOT EXISTS agent_turns (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ts               TEXT NOT NULL,
  agent            TEXT NOT NULL,
  source           TEXT NOT NULL DEFAULT 'hook',
  session          TEXT,
  trace_id         TEXT,
  cwd              TEXT,
  input_kind       TEXT DEFAULT 'human',
  user_input       TEXT,
  user_input_chars INTEGER,
  assistant_text   TEXT,
  n_tools          INTEGER DEFAULT 0,
  tools_json       TEXT,
  commands_json    TEXT,
  files_json       TEXT,
  r2_stdout_key    TEXT,
  dispatch_key     TEXT,
  audit_verdict    TEXT,
  audit_note       TEXT,
  audit_engine     TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS agent_turns_agent_idx ON agent_turns(agent);
CREATE INDEX IF NOT EXISTS agent_turns_trace_idx ON agent_turns(trace_id);
CREATE INDEX IF NOT EXISTS agent_turns_id_idx ON agent_turns(id DESC);
CREATE INDEX IF NOT EXISTS agent_turns_session_idx ON agent_turns(session);
CREATE INDEX IF NOT EXISTS agent_turns_dispatch_key_idx ON agent_turns(dispatch_key);