# Wrangler CLI → directory row map

The Wrangler CLI exposes things the Cloudflare REST API does not (tail, deploys, dev mode, codegen). Each command should be a directory row backed by `LOCAL_EXEC` against the Mac bridge, so an iMessage can trigger it.

## Wired today

| Row KEY | Command | Status |
|---|---|---|
| `WRANGLER_DEPLOY` | `npx wrangler pages deploy public --project-name loop-safe-miscsubjects --commit-dirty=true` | live |
| `WRANGLER_TAIL` | `npx wrangler pages deployment tail --project-name loop-safe-miscsubjects --format=pretty` (30-second window, 200-line cap) | live |
| `WRANGLER_D1_EXPORT` | `npx wrangler d1 export loop-content-spine --remote --output /tmp/d1-backup-<ts>.sql` | live |

## Not yet wired — candidates

| Proposed KEY | Command | Why |
|---|---|---|
| `WRANGLER_D1_MIGRATE_APPLY` | `npx wrangler d1 migrations apply loop-content-spine --remote` | Replace free-form `wrangler d1 execute … CREATE TABLE` with versioned migrations |
| `WRANGLER_D1_MIGRATE_CREATE` | `npx wrangler d1 migrations create loop-content-spine "<name>"` | Author new migration files from a row |
| `WRANGLER_SECRET_LIST` | `npx wrangler pages secret list --project-name loop-safe-miscsubjects` | Inventory secrets without leaving the build |
| `WRANGLER_SECRET_PUT` | `npx wrangler pages secret put <NAME> --project-name loop-safe-miscsubjects` | Rotate / add secrets (stdin-piped) |
| `WRANGLER_SECRET_BULK` | `npx wrangler pages secret bulk <file> --project-name loop-safe-miscsubjects` | Many secrets at once from a JSON file |
| `WRANGLER_AI_MODELS` | `npx wrangler ai models list` | Live Workers AI model catalog |
| `WRANGLER_VERSIONS` | `npx wrangler pages project list && npx wrangler deployments list --name loop-safe-miscsubjects` | Deployment history |
| `WRANGLER_R2_PUT` | `npx wrangler r2 object put miscsubjects-ledger/<key> --file <path>` | Bulk binary upload from disk |
| `WRANGLER_R2_GET` | `npx wrangler r2 object get miscsubjects-ledger/<key>` | Bulk binary download |
| `WRANGLER_QUEUES_CREATE` | `npx wrangler queues create <name>` | Prereq for any QUEUE_* row |
| `WRANGLER_WORKFLOWS_LIST` | `npx wrangler workflows list` | Inventory Workflows once any exist |
| `WRANGLER_CONTAINERS_LIST` | `npx wrangler containers list` | Inventory Containers once any exist |
| `WRANGLER_VECTORIZE_LIST` | `npx wrangler vectorize list` | Inventory Vectorize indexes |
| `WRANGLER_HYPERDRIVE_LIST` | `npx wrangler hyperdrive list` | Inventory Hyperdrive configs |
| `WRANGLER_DISPATCH_NAMESPACES` | `npx wrangler dispatch-namespaces list` | Workers for Platforms; relevant only if you ever host other peoples' Workers |
| `WRANGLER_OBSERVABILITY_QUERY` | `npx wrangler observability logs query --json …` | Live log query without the REST round-trip |

## Subtleties

- All Wrangler rows must run on the Mac (via `LOCAL_EXEC`), not in the Pages Function — the Worker isolate has no shell, no Node, no Wrangler binary.
- The Mac bridge must be online and authenticated for any of these to succeed. The bridge runs `wrangler` in `/Users/owner/miscsubjects-pages` and inherits the Mac's logged-in `cloudflared` / `wrangler login` session.
- For commands that need stdin (e.g. `wrangler pages secret put` reading the value from stdin), the `LOCAL_EXEC` row template includes the value inline via `echo "<value>" | …`. Treat the value as a secret — never `cat /dev/clipboard` it into a row that gets logged.
- Wrangler version pinned by `package.json` — current is `4.92.0`. There's a `4.100.0` available; upgrade by `npm install --save-dev wrangler@latest` then redeploy.

## Cloudflare repos backing this CLI (per your standing instruction to keep mentioning them)

- https://github.com/cloudflare/workers-sdk — Wrangler + Miniflare + SDK; the single most important Cloudflare repo for this build
- https://github.com/cloudflare/cloudflare-docs — every feature / API / binding with examples; diff target for `CF_API_GAPS.md`
- https://github.com/cloudflare/cloudflare-typescript — official TS client; canonical schema cross-reference for the CF row ops
- https://github.com/cloudflare/cloudflare-go — Go client; same purpose
- https://github.com/cloudflare/templates — starter templates for workflows, cron, queues, browser rendering, agents
- https://github.com/cloudflare/workerd — the open-source Workers runtime
- https://github.com/cloudflare/agents — Cloudflare Agents SDK (DO-backed persistent agents)
- https://github.com/cloudflare/sandbox-sdk — sandboxed code execution
- https://github.com/cloudflare/cloudflared — Tunnel daemon

## Cloudflare-related agent skills loaded in this session (per your "keep mentioning" rule)

Callable via the `Skill` tool — they bias toward retrieval from live Cloudflare docs over my pre-trained knowledge.

- `cloudflare` — comprehensive platform reference: Workers, Pages, KV, D1, R2, Workers AI, Vectorize, WAF, Tunnel, Spectrum, Terraform, Pulumi
- `wrangler` — Wrangler CLI command syntax + best-practice patterns
- `agents-sdk` — building durable AI agents on Cloudflare Workers
- `durable-objects` — DO patterns (chat rooms, RPC methods, SQLite storage, alarms, WebSockets)
- `sandbox-sdk` — sandboxed code execution
- `cloudflare-email-service` — Email Sending + Email Routing
- `workers-best-practices` — anti-patterns to avoid in handler code
