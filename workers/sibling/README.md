# loop-safe-sibling

Sibling Cloudflare Worker that hosts the surfaces the Pages project cannot:

- **Cron Triggers** — `*/1 * * * *` every minute: deliver heartbeat, optional `todo_autorun` / `protocol_autorun`, and **`writer_queue_autorun`** (peptide write/populate queue — one `POST /api/protocol/run?role=writer-queue` per tick when KV `writer_queue_autorun=1`). See `docs/PEPTIDE_KNOWLEDGE_REPO.md`.
- **Durable Objects** — `ExpertDO` class. Each named DO is a stateful expert (CF_EXPERT, STRIPE_EXPERT, ...) with its own SQLite state via `state.id`. Reached at `/do/expert/ping?name=<id>` and `/do/expert/chat?name=<id>` (POST `{messages, model}`).
- **Queue consumer** — drains `loop-tasks` queue and forwards each job as `POST /api/dispatch {key, body}`. Producer is the Pages dispatcher (binding to be added in next iteration).
- **Workers AI** — `[ai]` binding, same model catalog as the Pages project.

## Deploy

From this directory:
```
npx wrangler deploy
```

Worker URL after first deploy: `https://loop-safe-sibling.<your-subdomain>.workers.dev` (or a custom route).

## Add browser rendering

Browser Rendering is per-account opt-in. After enabling at https://dash.cloudflare.com/<CLOUDFLARE_ACCOUNT_ID>/workers/browser-rendering , uncomment the `browser` binding in `wrangler.toml` and redeploy.

## Add a queue

```
npx wrangler queues create loop-tasks
```
Then uncomment the `[[queues.producers]]` / `[[queues.consumers]]` block in `wrangler.toml` and redeploy.

## Wire from the Pages dispatcher

Add a directory row pointing at this Worker:

```
INSERT INTO directory (key, type, target, auth, content, category) VALUES
('SIBLING_DO_CHAT', 'http', 'POST https://loop-safe-sibling.<subdomain>.workers.dev/do/expert/chat?name=$1', '',
'# Chat with a named expert DO instance. $1=expert name (CF_EXPERT, STRIPE_EXPERT, ...). $2=JSON body {messages, model}.
{"messages":$$2.messages,"model":$$2.model}', 'expert');
```

Then iMessage triggers like "ask the CF expert about workflows" route to that row.
