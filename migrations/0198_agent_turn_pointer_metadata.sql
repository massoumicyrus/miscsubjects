-- 0198_agent_turn_pointer_metadata.sql — pointer-first audit metadata for CLI/forum turns.
-- Full prompts/transcripts live in files or R2. D1 keeps hashes and paths so agents can verify
-- evidence without stuffing large payloads into prompts or preview columns.
ALTER TABLE agent_turns ADD COLUMN user_input_sha256 TEXT;
ALTER TABLE agent_turns ADD COLUMN assistant_sha256 TEXT;
ALTER TABLE agent_turns ADD COLUMN prompt_path TEXT;
ALTER TABLE agent_turns ADD COLUMN assistant_path TEXT;
