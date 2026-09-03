-- 2026-06-12 — seed the phone surface, builder queue, threads, and the missing CLI rows.
-- All inserts use INSERT OR REPLACE so re-running the migration is idempotent.

-- ────────────────────────────────────────────────────────────────────────────
-- PHONE_* rows
-- ────────────────────────────────────────────────────────────────────────────

-- PHONE_NOTIFY: send a push to the owner's phone. Uses BLOOIO_SEND under the hood (iMessage = the live channel).
-- ARGS: title|body. EX: PHONE_NOTIFY "deploy ready"|"approve at /admin/approvals/12"
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('PHONE_NOTIFY', 'flow', '', '',
'# WHAT: send a push to the owner''s phone via iMessage.
# WHEN_TO_USE: an agent finished a task, hit a milestone, or needs eyes on something.
# ARGS: title|body. Multi-line body OK.
# EX: PHONE_NOTIFY "deploy done"|"see https://miscsubjects.com"
# TESTS: should arrive on [OWNER_PHONE] as an iMessage starting with "🔔 $1".
BLOOIO_SEND:[OWNER_PHONE]|🔔 $1\n$2', 'phone', NULL, datetime('now'));

-- PHONE_APPROVAL_CREATE: open an approval gate. Inserts into approvals + notifies phone.
-- ARGS: action|summary|resume_key|resume_body. EX: "deploy|wrangler pages deploy public|LOCAL_EXEC|cd /Users/... && npx wrangler ..."
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('PHONE_APPROVAL_CREATE', 'fn', 'approvalCreate', '',
'# WHAT: insert a row into `approvals` (status=pending) and notify the owner''s phone.
# WHEN_TO_USE: about to do something destructive (deploy, send outreach, delete, pay) — pause first.
# ARGS: action|summary|resume_key|resume_body. resume_key + body are dispatched on approve.
# EX: PHONE_APPROVAL_CREATE deploy|prod deploy of miscsubjects-pages|LOCAL_EXEC|cd /Users/owner/miscsubjects-pages && npx wrangler pages deploy public --project-name loop-safe-miscsubjects --commit-dirty=true
# TESTS: row in approvals with status=pending; iMessage arrives with id + Approve/Deny instructions.
["$1","$2","$3","$4"]', 'phone', NULL, datetime('now'));

-- PHONE_APPROVAL_RESOLVE: settle an approval (called from phone or /api/phone/in approval action).
-- ARGS: approval_id|decision (approve|deny). On approve, dispatches resume_key with resume_body.
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('PHONE_APPROVAL_RESOLVE', 'fn', 'approvalResolve', '',
'# WHAT: update approvals.status to approved/denied and, on approve, dispatch the stored resume_key.
# WHEN_TO_USE: phone tap, /admin/approvals click, or natural-language "approve 12".
# ARGS: approval_id|decision (approve|deny).
# EX: PHONE_APPROVAL_RESOLVE 12|approve
# TESTS: approvals.status flips; if approve, the resume dispatch returns a real trace.
["$1","$2"]', 'phone', NULL, datetime('now'));

-- PHONE_VOICE_NOTE_HANDLE: phone voice memo URL → STT → ROUTER (so the build acts on the spoken text).
-- ARGS: voice_url. EX: https://r2.example.com/voice/2026-06-12.m4a
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('PHONE_VOICE_NOTE_HANDLE', 'flow', '', '',
'# WHAT: transcribe a phone voice memo and route the transcript through ROUTER like an iMessage.
# WHEN_TO_USE: /api/phone/in receives action=voice_note from an iOS Shortcut.
# ARGS: voice_url.
# EX: PHONE_VOICE_NOTE_HANDLE https://miscsubjects.com/img/gen/foo.m4a
# TESTS: ROUTER receives "[channel ios_shortcut 1:1 ...] Now: (voice memo) <transcript>" and replies.
GROK_STT:$1 => transcript > ROUTER:[channel ios_shortcut 1:1 · from the owner ([OWNER_PHONE])]\nNow: (voice memo) $transcript', 'phone', NULL, datetime('now'));

-- PHONE_SHARE_URL_HANDLE: phone shared a URL via the Share Sheet → fetch markdown + route.
-- ARGS: text|url.
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('PHONE_SHARE_URL_HANDLE', 'flow', '', '',
'# WHAT: phone shared a URL via the Share Sheet — fetch its markdown and route to ROUTER as a normal turn.
# WHEN_TO_USE: /api/phone/in receives action=share_url.
# ARGS: text|url.
# EX: PHONE_SHARE_URL_HANDLE "interesting"|https://example.com/article
# TESTS: ROUTER receives a turn with the markdown body inlined and decides what to do.
BROWSER_MARKDOWN:$2 => md > ROUTER:[channel ios_shortcut 1:1 · from the owner ([OWNER_PHONE])]\nNow: (shared URL: $2) $1\n\n$md', 'phone', NULL, datetime('now'));

-- PHONE_SHARE_TEXT_HANDLE / PHONE_SHARE_IMAGE_HANDLE / PHONE_CLIPBOARD_HANDLE / PHONE_LOCATION_HANDLE / SHORTCUT_RUN
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('PHONE_SHARE_TEXT_HANDLE', 'flow', '', '',
'# WHAT: phone shared selected text — route straight to ROUTER as if the owner had typed it.
# WHEN_TO_USE: /api/phone/in action=share_text.
# ARGS: text.
# EX: PHONE_SHARE_TEXT_HANDLE "remind me to follow up with Will Friday"
# TESTS: ROUTER replies (or routes to BUILDER_ADD / THREAD_ADD as appropriate).
ROUTER:[channel ios_shortcut 1:1 · from the owner ([OWNER_PHONE])]\nNow: $1', 'phone', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('PHONE_SHARE_IMAGE_HANDLE', 'flow', '', '',
'# WHAT: phone shared an image — store as reference + route image URL through ROUTER (ARCADS picks it up).
# WHEN_TO_USE: /api/phone/in action=share_image or action=photo.
# ARGS: image_url|caption.
# EX: PHONE_SHARE_IMAGE_HANDLE https://example.com/competitor-ad.png|"competitor ad — copy idea"
# TESTS: ARCADS sees the URL and treats it as a reference image.
STORE_REF_IMAGE:$1 => ref > ROUTER:[channel ios_shortcut 1:1 · from the owner ([OWNER_PHONE])]\nNow: $2\nImages I just sent (URLs; first = my product unless I say otherwise): $1', 'phone', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('PHONE_CLIPBOARD_HANDLE', 'flow', '', '',
'# WHAT: phone clipboard contents → ROUTER. Same shape as share_text but explicitly tagged.
# WHEN_TO_USE: /api/phone/in action=clipboard.
# ARGS: clipboard_text.
ROUTER:[channel ios_shortcut 1:1 · from the owner ([OWNER_PHONE])]\nNow: (from clipboard) $1', 'phone', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('PHONE_LOCATION_HANDLE', 'flow', '', '',
'# WHAT: phone location event → ROUTER. ARGS: location_label (e.g. "arrived: home").
# WHEN_TO_USE: /api/phone/in action=location, NFC tap, geofence trigger.
# ARGS: location_label.
ROUTER:[channel ios_shortcut 1:1 · from the owner ([OWNER_PHONE])]\nNow: (location event) $1', 'phone', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('SHORTCUT_RUN', 'flow', '', '',
'# WHAT: catch-all for iOS Shortcuts that pass arbitrary JSON. Route to ROUTER.
# WHEN_TO_USE: /api/phone/in action=shortcut_run.
# ARGS: payload_json.
ROUTER:[channel ios_shortcut 1:1 · from the owner ([OWNER_PHONE])]\nNow: (shortcut) $1', 'phone', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('PHONE_EVENTS_TAIL', 'http', 'GET /api/dispatch?info=1', '',
'# WHAT: tail the phone_events table. ARGS: limit (default 20).
# WHEN_TO_USE: "what did my phone send today".
["$1"]', 'phone', NULL, datetime('now'));

-- ────────────────────────────────────────────────────────────────────────────
-- BUILDER queue rows
-- ────────────────────────────────────────────────────────────────────────────

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('BUILDER_ADD', 'fn', 'builderAdd', '',
'# WHAT: append a row to builder_queue. status defaults to "idea", priority to 5.
# WHEN_TO_USE: the owner says "I want to build X" or "track X" or anything that should become work.
# ARGS: title|body|priority(1-9, default 5).
# EX: BUILDER_ADD "iOS share-sheet shortcut"|"create a Shortcut that POSTs the current Safari URL to /api/phone/in with action=share_url"|3
# TESTS: builder_queue grows by 1; SELECT id, title, status FROM builder_queue ORDER BY id DESC LIMIT 1 returns the new row.
["$1","$2","$3"]', 'builder', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('BUILDER_LIST', 'fn', 'builderList', '',
'# WHAT: return the current builder queue as JSON, sorted by priority. ARGS: optional status filter (idea|queued|in_progress|blocked|done|wont).
# WHEN_TO_USE: "what am I building", "show me the queue", "what''s next".
# ARGS: status (optional, default = exclude done+wont).
["$1"]', 'builder', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('BUILDER_NEXT', 'fn', 'builderNext', '',
'# WHAT: pick the single highest-priority queued item.
# WHEN_TO_USE: "what should I work on", "give me the next thing".
# ARGS: (none).
[]', 'builder', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('BUILDER_PATCH', 'fn', 'builderPatch', '',
'# WHAT: update one row''s status/priority/title/body/blocker/proof. ARGS: id|field|value.
# WHEN_TO_USE: refine an item, move it to in_progress, mark blocker, etc.
# EX: BUILDER_PATCH 7|status|in_progress
["$1","$2","$3"]', 'builder', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('BUILDER_DONE', 'fn', 'builderDone', '',
'# WHAT: mark id done + record proof (link/exhibit). ARGS: id|proof.
# WHEN_TO_USE: shipped; record what proves it shipped.
["$1","$2"]', 'builder', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('BUILDER_DELETE', 'fn', 'builderDelete', '',
'# WHAT: delete a row from builder_queue. ARGS: id.
["$1"]', 'builder', NULL, datetime('now'));

-- ────────────────────────────────────────────────────────────────────────────
-- THREADS rows — for the planning/ideation surface (different from builder which is execution-bound)
-- ────────────────────────────────────────────────────────────────────────────

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('THREAD_ADD', 'fn', 'threadAdd', '',
'# WHAT: open a new thread (title + body + tags). status=open.
# WHEN_TO_USE: the owner dumps a new line of thought; capture it for later iteration.
# ARGS: title|body|tags (comma-sep, optional).
# EX: THREAD_ADD "peptide before/after creatives"|"5 variations using nano-banana with our hero shot as ref"|arcads,images
["$1","$2","$3"]', 'threads', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('THREAD_LIST', 'fn', 'threadList', '',
'# WHAT: list open threads (or by tag / status).
# ARGS: filter (optional — open|paused|closed OR tag:<name>).
["$1"]', 'threads', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('THREAD_APPEND', 'fn', 'threadAppend', '',
'# WHAT: append a line to an existing thread''s body.
# WHEN_TO_USE: the owner says "for that peptide thread, also …".
# ARGS: id|line.
["$1","$2"]', 'threads', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('THREAD_CLOSE', 'fn', 'threadClose', '',
'# WHAT: mark a thread closed.
# ARGS: id.
["$1"]', 'threads', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('THREAD_GET', 'fn', 'threadGet', '',
'# WHAT: read one thread fully.
# ARGS: id.
["$1"]', 'threads', NULL, datetime('now'));

-- ────────────────────────────────────────────────────────────────────────────
-- Planning/builder agent rows — these are conversational agents the owner chats with.
-- ────────────────────────────────────────────────────────────────────────────

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('BUILDER', 'agent', 'grok-4.3', 'bearer:GROK_API_KEY',
'{{SHARED}}

B1: IDENTITY
B1a: You are BUILDER. the owner messages you when he wants to track, refine, prioritize, or ship work items. Brain grok-4.3.
B1b: Voice: plain, brief, literal. Never preamble.

B2: ROUTING MAP
B2a: WHEN the owner describes a thing he wants built or done ("I want to ...", "we should ...", "add ...", "fix ...", "let''s build ...") → [BUILDER_ADD]<one-line title>|<full quoted spec>|5[/BUILDER_ADD] (ACTION).
B2b: WHEN the owner asks "what am I building", "show me the queue", "what''s next" → [BUILDER_LIST][/BUILDER_LIST] (READ).
B2c: WHEN the owner says "what''s next", "give me the next thing" (singular) → [BUILDER_NEXT][/BUILDER_NEXT] (READ).
B2d: WHEN the owner refines an item ("for that X thing, change priority to 1", "mark X in progress") → [BUILDER_PATCH]<id>|<field>|<value>[/BUILDER_PATCH] (ACTION).
B2e: WHEN the owner says "X is done" / "shipped X" → [BUILDER_DONE]<id>|<proof>[/BUILDER_DONE] (ACTION).
B2f: WHEN the owner wants me to actually execute a queue item that maps to a CLI agent ("go build X", "claude code do it") → [CLI_CLAUDE_CODE]<spec from builder_queue body>|/Users/owner/miscsubjects-pages[/CLI_CLAUDE_CODE] then [BUILDER_PATCH]<id>|status|in_progress[/BUILDER_PATCH] (ACTION).

B3: NEVER reply without having read or written the builder_queue THIS turn. NEVER reply from memory of past turns alone.', 'agents', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('PLANNER', 'agent', 'grok-4.3', 'bearer:GROK_API_KEY',
'{{SHARED}}

P1: IDENTITY
P1a: You are PLANNER. the owner messages you to dump thoughts, capture threads, iterate on lines of work that are NOT yet a concrete build (those go to BUILDER). Brain grok-4.3.
P1b: Voice: plain, brief, literal. Never preamble. Quote IDs.

P2: ROUTING MAP
P2a: WHEN the owner starts a new thread of thought ("I''ve been thinking about X", "for ads I want to try Y", "remember that Z") → [THREAD_ADD]<short title>|<full quote>|<inferred tags>[/THREAD_ADD] (ACTION).
P2b: WHEN the owner references an existing thread ("for that peptide thing, also ...") → [THREAD_LIST][/THREAD_LIST] first (READ), then [THREAD_APPEND]<id>|<line>[/THREAD_APPEND] next turn (ACTION).
P2c: WHEN the owner asks "what threads do I have" / "what am I tracking" → [THREAD_LIST][/THREAD_LIST] (READ).
P2d: WHEN the owner says a thread should become a real build ("ok actually do X") → [THREAD_GET]<id>[/THREAD_GET] (READ) THEN next turn [BUILDER_ADD]<title>|<body>|<priority>[/BUILDER_ADD] + [THREAD_CLOSE]<id>[/THREAD_CLOSE] (ACTION).

P3: NEVER reply without reading or writing threads THIS turn.', 'agents', NULL, datetime('now'));

-- ────────────────────────────────────────────────────────────────────────────
-- CLI rows that the bridge can run but no row existed for.
-- All share shape: type=http, target=POST https://agent.cannibal.capital/exec, auth=headers:{"x-bridge-token":"$BRIDGE_TOKEN"}, content=form:bin=<binary>&args=$1
-- (The exact bridge contract is already used by the 13 existing CLI_* rows.)
-- ────────────────────────────────────────────────────────────────────────────

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_WRANGLER', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run wrangler on the owner''s Mac (Cloudflare CLI). ARGS: $1 = args after `wrangler`. cwd defaults to /Users/owner/miscsubjects-pages.
# WHEN_TO_USE: deploy/check Workers, list R2 objects, run d1 execute, view kv, etc.
# EX: CLI_WRANGLER "pages deploy public --project-name loop-safe-miscsubjects --commit-dirty=true"
form:bin=wrangler&args=$1&cwd=/Users/owner/miscsubjects-pages', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_CLASP', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run clasp (Apps Script CLI) on the owner''s Mac. ARGS: $1 = args after `clasp`. cwd = /Users/owner/miscsubjects-pages/apps-script.
# WHEN_TO_USE: push or deploy GAS code (airunner, PepperUp).
# EX: CLI_CLASP "push -f"
form:bin=clasp&args=$1&cwd=/Users/owner/miscsubjects-pages/apps-script', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_GIT', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run git. ARGS: $1 = args after `git`. cwd = $2 (default /Users/owner/miscsubjects-pages).
# EX: CLI_GIT "status"|/Users/owner/miscsubjects-pages
form:bin=git&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_NPM', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run npm. ARGS: $1 = args, $2 = cwd. EX: CLI_NPM "install"|/Users/owner/miscsubjects-pages
form:bin=npm&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_PNPM', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run pnpm. ARGS: $1 = args, $2 = cwd.
form:bin=pnpm&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_BUN', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run bun. ARGS: $1 = args, $2 = cwd.
form:bin=bun&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_DENO', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run deno. ARGS: $1 = args, $2 = cwd.
form:bin=deno&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_NODE', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run node. ARGS: $1 = args, $2 = cwd. EX: CLI_NODE "-e \"console.log(1+1)\""|.
form:bin=node&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_PYTHON', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run python3. ARGS: $1 = args, $2 = cwd. EX: CLI_PYTHON "-c \"print(2+2)\""|.
form:bin=python3&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_BREW', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run brew. ARGS: $1 = args.
form:bin=brew&args=$1', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_FFMPEG', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run ffmpeg. ARGS: $1 = args, $2 = cwd. EX: CLI_FFMPEG "-i input.mp4 -t 10 out.mp4"|/Users/owner/Downloads
form:bin=ffmpeg&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_YT_DLP', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run yt-dlp. ARGS: $1 = args, $2 = cwd. EX: CLI_YT_DLP "-o ad.mp4 https://...".
form:bin=yt-dlp&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_MAGICK', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run ImageMagick (magick CLI). ARGS: $1 = args, $2 = cwd.
form:bin=magick&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_PANDOC', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run pandoc. ARGS: $1 = args, $2 = cwd.
form:bin=pandoc&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_JQ', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run jq. ARGS: $1 = args (the jq filter), $2 = stdin_text.
form:bin=jq&args=$1&stdin=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_RG', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run ripgrep. ARGS: $1 = args, $2 = cwd. EX: CLI_RG "ADDTASK -n"|/Users/owner/miscsubjects-pages
form:bin=rg&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_FD', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run fd (modern find). ARGS: $1 = args, $2 = cwd.
form:bin=fd&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_HTTPIE', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run httpie (http CLI). ARGS: $1 = args.
form:bin=http&args=$1', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_CURL_LOCAL', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run curl ON THE MAC (different from the worker''s outbound fetch — picks up Mac creds in keychain/env).
# ARGS: $1 = args.
form:bin=curl&args=$1', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_DOCKER', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run docker. ARGS: $1 = args, $2 = cwd.
form:bin=docker&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_KUBECTL', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run kubectl. ARGS: $1 = args.
form:bin=kubectl&args=$1', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_AWS', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run aws CLI. ARGS: $1 = args.
form:bin=aws&args=$1', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_GCLOUD', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run gcloud. ARGS: $1 = args.
form:bin=gcloud&args=$1', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_TERRAFORM', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run terraform. ARGS: $1 = args, $2 = cwd.
form:bin=terraform&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_OPENAI', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run the openai CLI (https://developers.openai.com/api/docs/libraries/openai-cli). ARGS: $1 = args, $2 = cwd.
form:bin=openai&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_SQLITE', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run sqlite3. ARGS: $1 = args (db path then query). EX: CLI_SQLITE "/path/to.db ''SELECT * FROM x LIMIT 5''"
form:bin=sqlite3&args=$1', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_PSQL', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run psql. ARGS: $1 = args.
form:bin=psql&args=$1', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_TYPST', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run typst (typesetting). ARGS: $1 = args, $2 = cwd.
form:bin=typst&args=$1&cwd=$2', 'cli', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('CLI_GRAPHVIZ', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run dot/graphviz. ARGS: $1 = args.
form:bin=dot&args=$1', 'cli', NULL, datetime('now'));

-- ────────────────────────────────────────────────────────────────────────────
-- LOCAL_* rows that fill gaps (notification, voice record, slack/mail open, network status, etc.)
-- ────────────────────────────────────────────────────────────────────────────

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('LOCAL_NOTIFY', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: post a macOS Notification Center banner. ARGS: title|message|sound (optional).
# WHEN_TO_USE: bring eyes back to the Mac when something async finishes.
form:bin=osascript&args=-e "display notification \"$2\" with title \"$1\" sound name \"$3\""', 'local', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('LOCAL_NETWORK', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: dump current network state (Wi-Fi SSID, IP, gateway). ARGS: none.
form:bin=sh&args=-c "echo SSID:$(networksetup -getairportnetwork en0 | sed s/.*Network://) ; ifconfig en0 | awk ''/inet /{print \"IP:\"$2}'' ; route -n get default | awk ''/gateway/{print \"GW:\"$2}''"', 'local', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('LOCAL_BATTERY', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: read battery % and AC state. ARGS: none.
form:bin=pmset&args=-g batt', 'local', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('LOCAL_FOCUS', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: read current Focus mode (do not disturb / work / etc) from defaults.
form:bin=sh&args=-c "shortcuts run ''Get Current Focus'' 2>&1 || defaults read ~/Library/Preferences/com.apple.donotdisturb.plist 2>&1"', 'local', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('LOCAL_OPEN_URL', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: open a URL in the default browser. ARGS: $1 = url.
form:bin=open&args=$1', 'local', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('LOCAL_OPEN_APP', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: open a macOS app by name. ARGS: $1 = app name (e.g. "Safari", "Cursor", "Messages").
form:bin=open&args=-a $1', 'local', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('LOCAL_VOICE_RECORD', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: record N seconds of mic to /tmp/voice-<ts>.m4a using ffmpeg, return path.
# ARGS: seconds (default 10).
form:bin=sh&args=-c "F=/tmp/voice-$(date +%s).m4a ; ffmpeg -y -loglevel error -f avfoundation -i ":0" -t ${1:-10} -c:a aac \"$F\" 2>&1 && echo $F"', 'local', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('LOCAL_SHORTCUTS_RUN', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: run a macOS/iOS Shortcut by name (`shortcuts run "Name"`). ARGS: $1 = name, $2 = input (optional).
# WHEN_TO_USE: invoke any shortcut the owner saved (cross-syncs with iOS).
form:bin=sh&args=-c "echo \"$2\" | shortcuts run \"$1\""', 'local', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('LOCAL_SHORTCUTS_LIST', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: list all Shortcuts on the Mac (`shortcuts list`).
form:bin=shortcuts&args=list', 'local', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('LOCAL_PASTEBOARD_PUSH_PHONE', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: push text into Mac clipboard so Universal Clipboard syncs it to the iPhone. ARGS: $1 = text.
form:bin=sh&args=-c "printf %s \"$1\" | pbcopy && echo OK"', 'local', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('LOCAL_AIRDROP', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: AirDrop a file from the Mac via osascript. ARGS: $1 = absolute file path.
form:bin=osascript&args=-e "tell application \"Finder\" to activate" -e "tell application \"System Events\" to keystroke \"d\" using {command down, control down, shift down}" -e "tell application \"Finder\" to reveal POSIX file \"$1\""', 'local', NULL, datetime('now'));

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, seq, updated_at) VALUES
('LOCAL_DICTATE_TO_PHONE', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-bridge-token":"$BRIDGE_TOKEN"}',
'# WHAT: TTS the text via macOS say(1) at the Mac speakers. ARGS: $1 = text, $2 = voice (optional, default Samantha).
form:bin=say&args=-v ${2:-Samantha} $1', 'local', NULL, datetime('now'));
