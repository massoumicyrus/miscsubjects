# Architecture — miscsubjects.com build, end-to-end

A single document covering everything in the loop today. Counts and bindings are taken from the live D1 directory and the live `wrangler.toml` files in this repo as of 2026-06-12.

---

## 1. Cloudflare services in use

### 1a. Pages project — `loop-safe-miscsubjects`

- **Source**: `functions/` tree in this repo, deployed via `npx wrangler pages deploy public --project-name loop-safe-miscsubjects --commit-dirty=true`.
- **Production hostname**: `https://miscsubjects.com`.
- **Bindings (per `wrangler.toml`)**:
  - `DB` → D1 `loop-content-spine` (the directory + content database).
  - `LEDGER` → D1 `loop-shared-events` (the cross-build event ledger).
  - `KV` → namespace `58b303e666a8431685624e0cfd2fd63f` (directory snapshot cache + per-chat convo state + per-key settings cache).
  - `R2` → bucket `miscsubjects-ledger` (generated images, screenshots, capability sources, file uploads).
  - `AI` → Workers AI binding (used by `WAI_*` rows).
  - `TASKS` → Queues producer for `loop-tasks`.
- **Why Pages and not a single Worker**: Pages gives the directory editor, the article reader, the admin UIs, and the static `/img/...` proxy under the same project. The Functions runtime is request-driven (no cron, no DO, no queue consumer, no browser binding — those constraints are what forced the sibling Worker below).

### 1b. Sibling Worker — `loop-safe-sibling`

- **Source**: `workers/sibling/` (`wrangler.toml` + `src/index.js`).
- **Deployed URL**: `https://loop-safe-sibling.owner-account.workers.dev`.
- **Why it exists**: Pages Functions cannot host cron triggers, durable objects, queue consumers, workflows, or the browser-rendering binding. The sibling Worker is where those live. The Pages dispatcher calls into it via three `SIBLING_*` directory rows for DO chat + workflow trigger; the sibling calls back into Pages via `POST /api/dispatch` for everything else.
- **Bindings (per `workers/sibling/wrangler.toml`)**:
  - `DB` → same `loop-content-spine` (writes the cron tick row to `log`).
  - `KV` → same KV namespace.
  - `R2` → same bucket (screenshot writes).
  - `AI` → same Workers AI.
  - `CF_EXPERT_DO` → `ExpertDO` durable-object class. Each name (`CF_EXPERT`, `STRIPE_EXPERT`, …) is its own DO instance with its own SQLite state.
  - `DELIVER_WF` → `DeliverWorkflow` (Cloudflare Workflow class). Polls `pending_deliveries`, retries 3× exponential per job.
  - `TASKS` → Queue producer + consumer for `loop-tasks`. Consumer forwards every job as `POST /api/dispatch {key, body}`.
  - `MYBROWSER` → Browser Rendering binding (Puppeteer-style; currently REST is the active path, binding is staged for future Puppeteer flows).
- **Cron**: `*/5 * * * *` writes a row to `D1.log` with `key='sibling.cron'` and POSTs `/api/deliver` on the Pages project. Verified firing every 5 min on the :01-second boundary.
- **HTTP endpoints**: `/health`, `/do/expert/ping?name=X`, `/do/expert/chat?name=X` (POST `{messages, model}`), `/wf/deliver/trigger` (POST), `/wf/deliver/status?id=X`.

### 1c. D1 databases

| Binding | Database | Purpose | Notable tables |
|---|---|---|---|
| `DB` | `loop-content-spine` | The content + directory + state database | `directory` (262 rows live), `pages`, `pages_versions`, `articles`, `article_slots`, `settings`, `tasks`, `docs`, `stripe_catalog`, `arcads_ledger`, `assets`, `turn_jobs`, `pending_deliveries`, `directory_tests`, `fidelity_log`, `watch_rules`, `log`, `blooio_dedup` |
| `LEDGER` | `loop-shared-events` | Append-only event log shared across builds | `events` (full request + response per outbound call, redacted) |

### 1d. KV (one namespace, multiple usage patterns)

- `directory:snapshot` — JSON snapshot of the directory table, 60s TTL, invalidated by every write through `_lib/dir_snapshot.js`.
- `convo:<chat>` — short-context messages per chat for the router.
- `audio:<chat>` — boolean flag for the owner's audio-mode toggle.
- `repo:snapshot:current` — file tree + selected file contents, written by the `snapshot-repo-to-kv.yml` GitHub Action on push to main.
- Settings cache mirror for `system_prompt` / `grok_model`.

### 1e. R2 (one bucket: `miscsubjects-ledger`)

- `img/gen/...` — generated images from ArcAds / Grok Imagine / OpenAI / Workers AI / dual-engine.
- `img/screenshot/...` — Browser Rendering screenshots.
- `img/ref/...` — inbound reference images stored on receipt.
- `capability_sources/<sha16>.txt` — raw bodies fetched by `DISCOVER_SOURCE`.

### 1f. Workers AI (`env.AI` binding)

Wired through these directory rows:
- `WAI_RUN` — generic chat completion. Default model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
- `WAI_EMBED` — 768-d embedding. Default `@cf/baai/bge-base-en-v1.5`.
- `WAI_T2I` — text → image, default Stable Diffusion XL Base 1.0. Stores result to R2, returns stable miscsubjects.com URL.
- `WAI_TRANSLATE` — `@cf/meta/m2m100-1.2b`.

### 1g. Queues — `loop-tasks`

- ID `b04e7a6485a14457a8238f400c76091e`. Plus `loop-ingest` + `loop-ingest-dlq` (legacy, owned by other builds).
- Producer: Pages binding `TASKS`, surfaced as `QUEUE_SEND` directory row.
- Consumer: sibling Worker. Each job is forwarded as `POST /api/dispatch {key, body}`. Failure → `msg.retry()`.

### 1h. Workflows — `deliver-workflow`

- Class `DeliverWorkflow` in `workers/sibling/src/index.js` extending `WorkflowEntrypoint`.
- Run shape: record start → list `pending_deliveries` (LIMIT 25) → per job: `step.do(...)` with `{retries: {limit: 3, delay: 10s, backoff: exponential}}` calling `POST /api/deliver`.
- Triggered from the Pages dispatcher via `SIBLING_WORKFLOW_DELIVER_TRIGGER` (POST `/wf/deliver/trigger`) and from `functions/api/deliver.js` when work remains.
- Replaces the GitHub Actions heartbeat that was retired.

### 1i. Durable Objects — `ExpertDO`

- Class in sibling Worker, one DO instance per name.
- Two ops: `ping` (returns id + ts) and `chat` (runs `env.AI.run(model, {messages})` inside the DO context).
- SQLite-backed state available via `state.id`; not yet used for persistence — current ops are stateless. The DO model is in place for "domain expert" instances that retain history (`CF_EXPERT`, `STRIPE_EXPERT`, …) but only the chat op is wired today.

**Durable Object limits (sourced from developers.cloudflare.com/durable-objects/platform/limits/ 2026-06-13):**

| Limit | Value |
|---|---|
| DO classes per account | 500 (paid) / 100 (free) |
| DO instances per class | Unlimited |
| Storage per instance (SQLite) | 10 GB |
| CPU per request (default) | 30 seconds active |
| CPU per request (configurable max) | 5 minutes active (set via `limits.cpu_ms` in wrangler.toml) |
| Outgoing connections per request | 6 |
| WebSocket message size | 32 MiB (received) |

**D1 limits (sourced from developers.cloudflare.com/d1/platform/limits/ 2026-06-13):**

| Limit | Value |
|---|---|
| D1 databases per account | 50,000 (paid) / 10 (free) |
| D1 bindings per Worker script | ~5,000 (constrained by 1 MB script metadata limit) |
| Simultaneous D1 connections per Worker invocation | 6 |
| Queries per Worker invocation | 1,000 (paid) / 50 (free) |

**What this means for the build:**

Each DO instance can hold its own conversation history in `this.sql` (SQLite). An agent row whose `target` model is `moonshot-v1-8k` (Kimi) that is always called from the same DO instance will get cache hits on the accumulated message prefix — Moonshot charges ~10% of the normal input-token rate for cached portions. So per DO instance you can pin one agent identity (one model, one conversation thread) and get near-full cache discount on the growing prefix.

The Pages project cannot host DOs. DOs must live in the sibling Worker. The sibling Worker currently has two DO class bindings (`CF_EXPERT_DO` for `ExpertDO`, `AGENT_DO` for `AgentDO`). You can add more DO classes to the sibling Worker up to the 500-class account cap — each class is a separate binding in `workers/sibling/wrangler.toml` and a separate class export in `workers/sibling/src/index.js`.

There is no per-Worker limit on the number of DO class bindings documented by Cloudflare beyond the 500-class account cap and the 1 MB script bundle metadata limit.

### 1j. Browser Rendering

- REST path active (token has the `Account.Browser Rendering: Edit` scope).
- 8 ops on the `CF` row's target_map AND 6 convenience rows: `BROWSER_MARKDOWN`, `BROWSER_SCREENSHOT`, `BROWSER_PDF`, `BROWSER_LINKS`, `BROWSER_SCRAPE`, `BROWSER_JSON`.
- `MYBROWSER` binding present on the sibling Worker for future Puppeteer-style flows.

### 1k. Secrets Store

- Account-level secrets store (id `<SECRETS_STORE_ID>`) holds tokens for: Cloudflare API + account ID + global key + email, Meta CAPI, Klaviyo, Triple Whale, GitHub, BigCommerce, Blooio, 2chat, Telegram, Stripe, Grok, Claude, Kimi, Gemini, OpenAI, OpenAI API key, terminal key, airunner web app URL.
- Each Pages secret is bound as a per-Pages env var (Wrangler 4.92 rejects `[[secrets_store_secrets]]` for Pages projects — that's the constraint that produced the `bind-secrets.js` shim).

### 1l. Other Cloudflare surfaces wrapped but not actively used

Available on the `CF` directory row, REST-only, awaiting first call: `vectorize_*`, `hyperdrive_list`, `workflows_*`, `cfd_tunnel`, `email/routing/*`, `logpush_jobs`, `access_apps`, `audit_logs`, `subscriptions`, `analytics_dash`, `cache_purge`, `secrets_*`, `images_list`, `stream_list`, `do_namespaces_list`, `workers/observability/logs`.

### 1m. GitHub Actions

Two workflows remain after the cron cutover:
- `snapshot-repo-to-kv.yml` — on push to main, dumps the repo tree + selected file contents to KV key `repo:snapshot:current`. Lets the router agent reference the codebase without re-cloning.
- `proactive-creative.yml` — `0 */4 * * *`, hits `/api/proactive` to wake the ArcAds creative agent.

---

## 2. Channels — inbound and outbound

Inbound webhook URLs map to handlers; outbound is routed by `SEND_BY_CHANNEL` or the channel-specific sender.

All three text channels share one collapsed intake (`functions/_lib/webhook_intake.js`):

1. `logEvent` — full raw to `LEDGER.events` with `source = <channel>`.
2. Per-channel parser — pulls `from / chat / messageBody / mediaUrls / messageId`.
3. Dedup — `blooio_dedup` row keyed by `<channel>:<message_id>`. If exists, drop.
4. Prefix shortcut — `/t /exec /terminal /run /help` from the owner's number → `runDirectExec` (LOCAL_EXEC on the Mac bridge).
5. Bloo io only, the owner only — audio-mode toggle.
6. `routeInbound` — backgrounds a POST to `/api/turn` which orchestrates phase A (router agent dispatch) → phase B (sub-agent if routed) → phase C (`[REPLY]` extraction + channel send).

---

## 3. Site surfaces

| URL | Purpose |
|---|---|
| `https://miscsubjects.com/` | Hand-edited landing |
| `/<slug>` | Runtime-editable pages from D1 `pages` table |
| `/a/<slug>` | Public article reader (uses `ARTICLE_GET` flow shape) |
| `/img/<key>` | R2 binary streamer |
| `/admin/directory` | Live tool inventory + per-row editor (262 rows) |
| `/admin/models` | One-page picker for every D1 table |
| `/admin/ledger` | Unified event timeline |
| `/admin/pages` | Page editor |
| `/admin/assets` | Asset gallery |
| `/admin/manual` | Historical text doc (banner flagging staleness) |
| `/admin/rest` | Live-directory-driven REST endpoint table |
| `/admin/sync-sheets` | Legacy push to airunner GAS (still mounted; SHEETS_SYNC_ALL flow is the canonical replacement) |
| `/api` | Directory-driven inventory grouped by category |
| `/api/dispatch` | The single tool-dispatch endpoint |
| `/api/inventory` | Short-ID resolver for any surface |
| `/api/directory/*` | Directory row CRUD |
| `/api/pages/*`, `/api/settings/*`, `/api/articles/*`, `/api/kv`, `/api/r2/*`, `/api/file/*` | Per-surface REST CRUD |
| `/api/turn` | Internal: per-message phase orchestrator |
| `/api/deliver` | Per-job render-poll + channel-deliver handler (durable retries now via DeliverWorkflow) |
| `/api/proactive` | ArcAds wake (called by `proactive-creative.yml`) |
| `/api/dispatch` (POST `{key, body}`) | Universal tool entry point |
| `/grok` | Grok system-prompt + model editor; Grok ledger viewer |
| `/blooio` (GET) | Bloo io webhook log viewer |

---

## 4. External APIs invoked

Grouped by category, with the directory row that wraps each.

| Category | Provider | Row(s) | Notes |
|---|---|---|---|
| LLM | xAI Grok | `ROUTER` (agent), `ARCADS`, `CF_EXPERT`, `GROK_IMAGE`, `GROK_IMAGE_EDIT`, `GROK_TTS`, `GROK_VIDEO_*`, `GROK_MODELS` | Default brain. Reasoning disabled per CLAUDE.md law. |
| LLM | Anthropic | `ASK_CLAUDE` (agent), `CLAUDE_CODE` CLI | Claude Fable 5 currently |
| LLM | Google | `ASK_GEMINI` (agent), `GEMINI_GENERATE`, `CLI_GEMINI` | Gemini 2.5 Flash |
| LLM | OpenAI | `ASK_GPT` (agent), `OPENAI_IMAGE`, `OPENAI_IMAGE_EDIT`, `OPENAI_MODELS`, `GW_*` (gateway) | GPT-4o default |
| LLM | Moonshot | `ASK_KIMI` (agent) | Kimi K2.6 |
| LLM | Workers AI | `WAI_RUN`, `WAI_EMBED`, `WAI_T2I`, `WAI_TRANSLATE` | Cheap inline executor |
| Creative | ArcAds | `ARCADS_*` ×7 (generate, video_generate, credits, fields, upload, routes, video_fields) | Image + video generation. Polled by `/api/deliver`. |
| E-commerce | Stripe | `STRIPE_READ`, `STRIPE_WRITE` (target_map), `SEND_PEPTIDE_INVOICE`, `SEND_NAMED_INVOICE`, `SEND_INVOICE_VIA_BLOOIO`, `STRIPE_CATALOG_SYNC`, `STRIPE_PEPTIDES`, `STRIPE_SKUS_*`, `STRIPE_PUBLIC_KEY_GET` | Writes are `sensitive=1` (watcher-gated) |
| E-commerce | BigCommerce | `BC` | Orders + revenue source of truth |
| Marketing | Meta | `META` (target_map), `META_CAPI_EVENT` flow | Spend only, never revenue (per CLAUDE.md) |
| Marketing | Klaviyo | `KLAVIYO` | Profiles + events |
| Marketing | Triple Whale | `TW` | Attribution only |
| Channels | Bloo io | `BLOOIO` (target_map) | iMessage |
| Channels | 2chat | `TWOCHAT_SEND` | WhatsApp |
| Channels | Telegram | (sender inline) | webhook gated by `TELEGRAM_WEBHOOK_SECRET` |
| Voice | Grok STT/TTS + OpenAI TTS/whisper | `GROK_STT`, `GROK_TTS`, `VOICE_SAY`, `VOICE_SEND`, `VOICE_TRANSCRIBE` | Audio in + audio replies on Blooio; no real-time speech |
| Devtools | GitHub | `GITHUB` (target_map), `FILE_GET/PUT/LIST` via Contents API, `CLI_GH`, `CLI_GH_COPILOT` | Repo CRUD + workflow runs |
| Devtools | Google Workspace | `APPS_SCRIPT_RUN`, `GOOGLE_DRIVE_*`, `GOOGLE_SHEETS_*`, `GOOGLE_CALENDAR_*`, `GOOGLE_TASKS_*` | All via the airunner Apps Script web app |
| Devtools | Cloudflare REST | `CF` (78 ops in target_map) | The biggest single capability row |
| Devtools | Generic web | `WEB_GET`, `WEB_FETCH`, `HTTP_FETCH` | |
| Devtools | LBL data | `LBL_GET`, `LBL_POST` | |
| Devtools | MCP | `MCP_context7_*` ×2, `MCP` (target_map) | Generic MCP client surface |
| Voice infra | (live-call line) | — | Not wired |
| AI Gateway | Cloudflare AI Gateway | `AIG_RAW`, `AIG_LIST`, `GW_DEEPSEEK`, `GW_FABLE`, `GW_LLAMA` | Per-request observability + caching layer in front of providers |

---

## 5. Directory invocation — exact code path

Every tool call in this build goes through the same chain. This section names every function and line number responsible for each stage.

### Stage 0 — request entry

**File**: `functions/api/dispatch.js`
**Function**: `onRequestPost` — line 2124

```
POST /api/dispatch {"key": "LOCAL_EXEC", "body": "ls ~/Desktop"}
```

`onRequestPost` parses the JSON body, checks that `key` is present, then calls `dispatch(env, body.key, body.body, body)`.

Equivalent path from an agent turn: the agent emits `[LOCAL_EXEC]ls ~/Desktop[/LOCAL_EXEC]`. The tag parser in `runAgent` (line 1843) scans the model's text output with `TAG_RE` (line 16: `/\[([A-Z_][A-Z0-9_]*)\]([\s\S]*?)\[\/\1\]/g`), extracts key=`LOCAL_EXEC` and body=`ls ~/Desktop`, then calls `dispatchTag(key, body, ctx)` directly (not via HTTP).

### Stage 1 — dispatch context

**Function**: `dispatch` — line 2107

Creates the execution context object (`ctx`):
- `env` — all Cloudflare bindings (DB, LEDGER, KV, R2, AI, TASKS)
- `dir` — the full directory loaded from KV or D1 (see Stage 2)
- `trace` — a random ID for this call chain, written to every log row
- `step` / `parent` / `depth` / `iter` — loop-guard counters
- `cost` — running USD spend, checked against `COST_CAP_USD = 1.00` (line 5)
- `grokWebSearch`, `grokTemperature`, `grokReasoningEffort` — per-call model settings read from KV/settings table

### Stage 2 — directory load

**Function**: `loadDirectory` — line 137

```
KV key "directory:snapshot" (30s TTL)
  hit → return cached rows object
  miss → SELECT key, type, target, auth, content, category, allowed_categories, seq, sensitive FROM directory
       → cache in KV → return rows object
```

Result: `ctx.dir` is a plain JS object keyed by directory row `key`. Every subsequent lookup is `ctx.dir[key]`.

### Stage 3 — watcher pre-flight

**Function**: `dispatchTag` — line 1670

Before calling any row, if `row.sensitive === 1` and the key is not `WATCH_ACTION` itself:
- Calls `FN_MAP.watchAction(ctx.env, key, body)` — queries `watch_rules` for matching `pattern_key` / `pattern_body` regex.
- If the verdict is `allowed: false`, returns `ERR:watcher:denied:...` immediately and logs to LEDGER.
- Watcher bypass: set `ctx.skipWatch = true` (only used internally in test harness rows).

### Stage 4 — row type routing

**Function**: `dispatchTag` — line 1688

Splits `body` on `|` into `args[]`, then routes by `row.type`:

| `row.type` | Function called | Line |
|---|---|---|
| `fn` | `runFn(row, args, ctx)` | 1709 |
| `http` | `runHttp(row, args, ctx)` | 1724 |
| `agent` | `runAgent(key, row, args.join('\|'), ctx)` | 1843 |
| `flow` | `runFlow(row, args, ctx)` | 2030 |

### Stage 4a — `fn` execution

**Function**: `runFn` — line 1709

1. Look up `FN_MAP[row.target]` — `FN_MAP` is a plain object mapping function name strings to JS async functions, defined in `dispatch.js` (not exported). If the name is unknown → `ERR:fn:unknown_target`.
2. `stripDocs(row.content)` — removes leading `# comment` lines from the row's `content` field to get the args-template string.
3. `subVars(template, args, ctx.prev, ctx.bindings, ctx.env, 'json-string')` — substitutes `$1`, `$2`, `$PREV`, `$NAME` placeholders.
4. `JSON.parse(filled)` — the template must parse as a JSON array; those are the positional arguments passed to the function.
5. `fn.apply(null, [envForFn, ...parsed])` — the function runs in-process with full env access.

All 88 fn-type rows in the directory are wired to one of the named functions in `FN_MAP`. Adding a new function requires both a new entry in `FN_MAP` (code change + deploy) AND a new directory row pointing to it (D1 row, no deploy needed).

### Stage 4b — `http` execution

**Function**: `runHttp` — line 1724

1. If `row.target` starts with `target_map:` — parse the JSON map, pick the sub-op from `args[0]`, resolve to a `METHOD URL` string.
2. `subVars(url, mapArgs, ..., 'url')` — substitute placeholders in the URL (URL-encoded).
3. `applyAuth(row.auth, headers, env, url)` — injects the credential named in `row.auth`:
   - `bearer:ENV_VAR_NAME` → `Authorization: Bearer <env[ENV_VAR_NAME]>`
   - `basic:ENV_VAR_NAME` → `Authorization: Basic <btoa(value + ':')>`
   - `headers:{...}` → arbitrary header injection with `$ENV_VAR` substitution
   - `query:param=ENV_VAR` → appends to URL query string
4. `subVars(row.content, ..., 'json-string')` — builds the request body.
5. `fetch(url, {method, headers, body})` — outbound HTTP.
6. `redactReq(...)` logs the full request (Authorization redacted) to LEDGER via `logStep`.

### Stage 4c — `agent` execution

**Function**: `runAgent` — line 1843

1. Resolve model: `subVars(row.target, ...)` → `providerEndpoint(modelId, env)` → sets `prov.url` and `prov.kind` (`openai_compat`, `xai_responses`, `anthropic`, `gemini`, `cf_aig`, `workers_ai`).
2. Build system prompt (line 1851–1857):
   ```
   systemPrompt = snapshotBlock          // repo file list, only for ROUTER/SCOUT/OPS
     + row.content
       .replace({{SHARED}}, SHARED_LAW row's content)
       .replace({{TOOLS:cat=X}}, toolListFor(dir, key, {category:'X'}))
       .replace({{CATEGORIES}}, categoryManifestFor(dir, key))
       .replace({{TOOLS}}, toolListFor(dir, key))      // up to 200 rows, sorted by planner_rank
   ```
3. `toolListFor` (line 177) — iterates `ctx.dir`, skips the calling agent's own key, filters by `enabled`, `planner_visible`, and `allowed_categories`, sorts by `planner_rank`, caps at `TOOLS_CAP = 200`, formats each as `[KEY] (type · category) — first_comment_line_of_content`.
4. Enter the iteration loop (max `ITER_CAP = 8` turns, `DEPTH_CAP = 3` agent nesting levels):
   - Build and fire the LLM request to `prov.url`.
   - Parse response text.
   - Scan for `[KEY]...[/KEY]` tags with `TAG_RE`.
   - For each tag, call `dispatchTag(tagKey, tagBody, ctx)` — this re-enters Stage 3 for the child call.
   - Append tool results to `curInput` for the next iteration.
   - If `[DONE]` tag found or no more tags, exit loop.
5. Return `lastText` as the agent's result.

### Stage 4d — `flow` execution

**Function**: `runFlow` / `execFlowSeq` — line 2030

`row.content` is a DSL string. Steps separated by `>`:
```
KEY1: $1 > KEY2: $PREV|extra > ?:CONDITION_KEY: test > TRUE_KEY: args | FALSE_KEY: args
```

`execFlowSeq` iterates steps:
- Normal step: `execStep(part, ctx)` → parses `KEY: body`, calls `dispatchTag(key, body, ctx)`, stores result as `ctx.prev`.
- `?:` prefix: conditional branch — run the condition step, if result starts with `ERR:` take the right branch, else take the left.
- `=> name` suffix on any step: store the result in `ctx.bindings[name]` for later `$name` substitution.
- Error propagation: if any step returns `ERR:...` the sequence halts.

### Stage 5 — ledger write

**Function**: `logStep` — line 101

Every `dispatchTag` call writes one row to `LEDGER.events` (the `loop-shared-events` D1 database) via `logEvent` in `functions/_lib/event_log.js`. The row contains: `ts`, `trace_id`, `step`, `parent`, `key`, `type`, `request` (full JSON, secrets redacted by `redactReq`), `response` (full text).

### What agents in this build can edit

Agents emit `[KEY]body[/KEY]` tags. Any directory row is callable. Rows that change the build's own state:

| Row | What it changes |
|---|---|
| `EDIT_ROW` | Overwrites `target`, `auth`, or `content` of any directory row in D1. Invalidates KV snapshot. |
| `ADD_ROW` | Inserts a new directory row. |
| `DEL_ROW` | Deletes a row. Blocked by watcher (`sensitive=1`). |
| `SET_ROW_CONTENT` | Overwrites only the `content` field of a row. |
| `DIR_PATCH` | Patch multiple fields on a row in one call. |
| `LOCAL_WRITE` | Writes a file on the Mac at any absolute path (bridge). |
| `LOCAL_EXEC` | Runs any shell command on the Mac (bridge). |
| `CLI_CLAUDE_CODE` | Runs Claude Code as a coding agent on the Mac — it can edit any file in the repo. |
| `DB_EXEC` (if wired) | Direct SQL on D1. Can alter any table. |
| `KV_SET` / `KV_DELETE` | Writes or deletes KV keys. |
| `QUEUE_SEND` | Enqueues a job that re-enters `/api/dispatch` on the sibling. |
| `CF` target_map ops | Cloudflare REST API — can deploy Workers, edit secrets, modify routing. `sensitive=1` gated. |
| `STRIPE_WRITE` | Stripe POST/PATCH. `sensitive=1` gated. |

There is no technical limit on what an agent can call. The only gate is `sensitive=1` + `watch_rules`. Any row without `sensitive=1` is callable by any agent that can see it in `{{TOOLS}}` (or knows its key directly). A row hidden from `{{TOOLS}}` via `planner_visible=0` can still be called if the agent emits its exact key.

## 6. Internal API surface (`/api/dispatch` and the directory protocol)

This is the keystone.

### 5a. Dispatch protocol

Every tool call is `POST /api/dispatch {"key": "<KEY>", "body": "<args>"}`. Equivalent agent emission is `[KEY]args[/KEY]` on its own line. The dispatcher:

1. Loads the directory snapshot from KV (60s TTL) or D1.
2. Looks up `row = dir[key]`.
3. If `row.sensitive=1`, calls `watchAction(env, key, body)` first; if denied → returns `ERR:watcher:denied:...`.
4. Splits `body` on `|` to get positional args.
5. Routes by `row.type`:
   - `fn` → JS function in `FN_MAP` (in-process).
   - `http` → `fetch()` against `row.target` URL or `target_map` op, with `applyAuth(row.auth, ...)`.
   - `flow` → `KEY1: body1 > KEY2: body2 > ...` sequenced via `execFlowSeq`.
   - `agent` → LLM call against `row.target` model, with `row.content` as system prompt, capable of emitting more tags that re-enter the dispatcher.
6. Writes a row to D1 `log` (per-step trace).

### 5b. Substitution grammar (`subVars`)

Templates support:
- `$1, $2, ...` — positional args (escaped per mode: `url`, `json-string`, `header-value`, `raw`).
- `$N+` — args from N to end joined with `|`. Lets the last arg carry pipes.
- `$PREV` — previous flow step's result.
- `$NAME` — env var or named binding from a flow `=> name`.
- `$$NAME` — RAW substitution. No escaping. Used when inlining a pre-formatted JSON value into a JSON body template. Without this, JSON-array bindings get string-escaped and break the receiver.

### 5c. Directory row shape

```
{
  key            TEXT PRIMARY KEY
  type           TEXT  -- fn | http | flow | agent
  target         TEXT  -- function name (fn), URL or target_map: (http), model id (agent), empty (flow)
  auth           TEXT  -- "" | "bearer:ENV_VAR" | "basic:ENV_VAR" | "headers:{...}" | "query:..." | "oauth:"
  content        TEXT  -- args template (fn), body template (http), DSL (flow), system prompt (agent)
  category       TEXT
  enabled        INTEGER
  planner_visible INTEGER  -- whether {{TOOLS}} sees it
  planner_rank   INTEGER   -- sort order in {{TOOLS}}
  sensitive      INTEGER   -- triggers watcher pre-flight
  allowed_categories TEXT  -- per-agent visibility filter
  seq            INTEGER
  input_schema   TEXT
  examples       TEXT
  updated_at     TEXT
}
```

### 5d. Live row counts (live D1 query)

| Type | Count |
|---|---|
| http | 112 |
| fn | 88 |
| flow | 26 |
| agent | 1 (planner-visible) — full agent set when including all agents: ROUTER, ARCADS, CF_EXPERT, ASK_CLAUDE, ASK_GEMINI, ASK_GPT, ASK_KIMI, GW_DEEPSEEK, GW_FABLE, GW_LLAMA + others. Most are hidden from `{{TOOLS}}` injection so they don't pollute the router's tool list. |

Top categories: cloudflare (15), util (14), stripe (9), pages (9), google (9), directory (9), kv (7), flow (7), capability (7), arcads (7), grok (6).

### 5e. Watcher

`watch_rules` table. Each row: `pattern_key` (regex over KEY), `pattern_body` (regex over body), `action` (`deny`), `reason`, `enabled`. The dispatcher runs the watcher pre-flight for any row with `sensitive=1`. Seeded deny rules: Stripe writes, `rm -rf /`, `git push --force`, destructive Cloudflare ops, `DEL_ROW`. the owner can text new rules in via `WATCH_RULE_ADD` / `_LIST` / `_DELETE`.

---

## 6. End-to-end loop ontology

The build's job is to convert plain-English iMessage into real-world action with full audit. Five layers:

### Layer 1 — channel ingress
- Webhook hits `/blooio` / `/2chat` / `/telegram`. Pages handler is a 3-line shim → `processWebhook(context, channel)` in `functions/_lib/webhook_intake.js`.
- Parser-per-channel normalizes to `{from, chat, messageBody, mediaUrls, channel, messageId}`.
- Dedup + log + prefix-shortcut + audio-mode-toggle (Bloo io only) + `routeInbound` → background POST to `/api/turn`.

### Layer 2 — turn orchestration (`/api/turn`)
Three phases per inbound, each its own fresh Worker invocation:
- **Phase A** — store each ref-image to R2, log assets, render conversation history from KV, dispatch the `ROUTER` agent with the user's text + media URLs. Router emits some mix of `[REASONING]`, `[REPLY]`, `[KEY]args[/KEY]`, `[DONE]`. Scan for routing tags. If routed to a sub-agent (`[ARCADS]`, `[VOICE]`), post a Phase B job.
- **Phase B** — dispatch the sub-agent. Sub-agent emits its own tag soup. Post a Phase C job.
- **Phase C** — extract the last `[REPLY]`, collect pending renders for delivery, send the reply via the inbound channel, save convo update, register pending renders in `pending_deliveries`, kick the deliver workflow.

### Layer 3 — dispatch (`/api/dispatch`)
The single tool entry point. Every cell in the spreadsheet of capability is a directory row; every row is callable from here. Layers 1, 2, 4, and 5 all funnel through this one endpoint.

### Layer 4 — durable execution
- **DeliverWorkflow** (Cloudflare Workflow) on the sibling Worker. Polls `pending_deliveries`, fans out per-job calls to `/api/deliver`, retries 3× exponential.
- **Sibling cron** (`*/5 * * * *`) triggers `/api/deliver` on Pages.
- **Queue** (`loop-tasks`) for any async job pushed via `QUEUE_SEND`; consumer in the sibling Worker forwards to `/api/dispatch`.

### Layer 5 — ledger + capability extension
- Every outbound HTTP and every dispatch writes a row to `LEDGER.events` (full request + response, secrets redacted).
- Universe-to-row pipeline: `DISCOVER_SOURCE` (fetch URL → R2) → `EXTRACT_CAPABILITIES` (Workers AI Llama → JSON ops) → `PROPOSE_ROWS` (emit SQL INSERTs) → `TEST_ROW` / `TEST_ALL` (run directory_tests against the new rows, write to `fidelity_log`) → `GAP_REPORT` (diff against existing keys).
- `LOG_ASSET` writes every asset (sent image, generated image, ref image) to the `assets` table.

---

## 7. The LLM duality — internal vs. external

The build runs two kinds of model:

### 7a. External models (default, expensive, smart)
- **xAI Grok** is the default brain. `ROUTER`, `ARCADS`, `CF_EXPERT`, the per-task agents all default to `grok-4.3`. Reasoning is set to none across the build (CLAUDE.md law — native reasoning bricked the build once).
- **Anthropic Claude / Google Gemini / OpenAI GPT / Moonshot Kimi** are reachable as `ASK_*` agent rows. The router can delegate to any of them on demand.
- **Cloudflare AI Gateway** sits in front of several of these (`GW_*` rows) — caching, retries, observability, per-request cost capture.
- Provider keys live in the Secrets Store; auth resolved per-call by `applyAuth(row.auth, headers, env, url)`.

### 7b. Internal models (cheap, fast, local)
- **Workers AI** (`env.AI`) is the in-process executor. No round-trip to a vendor — runs on Cloudflare's own GPUs.
- Used today by `WAI_RUN` (chat), `WAI_EMBED` (vector), `WAI_T2I` (image), `WAI_TRANSLATE` (m2m100), `EXTRACT_CAPABILITIES` (Llama 70B fp8-fast extracting JSON from raw docs), and the sibling Worker's `ExpertDO.chat`.

### 7c. How they function together

- **External as the brain, internal as the muscle.** Grok handles the planning, conversation, tool-choice, multi-turn agentic emission. Workers AI handles bulk-low-cost work: embeddings of every event for RAG, capability extraction from docs, translation, image generation when ArcAds credits aren't worth burning, slug expansion if/when a router-emitted slug needs interpretation by a cheap model before being dispatched.
- **Durable Object as the expert seat.** Each `ExpertDO` named instance (`CF_EXPERT`, `STRIPE_EXPERT`, `GITHUB_EXPERT`, ...) is a stateful container that can hold its own conversation history, its own RAG index, its own system prompt scoped to one domain. The router delegates to a named expert by POSTing to `/do/expert/chat?name=<EXPERT>`. The DO can call Workers AI internally (cheap path) or a vendor (smart path) per question.
- **Two-stage tool discovery.** With ~262 directory rows, dumping the full catalog into every router system prompt is wasteful. The current default still injects `{{TOOLS}}`. The intended steady-state: router holds a category manifest (`{{CATEGORIES}}`) and asks for `TOOLS_IN:<category>` or `TOOLS_SEARCH:<query>` when it needs more. Token-cost analysis is in `docs/CF_FEATURES.md` neighborhood.
- **Watcher gates the dangerous edges.** Any sensitive=1 dispatch — Stripe writes, destructive CF ops, directory deletes, shell `rm -rf /`, force-push — goes through `watch_rules` regex match first. The watcher is itself a directory row; rules are managed via three more directory rows.

---

## 8. Recommendations and opinions

This is the section you asked for. Numbered. Not a menu — these are the things I'd ship next in priority order if you said go again.

### 8a. APIs / external services worth adding

1. **Cloudflare Vectorize** as the embedding store. Pair with `WAI_EMBED` to index every row in `LEDGER.events` (with PII fields hashed via `SHA256_LOWER`). Result: the router can `[RAG]<question>[/RAG]` against the build's entire history before answering. Highest leverage move you have not made.
2. **Cloudflare AI Gateway** is already wired but only partially used (`GW_*` rows route 3 specific calls through it). Move every external LLM call behind the gateway. Single observation layer, single cache, single budget cap.
3. **Cloudflare Email Routing + Email Sending** as a 4th channel. Same `WEBHOOK_INTAKE` shape, one new parser. Inbound email triage by Workers AI is cheap and unlocks any partner / vendor pipeline that defaults to email.
4. **Cloudflare Browser Rendering Puppeteer mode** (the `MYBROWSER` binding is staged). REST already works; Puppeteer mode unlocks form fills, multi-step flows, login walls.
5. **Stripe Connect / SetupIntent** if you ever want recurring billing — the current invoice path is one-shot. Not blocking until you actually need subscriptions.
6. **Linear or Notion via MCP** for ops tracking — MCP servers already exist for both, the `MCP` row's target_map is the path.

### 8b. CLIs worth wrapping (LOCAL_EXEC on the Mac bridge)

Beyond the wrangler set already wired:
1. `wrangler vectorize list/create/insert/query` — directly mirrors what you'd hit via REST but with CLI ergonomics.
2. `wrangler workflows list / instances` — observability.
3. `wrangler tail` with `--format json` — pipe into your ledger.
4. `gh workflow run` — fire any repo workflow from a directory row.
5. `wrangler containers` once Cloudflare Containers is GA — the path to "always-on domain experts" that DO cannot give you because DO is request-driven.

### 8c. Repos worth reading

Mentioned in your standing instruction:
- `cloudflare/workers-sdk` — Wrangler + Miniflare + SDK source. Look at `packages/wrangler/src/browser` for the new `wrangler browser` CLI shape (you have the docs already).
- `cloudflare/cloudflare-docs` — diff target for `CF_API_GAPS.md`.
- `cloudflare/cloudflare-typescript` — official client. Cross-reference your `target_map` against the schema and you'll find the still-missing namespaces (cache, firewall, load_balancers, rulesets, magic, pipelines, containers, registrar, durable_objects sub-paths) per `CF_API_GAPS` output.
- `cloudflare/agents` — Agents SDK. Useful as a pattern source for `ExpertDO`. Don't migrate to it — your directory pattern is more flexible.
- `cloudflare/templates` — workflows, queues, cron, browser-rendering examples. The DeliverWorkflow class in this repo is based on the workflows template.

### 8d. Architecture-pattern recommendations

1. **Stop dumping `{{TOOLS}}` into the router by default.** Replace with `{{CATEGORIES}}` (one line) and let the router ask for `TOOLS_IN:<cat>` or `TOOLS_SEARCH:<q>` on demand. The fns + rows exist. The savings are ~10K input tokens per router turn at the cost of one extra turn for unfamiliar tools. Quantified in `docs/INVESTIGATE.md`.
2. **Promote the watcher to a "pre-flight" tag the router emits.** Any sensitive operation is currently denied silently from the dispatcher side. Better UX: when the router intends a sensitive call, it first emits `[WATCH_ACTION]<KEY>|<body>[/WATCH_ACTION]`, sees the verdict, and if denied, explains in `[REPLY]` instead of the user seeing `ERR:watcher:denied:...`.
3. **DO-backed experts should hold RAG state, not just chat history.** Each `ExpertDO` should own a small Vectorize index scoped to its domain. `CF_EXPERT.DO.state` holds CF docs embeddings; `STRIPE_EXPERT.DO.state` holds Stripe API references. The DO becomes a self-contained domain server.
4. **Workflows for every >5-second job.** Anything that polls or retries (deliver loop, ArcAds wait, sheets push verify, fidelity sweep) belongs in a Workflow. Today only `deliver-workflow` is real. The pattern is: replace `setTimeout(fetch)` self-rechains with workflow-class `step.do(...)` blocks.
5. **Test as the leash.** `TEST_ALL` works but nothing schedules it. (Not suggesting auto-cron.) Instead: gate every `EDIT_ROW` / `ADD_ROW` on a successful `TEST_ROW` if the row has `directory_tests`. The dispatcher already has the watcher hook; this is the next hook.
6. **Universe-to-row should auto-flag duplicates.** `GAP_REPORT` returns `missing_ops`. The natural follow-up is auto-PROPOSE only the rows that aren't already covered. Wire `EXTRACT_CAPABILITIES` → `GAP_REPORT` → `PROPOSE_ROWS(only_missing)` as one flow `INGEST_SOURCE`.

### 8e. Evaluation recommendations

1. **Treat `LEDGER.events` as the eval set.** Every router turn already has a request, a response, and (via the next turn's `LOG_ASSET` or `[REPLY]`) a downstream signal. Add a column `verified_correct INTEGER` and let yourself flag examples from `/admin/ledger`. Once you have ~100 marked rows, `EXTRACT_CAPABILITIES`-style llama calls can score new turns against the corpus.
2. **Per-row `last_verified` timestamps.** Add a column on `directory` populated by every `TEST_ROW` run. `/admin/directory` greys out rows older than N days. Forces the build to stay verified rather than rotting.
3. **Cross-model panels for hard decisions.** `PANEL` row already exists. Underuse. For any architectural decision (e.g. "should we add row X"), the panel should fire Grok / Claude / Kimi in parallel, judge, synthesize. Cheaper than wrong rows in the directory.

### 8f. Defects in the current shape worth knowing

1. The `routeInbound` background POST to `/api/turn` is a fire-and-forget. If the Worker is reaped before the POST flushes, the turn is lost. This used to be backstopped by the GH Actions heartbeat; now it's backstopped by the sibling cron's `POST /api/deliver`, which only sweeps `pending_deliveries`, not lost turn jobs. The right fix is to enqueue the turn job on `loop-tasks` instead of HTTP-self-posting.
2. `routeInbound` lives in `blooio.js`. It's imported by `webhook_intake.js` and called for all three channels. That's fine but the name is a relic — should be in `_lib/turn.js` and the export removed from `blooio.js`. Cosmetic.
3. The `admin/manual.js` HTML has a banner saying it's historical but still contains the actual stale tables. A proper rewrite would generate the page from `/api/directory`. Costs ~150 lines net.
4. Three Stripe invoice fns share a customer+item+invoice+finalize+SMS shape. Already extracted helpers (`stripeHeaders`, `stripeForm`, `stripePost`, `blooioSend`) and refactored — but the three fns still each have their own slightly different "what to return" shape. Could collapse to one parameterized fn `stripeInvoiceFlow(env, mode, ...)` if you ever revisit.
5. The `ROUTER` agent's system prompt is currently the two-clause minimum from the override session. That works for now but means the router has no context about: who the owner is, which phone numbers route where, what categories of work exist. Add this back as a `{{IDENTITY}}` injection that the dispatcher fills from `directory.OWNER_IDENTITY` instead of inlining.
6. `2chat.js` still imports `dispatch` from `./api/dispatch.js`. After the shim collapse, that import is unused. Cleanup task.
7. `functions/api/deliver.js` still has the 100-line per-job polling logic. The workflow only wraps the OUTER retry; the inner loop is still imperative. A complete migration would move the per-job logic into `step.do('poll asset', ...)` blocks inside `DeliverWorkflow.run()`.

### 8g. The biggest unsolved problem

The router prompt is the smallest functioning version. That's a forced minimum, not a design. The natural evolution: turn the router itself into a directory-driven thing — its system prompt assembled at dispatch time from `{{IDENTITY}} {{CHANNEL_RULES}} {{REPLY_FORMAT}} {{TOOL_DISCOVERY}}`, each block being its own directory row that can be edited independently. The router becomes the FIRST instance of the universe-to-row pattern applied to itself.
