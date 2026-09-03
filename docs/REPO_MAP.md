# Repository map

Every top-level entry of the operating repository, what it is for, and whether it travels to the
public projection (see [PUBLISHING.md](PUBLISHING.md)). Counts are approximate as of 2026-09-02;
`git ls-files <dir> | wc -l` is the live number.

## Code that runs

| Path | Purpose | In projection |
|---|---|---|
| `functions/` | Cloudflare Pages Functions: the whole HTTP surface. `api/` is the machine surface (about 180 route files), `admin/` the operator surfaces (about 50), `a/` the public article and law pages, `_lib/` about 195 shared modules, `.well-known/` agent and skill discovery documents | yes |
| `functions/_lib/fn_runners.js` | Every built-in `fn` capability by name, dispatched by the directory | yes |
| `functions/_lib/work_object.js` | The task object: create, lease, submit, grade, fail, audit chain | yes |
| `functions/_lib/public_secret_guard.js` | Redaction at ledger ingest: provider key shapes, bound secrets, owner identity | yes |
| `workers/` | Eight sibling Workers: `sibling` (cron, durable objects, queue consumer, browser rendering, inbound mail), `directory-do`, `sheet-do`, `storage`, `meta-bridge`, `mcp-server`, `oip-peer`, `robots-fix` | yes |
| `migrations/` | About 370 numbered D1 migrations. The newest is the source of truth for directory rows, docs and schema | yes |
| `schema.sql` | Base schema | yes |
| `wrangler.toml` | Pages project bindings, production and preview | yes |
| `public/` | Static assets: design system CSS, brand marks, figures, fonts, `robots.txt`, `_routes.json`, a few static reports | yes, minus the licensed URW font |
| `apps-script/` | Google Apps Script code for the spreadsheet runner (`apps_script` rows) | yes, minus the project binding file |
| `bridge/` | The Mac bridge: local HTTP server the edge calls over a tunnel for shell, files, UI control and coding agents; launchd service definitions; installers | yes |
| `hooks/` | Turn-logging hooks for each coding-agent CLI (Claude Code, Codex, Gemini, Kimi, Grok) so every agent turn lands on the ledger | yes |
| `.githooks/` | `pre-commit`, `commit-msg`, `pre-push`: write law, protected paths, failure vault, approval tokens | yes |
| `.github/workflows/` | Deploy lane, remote ship, conformance check, chain witness, vault protection (dispatch-only), the mirror exporter | yes |
| `misc-cli/` | `misc`, the terminal agent for the build | yes, minus its session notes |
| `scripts/` | About 200 operational scripts. `ship.mjs` is the only deploy path; `check-*.mjs` are the fifty deploy and commit gates; `gates.manifest.json` lists which gate runs in which phase; `publish-mirror.mjs` produces the projection | yes, minus the private mirror config |

## Rules, prompts, skills

| Path | Purpose | In projection |
|---|---|---|
| `prompts/` | Agent system prompts as files; the runtime copy is the directory row, synced by migration | yes, minus `.backup` versions |
| `.claude/skills/`, `.agents/skills/` | About 130 skills: the coding law, write law, writing law, design law, outreach law, loop law, and the operating procedures agents load. Two trees so each agent CLI finds them | yes |
| `.claude/hooks/`, `.claude/settings.json` | Claude Code hooks: turn log on stop, file-claim guard before edits | yes |
| `.codex/`, `.gemini/`, `.grok/`, `.kimi/`, `.kimi-code/` | Equivalent hook wiring for the other agent CLIs | yes |
| `failure-vault.json` | Every owner-named failure mode as one enforced entry | yes |
| `PROTECTED_FEATURES.md`, `PROTECTED_WIDGETS.md` | Manifests of owner-locked paths | yes |
| `.source-quote-ceiling.json` | The ceiling the source-quote gate enforces | yes |
| `AGENTS.md`, `STATE.md` | Generated pointer files to the work object; they fail the deploy if they carry rules | yes |

## Documentation

| Path | Purpose | In projection |
|---|---|---|
| `README.md` | Front door | yes |
| `SECURITY.md` | Where credentials live, configuration names, gates, reporting | yes |
| `API.md` | Human mirror of `/api/manual` | yes |
| `docs/` | `ARCHITECTURE.md`, `BUILD_SPEC.md`, `OIP.md`, `PRODUCT_VISION.md`, `CAPABILITY_MAP.md`, design schema, wrangler inventory, the unified-loop measurements, the superpowers plans and specs, this map, `PUBLISHING.md` | yes, minus captured vendor docs |

## Operating state that stays private

| Path | What it is | Why it stays |
|---|---|---|
| `ledger-mirror/` | Daily mirrors of the event ledger, thousands of files, most of the tracked bytes | Operational data with personal information and pre-scrub credential material |
| `.protected/` | Guard baselines, quarantine and pending snapshots of locked files | Byte copies at every version |
| `.witness/` | The chain-witness signing key and its log | A private key |
| `ACCESS.md` | Where every credential lives and which CLIs are logged in on the operator's machine | The map of the vault |
| `HANDOFF_*.md`, `AUDIT_*.md`, `BUILD_STATE.md`, `SESSION_HANDOFF.md`, `TODO.md`, `WORKING_PATTERNS.md`, `OPEN_MY_SCREEN.md`, `KERNEL_SPEC.md`, `MCP_*.md`, `OIP_*.md`, `PROTOCOL_*.md`, `TEST_MESSAGES.md` | Session handoffs and audits written for one operator | They name people, machines and accounts; the work object replaced them |
| `REST_RECIPES.md` | Copy-paste request objects | Written to carry a real key; `/api/manual` is the live equivalent |
| `owner-addresses.json` | The owner-named destination list the email gates check | Personal addresses |
| `grok-console/`, `operator-console/` | Earlier Apps Script consoles | Hardcoded provider keys from that era |
| `research/`, `improved-content/`, `article_rewrites/`, `rewrite_articles/`, `oip-articles-v2..v4/`, `articles/`, `content-source/`, `grain_source_docs/`, `source-material/`, `normandy/`, `tasks/`, `img/`, `agents/`, `gas/`, `wordpress/` | Content dumps, drafts, payloads, source material and one-off task notes | The site is the projection of content; some of it is third-party material |
| Root `*.py`, `*.json`, `*.md`, `*.txt`, `*.sql`, `*.mjs` not named above | Hundreds of one-off scratch scripts and payload files left by past sessions | Scratch |
| `archive/`, `outputs/`, `.tmp/`, `.worktrees/`, `.wrangler/`, `node_modules/` | Ignored by git already | Not tracked |
