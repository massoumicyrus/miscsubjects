# Cloudflare / Wrangler capability inventory

What the build currently can call against Cloudflare, what it cannot, and what is available but not wired.

## Currently wired

| Surface | How it's called today | Directory KEY |
|---|---|---|
| D1 (loop-content-spine) | `env.DB.prepare(...).all()` inline + `D1_QUERY` / `D1_EXEC` rows | `D1_QUERY`, `D1_EXEC` |
| D1 (loop-shared-events / LEDGER) | `env.LEDGER.prepare(...)` inline only | NONE — no row exposes the LEDGER binding |
| KV | `env.KV.get/put/delete/list` inline + `KV_*` rows | `KV_GET`, `KV_PUT`, `KV_DEL`, `KV_LIST`, `KV_GET_JSON`, `KV_PUT_JSON`, `KV_APPEND` |
| R2 | `env.R2.get/put/delete/list` inline + `R2_*` rows + `/api/r2/<path>` REST | `R2_GET`, `R2_PUT`, `R2_DEL`, `R2_LIST` |
| Workers AI | NOT WIRED. No `env.AI.run(...)` calls in the repo. | none |
| Pages deployments | manual `npx wrangler pages deploy` via `LOCAL_EXEC` from the Mac bridge | `LOCAL_EXEC` (generic, not a Pages-specific row) |
| Cloudflare API (CF account, zones, dns, etc.) | one generic `CF` http row (target_map) | `CF` only |
| Secrets Store binding | one-shot `/admin/bind-secrets` POST | none in directory |

## What the `CF` directory row already covers (50+ sub-ops)

The single `CF` http row in the directory exposes a `target_map` with these ops. Invoke as `[CF]<op>|<args>[/CF]`. Auth uses `bearer:CLOUDFLARE_API_TOKEN`. The token must be in the Pages production env (see "How to wire CLOUDFLARE_API_TOKEN" below).

| Op | Args | Underlying URL |
|---|---|---|
| `user` | — | `GET /client/v4/user` |
| `token_verify` (alias `tokens_verify`, `verify`) | — | `GET /client/v4/user/tokens/verify` |
| `accounts_list` | — | `GET /client/v4/accounts` |
| `zones_list` | — | `GET /client/v4/zones` |
| `zone_get` | $1=zone_id | `GET /client/v4/zones/$1` |
| `workers_list` / `worker_list` | $1=account_id | `GET /client/v4/accounts/$1/workers/scripts` |
| `worker_get` | $1=account_id $2=script_name | `GET .../workers/scripts/$2` |
| `worker_delete` | $1=account_id $2=script_name | `DELETE .../workers/scripts/$2` |
| `worker_deployments` | $1=account_id $2=script_name | `GET .../workers/scripts/$2/deployments` |
| `worker_routes` | $1=zone_id | `GET .../zones/$1/workers/routes` |
| `pages_list` | $1=account_id | `GET .../accounts/$1/pages/projects` |
| `pages_get` | $1=account_id $2=project_name | `GET .../pages/projects/$2` |
| `pages_patch` | $1=account_id $2=project_name $3=body_json | `PATCH .../pages/projects/$2` |
| `pages_deployments` | $1=account_id $2=project_name | `GET .../pages/projects/$2/deployments` |
| `pages_deploy_retry` | $1=account_id $2=project_name $3=deployment_id | `POST .../pages/projects/$2/deployments/$3/retry` |
| `d1_list` | $1=account_id | `GET .../accounts/$1/d1/database` |
| `d1_get` | $1=account_id $2=db_id | `GET .../d1/database/$2` |
| `d1_query_remote` | $1=account_id $2=db_id $3=body_json | `POST .../d1/database/$2/query` |
| `kv_list_ns` | $1=account_id | `GET .../accounts/$1/storage/kv/namespaces` |
| `kv_create_ns` | $1=account_id $2=title | `POST .../storage/kv/namespaces` (form body) |
| `kv_delete_ns` | $1=account_id $2=ns_id | `DELETE .../storage/kv/namespaces/$2` |
| `kv_list_keys` | $1=account_id $2=ns_id | `GET .../storage/kv/namespaces/$2/keys` |
| `kv_bulk_write` | $1=account_id $2=ns_id $3=body_json | `PUT .../storage/kv/namespaces/$2/bulk` |
| `r2_list_buckets` | $1=account_id | `GET .../accounts/$1/r2/buckets` |
| `r2_create_bucket` | $1=account_id $2=name $3=locationHint | `POST .../r2/buckets` |
| `r2_delete_bucket` | $1=account_id $2=bucket | `DELETE .../r2/buckets/$2` |
| `dns_list` | $1=zone_id | `GET .../zones/$1/dns_records?per_page=100` |
| `dns_create` | $1=zone_id $2=type $3=name $4=content $5=ttl $6=proxied | `POST .../zones/$1/dns_records` |
| `dns_update` | $1=zone_id $2=record_id $3=type $4=name $5=content $6=ttl $7=proxied | `PUT .../zones/$1/dns_records/$2` |
| `dns_delete` | $1=zone_id $2=record_id | `DELETE .../zones/$1/dns_records/$2` |
| `ai_models` | $1=account_id | `GET .../accounts/$1/ai/models/search?per_page=100` |
| `ai_run` | $1=account_id $2=model $3=body_json | `POST .../ai/run/$2` |
| `vectorize_list` | $1=account_id | `GET .../accounts/$1/vectorize/v2/indexes` |
| `tunnels_list` | $1=account_id | `GET .../accounts/$1/cfd_tunnel` |
| `hyperdrive_list` | $1=account_id | `GET .../accounts/$1/hyperdrive/configs` |
| `queues_list` | $1=account_id | `GET .../accounts/$1/queues` |
| `stream_list` | $1=account_id | `GET .../accounts/$1/stream` |
| `images_list` | $1=account_id | `GET .../accounts/$1/images/v1` |
| `email_routing` | $1=zone_id | `GET .../zones/$1/email/routing/rules` |
| `logpush_jobs` | $1=zone_id | `GET .../zones/$1/logpush/jobs` |
| `access_apps` | $1=account_id | `GET .../accounts/$1/access/apps` |
| `cache_purge` | $1=zone_id $2=body_json | `POST .../zones/$1/purge_cache` |
| `analytics_dash` | $1=zone_id | `GET .../zones/$1/analytics/dashboard` |
| `secrets_stores` | $1=account_id | `GET .../accounts/$1/secrets_store/stores` |
| `secrets_list` | $1=account_id $2=store_id | `GET .../secrets_store/stores/$2/secrets?per_page=100` |
| `secrets_create` | $1=account_id $2=store_id $3=body_json | `POST .../secrets_store/stores/$2/secrets` |

The only thing blocking every one of these is `CLOUDFLARE_API_TOKEN` not being in the Pages production env.

## Still missing (genuinely not in `CF`)

| Capability | What it would take |
|---|---|
| Wrangler tail (live logs) | A new `WRANGLER_TAIL` http row backed by `LOCAL_EXEC` running `npx wrangler pages deployment tail --project-name loop-safe-miscsubjects`. The CF REST API does not expose a tail equivalent. |
| Workers AI direct binding | The `ai_run` op above goes via REST. The cheaper, lower-latency path is the Workers `env.AI` binding. That requires `[ai]` in wrangler.toml and a fn row calling `env.AI.run('@cf/...', {...})`. |
| Cloudflare Queues | Not enabled in wrangler.toml. Need `[[queues.producers]]` and `[[queues.consumers]]` bindings before any directory row makes sense. |
| Cloudflare Cron Triggers | Not in wrangler.toml. All scheduling is via GitHub Actions today. Adding `[triggers] crons = ["*/5 * * * *"]` plus a `scheduled()` export moves scheduling onto Cloudflare. |
| Cloudflare Logpush | Not configured. |
| Cloudflare Stream / Cloudflare Images native upload | The REST list ops are in `CF`. Upload + transform ops aren't wrapped. |

## How to wire `CLOUDFLARE_API_TOKEN` (literal clicks)

You said the secret already lives in your Cloudflare Secret Store. The remaining step is binding it to the Pages project's production env. Here is the exact path.

### Step A — confirm or create the secret in the Secret Store

1. Open https://dash.cloudflare.com/<CLOUDFLARE_ACCOUNT_ID>/secrets-store in your browser.
2. Look for a row named `CLOUDFLARE_API_TOKEN`. If present, skip to Step B.
3. If absent: click "Create secret". Field "Name": type `CLOUDFLARE_API_TOKEN`. Field "Value": paste a Cloudflare API token. Click "Save".
   - To create the token: open https://dash.cloudflare.com/profile/api-tokens in a new browser tab. Click "Create Token". Click "Create Custom Token". Permissions block — add these rows: `Account · Workers Scripts · Read`, `Account · Pages · Edit`, `Account · D1 · Read`, `Account · Workers KV Storage · Read`, `Account · Workers R2 Storage · Read`, `Account · Workers AI · Read`, `Account · Workers Tail · Read`, `Account · Account Settings · Read`, `User · User Details · Read`, `Zone · DNS · Read`, `Zone · Zone · Read`. Click "Continue to summary". Click "Create Token". Copy the token (shown once). Paste back into the Secret Store "Value" field. Click "Save".
4. Repeat for `CLOUDFLARE_ACCOUNT_ID`: Name `CLOUDFLARE_ACCOUNT_ID`, Value `<CLOUDFLARE_ACCOUNT_ID>`. Click "Save".

### Step B — bind both secrets to the Pages project production env

5. Open https://dash.cloudflare.com/<CLOUDFLARE_ACCOUNT_ID>/pages/view/loop-safe-miscsubjects/settings/environment-variables
6. Scroll to the "Production" section. Click "Edit variables".
7. Click "+ Add variable".
8. Variable name field: type `CLOUDFLARE_API_TOKEN`. Type dropdown: select "Secrets Store". Secrets Store dropdown: select your store. Secret dropdown: select `CLOUDFLARE_API_TOKEN`. Move on.
9. Click "+ Add variable" again. Name: `CLOUDFLARE_ACCOUNT_ID`. Type: "Secrets Store". Secret: `CLOUDFLARE_ACCOUNT_ID`.
10. Click "Save".

### Step C — redeploy so the new bindings activate

11. From your Mac terminal, in `/Users/owner/miscsubjects-pages`, run: `npx wrangler pages deploy public --project-name loop-safe-miscsubjects --commit-dirty=true`.
12. Wait for the command to print a production URL line ending in `miscsubjects.com`.

### Step D — verify

13. Open https://miscsubjects.com/admin/bind-secrets in your browser. You should see JSON. Look for `"env_vars"` containing both `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, OR `"secrets_store_secrets"` containing both. Either confirms the bind.
14. From your Mac terminal: `curl -sS https://miscsubjects.com/api/dispatch -H "Content-Type: application/json" -d '{"key":"CF","body":"user"}'`. Expected response body: JSON containing `"success": true` and your Cloudflare account email.
15. Once verified: text the build "list my cloudflare workers". Expected reply contains the workers list JSON (the model translates to `[CF]workers_list|<CLOUDFLARE_ACCOUNT_ID>[/CF]`).

### Step E — declarative management going forward

16. The `BINDINGS` map in `functions/admin/bind-secrets.js` now includes `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. From your Mac: `curl -sS -X POST https://miscsubjects.com/admin/bind-secrets`. The response shows `"sent_bindings"` ending in those two names. This makes Step B redundant for future provisioning — `bind-secrets.js` is the single source of truth.

## Cloudflare repos and agent skills available in this session

| Skill / repo | What it covers | Recommended use here |
|---|---|---|
| `cloudflare` skill | Workers, Pages, KV, D1, R2, Workers AI, Vectorize, Tunnel, Spectrum, WAF, Terraform/Pulumi | General reference when wiring new CF surfaces |
| `wrangler` skill | wrangler CLI commands for Workers / KV / R2 / D1 / Vectorize / Hyperdrive / Workers AI / Containers / Queues / Workflows / Pipelines / Secrets Store | Required before any wrangler invocation |
| `workers-best-practices` skill | Production best practices, anti-patterns | Review-only |
| `agents-sdk` skill | Cloudflare Agents SDK (different from this build's directory pattern — a separate Cloudflare product) | Out of scope unless migrating |
| `durable-objects` skill | DO for state coordination, WebSockets, alarms | Not used in this build |
| `sandbox-sdk` skill | Sandboxed code execution | Not used |
| `cloudflare-email-service` skill | Email Sending + Email Routing | Not used |
| `vercel:*` skills | Vercel platform — irrelevant; this build is Cloudflare Pages | Ignore |

There is no Cloudflare CLI MCP wired into this session. `npx wrangler` from the Mac bridge is the only path. The Cloudflare REST API (`api.cloudflare.com/client/v4/...`) is reachable from any handler via `fetch` with a token in `env.CLOUDFLARE_API_TOKEN`, but no such token is referenced in the repo today.

## Wrangler config gaps relative to what's used

`wrangler.toml` currently declares: D1 (×2), KV (×1), R2 (×1). Missing or unused:
- No `[triggers] crons` — heartbeat is on GitHub Actions instead.
- No `[ai]` binding — Workers AI unavailable to handlers.
- No `[[queues.producers]]` / `[[queues.consumers]]`.
- No `[[durable_objects.bindings]]`.
- No `[vars]` block — all secrets are Secrets Store at runtime.

## What's needed before the inventory above can be acted on

1. `CLOUDFLARE_API_TOKEN` as a Pages secret if any of the `CF_*` REST rows are to call `api.cloudflare.com` directly.
2. `CLOUDFLARE_ACCOUNT_ID` and the zone ID for DNS rows.
3. A decision on whether to keep scheduling on GitHub Actions or move it to Cloudflare cron triggers. Cron triggers eliminate the workflow file and the public `/api/deliver` endpoint becomes a private `scheduled()` handler.
