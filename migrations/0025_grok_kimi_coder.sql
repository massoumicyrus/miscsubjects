-- 0025: Grok 4.3 everywhere, full xAI media surface, Kimi, GitHub read tools, CODER agent.

-- ROUTER and BUILDER move to grok-4.3.
UPDATE directory SET target='grok-4.3', updated_at=datetime('now') WHERE key IN ('ROUTER','BUILDER');

-- Persist the model + web-search defaults the /grok editor reads.
INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES
 ('grok_model','grok-4.3', datetime('now')),
 ('grok_web_search','1', datetime('now'));

-- One explicit routing line so ROUTER hands code questions to CODER (the owner-requested).
UPDATE directory
SET content = content || char(10) ||
 'For any question about THIS build''s code, architecture, or files, call [CODER]<the request>[/CODER]. CODER reads the whole repo and proposes edits; relay its summary in [REPLY].',
 updated_at=datetime('now')
WHERE key='ROUTER';

INSERT OR REPLACE INTO directory
 (key, type, target, auth, content, category, planner_rank, updated_at)
VALUES

-- ── LLM chat agents ──────────────────────────────────────────────────────────
('GROK_CHAT', 'agent', 'grok-4.3', 'bearer:GROK_API_KEY',
 'You are Grok 4.3. Answer directly and literally. Web search is applied when the /grok toggle is on.',
 'llm', 6, datetime('now')),

('KIMI_CHAT', 'agent', 'kimi-k2.6', 'bearer:KIMI_API_KEY',
 'You are Kimi (Moonshot k2.6). Answer directly and literally.',
 'llm', 6, datetime('now')),

-- CODER: reads the entire build via GitHub and proposes edits. Reachable from ROUTER.
('CODER', 'agent', 'grok-4.3', 'bearer:GROK_API_KEY',
 '# Coding agent. Reads the whole miscsubjects-pages repo via GitHub and proposes edits.
You are CODER, the engineer for the miscsubjects.com build (Cloudflare Pages + D1 + KV + R2, repo [OWNER_HANDLE]/miscsubjects-pages).
Available tools (emit [KEY]args[/KEY]):
- [GITHUB_LIST_TREE][/GITHUB_LIST_TREE] — every file path in the repo.
- [GITHUB_GET_FILE]path/to/file[/GITHUB_GET_FILE] — full file contents (base64, decode it).
- [GITHUB_SEARCH_CODE]query[/GITHUB_SEARCH_CODE] — find files by content.
- [DIRECTORY_LIST][/DIRECTORY_LIST] — every callable tool row.
- [PAGES_GET]slug[/PAGES_GET] / [PAGES_PUT]slug|title|html[/PAGES_PUT] — edit served pages.
Read what you need, then reply with a concrete diff or exact edits. Do not invent file paths — list the tree first. End with [DONE]<reason>[/DONE].',
 'llm', 7, datetime('now')),

-- ── Grok Imagine: images ─────────────────────────────────────────────────────
('GROK_IMAGE', 'http', 'POST https://api.x.ai/v1/images/generations', 'bearer:GROK_API_KEY',
 '# Generate an image from a text prompt. Arg: prompt. Returns a JSON url. Model grok-imagine-image-quality ($0.05/image).
{"model":"grok-imagine-image-quality","prompt":"$1"}',
 'grok', 100, datetime('now')),

('GROK_IMAGE_EDIT', 'http', 'POST https://api.x.ai/v1/images/edits', 'bearer:GROK_API_KEY',
 '# Edit an image with natural language. Args: prompt|image_url. Returns a JSON url.
{"model":"grok-imagine-image-quality","prompt":"$1","image":{"url":"$2","type":"image_url"}}',
 'grok', 100, datetime('now')),

-- ── Grok Imagine: video (async: START returns request_id, GET polls) ──────────
('GROK_VIDEO_START', 'http', 'POST https://api.x.ai/v1/videos/generations', 'bearer:GROK_API_KEY',
 '# Start a text-to-video job. Args: prompt|duration_seconds(1-15). Returns request_id. Poll with GROK_VIDEO_GET. Model grok-imagine-video ($0.05/sec).
{"model":"grok-imagine-video","prompt":"$1","duration":$2,"aspect_ratio":"16:9","resolution":"720p"}',
 'grok', 100, datetime('now')),

('GROK_VIDEO_GET', 'http', 'GET https://api.x.ai/v1/videos/$1', 'bearer:GROK_API_KEY',
 '# Poll a video job. Arg: request_id. status pending|done|failed|expired; when done returns video.url.',
 'grok', 100, datetime('now')),

-- ── Models + audio (TTS returns mp3 bytes, STT needs multipart — REST-only) ───
('GROK_MODELS', 'http', 'GET https://api.x.ai/v1/models', 'bearer:GROK_API_KEY',
 '# List every model on the xAI API. No args.',
 'grok', 100, datetime('now')),

('GROK_TTS', 'http', 'POST https://api.x.ai/v1/tts', 'bearer:GROK_API_KEY',
 '# Text to speech. Args: text|voice_id(eve|ara|rex|sal|leo). Returns mp3 bytes ($15/1M chars). Note: response is binary audio, not JSON.
{"text":"$1","voice_id":"$2","language":"en"}',
 'grok', 100, datetime('now')),

-- ── GitHub read tools (power CODER) ──────────────────────────────────────────
('GITHUB_LIST_TREE', 'http', 'GET https://api.github.com/repos/[OWNER_HANDLE]/miscsubjects-pages/git/trees/main?recursive=1', 'headers:{"Authorization":"Bearer $GITHUB_TOKEN","User-Agent":"miscsubjects-build","Accept":"application/vnd.github+json"}',
 '# Every file path in the build repo (recursive tree of main). No args.',
 'github', 100, datetime('now')),

('GITHUB_GET_FILE', 'http', 'GET https://api.github.com/repos/[OWNER_HANDLE]/miscsubjects-pages/contents/$1', 'headers:{"Authorization":"Bearer $GITHUB_TOKEN","User-Agent":"miscsubjects-build","Accept":"application/vnd.github+json"}',
 '# Full contents of one repo file (base64 in .content). Arg: path relative to repo root, e.g. functions/api/dispatch.js.',
 'github', 100, datetime('now')),

('GITHUB_SEARCH_CODE', 'http', 'GET https://api.github.com/search/code?q=$1+repo:[OWNER_HANDLE]/miscsubjects-pages', 'headers:{"Authorization":"Bearer $GITHUB_TOKEN","User-Agent":"miscsubjects-build","Accept":"application/vnd.github+json"}',
 '# Search the build repo by code content. Arg: query string.',
 'github', 100, datetime('now'));
