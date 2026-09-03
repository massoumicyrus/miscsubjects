# miscsubjects — the build

miscsubjects.com is a self-operating publishing and operations system on Cloudflare. It runs a
research library, a public ledger of everything it does, an invocation directory of about a thousand
capabilities, and a work queue whose tasks are leased by AI agents and graded by the infrastructure
rather than by the agent that did the work.

This repository is the code. The live system explains itself better than any document can, so start
with the running site:

| Want to | Go to |
|---|---|
| Understand what the build is for | https://miscsubjects.com/start |
| See what work exists and how it is graded | https://miscsubjects.com/a/the-work-object |
| Read the same thing as a machine | https://miscsubjects.com/api/work |
| Cold-start as an agent with no context | https://miscsubjects.com/api/work/bootstrap |
| Read the audit chain of every work action | https://miscsubjects.com/api/work/audit |
| Browse every invocable capability | https://miscsubjects.com/api/directory |
| Read the full REST manual, generated from the live directory | https://miscsubjects.com/api/manual |
| See the ledger of everything the system did | https://miscsubjects.com/ledger |

If you are reading this in the repository named `miscsubjects` rather than the operating repository,
you are reading a **generated projection**. `PROJECTION.json` at the root says which source commit it
came from, what was left out, and which gates it passed. [docs/PUBLISHING.md](docs/PUBLISHING.md)
explains why the operating repository is never published directly.

## The thesis

Most software systems that use AI agents let the agent decide when it is done. This one does not.
Four rules shape everything in the tree:

1. **Every capability is a row.** The `directory` table in D1 holds one row per thing the system can
   do: an HTTP call, a function, an agent with a prompt, or a flow. Nothing is callable that is not a
   row, and every row is callable through one door, `POST /api/dispatch {key, body}`.
2. **Every action is a receipt.** Every dispatch, model call, email, deploy and edit appends a row to
   an append-only ledger. Public readers can inspect any turn. Identity and credentials are scrubbed
   at ingest, not afterwards.
3. **Work exists only as a task object.** Agents lease a task, do exactly what it says, and submit
   evidence. The infrastructure runs the task's acceptance tests against the live site and sets the
   state. A sentence in a report completes nothing.
4. **A rule that is not enforced is a comment.** Every operating law the owner has stated is a gate:
   a script under `scripts/check-*.mjs` that fails the deploy, or a server-side refusal with a
   `422` that explains the fix. There are about fifty of them, and `scripts/ship.mjs` runs every one
   listed in `scripts/gates.manifest.json`.

The consequence is a system whose documentation is mostly generated from its own state, whose
rules live in the database and the gates rather than in markdown, and whose history of failures is
itself a mechanical artifact (`failure-vault.json`).

## How a request moves through the system

```
 iMessage / WhatsApp / Telegram / web form / REST caller / MCP client / CLI agent
                       │
                       ▼
   Cloudflare Pages Functions  (functions/)            ← one project, one domain
     _middleware.js   : cloaking, identity scrub, headers
     api/dispatch.js  : THE door. Loads the directory row for `key`, runs it,
                        writes the ledger, returns {result, invocation, _self}
     api/turn.js      : a conversational turn → ROUTER agent → tools → reply
     api/work/        : the task object (lease, submit, fail, audit)
     api/articles/    : article writes, with the content laws applied server-side
     a/[slug].js      : the public article renderer
     admin/           : operator surfaces (directory editor, ledger, prompts, work)
                       │
          ┌────────────┼──────────────┬──────────────┬─────────────────┐
          ▼            ▼              ▼              ▼                 ▼
   D1 `DB`        D1 `LEDGER`      KV            R2 bucket      Sibling Workers
   directory,     events           snapshots,    images,        cron, durable
   articles,      (append-only)    settings,     screenshots,   objects, queues,
   work_tasks,                     locks         uploads        browser rendering
   work_actions,
   settings …
                       │
                       ▼
   The Mac bridge (bridge/, hooks/)  ← rows with runner=mac execute on the operator's
                                        machine over a tunnel: shell, files, UI control,
                                        coding agents (Claude Code, Codex, Gemini, Kimi, Grok)
```

Three runners exist. **edge** rows run inside Cloudflare. **mac** rows are forwarded to the bridge on
the operator's machine. **sibling** rows run in the `loop-safe-sibling` Worker, which exists because
Pages Functions cannot host cron triggers, durable objects, queue consumers or the browser-rendering
binding. **apps_script** rows run inside Google Apps Script for spreadsheet work.

## The pieces, and where each lives

| Piece | What it is | Where |
|---|---|---|
| Dispatch | Loads a directory row and runs it; the one write path for capabilities | `functions/api/dispatch.js` |
| Function runners | The `fn` rows: every built-in capability, by name | `functions/_lib/fn_runners.js` |
| Directory | D1 table `directory`; edited at `/admin/directory`; snapshot cached in KV and a Durable Object | `workers/directory-do/`, `functions/_lib/dir_snapshot.js` |
| Ledger | Append-only `events`; public at `/ledger`; scrubbed at ingest | `functions/_lib/event_log.js`, `functions/_lib/public_secret_guard.js` |
| Work object | Tasks, leases, evidence, acceptance, hash-chained actions | `functions/_lib/work_object.js`, `functions/api/work/` |
| Coding law | A sha256 lease per file before an edit, checked at commit and deploy | `functions/api/coding-law/`, `scripts/check-coding-law.mjs` |
| Content laws | Writing law, subject gate, claims, sources, one-object law; applied on article `PUT` | `functions/_lib/writing_law_object.js`, `functions/_lib/subject_gate.js`, `functions/_lib/article_ledger.js` |
| Articles | Research articles with slots, claims, sources, comments and a model comment ledger | `functions/api/articles/`, `functions/a/[slug].js`, `functions/_lib/oip_articles.js` |
| Object Invocation Protocol | The self-describing invocation grammar every row answers to | `functions/api/dispatch.js`, `functions/_lib/object_contract.js`, `docs/OIP.md` |
| MCP server | Exposes the directory to any MCP client | `functions/api/mcp.js`, `workers/mcp-server/` |
| Agents | Router, writers, adjudicators, governor: prompts are directory rows, never strings in code | `prompts/`, `functions/_lib/governor.js`, `migrations/0338_*` |
| Automations | Wall-clock and interval jobs run by the sibling cron | `functions/api/automations/`, `workers/sibling/` |
| Sheets | A spreadsheet surface over D1 with one Durable Object per sheet | `workers/sheet-do/`, `functions/api/sheets/`, `functions/_lib/sheets_store.js` |
| Deploy gate | Lease, migrate, preview, smoke test, promote, run every post-promotion gate | `scripts/ship.mjs`, `scripts/gates.manifest.json` |
| Failure vault | Every owner-named failure mode as one mechanical entry, enforced pre-commit and pre-deploy | `failure-vault.json`, `scripts/check-failure-vault.mjs` |
| Skills | The rules agents load, one folder per skill, mirrored for each agent CLI | `.claude/skills/`, `.agents/skills/` |
| Mac bridge | The local runner: shell, files, UI automation, coding agents, launchd services | `bridge/`, `hooks/` |
| The CLI | `misc`, a terminal agent that talks to the build and posts its own turns to the ledger | `misc-cli/` |

[docs/REPO_MAP.md](docs/REPO_MAP.md) walks every top-level directory.
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) is the long-form infrastructure description (dated;
bindings are authoritative in `wrangler.toml` and the `workers/*/wrangler.toml` files).

## Storage and infrastructure

| Binding | Service | Holds |
|---|---|---|
| `DB` | D1 `loop-content-spine` | directory, articles, work tasks and actions, settings, automations, leads, sheets, every governed table |
| `LEDGER` | D1 `loop-shared-events` | the append-only event ledger |
| `KV` | one namespace | directory snapshot, settings cache, locks and claims, feature switches |
| `R2` | bucket `miscsubjects-ledger` | generated images, screenshots, uploads, captured sources |
| `AI` | Workers AI | embeddings, small models, image generation fallbacks |
| `DIRECTORY_DO`, `SHEET_DO` | Durable Objects in sibling Workers | single-writer directory snapshot; one object per sheet |
| `TASKS` | Queue `loop-tasks` | background jobs, consumed by the sibling Worker |
| `STORE`, `META_BRIDGE` | Service bindings | reference storage Worker; Meta Graph API front |

Preview deployments are bound to separate preview databases so a preview can never write
production rows. Secrets are Pages environment variables and Worker secrets, never files.
[SECURITY.md](SECURITY.md) lists what the code expects by name.

## Running it yourself

You need a Cloudflare account with Pages, Workers, D1, KV, R2 and Workers AI enabled, Node 22 or
newer, and `wrangler`.

1. Create the two D1 databases, the KV namespace and the R2 bucket named in `wrangler.toml`, and
   put their ids in place of the ones there.
2. Apply `migrations/*.sql` in numeric order to the `DB` database. The latest migration is the
   source of truth for the directory rows, the docs and the schema; `schema.sql` is the base.
3. Deploy the sibling Workers first, because the Pages project binds to them by name:
   `workers/directory-do`, `workers/sheet-do`, `workers/storage`, `workers/meta-bridge`, then
   `workers/sibling`. Each has its own `wrangler.toml`.
4. Set the secrets the code reads (names in [SECURITY.md](SECURITY.md)) as Pages environment
   variables. Nothing runs without `TERMINAL_KEY`; most integrations degrade to a clear refusal
   when their key is absent.
5. Deploy with `node scripts/ship.mjs` from the repository root. It takes a deploy lease, applies
   the newest migration, deploys a preview, smoke-tests it, promotes it, then runs every gate in
   `scripts/gates.manifest.json`. A hand-run `wrangler pages deploy` skips all of that and is how
   the outage class "Functions bundle not uploaded" happened once.
6. Optional: the Mac bridge (`bridge/install.sh`) gives the build a local runner for shell, files
   and coding agents over a Cloudflare tunnel. The build works without it; `mac` rows then refuse
   with a clear reason.

## How work gets done here

- **Agents lease tasks.** `POST /api/work/lease` returns one bounded task with its objective,
  permitted capabilities, acceptance tests and required evidence. `POST /api/work/task/<id>/submit`
  hands back evidence; the infrastructure grades it. `POST /api/work/task/<id>/fail` records a
  failure object naming the failure class, the layer that permitted it and the missing invariant.
- **Code edits are leased too.** Before the first edit to anything under `functions/`, `scripts/`,
  `migrations/`, `workers/`, `apps-script/`, `public/`, the skills, `schema.sql` or `wrangler.toml`,
  an agent declares the sha256 of each file it read (`POST /api/coding-law/start`) and, before
  committing, the sha256 of what it wrote (`POST /api/coding-law/commit`). A second agent that
  committed the same file in between gets a refusal instead of silently erasing the first. The
  skill is in `.claude/skills/coding-law/`.
- **Some files are locked.** `PROTECTED_FEATURES.md` and `PROTECTED_WIDGETS.md` name paths that
  only the owner changes; the commit-msg hook and the deploy gate refuse everything else.
- **Prompts are rows.** A model call's system prompt is a directory row, never a string in code;
  `scripts/check-prompts-not-in-code.mjs` enforces it.
- **Pointer files carry no authority.** `AGENTS.md` and `STATE.md` are regenerated from the work
  object and fail the deploy if they grow rules back.

## Publishing and privacy

The operating repository holds the ledger mirror, guard baselines and session notes alongside the
code, and its history predates the identity scrub. It stays private. `scripts/publish-mirror.mjs`
generates the publishable projection, substitutes identity, runs its gates against the output and
pushes one commit per export to the `miscsubjects` repository. The mechanism, the exclusions, and
the checklist for the day the mirror goes public are in [docs/PUBLISHING.md](docs/PUBLISHING.md).

## Status and licensing

Counts in this file (rows, gates, tables) are as of the source commit named in `PROJECTION.json`;
the live numbers are always at `/api/work` and `/api/directory`. No license has been granted yet:
the code is published for reading, and all rights are reserved until a `LICENSE` file says
otherwise.
