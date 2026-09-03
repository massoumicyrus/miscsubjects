-- 0024: Cloudflare AI Gateway (compat endpoint) + Workers AI binding rows.
-- gw:<provider>/<model> targets route through
-- https://gateway.ai.cloudflare.com/v1/$CF_ACCOUNT_ID/default/compat/chat/completions
-- (kernel providerEndpoint, kind=openai_compat). Gateway auth is ON -> rows carry
-- bearer:AIG_TOKEN (a Cloudflare API token with AI Gateway Run permission;
-- CLOUDFLARE_API_TOKEN and the wrangler OAuth both return 401 on this endpoint —
-- verified live 2026-06-09).

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, updated_at)
VALUES
('GW_FABLE', 'agent', 'gw:anthropic/claude-fable-5', 'bearer:AIG_TOKEN',
 'You are a direct assistant. Answer plainly and literally.',
 'llm', datetime('now')),

('GW_DEEPSEEK', 'agent', 'gw:deepseek/deepseek-v4-pro', 'bearer:AIG_TOKEN',
 'You are a direct assistant. Answer plainly and literally.',
 'llm', datetime('now')),

('WORKERS_AI_CHAT', 'agent', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', '',
 'You are a direct assistant. Answer plainly and literally.',
 'llm', datetime('now')),

('GW_MODELS', 'http', 'GET https://gateway.ai.cloudflare.com/v1/$CF_ACCOUNT_ID/default/compat/models', 'bearer:AIG_TOKEN',
 '# List every model available on the Cloudflare AI Gateway compat endpoint (162 models incl. claude-fable-5, deepseek-v4-pro). No args.',
 'llm', datetime('now'));
