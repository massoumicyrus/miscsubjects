-- 0108: Batch-fix fn rows to standard format

UPDATE directory SET content = '# WHAT: Control a resident agent
# WHEN_TO_USE: you need to agent
# ARGS: op(status|send|pause|resume|kill|events)|id|msg
# EX: [AGENT]arg1|arg2|arg3[/AGENT]
["$1","$2","$3+"]' WHERE key = 'AGENT';
UPDATE directory SET content = '# WHAT: Cannibalize an agent definition (md frontmatter name/description/model/tools) into a proposed agent row. PROPOSE only
# WHEN_TO_USE: you need to agent import
# ARGS: source(url|r2:key|raw)|category
# EX: [AGENT_IMPORT]arg1|arg2[/AGENT_IMPORT]
["$1","$2"]' WHERE key = 'AGENT_IMPORT';
UPDATE directory SET content = '# WHAT: List resident agents and their live status
# WHEN_TO_USE: you need to agent list
# ARGS: none
# EX: [AGENT_LIST][/AGENT_LIST]
[]' WHERE key = 'AGENT_LIST';
UPDATE directory SET content = '# WHAT: Spawn a resident agent that loops on a goal until done (durable, survives Mac sleep)
# WHEN_TO_USE: you need to agent spawn
# ARGS: goal|brain|maxSteps
# EX: [AGENT_SPAWN]arg1|arg2|arg3[/AGENT_SPAWN]
["$1","$2","$3"]' WHERE key = 'AGENT_SPAWN';
UPDATE directory SET content = '# WHAT: ArcAds credit usage this month. Returns {month,used,cap,remaining}. Cap from settings.arcads_monthly_credits (80440). Logged from each generate (data.creditsCharged)
# WHEN_TO_USE: you need to arcads credits
# ARGS: none
# EX: [ARCADS_CREDITS][/ARCADS_CREDITS]
[]' WHERE key = 'ARCADS_CREDITS';
UPDATE directory SET content = '# WHAT: ArcAds /v2/images/generate field reference
# WHEN_TO_USE: you need to arcads fields
# ARGS: none
# EX: [ARCADS_FIELDS][/ARCADS_FIELDS]
[]' WHERE key = 'ARCADS_FIELDS';
UPDATE directory SET content = '# WHAT: Generate an ad image via ArcAds, poll to completion, store to R2, return a stable link
# WHEN_TO_USE: you need to arcads generate
# ARGS: model|prompt|aspectRatio|referenceImages|productId|enhance
# EX: [ARCADS_GENERATE]arg1|arg2|arg3|arg4|arg5|arg6[/ARCADS_GENERATE]
["$1","$2","$3","$4","$5","$6"]' WHERE key = 'ARCADS_GENERATE';
UPDATE directory SET content = '# WHAT: Upload a file to ArcAds (presign + S3 PUT).  Returns {filePath,fileId}; pass filePath in referenceImages. fileType e.g. image/png, image/jpeg, video/mp4, audio/mp3
# WHEN_TO_USE: you need to arcads upload
# ARGS: source_url|file_type
# EX: [ARCADS_UPLOAD]arg1|arg2[/ARCADS_UPLOAD]
["$1","$2"]' WHERE key = 'ARCADS_UPLOAD';
UPDATE directory SET content = '# WHAT: ArcAds /v2/videos/generate field reference
# WHEN_TO_USE: you need to arcads video fields
# ARGS: none
# EX: [ARCADS_VIDEO_FIELDS][/ARCADS_VIDEO_FIELDS]
[]' WHERE key = 'ARCADS_VIDEO_FIELDS';
UPDATE directory SET content = '# WHAT: Generate a video via ArcAds, poll, store to R2, return a stable link
# WHEN_TO_USE: you need to arcads video generate
# ARGS: model|prompt|aspectRatio|referenceImages|duration|productId
# EX: [ARCADS_VIDEO_GENERATE]arg1|arg2|arg3|arg4|arg5|arg6[/ARCADS_VIDEO_GENERATE]
["$1","$2","$3","$4","$5","$6"]' WHERE key = 'ARCADS_VIDEO_GENERATE';
UPDATE directory SET content = '# WHAT: Speak words aloud. INVOKE: [AUDIO]the words to speak[/AUDIO]
# WHEN_TO_USE: you need to audio
# ARGS: $1 | $2
# EX: [AUDIO]arg1|arg2[/AUDIO]
["$1","$2"]' WHERE key = 'AUDIO';
UPDATE directory SET content = '# WHAT: Analyze the CF row target_map. Returns counts, known namespaces, expected namespaces, missing namespaces, coverage_pct
# WHEN_TO_USE: you need to cf api gaps
# ARGS: none
# EX: [CF_API_GAPS][/CF_API_GAPS]
[]' WHERE key = 'CF_API_GAPS';
UPDATE directory SET content = '# WHAT: Anthropic computer-use (sandboxed VM, NOT the owner''s Mac). Not wired: needs ANTHROPIC_API_KEY plus a VM loop the directory cannot express in one call. For the owner''s Mac use DESKTOP_SHOT / DESKTOP_CLICK / DESKTOP_TYPE
# WHEN_TO_USE: you need to computer use remote
# ARGS: none
# EX: [COMPUTER_USE_REMOTE][/COMPUTER_USE_REMOTE]
["COMPUTER_USE_REMOTE is not wired yet. Needs ANTHROPIC_API_KEY + a VM loop. Use DESKTOP_SHOT/DESKTOP_CLICK/DESKTOP_TYPE for the Mac."]' WHERE key = 'COMPUTER_USE_REMOTE';
UPDATE directory SET content = '# WHAT: Cost summary: total turns, total USD, average USD/turn, and the 10 priciest recent turns
# WHEN_TO_USE: you need to cost report
# ARGS: none
# EX: [COST_REPORT][/COST_REPORT]
["SELECT (SELECT COUNT(*) FROM turn_costs) AS turns, (SELECT ROUND(SUM(cost),4) FROM turn_costs) AS total_usd, (SELECT ROUND(AVG(cost),5) FROM turn_costs) AS avg_usd_per_turn"]' WHERE key = 'COST_REPORT';
UPDATE directory SET content = '# WHAT: Run a SQL SELECT and return a 2D array (header row + values) suitable for sheets_replace_tab. $1=SQL
# WHEN_TO_USE: you need to d1 to 2d array
# ARGS: $1
# EX: [D1_TO_2D_ARRAY]arg1[/D1_TO_2D_ARRAY]
["$1"]' WHERE key = 'D1_TO_2D_ARRAY';
UPDATE directory SET content = '# WHAT: Insert message_id into blooio_dedup. Use ONLY from the inbound webhook handler before replying
# WHEN_TO_USE: you need to dedup insert
# ARGS: $1
# EX: [DEDUP_INSERT]arg1[/DEDUP_INSERT]
["$1"]' WHERE key = 'DEDUP_INSERT';
UPDATE directory SET content = '# WHAT: Fetch a public URL (API docs, OpenAPI spec, GitHub raw, vendor SDK readme) and persist the raw body to R2 under capability_sources/<sha16>.txt. Returns {url, bytes, r2_key, sha256_16, status}. First step of universe-to-row. $1=URL
# WHEN_TO_USE: you need to discover source
# ARGS: $1
# EX: [DISCOVER_SOURCE]arg1[/DISCOVER_SOURCE]
["$1"]' WHERE key = 'DISCOVER_SOURCE';
UPDATE directory SET content = '# WHAT: Read one writer/build doc from the D1 docs table by slug (style_topology, slot_specs, judge_prompt, arcads, blooio, cloudflare, ai-gateway, 2chat, build-intent). Returns {slug,title,body}
# WHEN_TO_USE: you need to docs get
# ARGS: $1
# EX: [DOCS_GET]arg1[/DOCS_GET]
["$1"]' WHERE key = 'DOCS_GET';
UPDATE directory SET content = '# WHAT: Search stored docs. Arg: query. Returns slugs + snippets
# WHEN_TO_USE: you need to docs search
# ARGS: $1
# EX: [DOCS_SEARCH]arg1[/DOCS_SEARCH]
["$1"]' WHERE key = 'DOCS_SEARCH';
UPDATE directory SET content = '# WHAT: Change one line of your memory (or any row). $1=key, $2=the exact existing line, $3=the new line
# WHEN_TO_USE: you need to edit memory
# ARGS: $1 | $2 | $3
# EX: [EDIT_MEMORY]arg1|arg2|arg3[/EDIT_MEMORY]
["$1","$2","$3"]' WHERE key = 'EDIT_MEMORY';
UPDATE directory SET content = '# WHAT: Given an R2 key from DISCOVER_SOURCE, run a Workers AI Llama call to extract a JSON array of {op, method, url_or_signature,  Truncates input at 20KB. Second step of universe-to-row. $1=r2_key, $2=optional model id (default @cf/meta/llama-3.3-70b-instruct-fp8-fast)
# WHEN_TO_USE: you need to extract capabilities
# ARGS: [{name,type,required}], description}
# EX: [EXTRACT_CAPABILITIES]arg1|arg2[/EXTRACT_CAPABILITIES]
["$1","$2"]' WHERE key = 'EXTRACT_CAPABILITIES';
UPDATE directory SET content = '# WHAT: Run the whole fidelity bank. $1 optional kind filter (positive | inverse | agent-route). Logs to fidelity_log. Returns JSON {run_id,total,passed,failed,duration_ms,failing}
# WHEN_TO_USE: you need to fidelity run
# ARGS: $1
# EX: [FIDELITY_RUN]arg1[/FIDELITY_RUN]
["$1"]' WHERE key = 'FIDELITY_RUN';
UPDATE directory SET content = '# WHAT: Remove one line from your memory (or any row). $1=key (ROUTER for your own memory), $2=the exact text to remove
# WHEN_TO_USE: you need to forget
# ARGS: $1 | $2
# EX: [FORGET]arg1|arg2[/FORGET]
["$1","$2",""]' WHERE key = 'FORGET';
UPDATE directory SET content = '# WHAT: Given the same shape as PROPOSE_ROWS, diff the discovered ops against existing directory keys. Returns {ops_total, found, missing, missing_ops[]}. Surfaces what is genuinely new
# WHEN_TO_USE: you need to gap report
# ARGS: $1
# EX: [GAP_REPORT]arg1[/GAP_REPORT]
["$1"]' WHERE key = 'GAP_REPORT';
UPDATE directory SET content = '# WHAT: Generate with BOTH OpenAI gpt-image-1.5 and Grok Imagine; store both to R2; return both links. If reference_url is given, both EDIT it
# WHEN_TO_USE: you need to gen dual
# ARGS: prompt|reference_url
# EX: [GEN_DUAL]arg1|arg2[/GEN_DUAL]
["$1","$2"]' WHERE key = 'GEN_DUAL';
UPDATE directory SET content = '# WHAT: Speech-to-TEXT (Grok). INVOKE: [GROK_STT]<public_audio_url>[/GROK_STT]
# WHEN_TO_USE: you need to grok stt
# ARGS: $1
# EX: [GROK_STT]arg1[/GROK_STT]
["$1"]' WHERE key = 'GROK_STT';
UPDATE directory SET content = '# WHAT: How many past turns the build keeps per chat. No args. Returns {convo_max}
# WHEN_TO_USE: the owner asks "how many messages do you remember"
# ARGS: none
# EX: [HISTORY_GET][/HISTORY_GET]
[]' WHERE key = 'HISTORY_GET';
UPDATE directory SET content = '# WHAT: Set how many past turns the build keeps per chat (1-100, default 14). Arg: the number.  Takes effect immediately for every chat
# WHEN_TO_USE: the owner says "remember more/fewer messages", "keep the last 30"
# ARGS: $1
# EX: [HISTORY_SET]arg1[/HISTORY_SET]
["$1"]' WHERE key = 'HISTORY_SET';
UPDATE directory SET content = '# WHAT: Universal HTTP fetch.  Method GET/POST/PUT/PATCH/DELETE. body is the raw request body string (empty for GET). headers_json is optional JSON header overrides. Returns ''HTTP <status>:<body first 20000 chars>''. Authorization redacted in ledger
# WHEN_TO_USE: you need to http fetch
# ARGS: method|url|body|headers_json
# EX: [HTTP_FETCH]arg1|arg2|arg3|arg4[/HTTP_FETCH]
["$1","$2","$3","$4"]' WHERE key = 'HTTP_FETCH';
UPDATE directory SET content = '# WHAT: Drop the KV cache of the directory snapshot. Use after writing to the directory table by hand or via any tool that does NOT already invalidate. Takes no args
# WHEN_TO_USE: you need to invalidate dir snapshot
# ARGS: none
# EX: [INVALIDATE_DIR_SNAPSHOT][/INVALIDATE_DIR_SNAPSHOT]
[]' WHERE key = 'INVALIDATE_DIR_SNAPSHOT';
UPDATE directory SET content = '# WHAT: KV append: read array at $1, push $2, write back. Use as an append-only log inside KV (small N)
# WHEN_TO_USE: you need to kv append
# ARGS: $1 | $2
# EX: [KV_APPEND]arg1|arg2[/KV_APPEND]
["$1","$2"]' WHERE key = 'KV_APPEND';
UPDATE directory SET content = '# WHAT: KV delete by key. g. directory:snapshot)
# WHEN_TO_USE: invalidate a cached value (e
# ARGS: $1
# EX: [KV_DEL]arg1[/KV_DEL]
["$1"]' WHERE key = 'KV_DEL';
UPDATE directory SET content = '# WHAT: KV get by key
# WHEN_TO_USE: small text values that change rarely (system_prompt mirror, feature flags)
# ARGS: $1
# EX: [KV_GET]arg1[/KV_GET]
["$1"]' WHERE key = 'KV_GET';
UPDATE directory SET content = '# WHAT: KV get and parse as JSON. Returns "null" if missing
# WHEN_TO_USE: value is structured
# ARGS: $1
# EX: [KV_GET_JSON]arg1[/KV_GET_JSON]
["$1"]' WHERE key = 'KV_GET_JSON';
UPDATE directory SET content = '# WHAT: KV put $1=key $2=value. Overwrite is OK
# WHEN_TO_USE: the same things KV_GET reads
# ARGS: $1 | $2
# EX: [KV_PUT]arg1|arg2[/KV_PUT]
["$1","$2"]' WHERE key = 'KV_PUT';
UPDATE directory SET content = '# WHAT: KV put with JSON-stringify pass-through. $1=key $2=value (string or JSON)
# WHEN_TO_USE: store structured config
# ARGS: $1 | $2
# EX: [KV_PUT_JSON]arg1|arg2[/KV_PUT_JSON]
["$1","$2"]' WHERE key = 'KV_PUT_JSON';
UPDATE directory SET content = '# WHAT: Extract the LAST [REPLY]...[/REPLY] block from an arbitrary text. Returns {found, text}
# WHEN_TO_USE: you need to last reply of
# ARGS: $1
# EX: [LAST_REPLY_OF]arg1[/LAST_REPLY_OF]
["$1"]' WHERE key = 'LAST_REPLY_OF';
UPDATE directory SET content = '# WHAT: GET a path on the loop data platform (api.lbl.fyi, the loop-api-worker). Arg: the path after the host, e.g. "v4/health" or "2chat/contacts" (slashes preserved). Returns raw JSON + status. fyi. If a path needs auth (401), use WEB_FETCH with the right header, or ask the owner for the token
# WHEN_TO_USE: the owner asks for data from the loop platform / lbl
# ARGS: $1
# EX: [LBL_GET]arg1[/LBL_GET]
["GET","https://api.lbl.fyi/$1+","",""]' WHERE key = 'LBL_GET';
UPDATE directory SET content = '# WHAT: POST to the loop data platform (api.lbl.fyi).   For custom auth headers use WEB_FETCH
# WHEN_TO_USE: trigger/send something on the loop platform
# ARGS: path|json_body
# EX: [LBL_POST]arg1|arg2[/LBL_POST]
["POST","https://api.lbl.fyi/$1","$2+",""]' WHERE key = 'LBL_POST';
UPDATE directory SET content = '# WHAT: Raw SELECT against the LEDGER D1 binding (loop-shared-events.events table). $1=SQL, rest = bind params. Returns JSON array of result rows
# WHEN_TO_USE: you need to ledger query
# ARGS: $1
# EX: [LEDGER_QUERY]arg1[/LEDGER_QUERY]
["$1+"]' WHERE key = 'LEDGER_QUERY';
UPDATE directory SET content = '# WHAT: File an image into the asset library.  Returns asset id
# WHEN_TO_USE: you need to log asset
# ARGS: category|label|url|source_url|engine|prompt|sender|chat|protocol|is_group|parent_id|r2_key
# EX: [LOG_ASSET]arg1|arg2|arg3|arg4|arg5|arg6|arg7|arg8|arg9|arg10|arg11|arg12[/LOG_ASSET]
["$1","$2","$3","$4","$5","$6","$7","$8","$9","$10","$11","$12"]' WHERE key = 'LOG_ASSET';
UPDATE directory SET content = '# WHAT: Lowercase a string. Use before SHA256 hashing of emails or other case-insensitive identifiers
# WHEN_TO_USE: you need to lower
# ARGS: $1
# EX: [LOWER]arg1[/LOWER]
["$1"]' WHERE key = 'LOWER';
UPDATE directory SET content = '# WHAT: Self-describing directory: every callable row with description, runner, risk, requires_approval, status, input_schema, examples. The bootstrap contract for any client
# WHEN_TO_USE: you need to manifest
# ARGS: category(optional)
# EX: [MANIFEST]arg1[/MANIFEST]
["$1"]' WHERE key = 'MANIFEST';
UPDATE directory SET content = '# WHAT: Cannibalize an MCP server: read its tools/list and emit a proposed directory row per tool (GAP-checked vs existing keys). PROPOSE only — returns SQL; apply with D1_EXEC or wrangler
# WHEN_TO_USE: you need to mcp import
# ARGS: server_url|category|auth_env_var
# EX: [MCP_IMPORT]arg1|arg2|arg3[/MCP_IMPORT]
["$1","$2","$3"]' WHERE key = 'MCP_IMPORT';
UPDATE directory SET content = '# WHAT: Proxy one tool call into an external MCP server (Streamable HTTP JSON-RPC)
# WHEN_TO_USE: you need to mcp tool call
# ARGS: server_url|tool_name|auth_env_var|args_json
# EX: [MCP_TOOL_CALL]arg1|arg2|arg3|arg4[/MCP_TOOL_CALL]
["$1","$2","$4+","$3"]' WHERE key = 'MCP_TOOL_CALL';
UPDATE directory SET content = '# WHAT: Pull image/video URLs out of a text blob. Returns {all:[...], gen:[...]} where gen filters to /img/gen/ + miscsubjects.com only
# WHEN_TO_USE: you need to media url extract
# ARGS: $1
# EX: [MEDIA_URL_EXTRACT]arg1[/MEDIA_URL_EXTRACT]
["$1"]' WHERE key = 'MEDIA_URL_EXTRACT';
UPDATE directory SET content = '# WHAT: Current ISO timestamp
# WHEN_TO_USE: stamping rows, naming files, or proving the build is live
# ARGS: none
# EX: [NOW][/NOW]
[]' WHERE key = 'NOW';
UPDATE directory SET content = '# WHAT: OpenAI gpt-image-1.5 text-to-image. Stores to R2, returns a stable https://miscsubjects.com/img/ link
# WHEN_TO_USE: you need to openai image
# ARGS: prompt|size(1024x1024|1536x1024|1024x1536)
# EX: [OPENAI_IMAGE]arg1|arg2[/OPENAI_IMAGE]
["$1","$2"]' WHERE key = 'OPENAI_IMAGE';
UPDATE directory SET content = '# WHAT: OpenAI gpt-image-1.5 edit from a reference image URL. Stores to R2
# WHEN_TO_USE: you need to openai image edit
# ARGS: prompt|reference_url|size
# EX: [OPENAI_IMAGE_EDIT]arg1|arg2|arg3[/OPENAI_IMAGE_EDIT]
["$1","$2","$3"]' WHERE key = 'OPENAI_IMAGE_EDIT';
UPDATE directory SET content = '# WHAT: Append a clause/line to any directory row''s `content` (typical use: extend ROUTER, ARCADS, OPS prompts mid-conversation without rewriting the whole prompt).  Returns JSON {ok, key, old_bytes, new_bytes, appended_head}
# WHEN_TO_USE: you need to prompt append
# ARGS: key|addition
# EX: [PROMPT_APPEND]arg1|arg2[/PROMPT_APPEND]
["$1","$2+"]' WHERE key = 'PROMPT_APPEND';
UPDATE directory SET content = '# WHAT: Given the JSON output of EXTRACT_CAPABILITIES (raw JSON string OR an r2_key starting with capability_sources/), emit SQL INSERTs for new directory rows, one per discovered op. Rows land disabled + planner_visible=0 so the owner can review before activating. $1=ops_json_or_r2_key, $2=category prefix (default "discovered")
# WHEN_TO_USE: you need to propose rows
# ARGS: $1 | $2
# EX: [PROPOSE_ROWS]arg1|arg2[/PROPOSE_ROWS]
["$1","$2"]' WHERE key = 'PROPOSE_ROWS';
UPDATE directory SET content = '# WHAT: Enqueue a job on the loop-tasks queue for the sibling Worker to consume and forward to /api/dispatch. $1=KEY, $2=body string. Returns {queued, job}
# WHEN_TO_USE: you need to queue send
# ARGS: $1 | $2
# EX: [QUEUE_SEND]arg1|arg2[/QUEUE_SEND]
["$1","$2"]' WHERE key = 'QUEUE_SEND';
UPDATE directory SET content = '# WHAT: Add a question to the test que. $1 = prompt text. $2 = optional slug (default go)
# WHEN_TO_USE: you need to que add
# ARGS: $1 | $2
# EX: [QUE_ADD]arg1|arg2[/QUE_ADD]
["$1","$2"]' WHERE key = 'QUE_ADD';
UPDATE directory SET content = '# WHAT: Inspect the que. $1 = '''' | pending | done | error. Returns rows (response truncated 200ch)
# WHEN_TO_USE: you need to que list
# ARGS: $1
# EX: [QUE_LIST]arg1[/QUE_LIST]
["$1"]' WHERE key = 'QUE_LIST';
UPDATE directory SET content = '# WHAT: Run pending que rows (max 25/call) through the real ROUTER. Writes response+trace_id+status back
# WHEN_TO_USE: you need to que run
# ARGS: $1
# EX: [QUE_RUN]arg1[/QUE_RUN]
["$1"]' WHERE key = 'QUE_RUN';
UPDATE directory SET content = '# WHAT: R2 delete object at $1=key
# WHEN_TO_USE: clean up demo or expired payloads
# ARGS: $1
# EX: [R2_DEL]arg1[/R2_DEL]
["$1"]' WHERE key = 'R2_DEL';
UPDATE directory SET content = '# WHAT: R2 get object at $1=key. Returns string
# WHEN_TO_USE: read back a payload mirrored from the kernel log
# ARGS: $1
# EX: [R2_GET]arg1[/R2_GET]
["$1"]' WHERE key = 'R2_GET';
UPDATE directory SET content = '# WHAT: R2 list objects under $1=prefix
# WHEN_TO_USE: enumerate ledger overflow files for a given trace
# ARGS: $1
# EX: [R2_LIST]arg1[/R2_LIST]
["$1"]' WHERE key = 'R2_LIST';
UPDATE directory SET content = '# WHAT: R2 put $1=object_key $2=value (string)
# WHEN_TO_USE: large payloads exceeding D1 cell limits
# ARGS: $1 | $2
# EX: [R2_PUT]arg1|arg2[/R2_PUT]
["$1","$2"]' WHERE key = 'R2_PUT';
UPDATE directory SET content = '# WHAT: Current reasoning_effort for all xAI (grok) model calls. Returns {grok_reasoning_effort}. Values: low|medium|high|none|default. Default = model decides
# WHEN_TO_USE: "what is the reasoning level set to"
# ARGS: none
# EX: [REASONING_GET][/REASONING_GET]
[]' WHERE key = 'REASONING_GET';
UPDATE directory SET content = '# WHAT: Set reasoning_effort for all xAI (grok) model calls. Arg: low|medium|high|none|default. "default" removes the field (model decides). Takes effect immediately
# WHEN_TO_USE: "set reasoning to low/high/off", "turn reasoning off", "set grok reasoning effort"
# ARGS: $1
# EX: [REASONING_SET]arg1[/REASONING_SET]
["$1"]' WHERE key = 'REASONING_SET';
UPDATE directory SET content = '# WHAT: Regex parse $1 against /\[KEY\]body[/KEY](?: as bind)?/. Returns {count, tags[]}
# WHEN_TO_USE: dry-run tag extraction before live dispatch
# ARGS: $1
# EX: [REGEX_PARSE]arg1[/REGEX_PARSE]
["$1"]' WHERE key = 'REGEX_PARSE';
UPDATE directory SET content = '# WHAT: Additive memory. Append ONE line to a directory rows content without touching the rest. $1=row key (use ROUTER for your own memory), $2=the line. INVOKE: [REMEMBER]ROUTER|- <one-line memory>[/REMEMBER]
# WHEN_TO_USE: you need to remember
# ARGS: $1 | $2
# EX: [REMEMBER]arg1|arg2[/REMEMBER]
["$1","$2"]' WHERE key = 'REMEMBER';
UPDATE directory SET content = '# WHAT: Read the FULL repo snapshot from KV: {sha, ts, byte_count, content} — content is ~310KB and floods the next turn''s input. Use SNAPSHOT_META for metadata-only. Call this only when you need the raw blob itself
# WHEN_TO_USE: you need to repo snapshot
# ARGS: none
# EX: [REPO_SNAPSHOT][/REPO_SNAPSHOT]
["repo:snapshot:current"]' WHERE key = 'REPO_SNAPSHOT';
UPDATE directory SET content = '# WHAT: Create or replace a flow row from DSL (pipe-safe)
# WHEN_TO_USE: you need to save flow
# ARGS: key|dsl
# EX: [SAVE_FLOW]arg1|arg2[/SAVE_FLOW]
["$1","$2+"]' WHERE key = 'SAVE_FLOW';
UPDATE directory SET content = '# WHAT: Send a message via the right channel sender. $1=channel (blooio|2chat|twochat|telegram), $2=recipient (phone or chat_id), $3=text. Returns {channel, status, body}
# WHEN_TO_USE: you need to send by channel
# ARGS: $1 | $2 | $3
# EX: [SEND_BY_CHANNEL]arg1|arg2|arg3[/SEND_BY_CHANNEL]
["$1","$2","$3"]' WHERE key = 'SEND_BY_CHANNEL';
UPDATE directory SET content = '# WHAT: One-shot: customer create + invoice item + invoice (pending_invoice_items_behavior=include) + finalize + SMS hosted_invoice_url via BLOOIO_SEND
# WHEN_TO_USE: you need to send invoice via blooio
# ARGS: $1 | $2 | $3 | $4 | $5
# EX: [SEND_INVOICE_VIA_BLOOIO]arg1|arg2|arg3|arg4|arg5[/SEND_INVOICE_VIA_BLOOIO]
["$1","$2","$3","$4","$5"]' WHERE key = 'SEND_INVOICE_VIA_BLOOIO';
UPDATE directory SET content = '# WHAT: Bill a named peptide.  sku e.g. ESH-A9; tier starter|standard|advanced; duration 1mo|3mo|6mo|12mo; kind sub|onetime; mode resolve(lookup only, no write)|draft|send(finalize+SMS). Resolves price_id from stripe_catalog
# WHEN_TO_USE: you need to send named invoice
# ARGS: sku|tier|duration|kind|email|name|phone|mode
# EX: [SEND_NAMED_INVOICE]arg1|arg2|arg3|arg4|arg5|arg6|arg7|arg8[/SEND_NAMED_INVOICE]
["$1","$2","$3","$4","$5","$6","$7","$8"]' WHERE key = 'SEND_NAMED_INVOICE';
UPDATE directory SET content = '# WHAT: Create an invoice for existing customer $1 using catalog price $2 (qty $3). $4=send (true to finalize+send; default false=draft)
# WHEN_TO_USE: you need to send peptide invoice
# ARGS: $1 | $2 | $3 | $4
# EX: [SEND_PEPTIDE_INVOICE]arg1|arg2|arg3|arg4[/SEND_PEPTIDE_INVOICE]
["$1","$2","$3","$4"]' WHERE key = 'SEND_PEPTIDE_INVOICE';
UPDATE directory SET content = '# WHAT: Read a session row
# WHEN_TO_USE: you need to session get
# ARGS: session_id
# EX: [SESSION_GET]arg1[/SESSION_GET]
["$1"]' WHERE key = 'SESSION_GET';
UPDATE directory SET content = '# WHAT: Rehydrate a cold terminal agent: session row + recent LEDGER events (actor=session_id)
# WHEN_TO_USE: you need to session resume
# ARGS: session_id|limit
# EX: [SESSION_RESUME]arg1|arg2[/SESSION_RESUME]
["$1","$2"]' WHERE key = 'SESSION_RESUME';
UPDATE directory SET content = '# WHAT: Start (or upsert) a stateful agent session
# WHEN_TO_USE: you need to session start
# ARGS: session_id|agent|cwd|goal
# EX: [SESSION_START]arg1|arg2|arg3|arg4[/SESSION_START]
["$1","$2","$3","$4+"]' WHERE key = 'SESSION_START';
UPDATE directory SET content = '# WHAT: Patch a session (agent|cwd|goal|status|last_event_id)
# WHEN_TO_USE: you need to session update
# ARGS: session_id|patch_json
# EX: [SESSION_UPDATE]arg1|arg2[/SESSION_UPDATE]
["$1","$2+"]' WHERE key = 'SESSION_UPDATE';
UPDATE directory SET content = '# WHAT: Read a setting value, KV first, fall back to settings table. Returns {key, value, source: kv|d1|miss}
# WHEN_TO_USE: you need to settings read kv first
# ARGS: $1
# EX: [SETTINGS_READ_KV_FIRST]arg1[/SETTINGS_READ_KV_FIRST]
["$1"]' WHERE key = 'SETTINGS_READ_KV_FIRST';
UPDATE directory SET content = '# WHAT: Set a directory row content (pipe-safe)
# WHEN_TO_USE: you need to set row content
# ARGS: key|content
# EX: [SET_ROW_CONTENT]arg1|arg2[/SET_ROW_CONTENT]
["$1","$2+"]' WHERE key = 'SET_ROW_CONTENT';
UPDATE directory SET content = '# WHAT: SHA-256 hex of lowercased trimmed input
# WHEN_TO_USE: hash em/ph/external_id for Meta CAPI or any PII hashing
# ARGS: $1
# EX: [SHA256_LOWER]arg1[/SHA256_LOWER]
["$1"]' WHERE key = 'SHA256_LOWER';
UPDATE directory SET content = '# WHAT: Resolve a short_id (D35 / K3 / etc.) to its underlying surface via /api/inventory?short_id=<id>. Returns the inventory row JSON
# WHEN_TO_USE: you need to short resolve
# ARGS: $1
# EX: [SHORT_RESOLVE]arg1[/SHORT_RESOLVE]
["$1"]' WHERE key = 'SHORT_RESOLVE';
UPDATE directory SET content = '# WHAT: Cannibalize a SKILL.md (frontmatter name+description, markdown body) into a proposed agent row. PROPOSE only
# WHEN_TO_USE: you need to skill import
# ARGS: source(url|r2:key|raw)|model|category
# EX: [SKILL_IMPORT]arg1|arg2|arg3[/SKILL_IMPORT]
["$1","$2","$3"]' WHERE key = 'SKILL_IMPORT';
UPDATE directory SET content = '# WHAT: Save a reference image (e.g. one sent via Blooio) to R2 and return {filename,key,url}. Arg: source_url
# WHEN_TO_USE: you need to store ref image
# ARGS: $1
# EX: [STORE_REF_IMAGE]arg1[/STORE_REF_IMAGE]
["$1"]' WHERE key = 'STORE_REF_IMAGE';
UPDATE directory SET content = '# WHAT: Pull active products + prices from Stripe and upsert into D1.stripe_catalog
# WHEN_TO_USE: refresh local SKU cache
# ARGS: none
# EX: [STRIPE_CATALOG_SYNC][/STRIPE_CATALOG_SYNC]
[]' WHERE key = 'STRIPE_CATALOG_SYNC';
UPDATE directory SET content = '# WHAT: Return env var by name. Use ONLY for publishable values (e.g. STRIPE_PUBLIC_KEY). Never for secret keys
# WHEN_TO_USE: you need to stripe public key get
# ARGS: none
# EX: [STRIPE_PUBLIC_KEY_GET][/STRIPE_PUBLIC_KEY_GET]
["STRIPE_PUBLIC_KEY"]' WHERE key = 'STRIPE_PUBLIC_KEY_GET';
UPDATE directory SET content = '# WHAT: Two agents reason against each other on a goal, bounded rounds, converge. $1=goal $2=proposer(default CODE_AUDIT) $3=critic(default CRITIC) $4=rounds(default 3)
# WHEN_TO_USE: you need to team run
# ARGS: $1 | $2 | $3 | $4
# EX: [TEAM_RUN]arg1|arg2|arg3|arg4[/TEAM_RUN]
["$1","$2","$3","$4"]' WHERE key = 'TEAM_RUN';
UPDATE directory SET content = '# WHAT: Run TEST_ROW on every key that has a directory_tests entry. $1=limit (default 50). Returns {run_id, keys, passed, failed, summary[]}
# WHEN_TO_USE: you need to test all
# ARGS: $1
# EX: [TEST_ALL]arg1[/TEST_ALL]
["$1"]' WHERE key = 'TEST_ALL';
UPDATE directory SET content = '# WHAT: Run every directory_tests row for the given KEY against /api/dispatch, score against expect_kind/expect_value, append rows to fidelity_log under one run_id. $1=KEY. Returns {key, run_id, total, passed, failed, results[]}
# WHEN_TO_USE: you need to test row
# ARGS: $1
# EX: [TEST_ROW]arg1[/TEST_ROW]
["$1"]' WHERE key = 'TEST_ROW';
UPDATE directory SET content = '# WHAT: Run the next open task in the build to-do (tasks table) through the ROUTER. $1=mode; pass force to run on-demand. Cron calls it every 5 min, gated by KV todo_autorun
# WHEN_TO_USE: you need to todo run
# ARGS: $1
# EX: [TODO_RUN]arg1[/TODO_RUN]
["$1"]' WHERE key = 'TODO_RUN';
UPDATE directory SET content = '# WHAT: Return JSON [{key,type,docs}] of planner-visible tools in $1. $1=category, $2=limit (default 30, max 100). Use as stage 2 of tool selection after CATEGORIES
# WHEN_TO_USE: you need to tools in
# ARGS: $1 | $2
# EX: [TOOLS_IN]arg1|arg2[/TOOLS_IN]
["$1","$2"]' WHERE key = 'TOOLS_IN';
UPDATE directory SET content = '# WHAT: Uppercase a string. Use only for cosmetic transforms; not for user-visible reply text
# WHEN_TO_USE: you need to upper
# ARGS: $1
# EX: [UPPER]arg1[/UPPER]
["$1"]' WHERE key = 'UPPER';
UPDATE directory SET content = '# WHAT: HMAC-SHA256 hex of $1=body using env.BLOOIO_WEBHOOK_SECRET
# WHEN_TO_USE: verify Blooio inbound signatures
# ARGS: $1
# EX: [VERIFY_BLOOIO_SIG]arg1[/VERIFY_BLOOIO_SIG]
["BLOOIO_WEBHOOK_SECRET","$1"]' WHERE key = 'VERIFY_BLOOIO_SIG';
UPDATE directory SET content = '# WHAT: Make a spoken-audio FILE and return its public URL (does NOT send it). INVOKE: [VOICE_SAY]<text>|<voice>[/VOICE_SAY]
# WHEN_TO_USE: you need to voice say
# ARGS: $1 | $2
# EX: [VOICE_SAY]arg1|arg2[/VOICE_SAY]
["$1","$2"]' WHERE key = 'VOICE_SAY';
UPDATE directory SET content = '# WHAT: Speak a reply INTO a chat (recommended audio-out). INVOKE: [VOICE_SEND]<chat>|<words to speak>|<voice>[/VOICE_SEND]
# WHEN_TO_USE: you need to voice send
# ARGS: $1 | $2 | $3
# EX: [VOICE_SEND]arg1|arg2|arg3[/VOICE_SEND]
["$1","$2","$3"]' WHERE key = 'VOICE_SEND';
UPDATE directory SET content = '# WHAT: Transcribe inbound audio to TEXT (OpenAI whisper-1). INVOKE: [VOICE_TRANSCRIBE]<public_audio_url>[/VOICE_TRANSCRIBE]
# WHEN_TO_USE: you need to voice transcribe
# ARGS: $1
# EX: [VOICE_TRANSCRIBE]arg1[/VOICE_TRANSCRIBE]
["$1"]' WHERE key = 'VOICE_TRANSCRIBE';
UPDATE directory SET content = '# WHAT: Compute embedding vector(s) for text using a Workers AI embedding model via env.AI binding. $1=text, $2=optional model id (default @cf/baai/bge-base-en-v1.5)
# WHEN_TO_USE: you need to wai embed
# ARGS: $1 | $2
# EX: [WAI_EMBED]arg1|arg2[/WAI_EMBED]
["$1","$2"]' WHERE key = 'WAI_EMBED';
UPDATE directory SET content = '# WHAT: Run a Workers AI model via the env.AI binding. $1=model id (e.g. @cf/meta/llama-3.3-70b-instruct), $2=user prompt. Returns the raw JSON from env.AI.run
# WHEN_TO_USE: you need to wai run
# ARGS: $1 | $2
# EX: [WAI_RUN]arg1|arg2[/WAI_RUN]
["$1","$2"]' WHERE key = 'WAI_RUN';
UPDATE directory SET content = '# WHAT: Generate an image from a prompt using a Workers AI text-to-image model via env.AI binding. Stores the result in R2 and returns a stable URL. $1=prompt, $2=optional model id (default @cf/stabilityai/stable-diffusion-xl-base-1.0)
# WHEN_TO_USE: you need to wai t2i
# ARGS: $1 | $2
# EX: [WAI_T2I]arg1|arg2[/WAI_T2I]
["$1","$2"]' WHERE key = 'WAI_T2I';
UPDATE directory SET content = '# WHAT: Translate text between languages using @cf/meta/m2m100-1.2b via env.AI binding. $1=text, $2=source lang code (default en), $3=target lang code (default es)
# WHEN_TO_USE: you need to wai translate
# ARGS: $1 | $2 | $3
# EX: [WAI_TRANSLATE]arg1|arg2|arg3[/WAI_TRANSLATE]
["$1","$2","$3"]' WHERE key = 'WAI_TRANSLATE';
UPDATE directory SET content = '# WHAT: Pre-flight gate. Given a proposed {key, body}, look up watch_rules and return {allowed:bool, reason}. Use BEFORE invoking any potentially destructive directory key. $1=KEY, $2=body
# WHEN_TO_USE: you need to watch action
# ARGS: $1 | $2
# EX: [WATCH_ACTION]arg1|arg2[/WATCH_ACTION]
["$1","$2"]' WHERE key = 'WATCH_ACTION';
UPDATE directory SET content = '# WHAT: Add a deny rule to watch_rules. $1=pattern_key (regex over KEY), $2=pattern_body (regex over body, optional), $3=reason, $4=action (default "deny"). Returns {ok,id,...}
# WHEN_TO_USE: you need to watch rule add
# ARGS: $1 | $2 | $3 | $4
# EX: [WATCH_RULE_ADD]arg1|arg2|arg3|arg4[/WATCH_RULE_ADD]
["$1","$2","$3","$4"]' WHERE key = 'WATCH_RULE_ADD';
UPDATE directory SET content = '# WHAT: Delete a watch_rules entry by id. $1=id
# WHEN_TO_USE: you need to watch rule delete
# ARGS: $1
# EX: [WATCH_RULE_DELETE]arg1[/WATCH_RULE_DELETE]
["$1"]' WHERE key = 'WATCH_RULE_DELETE';
UPDATE directory SET content = '# WHAT: List every watch_rules entry
# WHEN_TO_USE: you need to watch rule list
# ARGS: none
# EX: [WATCH_RULE_LIST][/WATCH_RULE_LIST]
[]' WHERE key = 'WATCH_RULE_LIST';
UPDATE directory SET content = '# WHAT: Call any URL with any method.  body and headers_json optional. Full request/response logged (credentials redacted).  Example: POST|https://api.example.com/x|{"a":1}|{"Authorization":"Bearer XYZ"}
# WHEN_TO_USE: POST/PUT/DELETE to any API, or GET with custom headers/auth
# ARGS: method|url|body|headers_json
# EX: [WEB_FETCH]arg1|arg2|arg3|arg4[/WEB_FETCH]
["$1","$2","$3","$4"]' WHERE key = 'WEB_FETCH';
UPDATE directory SET content = '# WHAT: GET any URL and return its status + body (first 20000 chars). Arg: the full https URL (slashes and query string preserved). Full request/response logged.  Grok also has native web_search for open-ended search; use WEB_GET when you know the exact URL
# WHEN_TO_USE: read any web page or public API — "look around the internet", check a doc, hit a third-party endpoint
# ARGS: $1
# EX: [WEB_GET]arg1[/WEB_GET]
["GET","$1+","",""]' WHERE key = 'WEB_GET';
UPDATE directory SET content = '# WHAT: Atomic 3-step chain — resolve a short_id, append a wire-up cla  Returns JSON {short_id,name,kind,appended_clause,append_result,invoke_key,invoke_result}
# WHEN_TO_USE: ROUTER''s prompt, and invoke the resolved tool
# ARGS: short_id|trigger_phrase|invoke_args
# EX: [WIRE_UP_AND_INVOKE]arg1|arg2|arg3[/WIRE_UP_AND_INVOKE]
["$1","$2","$3+"]' WHERE key = 'WIRE_UP_AND_INVOKE';