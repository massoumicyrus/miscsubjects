# Architecture

How the system is built, from the request that arrives to the receipt it leaves behind. This
document describes the primitive as published; bindings are authoritative in `wrangler.toml` and
the `workers/*/wrangler.toml` files, and live counts are at `/api/work` and `/api/directory?brief=1`.

## 1. Shape

One Cloudflare Pages project (`miscsubjects-pages`, serving `miscsubjects.com`) holds the
whole HTTP surface as Pages Functions under `functions/`. Eight Workers sit beside it: one holds
what Pages Functions cannot host (cron triggers, Durable Objects, queue consumers, Workflows,
browser rendering, inbound e-mail), one is the cloud execution plane (a container that runs shell
for cloud-capable rows), and six are single-purpose services (directory snapshot, sheets, storage,
MCP, federation, robots). In production, two D1 databases, one KV namespace and one R2 bucket are
shared by all of them; preview deployments bind their own (§11). A local runner on the operator's
machine, reached over a Cloudflare tunnel, executes the capabilities that need a real computer,
drives logged-in browser models, and Google Apps Script executes the spreadsheet ones.

```
        clients: iMessage · WhatsApp · Telegram · e-mail · web · REST · MCP · CLI agents · sheet rows · web models
                                                     │
                                                     ▼
 ┌──────────────────────────────── Pages Functions (functions/) ────────────────────────────────┐
 │ _middleware.js      request shaping, identity scrub, JSON door, object-context line           │
 │ api/dispatch.js     THE door: row → token · tenant · context gates → execution routing →      │
 │                     runner → ledger → {ok, result, invocation, yield, _self}                   │
 │ api/turn.js         conversational turn → router agent → [KEY]args[/KEY] (§8) → reply         │
 │ api/work/           the task object: lease · submit · fail · audit                            │
 │ api/coding-law/     sha256 leases on code files                                               │
 │ api/articles/       article writes with the content laws applied server-side                  │
 │ api/sheets/         sheets as objects and views     api/environment/  descriptors, the manual │
 │ api/traffic/ go/    the traffic engine              api/device/ api/profile/  the presenter   │
 │ a/[slug].js         the public article renderer     admin/  operator surfaces                 │
 └───────────┬──────────────┬───────────────┬────────────────┬──────────────────┬───────────────┘
             ▼              ▼               ▼                ▼                  ▼
        D1 `DB`        D1 `LEDGER`         KV           R2 bucket        sibling Workers
   directory, articles,  events,       snapshot, settings,  images, uploads,   cron, DOs, queue,
   work_*, laws, sheets, capability    locks, switches      captured sources,  workflows, browser,
   traffic_*, webmodel_* contexts,                          manifests          e-mail, sandbox
                         pop_nonces                                                 │
                        (append-only)                                               ▼
                                                                    Mac bridge (bridge/, hooks/)
                                                                    shell · files · UI · coding agents
                                                                    · the browser-model worker
```

## 2. The directory: every capability is a row

The `directory` table is the system's only capability registry. One row is one invocable thing.

| Column | Meaning |
|---|---|
| `key` | Primary key and invocation name, e.g. `ARTICLE_PUT`, `KV_GET`, `ROUTER` |
| `type` | What the row is: `fn` (a named function in `functions/_lib/fn_runners.js` or a module merged into its map), `http` (an outbound request), `agent` (a model with a system prompt), `flow` (the step DSL composing rows, §5) |
| `runner` | Where the row executes: `edge` (inside Cloudflare), `mac` (forwarded to the local runner, §13), `sibling` (the `miscsubjects-sibling` Worker), `apps_script` (Google Apps Script) |
| `execution` | Where the row is allowed to run: `cloud`, `cloud_preferred`, `either`, `edge_required`, or `cloud_pending:<why>` (§4). Unset means unchanged behaviour |
| `target` | `fn`: the runner name · `http`: `"METHOD url"` with `$1…$n` argument slots · `agent`: the model id |
| `auth` | `http` only: which environment variable holds the credential, e.g. `bearer:GROK_API_KEY`. The row names the variable, never the value |
| `content` | `fn`/`http`: documentation lines (`# WHAT:`, `# ARGS:` …) and the argument template · `agent`: the system prompt · `flow`: the DSL |
| `includes` | `agent` only: prompt blocks composed ahead of the prompt at run time |
| `input_schema`, `examples` | Typed arguments generated from the row's own `# ARGS:` line, and worked examples. A model may propose an example only for a read-only row, and it becomes the row's example only when the run works |
| `invocation`, `invocation_curl`, `last_status`, `last_response`, `test_state`, `tested_at` | The real outbound request the row makes, runnable as pasted; the transport record and full payload of its last test; works / broken / untested. Set only by `POST /api/directory/<KEY>/test` |
| `descriptor_json`, `descriptor_rev` | The environment descriptor of the object the row represents (§10), edited compare-and-set |
| `category`, `allowed_categories`, `enabled`, `planner_visible`, `planner_rank`, `seq` | Grouping, visibility to the router and planner, ordering |

Rows are edited at `/admin/directory`, from any directory view sheet, or through `/api/directory`;
every version is kept in `directory_versions`. A snapshot of the table is cached in KV and served by
the `DirectoryDO` Durable Object so a dispatch never waits on a table scan. `GET /api/directory`
caps payload cells at 8,000 characters and `?brief=1` returns the catalogue without payload columns,
so a model can read it; the row's own `GET` is always full. System prompts are rows, never strings
in code, and `scripts/check-prompts-not-in-code.mjs` fails a deploy that breaks that.

Rows that would send, post, pay, spawn or delete are classed **outward** (`functions/_lib/invocation_record.js`);
the test batch never fires them, and they stay untested with the reason.

## 3. Dispatch: one door, three gates

`POST /api/dispatch {key, body, actor?}` loads the row for `key`, runs it, and returns
`{ok, result, invocation, yield, _self}`. `body` is the argument string (pipe-delimited for
multi-argument rows). `invocation` is the ledgered record of what ran; `yield` is tokens, cost and
material; `_self` is the row's own description of itself. `GET /api/dispatch?key=KEY` returns
`_self` without running anything, `?registry=1` lists every row, `?confirm=<invocation id>` proves a
receipt exists, and `?explain=1&share=<token>` says what a token may do. This contract is the Object
Invocation Protocol, described in [OIP.md](OIP.md).

Before a row runs, three gates run in order in all three authorization lanes (GET invoke, POST,
nested calls made by flows, agents and the relay):

1. **Token.** Callers without the terminal key present a **capability token**: a signed, scoped,
   time-bounded, use-counted grant for one row or one category, minted with
   `GET /api/dispatch?mint_share=1&scope=…&ttl=…` or the `CAP_MINT` row. Scope, risk class,
   fixed-body and payload ceilings are enforced here.
2. **Tenant.** The row's tenant must match the caller's.
3. **Capability context** (`functions/_lib/capability_context.js`). The mutable half of authority:
   which profile and devices may present the token, which browser-model session or state handle it
   was issued for, which origins, whether a human verified recently, whether proof of possession is
   required. Every denial is one of fifteen named codes and every decision is a ledger row with
   `source=authz` and a decision hash. [AUTHORITY.md](AUTHORITY.md) has the whole model.

The same rows are exposed to any MCP client by `functions/api/mcp.js` and `workers/mcp-server/`
(typed arguments arrive in the order the row declares, and an omitted argument keeps its place), to
the router agent as its tool map, to browser models through the relay lane (§8), and to any
spreadsheet through the sheet bridge (§9).

## 4. Execution routing: where a row runs is policy

A row says what it does; its `execution` column says where it may run. Routing is decided once, in
the dispatcher's own path, so cron, flows, agents and REST inherit it (`functions/_lib/execution_routing.js`).

| `execution` | Meaning |
|---|---|
| `cloud` | cloud only; if the cloud is down the call fails and says so |
| `cloud_preferred` | identical either place: cloud first, the operator's machine as fallback |
| `either` | stays on the machine while it answers; the cloud takes over only when it does not |
| `cloud_pending:image` | cloud-capable, but the container image lacks that tool yet |
| `cloud_pending:body` | cloud-capable, but the row body hard-codes a local path |
| `edge_required` | needs that machine (screen, messaging, local disk, locally held credentials); never rerouted |

Two rules hold: the result names the substrate that actually ran it (`execution_substrate`), and
nothing runs anywhere policy did not authorise. A machine that is offline is reported as
`edge_unavailable`, never as a bare connection error. The cloud plane is `workers/sandbox`, a
private Worker reachable only through the `SANDBOX` service binding; `functions/api/cloud/` is its
front door and enforces the workspace boundary.

## 5. Flows: composition without code

A `flow` row's `content` is a small DSL: `>` separates steps, `|` separates fan-out branches, `$1`
is the run input and `$PREV` the previous step's output. Three step verbs move data between steps
without being capabilities: `JSON: $.a.b[0].c` pulls a value out of `$PREV`, `EACH: KEY: body` runs
a step once per element (capped at 25), `MERGE: a=$x, b=$y` builds one object. `$PREV.path` reads
inside a payload anywhere an argument is written (`functions/_lib/json_path.js`). Nothing about the
verbs reaches the ledger as an invocation and nothing about them can spend money.

**Learned flows** (`functions/_lib/flow_learn.js`) close the loop from the ledger. Every step a
dispatch took is a ledger row under one trace. `FLOW_LEARN <trace>` compiles a trace that succeeded
into an ordinary flow row: the run input becomes `$1`, a step that consumed the previous output
becomes `$PREV`, a literal that cannot be proven to come from the input stays a constant, and a
balanced JSON object inside a step body is a constant too. Unknown, disabled or failed steps are
refused; a step that triggers, delivers, notifies, dispatches or is otherwise side-effecting leaves
the row disabled until `FLOW_PROMOTE`. `FLOW_CANDIDATES` groups traces by step signature and
surfaces procedures the ledger has watched succeed repeatedly, skipping traces whose outermost row
is already a flow. [FLOWS.md](FLOWS.md) has the grammar and the rules.

## 6. The ledger: every action is a receipt, and any receipt can be a trigger

Every dispatch, model call, e-mail, deploy and edit appends a row to `events` in the `LEDGER`
database. A row records the source, the row key, the route, the actor, direction, status, a
`trace_id` that groups every step of one turn, the step number and parent, previews of the request
and response, and pointers to the full bodies in R2 when they exceed the inline size. Timestamps
have one shape, and a pre-phase test refuses a deploy that would write another.

The ledger is public at `/ledger`, so redaction happens at ingest in one module,
`functions/_lib/public_secret_guard.js`: provider key shapes, every secret bound in the environment,
signed capability tokens, and the operator's identity are replaced before a row is stored.
`scripts/check-owner-name-leak.mjs` checks the live public endpoints for a regression on every
deploy. Nothing is ever updated or deleted in the ledger; a correction is a new row that names what
it corrects. A lookup that fails is reported as `503 LEDGER_LOOKUP_FAILED` after one retry, never
as "the invocation did not happen" (`functions/_lib/invocation_log.js`).

**The event bridge.** An automation whose trigger reads `event:on source=… action=… match=<regex>`
fires whenever a matching row is written (`functions/_lib/event_log.js`). A device report, a payment,
an inbound message, a failed deploy and an agent's own output are therefore the same kind of
trigger, because they are already the same kind of row. Rows whose actor is an automation never
match, so a trigger cannot loop; the rule list is cached a minute in module scope so the no-match
path costs nothing; and a failed automation can never fail the ledger write that caused it.

## 7. The work object: work exists only as a task

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
tables, or the presence of a required evidence field. A test type the runner does not know fails,
and a test that matches a value the schema can never hold is a defect of the task, not a pass. A
task with no tests cannot exist silently: `scripts/check-work-acceptance.mjs` refuses a live task
that no evidence could ever close.

A failure is an object, not a sentence: `POST /api/work/task/<id>/fail` records the failure class,
the layer that permitted it, the invariant that should have prevented it, the repair, the regression
test and the deploy blocker, and opens a child task. Completed tasks are re-checked, and any task
can be reproduced by a second agent through the same machinery.

## 8. Agents, in code and in browsers

A conversational turn (`/api/turn`) is handled by the **router**, an `agent` row whose prompt is
composed from prompt blocks (`prompts/blocks/`) and the shared law (`prompts/SHARED_LAW.md`,
`prompts/STYLE_LAW.md`). It reads the message, emits a reasoning block, invokes rows with
`[KEY]args[/KEY]`, and replies inside `[REPLY]…[/REPLY]`. The tag reader is one module,
`functions/_lib/tag_calls.js`, and nothing else parses that grammar. Writer, editor, critic and
adjudicator agents are rows of the same kind. Model calls go through `/api/invoke`, which takes a
row key or a model alias, a system prompt or the row's prompt, and one message or many in parallel,
and pass through the Cloudflare AI Gateway for billing and observability. Every model call any path
makes is a `chat_completion` row on the turn's trace.

**Browser models are rows too.** A logged-in web ChatGPT, Claude, Grok, Gemini or Kimi session is
an execution substrate behind the directory (`CHATGPT_WEB`, `CLAUDE_WEB`, `GROK_WEB`, `GEMINI_WEB`,
`KIMI_WEB`, and the `WEBMODEL_*` session verbs). The edge half (`functions/_lib/webmodel_gateway.js`)
owns durable sessions and turns in D1, the receipt that binds the exact prompt to the exact captured
response, and the `state://` handle that lets one model continue another's work without a pasted
transcript; the Mac half (`bridge/webmodel/`) owns one persistent Chrome profile, five provider
adapters holding every selector, and completion detection from the provider's own stream. Turns are
accepted and polled because the edge in front of the tunnel cuts any response held past 100 seconds.
The **relay lane** (`functions/_lib/webmodel_relay.js`) runs the other way: a web model is handed
the directory as text, emits `[KEY]args[/KEY]`, and the relay invokes each capability through
canonical dispatch under the caller's authority, pastes the results back, and lets the model continue
until it answers with no tags. Sensitive and approval-gated rows are refused outright.
[WEB_MODELS.md](WEB_MODELS.md) has the contract.

Coding agents on the operator's machine (Claude Code, Codex, Gemini, Kimi, Grok) are wired by
`hooks/` and the per-CLI configuration directories so that every agent turn lands on the ledger as
an `agent_turns` row. The skills those agents load are in `.claude/skills/`. `misc-cli/` is a
terminal agent that talks to the system through the same door and posts its own turns.

## 9. Sheets: views of the record, and an inbox for any model

The directory holds the nouns, the ledger holds the verbs, and everything else is a view. A **view
sheet** (`functions/_lib/sheet_views.js`) stores a description, not rows: which source (`events`,
`directory`, `directory_versions`, `agent_turns`, profiles, devices, contexts, web-model sessions,
traffic tables and more), which filters, which columns, how each renders, and a JSON path into any
payload column, so the exact text a model was sent is one column away from the row that sent it.
Every open re-reads the source; a read that fails answers `ok:false` and says it is not an empty
result. **Pins** above a grid reference `directory/<KEY>/<field>`, `sheet/<id>/<A1>` or
`settings/<key>` and write through. Articles are a view source with write-through by hash.

Every sheet is an object: `sheet://<id>`, a human page at `/sheet/<id>`, a self payload at
`GET /api/sheets/<id>/self`, `public` or `private` visibility, a webhook at `POST /api/sheets/<id>/values:append`,
and a token scoped to that one sheet. Sheets are created by saying so: `POST /api/sheets
{title, source, columns, filter}`, with one verb per change (`/columns`, `/filters`, `/pins:add`,
`/columns:remove`), each also a directory row visible over MCP. Each sheet is one Durable Object in
`workers/sheet-do` (single writer, local reads, WebSocket push, R2 spill).

The **sheet bridge** (`functions/api/sheet-bridge.js`) makes a Google Sheet tab an invocation inbox:
column A is what to invoke (`[KEY]args[/KEY]`, `KEY|args` or `KEY`), the bridge runs it, and B to E
carry state, answer, time and ledger trace. A model that must treat a web page as data can still
operate the whole directory, because writing a row into the user's own spreadsheet is an ordinary
user-authorized action. Rows are claimed `running` before dispatch so two passes cannot fire one
invocation twice, and every write returns its outcome. [SHEETS.md](SHEETS.md) has the details.

## 10. The environment: every object has a descriptor and an address

Every object the environment has is a directory row with a **descriptor** (`descriptor_json`):
schema, operations, source references, relationships, governance attachments, comparables and
representations, with a content hash that covers what the descriptor says and never where it is
stored, so the same contract hashes the same in a migration, a POST and a re-read. Edits are
compare-and-set on `descriptor_rev` (`409 descriptor_revision_stale`). Canonical references read
`directory://ROUTER`, `prompt://ROUTER/system`, `sheet://<id>`, `page://admin/sheets`,
`route://GET/api/sheets/{id}`, `law://design/D08`, `skill://coding-law`.

`GET /api/environment?format=markdown` is the one generated manual, produced from the same
descriptors the runtime uses. `/api/environment/objects`, `/governance` and `/comparables` resolve
any reference to its descriptor, the rules that govern it (direct and inherited, with the path each
arrives by) and its comparables. Every admin page carries one object-context line naming its
`page://` reference and those three links, injected by `functions/_middleware.js` so the shared
shell never has to be edited. `scripts/check-environment-contract.mjs` runs the contract against a
real in-memory database in the deploy's pre-phase.

## 11. Storage

| Store | Binding | Holds |
|---|---|---|
| D1 `miscsubjects-content` | `DB` | directory and versions and descriptors; articles and content blocks; work tasks, actions, evidence; code leases; laws and violations; automations and cron runs; sheets; sessions, agents and agent turns; profiles, devices, identifiers (hashed and masked), events; traffic configuration, decisions, grants, memberships, codes; web-model sessions and turns; state handles; settings; tenants |
| D1 `miscsubjects-events` | `LEDGER` | `events`, `events_stats`, `capability_contexts`, `pop_nonces` |
| KV | `KV` | directory snapshot, settings cache, file claims and deploy lock, feature switches |
| R2 `miscsubjects-ledger` | `R2` | `img/gen/`, `img/screenshot/`, `img/ref/`, `capability_sources/`, oversized ledger bodies, the projection manifests under `img/projection/` |
| Workers AI | `AI` | embeddings and small models |

Preview deployments repeat every binding against preview databases and a preview KV namespace, so
a preview can never write production rows.

## 12. Sibling Workers

| Worker | Why it exists | Bindings |
|---|---|---|
| `miscsubjects-sibling` | Everything Pages Functions cannot host: two cron schedules, the `ExpertDO` and `AgentDO` Durable Objects (durable agent loops with SQLite state), the `deliver` and `selftest` Workflows, the `miscsubjects-tasks` queue consumer, browser rendering, e-mail sending and inbound mail | `DB`, `KV`, `R2`, `AI`, `CF_EXPERT_DO`, `AGENT_DO`, `DELIVER_WF`, `SELFTEST_WF`, `TASKS`, `MYBROWSER`, `EMAIL` |
| `miscsubjects-sandbox` | The cloud execution plane: shell in a container for cloud-capable rows, private, reachable only through the `SANDBOX` service binding | `SANDBOX` from Pages |
| `miscsubjects-directory-do` | Single-writer directory snapshot | `DIRECTORY_DO` from Pages |
| `miscsubjects-sheet-do` | One Durable Object per sheet: single writer, local reads, WebSocket push, R2 spill | `SHEET_DO` from Pages |
| `miscsubjects-storage` | Reference storage in R2 with a D1 index, fronted by `/api/store` | `STORE` from Pages |
| `miscsubjects-mcp` | MCP server over the directory | |
| `oip-peer` | Federation: answers the invocation protocol for a second domain so two systems can call each other's rows with signed envelopes | |
| `miscsubjects-robots` | `robots.txt` | |

The Pages project also declares a `META_BRIDGE` service binding; the Worker behind it is a tenant
integration and is not part of the primitive.

## 13. The local runner, the browser-model worker and the spreadsheet runner

Rows with runner `mac` are forwarded to `bridge/server.js` on the operator's machine over a
Cloudflare tunnel: shell, files, UI automation, screenshots, and the coding-agent CLIs. `bridge/`
carries the server, its installer and the launchd definitions. The bridge also proxies the narrow
browser-model verbs to `bridge/webmodel/worker.mjs`, which holds one dedicated Chrome profile and
at most six live provider tabs; no CDP, arbitrary JavaScript or arbitrary navigation crosses.
Without the bridge, `mac` rows and web-model rows refuse with a clear reason and everything else runs.

Rows with runner `apps_script` execute inside Google Apps Script (`apps-script/`), reached through
its deployed web app, for reading and writing spreadsheets and Drive files.

## 14. The traffic engine

`/go/<entry>` is a public splitter (`functions/go/[[path]].js`): one request in, one decision out,
rendered as its experience with first-party cookies set. The decision core
(`functions/_lib/traffic/engine.js`) is `REQUEST → IDENTIFIERS → PROFILE → SIGNALS → POLICY → DECISION`:
`evaluateContext` is pure and records every rule's every condition as true or false; `decide` wraps
it with identity resolution, cookie state, persistence and the ledger; `explain` runs it on a
simulated visitor with no side effects; `replay` re-runs a stored decision's own signals against the
revision that made it and against the live configuration and reports the difference. Experiences are
redirect, inline, Turnstile verification, acknowledgement, deny, static and an SMS squeeze whose
one-time code, texted back, becomes a signed grant redeemed at `/go/_/enter`. Squeeze pages and
destinations carry versions and weighted groups, sticky per visitor. Configuration, profiles, the
unified profile view, metrics, explain, replay and retention are under `/api/traffic/`; rules are
authored in plain English at `/admin/traffic-console`. [TRAFFIC.md](TRAFFIC.md) has the model.

## 15. Content

Articles live in D1 (`articles`, `article_slots`, `article_links`, `article_comments`,
`content_*`). Writes go through `PUT`/`PATCH /api/articles/<slug>`, where the content laws run
server-side: the writing law (`functions/_lib/writing_law_object.js`), the subject gate, the claims
and source laws, the one-object law. A violation is a `422` that names the fix. `functions/a/[slug].js`
renders the public page with its widgets; every article carries a model comment ledger and a
hash-chained source ledger. Generated images and captured sources live in R2 under `img/` and
`capability_sources/`.

## 16. Laws as gates

Every operating rule is a script under `scripts/check-*.mjs` or a server-side refusal. The gates are
listed in `scripts/gates.manifest.json` with a phase, and `scripts/ship.mjs` runs them by reading
that manifest, so a gate cannot exist without being invoked; `check-gates-wired.mjs` fails the
deploy if a gate on disk is missing from the manifest.

A deploy runs in this order: verify lineage (`HEAD` equals `origin/main`, protected-path contracts
hold), run the pre-phase gates and tests, take the deploy lease in KV, apply the newest migration,
deploy to a preview alias bound to the preview databases, smoke-test the preview for render
failures, promote the identical bundle to production, smoke-test production across the critical
routes, then run every post-phase gate against the live site. A hand-run `wrangler pages deploy`
skips all of it.

Three more mechanisms guard the tree itself. `failure-vault.json` holds one entry per named failure
mode, each naming files and the strings they must contain; `.githooks/pre-commit` and the deploy
both enforce it. `PROTECTED_FEATURES.md` and `PROTECTED_WIDGETS.md` name paths only the operator
changes; `.githooks/commit-msg` refuses everything else, and no approval token clears it. A locked
module is extended by a new library merged into its map, never by editing it. `AGENTS.md` and
`STATE.md` are generated pointers to the work object and fail the deploy if they grow rules.

## 17. The coding law: a hash to start, a hash to commit

Two agents that read the same file and commit in turn will silently erase each other unless the
text each one started from is on record. Before the first edit an agent posts the sha256 of every
file it read (`POST /api/coding-law/start`); before committing it posts the sha256 of what it wrote
(`POST /api/coding-law/commit`). If another agent committed the same path in between, the commit
is refused with `overwrite_refused` and the agent re-reads, redoes and re-leases. The scope is the
executable surface: `functions/`, `scripts/`, `migrations/`, `workers/`, `apps-script/`, `public/`,
the skills, `schema.sql`, `wrangler.toml`. `scripts/check-coding-law.mjs` fails a deploy that
carries an unleased code change, and it has no override.

## 18. Public surfaces

`/start` (the door for people and agents), `/a/<slug>` (articles), `/ledger`, `/api/manual`
(the REST manual generated from the live directory), `/api/environment?format=markdown` (the
environment manual generated from descriptors), `/api/work` and `/a/the-work-object`, `/sheet/<id>`
(public sheets), `/go/<entry>` (the traffic engine), `/verify-device` (the Turnstile step-up),
`/skills` and `/.well-known/agent-skills/`, `/llms.txt`, `sitemap.xml`, `feed.xml`. Every JSON
response also carries an `_ai_door` object: a short note naming `/start` and stating that reading is
a complete outcome, so a model that lands anywhere knows where it is and that it need not act.

## 19. This repository

This repository is generated from the private operating repository by `scripts/publish-mirror.mjs`.
`PROJECTION.json` at the root names the source commit, what was dropped and why, which modules are
stubs, and every gate's result. [PUBLISHING.md](PUBLISHING.md) describes the mechanism.
