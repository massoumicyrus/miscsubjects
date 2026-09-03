-- 0080: directory row for the provider/model registry (the on-hand API documentation
-- that the company-aware LLM-creation form + models surface read). Served by
-- functions/api/providers/[[path]].js from functions/_lib/providers.js.
INSERT OR REPLACE INTO directory
  (key, type, target, auth, content, category, allowed_categories, seq, enabled, planner_visible, planner_rank, updated_at)
VALUES (
  'PROVIDERS',
  'http',
  'GET https://miscsubjects.com/api/providers/$1',
  '',
  '# Provider/model registry — every company (xai|anthropic|openai|google), every model (text|image|video|stt|tts), with endpoint, api_key_name, every variable, cost in/out/cache, longest output, reasoning options, temperature range, and docs links. The on-hand API documentation behind the LLM-creation form.
# INVOKE: [PROVIDERS][/PROVIDERS] full registry; [PROVIDERS]xai[/PROVIDERS] one company; arg $1 = company (or company/modality via REST).
# REST: GET https://miscsubjects.com/api/providers · /api/providers/anthropic · /api/providers/xai/video
{"op":"$1"}',
  'llm',
  '*',
  100,
  1,
  1,
  100,
  datetime('now')
);
