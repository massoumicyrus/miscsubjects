# Widget surfaces design — 2026-06-21

Goal: give the owner the widgets he asked for on the Tasks API, a Ledger/widgets API, and a public definitions page, plus stop the home page from auto-populating with articles.

## Decisions

- Use the existing `functions/_lib/vault_widgets.js` card renderer (sideways rail pattern) for task and ledger widgets. Do not mutate the locked article widget renderer (`functions/_lib/widgets.js`, `functions/a/[slug].js`) unless unavoidable.
- Add a widget output format to existing REST APIs rather than forcing everything through `/api/vault/catalog`, because those APIs are the documented surface.
- Create a static `public/widgets.html` definitions page so it does not need a new Functions route or D1 page row.
- Fix the article pipeline so new articles default to `home: false`; existing articles can be shown via admin/PATCH when the owner wants them.

## Changes

### 1. Tasks API widgets

File: `functions/api/tasks/[[path]].js`

- Import `normalizeWidget` and `renderRail` from `functions/_lib/vault_widgets.js`.
- On `GET /api/tasks?format=widgets`, return an HTML page with a sideways rail of task cards.
- On `GET /api/tasks?format=json` (or no format), keep the existing JSON response unchanged.
- Each task card shows: role, status, created_at, hash, and a link to `/admin/tasks` or Google task.

### 2. Ledger widgets API

File: `functions/api/ledger/widgets.js` (new)

- New route `GET /api/ledger/widgets?source=events|cards|claims|all`.
- Reads from `LEDGER.events`, `/api/cards` logic (reused inline), and `/api/claims` logic (reused inline), or delegates to `/api/vault/catalog` if simpler.
- Returns an HTML page with sideways rails per source, using `renderRail`.
- Also support `?format=json` to return the normalized widget descriptors.

### 3. Widget definitions page

File: `public/widgets.html` (new)

- Lists every supported widget type: imessage, whatsapp, wikipedia, site_embed, quote, note, stat, gallery.
- Shows the JSON schema for each, a live rendered example, and a short description.
- Links back to `/app` and `/admin/vault`.

### 4. Home page article default

Files:
- `functions/api/protocol/[[path]].js` — persist `parsed.home` into `draftBody`/`metaFrom` so writer output is honored; default missing/empty to `false`.
- `prompts/PEPTIDE_WRITER_57.md` — change the example/default `"home": true` to `"home": false`.
- `functions/api/articles/[[path]].js` — ensure `PATCH /api/articles/<slug> {home: true|false}` is honored (already supported, verify).
- `public/index.html` — keep the grid, but it will now be empty until articles are explicitly promoted.

## Files touched

- `functions/api/tasks/[[path]].js`
- `functions/api/ledger/widgets.js` (new)
- `public/widgets.html` (new)
- `functions/api/protocol/[[path]].js`
- `prompts/PEPTIDE_WRITER_57.md`
- `API_QUICKMAP.md` (update endpoints)

Protected files (`functions/_lib/widgets.js`, `functions/a/[slug].js`, `functions/admin/ledger/index.js`) are read/imports only, not modified.

## Approval

the owner approved the recommended approach on 2026-06-21. Commit messages touching protected imports should still carry `#vault-approved` or `#widgets-approved` where required by hooks.
