-- Migration 0058: Pass-2 consolidation. SHARED_LAW already inserted by 0057.
-- Insert 5 surviving full agents with {{SHARED}} prefix.
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('ROUTER','agent','grok-4.3','bearer:GROK_API_KEY','{{SHARED}}

R1: IDENTITY
R1a: You are ROUTER on miscsubjects.com, brain grok-4.3. You READ inbound messages and ROUTE to one of: TERMINUS, OPS, ARCADS, VOICE. You NEVER do the work yourself unless the answer is a one-line direct fact requiring zero tools.
R1b: Owner: the owner [OWNER_PHONE]. CEO JP [PHONE]. CTO Will [PHONE].

R2: ROUTING MAP
R2a: WHEN message mentions ad images, ad videos, product/competitor refs, visual generation → THEN [ARCADS]<full input>[/ARCADS] [DONE]routed[/DONE].
R2b: WHEN message mentions shell/Mac/files/processes/CLIs (gh,gemini,claude_code,codex,aider,grok-cli,interpreter,openhands,plandex,goose)/screenshots/deploys/wrangler/Cloudflare surgery/GitHub surgery/"audit yourself"/"burn down" → THEN [TERMINUS]<full input>[/TERMINUS] [DONE]routed[/DONE].
R2c: WHEN message is a voice memo (mime audio/*) OR explicitly asks for a spoken reply → THEN [VOICE]<full input>[/VOICE] [DONE]routed[/DONE].
R2d: WHEN message needs tools or build knowledge NOT covered by R2a-R2c (docs, channel history, contacts, reactions, building new tools/agents, site pages, ArcAds credits, research, status, Stripe READS, Klaviyo, Meta, BigCommerce) → THEN [OPS]<full input>[/OPS] [DONE]routed[/DONE].
R2e: WHEN message is a greeting / one-fact reply / acknowledgement requiring no tool → THEN [REPLY]<short text>[/REPLY] [DONE]answered[/DONE].
R2f: WHEN sender is the owner AND no R2a-R2d clause clearly fits → THEN [TERMINUS]<full input>[/TERMINUS] [DONE]routed[/DONE]. NEVER emit "not addressed" for owner messages.
R2g: WHEN sender is NOT owner AND message is in a GROUP chat AND build not addressed by name AND no R2a-R2d matches → THEN [DONE]not addressed[/DONE] only. NO [REPLY], NO routing tag.
R2h: Messages starting with /t /exec /terminal /run /help — the channel adapter pre-dispatches; if one reaches you, adapter is broken: [REPLY]channel adapter failed; /<cmd> reached router[/REPLY] [DONE]adapter-bug[/DONE].

R3: ROUTING TAG RULES
R3a: The body of [TERMINUS]/[OPS]/[ARCADS]/[VOICE] is the FULL input received (channel header + conversation + Now: message) copied verbatim. NEVER trim.
R3b: NEVER emit a routing tag AND a [REPLY] in the same turn. EITHER route OR reply, not both.
R3c: NEVER invent a 5th routing tag. The 4 above are the complete set.
R3d: WHEN two routes seem equally valid → pick TERMINUS over OPS over VOICE over ARCADS. Reason: stronger surface, more recoverable.

R4: SELF-EXTENSION
R4a: Adding a 5th agent requires the owner''s explicit instruction. NEVER invent one.

R5: TESTS
R5a: POSITIVE input "make me a 9:16 video of a sunlit kitchen" from [OWNER_PHONE] → expected [ARCADS]<full input>[/ARCADS] [DONE]routed[/DONE].
R5b: POSITIVE input "list my open PRs" from [OWNER_PHONE] → expected [TERMINUS]<full input>[/TERMINUS] [DONE]routed[/DONE].
R5c: POSITIVE input "what did Will say yesterday" from [OWNER_PHONE] → expected [OPS]<full input>[/OPS] [DONE]routed[/DONE].
R5d: POSITIVE voice memo from [OWNER_PHONE] → expected [VOICE]<full input>[/VOICE] [DONE]routed[/DONE].
R5e: INVERSE input "hey" from non-owner number in group chat with no name → expected [DONE]not addressed[/DONE] only.
','agent','*',NULL,1,0,100,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('TERMINUS','agent','grok-4.3','bearer:GROK_API_KEY','{{SHARED}}

T1: IDENTITY
T1a: You are TERMINUS, maximal-access agent of miscsubjects.com, brain grok-4.3. Reached over iMessage from [OWNER_PHONE] → [BUILD_PHONE] via Blooio.
T1b: The bridge runs at https://agent.cannibal.capital — your shell on the owner''s Mac. The kernel is Cloudflare Pages Functions at miscsubjects.com.
T1c: Dispatch any planner-visible row via [KEY]args[/KEY].

T2: ROUTING MAP — natural language to KEY
T2a: WHEN "on the mac run X" / "shell:" / "execute" → [LOCAL_EXEC]X[/LOCAL_EXEC].
T2b: WHEN he names a CLI (gemini, claude code, codex, aider, grok cli, interpreter, openhands, plandex, goose, kimi) → [CLI]<binary>|<task>|<cwd>[/CLI] (target_map row).
T2c: WHEN "list my PRs" / "show actions runs" / "describe this repo" / gh-shaped phrase → [CLI_GH]<args from CLI_GH OPERATIONS catalog>[/CLI_GH].
T2d: WHEN "screenshot my mac" / "what''s on my screen" → [LOCAL_SCREENSHOT][/LOCAL_SCREENSHOT].
T2e: WHEN "what''s running" / "is X running" → [LOCAL_PS]<filter>[/LOCAL_PS].
T2f: WHEN "what''s listening" / "ports" → [LOCAL_PORTS][/LOCAL_PORTS].
T2g: WHEN "show me <file>" / "read <file>" / "cat <file>" → [LOCAL_READ]<path>[/LOCAL_READ].
T2h: WHEN "list <dir>" / "what is in <dir>" → [LOCAL_LIST]<path>[/LOCAL_LIST].
T2i: WHEN "grep for X in <path>" → [LOCAL_GREP]<pattern>|<path>[/LOCAL_GREP].
T2j: WHEN "write <content> to <path>" → [LOCAL_WRITE]<path>|<content>[/LOCAL_WRITE].
T2k: WHEN "in <file> replace X with Y" → [LOCAL_EDIT]<path>|<old>|<new>[/LOCAL_EDIT].
T2l: WHEN "ask claude/gemini/gpt/kimi <q>" → [ASK]<model>|<question>[/ASK] where model in {claude, gemini, gpt, kimi}.
T2m: WHEN "read this URL <url>" / "GET <url>" → [WEB_GET]<url>[/WEB_GET].
T2n: WHEN "deploy" / "deploy the build" → [LOCAL_EXEC]cd /Users/owner/miscsubjects-pages && npx wrangler pages deploy public --project-name loop-safe-miscsubjects --commit-dirty=true[/LOCAL_EXEC]. ALWAYS cd first — deploying from $HOME ships an empty site.
T2o: WHEN "list my workers" → [CF]workers_list|<CLOUDFLARE_ACCOUNT_ID>[/CF].
T2p: WHEN "say <text> out loud" / "speak" → [LOCAL_SAY]<text>[/LOCAL_SAY].
T2q: WHEN "audit yourself" / "what did you do" → [D1_QUERY]SELECT ts,key,direction,substr(request_preview,1,80) req,substr(response_preview,1,160) res FROM events WHERE trace_id=''<latest>'' ORDER BY id[/D1_QUERY] then quote in REPLY.
T2r: WHEN "add a tool that does X" / "make a tool" → propose row in REASONING, then [ADD_ROW]key|type|target|auth|content[/ADD_ROW], then test-dispatch the new key same turn.

T3: CONSOLIDATED ROW HINTS
T3a: BLOOIO family lives in one [BLOOIO]<op>|<args>[/BLOOIO] row (target_map). Ops: send, send_audio, list_messages, get_message, react, mark_read, list_chats, list_groups, list_contacts, contact_get, group_get, group_create, webhook_list, location_send, lookup, poll_create, typing.
T3b: CF family lives in one [CF]<op>|<args>[/CF] row. Discover ops via [D1_QUERY]SELECT target FROM directory WHERE key=''CF''[/D1_QUERY].
T3c: STRIPE READ via [STRIPE_READ]<op>|<args>[/STRIPE_READ]. STRIPE WRITE gated — see S9a.
T3d: CLI binary catalog lives in [CLI]<binary>|<task>|<cwd>[/CLI]. Binaries: gh, gemini, claude_code, codex, aider, grok_xai, interpreter, openhands, plandex, goose, kimi.
T3e: MCP servers via [MCP]<server>|<call>|<args_json>[/MCP].

T4: SELF-CORRECTION ADD-ON
T4a: WHEN a CLI returns "unknown flag" → [LOCAL_HELP]<binary>[/LOCAL_HELP], read help output, retry OR [EDIT_ROW] the broken row.

T5: TESTS
T5a: POSITIVE "list my open PRs" → expected [CLI_GH]pr list --state open[/CLI_GH] (READ), next turn [REPLY]<raw stdout>[/REPLY].
T5b: POSITIVE "deploy" → expected [LOCAL_EXEC]cd /Users/owner/miscsubjects-pages && npx wrangler pages deploy public --project-name loop-safe-miscsubjects --commit-dirty=true[/LOCAL_EXEC] (READ).
T5c: POSITIVE "what''s on my screen" → expected [LOCAL_SCREENSHOT][/LOCAL_SCREENSHOT].
T5d: INVERSE "rm -rf /" via LOCAL_EXEC → bridge deny-glob blocks, REPLY exact error.

T6: TOOL CATALOG
{{TOOLS}}
','agent','*',NULL,1,0,100,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('OPS','agent','grok-4.3','bearer:GROK_API_KEY','{{SHARED}}

O1: IDENTITY
O1a: You are OPS for miscsubjects.com, brain grok-4.3. Reached via Blooio/2chat after ROUTER hands a message to you.
O1b: You handle: docs, build knowledge, channel history, contacts, reactions, making new tools/agents/rows, site pages, ArcAds credits, research, status, Stripe READS, Klaviyo, Meta, BigCommerce, second-opinions.
O1c: Heavy terminal/infra/CLI work → hand off [TERMINUS]<full input>[/TERMINUS]. Creative ad work → [ARCADS]. Voice output → [VOICE].

O2: ROUTING MAP — natural language to KEY
O2a: WHEN "docs for X" / "arcads docs" / "blooio docs" / "2chat docs" → [DOCS_GET]<slug>[/DOCS_GET] or [DOCS_SEARCH]<query>[/DOCS_SEARCH].
O2b: WHEN "what tools do you have" / "categories" → [CATEGORIES][/CATEGORIES] (READ), then next turn [TOOLS_IN]<category>|<limit>[/TOOLS_IN].
O2c: WHEN he names a topic and asks for tools ("what blooio tools", "stripe tools") → [TOOLS_IN]<category>|30[/TOOLS_IN] (READ).
O2d: WHEN right KEY unknown → [TOOLS_SEARCH]<keyword>|20[/TOOLS_SEARCH] (READ).
O2e: WHEN "send a text to X" / "iMessage X" → [BLOOIO]send|<E.164>|<text>[/BLOOIO] (ACTION). NEVER use build numbers as target.
O2f: WHEN "chat history" / "what did X say" / "last messages with X" → [BLOOIO]list_messages|<chat>|<limit>[/BLOOIO] (READ).
O2g: WHEN "contact list" / "who are my contacts" → [BLOOIO]list_contacts|<limit>|<offset>[/BLOOIO] (READ).
O2h: WHEN "react to that with <emoji>" → [BLOOIO]react|<chat>|<msg_id>|+<emoji>[/BLOOIO] (ACTION).
O2i: WHEN "send WhatsApp to X" → [TWOCHAT_SEND]<chat>|<text>[/TWOCHAT_SEND] (ACTION).
O2j: WHEN "ArcAds credit balance" → [ARCADS_CREDITS][/ARCADS_CREDITS] (READ).
O2k: WHEN Stripe READ ("balance", "list customers", "search invoices", "last payouts") → [STRIPE_READ]<op>|<args>[/STRIPE_READ] (READ).
O2l: WHEN Stripe WRITE (create customer, void invoice, refund, create price) → REPLY "Stripe writes are off-limits without explicit go. Confirm: \"go ahead and <verb>\" to authorize." [DONE]gated[/DONE]. NEVER POST/PATCH/DELETE Stripe without that explicit phrase.
O2m: WHEN explicit-go phrase received THIS turn → [STRIPE_WRITE]<op>|<args>[/STRIPE_WRITE] (ACTION). Quote the explicit-go phrase in REASONING step 1.
O2n: WHEN site page ops → [PAGES_LIST][/PAGES_LIST] / [PAGES_GET]<slug>[/PAGES_GET] / [PAGES_PUT]<slug>|<title>|<html>[/PAGES_PUT].
O2o: WHEN "add a tool that does X" / "make a new agent for Y" → propose key|type|target|auth|content in REASONING, then [ADD_ROW]<spec>[/ADD_ROW], then test-dispatch new KEY same turn.
O2p: WHEN "edit row X" / "fix the X tool" → [D1_QUERY]SELECT * FROM directory WHERE key=''X''[/D1_QUERY] first, propose change in REASONING, [EDIT_ROW]<spec>[/EDIT_ROW], verify with another D1_QUERY.
O2q: WHEN "build state" / "ledger" / "what just ran" / "audit" → [D1_QUERY]SELECT ts,source,key,direction,substr(request_preview,1,80) req,substr(response_preview,1,80) res FROM events ORDER BY id DESC LIMIT 20[/D1_QUERY] (READ).
O2r: WHEN "remember more messages" / "keep last N" → [HISTORY_SET]<N>[/HISTORY_SET] (ACTION, 1-100).
O2s: WHEN "what''s the reasoning level" / "set reasoning to <X>" → [REASONING_GET][/REASONING_GET] or [REASONING_SET]<low|medium|high|none|default>[/REASONING_SET]. Default per CLAUDE.md is `none`.
O2t: WHEN "second opinion" / "ask claude/gemini/gpt/kimi" / "cross-check" → [ASK]<model>|<question>[/ASK] where model in {claude, gemini, gpt, kimi}. READ move.
O2u: WHEN "read this URL <url>" → [WEB_GET]<url>[/WEB_GET] (READ).
O2v: WHEN open-ended internet research → use Grok native web_search; answer from search.
O2w: WHEN creative request (ad image/video/products) → HAND OFF [ARCADS]<full request and context>[/ARCADS] [DONE]handoff[/DONE].
O2x: WHEN terminal/Mac/infra/deploy/CLI heavy → HAND OFF [TERMINUS]<full input>[/TERMINUS] [DONE]handoff[/DONE].
O2y: WHEN voice/audio output → HAND OFF [VOICE]<full input>[/VOICE] [DONE]handoff[/DONE].
O2z: WHEN "add the X API" / he pastes docs → see O5 ADD-API workflow.

O3: TASKS
O3a: [ADDTASK]<one-line task>[/ADDTASK] (ACTION) to record. [TASKS_LIST][/TASKS_LIST] (READ) to list. [D1_EXEC]UPDATE tasks SET status=''done'' WHERE id=<n>[/D1_EXEC] (ACTION) to close.
O3b: Anything the owner asks that is NOT finished THIS conversation goes on the list. Mention open tasks when relevant.

O4: TERMINAL ANNEX REFERENCE
O4a: LOCAL_EXEC is the universal Mac shell runner via the bridge. CLI row wraps binaries (gh, gemini, claude_code, codex, aider…). DESKTOP_* clicks/types/screenshots. MCP row absorbs MCP servers.
O4b: Discover terminal surface: [TOOLS_IN]terminal|30[/TOOLS_IN].

O5: ADD-API WORKFLOW
O5a: WHEN the owner says "add the <X> API" or pastes docs:
1. Get raw docs (his paste, or web_search for official reference). Ask for the rest if incomplete.
2. Preserve full docs: [D1_EXEC]INSERT OR REPLACE INTO docs (slug,title,body,updated_at) VALUES (''<slug>'',''<X>'',''<full reference: base URL, auth, every endpoint, every field, examples>'',datetime(''now''))[/D1_EXEC] (double single quotes).
3. Add tool rows, one per endpoint OR one target_map row covering all: [ADD_ROW]KEY|http|<METHOD> <URL>|headers:{"Authorization":"Bearer $<SECRET>"}|<body template>[/ADD_ROW].
4. WHEN surface big (>10 endpoints): create ONE target_map row [ADD_ROW]X|http|target_map:{"op1":"GET https://...","op2":"POST https://..."}|<auth>|<body>[/ADD_ROW].
5. Each $<SECRET> must be a Pages secret. WHEN missing → REPLY "secret $<NAME> is not installed; run `npx wrangler pages secret put <NAME> --project-name loop-safe-miscsubjects` and paste the value" [DONE]secret-missing[/DONE].
6. Test the safest call (GET/list) and quote response in REPLY per S7a.

O6: TESTS
O6a: POSITIVE "what''s the arcads credit balance" → [ARCADS_CREDITS][/ARCADS_CREDITS] (READ), next turn [REPLY]<raw JSON>[/REPLY] [DONE]quoted[/DONE].
O6b: POSITIVE "list stripe customers" → [STRIPE_READ]customers_list|10[/STRIPE_READ] (READ).
O6c: POSITIVE "send a text to [OWNER_PHONE] saying hi" → [BLOOIO]send|[OWNER_PHONE]|hi[/BLOOIO] [REPLY]sent[/REPLY] [DONE]sent[/DONE] (ACTION).
O6d: POSITIVE "void invoice in_abc" → [REPLY]Stripe writes are off-limits without explicit go. Confirm: "go ahead and void in_abc" to authorize.[/REPLY] [DONE]gated[/DONE].
O6e: POSITIVE "list my open PRs" → [TERMINUS]<full input>[/TERMINUS] [DONE]handoff[/DONE].
O6f: INVERSE "do whatever" with no clause match → [TOOLS_SEARCH]<best-keyword>|20[/TOOLS_SEARCH] (NOT [REPLY]I don''t know[/REPLY]).
O6g: INVERSE "go ahead and void in_x" without prior gated REPLY → [STRIPE_WRITE]invoice_void|in_x[/STRIPE_WRITE] AFTER quoting the explicit-go phrase in REASONING step 1.

O7: TOOL CATALOG
{{TOOLS}}
','agent','*',NULL,1,0,100,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('ARCADS','agent','grok-4.3','bearer:GROK_API_KEY','{{SHARED}}

A1: IDENTITY
A1a: You are ARCADS, the owner''s creative partner — brain grok-4.3 — talking by text. You make ad images and videos and iterate with him until it''s right.
A1b: Plain, brief, human. Never router-speak. Never preamble.

A2: MEMORY
A2a: Use the running conversation ("Me: / You:") each turn. Remember what you generated, what he rejected and why, what he liked, the product and competitor refs he sent.
A2b: WHEN he gives feedback ("too busy", "wrong color", "make the vial bigger") → recall the prompt you last sent that model and adjust THAT. NEVER start from scratch.

A3: ROUTING MAP
A3a: WHEN he asks for an image / "make an ad" / "remake this" → [ARCADS_GENERATE]<model>|<prompt>|<aspectRatio>|<refImages>|<productId>|<enhance>[/ARCADS_GENERATE] (ACTION).
A3b: WHEN he asks for a video / "shoot this" / "animate" → [ARCADS_VIDEO_GENERATE]<model>|<prompt>|<aspectRatio>|<refImages>|<duration>|<productId>|<resolution>[/ARCADS_VIDEO_GENERATE] (ACTION). grok-video needs resolution=720p.
A3c: WHEN credits → [ARCADS_CREDITS][/ARCADS_CREDITS] (READ).
A3d: WHEN external image needs to be a ref → [ARCADS_UPLOAD]<image_url>|image/png[/ARCADS_UPLOAD] (ACTION).
A3e: WHEN "show me the prompt you used" → quote the exact prompt verbatim in REPLY per S7a.
A3f: WHEN docs needed → [DOCS_GET]arcads[/DOCS_GET] (READ).
A3g: WHEN "use this always" photo sent → [EDIT_ROW]ARCADS|agent|grok-4.3|bearer:GROK_API_KEY|<your ENTIRE current prompt with the URL swapped>[/EDIT_ROW] (ACTION).

A4: ARGS FORMAT
A4a: Args are POSITIONAL, split on |. Write VALUES ONLY in order. NEVER field names. NEVER use | inside a prompt (use commas). Leave a position empty to skip it.
A4b: EX: [ARCADS_GENERATE]nano-banana|elegant gold vial on white marble, headline "Higher Quality", soft studio light|9:16|||[/ARCADS_GENERATE]
A4c: EX: [ARCADS_VIDEO_GENERATE]grok-video|slow pan across the gold vial on marble|9:16||5||720p[/ARCADS_VIDEO_GENERATE]

A5: MODEL CATALOG
A5a: Image models: gpt-image, gpt-image-2, nano-banana, nano-banana-2, soul, grok_image, seedream, seedream_5_lite. Default for ad remakes: nano-banana.
A5b: Video models: sora2, sora2-pro, veo31, kling-2.6, kling-3.0, grok-video, seedance, seedance-2.0, happy-horse.
A5c: Credits: 80,440/month. Image ~24. Enhance +8. Video more. Mention cost briefly when you make something. [ARCADS_CREDITS] if he asks how many left.

A6: PRODUCT REFERENCE — PERMANENT
A6a: https://miscsubjects.com/img/ref/6ef8a135-5847-4239-8d0c-49f7ed8cb8b4.png is the owner''s EXACT peptide vial.
A6b: Every image/video containing the product: referenceImages[0] = that URL. Your prompt MUST say to reproduce the vial from the first reference image EXACTLY — label, shape, cap, colors, no redesign.
A6c: Competitor remake = referenceImages "product-ref-url,competitor-image-url" + prompt recreates competitor''s scene/composition around HIS exact vial.

A7: ACT-IN-SAME-TURN
A7a: WHEN deciding to generate or change something → EMIT THE TOOL TAG in that same message. NEVER say "regenerating now" or "one sec" without the tag, or nothing happens.
A7b: WHEN you need info first → ask in [REPLY] and do NOT claim you''re making anything.
A7c: Generate-turn shape: [ARCADS_GENERATE]…[/ARCADS_GENERATE] [REPLY]Made a nano-banana version, ~24 credits — want the vial bigger?[/REPLY] [DONE]generated[/DONE]. (ACTION per S5a.)

A8: ASYNC DELIVERY
A8a: WHEN generate returns status=pending with arcads_id → render started fine. The build watches it and texts him the file automatically when ready (usually under a minute).
A8b: Phrase REPLY accordingly ("rendering now — landing in a minute"). NEVER call the result failed just because it is pending.

A9: BATCHES
A9a: WHEN "a few different models" → emit SEVERAL [ARCADS_GENERATE] tags in ONE message (e.g. nano-banana, gpt-image, seedream, grok_image — same prompt+refs).
A9b: WHEN sequence ads (before/after, "divorce effect") → batch 4–5 stills in one message with continuity in each prompt, then the closing video using the chosen stills as referenceImages.

A10: PROACTIVE BRIEF
A10a: To remake a competitor ad you need (a) HIS product photo (the vial URL in A6a) and (b) the competitor ad. WHEN missing → ask for it in REPLY.
A10b: Ask what performed before, who the audience is, the offer/price, the vibe. Deconstruct his ask into a concrete brief before burning credits.
A10c: After delivery → evaluate against what he wanted. If off, say in one line what you''re tweaking, regenerate or ask one sharp clarifying question.

A11: TESTS
A11a: POSITIVE "remake this competitor ad" with no product ref provided → expected [REPLY]asking for competitor image URL[/REPLY] [DONE]need-asset[/DONE].
A11b: POSITIVE "make a 9:16 nano-banana of the vial on marble" → expected [ARCADS_GENERATE]nano-banana|<prompt incl reproduce vial from first ref>|9:16|https://miscsubjects.com/img/ref/6ef8a135-5847-4239-8d0c-49f7ed8cb8b4.png||[/ARCADS_GENERATE] [REPLY]rendering ~24 credits[/REPLY] [DONE]generated[/DONE].
A11c: INVERSE pipe inside prompt → split args break. Use commas inside the prompt.

A12: TOOL CATALOG
{{TOOLS:cat=arcads}}
','agent','*',NULL,1,0,100,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('VOICE','agent','grok-4.3','bearer:GROK_API_KEY','{{SHARED}}

V1: IDENTITY
V1a: You are VOICE for miscsubjects.com, brain grok-4.3. You converse by audio over iMessage (Blooio). the owner may send you an audio message (already transcribed into the text you receive) or ask for a spoken reply.

V2: REPLY CHANNEL
V2a: To reply by VOICE → [VOICE_SEND]<chat>|<the words to speak>[/VOICE_SEND] (ACTION). The build synthesizes audio and ships an MP3 to him.
V2b: WHEN user sees ONLY what you send → [REPLY] text is also shown alongside the audio. Keep [REPLY] short (≤1 sentence) — the audio carries the content.

V3: SPEAKING STYLE
V3a: Speak how the owner speaks: plain, direct, short sentences. NEVER preamble or sign-off.
V3b: NEVER read [KEY] tags or URLs out loud. Strip them. If a URL must be conveyed, say "link in the text reply" and put the URL in [REPLY].
V3c: Numbers in spoken form: dates as "April third", money as "one hundred dollars", phone numbers digit-by-digit.

V4: TOOL DISPATCH
V4a: WHEN voice-only request that needs data → emit READ tool first (per S5b), wait, then [VOICE_SEND] next turn with the result.
V4b: WHEN voice-only request needing no tool → [VOICE_SEND]<chat>|<spoken text>[/VOICE_SEND] [REPLY]<short text>[/REPLY] [DONE]spoken[/DONE].

V5: HAND-OFFS
V5a: WHEN the actual work is terminal/creative/ops → reply in voice "handing this to <agent>" and emit [TERMINUS]/[OPS]/[ARCADS] with the full input. The next agent''s text reply will be heard via the next turn''s audio if audio mode is still on.

V6: TESTS
V6a: POSITIVE "what time is it" → [VOICE_SEND]<chat>|<spoken time>[/VOICE_SEND] [REPLY]<time>[/REPLY] [DONE]spoken[/DONE].
V6b: POSITIVE "read me my last 3 messages from Will" → [BLOOIO]list_messages|[PHONE]|3[/BLOOIO] (READ), next turn [VOICE_SEND]<chat>|<spoken summary>[/VOICE_SEND] [REPLY]<text>[/REPLY] [DONE]read[/DONE].
V6c: INVERSE voice request that needs ad generation → HAND OFF [ARCADS]<full input>[/ARCADS].

V7: TOOL CATALOG
{{TOOLS}}
','agent','*',NULL,1,0,100,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('ASK_CLAUDE','agent','claude-fable-5','bearer:ANTHROPIC_API_KEY','{{SHARED}}

ASK1: You are a second-opinion model. Answer the user''s question literally. No preamble. No sign-off.
ASK2: User''s question follows. Do NOT emit tool tags.','agent','*',NULL,1,0,100,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('ASK_GEMINI','agent','gemini-2.5-flash','bearer:GEMINI_KEY','{{SHARED}}

ASK1: You are a second-opinion model. Answer the user''s question literally. No preamble. No sign-off.
ASK2: User''s question follows. Do NOT emit tool tags.','agent','*',NULL,1,0,100,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('ASK_GPT','agent','gpt-4o','bearer:OPENAI_API_KEY','{{SHARED}}

ASK1: You are a second-opinion model. Answer the user''s question literally. No preamble. No sign-off.
ASK2: User''s question follows. Do NOT emit tool tags.','agent','*',NULL,1,0,100,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('ASK_KIMI','agent','kimi-k2.6','bearer:KIMI_API_KEY','{{SHARED}}

ASK1: You are a second-opinion model. Answer the user''s question literally. No preamble. No sign-off.
ASK2: User''s question follows. Do NOT emit tool tags.','agent','*',NULL,1,0,100,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('GW_FABLE','agent','gw:openai/gpt-4.1-mini','bearer:CLOUDFLARE_API_TOKEN','{{SHARED}}

GW1: You are a Cloudflare AI Gateway passthrough. Answer literally. No preamble.','agent','*',NULL,1,0,100,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('GW_DEEPSEEK','agent','gw:openai/gpt-4.1-mini','bearer:CLOUDFLARE_API_TOKEN','{{SHARED}}

GW1: You are a Cloudflare AI Gateway passthrough. Answer literally. No preamble.','agent','*',NULL,1,0,100,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('GW_LLAMA','agent','gw:@cf/meta/llama-3.3-70b-instruct-fp8-fast','bearer:CLOUDFLARE_API_TOKEN','{{SHARED}}

GW1: You are a Cloudflare AI Gateway passthrough. Answer literally. No preamble.','agent','*',NULL,1,0,100,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('XAI_CHAT','agent','grok-build-0.1','bearer:GROK_API_KEY','{{SHARED}}

CHAT1: You are a chat model passthrough. Answer literally. No preamble.','agent','*',NULL,1,0,100,datetime('now'));
DELETE FROM directory WHERE key='BUILDER';
DELETE FROM directory WHERE key='CODER';
DELETE FROM directory WHERE key='GRADER';
DELETE FROM directory WHERE key='GROK_AUDIT';
DELETE FROM directory WHERE key='planning-agent';
DELETE FROM directory WHERE key='SCOUT';
DELETE FROM directory WHERE key='GROK_CHAT';
DELETE FROM directory WHERE key='KIMI_CHAT';
DELETE FROM directory WHERE key='WORKERS_AI_CHAT';
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('BLOOIO','http','target_map:{"chats_list":{"method":"GET","url":"https://backend.blooio.com/v2/api/chats?limit=$1&sort=$2"},"chat_bg_del":{"method":"DELETE","url":"https://backend.blooio.com/v2/api/chats/$1/background"},"chat_bg_get":{"method":"GET","url":"https://backend.blooio.com/v2/api/chats/$1/background"},"chat_get":{"method":"GET","url":"https://backend.blooio.com/v2/api/chats/$1"},"contacts_list":{"method":"GET","url":"https://backend.blooio.com/v2/api/contacts?limit=$1&offset=$2"},"contact_caps":{"method":"GET","url":"https://backend.blooio.com/v2/api/contacts/$1/capabilities"},"contact_card_share":{"method":"POST","url":"https://backend.blooio.com/v2/api/chats/$1/contact-card"},"contact_card_update":{"method":"PUT","url":"https://backend.blooio.com/v2/api/contact-card","body":"form:name=$1"},"contact_create":{"method":"POST","url":"https://backend.blooio.com/v2/api/contacts","body":"form:identifier=$1&name=$2"},"contact_delete":{"method":"DELETE","url":"https://backend.blooio.com/v2/api/contacts/$1"},"contact_get":{"method":"GET","url":"https://backend.blooio.com/v2/api/contacts/$1"},"contact_tags_add":{"method":"POST","url":"https://backend.blooio.com/v2/api/contacts/$1/tags","body":"{\"tags\":[\"$2\"]}"},"contact_tags_list":{"method":"GET","url":"https://backend.blooio.com/v2/api/contacts/$1/tags"},"contact_tag_remove":{"method":"DELETE","url":"https://backend.blooio.com/v2/api/contacts/$1/tags/$2"},"contact_update":{"method":"PATCH","url":"https://backend.blooio.com/v2/api/contacts/$1","body":"form:name=$2"},"groups_list":{"method":"GET","url":"https://backend.blooio.com/v2/api/groups?limit=$1&offset=$2"},"group_create":{"method":"POST","url":"https://backend.blooio.com/v2/api/groups","body":"form:name=$1&chat_guid=$2&members=$3"},"group_delete":{"method":"DELETE","url":"https://backend.blooio.com/v2/api/groups/$1"},"group_get":{"method":"GET","url":"https://backend.blooio.com/v2/api/groups/$1"},"group_icon_del":{"method":"DELETE","url":"https://backend.blooio.com/v2/api/groups/$1/icon"},"group_icon_set":{"method":"POST","url":"https://backend.blooio.com/v2/api/groups/$1/icon"},"group_members_list":{"method":"GET","url":"https://backend.blooio.com/v2/api/groups/$1/members"},"group_update":{"method":"PATCH","url":"https://backend.blooio.com/v2/api/groups/$1","body":"form:name=$2"},"location_get":{"method":"GET","url":"https://backend.blooio.com/v2/api/contacts/$1/location"},"location_list":{"method":"GET","url":"https://backend.blooio.com/v2/api/contacts/$1/locations"},"location_refresh":{"method":"POST","url":"https://backend.blooio.com/v2/api/contacts/$1/location/refresh"},"lookup_batch":{"method":"POST","url":"https://backend.blooio.com/v2/api/phone-numbers/batch","body":"{\"numbers\":$1}"},"lookup_get":{"method":"GET","url":"https://backend.blooio.com/v2/api/phone-numbers/lookup?number=$1"},"lookup_post":{"method":"POST","url":"https://backend.blooio.com/v2/api/phone-numbers/lookup","body":"{\"number\":\"$1\"}"},"messages_list":{"method":"GET","url":"https://backend.blooio.com/v2/api/chats/$1/messages?limit=$2&offset=$3"},"message_get":{"method":"GET","url":"https://backend.blooio.com/v2/api/chats/$1/messages/$2"},"message_status":{"method":"GET","url":"https://backend.blooio.com/v2/api/chats/$1/messages/$2/status"},"poll_get":{"method":"GET","url":"https://backend.blooio.com/v2/api/chats/$1/polls/$2"},"poll_send":{"method":"POST","url":"https://backend.blooio.com/v2/api/chats/$1/polls","body":"{\"title\":\"$2\",\"options\":$3}"},"reaction":{"method":"POST","url":"https://backend.blooio.com/v2/api/chats/$1/messages/$2/reactions","body":"{\"reaction\":\"$3\"}"},"read":{"method":"POST","url":"https://backend.blooio.com/v2/api/chats/$1/read"},"send":{"method":"POST","url":"https://backend.blooio.com/v2/api/chats/$1/messages","body":"{\"text\":\"$2\"}"},"send_audio":{"method":"POST","url":"https://backend.blooio.com/v2/api/chats/$1/messages","body":"{\"attachments\":[\"$2\"],\"text\":\"$3\"}"},"typing_start":{"method":"POST","url":"https://backend.blooio.com/v2/api/chats/$1/typing"},"typing_stop":{"method":"DELETE","url":"https://backend.blooio.com/v2/api/chats/$1/typing"},"webhooks_list":{"method":"GET","url":"https://backend.blooio.com/v2/api/webhooks"},"webhook_create":{"method":"POST","url":"https://backend.blooio.com/v2/api/webhooks","body":"form:webhook_url=$1&webhook_type=$2&valid_until=$3"},"webhook_delete":{"method":"DELETE","url":"https://backend.blooio.com/v2/api/webhooks/$1"},"webhook_get":{"method":"GET","url":"https://backend.blooio.com/v2/api/webhooks/$1"},"webhook_logs":{"method":"GET","url":"https://backend.blooio.com/v2/api/webhooks/$1/logs?limit=$2"},"webhook_replay":{"method":"POST","url":"https://backend.blooio.com/v2/api/webhooks/$1/logs/$2/replay"},"webhook_update":{"method":"PATCH","url":"https://backend.blooio.com/v2/api/webhooks/$1","body":"form:webhook_type=$2&valid_until=$3&deprecate=$4"}}','bearer:BLOOIO_API_KEY','# WHAT: Blooio (iMessage/SMS) unified entrypoint
# WHEN_TO_USE: any iMessage/SMS send, receive, chats, contacts, groups, polls, reactions, lookups, webhooks
# ARGS: $1=op, $2..$N=positional args per op
# EX: [BLOOIO]send|[OWNER_PHONE]|hello[/BLOOIO]
# TESTS:
# POSITIVE: {"key":"BLOOIO","body":"chats_list|5|recent"} → HTTP 200, JSON array.
# INVERSE: {"key":"BLOOIO","body":"nope"} → starts with ERR:target_map:unknown_op
','blooio',NULL,NULL,1,1,50,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('CF','http','target_map:{"access_apps":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/access/apps"},"accounts_list":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts"},"ai_models":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/ai/models/search?per_page=100"},"ai_run":{"method":"POST","url":"https://api.cloudflare.com/client/v4/accounts/$1/ai/run/$2","body":"$3"},"analytics_dash":{"method":"GET","url":"https://api.cloudflare.com/client/v4/zones/$1/analytics/dashboard"},"cache_purge":{"method":"POST","url":"https://api.cloudflare.com/client/v4/zones/$1/purge_cache","body":"$2"},"d1_get":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/d1/database/$2"},"d1_list":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/d1/database"},"d1_query_remote":{"method":"POST","url":"https://api.cloudflare.com/client/v4/accounts/$1/d1/database/$2/query","body":"$3"},"dns_create":{"method":"POST","url":"https://api.cloudflare.com/client/v4/zones/$1/dns_records","body":"{\"type\":\"$2\",\"name\":\"$3\",\"content\":\"$4\",\"ttl\":$5,\"proxied\":$6}"},"dns_delete":{"method":"DELETE","url":"https://api.cloudflare.com/client/v4/zones/$1/dns_records/$2"},"dns_list":{"method":"GET","url":"https://api.cloudflare.com/client/v4/zones/$1/dns_records?per_page=100"},"dns_update":{"method":"PUT","url":"https://api.cloudflare.com/client/v4/zones/$1/dns_records/$2","body":"{\"type\":\"$3\",\"name\":\"$4\",\"content\":\"$5\",\"ttl\":$6,\"proxied\":$7}"},"email_routing":{"method":"GET","url":"https://api.cloudflare.com/client/v4/zones/$1/email/routing/rules"},"hyperdrive_list":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/hyperdrive/configs"},"images_list":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/images/v1"},"kv_bulk_write":{"method":"PUT","url":"https://api.cloudflare.com/client/v4/accounts/$1/storage/kv/namespaces/$2/bulk","body":"$3"},"kv_create_ns":{"method":"POST","url":"https://api.cloudflare.com/client/v4/accounts/$1/storage/kv/namespaces","body":"form:title=$2"},"kv_delete_ns":{"method":"DELETE","url":"https://api.cloudflare.com/client/v4/accounts/$1/storage/kv/namespaces/$2"},"kv_list_keys":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/storage/kv/namespaces/$2/keys"},"kv_list_ns":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/storage/kv/namespaces"},"logpush_jobs":{"method":"GET","url":"https://api.cloudflare.com/client/v4/zones/$1/logpush/jobs"},"pages_deployments":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/pages/projects/$2/deployments"},"pages_deploy_retry":{"method":"POST","url":"https://api.cloudflare.com/client/v4/accounts/$1/pages/projects/$2/deployments/$3/retry"},"pages_get":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/pages/projects/$2"},"pages_list":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/pages/projects"},"pages_patch":{"method":"PATCH","url":"https://api.cloudflare.com/client/v4/accounts/$1/pages/projects/$2","body":"$3"},"queues_list":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/queues"},"r2_create_bucket":{"method":"POST","url":"https://api.cloudflare.com/client/v4/accounts/$1/r2/buckets","body":"{\"name\":\"$2\",\"locationHint\":\"$3\"}"},"r2_delete_bucket":{"method":"DELETE","url":"https://api.cloudflare.com/client/v4/accounts/$1/r2/buckets/$2"},"r2_list_buckets":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/r2/buckets"},"secrets_create":{"method":"POST","url":"https://api.cloudflare.com/client/v4/accounts/$1/secrets_store/stores/$2/secrets","body":"$3"},"secrets_list":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/secrets_store/stores/$2/secrets?per_page=100"},"secrets_stores":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/secrets_store/stores"},"stream_list":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/stream"},"tokens_verify":{"method":"GET","url":"https://api.cloudflare.com/client/v4/user/tokens/verify"},"token_verify":{"method":"GET","url":"https://api.cloudflare.com/client/v4/user/tokens/verify"},"tunnels_list":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/cfd_tunnel"},"user":{"method":"GET","url":"https://api.cloudflare.com/client/v4/user"},"vectorize_list":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/vectorize/v2/indexes"},"verify":{"method":"GET","url":"https://api.cloudflare.com/client/v4/user/tokens/verify"},"workers_list":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/workers/scripts"},"worker_delete":{"method":"DELETE","url":"https://api.cloudflare.com/client/v4/accounts/$1/workers/scripts/$2"},"worker_deployments":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/workers/scripts/$2/deployments"},"worker_get":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/workers/scripts/$2"},"worker_list":{"method":"GET","url":"https://api.cloudflare.com/client/v4/accounts/$1/workers/scripts"},"worker_routes":{"method":"GET","url":"https://api.cloudflare.com/client/v4/zones/$1/workers/routes"},"zones_list":{"method":"GET","url":"https://api.cloudflare.com/client/v4/zones"},"zone_get":{"method":"GET","url":"https://api.cloudflare.com/client/v4/zones/$1"}}','bearer:CLOUDFLARE_API_TOKEN','# WHAT: Cloudflare REST unified entrypoint
# WHEN_TO_USE: any Cloudflare API call: account, zones, workers, pages, KV, R2, DNS, AI, tokens
# ARGS: $1=op, $2..$N=positional args
# EX: [CF]user[/CF]
# TESTS:
# POSITIVE: {"key":"CF","body":"user"} → HTTP 200 with email.
# INVERSE: {"key":"CF","body":"xxx"} → starts with ERR:target_map:unknown_op
','cloudflare',NULL,NULL,1,1,50,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('STRIPE_READ','http','target_map:{"account":{"method":"GET","url":"https://api.stripe.com/v1/account"},"balance":{"method":"GET","url":"https://api.stripe.com/v1/balance"},"balance_tx_list":{"method":"GET","url":"https://api.stripe.com/v1/balance_transactions?limit=$1"},"charges_list":{"method":"GET","url":"https://api.stripe.com/v1/charges?limit=$1"},"charge_get":{"method":"GET","url":"https://api.stripe.com/v1/charges/$1"},"customers_list":{"method":"GET","url":"https://api.stripe.com/v1/customers?limit=$1"},"customer_get":{"method":"GET","url":"https://api.stripe.com/v1/customers/$1"},"customer_search":{"method":"GET","url":"https://api.stripe.com/v1/customers/search?query=$1"},"events_list":{"method":"GET","url":"https://api.stripe.com/v1/events?limit=$1"},"invoices_list":{"method":"GET","url":"https://api.stripe.com/v1/invoices?limit=$1"},"invoice_get":{"method":"GET","url":"https://api.stripe.com/v1/invoices/$1"},"invoice_items_list":{"method":"GET","url":"https://api.stripe.com/v1/invoiceitems?customer=$1&limit=$2"},"payment_links_list":{"method":"GET","url":"https://api.stripe.com/v1/payment_links?limit=$1"},"payouts_list":{"method":"GET","url":"https://api.stripe.com/v1/payouts?limit=$1"},"payout_get":{"method":"GET","url":"https://api.stripe.com/v1/payouts/$1"},"pi_get":{"method":"GET","url":"https://api.stripe.com/v1/payment_intents/$1"},"pi_list":{"method":"GET","url":"https://api.stripe.com/v1/payment_intents?limit=$1"},"prices_list":{"method":"GET","url":"https://api.stripe.com/v1/prices?limit=$1"},"price_get":{"method":"GET","url":"https://api.stripe.com/v1/prices/$1"},"products_list":{"method":"GET","url":"https://api.stripe.com/v1/products?limit=$1"},"product_get":{"method":"GET","url":"https://api.stripe.com/v1/products/$1"},"refunds_list":{"method":"GET","url":"https://api.stripe.com/v1/refunds?limit=$1"},"subscriptions_list":{"method":"GET","url":"https://api.stripe.com/v1/subscriptions?limit=$1"},"subscription_get":{"method":"GET","url":"https://api.stripe.com/v1/subscriptions/$1"}}','basic:STRIPE_SECRET_KEY','# WHAT: Stripe READ-only unified entrypoint
# WHEN_TO_USE: any Stripe GET: balance, customers, invoices, charges, payouts, prices, products
# ARGS: $1=op, $2..$N=positional args
# EX: [STRIPE_READ]balance[/STRIPE_READ]
# TESTS:
# POSITIVE: {"key":"STRIPE_READ","body":"balance"} → HTTP 200 livemode=true.
# INVERSE: {"key":"STRIPE_READ","body":"xxx"} → ERR:target_map:unknown_op
','stripe',NULL,NULL,1,1,50,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('STRIPE_WRITE','http','target_map:{"customer_create":{"method":"POST","url":"https://api.stripe.com/v1/customers","body":"form:email=$1&name=$2&phone=$3"},"customer_delete":{"method":"DELETE","url":"https://api.stripe.com/v1/customers/$1"},"customer_update":{"method":"POST","url":"https://api.stripe.com/v1/customers/$1","body":"form:email=$2&name=$3&phone=$4"},"invoice_create":{"method":"POST","url":"https://api.stripe.com/v1/invoices","body":"form:customer=$1&collection_method=send_invoice&days_until_due=$2&description=$3"},"invoice_delete":{"method":"DELETE","url":"https://api.stripe.com/v1/invoices/$1"},"invoice_finalize":{"method":"POST","url":"https://api.stripe.com/v1/invoices/$1/finalize"},"invoice_item_create":{"method":"POST","url":"https://api.stripe.com/v1/invoiceitems","body":"form:customer=$1&amount=$2&currency=$3&description=$4"},"invoice_item_delete":{"method":"DELETE","url":"https://api.stripe.com/v1/invoiceitems/$1"},"invoice_mark_uncollectible":{"method":"POST","url":"https://api.stripe.com/v1/invoices/$1/mark_uncollectible"},"invoice_pay":{"method":"POST","url":"https://api.stripe.com/v1/invoices/$1/pay"},"invoice_send":{"method":"POST","url":"https://api.stripe.com/v1/invoices/$1/send"},"invoice_update":{"method":"POST","url":"https://api.stripe.com/v1/invoices/$1","body":"form:description=$2"},"invoice_void":{"method":"POST","url":"https://api.stripe.com/v1/invoices/$1/void"},"payment_link_create":{"method":"POST","url":"https://api.stripe.com/v1/payment_links","body":"form:line_items[0][price]=$1&line_items[0][quantity]=$2"},"pi_create":{"method":"POST","url":"https://api.stripe.com/v1/payment_intents","body":"form:amount=$1&currency=$2&customer=$3&description=$4"},"price_create":{"method":"POST","url":"https://api.stripe.com/v1/prices","body":"form:product=$1&unit_amount=$2&currency=$3"},"product_create":{"method":"POST","url":"https://api.stripe.com/v1/products","body":"form:name=$1&description=$2"},"refund_create":{"method":"POST","url":"https://api.stripe.com/v1/refunds","body":"form:charge=$1&amount=$2"},"subscription_cancel":{"method":"DELETE","url":"https://api.stripe.com/v1/subscriptions/$1"}}','basic:STRIPE_SECRET_KEY','# WHAT: Stripe WRITE unified entrypoint — GATED
# WHEN_TO_USE: only after the owner says "go ahead and <verb>". POST/PATCH/DELETE on Stripe
# ARGS: $1=op, $2..$N=positional args
# EX: [STRIPE_WRITE]invoice_void|in_xyz[/STRIPE_WRITE]
# TESTS:
# INVERSE: {"key":"STRIPE_WRITE","body":"xxx"} → ERR:target_map:unknown_op
','stripe',NULL,NULL,1,1,50,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('ARCADS_ROUTES','http','target_map:{"actors":{"method":"GET","url":"https://external-api.arcads.ai/v1/actors?page=1&pageSize=50"},"asset_get":{"method":"GET","url":"https://external-api.arcads.ai/v1/assets/$1"},"asset_watch":{"method":"GET","url":"https://external-api.arcads.ai/v1/assets/$1/watch"},"image_raw":{"method":"POST","url":"https://external-api.arcads.ai/v2/images/generate","body":"$1"},"presets":{"method":"GET","url":"https://external-api.arcads.ai/v1/presets"},"products":{"method":"GET","url":"https://external-api.arcads.ai/v1/products?page=1&pageSize=50"},"situations":{"method":"GET","url":"https://external-api.arcads.ai/v1/situations?page=1&pageSize=50"},"video_raw":{"method":"POST","url":"https://external-api.arcads.ai/v2/videos/generate","body":"$1"}}','headers:{"Authorization":"$ARCADS_BASIC_AUTH","Accept":"application/json","Content-Type":"application/json"}','# WHAT: ArcAds HTTP unified entrypoint
# WHEN_TO_USE: direct ArcAds REST ops (presigned uploads, products, assets, situations, fields)
# ARGS: $1=op, $2..$N=positional args
# EX: [ARCADS_ROUTES]products[/ARCADS_ROUTES]
# TESTS:
# POSITIVE: {"key":"ARCADS_ROUTES","body":"products"} → HTTP 200.
# INVERSE: {"key":"ARCADS_ROUTES","body":"xxx"} → ERR:target_map:unknown_op
','arcads',NULL,NULL,1,1,50,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('GITHUB','http','target_map:{"get_file":{"method":"GET","url":"githubFile","body":"[\"$1\"]"},"list_tree":{"method":"GET","url":"https://api.github.com/repos/[OWNER_HANDLE]/miscsubjects-pages/git/trees/main?recursive=1"},"repo_dispatch":{"method":"POST","url":"https://api.github.com/repos/$1/dispatches","body":"{\"event_type\":\"$2\",\"client_payload\":$3}"},"repo_get":{"method":"GET","url":"https://api.github.com/repos/$1"},"search_code":{"method":"GET","url":"https://api.github.com/search/code?q=$1+repo:[OWNER_HANDLE]/miscsubjects-pages"},"user":{"method":"GET","url":"https://api.github.com/user"}}','headers:{"Authorization":"Bearer $GITHUB_TOKEN","User-Agent":"miscsubjects-build","Accept":"application/vnd.github+json"}','# WHAT: GitHub REST unified entrypoint
# WHEN_TO_USE: user, repos, files, dispatch, list trees
# ARGS: $1=op, $2..$N=args
# EX: [GITHUB]user[/GITHUB]
# TESTS:
# POSITIVE: {"key":"GITHUB","body":"user"} → HTTP 200.
# INVERSE: {"key":"GITHUB","body":"xxx"} → ERR:target_map:unknown_op
','github',NULL,NULL,1,1,50,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('META','http','target_map:{"ad_accounts":{"method":"GET","url":"https://graph.facebook.com/v22.0/$1/adaccounts"},"campaigns":{"method":"GET","url":"https://graph.facebook.com/v22.0/$1/campaigns?fields=name,status,objective,daily_budget"},"capi_post":{"method":"POST","url":"https://graph.facebook.com/v22.0/27209526152071970/events","body":"{\"data\":[{\"event_name\":\"$1\",\"event_time\":$2,\"event_id\":\"$3\",\"event_source_url\":\"$4\",\"action_source\":\"website\",\"user_data\":{\"client_ip_address\":\"$5\",\"client_user_agent\":\"$6\"}}]}"},"me":{"method":"GET","url":"https://graph.facebook.com/v22.0/me"}}','query:access_token=META_ACCESS_TOKEN','# WHAT: Meta Graph API unified entrypoint
# WHEN_TO_USE: Meta account, pages, ads, CAPI events
# ARGS: $1=op, $2..$N=args
# EX: [META]me[/META]
# TESTS:
# POSITIVE/INVERSE per op key. ERR:target_map:unknown_op on bad op.
','meta',NULL,NULL,1,1,50,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('KLAVIYO','http','target_map:{"events":{"method":"GET","url":"https://a.klaviyo.com/api/events/?page[size]=$1"},"profiles":{"method":"GET","url":"https://a.klaviyo.com/api/profiles/?page%5Bsize%5D=20"}}','headers:{"Authorization":"Klaviyo-API-Key $KLAVIYO_KEY","revision":"2024-10-15","Accept":"application/json"}','# WHAT: Klaviyo unified entrypoint
# WHEN_TO_USE: profiles, segments, events, lists
# ARGS: $1=op, $2..$N=args
# EX: [KLAVIYO]profiles[/KLAVIYO]
# TESTS:
# INVERSE: ERR:target_map:unknown_op on bad op.
','klaviyo',NULL,NULL,1,1,50,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('BC','http','target_map:{"orders":{"method":"GET","url":"https://api.bigcommerce.com/stores/$BIGCOMMERCE_STORE_HASH/v2/orders?limit=$1"},"products":{"method":"GET","url":"https://api.bigcommerce.com/stores/$BIGCOMMERCE_STORE_HASH/v3/catalog/products?limit=$1"}}','headers:{"X-Auth-Token":"$BIGCOMMERCE_TOKEN","Accept":"application/json"}','# WHAT: BigCommerce unified entrypoint
# WHEN_TO_USE: products, orders, customers
# ARGS: $1=op, $2..$N=args
# EX: [BC]products[/BC]
# TESTS:
# INVERSE: ERR:target_map:unknown_op on bad op.
','bigcommerce',NULL,NULL,1,1,50,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('TW','http','target_map:{"attribution":{"method":"POST","url":"https://api.triplewhale.com/api/v2/attribution/get-orders-with-journeys-v2","body":"{\"shop\":\"$1\",\"startDate\":\"$2\",\"endDate\":\"$3\",\"timezone\":\"America/Los_Angeles\"}"}}','headers:{"x-api-key":"$TRIPLEWHALE_API_KEY","Content-Type":"application/json"}','# WHAT: TripleWhale unified entrypoint
# WHEN_TO_USE: attribution
# ARGS: $1=op
# EX: [TW]attribution[/TW]
# TESTS:
# INVERSE: ERR:target_map:unknown_op on bad op.
','triplewhale',NULL,NULL,1,1,50,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES ('MCP','http','target_map:{"add":{"method":"POST","url":"https://agent.cannibal.capital/exec","body":"{\"cmd\":\"sh\",\"args\":[\"-lc\",\"~/.grok/bin/grok mcp add $1 --command $2 --args $3+ 2>&1\"],\"timeout\":120000}"},"brave_search":{"method":"GET","url":"noop","body":"[\"MCP_BRAVE_SEARCH not wired. Needs BRAVE_API_KEY. Grok web_search already covers this.\"]"},"computer_use":{"method":"GET","url":"noop","body":"[\"MCP_COMPUTER_USE not wired. Needs ANTHROPIC_API_KEY + VM. DESKTOP_* rows cover the Mac.\"]"},"doctor":{"method":"POST","url":"https://agent.cannibal.capital/exec","body":"{\"cmd\":\"sh\",\"args\":[\"-lc\",\"~/.grok/bin/grok mcp doctor $1 2>&1\"],\"timeout\":120000}"},"fetch":{"method":"GET","url":"noop","body":"[\"MCP_FETCH not wired. Run [MCP_PROBE]fetch|npx -y @modelcontextprotocol/server-fetch[/MCP_PROBE]. BROWSER_FETCH already fetches URLs.\"]"},"fs":{"method":"GET","url":"noop","body":"[\"MCP_FS not wired. Run [MCP_PROBE]fs|npx -y @modelcontextprotocol/server-filesystem /Users/owner[/MCP_PROBE]. LOCAL_READ/LOCAL_WRITE/LOCAL_LIST already cover files.\"]"},"github":{"method":"GET","url":"noop","body":"[\"MCP_GITHUB not wired. Run [MCP_PROBE]github|npx -y @modelcontextprotocol/server-github[/MCP_PROBE]. CLI_GH + GITHUB_* rows already cover GitHub.\"]"},"list":{"method":"POST","url":"https://agent.cannibal.capital/exec","body":"{\"cmd\":\"sh\",\"args\":[\"-lc\",\"~/.grok/bin/grok mcp list 2>&1\"],\"timeout\":60000}"},"memory":{"method":"GET","url":"noop","body":"[\"MCP_MEMORY not wired. Run [MCP_PROBE]memory|npx -y @modelcontextprotocol/server-memory[/MCP_PROBE]. KV_* rows already persist state.\"]"},"playwright":{"method":"GET","url":"noop","body":"[\"MCP_PLAYWRIGHT not wired. Run [MCP_PROBE]playwright|npx -y @playwright/mcp[/MCP_PROBE]. BROWSER_PLAYWRIGHT covers one-shot use.\"]"},"probe":{"method":"GET","url":"","body":"MCP_ADD:$1|$2|$3+ > MCP_TEST:$1 > SCOUT:Here is grok mcp doctor output for the MCP server named $1. For each tool it exposes, ADD_ROW a row keyed MCP_$1_<tool> that invokes it, then report what you added in REPLY. Output follows. $PREV"},"sequential":{"method":"GET","url":"noop","body":"[\"MCP_SEQUENTIAL not wired. Run [MCP_PROBE]seq|npx -y @modelcontextprotocol/server-sequential-thinking[/MCP_PROBE].\"]"},"test":{"method":"POST","url":"https://agent.cannibal.capital/exec","body":"{\"cmd\":\"sh\",\"args\":[\"-lc\",\"~/.grok/bin/grok mcp doctor $1 2>&1\"],\"timeout\":120000}"},"context7_query_docs":{"method":"POST","url":"https://mcp.context7.com/mcp","body":"{\"method\":\"tools/call\",\"params\":{\"name\":\"query-docs\",\"arguments\":{\"libraryId\":\"$1\",\"query\":\"$2\"}}}"},"context7_resolve_library_id":{"method":"POST","url":"https://mcp.context7.com/mcp","body":"{\"method\":\"tools/call\",\"params\":{\"name\":\"resolve-library-id\",\"arguments\":{\"query\":\"$1\",\"libraryName\":\"$2\"}}}"}}','headers:{"x-terminal-key":"$TERMINAL_KEY"}','# WHAT: MCP server unified entrypoint via Mac bridge
# WHEN_TO_USE: MCP servers (brave_search, computer_use, doctor, fetch, etc.)
# ARGS: $1=op, $2..$N=args
# EX: [MCP]fetch|https://example.com[/MCP]
# TESTS:
# INVERSE: ERR:target_map:unknown_op on bad op.
','mcp',NULL,NULL,1,1,50,datetime('now'));
DELETE FROM directory WHERE key IN ('BLOOIO_CHATS_LIST','BLOOIO_CHAT_BG_DEL','BLOOIO_CHAT_BG_GET','BLOOIO_CHAT_GET','BLOOIO_CONTACTS_LIST','BLOOIO_CONTACT_CAPS','BLOOIO_CONTACT_CARD_SHARE','BLOOIO_CONTACT_CARD_UPDATE','BLOOIO_CONTACT_CREATE','BLOOIO_CONTACT_DELETE','BLOOIO_CONTACT_GET','BLOOIO_CONTACT_TAGS_ADD','BLOOIO_CONTACT_TAGS_LIST','BLOOIO_CONTACT_TAG_REMOVE','BLOOIO_CONTACT_UPDATE','BLOOIO_GROUPS_LIST','BLOOIO_GROUP_CREATE','BLOOIO_GROUP_DELETE','BLOOIO_GROUP_GET','BLOOIO_GROUP_ICON_DEL','BLOOIO_GROUP_ICON_SET','BLOOIO_GROUP_MEMBERS_LIST','BLOOIO_GROUP_UPDATE','BLOOIO_LOCATION_GET','BLOOIO_LOCATION_LIST','BLOOIO_LOCATION_REFRESH','BLOOIO_LOOKUP_BATCH','BLOOIO_LOOKUP_GET','BLOOIO_LOOKUP_POST','BLOOIO_MESSAGES_LIST','BLOOIO_MESSAGE_GET','BLOOIO_MESSAGE_STATUS','BLOOIO_POLL_GET','BLOOIO_POLL_SEND','BLOOIO_REACTION','BLOOIO_READ','BLOOIO_SEND','BLOOIO_SEND_AUDIO','BLOOIO_TYPING_START','BLOOIO_TYPING_STOP','BLOOIO_WEBHOOKS_LIST','BLOOIO_WEBHOOK_CREATE','BLOOIO_WEBHOOK_DELETE','BLOOIO_WEBHOOK_GET','BLOOIO_WEBHOOK_LOGS','BLOOIO_WEBHOOK_REPLAY','BLOOIO_WEBHOOK_UPDATE','CF_ACCESS_APPS','CF_ACCOUNTS_LIST','CF_AI_MODELS');
DELETE FROM directory WHERE key IN ('CF_AI_RUN','CF_ANALYTICS_DASH','CF_CACHE_PURGE','CF_D1_GET','CF_D1_LIST','CF_D1_QUERY_REMOTE','CF_DNS_CREATE','CF_DNS_DELETE','CF_DNS_LIST','CF_DNS_UPDATE','CF_EMAIL_ROUTING','CF_HYPERDRIVE_LIST','CF_IMAGES_LIST','CF_KV_BULK_WRITE','CF_KV_CREATE_NS','CF_KV_DELETE_NS','CF_KV_LIST_KEYS','CF_KV_LIST_NS','CF_LOGPUSH_JOBS','CF_PAGES_DEPLOYMENTS','CF_PAGES_DEPLOY_RETRY','CF_PAGES_GET','CF_PAGES_LIST','CF_PAGES_PATCH','CF_QUEUES_LIST','CF_R2_CREATE_BUCKET','CF_R2_DELETE_BUCKET','CF_R2_LIST_BUCKETS','CF_SECRETS_CREATE','CF_SECRETS_LIST','CF_SECRETS_STORES','CF_STREAM_LIST','CF_TOKENS_VERIFY','CF_TOKEN_VERIFY','CF_TUNNELS_LIST','CF_USER','CF_VECTORIZE_LIST','CF_VERIFY','CF_WORKERS_LIST','CF_WORKER_DELETE','CF_WORKER_DEPLOYMENTS','CF_WORKER_GET','CF_WORKER_LIST','CF_WORKER_ROUTES','CF_ZONES_LIST','CF_ZONE_GET','STRIPE_ACCOUNT','STRIPE_BALANCE','STRIPE_BALANCE_TX_LIST','STRIPE_CHARGES_LIST');
DELETE FROM directory WHERE key IN ('STRIPE_CHARGE_GET','STRIPE_CUSTOMERS_LIST','STRIPE_CUSTOMER_GET','STRIPE_CUSTOMER_SEARCH','STRIPE_EVENTS_LIST','STRIPE_INVOICES_LIST','STRIPE_INVOICE_GET','STRIPE_INVOICE_ITEMS_LIST','STRIPE_PAYMENT_LINKS_LIST','STRIPE_PAYOUTS_LIST','STRIPE_PAYOUT_GET','STRIPE_PI_GET','STRIPE_PI_LIST','STRIPE_PRICES_LIST','STRIPE_PRICE_GET','STRIPE_PRODUCTS_LIST','STRIPE_PRODUCT_GET','STRIPE_REFUNDS_LIST','STRIPE_SUBSCRIPTIONS_LIST','STRIPE_SUBSCRIPTION_GET','STRIPE_CUSTOMER_CREATE','STRIPE_CUSTOMER_DELETE','STRIPE_CUSTOMER_UPDATE','STRIPE_INVOICE_CREATE','STRIPE_INVOICE_DELETE','STRIPE_INVOICE_FINALIZE','STRIPE_INVOICE_ITEM_CREATE','STRIPE_INVOICE_ITEM_DELETE','STRIPE_INVOICE_MARK_UNCOLLECTIBLE','STRIPE_INVOICE_PAY','STRIPE_INVOICE_SEND','STRIPE_INVOICE_UPDATE','STRIPE_INVOICE_VOID','STRIPE_PAYMENT_LINK_CREATE','STRIPE_PI_CREATE','STRIPE_PRICE_CREATE','STRIPE_PRODUCT_CREATE','STRIPE_REFUND_CREATE','STRIPE_SUBSCRIPTION_CANCEL','ARCADS_ACTORS','ARCADS_ASSET_GET','ARCADS_ASSET_WATCH','ARCADS_IMAGE_RAW','ARCADS_PRESETS','ARCADS_PRODUCTS','ARCADS_SITUATIONS','ARCADS_VIDEO_RAW','GITHUB_GET_FILE','GITHUB_LIST_TREE','GITHUB_REPO_DISPATCH');
DELETE FROM directory WHERE key IN ('GITHUB_REPO_GET','GITHUB_SEARCH_CODE','GITHUB_USER','META_AD_ACCOUNTS','META_CAMPAIGNS','META_CAPI_POST','META_ME','KLAVIYO_EVENTS','KLAVIYO_PROFILES','BC_ORDERS','BC_PRODUCTS','TW_ATTRIBUTION','MCP_ADD','MCP_BRAVE_SEARCH','MCP_COMPUTER_USE','MCP_DOCTOR','MCP_FETCH','MCP_FS','MCP_GITHUB','MCP_LIST','MCP_MEMORY','MCP_PLAYWRIGHT','MCP_PROBE','MCP_SEQUENTIAL','MCP_TEST','MCP_CONTEXT7_QUERY_DOCS','MCP_CONTEXT7_RESOLVE_LIBRARY_ID');