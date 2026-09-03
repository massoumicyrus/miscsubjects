CREATE TABLE IF NOT EXISTS cc_turns (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ts               TEXT,
  session          TEXT,
  cwd              TEXT,
  user_input       TEXT,
  user_input_chars INTEGER,
  n_tools          INTEGER,
  tools_json       TEXT,
  commands_json    TEXT,
  files_json       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS cc_turns_session_idx ON cc_turns(session);
CREATE INDEX IF NOT EXISTS cc_turns_id_idx ON cc_turns(id DESC);
