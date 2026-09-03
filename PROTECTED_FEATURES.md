# PROTECTED FEATURES - OWNER LOCKED VAULT

This file is the human-readable manifest for feature locks beyond the article widget renderer.

## Locked feature families

- Article widgets: `PROTECTED_WIDGETS.md`
- Vault catalogue API: `functions/api/vault/[[path]].js`
- Vault admin page: `functions/admin/vault.js`
- GUARDIAN OWNER SWITCH (owner order 2026-08-30): the drift guardian (`scripts/guard.mjs`
  --check) obeys KV `guardian_master` — '0'/'off'/'false' means OFF: no snapshot diffing, no
  quarantine, no model judge, no texts, and the pre-commit staged-drift block sees zero drift.
  The owner set it OFF on 2026-08-30; no agent re-arms it — only the owner flips it, at the
  top of `/admin/vault` or `PUT /api/kv?key=guardian_master`. Maintenance modes (--baseline,
  --adopt, --heal, --list) keep working while OFF. The lock manifests and the commit-msg
  backtick block are separate mechanisms and remain in force regardless of this switch.
- Vault widget renderer: `functions/_lib/vault_widgets.js`
- Vault session-scan cron: `.github/workflows/vault-session-scan.yml`
- Local mutation hooks: `.githooks/pre-commit`, `.githooks/commit-msg`
- QUADSYNC (owner order 2026-07-03, for all of posterity): `functions/_lib/ledger_sync.js`,
  `scripts/quadsync.sh`, the launchd job `com.the owner.miscsubjects.quadsync`, the `sync:*` KV
  stamps, and the `ledger-mirror/` path on GitHub. The four corners — Cloudflare (source of
  record) ↔ GitHub ↔ local Mac ↔ Google Drive — sync in unison; every ledger event mirrors
  to GitHub; the governor flags any stale corner URGENT. No agent may disable, throttle, or
  narrow the sync without the owner authorizing that exact change in the same instruction window.
  quadsync NEVER auto-commits owner-locked files — it reports them dirty to the ledger instead.
- TAP & GO / TOKEN DROP (owner order 2026-07-12, after butchery): `buildTapGoDropMarkdown` in
  `functions/_lib/unified_handoff.js`, mint path `formatOwnerTokenDrop` in
  `functions/_lib/webhook_intake.js`, goldens `.protected/golden/tap_go_drop_*.md`, checker
  `scripts/check-tap-go-drop-golden.mjs`. No agent may rewrite the drop shape without the
  literal owner phrase `approve drop rewrite` in the same instruction window, then update
  goldens + pass the checker in the same turn. Lead must stay the public OIP docs URL
  followed by `# OIP delegated capability record` (owner drop law 2026-07-14, recorded in
  AGENTS.md: neutral third-person capability record, never model-directed imperatives).
  **EXACT VERSION VAULT (owner order 2026-07-15):** the canonical token-drop generator is
  `buildTapGoDropMarkdown` in `functions/_lib/unified_handoff.js`, SHA-256
  `67b03de8b8fde69e09f58859dffcef0675feba92c46366df0e9685dcf9bc669d`.
  `scripts/check-tap-go-drop-golden.mjs` hashes that exact function boundary and must fail if it changes. A request to
  restore this version means byte-for-byte restoration only: no synthesis, merge, cleanup,
  modernization, safety commentary, examples, Stripe/payment/shell commentary, or any other
  model-authored wording. The generated act/read goldens are the vaulted output fixtures.
  Changing any byte requires the owner's literal `approve drop rewrite` in the same instruction.
  **2026-07-16: owner gave `approve drop rewrite` (P0a, GUM directive) — canonical source is now
  the owner-profile-anonymized version, SHA-256 `67b03de8b8fde69e09f58859dffcef0675feba92c46366df0e9685dcf9bc669d`.**
- SELFTEST MASTER LOCK (owner order 2026-07-14, after Codex re-armed group selftest): KV
  `selftest_master` (default OFF). While OFF: no e2e run, no graph_run, no sibling
  `/wf/selftest/trigger`, no `selftest_autorun=1`. Re-enable only via
  `POST /api/selftest {action:"set_master",value:"1",confirm:"ENABLE SELFTEST"}` from the
  admin tab UI (or owner with that exact phrase). Agents cannot `KV_PUT selftest_master|1`
  or `KV_PUT selftest_autorun|1`. Autorun ON requires master ON + confirm
  `ENABLE SELFTEST AUTORUN`. Kill forces master OFF. Surfaces: `functions/api/selftest.js`,
  `functions/admin/selftest.js`, `functions/_lib/fn_runners.js` kvPut, `functions/api/kv.js`,
  `workers/sibling/src/index.js` trigger.
- BACKEND NAVIGATION IS FULLY VISIBLE (owner order 2026-07-21, after repeated `More +`
  regressions): `functions/admin/_layout.js` renders every `PRIMARY_TABS` destination as a
  direct visible anchor on every admin page. Desktop and mobile wrap the same complete list.
  No `More`, overflow dropdown, collapsed subset, hidden secondary container, or runtime
  width-based omission exists. `scripts/check-backend-navigation.mjs` is the deterministic
  release gate and remains protected with the renderer.
- SHEETS WORKBOOK IS THE DEFAULT ADMIN GRID (owner order 2026-08-29, WT-0092): a bare GET of
  `/admin/directory` and `/admin/ledger` renders the Sheets workbook
  (`functions/admin/sheets/index.js`) — a Google-Sheets-style grid with cell editing, column
  drag/resize, filters, sorts, A1 addressing, a bottom tab strip where each tab is one sheet,
  and a model-run panel. The two entries below (directory filters/audit drop, ledger
  continuity/contrast) remain binding IN FULL at `?view=classic`, which serves the unchanged
  classic pages; every JSON mode (`?data=…`, `?cards=…`, `?keys=…`, `?services=…`, `?turns=…`)
  is untouched — any query parameter outside the workbook's own view-state set (third-round
  amendment below) routes past the workbook. User-created sheets live in
  `user_sheets`/`sheet_cells`/`sheet_run_configs` behind `/api/sheets` (contract public at
  that URL); model runs go through the invoke lane only, with receipts on the ledger.
  Removing the workbook default, the classic views, or the `/api/sheets` values/run lanes is
  a regression.
  Amended by owner order 2026-08-29 (second round): on workbook surfaces the admin
  destinations render as sheet tabs in the sticky footer strip (every destination, one
  visible click each; the shell's own tab row is hidden there and unchanged everywhere
  else); the Directory sheet is the FULL corpus in the classic grouped order with `used`
  and `size` columns and kind tabs (Everything/Agents/Tools/Flows/Content/Pages/Files/Other)
  right of Help; corpus rows are read-only projections whose cells open the object at its
  own address; Turns and Forum are their own read-only sheets; the Ledger sheet scrolls
  infinitely via the `before` cursor on `?data=1`; double-clicking a column header cycles
  its sort. Losing any of these is a regression.
  Amended by owner order 2026-08-30 (third round, WT-0097): every view state is a link —
  the workbook's view-state params (`kind`, `sort`, `cell`, `id`, `field`, `f.<field>`,
  `v.<field>`) pass through to the workbook on `/admin/directory` and `/admin/ledger`
  (every JSON mode still routes past it); kind-tab taps, filter applies, sorts and tab
  switches pushState so back/forward walk the taps and every refinement is shareable; the
  formula bar names the active cell's object id (`<key> · <field>`) linked to the object's
  own address, and `?id=<key>&field=<col>` reopens that exact cell; grids paint instantly
  from a client-side cache (Cache API) with a background refresh, so the loading overlay
  only appears on a cold first visit; the Sheet ⇄ Classic toggle sits top right on BOTH
  surfaces — the classic directory links back to the sheet view (kind-mapped) and keeps its
  own state in the URL (`view=classic` plus `tab`, `q`, `cat`, `sort`, `use`, `page`, `id`),
  with clicked rows naming their object id. The public `/api/sheets` contract documents the
  `url_state` lanes. Losing any of these is a regression.
- DIRECTORY FILTERS + WHOLE-BUILD AUDIT DROP (owner order 2026-07-21):
  `functions/admin/directory/index.js`, `functions/admin/content-map.js`,
  `functions/api/opos.js`, `functions/opos/index.js`, `functions/build-audit/index.js`,
  `.github/workflows/vault-protection.yml`, and `scripts/check-directory-audit-drop.mjs`.
  Content rows retain real creation dates; primary-section changes clear stale secondary
  filters; article subjects do not become thousands of categories. Grouped-by-kind is the default
  order (owner order 2026-07-22, after a flat-by-date default read as scrambled): capabilities
  first, corpus last — Agents, Tools (HTTP/FN), Flows, Pages, Meta, Content, Files, each under its
  own labeled section header, each capped at 200 rows so a huge section cannot freeze the page.
  Newest-added remains a selectable sort and displays date plus time. A capability's kind is its
  `type` (agent/fn/http/flow); the topical `category` tag never renames a capability's kind — no
  agent, tool, or flow is labeled "content" (that word is reserved for the article corpus kind;
  content-operating capabilities are tagged `content-ops`). Search covers name, target, category,
  type, and href. Newest/oldest parse UTC, offset, ISO-`T`, and SQLite-space timestamps as times
  rather than comparing raw strings; mixed timestamp formats cannot invert chronological order.
  Any active sort/category/usage filter flattens to one list rendered in 200-row pages so thousands
  of files or articles cannot freeze the filter.
  Previous/next controls retain the current type, category, usage, search, and sort state.
  The audit copy control
  mints a graph-research capability and copies a bounded factual access record. It contains
  no audit task, model role, requested verdict, response order, or answer schema.
  The floating admin `Owner Tap & Go` in `functions/_lib/unified_handoff.js` contains a separate
  `Audit this build` action that copies the graph access record itself. `opos-formal-audit` is
  the root article in the existing append-only voxel graph. `/api/build-audit` is its four-column
  projection; `/api/build-landscape` is the external-system table and research queue. Field and
  build findings land as fetched, hash-chained source voxels plus source-citing claim voxels;
  opposition lands against exact claim hashes in discourse. Tasks only queue work. No parallel
  audit-submission store exists. The existing model token DROPs remain model-specific and unchanged.
  `scripts/check-directory-audit-drop.mjs` bars prompt-shaped audit language and requires the graph,
  landscape, source, claim, discourse, and ledger surfaces. The floating pill is bottom-right,
  its panel opens upward inside the viewport, and the admin header's top-right controls remain clear.
  Read and edit token Tap & Go are model-specific in this floating panel: explicit ChatGPT,
  Claude, Grok, Gemini, and Kimi controls pass `model=MODEL` into the existing model-profile slots.
  Generic read/edit token buttons are absent. The build-audit DROP remains generic.
  The GitHub vault workflow evaluates the mutation commits across a pushed range and does not
  attempt an unqualified revert of a merge commit.
  The copied audit object passes the zero-context arrival test: it names one active assignment,
  begins with the graph and next queued target, leaves the verdict open, and defines completion as
  source-citing graph writes plus public receipts. A fresh model asking what to do is a release failure.
  A missing controlled outcome benchmark cannot terminate the assignment. It leaves outcome superiority unknown while material identification, inventory, and evidenced structural comparison continue.
  An incomplete comparison population returns a bounded answer from populated cells and marks the rest not evaluated; it never returns a blanket "not knowable" refusal.
  Audit text uses literal nouns and verbs. Decorative metaphors, prestige labels, category piles, and undefined technical vocabulary are release failures.
  Every audit mint reserves one Normandy assignment against the current article graph: one target,
  one shared comparison axis, one empty slot, one graph snapshot hash, and one capability fingerprint.
  The shared article constitution lists the additive slots. Exact and near-duplicate claims and
  duplicate-only source batches cannot complete the assignment. Completion records the new source,
  claim, contradiction, limit, question, rule, failure, cost, capability-effect, or value-effect ids
  in `normandy_assignments`; the truth remains in the existing article/source/claim/discourse graph.
  “Global rank is unknown,” “private systems are invisible,” and undefined maturity labels are
  standing boundaries, not reusable answers.
  Software comparison axes come from one shared registry. The article constitution, build record, comparison table, and queued work cannot carry separate axis lists.
  The universal article constitution governs peptide, build, and software-comparison content.
  Public discourse stays open; draft/write/ingest/source/claim/atomize/contribute/repair mutations
  use owner auth or the existing explicit `VOXEL_EDIT` capability. Domain profiles extend evidence
  classes and axes without creating another store, ledger, writing system, or edit protocol.
- LEDGER + CODEX CONTINUITY (owner order 2026-07-21, after a deployed Codex lens disappeared):
  `functions/admin/ledger/index.js`, `functions/_lib/agent_turn_log.js`,
  `functions/_lib/ledger_event_view.js`, `functions/api/agent_log.js`,
  `hooks/codex-turn-log.js`, `hooks/_lib/agent-turn-common.js`, `.codex/hooks.json`, and
  `scripts/check-ledger-continuity.mjs`. Codex turns use canonical source `codex-cli`, land in
  both `agent_turns` and `events`, remain filterable through a pinned Codex Ledger chip, retain
  their original timestamps, dedupe by turn/content, and retry after a failed ingest instead of
  marking an unsent turn complete. The hook includes historical backfill.
  Ledger view cards, service filters, and format controls render selected state as black with
  white text. `scripts/check-ledger-contrast.mjs` blocks unreadable black-on-black active controls.
- SOURCE CONVERGENCE + DEPLOYMENT LINEAGE (owner order 2026-07-21, after an unmerged feature
  branch was deployed and a later main deploy erased its features): `scripts/ship.mjs`,
  `scripts/quadsync.sh`, `scripts/check-protected-features.mjs`, `.githooks/pre-commit`,
  `.githooks/pre-push`, and `.github/workflows/vault-protection.yml`. Production deploys run only
  when HEAD exactly equals fetched `origin/main`, runtime files are committed, and every protected
  feature contract passes. QUADSYNC observes and mirrors; it does not rebase, autostash, commit,
  push, or otherwise mutate an active coding-agent branch.

## Rule

No AI agent edits locked feature files unless the owner explicitly authorizes it in the same instruction window.

Approved commits must include one of:

- `#widgets-approved` for article widget renderer changes
- `#vault-approved` for vault/catalog/protection changes

The vault's purpose is to preserve macro ideas, micro prompt rules, feature state, task state, event state, and model-session evidence as REST-readable JSON plus sideways visual cards.

The session-scan cron is intentionally bounded: read recent `cc_turns`, flag protected paths/destructive commands, write one ledger event, and perform zero code writes.

## Deployment law

- Always run `npx wrangler pages deploy ...` from the project root: `/Users/owner/miscsubjects-pages`.
- Never deploy from `~` or any other directory. Wrangler will look for `functions/` in the current directory and skip the real Functions bundle.
- Before deploying, unset any stale `CLOUDFLARE_API_TOKEN`:
  ```bash
  unset CLOUDFLARE_API_TOKEN
  npx wrangler login
  npx wrangler pages deploy public --project-name loop-safe-miscsubjects --branch main --commit-dirty=true
  ```
- If using a token, ensure it has Cloudflare Pages:Edit scope for project `loop-safe-miscsubjects`.
- This rule is locked in the vault; any agent instructing a deploy must include the `cd` step and directory check.
