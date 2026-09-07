<p align="center">
  <img src="public/assets/brand-mark.svg" alt="" width="88">
</p>

<h1 align="center">miscsubjects</h1>

<p align="center">
  A self-operating system on Cloudflare in which every capability is a row, every action is a receipt,<br>
  work is a leased task graded by the infrastructure, and every rule is a check that can fail a deploy.
</p>

<p align="center">
  <a href="https://miscsubjects.com/img/projection/latest.json"><img alt="projection" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fmiscsubjects.com%2Fimg%2Fprojection%2Flatest.json&query=%24.files&label=projection&suffix=%20files&color=1f2328"></a>
  <a href="https://miscsubjects.com/img/projection/latest.json"><img alt="gates" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fmiscsubjects.com%2Fimg%2Fprojection%2Flatest.json&query=%24.all_gates_ok&label=export%20gates%20passed&color=2da44e"></a>
  <a href="https://miscsubjects.com/api/directory?brief=1"><img alt="directory" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fmiscsubjects.com%2Fapi%2Fdirectory%3Fbrief%3D1&query=%24.count&label=capabilities&color=0969da"></a>
  <a href="https://miscsubjects.com/api/work"><img alt="work" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fmiscsubjects.com%2Fapi%2Fwork&query=%24.counts.completed&label=tasks%20graded%20complete&color=8250df"></a>
  <img alt="platform" src="https://img.shields.io/badge/Cloudflare-Pages%20%C2%B7%20Workers%20%C2%B7%20D1%20%C2%B7%20KV%20%C2%B7%20R2%20%C2%B7%20Durable%20Objects-f38020">
  <img alt="license" src="https://img.shields.io/badge/license-all%20rights%20reserved-lightgrey">
</p>

<p align="center">
  <a href="https://miscsubjects.com/start">Start</a> ·
  <a href="https://miscsubjects.com/a/the-work-object">The work object</a> ·
  <a href="https://miscsubjects.com/api/directory?brief=1">Directory</a> ·
  <a href="https://miscsubjects.com/ledger">Ledger</a> ·
  <a href="https://miscsubjects.com/api/environment?format=markdown">Environment manual</a> ·
  <a href="docs/README.md">Docs</a>
</p>

---

This repository is the **primitive** of the system that runs [miscsubjects.com](https://miscsubjects.com):
the kernel, its governance, the content machinery and the agent layer, with the operator's business
integrations and published content removed. Every commit here is generated from a private operating
repository by `scripts/publish-mirror.mjs`; `PROJECTION.json` at the root names the source commit,
what was left out and why, which modules are stubs, and which gates the tree passed. Where the kernel
imports a business integration, a stub with the same exports stands in its place and throws with the
module's path when used, so the shape of the system is complete and the boundary is visible.

The badges above are live: they read the system's own public surfaces, not a file in this tree.

## What is unusual here

Each mechanism below is running in public, so the link is the proof and the code path is where to
read it.

**1. Work that an agent cannot declare finished.** A task is a row with acceptance tests. An agent
leases it, does the work, and submits evidence; the infrastructure runs the tests against the live
site and sets the state. A sentence in a report completes nothing, and a task with no tests cannot
exist. Every lease, submission and verdict is a hash-chained audit row.
Live: [the work object](https://miscsubjects.com/a/the-work-object) ·
[machine form](https://miscsubjects.com/api/work) ·
[audit chain](https://miscsubjects.com/api/work/audit) ·
[cold start for an agent](https://miscsubjects.com/api/work/bootstrap).
Code: `functions/_lib/work_object.js`, `functions/api/work/`.

**2. A hash lease on every code edit.** Before touching a file an agent posts the sha256 of what it
read; before committing, the sha256 of what it wrote. If another agent committed the same file in
between, the commit is refused instead of silently erasing the other's work. The deploy fails on any
unleased change, and there is no override.
Live: [the coding law](https://miscsubjects.com/a/coding-law) ·
[the lease API](https://miscsubjects.com/api/coding-law).
Code: `functions/api/coding-law/`, `scripts/check-coding-law.mjs`.

**3. Rules that exist only as gates.** Every operating law is a script that fails a deploy or a
server-side refusal that names the fix. The gates are listed in one manifest that the deploy reads,
so a gate cannot exist without running, and a check on disk that is missing from the manifest fails
the deploy too. Named failure modes become entries in a vault that the commit hook enforces.
Live: [the agent work law](https://miscsubjects.com/a/agent-work-law).
Code: `scripts/gates.manifest.json`, `scripts/ship.mjs`, `scripts/check-*.mjs`, `failure-vault.json`.

**4. Every capability is a row, callable through one door.** The directory table holds one row per
thing the system can do, and `POST /api/dispatch` runs any of them. Each row describes itself: what
it is, how to run it, how to change it, where to look next. The same rows are the router's tools,
the MCP server's tools, the generated REST manual, and the columns of a spreadsheet.
Live: [the directory](https://miscsubjects.com/api/directory?brief=1) ·
[one row describing itself](https://miscsubjects.com/api/dispatch?key=NOW) ·
[the generated manual](https://miscsubjects.com/api/manual) ·
[the protocol](https://miscsubjects.com/a/oip).
Code: `functions/api/dispatch.js`, `functions/_lib/object_contract.js`, [docs/OIP.md](docs/OIP.md).

**5. Every row carries the real request it makes, and whether it works.** Each directory row holds
the raw REST JSON that invokes it, the last transport status, the full last response and a test
state: works, broken, or untested. Only a run sets them. A row that would send, post, pay or delete
is never fired by the batch; it stays untested with the reason. The recorded request runs as pasted,
with the credential written as the name of the vault variable that holds it, never the value.
Code: `functions/_lib/invocation_record.js`, `functions/api/directory/`.

**6. Authority has two halves.** A signed capability token says what may be done, for how long and
how many times. A server-side **capability context** says who it belongs to and where it may be
exercised: the device, the browser-model session, the origin, whether the human behind it verified
recently. Both are evaluated on every invocation. A valid token copied into another browser fails by
name, one of fifteen denial codes, never as a bare 403, and every decision is a ledger row with a
decision hash. Device keys prove possession with ECDSA; Turnstile is the step-up.
Code: `functions/_lib/capability_context.js`, `functions/api/device/verify.js`, [docs/AUTHORITY.md](docs/AUTHORITY.md).

**7. A successful trace becomes a capability.** Every step a dispatch took is a ledger row under
one trace. `FLOW_LEARN` compiles a trace that succeeded into an ordinary flow row: the run input
becomes `$1`, a step that consumed the previous output becomes `$PREV`, and a literal it cannot
prove came from the input stays a constant. Anything sensitive or side-effecting leaves the row
disabled until promoted. `FLOW_CANDIDATES` finds procedures the ledger has watched succeed
repeatedly. What is learned is executable, not instructions.
Code: `functions/_lib/flow_learn.js`, [docs/FLOWS.md](docs/FLOWS.md).

**8. Browser models are capabilities, in both directions.** A logged-in web ChatGPT, Claude, Grok,
Gemini or Kimi session is an execution substrate like HTTP, a function or a flow: a caller names a
provider and a prompt, never a browser, a selector or a tab. The gateway binds the exact prompt to
the exact captured response in a receipt, and a `state://` handle lets one model continue another's
work without a pasted transcript. The relay lane runs the other way: a web model with no MCP, no
function calling and no credentials emits `[KEY]args[/KEY]`, the grammar the build already speaks,
and the relay invokes each capability under the caller's authority.
Live: [web models as first-class capabilities](https://miscsubjects.com/a/web-models-as-first-class-capabilities).
Code: `functions/_lib/webmodel_gateway.js`, `functions/_lib/webmodel_relay.js`, `bridge/webmodel/`,
[docs/WEB_MODELS.md](docs/WEB_MODELS.md).

**9. A spreadsheet tab is an invocation inbox.** A model that must treat a web page as data can
still operate the whole directory: it writes what to invoke into column A of a sheet it is allowed
to edit, the bridge runs it, and the state, answer, time and ledger trace land in columns B to E.
One Google connection reaches every row that exists now and every flow composed later.
Code: `functions/api/sheet-bridge.js`.

**10. Sheets are projections, and every object has an address.** The directory holds the nouns,
the ledger holds the verbs, and everything else is a view. A view sheet stores a description, not
rows: which source, which filters, which columns, and a JSON path into any payload, so the exact
text a model was sent is one column away from the row that sent it. Every sheet is `sheet://<id>`
with a self payload; every admin page is `page://<path>` with a descriptor, its governing rules and
its comparables. One generated manual describes the environment from the same descriptors the
runtime uses.
Live: [the environment manual](https://miscsubjects.com/api/environment?format=markdown).
Code: `functions/_lib/sheet_views.js`, `functions/_lib/environment_descriptor.js`,
`functions/_lib/object_context.js`, [docs/SHEETS.md](docs/SHEETS.md).

**11. Any ledger row can trigger a capability.** An automation registered as
`event:on source=… action=… match=<regex>` fires whenever a matching row is written, so a device
report, a payment, an inbound message, a failed deploy and an agent's own output are the same kind
of trigger, because they are already the same kind of row. Rows written by an automation never
match, so a trigger cannot loop, and the fire can never stop the write of the evidence that caused it.
Code: `functions/_lib/event_log.js`, `functions/api/automations/`.

**12. A traffic engine whose every decision is explainable and replayable.** `/go/<entry>` runs
one request through identifiers, profile, signals, policy and decision, renders the experience
(redirect, inline, Turnstile, acknowledgement, deny, static, SMS squeeze) and records every rule's
every condition as true or false. `explain` runs a simulated visitor with no writes; `replay`
re-runs a stored decision against the revision that made it and against the live configuration and
reports the difference. Rules are authored in plain English: `if <field> <op> <value> then <action>`.
Live: [a demo entry](https://miscsubjects.com/go/gateoxza).
Code: `functions/_lib/traffic/`, `functions/go/`, `functions/api/traffic/`, [docs/TRAFFIC.md](docs/TRAFFIC.md).

**13. Where a capability runs is policy, decided once.** A row's `execution` column says whether it
may run in the cloud, on the operator's machine, either, or only on that machine because it needs
the screen, a local file or a locally held credential. Routing happens in the dispatcher, so cron,
flows, agents and REST inherit it, and every result names the substrate that actually ran it. A
sleeping laptop is reported as `edge_unavailable`, never as a broken build.
Code: `functions/_lib/execution_routing.js`, `workers/sandbox/`.

**14. A public ledger with redaction at the door.** Every dispatch, model call, e-mail, deploy and
edit appends a row. Because the ledger is public, identity and credentials are removed at ingest in
one module, and a deploy gate checks the live endpoints for a regression. A lookup that fails
answers `503 LEDGER_LOOKUP_FAILED`, never "it did not happen".
Live: [the ledger](https://miscsubjects.com/ledger).
Code: `functions/_lib/event_log.js`, `functions/_lib/public_secret_guard.js`, `functions/_lib/invocation_log.js`.

And the repository you are reading is produced by a fifteenth: a projection exporter that
substitutes identity, stubs the operator's integrations, removes narrative, and refuses to publish
on any gate failure. Live: [the current manifest](https://miscsubjects.com/img/projection/latest.json).
Code: `scripts/publish-mirror.mjs`, [docs/PUBLISHING.md](docs/PUBLISHING.md).

## Four rules

1. **Every capability is a row.** The `directory` table in D1 holds one row per thing the system can
   do: an HTTP call, a function, an agent with a prompt, a flow, or a browser-model session. Nothing
   is callable that is not a row, and every row is callable through one door,
   `POST /api/dispatch {key, body}`, which answers `{ok, result, invocation, yield, _self}`: the
   result, the ledgered record of the run, its cost and material, and the row's description of itself.
2. **Every action is a receipt.** Each dispatch, model call, email, deploy and edit appends a row to
   an append-only ledger. Identity and credentials are removed at ingest, not afterwards.
3. **Work exists only as a task object.** Agents lease a task, do what it says, and submit evidence.
   The infrastructure runs the task's acceptance tests against the live site and sets the state.
4. **A rule that is not enforced is a comment.** Each operating law is a script under
   `scripts/check-*.mjs` that fails the deploy, or a server-side refusal with a `422` that names the
   fix. `scripts/ship.mjs` runs every gate listed in `scripts/gates.manifest.json`.

## How a request moves

```
 iMessage / WhatsApp / Telegram / web form / REST caller / MCP client / CLI agent / sheet row / web model
                       │
                       ▼
   Cloudflare Pages Functions  (functions/)
     _middleware.js     : request shaping, identity scrub, JSON door, object context line
     api/dispatch.js    : THE door. Loads the row for `key`; checks token, tenant and
                          capability context; routes execution; runs it; writes the ledger;
                          returns {ok, result, invocation, yield, _self}
     api/turn.js        : a conversational turn → router agent → [KEY]args[/KEY] → reply
     api/work/          : the task object (lease, submit, fail, audit)
     api/coding-law/    : sha256 leases on code files
     api/articles/      : article writes, with the content laws applied server-side
     api/sheets/        : sheets as objects and views       api/environment/ : the manual
     api/traffic/  go/  : the traffic engine's configuration and public entry
     a/[slug].js        : the public article renderer      admin/ : operator surfaces
                       │
          ┌────────────┼──────────────┬──────────────┬─────────────────┬──────────────────┐
          ▼            ▼              ▼              ▼                 ▼                  ▼
   D1 `DB`        D1 `LEDGER`      KV            R2 bucket      Workers beside Pages   sandbox
   directory,     events,          snapshots,    images,        cron, Durable Objects, cloud
   articles,      capability       settings,     screenshots,   queue, Workflows,      shell
   work_*,        contexts,        locks         uploads,       browser, e-mail
   traffic_*,     pop_nonces                     manifests
   sheets …       (append-only)
                       │
                       ▼
   The Mac bridge (bridge/)  ← rows with runner=mac execute on the operator's machine over a
                               tunnel: shell, files, UI control, coding agents, and the
                               browser-model worker that drives logged-in web models
```

Every row declares a **runner**, which says where it executes, and may declare an **execution**
policy, which says where it is allowed to. **edge** rows run inside Cloudflare; **mac** rows are
forwarded to the bridge on the operator's machine; **sibling** rows run in the `miscsubjects-sibling`
Worker, which holds what Pages Functions cannot (cron, Durable Objects, the queue consumer,
Workflows, browser rendering, e-mail); **apps_script** rows run in Google Apps Script for
spreadsheet work; cloud-capable rows may be routed to the `miscsubjects-sandbox` Worker.

## By the numbers

A snapshot at the time this document was written. The live figures are one request away.

| | Count | Live |
|---|---|---|
| Capabilities in the directory | 1,166 (636 functions · 375 HTTP · 96 agents · 59 flows) | [`/api/directory?brief=1`](https://miscsubjects.com/api/directory?brief=1) |
| Work tasks graded complete by the infrastructure | 44, with 67 open and 28 superseded | [`/api/work`](https://miscsubjects.com/api/work) |
| Deploy gates in the manifest | 51 | `scripts/gates.manifest.json` |
| Files in this projection | 1,267 across 6 export gates, 21 stubbed modules | [`latest.json`](https://miscsubjects.com/img/projection/latest.json) |
| Migrations carried | 345 of 385 (content-seeding and tenant migrations are dropped) | `migrations/` |
| Engineering skills carried | 30 | `.claude/skills/` |

## The pieces

| Piece | What it is | Where |
|---|---|---|
| Dispatch | Loads a directory row and runs it; the one write path for capabilities; token, tenant and context gates; execution routing; flow steps | `functions/api/dispatch.js` |
| Function runners | The `fn` rows, by name; extended by new modules merged into the map | `functions/_lib/fn_runners.js` |
| Directory | D1 table `directory`; edited at `/admin/directory` or through `/api/directory`; snapshot cached in KV and served by a Durable Object in its own Worker; every row carries its real request and test state | `functions/api/directory/`, `workers/directory-do/`, `functions/_lib/invocation_record.js` |
| Ledger | Append-only `events`; public at `/ledger`; scrubbed at ingest; every row a potential trigger | `functions/_lib/event_log.js`, `functions/_lib/public_secret_guard.js` |
| Work object | Tasks, leases, evidence, acceptance, hash-chained actions | `functions/_lib/work_object.js`, `functions/api/work/` |
| Coding law | A sha256 lease per file before an edit, checked at commit and deploy | `functions/api/coding-law/`, `scripts/check-coding-law.mjs` |
| Authority | Signed capability tokens; capability contexts; profiles, devices, proof of possession; Turnstile step-up | `functions/_lib/capability_context.js`, `functions/api/device/`, `functions/api/profile/` |
| Execution routing | Cloud, operator machine, either, or machine-only, decided in the dispatcher | `functions/_lib/execution_routing.js`, `workers/sandbox/` |
| Flows | The step DSL (`>`, `|`, `$1`, `$PREV`, `JSON:`, `EACH:`, `MERGE:`) and learned flows from traces | `functions/api/dispatch.js`, `functions/_lib/flow_learn.js`, `functions/_lib/json_path.js` |
| Browser models | Durable sessions and turns, receipts, `state://` handles, the relay lane, the Mac worker and its five provider adapters | `functions/_lib/webmodel_gateway.js`, `functions/_lib/webmodel_relay.js`, `bridge/webmodel/` |
| Sheet bridge | A Google Sheet tab as an invocation inbox for any browser model | `functions/api/sheet-bridge.js` |
| Environment | Descriptors with content hashes and compare-and-set revisions; the generated manual; object, governance and comparables resolvers; the per-page object context | `functions/_lib/environment_descriptor.js`, `functions/_lib/environment_manual.js`, `functions/api/environment/`, `functions/_lib/object_context.js` |
| Sheets | Sheets as objects (`sheet://<id>`), view sheets over the sources of record, pins that write through, one Durable Object per sheet | `functions/api/sheets/`, `functions/_lib/sheet_views.js`, `functions/_lib/sheets_store.js`, `workers/sheet-do/` |
| Traffic engine | Signals, conditions, policy, decisions, grants, rendered experiences, SMS funnel, plain-English rules, the console | `functions/_lib/traffic/`, `functions/go/`, `functions/api/traffic/`, `functions/admin/traffic-console.js` |
| Content laws | Writing law, subject gate, claims, sources, one-object law, applied on article `PUT` | `functions/_lib/writing_law_object.js`, `functions/_lib/subject_gate.js`, `functions/_lib/article_ledger.js` |
| Articles | Articles with slots, claims, sources, comments and a model comment ledger | `functions/api/articles/`, `functions/a/[slug].js` |
| Object Invocation Protocol | The self-describing invocation grammar every row answers to | `functions/_lib/object_contract.js`, [docs/OIP.md](docs/OIP.md) |
| MCP server | Exposes the directory to any MCP client; typed arguments in the order the row declares | `functions/api/mcp.js`, `workers/mcp-server/` |
| Agents | Router, writers, editors, adjudicators, governor; prompts are directory rows, never strings in code; `hooks/` wires the coding-agent CLIs so every turn lands on the ledger | `prompts/`, `functions/_lib/governor.js`, `functions/_lib/tag_calls.js`, `hooks/` |
| Automations | Wall-clock, interval and event-triggered jobs | `functions/api/automations/`, `workers/sibling/` |
| Background jobs | The `miscsubjects-tasks` queue; durable agent loops (`AgentDO`) and per-expert state (`ExpertDO`); the deliver and self-test Workflows | `workers/sibling/` |
| Deploy gate | Lease, migrate, preview, smoke test, promote, run every post-promotion gate | `scripts/ship.mjs`, `scripts/gates.manifest.json` |
| Failure vault | Every named failure mode as one mechanical entry, enforced pre-commit and pre-deploy | `failure-vault.json`, `scripts/check-failure-vault.mjs` |
| Skills | The procedures agents load, one folder per skill | `.claude/skills/` |
| Mac bridge | The local runner: shell, files, UI automation, coding agents, launchd services, the browser-model worker | `bridge/` |
| CLI | `misc`, a terminal agent that talks to the system through the same door and posts its own turns to the ledger | `misc-cli/` |
| Tests | Node tests beside the modules they cover and under `scripts/`; the deploy runs them in its pre-phase | `functions/**/*.test.mjs`, `scripts/*.test.mjs` |

[docs/README.md](docs/README.md) is the index of the documentation. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
is the long-form description from request to receipt; bindings are authoritative in `wrangler.toml`
and the `workers/*/wrangler.toml` files.

## Deep dives — the major features

Each significant subsystem has a focused document, a code path, and a live surface you can open
right now. Start with the doc, read the code, then watch it run.

| Feature | Read | Code | Live |
|---|---|---|---|
| One capability, six ways to call it | [docs/SIX_WAYS.md](docs/SIX_WAYS.md) | `functions/api/dispatch.js` | [a row, six surfaces](https://miscsubjects.com/api/dispatch?key=NOW) |
| Operable by strangers — token drop, cold models | [docs/COLD_MODELS.md](docs/COLD_MODELS.md) | `functions/api/sheet-bridge.js` | [the one-call manual](https://miscsubjects.com/api/environment?format=markdown) |
| Object Invocation Protocol — self-describing capabilities | [docs/OIP.md](docs/OIP.md) | `functions/_lib/object_contract.js` | [a row describing itself](https://miscsubjects.com/api/dispatch?key=NOW) |
| Authority — tokens + capability contexts | [docs/AUTHORITY.md](docs/AUTHORITY.md) | `functions/_lib/capability_context.js` | [the step-up](https://miscsubjects.com/verify-device) |
| Flows & learned-from-the-ledger flows | [docs/FLOWS.md](docs/FLOWS.md) | `functions/_lib/flow_learn.js` | [the directory](https://miscsubjects.com/api/directory?brief=1) |
| Browser models as capabilities + the relay | [docs/WEB_MODELS.md](docs/WEB_MODELS.md) | `functions/_lib/webmodel_gateway.js` | [/api/manual](https://miscsubjects.com/api/manual) |
| Sheets as live projections of the record | [docs/SHEETS.md](docs/SHEETS.md) | `functions/_lib/sheet_views.js` | [a sheet as an object](https://miscsubjects.com/api/sheets/sh_urmt4xfs/self) |
| Traffic engine — explainable, replayable | [docs/TRAFFIC.md](docs/TRAFFIC.md) | `functions/_lib/traffic/` | [a splitter entry](https://miscsubjects.com/go/gateoxza) |
| The work object — work the infra grades | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §7 | `functions/_lib/work_object.js` | [/api/work](https://miscsubjects.com/api/work) |
| The ledger — every action a receipt | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §6 | `functions/_lib/event_log.js` | [/ledger](https://miscsubjects.com/ledger) |
| The projection that produced this repo | [docs/PUBLISHING.md](docs/PUBLISHING.md) | `scripts/publish-mirror.mjs` | [the manifest](https://miscsubjects.com/img/projection/latest.json) |

This repository is one monorepo, not many packages: the features above share the dispatch door, the
directory and the ledger, so they are documented and cross-linked here rather than split into
sub-repositories that could not run on their own.

## Storage and infrastructure

| Binding | Service | Holds |
|---|---|---|
| `DB` | D1 `miscsubjects-content` | directory, articles, work tasks and actions, settings, automations, sheets, environment descriptors, profiles, devices, identifiers, traffic configuration and decisions, web-model sessions and turns, state handles, every governed table |
| `LEDGER` | D1 `miscsubjects-events` | the append-only event ledger, capability contexts, proof-of-possession nonces |
| `KV` | one namespace | directory snapshot, settings cache, locks and claims, feature switches |
| `R2` | bucket `miscsubjects-ledger` | generated images, screenshots, uploads, captured sources, oversized ledger bodies, the projection manifests |
| `AI` | Workers AI | embeddings, small models, image generation fallbacks |
| `DIRECTORY_DO`, `SHEET_DO` | Durable Objects, each in its own Worker | single-writer directory snapshot; one object per sheet |
| `TASKS` | Queue `miscsubjects-tasks` | background jobs, consumed by the sibling Worker |
| `STORE` | Service binding to `miscsubjects-storage` | reference storage in R2 with a D1 index, fronted by `/api/store` |
| `SANDBOX` | Service binding to `miscsubjects-sandbox` | the cloud execution plane: shell in a container, reachable only through the binding |

Preview deployments bind to separate preview databases so a preview can never write production
rows. Secrets are Pages environment variables and Worker secrets, never files.
[SECURITY.md](SECURITY.md) lists the configuration names the code expects.

## Running it

You need a Cloudflare account with Pages, Workers, D1, KV, R2 and Workers AI, Node 22 or newer, and
`wrangler`.

1. Create the two D1 databases, the KV namespace and the R2 bucket named in `wrangler.toml`, and put
   their ids in place of the ones there.
2. Apply `migrations/*.sql` in numeric order to the `DB` database and `migrations/ledger/*.sql` to
   the `LEDGER` database. Migrations that seeded published content, or that belong to the excluded
   integrations, are not in this repository, so the sequence has gaps; the schema is complete.
3. Deploy the Workers the Pages project binds by name first, or the Pages deploy fails on a missing
   binding: `workers/directory-do`, `workers/sheet-do`, `workers/storage`, `workers/sandbox`. Then
   `workers/sibling`, which holds the cron and the queue consumer. The remaining Workers
   (`workers/mcp-server`, `workers/oip-peer`, `workers/robots-fix`) are independent services and can
   be deployed in any order.
4. Set the secrets the code reads as Pages environment variables. Nothing runs without
   `TERMINAL_KEY`; integrations degrade to a clear refusal when their key is absent, and the stubbed
   tenant modules throw with their path when reached.
5. Deploy with `node scripts/ship.mjs` from the repository root. It takes a deploy lease, applies the
   newest migration, deploys a preview, smoke-tests it, promotes it, then runs every gate in
   `scripts/gates.manifest.json`.
6. Optional: the Mac bridge (`bridge/install.sh`) gives the system a local runner over a Cloudflare
   tunnel, and `bridge/webmodel/` adds the browser-model worker. Without them, `mac` rows and
   web-model rows refuse with a clear reason.

Run the tests with Node directly, for example:

```bash
node scripts/traffic-engine.test.mjs && node scripts/capability-context.test.mjs && node scripts/flow-learn.test.mjs
```

## How work gets done

- **Agents lease tasks.** `POST /api/work/lease` returns one bounded task with its objective,
  permitted capabilities, acceptance tests and required evidence. `POST /api/work/task/<id>/submit`
  hands back evidence; the infrastructure grades it. `POST /api/work/task/<id>/fail` records a
  failure object naming the failure class, the layer that permitted it and the missing invariant.
- **Code edits are leased too.** Before the first edit to anything under `functions/`, `scripts/`,
  `migrations/`, `workers/`, `apps-script/`, `public/`, the skills, `schema.sql` or `wrangler.toml`,
  an agent declares the sha256 of each file it read (`POST /api/coding-law/start`) and, before
  committing, the sha256 of what it wrote (`POST /api/coding-law/commit`). A second agent that
  committed the same file in between gets a refusal instead of silently erasing the first.
- **Some files are locked.** `PROTECTED_FEATURES.md` and `PROTECTED_WIDGETS.md` name paths only the
  operator changes; the commit-msg hook and the deploy gate refuse everything else. A locked module
  is extended by a new library merged into its map, never by editing it.
- **Prompts are rows.** A model call's system prompt is a directory row, never a string in code;
  `scripts/check-prompts-not-in-code.mjs` enforces it.
- **A failed lookup is a failure.** Any public "not found" must be proven by a query that succeeded
  and returned no row; a query that failed is a `503`, never a `404`.
- **Pointer files carry no authority.** `AGENTS.md` and `STATE.md` are regenerated from the work
  object and fail the deploy if they grow rules back.

## Reading order

1. This page, then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) from request to receipt.
2. [docs/OIP.md](docs/OIP.md): the invocation grammar every row answers to.
3. [docs/AUTHORITY.md](docs/AUTHORITY.md), [docs/FLOWS.md](docs/FLOWS.md),
   [docs/WEB_MODELS.md](docs/WEB_MODELS.md), [docs/SHEETS.md](docs/SHEETS.md),
   [docs/TRAFFIC.md](docs/TRAFFIC.md): one subsystem each.
4. [docs/PUBLISHING.md](docs/PUBLISHING.md): how this repository is produced and checked, and
   [docs/REPO_MAP.md](docs/REPO_MAP.md) for every directory.
5. The live system: [`/start`](https://miscsubjects.com/start), then
   [`/api/environment?format=markdown`](https://miscsubjects.com/api/environment?format=markdown).

## Contributing

Every commit in this repository is generated, so a pull request here cannot be merged. Open an
issue instead: a defect, a question, a place where the code and this description disagree. Issues
are read and become work objects in the operating system, which grades the repair.

## Licensing

No license has been granted yet. The code is made available for reading; all rights are reserved
until a `LICENSE` file says otherwise.
