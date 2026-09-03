# miscsubjects

A self-operating system on Cloudflare in which every capability is a database row, every action
leaves a receipt in an append-only ledger, work is a leased task graded by the infrastructure, and
every operating rule is a check that can fail a deploy. It runs miscsubjects.com: a research
library, a public ledger, an invocation directory (the live count is at `/api/directory`), and a
work queue for AI agents.

This repository is the **primitive** of that system: the kernel, its governance, the content
machinery and the agent layer, with the operator's business integrations and published content
removed. It is generated from a private operating repository by `scripts/publish-mirror.mjs`;
`PROJECTION.json` at the root names the source commit, what was left out and why, which modules are
stubs, and which gates the tree passed. Where the kernel imports a business integration, a stub with
the same exports stands in its place and throws with the module's path when used, so the shape of
the system is complete and the boundary is visible. [docs/PUBLISHING.md](docs/PUBLISHING.md)
describes the mechanism; [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) describes the system.

The live system explains itself:

| | |
|---|---|
| Start | https://miscsubjects.com/start |
| The work object, for people | https://miscsubjects.com/a/the-work-object |
| The work object, for machines | https://miscsubjects.com/api/work |
| Cold start for an agent | https://miscsubjects.com/api/work/bootstrap |
| Audit chain of every work action | https://miscsubjects.com/api/work/audit |
| Every invocable capability | https://miscsubjects.com/api/directory |
| Generated REST manual | https://miscsubjects.com/api/manual |
| The ledger | https://miscsubjects.com/ledger |

## What is unusual here

Five mechanisms carry the design. Each is running in public, so the link is the proof.

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
the MCP server's tools, and the generated REST manual.
Live: [the directory](https://miscsubjects.com/api/directory) ·
[one row describing itself](https://miscsubjects.com/api/dispatch?key=NOW) ·
[the generated manual](https://miscsubjects.com/api/manual) ·
[the protocol](https://miscsubjects.com/a/oip).
Code: `functions/api/dispatch.js`, `functions/_lib/object_contract.js`, `docs/OIP.md`.

**5. A public ledger with redaction at the door.** Every dispatch, model call, e-mail, deploy and
edit appends a row. Because the ledger is public, identity and credentials are removed at ingest in
one module, and a deploy gate checks the live endpoints for a regression.
Live: [the ledger](https://miscsubjects.com/ledger).
Code: `functions/_lib/event_log.js`, `functions/_lib/public_secret_guard.js`.

And the repository you are reading is itself produced by a sixth: a projection exporter that
substitutes identity, stubs the operator's integrations, removes narrative, and refuses to publish
on any gate failure. Live: [the current manifest](https://miscsubjects.com/img/projection/latest.json).
Code: `scripts/publish-mirror.mjs`, [docs/PUBLISHING.md](docs/PUBLISHING.md).

## Four rules

1. **Every capability is a row.** The `directory` table in D1 holds one row per thing the system can
   do: an HTTP call, a function, an agent with a prompt, or a flow. Nothing is callable that is not a
   row, and every row is callable through one door, `POST /api/dispatch {key, body}`, which answers
   `{ok, result, invocation, yield, _self}`: the result, the ledgered record of the run, its cost
   and material, and the row's description of itself.
2. **Every action is a receipt.** Each dispatch, model call, email, deploy and edit appends a row to
   an append-only ledger. Identity and credentials are removed at ingest, not afterwards.
3. **Work exists only as a task object.** Agents lease a task, do what it says, and submit evidence.
   The infrastructure runs the task's acceptance tests against the live site and sets the state.
4. **A rule that is not enforced is a comment.** Each operating law is a script under
   `scripts/check-*.mjs` that fails the deploy, or a server-side refusal with a `422` that names the
   fix. `scripts/ship.mjs` runs every gate listed in `scripts/gates.manifest.json`.

## How a request moves

```
 iMessage / WhatsApp / Telegram / web form / REST caller / MCP client / CLI agent
                       │
                       ▼
   Cloudflare Pages Functions  (functions/)
     _middleware.js   : request shaping, identity scrub, headers
     api/dispatch.js  : the door. Loads the directory row for `key`, runs it,
                        writes the ledger, returns {ok, result, invocation, yield, _self}
     api/turn.js      : a conversational turn → router agent → tools → reply
     api/work/        : the task object (lease, submit, fail, audit)
     api/articles/    : article writes, with the content laws applied server-side
     a/[slug].js      : the public article renderer
     admin/           : operator surfaces (directory editor, ledger, prompts, work)
                       │
          ┌────────────┼──────────────┬──────────────┬─────────────────┐
          ▼            ▼              ▼              ▼                 ▼
   D1 `DB`        D1 `LEDGER`      KV            R2 bucket      Workers beside Pages
   directory,     events           snapshots,    images,        cron, Durable Objects,
   articles,      (append-only)    settings,     screenshots,   queue, Workflows,
   work_tasks,                     locks         uploads        browser, e-mail
   work_actions,
   settings …
                       │
                       ▼
   The Mac bridge (bridge/)  ← rows with runner=mac execute on the operator's machine
                                over a tunnel: shell, files, UI control, coding agents;
                                hooks/ posts every coding-agent turn to the ledger
```

Every row also declares a **runner**, which says where it executes. There are four: **edge** rows
run inside Cloudflare; **mac** rows are forwarded to the bridge on the operator's machine;
**sibling** rows run in the `miscsubjects-sibling` Worker, which holds what Pages Functions cannot
(cron, Durable Objects, the queue consumer, Workflows, browser rendering, e-mail); **apps_script**
rows run in Google Apps Script (`apps-script/`) for spreadsheet work.

## The pieces

| Piece | What it is | Where |
|---|---|---|
| Dispatch | Loads a directory row and runs it; the one write path for capabilities | `functions/api/dispatch.js` |
| Function runners | The `fn` rows, by name | `functions/_lib/fn_runners.js` |
| Directory | D1 table `directory`; edited at `/admin/directory`; snapshot cached in KV and served by a Durable Object in its own Worker | `workers/directory-do/`, `functions/_lib/dir_snapshot.js` |
| Ledger | Append-only `events`; public at `/ledger`; scrubbed at ingest | `functions/_lib/event_log.js`, `functions/_lib/public_secret_guard.js` |
| Work object | Tasks, leases, evidence, acceptance, hash-chained actions | `functions/_lib/work_object.js`, `functions/api/work/` |
| Coding law | A sha256 lease per file before an edit, checked at commit and deploy | `functions/api/coding-law/`, `scripts/check-coding-law.mjs` |
| Content laws | Writing law, subject gate, claims, sources, one-object law, applied on article `PUT` | `functions/_lib/writing_law_object.js`, `functions/_lib/subject_gate.js`, `functions/_lib/article_ledger.js` |
| Articles | Articles with slots, claims, sources, comments and a model comment ledger | `functions/api/articles/`, `functions/a/[slug].js` |
| Object Invocation Protocol | The self-describing invocation grammar every row answers to | `functions/api/dispatch.js`, `functions/_lib/object_contract.js`, `docs/OIP.md` |
| MCP server | Exposes the directory to any MCP client | `functions/api/mcp.js`, `workers/mcp-server/` |
| Agents | Router, writers, editors, adjudicators, governor; prompts are directory rows, never strings in code. `hooks/` wires the coding-agent CLIs on the operator's machine so every turn lands on the ledger | `prompts/`, `functions/_lib/governor.js`, `hooks/` |
| Automations | Wall-clock and interval jobs run by the sibling cron | `functions/api/automations/`, `workers/sibling/` |
| Sheets | A spreadsheet surface over D1 with one Durable Object per sheet, in its own Worker | `workers/sheet-do/`, `functions/api/sheets/`, `functions/_lib/sheets_store.js` |
| Background jobs | The `miscsubjects-tasks` queue, produced by Pages and consumed by the sibling Worker; durable agent loops (`AgentDO`) and per-expert state (`ExpertDO`); the deliver and self-test Workflows | `workers/sibling/` |
| Deploy gate | Lease, migrate, preview, smoke test, promote, run every post-promotion gate | `scripts/ship.mjs`, `scripts/gates.manifest.json` |
| Failure vault | Every named failure mode as one mechanical entry, enforced pre-commit and pre-deploy | `failure-vault.json`, `scripts/check-failure-vault.mjs` |
| Skills | The procedures agents load, one folder per skill | `.claude/skills/` |
| Mac bridge | The local runner: shell, files, UI automation, coding agents, launchd services | `bridge/` |
| CLI | `misc`, a terminal agent that talks to the system through the same door and posts its own turns to the ledger | `misc-cli/` |

[docs/REPO_MAP.md](docs/REPO_MAP.md) walks every directory. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
is the long-form infrastructure description; bindings are authoritative in `wrangler.toml` and the
`workers/*/wrangler.toml` files.

## Storage and infrastructure

| Binding | Service | Holds |
|---|---|---|
| `DB` | D1 `miscsubjects-content` | directory, articles, work tasks and actions, settings, automations, sheets, every governed table |
| `LEDGER` | D1 `miscsubjects-events` | the append-only event ledger |
| `KV` | one namespace | directory snapshot, settings cache, locks and claims, feature switches |
| `R2` | bucket `miscsubjects-ledger` | generated images, screenshots, uploads, captured sources, oversized ledger bodies, the projection manifests |
| `AI` | Workers AI | embeddings, small models, image generation fallbacks |
| `DIRECTORY_DO`, `SHEET_DO` | Durable Objects, each in its own Worker | single-writer directory snapshot; one object per sheet |
| `TASKS` | Queue `miscsubjects-tasks` | background jobs, consumed by the sibling Worker |
| `STORE` | Service binding to `miscsubjects-storage` | reference storage in R2 with a D1 index, fronted by `/api/store` |

Preview deployments bind to separate preview databases so a preview can never write production
rows. Secrets are Pages environment variables and Worker secrets, never files.
[SECURITY.md](SECURITY.md) lists the configuration names the code expects.

## Running it

You need a Cloudflare account with Pages, Workers, D1, KV, R2 and Workers AI, Node 22 or newer, and
`wrangler`.

1. Create the two D1 databases, the KV namespace and the R2 bucket named in `wrangler.toml`, and put
   their ids in place of the ones there.
2. Apply `migrations/*.sql` in numeric order to the `DB` database. Migrations that seeded published
   content, or that belong to the excluded integrations, are not in this repository, so the sequence
   has gaps; the schema is complete.
3. Deploy the Workers the Pages project binds by name first, or the Pages deploy fails on a missing
   binding: `workers/directory-do`, `workers/sheet-do`, `workers/storage`. Then `workers/sibling`,
   which holds the cron and the queue consumer. The remaining Workers (`workers/mcp-server`,
   `workers/oip-peer`, `workers/robots-fix`) are independent services and can be deployed in any order.
4. Set the secrets the code reads as Pages environment variables. Nothing runs without
   `TERMINAL_KEY`; integrations degrade to a clear refusal when their key is absent, and the stubbed
   tenant modules throw with their path when reached.
5. Deploy with `node scripts/ship.mjs` from the repository root. It takes a deploy lease, applies the
   newest migration, deploys a preview, smoke-tests it, promotes it, then runs every gate in
   `scripts/gates.manifest.json`.
6. Optional: the Mac bridge (`bridge/install.sh`) gives the system a local runner over a Cloudflare
   tunnel. Without it, `mac` rows refuse with a clear reason.

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
  operator changes; the commit-msg hook and the deploy gate refuse everything else.
- **Prompts are rows.** A model call's system prompt is a directory row, never a string in code;
  `scripts/check-prompts-not-in-code.mjs` enforces it.
- **Pointer files carry no authority.** `AGENTS.md` and `STATE.md` are regenerated from the work
  object and fail the deploy if they grow rules back.

## Contributing

Every commit in this repository is generated, so a pull request here cannot be merged. Open an
issue instead: a defect, a question, a place where the code and this description disagree. Issues
are read and become work objects in the operating system, which grades the repair.

## Licensing

No license has been granted yet. The code is made available for reading; all rights are reserved
until a `LICENSE` file says otherwise.
