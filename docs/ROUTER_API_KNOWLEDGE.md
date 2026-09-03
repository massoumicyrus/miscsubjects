# What the ROUTER must know to answer REST API & widget questions

This is the reference you append to the ROUTER system prompt (prompts/ROUTER.md) so it can answer any question about how to call the build over REST, what each endpoint does, and how widgets are produced.

## Core principle

The ROUTER is not an implementation manual. It is a routing layer. It needs just enough to know **which tag, curl, or directory row reaches which parcel**, plus the exact payload shape and auth rule for each call.

## Auth rule (applies to every mutating endpoint)

All `POST / PUT / PATCH / DELETE` calls require header `x-terminal-key: <TERMINAL_KEY>`.
`GET` calls are public unless noted.

## 1. Articles surface

- `GET https://miscsubjects.com/api/articles` — list all articles.
- `GET https://miscsubjects.com/api/articles/<slug>` — read one article (full JSON).
- `GET https://miscsubjects.com/api/articles/<slug>?format=post` — only the re-postable fields.
- `PUT https://miscsubjects.com/api/articles/<slug>` — replace article head.
- `PATCH https://miscsubjects.com/api/articles/<slug>` — merge new claims/sources without erasing.
- `DELETE https://miscsubjects.com/api/articles/<slug>` — blocked on protocol/tier0 articles.
- `GET https://miscsubjects.com/api/articles/<slug>/sources` — hash-chained source ledger.
- `GET https://miscsubjects.com/api/articles/<slug>/contributions` — every model's original post.
- `GET https://miscsubjects.com/api/articles/<slug>/provenance` — write/edit hash chain.
- `GET https://miscsubjects.com/api/articles/<slug>/revisions` — prior revisions.

## 2. Protocol / writer surface

Base contract: `GET https://miscsubjects.com/api/protocol`

- `POST /api/protocol/write` — write or draft an article.
  - body: `{ "ask": "what to write", "slug": "kebab-case", "web_search": true, "publish": true, "model": "grok/grok-4.3", "max_tokens": 3500 }`
  - `publish: false` returns JSON only, does not publish.
  - `mode: "outline"` + `items: [...]` returns outlines.
- `POST /api/protocol/draft` — publish JSON you already have.
- `POST /api/protocol/sources` — attach and verify sources on an existing article.
- `POST /api/protocol/review` — store a review pass.
- `POST /api/protocol/score` — recompute claim weights from reviews.
- `POST /api/protocol/contribute` — record a model's original post without changing head.
- `POST /api/protocol/populate` — Grok web-search loop that fills sources for a peptide/topic.
- `POST /api/protocol/inventory` — upsert items into pipeline table.
- `POST /api/protocol/outline` — store outline on a pipeline item.
- `GET /api/protocol/next?role=writer` — atomically claim next open task.
- `POST /api/protocol/run?role=writer` — run one protocol tick.

## 3. Tasks surface

- `GET https://miscsubjects.com/api/tasks?status=open` — list tasks.
- `GET https://miscsubjects.com/api/tasks?format=widgets` — sideways card page.
- `GET https://miscsubjects.com/api/tasks/next?role=writer` — claim next open job.
- `POST https://miscsubjects.com/api/tasks` — create a task.
- `POST https://miscsubjects.com/api/tasks/<id>/done` — mark done.
- `POST https://miscsubjects.com/api/tasks/<id>/reopen` — mark open.

## 4. Events / ledger surface

- `POST /api/event_log_ingest` — immutable webhook ingest.
- `GET /api/events` — list ledger events.
- `GET /api/events/<id>` — one event.

## 5. Vault surface

- `GET /api/vault/catalog` — all vault widgets (tasks, events, cards, claims, protected).
- `GET /api/vault/widgets` — widget JSON.
- `GET /api/vault/limits` — limits JSON.
- `POST /api/vault/ideas` — post an idea to the vault (becomes a task).
- `POST /api/vault/session-scan` — bounded session scan.

## 6. Dispatch surface

- `POST /api/dispatch` — run any directory row by key.
  - body: `{ "key": "KEY", "body": "args" }`
  - This is how CLI agents, webhooks, and the router itself trigger tools.

## 7. Widget architecture

Widgets are normalized JSON objects produced by `functions/_lib/vault_widgets.js`.

Shape:
```json
{
  "kind": "task|event|card|claim|protected",
  "id": "task:275",
  "title": "...",
  "body": "...",
  "status": "open",
  "ts": "2026-06-23T22:49:51Z",
  "href": "https://miscsubjects.com/admin/tasks",
  "hash": "a9a1b021",
  "meta": { "role": "writer", "google_task_id": null },
  "api": "https://miscsubjects.com/api/tasks?status=open"
}
```

Rendered by:
- `functions/admin/vault.js` — vault page rails.
- `functions/admin/tasks.js` — task grid.
- `functions/api/tasks/[[path]].js?format=widgets` — standalone widget page.
- Protected article widgets are in `functions/_lib/widgets.js` and `PROTECTED_WIDGETS.md`.

To activate a widget via REST: read its `.api` URL or `POST /api/dispatch` with the right key.

## 8. Directory tags the ROUTER already has

- `[ARTICLES]...[/ARTICLES]` — articles CRUD.
- `[PROTOCOL_WRITE]...[/PROTOCOL_WRITE]` — write/draft articles.
- `[FILE_GET] / [FILE_PATCH] / [FILE_PUT]` — repo files.
- `[LOCAL_EXEC]...[/LOCAL_EXEC]` — Mac shell.
- `[CLI_CLAUDE_CODE]...[/CLI_CLAUDE_CODE]` — coding agents.
- `[DIR_LIST] / [DIR_GET]KEY` — directory rows.
- `[D1_QUERY]sql[/D1_QUERY]` — spine DB.
- `[LEDGER]...[/LEDGER]` — ledger.

## 9. Common curl patterns

```bash
# Write with web search
TERMINAL_KEY=xxx
curl -s -X POST https://miscsubjects.com/api/protocol/write \
  -H "x-terminal-key: $TERMINAL_KEY" \
  -H "content-type: application/json" \
  -d '{"slug":"bpc-157","ask":"Evidence-graded review of BPC-157","web_search":true}'

# Read an article
curl -s https://miscsubjects.com/api/articles/bpc-157

# List tasks
curl -s https://miscsubjects.com/api/tasks?status=open

# Run a directory row
curl -s -X POST https://miscsubjects.com/api/dispatch \
  -H "x-terminal-key: $TERMINAL_KEY" \
  -H "content-type: application/json" \
  -d '{"key":"TASKS_SYNC_GOOGLE","body":""}'
```

## 10. Debugging

- Build errors: check `https://miscsubjects.com/admin/ledger?turns=1`.
- Live manual: `GET https://miscsubjects.com/api/manual`.
- Recent 500s: `GET https://miscsubjects.com/admin/ledger?turns=1` then search trace.

## 11. What the ROUTER should NOT do

- Do not explain internal file implementations unless asked.
- Do not edit `functions/_lib/widgets.js`, `functions/_lib/vault_widgets.js`, `functions/admin/ledger/index.js`, `functions/admin/vault.js`, `functions/api/vault/[[path]].js`, `functions/a/[slug].js`, `PROTECTED_WIDGETS.md`, or `PROTECTED_FEATURES.md` without an explicit owner token.
- Do not assume a model supports web search; route `web_search:true` only through `grok/grok-4.3` or Cloudflare gateway models explicitly known to support it.
