-- 0109: Batch-fix HTTP rows to standard format

UPDATE directory SET content = '# WHAT: List AI Gateways on the account
# WHEN_TO_USE: you need to aig list
# ARGS: account_id
# EX: [AIG_LIST][/AIG_LIST]
# List AI Gateways on the account. Arg: account_id.' WHERE key = 'AIG_LIST';
UPDATE directory SET content = '# WHAT: Raw call to AI Gateway REST. Arg $1 = full JSON body (model + messages)
# WHEN_TO_USE: you need to aig raw
# ARGS: see content
# EX: [AIG_RAW]arg1[/AIG_RAW]
$1+' WHERE key = 'AIG_RAW';
UPDATE directory SET content = '# WHAT: Generic Apps Script invocation. $1=action name, $2=JSON args. Routes to the airunner web app deployment which has Google Drive / Sheets / Tasks / Calendar / Apps Script-runtime access. Use when you need to read/write the user''s Google stuff. $$2 (double dollar) inlines the args JSON raw, so callers pass {"k":"v"} not as a string but as a JSON value
# WHEN_TO_USE: any natural language about Google Drive / Sheets / Tasks / Calendar / Apps Script.
# ARGS: see content
# EX: [APPS_SCRIPT_RUN]arg1|arg2[/APPS_SCRIPT_RUN]
{"action":"$1","args":$$2}' WHERE key = 'APPS_SCRIPT_RUN';
UPDATE directory SET content = '# WHAT: Natural-language editable articles. One row per article in D1. Slots: what_it_is, mechanism, evidence_animal, evidence_human, marketing_vs_evidence, open_questions, disclaimer, custom
# WHEN_TO_USE: any natural-language article CRUD or "regenerate the X slot of Y", "score the Y article", "create article called X".
# ARGS: see content
# EX: [ARTICLES][/ARTICLES]
# Natural-language editable articles. One row per article in D1. Slots: what_it_is, mechanism, evidence_animal, evidence_human, marketing_vs_evidence, open_questions, disclaimer, custom.
# Public page: https://miscsubjects.com/a/<slug>
# ARGS — first arg is the operation:
#   list                                                      → all articles (slug,title,subject,updated_at)
#   get|<slug>                                                → one article + latest slot versions
#   create|<slug>|<title>|<subject>                           → make a new article shell
#   update|<slug>|<title>                                     → rename
#   delete|<slug>                                             → drop the article + every slot version
#   compose|<slug>|<slot_key>|<brief?>                        → grok-4.3 writes a new version of <slot_key>
#   judge|<slug>                                              → grok-4.3 scores every current slot vs STYLE_TOPOLOGY rubric
#   set|<slug>|<slot_key>|<content>                           → operator overrides slot content (no LLM)
# WHEN_TO_USE: any natural-language article CRUD or "regenerate the X slot of Y", "score the Y article", "create article called X".' WHERE key = 'ARTICLES';
UPDATE directory SET content = '# WHAT: Read an article by slug
# WHEN_TO_USE: you need to art get
# ARGS: see content
# EX: [ART_GET][/ART_GET]
# Read an article by slug.' WHERE key = 'ART_GET';
UPDATE directory SET content = '# WHAT: Edit an article by slug
# WHEN_TO_USE: you need to art patch
# ARGS: slug|json_body
# EX: [ART_PATCH]arg2[/ART_PATCH]
$2+' WHERE key = 'ART_PATCH';
UPDATE directory SET content = '# WHAT: Fetch a URL from the Mac (curl, first 20000 bytes)
# WHEN_TO_USE: reading a page/API from the owner''s own IP instead of Cloudflare''s.
# ARGS: url
# EX: [BROWSER_FETCH]arg1[/BROWSER_FETCH]
{"cmd":"sh","args":["-lc","curl -sSL \"$1\" | head -c 20000"],"timeout":60000}' WHERE key = 'BROWSER_FETCH';
UPDATE directory SET content = '# WHAT: Extract LLM-structured JSON from a URL via Cloudflare Browser Rendering. $1=account_id, $2=JSON body {url, prompt?, response_format?}
# WHEN_TO_USE: "pull <fields> as json from <url>"
# ARGS: see content
# EX: [BROWSER_JSON]arg2[/BROWSER_JSON]
$$2' WHERE key = 'BROWSER_JSON';
UPDATE directory SET content = '# WHAT: Extract all links from a URL via Cloudflare Browser Rendering. $1=account_id, $2=JSON body {url}
# WHEN_TO_USE: "what links does <url> have"
# ARGS: see content
# EX: [BROWSER_LINKS]arg2[/BROWSER_LINKS]
$$2' WHERE key = 'BROWSER_LINKS';
UPDATE directory SET content = '# WHAT: Get the markdown of a URL via Cloudflare Browser Rendering. $1=account_id, $2=JSON body {url}. Returns the rendered markdown
# WHEN_TO_USE: "fetch as markdown <url>" or "what does <url> say"
# ARGS: see content
# EX: [BROWSER_MARKDOWN]arg2[/BROWSER_MARKDOWN]
$$2' WHERE key = 'BROWSER_MARKDOWN';
UPDATE directory SET content = '# WHAT: Render a URL as PDF via Cloudflare Browser Rendering. $1=account_id, $2=JSON body {url}. Returns binary PDF
# WHEN_TO_USE: "save <url> as PDF"
# ARGS: see content
# EX: [BROWSER_PDF]arg2[/BROWSER_PDF]
$$2' WHERE key = 'BROWSER_PDF';
UPDATE directory SET content = '# WHAT: Run a Playwright CLI command on the Mac (npx -y playwright …). g. "screenshot https://x.com /tmp/x.png". First run downloads browsers (~2 min). For full browser automation absorb the playwright MCP server via MCP_PROBE
# WHEN_TO_USE: you need to browser playwright
# ARGS: the playwright arguments, e
# EX: [BROWSER_PLAYWRIGHT]arg1[/BROWSER_PLAYWRIGHT]
{"cmd":"sh","args":["-lc","npx -y playwright $1+"],"timeout":600000}' WHERE key = 'BROWSER_PLAYWRIGHT';
UPDATE directory SET content = '# WHAT: Extract structured data by selectors via Cloudflare Browser Rendering. $1=account_id, $2=JSON body {url, elements:[{selector}]}
# WHEN_TO_USE: "scrape <selector> from <url>"
# ARGS: see content
# EX: [BROWSER_SCRAPE]arg2[/BROWSER_SCRAPE]
$$2' WHERE key = 'BROWSER_SCRAPE';
UPDATE directory SET content = '# WHAT: Get a PNG screenshot of a URL via Cloudflare Browser Rendering. $1=account_id, $2=JSON body {url, screenshotOptions?}. Returns binary PNG
# WHEN_TO_USE: "screenshot <url>"
# ARGS: see content
# EX: [BROWSER_SCREENSHOT]arg2[/BROWSER_SCREENSHOT]
$$2' WHERE key = 'BROWSER_SCREENSHOT';
UPDATE directory SET content = '# WHAT: Run the browser-use agent (AI browser driver).  NOT INSTALLED YET — pip3 install --user browser-use + an API key in the Mac env makes this row live
# WHEN_TO_USE: you need to browser use
# ARGS: task
# EX: [BROWSER_USE]arg1[/BROWSER_USE]
{"cmd":"sh","args":["-lc","python3 -m browser_use \"$1\""],"timeout":600000}' WHERE key = 'BROWSER_USE';
UPDATE directory SET content = '# WHAT: Read the STATE CARDS. One card per isolated event: the inbound message (plain text), the reply (plain text), the agent system prompt, and every tool/CLI/file/http step with its raw payload in/out — each classified. Every card has a trace id (card_id) and a content hash, and is REST-callable
# WHEN_TO_USE: you need to cards
# ARGS: see content
# EX: [CARDS][/CARDS]
# Read the STATE CARDS. One card per isolated event: the inbound message (plain text), the reply (plain text), the agent system prompt, and every tool/CLI/file/http step with its raw payload in/out — each classified. Every card has a trace id (card_id) and a content hash, and is REST-callable.
# INVOKE: [CARDS][/CARDS] for the latest, or [CARDS]<card_id>[/CARDS] (e.g. t_dzncmzck or cc_42) for one card.' WHERE key = 'CARDS';
UPDATE directory SET content = '# WHAT: Channel + commerce API hosts (external). Tools that call them live as their own rows
# WHEN_TO_USE: you need to channel apis
# ARGS: see content
# EX: [CHANNEL_APIS][/CHANNEL_APIS]
# Channel + commerce API hosts (external). Tools that call them live as their own rows.
# Blooio (iMessage) https://backend.blooio.com  · key BLOOIO_API_KEY  · rows BLOOIO_*
# 2chat (WhatsApp)  https://api.p.2chat.io       · key TWOCHAT_API_KEY
# Stripe            https://api.stripe.com        · key STRIPE_SECRET_KEY · rows STRIPE_* (GET only by law)
# Meta CAPI         https://graph.facebook.com    · functions/capi.js
# DuoPlus CloudPhone https://openapi.duoplus.net  · header DuoPlus-API-Key' WHERE key = 'CHANNEL_APIS';
UPDATE directory SET content = '# WHAT: List every directory row
# WHEN_TO_USE: you need to dir list
# ARGS: see content
# EX: [DIR_LIST][/DIR_LIST]
# List every directory row.' WHERE key = 'DIR_LIST';
UPDATE directory SET content = '# WHAT: Edit a directory row by KEY.  json_body is a JSON object with any of {type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples}. Example: [DIR_PATCH]ROUTER|{"content":"...new prompt..."}[/DIR_PATCH]
# WHEN_TO_USE: you need to dir patch
# ARGS: key|json_body
# EX: [DIR_PATCH]arg2[/DIR_PATCH]
$2+' WHERE key = 'DIR_PATCH';
UPDATE directory SET content = '# WHAT: Durable Worker — the bound Durable Object (class DirectoryDO, script loop-safe-directory-do). One strongly-consistent instance ("main") that owns the SLUG REGISTRY (every declared internal position: slug -> kind+target) and an append-only MUTATION-INTENT LOG
# WHEN_TO_USE: you need to durable worker
# ARGS: see content
# EX: [DURABLE_WORKER]arg1[/DURABLE_WORKER]
# INVOKE (read ops, $1 = op):
#   [DURABLE_WORKER]ping[/DURABLE_WORKER]        -> {ok, do, id, ts}
#   [DURABLE_WORKER]slug.list[/DURABLE_WORKER]   -> every declared slug
#   [DURABLE_WORKER]intents[/DURABLE_WORKER]     -> last 200 mutation intents (chronological)
# RESOLVE one slug (REST):  GET  https://miscsubjects.com/api/durable/slug.resolve?slug=<slug>
# REGISTER a slug (REST):   POST https://miscsubjects.com/api/durable/slug.register  {"slug":"<slug>","kind":"row|page|tool|agent","target":"<target>"}
# Bound two ways: this Worker self-binds DIRECTORY_DO; the Pages project also binds it via script_name. Deploy the Worker before the Pages deploy.
{"op":"$1"}' WHERE key = 'DURABLE_WORKER';
UPDATE directory SET content = '# WHAT: Read the raw EVENTS log — one row per call, newest first, chronological. Each row: source, key, action, status, request/response preview, trace id, step. $1 optional = text to search across key/action/payload
# WHEN_TO_USE: you need to events
# ARGS: see content
# EX: [EVENTS]arg1[/EVENTS]
# Read the raw EVENTS log — one row per call, newest first, chronological. Each row: source, key, action, status, request/response preview, trace id, step. $1 optional = text to search across key/action/payload.
# INVOKE: [EVENTS][/EVENTS] for the latest, or [EVENTS]<search text>[/EVENTS].' WHERE key = 'EVENTS';
UPDATE directory SET content = '# WHAT: Read a repo file by path via GitHub Contents API.  Returns {path,sha,size,content}
# WHEN_TO_USE: you need to file get
# ARGS: path
# EX: [FILE_GET][/FILE_GET]
# Read a repo file by path via GitHub Contents API. Args: path. Returns {path,sha,size,content}.' WHERE key = 'FILE_GET';
UPDATE directory SET content = '# WHAT: List every file in the repo tree
# WHEN_TO_USE: you need to file list
# ARGS: see content
# EX: [FILE_LIST][/FILE_LIST]
# List every file in the repo tree.' WHERE key = 'FILE_LIST';
UPDATE directory SET content = '# WHAT: Patch a repo file — replace one string with another. Safer than FILE_PUT for small edits
# WHEN_TO_USE: you need to file patch
# ARGS: see content
# EX: [FILE_PATCH]arg1|arg2|arg3[/FILE_PATCH]
# ARGS: $1 = path (e.g. functions/api/dispatch.js), $2 = old_string, $3 = new_string
# EX: [FILE_PATCH]functions/api/dispatch.js|const ITER_CAP = 8;|const ITER_CAP = 20;[/FILE_PATCH]
# RETURNS: {content: {path, sha, size, html_url}, commit: {sha}}
# NOTE: old_string must exist exactly once in the file. If it appears multiple times, the first match is replaced.
$1|$2|$3' WHERE key = 'FILE_PATCH';
UPDATE directory SET content = '# WHAT: Write a repo file via GitHub Contents API.  json_body = {"content":"...","message":"<commit msg>","sha":"(auto-resolved if omitted)"}
# WHEN_TO_USE: you need to file put
# ARGS: path|json_body
# EX: [FILE_PUT]arg2[/FILE_PUT]
$2+' WHERE key = 'FILE_PUT';
UPDATE directory SET content = '# WHAT: Generate text via Gemini 2.5 Flash. $1=plain text prompt. Use as a cheaper alternative to Grok for batch summarization
# WHEN_TO_USE: you need to gemini generate
# ARGS: see content
# EX: [GEMINI_GENERATE]arg1[/GEMINI_GENERATE]
{"contents":[{"parts":[{"text":"$1"}]}]}' WHERE key = 'GEMINI_GENERATE';
UPDATE directory SET content = '# WHAT: Create a Google Calendar event. $1=calendar id, $2=title, $3=ISO start, $4=ISO end
# WHEN_TO_USE: add a meeting
# ARGS: see content
# EX: [GOOGLE_CALENDAR_CREATE]arg1|arg2|arg3|arg4[/GOOGLE_CALENDAR_CREATE]
{"action":"calendar_create","args":{"calendar_id":"$1","title":"$2","start":"$3","end":"$4"}}' WHERE key = 'GOOGLE_CALENDAR_CREATE';
UPDATE directory SET content = '# WHAT: Upcoming Google Calendar events. $1=calendar id (or "primary"), $2=optional ISO start
# WHEN_TO_USE: answer "what is on my calendar"
# ARGS: see content
# EX: [GOOGLE_CALENDAR_LIST]arg1|arg2[/GOOGLE_CALENDAR_LIST]
{"action":"calendar_list","args":{"calendar_id":"$1","start":"$2"}}' WHERE key = 'GOOGLE_CALENDAR_LIST';
UPDATE directory SET content = '# WHAT: Download Google Drive file content as plain text. $1=file id. Use after GOOGLE_DRIVE_LIST
# WHEN_TO_USE: you need to google drive get
# ARGS: see content
# EX: [GOOGLE_DRIVE_GET]arg1[/GOOGLE_DRIVE_GET]
{"action":"drive_get","args":{"file_id":"$1"}}' WHERE key = 'GOOGLE_DRIVE_GET';
UPDATE directory SET content = '# WHAT: List Google Drive files. $1=optional folder id or query (blank = root)
# WHEN_TO_USE: find a file before downloading
# ARGS: see content
# EX: [GOOGLE_DRIVE_LIST]arg1[/GOOGLE_DRIVE_LIST]
{"action":"drive_list","args":{"q":"$1"}}' WHERE key = 'GOOGLE_DRIVE_LIST';
UPDATE directory SET content = '# WHAT: Append a row to a Google Sheet. $1=sheet id, $2=tab name, $3=JSON array of values
# WHEN_TO_USE: log
# ARGS: see content
# EX: [GOOGLE_SHEETS_APPEND]arg1|arg2|arg3[/GOOGLE_SHEETS_APPEND]
{"action":"sheets_append","args":{"sheet_id":"$1","tab":"$2","values":$3}}' WHERE key = 'GOOGLE_SHEETS_APPEND';
UPDATE directory SET content = '# WHAT: Read a Google Sheet range as 2D JSON. $1=sheet id, $2=A1 range (e.g. Sheet1!A1:Z100)
# WHEN_TO_USE: reporting tables
# ARGS: see content
# EX: [GOOGLE_SHEETS_GET]arg1|arg2[/GOOGLE_SHEETS_GET]
{"action":"sheets_get","args":{"sheet_id":"$1","range":"$2"}}' WHERE key = 'GOOGLE_SHEETS_GET';
UPDATE directory SET content = '# WHAT: Add a Google Task. $1=optional list id, $2=title, $3=optional notes
# WHEN_TO_USE: the user says "add to my todos"
# ARGS: see content
# EX: [GOOGLE_TASKS_ADD]arg1|arg2|arg3[/GOOGLE_TASKS_ADD]
{"action":"tasks_add","args":{"list_id":"$1","title":"$2","notes":"$3"}}' WHERE key = 'GOOGLE_TASKS_ADD';
UPDATE directory SET content = '# WHAT: List Google Tasks. $1=optional task list id
# WHEN_TO_USE: answer "what is on my todo list"
# ARGS: see content
# EX: [GOOGLE_TASKS_LIST]arg1[/GOOGLE_TASKS_LIST]
{"action":"tasks_list","args":{"list_id":"$1"}}' WHERE key = 'GOOGLE_TASKS_LIST';
UPDATE directory SET content = '# WHAT: Generate an image from a text prompt.  Returns a JSON url. Model grok-imagine-image-quality ($0.05/image)
# WHEN_TO_USE: you need to grok image
# ARGS: prompt
# EX: [GROK_IMAGE]arg1[/GROK_IMAGE]
{"model":"grok-imagine-image-quality","prompt":"$1"}' WHERE key = 'GROK_IMAGE';
UPDATE directory SET content = '# WHAT: Edit an image with natural language.  Returns a JSON url
# WHEN_TO_USE: you need to grok image edit
# ARGS: prompt|image_url
# EX: [GROK_IMAGE_EDIT]arg1|arg2[/GROK_IMAGE_EDIT]
{"model":"grok-imagine-image-quality","prompt":"$1","image":{"url":"$2","type":"image_url"}}' WHERE key = 'GROK_IMAGE_EDIT';
UPDATE directory SET content = '# WHAT: List every model on the xAI API. No args
# WHEN_TO_USE: you need to grok models
# ARGS: see content
# EX: [GROK_MODELS][/GROK_MODELS]
# List every model on the xAI API. No args.' WHERE key = 'GROK_MODELS';
UPDATE directory SET content = '# WHAT: Text-to-SPEECH (Grok). INVOKE: [GROK_TTS]<text>|<voice_id>[/GROK_TTS]
# WHEN_TO_USE: you need to grok tts
# ARGS: see content
# EX: [GROK_TTS]arg1|arg2|arg15[/GROK_TTS]
# $1 = the words to speak; $2 = voice_id (eve|ara|rex|sal|leo). Returns mp3 audio BYTES (binary, not JSON) from https://api.x.ai/v1/tts; ~$15 per 1M characters.
# To DELIVER spoken audio into a chat in ONE call, use [VOICE_SEND] instead (it synthesizes + attaches).
{"text":"$1","voice_id":"$2","language":"en"}' WHERE key = 'GROK_TTS';
UPDATE directory SET content = '# WHAT: Poll a video job.  status pending|done|failed|expired; when done returns video.url
# WHEN_TO_USE: you need to grok video get
# ARGS: request_id
# EX: [GROK_VIDEO_GET][/GROK_VIDEO_GET]
# Poll a video job. Arg: request_id. status pending|done|failed|expired; when done returns video.url.' WHERE key = 'GROK_VIDEO_GET';
UPDATE directory SET content = '# WHAT: Start a text-to-video job.  Returns request_id. Poll with GROK_VIDEO_GET. Model grok-imagine-video ($0.05/sec)
# WHEN_TO_USE: you need to grok video start
# ARGS: prompt|duration_seconds(1-15)
# EX: [GROK_VIDEO_START]arg1|arg2[/GROK_VIDEO_START]
{"model":"grok-imagine-video","prompt":"$1","duration":$2,"aspect_ratio":"16:9","resolution":"720p"}' WHERE key = 'GROK_VIDEO_START';
UPDATE directory SET content = '# WHAT: List every model available on the Cloudflare AI Gateway compat endpoint (162 models incl. claude-fable-5, deepseek-v4-pro). No args
# WHEN_TO_USE: you need to gw models
# ARGS: see content
# EX: [GW_MODELS][/GW_MODELS]
# List every model available on the Cloudflare AI Gateway compat endpoint (162 models incl. claude-fable-5, deepseek-v4-pro). No args.' WHERE key = 'GW_MODELS';
UPDATE directory SET content = '# WHAT: Classify a visitor via JustCloakIt.  type=false+status=passed means real human. Needs JCI_USER_ID secret
# WHEN_TO_USE: you need to jci classify
# ARGS: ip|ua|lan|ref|qu|inc_loc
# EX: [JCI_CLASSIFY]arg1|arg2|arg3|arg4|arg5|arg6[/JCI_CLASSIFY]
form:ip=$1&ua=$2&lan=$3&ref=$4&qu=$5&inc_loc=$6&is_geo=true&is_gclid=true&is_fbclid=true&ipscore=true' WHERE key = 'JCI_CLASSIFY';
UPDATE directory SET content = '# WHAT: List every KV key (name+expiration). Use prefix= and limit= query args by editing the row if you need
# WHEN_TO_USE: you need to kv list
# ARGS: see content
# EX: [KV_LIST][/KV_LIST]
# List every KV key (name+expiration). Use prefix= and limit= query args by editing the row if you need.' WHERE key = 'KV_LIST';
UPDATE directory SET content = '# WHAT: Read your own ledger to troubleshoot: recent messages, each tool you ran with its output/error, and your reply. $1 optional = a trace_id for one message
# WHEN_TO_USE: you need to ledger
# ARGS: see content
# EX: [LEDGER]arg1[/LEDGER]
# Read your own ledger to troubleshoot: recent messages, each tool you ran with its output/error, and your reply. $1 optional = a trace_id for one message.
# INVOKE: [LEDGER][/LEDGER] or [LEDGER]<trace_id>[/LEDGER]' WHERE key = 'LEDGER';
UPDATE directory SET content = '# WHAT: Retrieves up-to-date, version-specific documentation + code examples for a library using its exact Context7 libraryId. Use after resolve-library-id (or when you already have the ID).  Returns relevant docs/chunks
# WHEN_TO_USE: you need to mcp context7 query docs
# ARGS: libraryId|query
# EX: [MCP_context7_query_docs]arg1|arg2[/MCP_context7_query_docs]
{"method":"tools/call","params":{"name":"query-docs","arguments":{"libraryId":"$1","query":"$2"}}}' WHERE key = 'MCP_context7_query_docs';
UPDATE directory SET content = '# WHAT: Resolves a general library name into a Context7-compatible library ID (ranked by relevance to query).   Returns list of matching library IDs with scores
# WHEN_TO_USE: you have a vague library name and need the exact Context7 ID first
# ARGS: query|libraryName
# EX: [MCP_context7_resolve_library_id]arg1|arg2[/MCP_context7_resolve_library_id]
{"method":"tools/call","params":{"name":"resolve-library-id","arguments":{"query":"$1","libraryName":"$2"}}}' WHERE key = 'MCP_context7_resolve_library_id';
UPDATE directory SET content = '# WHAT: List OpenAI models. No args
# WHEN_TO_USE: you need to openai models
# ARGS: see content
# EX: [OPENAI_MODELS][/OPENAI_MODELS]
# List OpenAI models. No args.' WHERE key = 'OPENAI_MODELS';
UPDATE directory SET content = '# WHAT: Create a new page. $1=slug $2=title $3=body_html. Use ONLY when no page with that slug exists; PAGES_PUT upserts
# WHEN_TO_USE: you need to pages create
# ARGS: see content
# EX: [PAGES_CREATE]arg1|arg2|arg3[/PAGES_CREATE]
{"slug":"$1","title":"$2","body_html":"$3","actor":"router"}' WHERE key = 'PAGES_CREATE';
UPDATE directory SET content = '# WHAT: Delete a page. $1=slug. Version history stays in pages_versions; the live row is removed
# WHEN_TO_USE: you need to pages delete
# ARGS: see content
# EX: [PAGES_DELETE]arg1[/PAGES_DELETE]
# Delete a page. $1=slug. Version history stays in pages_versions; the live row is removed.
' WHERE key = 'PAGES_DELETE';
UPDATE directory SET content = '# WHAT: Edit an existing page. $1=slug $2=title $3=body_html. Writes a new version row; previous content stays in pages_versions
# WHEN_TO_USE: you need to pages put
# ARGS: see content
# EX: [PAGES_PUT]arg2|arg3[/PAGES_PUT]
{"title":"$2","body_html":"$3","actor":"router"}' WHERE key = 'PAGES_PUT';
UPDATE directory SET content = '# WHAT: Read a page by slug.  Returns {slug,title,body_html,version,...}
# WHEN_TO_USE: you need to page get
# ARGS: slug
# EX: [PAGE_GET][/PAGE_GET]
# Read a page by slug. Args: slug. Returns {slug,title,body_html,version,...}.' WHERE key = 'PAGE_GET';
UPDATE directory SET content = '# WHAT: Edit a page by slug.  json_body = {"title":"...","body_html":"..."}
# WHEN_TO_USE: you need to page patch
# ARGS: slug|json_body
# EX: [PAGE_PATCH]arg2[/PAGE_PATCH]
$2+' WHERE key = 'PAGE_PATCH';
UPDATE directory SET content = '# WHAT: Ask a panel of LLMs the same questions about one article. Body JSON: {article, questions[], models[]}. Default models GROK_CHAT, KIMI_CHAT, WORKERS_AI_CHAT
# WHEN_TO_USE: you need to panel
# ARGS: see content
# EX: [PANEL]arg1[/PANEL]
$1' WHERE key = 'PANEL';
UPDATE directory SET content = '# WHAT: Provider/model registry — every company (xai|anthropic|openai|google), every model (text|image|video|stt|tts), with endpoint, api_key_name, every variable, cost in/out/cache, longest output, reasoning options, temperature range, and docs links. The on-hand API documentation behind the LLM-creation form
# WHEN_TO_USE: you need to providers
# ARGS: see content
# EX: [PROVIDERS]arg1[/PROVIDERS]
# INVOKE: [PROVIDERS][/PROVIDERS] full registry; [PROVIDERS]xai[/PROVIDERS] one company; arg $1 = company (or company/modality via REST).
# REST: GET https://miscsubjects.com/api/providers · /api/providers/anthropic · /api/providers/xai/video
{"op":"$1"}' WHERE key = 'PROVIDERS';
UPDATE directory SET content = '# WHAT: LLM/model provider documentation (external). On-hand copies via [PROVIDERS]<company>[/PROVIDERS] and [DOCS_GET]<slug>[/DOCS_GET]
# WHEN_TO_USE: you need to provider docs
# ARGS: see content
# EX: [PROVIDER_DOCS][/PROVIDER_DOCS]
# LLM/model provider documentation (external). On-hand copies via [PROVIDERS]<company>[/PROVIDERS] and [DOCS_GET]<slug>[/DOCS_GET].
# xAI (Grok)   https://docs.x.ai            · console https://console.x.ai · mgmt https://management-api.x.ai · key GROK_API_KEY
# OpenAI       https://platform.openai.com/docs · pricing https://platform.openai.com/docs/pricing · key OPENAI_API_KEY
# Anthropic    https://platform.claude.com/docs · key ANTHROPIC_API_KEY
# Google Gemini https://ai.google.dev/gemini-api/docs · key GEMINI_API_KEY
# ArcAds       https://external-api.arcads.ai (images+video) · spec R2:docs/api/arcads/openapi-spec.json' WHERE key = 'PROVIDER_DOCS';
UPDATE directory SET content = '# WHAT: Send a message with an image to a Blooio chat (phone or group id)
# WHEN_TO_USE: you need to send image blooio
# ARGS: chat|text|attachment_url
# EX: [SEND_IMAGE_BLOOIO]arg2|arg3[/SEND_IMAGE_BLOOIO]
{"text":"$2","attachments":["$3"]}' WHERE key = 'SEND_IMAGE_BLOOIO';
UPDATE directory SET content = '# WHAT: Read a settings row by key
# WHEN_TO_USE: you need to set get
# ARGS: key
# EX: [SET_GET][/SET_GET]
# Read a settings row by key. Args: key.' WHERE key = 'SET_GET';
UPDATE directory SET content = '# WHAT: Write a settings value.  json_body = {"value":"..."}
# WHEN_TO_USE: you need to set put
# ARGS: key|json_body
# EX: [SET_PUT]arg2[/SET_PUT]
$2+' WHERE key = 'SET_PUT';
UPDATE directory SET content = '# WHAT: One-arg wrapper to run SHEETS_SYNC_ALL via the dispatcher. Used when an external caller (cron, GH Action) wants to push the sheet without picking a specific tab
# WHEN_TO_USE: scheduled sheet sync.
# ARGS: see content
# EX: [SHEETS_SYNC_MASTER][/SHEETS_SYNC_MASTER]
{"key":"SHEETS_SYNC_ALL","body":""}' WHERE key = 'SHEETS_SYNC_MASTER';
UPDATE directory SET content = '# WHAT: Edit any surface by its short ID.  json_body shape depends on kind: directory={content,target?,auth?,...}; settings={value}; kv=raw text; r2=raw text; file={content,message?,sha?}; page={title?,body_html?}; article={title?,body?}
# WHEN_TO_USE: you need to short edit
# ARGS: short_id|json_body
# EX: [SHORT_EDIT]arg2[/SHORT_EDIT]
$2+' WHERE key = 'SHORT_EDIT';
UPDATE directory SET content = '# WHAT: Read the actual content of any surface by its short ID (D35 = 35th directory row by name; K3 = 3rd KV key; etc).  Returns {short_id,kind,name,content,read,edit,edit_method,edit_body,status}
# WHEN_TO_USE: you need to short get
# ARGS: short_id
# EX: [SHORT_GET][/SHORT_GET]
# Read the actual content of any surface by its short ID (D35 = 35th directory row by name; K3 = 3rd KV key; etc). Args: short_id. Returns {short_id,kind,name,content,read,edit,edit_method,edit_body,status}.' WHERE key = 'SHORT_GET';
UPDATE directory SET content = '# WHAT: Chat with a named ExpertDO using Workers AI inside the DO context. $1=DO name. $2=JSON body string with shape {"messages":[{"role":"user","content":"..."}],"model":"@cf/meta/llama-3.3-70b-instruct-fp8-fast"}. Uses $$2 raw so the JSON object passes through unescaped
# WHEN_TO_USE: "ask the CF expert about workflows" or "chat with the <name> DO"
# ARGS: see content
# EX: [SIBLING_DO_CHAT]arg2[/SIBLING_DO_CHAT]
$$2' WHERE key = 'SIBLING_DO_CHAT';
UPDATE directory SET content = '# WHAT: Ping a named ExpertDO instance on the sibling Worker. Each name gets its own Durable Object id, its own SQLite state. $1=DO name (e.g. CF_EXPERT, STRIPE_EXPERT, default)
# WHEN_TO_USE: "ping the CF expert DO" or "is the <name> expert alive"
# ARGS: see content
# EX: [SIBLING_DO_PING]arg1[/SIBLING_DO_PING]
# Ping a named ExpertDO instance on the sibling Worker. Each name gets its own Durable Object id, its own SQLite state. $1=DO name (e.g. CF_EXPERT, STRIPE_EXPERT, default).
# WHEN_TO_USE: "ping the CF expert DO" or "is the <name> expert alive"' WHERE key = 'SIBLING_DO_PING';
UPDATE directory SET content = '# WHAT: Liveness check for the sibling Worker (loop-safe-sibling) that hosts cron + Durable Objects + Queues + Workers AI. Returns {ok,name,ts}. No args
# WHEN_TO_USE: "is the sibling worker up" or "ping the sibling"
# ARGS: see content
# EX: [SIBLING_HEALTH][/SIBLING_HEALTH]
# Liveness check for the sibling Worker (loop-safe-sibling) that hosts cron + Durable Objects + Queues + Workers AI. Returns {ok,name,ts}. No args.
# WHEN_TO_USE: "is the sibling worker up" or "ping the sibling"' WHERE key = 'SIBLING_HEALTH';
UPDATE directory SET content = '# WHAT: Status of a DeliverWorkflow instance. $1=instance id (from the trigger response)
# WHEN_TO_USE: "what is workflow <id> doing"
# ARGS: see content
# EX: [SIBLING_WORKFLOW_DELIVER_STATUS]arg1[/SIBLING_WORKFLOW_DELIVER_STATUS]
# Status of a DeliverWorkflow instance. $1=instance id (from the trigger response).
# WHEN_TO_USE: "what is workflow <id> doing"' WHERE key = 'SIBLING_WORKFLOW_DELIVER_STATUS';
UPDATE directory SET content = '# WHAT: Trigger a one-off DeliverWorkflow instance on the sibling Worker. Returns {id, status}. $1=optional JSON params (default {})
# WHEN_TO_USE: "run the durable deliver workflow" or "fire DeliverWorkflow"
# ARGS: see content
# EX: [SIBLING_WORKFLOW_DELIVER_TRIGGER]arg1[/SIBLING_WORKFLOW_DELIVER_TRIGGER]
$$1' WHERE key = 'SIBLING_WORKFLOW_DELIVER_TRIGGER';
UPDATE directory SET content = '# WHAT: Site surfaces (the only two human pages + every functional endpoint)
# WHEN_TO_USE: you need to site links
# ARGS: see content
# EX: [SITE_LINKS][/SITE_LINKS]
# Site surfaces (the only two human pages + every functional endpoint).
# DIRECTORY  https://miscsubjects.com/admin/directory   (the one surface; + /new, /models, /graph, /<key>)
# LEDGER     https://miscsubjects.com/admin/ledger       (every payload in/out)
# DISPATCH   POST https://miscsubjects.com/api/dispatch  {"key","body"}
# SLUG       POST https://miscsubjects.com/s/<slug>       {"body"}
# DIRECTORY REST  GET|PUT|PATCH|DELETE https://miscsubjects.com/api/directory/<key>
# PROVIDERS  GET https://miscsubjects.com/api/providers   (LLM/model registry)
# DURABLE    GET https://miscsubjects.com/api/durable/ping  (bound Durable Object)
# CONTENT    GET https://miscsubjects.com/api/content/<slug>  (peptides/articles data)
# every other former page (/matrix /ads /queue /workbench /content /grok /api …) now 302 -> /admin/directory' WHERE key = 'SITE_LINKS';
UPDATE directory SET content = '# WHAT: Repo snapshot metadata from KV: {sha, ts, byte_count} — no content blob. No args. Use this instead of REPO_SNAPSHOT whenever you only need to cite the sha, freshness, or size of the snapshot
# WHEN_TO_USE: you need to snapshot meta
# ARGS: see content
# EX: [SNAPSHOT_META][/SNAPSHOT_META]
# Repo snapshot metadata from KV: {sha, ts, byte_count} — no content blob. No args. Use this instead of REPO_SNAPSHOT whenever you only need to cite the sha, freshness, or size of the snapshot.' WHERE key = 'SNAPSHOT_META';
UPDATE directory SET content = '# WHAT: Platform + protocol references (external)
# WHEN_TO_USE: you need to tooling docs
# ARGS: see content
# EX: [TOOLING_DOCS][/TOOLING_DOCS]
# Platform + protocol references (external).
# Cloudflare   https://developers.cloudflare.com · api https://api.cloudflare.com (Workers/Pages/D1/KV/R2/DO/Workflows)
# MCP          https://modelcontextprotocol.io
# JSON Schema  https://json-schema.org
# MDN          https://developer.mozilla.org
# GitHub repo  https://github.com/[OWNER_HANDLE]/miscsubjects-pages · api https://api.github.com' WHERE key = 'TOOLING_DOCS';
UPDATE directory SET content = '# WHAT: Send a WhatsApp message. $1=from_number $2=to_number $3=text. Mirror of BLOOIO_SEND for the WhatsApp channel
# WHEN_TO_USE: you need to twochat send
# ARGS: see content
# EX: [TWOCHAT_SEND]arg1|arg2|arg3[/TWOCHAT_SEND]
{"from_number":"$1","to_number":"$2","text":"$3+"}' WHERE key = 'TWOCHAT_SEND';
UPDATE directory SET content = '# WHAT: Export the production D1 (loop-content-spine) to a timestamped .sql file on the Mac for backup. Returns the file path and size of the latest dump
# WHEN_TO_USE: "back up the d1" or "dump the database to disk"
# ARGS: see content
# EX: [WRANGLER_D1_EXPORT][/WRANGLER_D1_EXPORT]
# Export the production D1 (loop-content-spine) to a timestamped .sql file on the Mac for backup. Returns the file path and size of the latest dump.
# WHEN_TO_USE: "back up the d1" or "dump the database to disk"' WHERE key = 'WRANGLER_D1_EXPORT';
UPDATE directory SET content = '# WHAT: Deploy the build to Cloudflare Pages production from the Mac bridge. No args. Returns the wrangler output (production URL on success)
# WHEN_TO_USE: "deploy the build" or "push the build to production"
# ARGS: see content
# EX: [WRANGLER_DEPLOY][/WRANGLER_DEPLOY]
# Deploy the build to Cloudflare Pages production from the Mac bridge. No args. Returns the wrangler output (production URL on success).
# WHEN_TO_USE: "deploy the build" or "push the build to production"' WHERE key = 'WRANGLER_DEPLOY';
UPDATE directory SET content = '# WHAT: Stream 30s of live tail logs from production Pages deployment, capped at 200 lines. Returns the pretty-formatted log buffer. No args
# WHEN_TO_USE: "tail the build" or "what is the build logging right now"
# ARGS: see content
# EX: [WRANGLER_TAIL][/WRANGLER_TAIL]
# Stream 30s of live tail logs from production Pages deployment, capped at 200 lines. Returns the pretty-formatted log buffer. No args.
# WHEN_TO_USE: "tail the build" or "what is the build logging right now"' WHERE key = 'WRANGLER_TAIL';