-- 0175_agent_turns_tags.sql — filterable issue tags + dedup key; backfill cc_turns into agent_turns.
ALTER TABLE agent_turns ADD COLUMN turn_key TEXT;
ALTER TABLE agent_turns ADD COLUMN tags_json TEXT;
CREATE INDEX IF NOT EXISTS agent_turns_turn_key_idx ON agent_turns(agent, turn_key);
CREATE INDEX IF NOT EXISTS agent_turns_tags_idx ON agent_turns(tags_json);

-- One-time import: existing Claude turns → universal ledger (no repo bloat; data already in D1).
INSERT INTO agent_turns (
  ts, agent, source, session, cwd, input_kind, user_input, user_input_chars,
  assistant_text, n_tools, tools_json, commands_json, files_json,
  audit_verdict, audit_note, audit_engine, dispatch_key, turn_key, tags_json
)
SELECT
  ts, 'claude', 'import', session, cwd, input_kind, user_input, user_input_chars,
  assistant_text, n_tools, tools_json, commands_json, files_json,
  audit_verdict, audit_note, audit_engine, 'CLI_CLAUDE_CODE',
  'cc:' || id,
  '["import","unaudited"]'
FROM cc_turns
WHERE NOT EXISTS (
  SELECT 1 FROM agent_turns at WHERE at.turn_key = 'cc:' || cc_turns.id
);