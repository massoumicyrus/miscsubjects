# Things to look into

## Inline-pinned reminders the owner wants me to keep mentioning

**Wrangler CLI** — the command-line tool you use to deploy and inspect this Pages project. Every interaction with Cloudflare from your Mac terminal in `/Users/owner/miscsubjects-pages` is `npx wrangler <...>`. Most-used commands in this repo:
- `npx wrangler pages deploy public --project-name loop-safe-miscsubjects --commit-dirty=true` — deploy the current working tree to production.
- `npx wrangler pages secret put <NAME> --project-name loop-safe-miscsubjects` — add or rotate a production secret (reads value from stdin).
- `npx wrangler pages secret list --project-name loop-safe-miscsubjects` — show every secret bound to the project.
- `npx wrangler d1 execute loop-content-spine --remote --command "<SQL>" --json` — run a SQL query against the production D1.
- `npx wrangler d1 execute loop-content-spine --remote --file <path.sql>` — apply a SQL file (multi-statement OK).
- `npx wrangler tail <worker-name>` — stream live logs (Workers only; Pages Functions use `wrangler pages deployment tail`).
- Full reference loaded into this session as the `wrangler` skill.

**Cloudflare repos worth pinning**: https://github.com/cloudflare/workers-sdk (Wrangler + Miniflare + SDK), https://github.com/cloudflare/agents (Agents SDK — durable AI agents on Workers), https://github.com/cloudflare/cloudflare-typescript (the official CF API TypeScript client — schemas you can cross-reference against my CF row ops), https://github.com/cloudflare/cloudflare-go (Go client, same purpose), https://github.com/cloudflare/templates (starter templates incl. workflows, cron, queues), https://github.com/cloudflare/workerd (the actual Workers runtime, open-source), https://github.com/cloudflare/sandbox-sdk (sandboxed code execution), https://github.com/cloudflare/cloudflared (Tunnel daemon).

**Cloudflare-related agent skills loaded in this session** (callable via the `Skill` tool):
- `cloudflare` — comprehensive platform reference covering Workers, Pages, KV, D1, R2, Workers AI, Vectorize, WAF, Tunnel, Spectrum, Terraform, Pulumi. Biases toward retrieving from Cloudflare docs over pre-trained knowledge.
- `wrangler` — Wrangler CLI command syntax + best-practice patterns for KV / R2 / D1 / Vectorize / Hyperdrive / Workers AI / Containers / Queues / Workflows / Pipelines / Secrets Store.
- `agents-sdk` — building durable AI agents on Cloudflare Workers with WebSockets, scheduled tasks, MCP servers, the Agent class, callable RPC, Workflows, durable execution, queues, retries, observability, React hooks.
- `durable-objects` — DO patterns (chat rooms, multiplayer, booking, RPC methods, SQLite storage, alarms, WebSockets). DO are how you'd build the "dedicated Cloudflare-expert LLMs" the owner mentioned.
- `sandbox-sdk` — sandboxed code execution for AI / interpreters / CI.
- `cloudflare-email-service` — Email Sending + Email Routing.
- `workers-best-practices` — anti-patterns to avoid in handler code.

If the owner wants the build to host its own Cloudflare-expert LLMs, the path is: enable Workers (separate from this Pages project), add Durable Objects bindings, give each DO its own state + system prompt + Workers-AI access, expose them via directory rows that POST to those DO endpoints.

## Direction worth pursuing — "universe-to-row" thesis

The pattern: external capability (API / CLI / repo / spec / SDK / doc) → extract operations → propose directory rows → smoke-test one safe call → log result → mark callable / blocked / idea. The build is already this shape; the next leverage is making the conversion process itself a flow row.

Concrete next-step rows that operationalize this:

- `DISCOVER_SOURCE` — given a URL (GitHub repo, OpenAPI spec, vendor docs page, MCP server endpoint), fetch and store the raw under `r2://capability_sources/`.
- `EXTRACT_CAPABILITIES` — given a stored source, return a JSON list `[{op, method, url|signature, args, body_shape}]`. Backed by a Workers AI Llama call or an agent row.
- `PROPOSE_ROWS` — given the capability list, output the SQL inserts for new directory rows. the owner reviews before running.
- `TEST_ROW` — given a KEY, run its positive + inverse `directory_tests` entries and write to `fidelity_log`.
- `GAP_REPORT` — diff `EXTRACT_CAPABILITIES(source)` against existing directory keys; surface what's missing.

## Watcher / gate pattern (cannibalize from ClawKeeper)

A separate row that runs BEFORE every dangerous dispatch. Proposed:

- `WATCH_ACTION` — given a proposed `{key, body}`, return `{allowed: bool, reason}`. Rules table in D1 lists kill conditions: write to Stripe without explicit `approved=1`, write to GitHub `main` without PR, write to a production secret, delete-anything, anything matching `rm -rf`.
- `APPROVE_ACTION` — the owner's manual override row that flips a pending action to allowed.
- `WATCH_DNS`, `WATCH_SECRET_EXFIL`, `WATCH_GITHUB_WRITE`, `WATCH_CLOUDFLARE_WRITE` — narrow watchers per risk surface.

## Expert rows (named, scoped, testable)

Each "expert" is a directory row of `type=agent` with a system prompt that contains ONLY its domain's docs + its domain's tool list + its tests:

- `CF_EXPERT` — knows Cloudflare API + Wrangler + every `CF_*` and `WRANGLER_*` row. System prompt seeded from `docs/CF_FEATURES.md` + `docs/WRANGLER_ROWS.md`.
- `WRANGLER_EXPERT` — narrower: CLI only.
- `D1_EXPERT` — D1 schemas + the existing `D1_QUERY` / `D1_EXEC` / `D1_TO_2D_ARRAY` rows.
- `GITHUB_EXPERT` — `GITHUB` http row + `FILE_GET` / `FILE_PUT` / `FILE_LIST` rows.
- `SHEETS_EXPERT` — `APPS_SCRIPT_RUN` + the airunner action catalog.
- `BLOOIO_EXPERT`, `SECURITY_EXPERT`, `STRIPE_EXPERT`.

Each expert row's system prompt is short and authoritative for its domain. The router delegates by emitting `[CF_EXPERT]<question>[/CF_EXPERT]` (or whichever) when the topic matches.

## MCP-as-rows

The MCP protocol already defines "tool discovery + tool call schema" for external servers. Treat each MCP server as a source for new directory rows:

- `MCP_LIST_TOOLS` — fetch a server's tool list.
- `MCP_CALL` — invoke one tool on one server.
- `MCP_IMPORT_AS_ROW` — turn an MCP tool spec into a directory row.

The current build has `mcp__context7_*` rows for one MCP server (`context7`). Generalize.

## Tests as the tyrant

Every directory row should require:

- `directory_tests` row (already exists in schema) with a positive test (expected substring / kind) and at least one inverse test.
- `fidelity_log` row written on each `TEST_ROW` run.
- A `last_verified` timestamp column on `directory` (does not exist yet — proposed migration).

Once `last_verified` is older than N days, the row is greyed in `/admin/directory` and excluded from `{{TOOLS_SEARCH}}` ranking until re-tested.

## Logs as training data

The `log` and `grok_ledger` tables already record (user ask, chosen row, args, response, latency, cost). One new flow row:

- `LOGS_TO_EVAL_SET` — periodic export of `log` rows tagged `verified_correct=1` into a JSONL eval set on R2. Replaces ad-hoc eval-set authoring.

## Recent dispatcher fixes worth knowing about

These were real bugs that blocked the Sheets sync and any http row using env vars or JSON-object args:

1. `subVars` was URL-encoding env-var values when substituting into a URL template. `$AIRUNNER_WEB_APP_URL` became `https%3A%2F%2Fscript...` and `fetch(url)` threw "Invalid URL". Fixed by making env-var substitution skip the URL escape (env vars in URL position are always full URLs, never user data). Also fixed in json-string mode (env vars there are JSON-string-encoded with proper backslash escaping).
2. No raw-substitution syntax existed for inlining a pre-formatted JSON value into a JSON body template. Added `$$NAME` (double-dollar) which inserts verbatim. `$NAME` (single dollar) still does mode-appropriate escaping.
3. `APPS_SCRIPT_RUN` row's content template was `{"action":"$1","args":$2}` — the `$2` got JSON-string-escaped, turning the args JSON-object into a backslash-escaped string. Changed to `$$2`.
4. CF row's body fields that take a single full-JSON-object arg (`ai_run.body=$3`, `cache_purge.body=$2`, `d1_query_remote.body=$3`, `kv_bulk_write.body=$3`, `pages_patch.body=$3`, `secrets_create.body=$3`, `observability_query.body=$2`) all switched from `$N` to `$$N`.

Going forward: when authoring a directory row whose content/body inlines a pre-formed JSON object or array, use `$$NAME`. When inlining a scalar string into a JSON value position, `$NAME` is correct.



Running list of APIs, CLIs, repos, features, and ideas the build does not use today but could. Owner-authored direction, not agent-decided. Append-only.

## Cloudflare-side, already capable but unused

| Capability | Why it could matter | First concrete step |
|---|---|---|
| **Workers AI** (`env.AI.run('@cf/...')` binding) | Llama / Mistral / Whisper / image models run on Cloudflare's GPUs. Pay per neuron, no separate provider. Lower-latency executor for slug expansion than calling out to xAI / Anthropic. | Add `[ai]` to wrangler.toml then call `env.AI.run('@cf/meta/llama-3.3-70b-instruct', {messages:[...]})` from one new fn row `CF_AI_RUN`. |
| **Cloudflare Cron Triggers** | Move heartbeats off GitHub Actions (which costs minutes against the account quota and writes nothing to D1 audit). Cron triggers run in the Worker isolate with full env access. | Add `[triggers] crons = ["*/5 * * * *"]` to wrangler.toml, add a `scheduled(event, env, ctx)` export, point the deliver loop + sheets sync at it. |
| **Cloudflare Queues** | Decouple `/api/turn` phase A → B → C from inline HTTP self-chains. Replaces `fetch('/api/turn', ...)` inside the same Worker with a queue producer + consumer, removes one round-trip per phase. | Enable Queues in account, add producer + consumer bindings, swap the `setTimeout`-style chains in `blooio.js:344, 402` and `deliver.js:124`. |
| **Cloudflare Workflows** (durable execution) | The ArcAds deliver-poll loop is hand-built around heartbeats. Workflows give it native retry, durable state, sleep-until-event. | Migrate `functions/api/deliver.js` to a Workflow class. |
| **Cloudflare Hyperdrive** | If anything ever talks to an external Postgres (Klaviyo Operations DB, internal warehouse), Hyperdrive caches the connection and SQL results at the edge. | Not blocking. Note only. |
| **Cloudflare Vectorize** | Embedding storage. The article corpus + grok_ledger + log table are RAG-shaped. Vectorize is the local store; pair with Workers AI embeddings. | Decide whether RAG over your own log/ledger is a use you want first. |
| **Cloudflare Browser Rendering** | Workers-callable headless browser. Replaces the `BROWSER_PLAYWRIGHT` / `BROWSER_USE` LOCAL_EXEC shells which require the Mac to be online. | One row `CF_BROWSER_FETCH` calling `env.MYBROWSER.fetch(url)` after adding the binding. |
| **Cloudflare Email Routing + Email Sending** | Inbound and outbound mail without an external provider. Pairs with Workers AI for inbound triage. | Adds a fourth channel alongside Blooio / 2chat / Telegram. |
| **Cloudflare Tunnel** | If anything self-hosted ever needs to be exposed without opening a port. | Not blocking. Note only. |
| **Cloudflare Pages Functions deployment promotion API** | Programmatic promote of preview → production via the `pages/projects/.../deployments/.../retry` endpoint already on the CF row. | One row `CF_PROMOTE_PREVIEW` wrapping the existing op. |

## Wrangler CLI commands the build doesn't use but could

| Command | What it would unlock |
|---|---|
| `wrangler pages deployment tail` | Live tail of production logs — equivalent of `kubectl logs -f`. No directory row wraps it. |
| `wrangler d1 export --remote` | Periodic D1 backups to R2 without writing the dump code by hand. |
| `wrangler d1 migrations create / apply` | Versioned schema changes instead of free-form `wrangler d1 execute ... CREATE TABLE`. |
| `wrangler r2 object cp / put / get` | Server-side R2 ops from the bridge without `curl`-ing the dispatcher. |
| `wrangler secret bulk` | Upload many secrets from a JSON file in one shot. |
| `wrangler ai models list` | Inventory of all Workers AI models the account can run. |
| `wrangler triggers deploy` | Re-deploy cron triggers without a full Pages deploy. |
| `wrangler tail --format=json` | Structured tail output — pipe into your ledger. |

## External LLMs / models worth knowing about

| Provider / model | What's interesting | First step |
|---|---|---|
| Cerebras-hosted Llama-3.1-8B / 70B | ~1800 tok/s, lowest TTFT in market. Right model for slug-expansion executors. | Get an account, add `CEREBRAS_API_KEY` to Secret Store, one new directory row `CEREBRAS_INSTRUCT`. |
| Moonshot Kimi K2 | Massive context, claimed reasoning quality close to Sonnet at fraction of cost. Tool-use shape similar to OpenAI. | API account, `KIMI_API_KEY` secret, one row. |
| Mistral Large 2 | Multilingual, strong tool use. | API account, secret, row. |
| Anthropic Haiku 4.5 | Direct from Anthropic — fast, cheap, JSON mode. Not currently used directly; the build uses Claude only via CLAUDE_CODE CLI wrapper. | `ANTHROPIC_API_KEY` secret, one row `CLAUDE_API`. |

## Other APIs / CLIs / things to look at

| Thing | Why |
|---|---|
| GitHub Codespaces / Workspaces API | Spin up a fresh dev env on demand from a directory row, run CI-like checks, tear down. |
| GitHub Actions: `gh workflow run` | Trigger any workflow from a build-side row instead of waiting on the schedule. |
| Apps Script Execution API (instead of the public web-app URL bridge) | OAuth'd direct call from CF Worker to GAS function. Removes the "anonymous access" requirement on the airunner deployment. |
| Stripe Connect / SetupIntents | The build currently only creates one-shot invoices. SetupIntent unlocks saving cards for recurring billing without hand-rolled invoice flows. |
| BigCommerce GraphQL Storefront API | Alongside the existing REST. Some queries are 5–10x cheaper to formulate as GraphQL. |
| Klaviyo Reports API (different from Events API) | Pre-aggregated metrics. The build today computes them from raw events. Switching saves D1 size and query time. |
| Triple Whale Sonar | Their newer attribution endpoint. Schema differs from the current TW row's URL. |
| Vercel AI SDK / Edge Functions | An alternative serverless runtime. Mention only — not a migration target unless you want it. |
| OpenAI Realtime API | Voice agent on `/voice` if you ever want phone calls. |
| Modal / Beam / RunPod | Cheap GPU-only compute for image / video generation, instead of paying ArcAds per credit. |
| `gh repo sync` / `gh repo create` | Automate forks of the build for testing. |
| Cloudflare Terraform provider | Codify the bindings and DNS that are currently click-only in the dashboard. |
| MCP servers in the registry (search via `mcp-registry`) | Pre-built tool servers that could replace hand-coded http rows. Right candidates: GitHub, Slack, Notion (already wired). |

## Capability gaps in the build itself (not external)

- Nothing in the build exposes the `LEDGER` D1 binding to the dispatcher. Six handlers read it directly.
- The `architecture` URL was deleted; if you want a "what is this build" reference, it needs a new directory-driven page reading from `directory` + `settings` + `wrangler.toml` so it cannot go stale.
- No directory row currently lists secrets or env vars from the Pages project (the CF row's `secrets_list` op is the closest, but no convenience wrapper).
- No row creates a new GitHub PR programmatically — the `GITHUB` http row supports it, no convenience wrapper exists.
