-- 0197_grok_turns.sql — per-turn Grok CLI session log (fed by Stop hook hooks/grok-turn-log.js).
-- Mirror of cc_turns so Grok CLI gets the same spine table + admin lens + ledger fold as Claude Code.
-- Revert: DROP TABLE grok_turns;
CREATE TABLE IF NOT EXISTS grok_turns (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ts               TEXT,
  session          TEXT,
  cwd              TEXT,
  input_kind       TEXT DEFAULT 'human',
  user_input       TEXT,
  user_input_chars INTEGER,
  assistant_text   TEXT,
  n_tools          INTEGER,
  tools_json       TEXT,
  commands_json    TEXT,
  files_json       TEXT,
  system_prompt    TEXT,
  audit_verdict    TEXT,
  audit_note       TEXT,
  audit_engine     TEXT,
  turn_key         TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS grok_turns_session_idx ON grok_turns(session);
CREATE INDEX IF NOT EXISTS grok_turns_id_idx ON grok_turns(id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS grok_turns_turn_key_idx ON grok_turns(turn_key);

-- Backfill from existing universal agent_turns rows (hook + backfill grok only).
INSERT INTO grok_turns (
  ts, session, cwd, input_kind, user_input, user_input_chars, assistant_text,
  n_tools, tools_json, commands_json, files_json, turn_key
)
SELECT
  ts, session, cwd, input_kind, user_input, user_input_chars, assistant_text,
  n_tools, tools_json, commands_json, files_json, turn_key
FROM agent_turns
WHERE agent = 'grok'
  AND source IN ('hook', 'backfill')
  AND turn_key IS NOT NULL
  AND turn_key != ''
  AND NOT EXISTS (
    SELECT 1 FROM grok_turns gt WHERE gt.turn_key = agent_turns.turn_key
  );