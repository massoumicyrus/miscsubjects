# Architecture

How the system is built, from the request that arrives to the receipt it leaves behind. This
document describes the primitive as published; bindings are authoritative in `wrangler.toml` and
the `workers/*/wrangler.toml` files, and live counts are at `/api/work` and `/api/directory`.

## 1. Shape

One Cloudflare Pages project (`miscsubjects-miscsubjects`, serving `miscsubjects.com`) holds the
whole HTTP surface as Pages Functions under `functions/`. Seven Workers sit beside it: one holds
what Pages Functions cannot host (cron triggers, Durable Objects, queue consumers, Workflows,
browser rendering, inbound e-mail), and six are single-purpose services (directory snapshot, sheets,
storage, MCP, federation, robots). In production, two D1 databases, one KV namespace and one R2
bucket are shared by all of them; preview deployments bind their own (§10). A local runner on the operator's machine, reached over a Cloudflare tunnel, executes
the capabilities that need a real computer, and Google Apps Script executes the spreadsheet ones.

```
                    clients: iMessage · WhatsApp · Telegram · e-mail · web · REST · MCP · CLI agents
                                                     │
                                                     ▼
 ┌──────────────────────────────── Pages Functions (functions/) ────────────────────────────────┐
 │ _middleware.js      request shaping, identity scrub, JSON door                              │
 │ api/dispatch.js     THE door: row → runner → ledger → {ok, result, invocation, yield, _self}│
 │ api/turn.js         conversational turn → router agent → tool calls (§8) → reply             │
 │ api/work/           the task object: lease · submit · fail · audit                          │
 │ api/coding-law/     sha256 leases on code files                                              │
 │ api/articles/       article writes with the content laws applied server-side               │
 │ a/[slug].js         the public article renderer          admin/  operator surfaces          │
 └───────────┬──────────────┬───────────────┬────────────────┬──────────────────┬──────────────┘
             ▼              ▼               ▼                ▼                  ▼
        D1 `DB`        D1 `LEDGER`         KV           R2 bucket        sibling Workers
   directory, articles,   events      snapshot, settings,  images, uploads,   cron, DOs, queue,
   work_*, laws, sheets  (append-only) locks, switches     captured sources   workflows, browser
                                                                                    │
                                                                                    ▼
                                                                    Mac bridge (bridge/, hooks/)
                                                                    shell · files · UI · coding agents
```

## 2. The directory: every capability is a row

The `directory` table is the system's only capability registry. One row is one invocable thing.

| Column | Meaning |
|---|---|
| `key` | Primary key and invocation name, e.g. `ARTICLE_PUT`, `KV_GET`, `ROUTER` |
| `type` | What the row is: `fn` (a named function in `functions/_lib/fn_runners.js`), `http` (an outbound request), `agent` (a model with a system prompt), `flow` (a small DSL composing rows) |
| `runner` | Where the row executes: `edge` (inside Cloudflare), `mac` (forwarded to the local runner, §12), `sibling` (the `miscsubjects-sibling` Worker), `apps_script` (Google Apps Script) |
| `target` | `fn`: the runner name · `http`: `"METHOD url"` with `$1…$n` argument slots · `agent`: the model id |
| `auth` | `http` only: which environment variable holds the credential, e.g. `bearer:GROK_API_KEY`. The row names the variable, never the value |
| `content` | `fn`/`http`: documentation lines and the argument template · `agent`: the system prompt · `flow`: the DSL |
| `includes` | `agent` only: prompt blocks composed ahead of the prompt at run time |
| `category`, `allowed_categories`, `enabled`, `planner_visible`, `planner_rank`, `seq` | Grouping, visibility to the router and planner, ordering |
| `input_schema`, `examples` | Optional JSON that makes the row self-describing |

Rows are edited at `/admin/directory` or through `/api/directory`; every version is kept in
`directory_versions`. A snapshot of the table is cached in KV and served by the `DirectoryDO`
Durable Object so a dispatch never waits on a table scan. System prompts are rows, never strings in
code, and `scripts/check-prompts-not-in-code.mjs` fails a deploy that breaks that.

## 3. Dispatch: one door

`POST /api/dispatch {key, body, actor?}` loads the row for `key`, runs it, and returns
`{ok, result, invocation, yield, _self}`. `body` is the argument string (pipe-delimited for
multi-argument rows). `invocation` is the ledgered record of what ran; `yield` is tokens, cost and
material; `_self` is the row's own description of itself: what it is, how to run it, how to change
it, where to look next. `GET /api/dispatch?key=KEY` returns `_self` without running anything, and
`GET /api/dispatch?registry=1` lists every row. This contract is the Object Invocation Protocol,
described in [OIP.md](OIP.md).

Callers without the terminal key use **capability tokens**: scoped, time-bounded, use-counted
grants minted for one row or one category. The dispatcher enforces scope, tenant, risk class,
fixed-body and payload ceilings before a row runs.

The same rows are exposed to any MCP client by `functions/api/mcp.js` and `workers/mcp-server/`,
and to the router agent as its tool map.

## 4. The ledger: every action is a receipt

Every dispatch, model call, e-mail, deploy and edit appends a row to `events` in the `LEDGER`
database. A row records the source, the row key, the route, the actor, direction, status, a
`trace_id` that groups every step of one turn, the step number and parent, previews of the request
and response, and pointers to the full bodies in R2 when they exceed the inline size.

The ledger is public at `/ledger`, so redaction happens at ingest in one module,
`functions/_lib/public_secret_guard.js`: provider key shapes, every secret bound in the environment,
signed capability tokens, and the operator's identity are replaced before a row is stored.
`scripts/check-owner-name-leak.mjs` checks the live public endpoints for a regression on every
deploy. Nothing is ever updated or deleted in the ledger; a correction is a new row that names what
it corrects.

## 5. The work object: work exists only as a task

Agents do not choose what to do and cannot declare themselves done.

| Table | Holds |
|---|---|
| `work_tasks` | id, objective, detail, state, priority, dependencies, permitted capabilities, acceptance tests, required evidence, parent and supersession links |
| `work_actions` | one hash-chained row per state change, lease, submission, failure and repair; nothing is updated or deleted |
| `work_evidence` | the evidence submitted for each task, kept for reproduction |

States: `open → leased → in_progress → evidence_submitted → accepted → completed`, with `refused`
(tests failed, back to open), `failed`, `repair_required` (a completed task whose tests no longer
pass) and `superseded` (withdrawn by a later revision that names it). A lease lasts one hour and
expires back to `open`.

Acceptance tests are run by the infrastructure against the live site, never by the agent
(`runOneTest` in `functions/_lib/work_object.js`): an HTTP status, a string present or absent in a
page's own content, an article's existence, length, sources or hero, a row count from the canonical
tables, or the presence of a required evidence field. A test type the runner does not know fails.
A task with no tests cannot exist silently: the deploy gate `scripts/check-work-acceptance.mjs` refuses a live task that no evidence could ever close.

A failure is an object, not a sentence: `POST /api/work/task/<id>/fail` records the failure class,
the layer that permitted it, the invariant that should have prevented it, the repair, the regression
test and the deploy blocker, and opens a child task. Completed tasks are re-checked, and any task
can be reproduced by a second agent through the same machinery.

## 6. The coding law: a hash to start, a hash to commit

Two agents that read the same file and commit in turn will silently erase each other unless the
text each one started from is on record. Before the first edit an agent posts the sha256 of every
file it read (`POST /api/coding-law/start`); before committing it posts the sha256 of what it wrote
(`POST /api/coding-law/commit`). If another agent committed the same path in between, the commit
is refused with `overwrite_refused` and the agent re-reads, redoes and re-leases. The scope is the
executable surface: `functions/`, `scripts/`, `migrations/`, `workers/`, `apps-script/`, `public/`,
the skills, `schema.sql`, `wrangler.toml`. `scripts/check-coding-law.mjs` fails a deploy that
carries an unleased code change, and it has no override.

## 7. Laws as gates

Every operating rule is a script under `scripts/check-*.mjs` or a server-side refusal. The gates
are listed in `scripts/gates.manifest.json` with a phase, and `scripts/ship.mjs` runs them by
reading that manifest, so a gate cannot exist without being invoked; `check-gates-wired.mjs` fails
the deploy if a gate on disk is missing from the manifest.

A deploy runs in this order: verify lineage (`HEAD` equals `origin/main`, protected-path contracts
hold), run the pre-phase gates, take the deploy lease in KV, apply the newest migration, deploy to
a preview alias bound to the preview databases, smoke-test the preview for render failures, promote
the identical bundle to production, smoke-test production across the critical routes, then run every
post-phase gate against the live site. A hand-run `wrangler pages deploy` skips all of it.

Three more mechanisms guard the tree itself. `failure-vault.json` holds one entry per named failure
mode, each naming files and the strings they must contain; `.githooks/pre-commit` and the deploy
both enforce it. `PROTECTED_FEATURES.md` and `PROTECTED_WIDGETS.md` name paths only the operator
changes; `.githooks/commit-msg` refuses everything else, and no approval token clears it. `AGENTS.md`
and `STATE.md` are generated pointers to the work object and fail the deploy if they grow rules.

## 8. Agents

A conversational turn (`/api/turn`) is handled by the **router**, an `agent` row whose prompt is
composed from prompt blocks (`prompts/blocks/`) and the shared law (`prompts/SHARED_LAW.md`,
`prompts/STYLE_LAW.md`). It reads the message, emits a reasoning block, invokes rows with
`[KEY]args[/KEY]`, and replies inside `[REPLY]…[/REPLY]`. Writer, editor, critic and adjudicator
agents are rows of the same kind. Model calls go through `/api/invoke`, which takes a row key or a
model alias, a system prompt or the row's prompt, and one message or many in parallel, and pass
through the Cloudflare AI Gateway for billing and observability.

Coding agents on the operator's machine (Claude Code, Codex, Gemini, Kimi, Grok) are wired by
`hooks/` and the per-CLI configuration directories so that every agent turn lands on the ledger as
an `agent_turns` row. The skills those agents load are in `.claude/skills/`. `misc-cli/` is a
terminal agent that talks to the system through the same door and posts its own turns.

## 9. Content

Articles live in D1 (`articles`, `article_slots`, `article_links`, `article_comments`,
`content_*`). Writes go through `PUT`/`PATCH /api/articles/<slug>`, where the content laws run
server-side: the writing law (`functions/_lib/writing_law_object.js`), the subject gate, the claims
and source laws, the one-object law. A violation is a `422` that names the fix. `functions/a/[slug].js`
renders the public page with its widgets; every article carries a model comment ledger and a
hash-chained source ledger. Generated images and captured sources live in R2 under `img/` and
`capability_sources/`.

## 10. Storage

| Store | Binding | Holds |
|---|---|---|
| D1 `miscsubjects-content` | `DB` | directory and versions; articles and content blocks; work tasks, actions, evidence; code leases; laws and violations; automations and cron runs; sheets; sessions, agents and agent turns; settings; tenants |
| D1 `miscsubjects-events` | `LEDGER` | `events`, `events_stats` |
| KV | `KV` | directory snapshot, settings cache, file claims and deploy lock, feature switches |
| R2 `miscsubjects-ledger` | `R2` | `img/gen/`, `img/screenshot/`, `img/ref/`, `capability_sources/`, oversized ledger bodies, the projection manifests |
| Workers AI | `AI` | embeddings and small models |

Preview deployments repeat every binding against preview databases and a preview KV namespace, so
a preview can never write production rows.

## 11. Sibling Workers

| Worker | Why it exists | Bindings |
|---|---|---|
| `miscsubjects-sibling` | Everything Pages Functions cannot host: two cron schedules, the `ExpertDO` and `AgentDO` Durable Objects (durable agent loops with SQLite state), the `deliver` and `selftest` Workflows, the `miscsubjects-tasks` queue consumer, browser rendering, e-mail sending and inbound mail | `DB`, `KV`, `R2`, `AI`, `CF_EXPERT_DO`, `AGENT_DO`, `DELIVER_WF`, `SELFTEST_WF`, `TASKS`, `MYBROWSER`, `EMAIL` |
| `miscsubjects-directory-do` | Single-writer directory snapshot | `DIRECTORY_DO` from Pages |
| `miscsubjects-sheet-do` | One Durable Object per sheet: single writer, local reads, WebSocket push, R2 spill | `SHEET_DO` from Pages |
| `miscsubjects-storage` | Reference storage in R2 with a D1 index, fronted by `/api/store` | `STORE` from Pages |
| `miscsubjects-mcp` | MCP server over the directory | |
| `oip-peer` | Federation: answers the invocation protocol for a second domain so two systems can call each other's rows with signed envelopes | |
| `miscsubjects-robots` | `robots.txt` | |

The Pages project also declares a `META_BRIDGE` service binding; the Worker behind it is a tenant
integration and is not part of the primitive.

## 12. The local runner and the spreadsheet runner

Rows with runner `mac` are forwarded to `bridge/server.js` on the operator's machine over a
Cloudflare tunnel: shell, files, UI automation, screenshots, and the coding-agent CLIs. `bridge/`
carries the server, its installer and the launchd definitions. Without the bridge, `mac` rows refuse
with a clear reason and everything else runs.

Rows with runner `apps_script` execute inside Google Apps Script (`apps-script/`), reached through
its deployed web app, for reading and writing spreadsheets and Drive files.

## 13. Public surfaces

`/start` (the door for people and agents), `/a/<slug>` (articles), `/ledger`, `/api/manual`
(the REST manual generated from the live directory), `/api/work` and `/a/the-work-object`,
`/skills` and `/.well-known/agent-skills/`, `/llms.txt`, `sitemap.xml`, `feed.xml`. Every JSON
response also carries an `_ai_door` object: a short note naming `/start` and stating that reading is
a complete outcome, so a model that lands anywhere knows where it is and that it need not act.

## 14. This repository

This repository is generated from the private operating repository by `scripts/publish-mirror.mjs`.
`PROJECTION.json` at the root names the source commit, what was dropped and why, which modules are
stubs, and every gate's result. [PUBLISHING.md](PUBLISHING.md) describes the mechanism.
