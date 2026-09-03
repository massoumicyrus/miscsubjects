-- 0101_cc_system_prompt.sql — capture the injected system context per Claude-Code turn.
-- The literal Anthropic system prompt is NOT stored in the transcript; what IS available is the
-- injected <system-reminder> context (CLAUDE.md + environment + harness). The hook now sends it.
ALTER TABLE cc_turns ADD COLUMN system_prompt TEXT;
