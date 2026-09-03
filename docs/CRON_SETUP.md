# Cron setup — loop-safe-miscsubjects

The project uses a **separate Cloudflare Worker** (`workers/sibling`) for cron triggers because Cloudflare Pages Functions do **not** support `[triggers] crons`.

## What is already running

The sibling Worker (`loop-safe-sibling`) is deployed with:

```toml
# workers/sibling/wrangler.toml
crons = ["*/5 * * * *"]
```

Every 5 minutes it performs these actions (all fire-and-forget, one item per tick):

| # | Action | KV gate | Notes |
|---|--------|---------|-------|
| 1 | Writes a heartbeat row to D1 `log` with `key='sibling.cron'` | none | Confirms the cron is alive. |
| 2 | `POST https://miscsubjects.com/api/deliver` | none | Polls pending deliveries. |
| 3 | `POST /api/dispatch {key:"TODO_RUN"}` | `todo_autorun == "1"` | Claims and runs one open to-do task. |
| 4 | `POST /api/protocol/run?role=writer` | `protocol_autorun == "1"` | Claims and runs one open protocol/writer job. |
| 5 | `GET /admin/ledger?github_poll=1&n=15` | none | Idempotently folds new GitHub commits into the ledger. |

## KV namespace

All cron gates live in the same KV namespace:

```
Namespace ID: 58b303e666a8431685624e0cfd2fd63f
Preview:     58b303e666a8431685624e0cfd2fd63f  (same namespace used for prod)
```

Current state (as of this writing):

```
protocol_autorun  → not set (cron recursion OFF)
todo_autorun      → not set (auto to-do runner OFF)
```

## Enable protocol recursion (cron-driven protocol ticks)

Run from `miscsubjects-pages`:

```bash
# If you have a stale CLOUDFLARE_API_TOKEN in the shell, unset it so Wrangler uses OAuth.
unset CLOUDFLARE_API_TOKEN

npx wrangler kv key put protocol_autorun 1 \
  --namespace-id 58b303e666a8431685624e0cfd2fd63f \
  --remote
```

Verify:

```bash
npx wrangler kv key get protocol_autorun \
  --namespace-id 58b303e666a8431685624e0cfd2fd63f \
  --remote
```

Expected output: `1`

Disable:

```bash
npx wrangler kv key put protocol_autorun 0 \
  --namespace-id 58b303e666a8431685624e0cfd2fd63f \
  --remote
```

Or delete the key entirely:

```bash
npx wrangler kv key delete protocol_autorun \
  --namespace-id 58b303e666a8431685624e0cfd2fd63f \
  --remote
```

## Enable the to-do runner

Same pattern, different key:

```bash
unset CLOUDFLARE_API_TOKEN
npx wrangler kv key put todo_autorun 1 \
  --namespace-id 58b303e666a8431685624e0cfd2fd63f \
  --remote
```

## Run a protocol tick manually (no cron needed)

```bash
curl -X POST https://miscsubjects.com/api/protocol/run?role=writer \
  -H 'content-type: application/json' \
  -H 'x-terminal-key: <TERMINAL_KEY>'
```

## Verify the cron is firing

Query the last few cron heartbeats in D1:

```bash
unset CLOUDFLARE_API_TOKEN
npx wrangler d1 execute loop-content-spine --remote --json \
  --command "SELECT ts, key, type, input FROM log WHERE key='sibling.cron' ORDER BY id DESC LIMIT 5"
```

You should see rows stamped at 5-minute intervals.

## Change the schedule

Edit `workers/sibling/wrangler.toml`, then redeploy the sibling Worker:

```bash
cd workers/sibling
unset CLOUDFLARE_API_TOKEN
npx wrangler deploy
```

## Important caveats

- **One item per tick.** The cron is intentionally slow-and-steady to stay inside the Cloudflare 100s request cap. It will not drain a large backlog quickly.
- **Protocol recursion is currently OFF.** Enabling `protocol_autorun=1` will cause the cron to start consuming open writer/protocol tasks every 5 minutes and posting model calls. Make sure the terminal key, model keys, and budget are ready before flipping it on.
- **To-do runner is currently OFF.** Enabling `todo_autorun=1` will cause the cron to start running the next open task from the generic task queue.
