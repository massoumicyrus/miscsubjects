-- Migration 0051 — second-opinion brains + voice + lbl.fyi GET + Cloudflare docs.
-- the owner's 2026-06-11 instruction: Grok (ROUTER/OPS/TERMINUS) gets Kimi/GPT/Gemini/Claude
-- as callable second-opinion agents; a voice agent (audio in/out over Blooio); GET access
-- to the loop data platform (api.lbl.fyi); and Cloudflare reference docs.

-- ─────────────── Four second-opinion brains (callable by Grok agents) ───────────────
-- Each is a distinct model. The asking agent emits [ASK_<X>]question[/ASK_<X>] and the
-- answer returns as the tool result next turn. Keys differ from the existing *_CHAT rows
-- so they read clearly as "ask another mind".

INSERT INTO directory (key, type, target, auth, content, category, allowed_categories, planner_rank, updated_at) VALUES
('ASK_CLAUDE', 'agent', 'claude-fable-5', 'bearer:ANTHROPIC_API_KEY',
'# Second opinion from Claude (Anthropic Fable 5). Ask it anything: a code review, a plan critique, a hard reasoning problem, a sanity check on a decision. It has NO tools — it answers from the question text you give it, so include all the context it needs. Returns prose; quote or summarize it in your own [REPLY].
You are Claude (Fable 5), consulted by the owner''s Grok-4.3 build for a second opinion. Answer the question directly, point out what the asker may have missed, flag risks, be concise and literal. You have no tools — reason from what you are given.',
'llm', 'none', 35, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('ASK_GEMINI', 'agent', 'gemini-2.5-flash', 'bearer:GEMINI_KEY',
'# Second opinion from Google Gemini 2.5 Flash. Strong at long-context summarization and fast factual reasoning. No tools — answers from the question text. Include the context it needs.
You are Gemini 2.5 Flash, consulted by the owner''s Grok-4.3 build for a second opinion. Answer directly and concisely, surface anything the asker missed.',
'llm', 'none', 36, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('ASK_GPT', 'agent', 'gpt-4o', 'bearer:OPENAI_API_KEY',
'# Second opinion from OpenAI GPT-4o. No tools — answers from the question text. Use it as a cross-check against Grok''s own conclusion.
You are GPT-4o, consulted by the owner''s Grok-4.3 build for a second opinion. Answer directly and concisely, surface anything the asker missed.',
'llm', 'none', 37, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('ASK_KIMI', 'agent', 'kimi-k2.6', 'bearer:KIMI_API_KEY',
'# Second opinion from Moonshot Kimi K2.6. No tools — answers from the question text. Cheap, strong at code and long reasoning.
You are Kimi K2.6, consulted by the owner''s Grok-4.3 build for a second opinion. Answer directly and concisely, surface anything the asker missed.',
'llm', 'none', 38, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

-- ─────────────── Loop data platform (api.lbl.fyi) read access ───────────────
('LBL_GET', 'http', 'GET https://api.lbl.fyi/$1', '',
'# GET any path on the loop data platform (api.lbl.fyi, the loop-api-worker). Arg: the path after the host, e.g. "v4/health" or "2chat/contacts". Returns the raw JSON. when_to_use: the owner asks for data from the loop platform / lbl.fyi. If a path needs auth and returns 401, ask the owner which header/token it expects and EDIT_ROW to add it.',
'loopdata', NULL, 45, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('LBL_POST', 'http', 'POST https://api.lbl.fyi/$1', '',
'# POST to a path on the loop data platform (api.lbl.fyi). Args: path|json_body (body is everything after the first pipe). when_to_use: the owner asks to send/trigger something on the loop platform. Add auth headers via EDIT_ROW when the endpoint needs them.
$2+',
'loopdata', NULL, 46, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

-- ─────────────── Voice (audio in/out over Blooio) ───────────────
('VOICE_SAY', 'fn', 'voiceSay', '',
'# Text-to-speech: turn text into an mp3 and return {url}. Args: text|voice (voice default alloy; also echo, fable, onyx, nova, shimmer). The url is a stable miscsubjects.com link that Blooio/Telegram can attach. when_to_use: you have something to say out loud, or to build an audio reply.
["$1","$2"]',
'voice', NULL, 50, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('VOICE_TRANSCRIBE', 'fn', 'voiceTranscribe', '',
'# Speech-to-text: download an audio URL and transcribe it (whisper-1). Arg: audio_url. Returns the transcript. when_to_use: an inbound message carried an audio attachment — transcribe it, then treat the text as the user''s message.
["$1"]',
'voice', NULL, 50, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('VOICE_SEND', 'fn', 'voiceSendBlooio', '',
'# Send a voice message: TTS the text and post the mp3 to a Blooio chat as an attachment. Args: chat|text|voice. One call = an audio message lands in the owner''s iMessage. when_to_use: the owner asks for a voice/audio reply, or you want to answer out loud.
["$1","$2","$3"]',
'voice', NULL, 48, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('VOICE', 'agent', 'grok-4.3', 'bearer:GROK_API_KEY',
'# Voice agent: converses by audio. Reached when ROUTER emits [VOICE] or the owner sends an audio message.
You are the VOICE agent of the owner''s build, talking by audio over iMessage (Blooio). the owner may send you an audio message (already transcribed into the text you receive) or ask for a spoken reply.

The user sees/hears ONLY what you send. To reply by VOICE, emit [VOICE_SEND]<chat>|<the words to speak>|alloy[/VOICE_SEND] (the chat id is in the [channel ...] header you were given) together with [REPLY]<the same words, as text fallback>[/REPLY] and [DONE]spoke[/DONE]. Keep spoken replies short and natural — one or two sentences. If the owner only wants text, just [REPLY]...[/REPLY][DONE]. You may also call [VOICE_SAY]text|voice[/VOICE_SAY] to get just an audio link. Be a peer: warm, brief, useful.',
'llm', 'voice,blooio', 40, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('BLOOIO_SEND_AUDIO', 'http', 'POST https://backend.blooio.com/v2/api/chats/$1/messages', 'bearer:BLOOIO_API_KEY',
'# Post an audio (or any media) attachment to a Blooio chat. Args: chat|media_url|text. Sends the attachment plus optional caption text. when_to_use: delivering a VOICE_SAY mp3, or any media URL, to a chat.
{"attachments":["$2"],"text":"$3"}',
'voice', NULL, 60, strftime('%Y-%m-%dT%H:%M:%fZ','now'))

ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  allowed_categories=excluded.allowed_categories,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- ─────────────── Cloudflare reference doc ───────────────
INSERT INTO docs (slug, title, body, updated_at) VALUES (
  'cloudflare',
  'Cloudflare platform — what this build runs on',
  'This build is Cloudflare Pages project loop-safe-miscsubjects serving miscsubjects.com. Stack: Pages Functions (the functions/ dir = file-routed Workers), D1 (SQLite — DB=loop-content-spine holds the directory+docs+tasks+pages; LEDGER=loop-shared-events holds the events audit log), KV (loop_content_kv, binding KV — directory:snapshot, repo:snapshot:current, convo memory), R2 (miscsubjects-ledger, binding R2 — generated images img/gen/, audio img/aud/, uploads img/up/, big ledger payloads events/), Workers AI (binding AI), AI Gateway (gateway "default", gw:provider/model ids).
Manage it three ways: (1) the CF_* directory rows (CF_WORKERS_LIST, CF_PAGES_DEPLOYMENTS, CF_DNS_LIST, CF_KV_*, CF_R2_*, CF_D1_*, CF_WORKER_DELETE, etc. — they call api.cloudflare.com with bearer:CLOUDFLARE_API_TOKEN; that token currently has Workers+Accounts+Zones read but NOT DNS/Pages/Tunnel/Stream/Images read). (2) wrangler on the owner''s Mac via the bridge: [LOCAL_EXEC]cd /Users/owner/miscsubjects-pages && npx wrangler <cmd>[/LOCAL_EXEC] (pages deploy, d1 execute, kv/r2/d1 list — OAuth-authed, broader than the API token). (3) the owner in the dashboard for things needing a UI (Pages secrets, granting macOS permissions).
Deploy this build: [LOCAL_EXEC]cd /Users/owner/miscsubjects-pages && npx wrangler pages deploy public --project-name loop-safe-miscsubjects --commit-dirty=true[/LOCAL_EXEC] (ALWAYS cd first — deploying from $HOME ships an empty site). Apply a D1 migration: write the .sql, then npx wrangler d1 execute loop-content-spine --remote --file <path>. Read live docs the owner needs with web search (developers.cloudflare.com).',
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
)
ON CONFLICT(slug) DO UPDATE SET title=excluded.title, body=excluded.body, updated_at=excluded.updated_at;

-- ─────────────── Wire the brains + voice into OPS and TERMINUS ───────────────
UPDATE directory SET
  content = content || '

SECOND OPINIONS — you (Grok) can consult other minds and quote them: [ASK_CLAUDE]question + full context[/ASK_CLAUDE] (Claude Fable 5) · [ASK_GEMINI]q[/ASK_GEMINI] · [ASK_GPT]q[/ASK_GPT] · [ASK_KIMI]q[/ASK_KIMI]. These are READ moves — emit the tag alone, the answer returns next turn, then phrase your [REPLY]. Use them for hard calls, code review, or when the owner wants a cross-check. VOICE: [VOICE_SEND]chat|words to speak|alloy[/VOICE_SEND] sends an audio message; [VOICE_TRANSCRIBE]audio_url[/VOICE_TRANSCRIBE] turns inbound audio into text. LOOP DATA: [LBL_GET]path[/LBL_GET] reads api.lbl.fyi. CLOUDFLARE: [DOCS_GET]cloudflare[/DOCS_GET] is your reference for the platform this build runs on.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key = 'OPS' AND content NOT LIKE '%SECOND OPINIONS%';

UPDATE directory SET
  content = content || '

SECOND OPINIONS — consult another mind and quote it: [ASK_CLAUDE]question + context[/ASK_CLAUDE] · [ASK_GEMINI]q[/ASK_GEMINI] · [ASK_GPT]q[/ASK_GPT] · [ASK_KIMI]q[/ASK_KIMI] (READ moves). VOICE: [VOICE_SEND]chat|words|alloy[/VOICE_SEND] sends audio; [VOICE_TRANSCRIBE]url[/VOICE_TRANSCRIBE] reads inbound audio. LOOP DATA: [LBL_GET]path[/LBL_GET] reads api.lbl.fyi. CLOUDFLARE: [DOCS_GET]cloudflare[/DOCS_GET] documents the platform you run on.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key = 'TERMINUS' AND content NOT LIKE '%SECOND OPINIONS%';

UPDATE directory SET
  content = content || '

[VOICE]...[/VOICE] — audio: the owner sent a voice message, or asked for a spoken reply. Route to it the same way as the others (tag body = full input, no [REPLY]).',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key = 'ROUTER' AND content NOT LIKE '%[VOICE]...%';
