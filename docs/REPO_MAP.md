# Repository map

Every directory of the primitive, what it is for, and how it relates to the operating repository it
is generated from. Counts are live in `PROJECTION.json`.

## Code that runs

| Path | Purpose |
|---|---|
| `functions/` | Cloudflare Pages Functions: the whole HTTP surface. `api/` is the machine surface, `admin/` the operator surfaces, `a/` the public article and law pages, `_lib/` the shared modules, `.well-known/` agent and skill discovery documents |
| `functions/api/dispatch.js` | The one door: loads a directory row and runs it, writes the ledger |
| `functions/_lib/fn_runners.js` | Every built-in `fn` capability by name, dispatched by the directory |
| `functions/_lib/work_object.js` | The task object: create, lease, submit, grade, fail, audit chain |
| `functions/_lib/public_secret_guard.js` | Redaction at ledger ingest: provider key shapes, bound secrets, operator identity |
| `workers/` | Sibling Workers: `sibling` (cron, durable objects, queue consumer, browser rendering, inbound mail), `directory-do`, `sheet-do`, `storage`, `mcp-server`, `oip-peer`, `robots-fix` |
| `migrations/` | Numbered D1 migrations for schema and directory rows. Migrations that seeded published content are omitted, so the sequence has gaps |
| `schema.sql` | Base schema |
| `wrangler.toml` | Pages project bindings, production and preview |
| `public/` | Static assets: design system CSS, brand marks, figures, fonts, `robots.txt`, `_routes.json` |
| `apps-script/` | Google Apps Script runner for `apps_script` rows |
| `bridge/` | The Mac bridge: local HTTP server the edge calls over a tunnel for shell, files, UI control and coding agents; launchd definitions; installers |
| `hooks/` | Turn-logging hooks for each coding-agent CLI so every agent turn lands on the ledger |
| `.githooks/` | `pre-commit`, `commit-msg`, `pre-push`: write law, protected paths, failure vault, approval tokens |
| `.github/workflows/` | Deploy lane, remote ship, conformance check, chain witness, protected-path guard, the mirror exporter |
| `misc-cli/` | `misc`, the terminal agent for the system |
| `scripts/` | `ship.mjs` is the only deploy path; `check-*.mjs` are the deploy and commit gates; `gates.manifest.json` lists which gate runs in which phase; `publish-mirror.mjs` produces this repository |

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
| `docs/ARCHITECTURE.md` | How the system is built, from request to receipt |
| `docs/OIP.md` | The Object Invocation Protocol: identify, explain, invoke, ledger, yield |
| `docs/SITE_DESIGN_SCHEMA.md`, `.json` | The design schema the renderer and the design gates enforce |
| `docs/PUBLISHING.md` | How this repository is produced and checked |
| `docs/REPO_MAP.md` | This file |

## Stubs

Modules under `functions/_lib/` and elsewhere whose first line reads `// STUB.` are tenant
integrations of the operating repository that the primitive does not carry. Each exports the same
names as the original and throws with its path when used. `PROJECTION.json` lists them under
`profile.stubbed_modules`.

## What stays in the operating repository

The ledger mirror, guard baselines, session notes, handoffs, audits, content dumps, one-off scripts,
plans, business-specific skills, the tenant integrations named above, the identity substitution
config, and a signing key. `docs/PUBLISHING.md` section 1 says why each class cannot travel.
