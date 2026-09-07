# Repository map

Every directory of the primitive, what it is for, and how it relates to the operating repository it
is generated from. Counts are live in `PROJECTION.json`.

## Code that runs

| Path | Purpose |
|---|---|
| `functions/` | Cloudflare Pages Functions: the whole HTTP surface. `api/` is the machine surface, `admin/` the operator surfaces, `a/` the public article and law pages, `go/` the traffic engine's public entry, `_lib/` the shared modules, `.well-known/` agent and skill discovery documents |
| `functions/api/dispatch.js` | The one door: loads a directory row, runs the token, tenant and context gates, routes execution, runs the row, writes the ledger; also the flow step interpreter |
| `functions/api/directory/` | The directory over REST: list (`?brief=1`, cell caps), row GET, create, edit, search, and `POST /<KEY>/test` which sets the row's invocation record |
| `functions/api/work/`, `functions/_lib/work_object.js` | The task object: create, lease, submit, grade, fail, audit chain |
| `functions/api/coding-law/` | sha256 leases on code files |
| `functions/api/sheets/`, `functions/_lib/sheet_views.js`, `functions/_lib/sheets_store.js` | Sheets as objects and as views of the sources of record; pins; write-through |
| `functions/api/sheet-bridge.js` | A Google Sheet tab as an invocation inbox for any browser model |
| `functions/api/environment/`, `functions/_lib/environment_*.js`, `functions/_lib/object_context.js` | Descriptors, the generated environment manual, the object, governance and comparables resolvers, the per-page object context line |
| `functions/api/device/`, `functions/api/profile/`, `functions/_lib/capability_context.js` | The presenter (profiles, devices, proof of possession, Turnstile step-up) and the capability-context gate |
| `functions/_lib/execution_routing.js`, `functions/api/cloud/` | Where a row may run, and the front door to the cloud execution plane |
| `functions/_lib/flow_learn.js`, `functions/_lib/json_path.js` | Learned flows from ledger traces; the one JSON-path reader |
| `functions/_lib/webmodel_gateway.js`, `functions/_lib/webmodel_relay.js`, `functions/_lib/tag_calls.js` | Browser models as capabilities (edge half), the relay lane, and the one `[KEY]args[/KEY]` reader |
| `functions/_lib/traffic/`, `functions/go/`, `functions/api/traffic/`, `functions/admin/traffic-console.js` | The traffic engine: signals, conditions, engine, store, grants, render, funnel, Turnstile, plain-English rules; its public entry, API and console |
| `functions/_lib/event_log.js`, `functions/_lib/invocation_log.js`, `functions/_lib/invocation_record.js` | Ledger ingest and the event bridge; receipt lookup that fails by name; the per-row invocation record |
| `functions/_lib/fn_runners.js` | Every built-in `fn` capability by name, dispatched by the directory; extended by new modules merged into its map |
| `functions/_lib/public_secret_guard.js` | Redaction at ledger ingest: provider key shapes, bound secrets, operator identity |
| `functions/**/*.test.mjs` | Node tests beside the modules they cover |
| `workers/` | Sibling Workers: `sibling` (cron, durable objects, queue consumer, browser rendering, inbound mail), `sandbox` (the cloud execution plane), `directory-do`, `sheet-do`, `storage`, `mcp-server`, `oip-peer`, `robots-fix` |
| `migrations/` | Numbered D1 migrations for the `DB` database; `migrations/ledger/` for the `LEDGER` database. Migrations that seeded published content are omitted, so the sequence has gaps |
| `schema.sql` | Base schema |
| `wrangler.toml` | Pages project bindings, production and preview |
| `public/` | Static assets: design system CSS, brand marks, figures, fonts, `robots.txt`, `_routes.json` |
| `apps-script/` | Google Apps Script runner for `apps_script` rows |
| `bridge/` | The Mac bridge: local HTTP server the edge calls over a tunnel for shell, files, UI control and coding agents; `bridge/webmodel/` the browser-model worker with one adapter per provider; launchd definitions; installers |
| `hooks/` | Turn-logging hooks for each coding-agent CLI so every agent turn lands on the ledger |
| `.githooks/` | `pre-commit`, `commit-msg`, `pre-push`: write law, protected paths, failure vault, approval tokens |
| `.github/workflows/` | Deploy lane, remote ship, conformance check, chain witness, protected-path guard, the mirror exporter |
| `misc-cli/` | `misc`, the terminal agent for the system |
| `scripts/` | `ship.mjs` is the only deploy path; `check-*.mjs` are the deploy and commit gates; `gates.manifest.json` lists which gate runs in which phase; `*.test.mjs` are the subsystem tests the deploy runs; `publish-mirror.mjs` produces this repository |

## Rules, prompts, skills

| Path | Purpose |
|---|---|
| `prompts/` | Agent system prompts as files; the runtime copy is the directory row, synced by migration |
| `.claude/skills/` | The procedures agents load: coding law, write law, writing law, design law, skill law, the work law, the invocation protocol, review and testing procedures |
| `.claude/hooks/`, `.claude/settings.json` | Claude Code hooks: turn log on stop, file-claim guard before edits |
| `.codex/`, `.gemini/`, `.grok/`, `.kimi/`, `.kimi-code/` | Equivalent hook wiring for the other agent CLIs |
| `failure-vault.json` | Every named failure mode as one enforced entry |
| `PROTECTED_FEATURES.md`, `PROTECTED_WIDGETS.md` | Manifests of operator-locked paths |
| `.source-quote-ceiling.json` | The ceiling the source-quote gate enforces |
| `AGENTS.md`, `STATE.md` | Generated pointer files to the work object; they fail the deploy if they carry rules |

## Documentation

| Path | Purpose |
|---|---|
| `README.md` | Front door |
| `SECURITY.md` | Where credentials live, configuration names, gates, reporting |
| `API.md` | Human mirror of `/api/manual` |
| `docs/README.md` | Index of the documentation |
| `docs/ARCHITECTURE.md` | How the system is built, from request to receipt |
| `docs/OIP.md` | The Object Invocation Protocol: identify, explain, invoke, ledger, yield |
| `docs/AUTHORITY.md` | Capability tokens, capability contexts, profiles, devices, proof of possession, denial codes |
| `docs/FLOWS.md` | The flow DSL, the step verbs, and learned flows |
| `docs/WEB_MODELS.md` | Browser models as capabilities, the relay lane, state handles, the sheet bridge |
| `docs/SHEETS.md` | Sheets as objects and views, pins, the environment descriptors and manual |
| `docs/TRAFFIC.md` | The traffic engine: signals, policy, decisions, grants, the SMS funnel, the console |
| `docs/SITE_DESIGN_SCHEMA.md`, `.json` | The design schema the renderer and the design gates enforce |
| `docs/PUBLISHING.md` | How this repository is produced and checked |
| `docs/REPO_MAP.md` | This file |

## Stubs

Modules under `functions/_lib/` and elsewhere whose first line reads `// STUB.` are tenant
integrations of the operating repository that the primitive does not carry. Each exports the same
names as the original and throws with its path when used. `PROJECTION.json` lists them under
`profile.stubbed_modules`.

## What stays in the operating repository

The ledger mirror, guard baselines, session notes, audits, content dumps, one-off scripts, plans,
business-specific skills, the tenant integrations named above, the identity substitution config,
and a signing key. `docs/PUBLISHING.md` section 1 says why each class cannot travel.
