# Cloudflare features inventory

One row per Cloudflare feature. Columns: enabled in account, configured in this build, directory row exists, callable end-to-end, used by something today, priority.

Status legend: ✓ = true / yes. ✗ = false / no. ? = unverified. — = N/A.

| Feature | Acct enabled | Build configured | Directory row | Callable | Used | Priority |
|---|---|---|---|---|---|---|
| **Workers** (account-wide) | ✓ | — Pages project, not Workers | — | — | — | high — sibling Worker needed for cron / queues / DO |
| **Pages** (this project: loop-safe-miscsubjects) | ✓ | ✓ wrangler.toml | `CF` ops `pages_list`, `pages_get`, `pages_patch`, `pages_deployments`, `pages_deploy_retry`, `pages_env_vars` | ✓ verified `pages_list` HTTP 200 | ✓ this entire build | live |
| **D1** (loop-content-spine + loop-shared-events) | ✓ | ✓ `[[d1_databases]]` ×2 | `D1_QUERY`, `D1_EXEC`, `D1_TO_2D_ARRAY`, `CF` ops `d1_list`/`d1_get`/`d1_query_remote` | ✓ | ✓ directory, log, ledger, pages, articles, etc. | live |
| **KV** (1 namespace) | ✓ | ✓ `[[kv_namespaces]]` | `KV_GET`, `KV_PUT`, `KV_DEL`, `KV_LIST`, `KV_GET_JSON`, `KV_PUT_JSON`, `KV_APPEND`, `INVALIDATE_DIR_SNAPSHOT`, `CF` ops `kv_list_ns`/`kv_list_keys`/`kv_bulk_write` | ✓ | ✓ directory cache, convo state, audio mode | live |
| **R2** (miscsubjects-ledger) | ✓ | ✓ `[[r2_buckets]]` | `R2_GET`, `R2_PUT`, `R2_DEL`, `R2_LIST`, `CF` ops `r2_list_buckets`/`r2_create_bucket`/`r2_delete_bucket` | ✓ | ✓ generated images, file uploads | live |
| **Workers AI** | ✓ | ✓ `[ai]` binding | `WAI_RUN`, `WAI_EMBED`, `WAI_T2I`, `WAI_TRANSLATE`, `CF` ops `ai_models`, `ai_models_text_gen`, `ai_run` | ✓ verified llama-3.1-8b, bge-base-en, m2m100-1.2b | ✗ not used by build yet | high — cheap inline executor; replaces some Grok calls |
| **Vectorize** | ? | ✗ no binding in wrangler.toml | `CF` op `vectorize_list` (REST only) | ✓ REST only | ✗ | medium — pair with `WAI_EMBED` for RAG over your own log/ledger |
| **Hyperdrive** | ? | ✗ | `CF` op `hyperdrive_list` | ✓ REST only | ✗ | low — only matters if you add an external Postgres |
| **Queues** | ? | ✗ no producer/consumer bindings | `CF` op `queues_list`, `queues_get` | ✓ REST only | ✗ | high — replaces fragile internal `fetch('/api/turn',...)` self-chains |
| **Cron Triggers** | ✓ (Workers only) | ✗ — Pages Functions does NOT support `[triggers] crons` | `CF` op `cron_triggers_get` | ✓ REST only | ✗ | high — would move heartbeats off GitHub Actions; requires a sibling Worker |
| **Workflows** | ✓ | ✗ | `CF` op `workflows_list` | ✓ REST only | ✗ | high — replaces `deliver.js` retry/poll loop with durable execution |
| **Durable Objects** | ✓ | ✗ — Pages does NOT support DO bindings | `CF` op `do_namespaces_list`, `do_namespace_objects` | ✓ REST only (returns empty: no DOs registered) | ✗ | high — the path to "dedicated Cloudflare-expert / Stripe-expert / GitHub-expert LLMs" living server-side |
| **Containers** | ? beta | ✗ | none yet | — | ✗ | medium — long-running expert processes; alternative to DO for heavier workloads |
| **Browser Rendering** | ? | ✗ no `[[browser]]` binding | `CF` op `browser_rendering_list` if added | — | ✗ | high — replaces `BROWSER_PLAYWRIGHT` / `BROWSER_USE` LOCAL_EXEC rows that require the Mac to be online |
| **Stream** | ? | ✗ | `CF` op `stream_list` | ✓ REST only | ✗ | low — only matters if you host video |
| **Cloudflare Images** | ? | ✗ | `CF` op `images_list` | ✓ REST only | ✗ | low — R2 already holds images |
| **DNS** (whatever zone holds miscsubjects.com) | ✓ | — | `CF` ops `dns_list`, `dns_create`, `dns_update`, `dns_delete`, `zones_list`, `zone_get`, `worker_routes` | ✓ REST | ✗ called only ad-hoc | medium |
| **Email Routing** | ? | ✗ | `CF` op `email_routing` | ✓ REST only | ✗ | medium — adds a 4th inbound channel beside Bloo io / 2chat / Telegram |
| **Cloudflare Email Sending** | ? | ✗ | none | — | ✗ | medium — adds 4th outbound channel |
| **Tunnel** (cloudflared) | ? | ✗ | `CF` op `tunnels_list` | ✓ REST only | ✗ | low |
| **Zero Trust / Access** | ? | ✗ | `CF` op `access_apps` | ✓ REST only | ✗ | medium |
| **WAF / Firewall** | ✓ (acct level) | — | no row | — | ✗ | low |
| **Analytics** | ✓ | — | `CF` op `analytics_dash` | ✓ REST only | ✗ | medium |
| **Logpush** | ? | ✗ | `CF` op `logpush_jobs` | ✓ REST only | ✗ | medium — would dump logs to R2 / S3 / Sentry |
| **Observability (Workers logs)** | ✓ | — | `CF` op `observability_query` | ✓ REST only | ✗ | high — live trace querying without going through D1 `log` table |
| **Secrets Store** | ✓ | ✓ live (CLOUDFLARE_API_TOKEN, GLOBAL_KEY, EMAIL, ACCOUNT_ID bound) | `CF` ops `secrets_stores`, `secrets_list`, `secrets_create` | ✓ REST | ✓ all Pages secrets | live |
| **Audit Logs** | ✓ | — | `CF` op `account_audit_logs` | ✓ REST only | ✗ | medium |
| **Subscriptions / Billing** | ✓ | — | `CF` op `account_subscriptions` | ✓ REST only | ✗ | low |
| **Account / User** | ✓ | — | `CF` ops `user`, `accounts_list`, `tokens_verify`, `user_tokens_list` | ✓ | ✓ token-verify is the smoke test | live |

## Highest-leverage gaps to close next

In priority order:

1. **Sibling Worker** that adds Cron Triggers + Queues consumers + Durable Objects bindings. Pages Functions cannot host any of these. Without it, three of the highest-priority CF surfaces stay locked. The sibling Worker calls back into the Pages dispatcher via `https://miscsubjects.com/api/dispatch` for non-DO work; for DO work it dispatches directly.

2. **Browser Rendering binding**. One `[[browser]]` line in the sibling Worker's `wrangler.toml`, plus a `CF_BROWSER_FETCH` directory row using the binding. Eliminates the Mac-online dependency of every existing `BROWSER_*` LOCAL_EXEC row.

3. **Workflows** for the deliver/poll loop. `functions/api/deliver.js` (~100 lines of imperative retry/poll) becomes a Workflow class with durable execution.

4. **Vectorize index** + an embeddings pipeline pointed at the `log` and `grok_ledger` tables. `WAI_EMBED` already works.

5. **Email Routing** if you want a 4th channel.
