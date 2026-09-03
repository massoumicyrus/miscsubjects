-- 0081: link inventory (T9). Every link the build references, ontologically grouped
-- into directory rows. Each row's docs block lists the links; the target is a
-- representative GET so the row is also dispatchable. Removal of a link = redundant or
-- a mistake, stated in the row.

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, allowed_categories, seq, enabled, planner_visible, planner_rank, updated_at) VALUES
('SITE_LINKS', 'http', 'GET https://miscsubjects.com/admin/directory', '',
 '# Site surfaces (the only two human pages + every functional endpoint).
# DIRECTORY  https://miscsubjects.com/admin/directory   (the one surface; + /new, /models, /graph, /<key>)
# LEDGER     https://miscsubjects.com/admin/ledger       (every payload in/out)
# DISPATCH   POST https://miscsubjects.com/api/dispatch  {"key","body"}
# SLUG       POST https://miscsubjects.com/s/<slug>       {"body"}
# DIRECTORY REST  GET|PUT|PATCH|DELETE https://miscsubjects.com/api/directory/<key>
# PROVIDERS  GET https://miscsubjects.com/api/providers   (LLM/model registry)
# DURABLE    GET https://miscsubjects.com/api/durable/ping  (bound Durable Object)
# CONTENT    GET https://miscsubjects.com/api/content/<slug>  (peptides/articles data)
# every other former page (/matrix /ads /queue /workbench /content /grok /api …) now 302 -> /admin/directory',
 'pages', '*', 100, 1, 1, 100, datetime('now')),

('PROVIDER_DOCS', 'http', 'GET https://docs.x.ai', '',
 '# LLM/model provider documentation (external). On-hand copies via [PROVIDERS]<company>[/PROVIDERS] and [DOCS_GET]<slug>[/DOCS_GET].
# xAI (Grok)   https://docs.x.ai            · console https://console.x.ai · mgmt https://management-api.x.ai · key GROK_API_KEY
# OpenAI       https://platform.openai.com/docs · pricing https://platform.openai.com/docs/pricing · key OPENAI_API_KEY
# Anthropic    https://platform.claude.com/docs · key ANTHROPIC_API_KEY
# Google Gemini https://ai.google.dev/gemini-api/docs · key GEMINI_API_KEY
# ArcAds       https://external-api.arcads.ai (images+video) · spec R2:docs/api/arcads/openapi-spec.json',
 'llm', '*', 100, 1, 1, 100, datetime('now')),

('TOOLING_DOCS', 'http', 'GET https://developers.cloudflare.com', '',
 '# Platform + protocol references (external).
# Cloudflare   https://developers.cloudflare.com · api https://api.cloudflare.com (Workers/Pages/D1/KV/R2/DO/Workflows)
# MCP          https://modelcontextprotocol.io
# JSON Schema  https://json-schema.org
# MDN          https://developer.mozilla.org
# GitHub repo  https://github.com/[OWNER_HANDLE]/miscsubjects-pages · api https://api.github.com',
 'cloudflare', '*', 100, 1, 1, 100, datetime('now')),

('CHANNEL_APIS', 'http', 'GET https://backend.blooio.com', '',
 '# Channel + commerce API hosts (external). Tools that call them live as their own rows.
# Blooio (iMessage) https://backend.blooio.com  · key BLOOIO_API_KEY  · rows BLOOIO_*
# 2chat (WhatsApp)  https://api.p.2chat.io       · key TWOCHAT_API_KEY
# Stripe            https://api.stripe.com        · key STRIPE_SECRET_KEY · rows STRIPE_* (GET only by law)
# Meta CAPI         https://graph.facebook.com    · functions/capi.js
# DuoPlus CloudPhone https://openapi.duoplus.net  · header DuoPlus-API-Key',
 'blooio', '*', 100, 1, 1, 100, datetime('now'));
