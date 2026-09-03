-- 0274: Per-turn token/cost fields for CLI agents (fed by grok-turn-log Stop hook).
ALTER TABLE agent_turns ADD COLUMN model_id TEXT;
ALTER TABLE agent_turns ADD COLUMN tokens_in INTEGER;
ALTER TABLE agent_turns ADD COLUMN tokens_out INTEGER;
ALTER TABLE agent_turns ADD COLUMN context_tokens_peak INTEGER;
ALTER TABLE agent_turns ADD COLUMN cost_usd REAL;
ALTER TABLE agent_turns ADD COLUMN cost_usd_ticks INTEGER;
ALTER TABLE agent_turns ADD COLUMN cost_estimated INTEGER DEFAULT 0;