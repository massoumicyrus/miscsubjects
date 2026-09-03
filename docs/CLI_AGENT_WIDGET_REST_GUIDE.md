# CLI agents: activate widgets via REST / tool invocation

This guide is for Kimi, Grok, Gemini, GPT, or any other CLI agent that needs to read, trigger, or render widgets in the miscsubjects build.

## 1. Auth

Every mutating call needs:

```
x-terminal-key: <TERMINAL_KEY>
```

`TERMINAL_KEY` is a Cloudflare secret bound to the Worker. Read-only calls (`GET`) do not require it.

## 2. What "activating a widget" means

A widget is a normalized JSON object produced by `functions/_lib/vault_widgets.js`. It has:

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

To "activate" a widget means to either:

1. **Read the widget catalog** — GET `/api/vault/catalog`
2. **Render widgets as HTML** — GET `/api/tasks?format=widgets` or open `/admin/tasks`
3. **Trigger the action it represents** — POST to its `.api` URL or POST `/api/dispatch`

## 3. Read widgets

### All vault widgets

```bash
curl -s https://miscsubjects.com/api/vault/catalog
```

Returns:

```json
{
  "groups": {
    "tasks": [ ... ],
    "events": [ ... ],
    "cards": [ ... ],
    "claims": [ ... ],
    "protected": [ ... ]
  },
  "counts": { ... }
}
```

### Task widgets only

```bash
curl -s https://miscsubjects.com/api/tasks?status=open
```

### HTML card page

```bash
curl -s https://miscsubjects.com/api/tasks?format=widgets
```

## 4. Trigger a widget action

Most widgets expose an `.api` URL. For a task widget, the API URL is:

```
https://miscsubjects.com/api/tasks?status=open
```

To run any directory row by key, use the dispatch endpoint. This is the generic "tool invocation" surface:

```bash
curl -s -X POST https://miscsubjects.com/api/dispatch \
  -H "x-terminal-key: $TERMINAL_KEY" \
  -H "content-type: application/json" \
  -d '{"key":"TASKS_SYNC_GOOGLE","body":""}'
```

The `key` is any enabled directory row key. The `body` is the argument string passed to that row.

## 5. Directory rows you should know

Directory rows are the build's tool registry. To list them:

```bash
curl -s https://miscsubjects.com/api/directory
```

Useful widget-related rows:

| Key | What it does |
|-----|--------------|
| `TASKS_SYNC_GOOGLE` | Pushes open tasks to Google Tasks |
| `PROTOCOL_RUN` | Claims and runs the next open protocol task |
| `VAULT_SESSION_SCAN` | Scans recent Claude Code sessions into the ledger |

## 6. Create a task that becomes a widget

```bash
curl -s -X POST https://miscsubjects.com/api/tasks \
  -H "x-terminal-key: $TERMINAL_KEY" \
  -H "content-type: application/json" \
  -d '{
    "role": "writer",
    "ask": "Write an evidence-graded article on BPC-157",
    "title": "BPC-157 evidence review"
  }'
```

The new task immediately appears in `/api/vault/catalog` under `groups.tasks` and on `/admin/tasks`.

## 7. Post an idea to the vault

```bash
curl -s -X POST https://miscsubjects.com/api/vault/ideas \
  -H "x-terminal-key: $TERMINAL_KEY" \
  -H "content-type: application/json" \
  -d '{
    "title": "Widget idea",
    "body": "Make the X widget wider and single-post focused",
    "scope": "owner-idea",
    "lock": true
  }'
```

This creates an open task with `source=vault-idea`.

## 8. Full agent workflow example

A CLI agent that wants to "turn on" a widget pipeline:

```bash
# 1. See what is pending
TASKS=$(curl -s https://miscsubjects.com/api/tasks?status=open)

# 2. Create a new task
NEW=$(curl -s -X POST https://miscsubjects.com/api/tasks \
  -H "x-terminal-key: $TERMINAL_KEY" \
  -H "content-type: application/json" \
  -d '{"role":"writer","ask":"Write about BPC-157"}')

# 3. Trigger the protocol runner to process it
curl -s -X POST https://miscsubjects.com/api/dispatch \
  -H "x-terminal-key: $TERMINAL_KEY" \
  -H "content-type: application/json" \
  -d '{"key":"PROTOCOL_RUN","body":"writer"}'

# 4. Read the resulting vault widgets
curl -s https://miscsubjects.com/api/vault/catalog | jq '.groups.tasks[0:5]'
```

## 9. Protected widget paths

These files are owner-locked. Do NOT edit them without an explicit token in git:

- `functions/_lib/widgets.js`
- `functions/_lib/vault_widgets.js`
- `functions/admin/ledger/index.js`
- `functions/admin/vault.js`
- `functions/api/vault/[[path]].js`
- `functions/a/[slug].js`
- `PROTECTED_WIDGETS.md`
- `PROTECTED_FEATURES.md`

You can READ them via `curl` or `[FILE_GET]` but do not patch them.
