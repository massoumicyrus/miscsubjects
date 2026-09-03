# Inline Recursive Content Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every ordinary live article a directly usable block editor for the authenticated owner and scoped models, covering every use case stated in the original Fable session.

**Architecture:** Keep the existing canonical `content_blocks` and `article_block_refs` graph, but make the article—not the admin page—the primary editor. Add an atomic selection-isolation verb, block verdict rows, and an explicit owner Edit mode that maps rendered prose to canonical blocks, lets the owner select or click prose, replaces prose in place while editing, and exposes comments, history, reuse, move, split, retire, and verdicts beside the block. Bump the article edge-cache version so every existing article receives the interface immediately.

**Tech Stack:** Cloudflare Pages Functions, D1, server-injected HTML/CSS/vanilla JavaScript, Node/Vitest, live authenticated browser testing.

## Global Constraints

- The owner remains on `/a/<slug>` for every operation; `/admin/articles/<slug>` is never the primary workflow.
- Read mode remains normal article reading. Edit mode is a clearly labeled owner control, not a hidden glyph.
- Selecting visible prose and choosing `Make block` isolates that exact prose as its own stable corpus block.
- Clicking a block in Edit mode opens the editor in the block's place and saves without navigating away.
- Every comment and verdict binds to the exact block version and content hash it evaluated.
- Shared blocks update every live reference; detach remains the explicit copy-on-write boundary.
- Existing words are never silently rewritten by migration. Semantic rewriting or deduplication requires an explicit reviewed action.
- Models and humans use the same operations; authority comes from the owner session or scoped `BLOCK_*` token.
- No block score hides, deletes, or auto-rewrites prose. Verdicts are inspectable signals until an explicit edit or retire action.

---

### Task 1: Acceptance coverage for the literal owner workflow

**Files:**
- Modify: `functions/_lib/recursive_content.test.mjs`
- Create: `scripts/check-inline-recursive-content.mjs`

**Interfaces:**
- Consumes: `voxelDivLayerWidget()`, recursive-content operation helpers.
- Produces: a deploy blocker that refuses a hidden/admin-only implementation.

- [ ] Write failing assertions requiring `Edit page`, `Make block`, `Save inline edit`, `Comment`, `History`, `Reuse`, `Move`, `Split`, `Retire`, and block verdict controls in the injected owner interface.
- [ ] Write a failing assertion that the article cache key version is the inline-editor release version.
- [ ] Run the focused tests and confirm the missing visible workflow is the failure.
- [ ] Add the checker to the protected/deploy gate path already used by the project.

### Task 2: Atomic selection-to-block operation

**Files:**
- Modify: `functions/_lib/recursive_content.js`
- Modify: `functions/api/blocks/[[path]].js`
- Modify: `functions/_lib/recursive_content.test.mjs`

**Interfaces:**
- Consumes: `{slug, block_id, expected_hash, selected_text, occurrence?}`.
- Produces: `isolateBlockSelection(...) -> {ok, selected_block_id, blocks, human_url}` and `POST /api/blocks/isolate-selection`.

- [ ] Write failing tests for selecting the middle, prefix, suffix, whole block, ambiguous text, stale hash, and byte-exact article recomposition.
- [ ] Run the tests and confirm the operation is absent.
- [ ] Implement one D1 batch that preserves the original block identity on the first surviving segment, mints stable IDs for additional segments, inserts append-only versions/events, rewrites reference order, and returns the selected block ID.
- [ ] Expose it through the same owner/scoped-token authorization as every other block verb.
- [ ] Run the focused tests to green.

### Task 3: Version-bound block verdicts and visible threads

**Files:**
- Create: `migrations/0351_content_block_verdicts.sql`
- Modify: `schema.sql`
- Modify: `functions/_lib/recursive_content.js`
- Modify: `functions/api/blocks/[[path]].js`
- Modify: `functions/_lib/recursive_content.test.mjs`

**Interfaces:**
- Consumes: `{block_id, verdict: positive|negative|edit|delete, note?}`.
- Produces: append-only verdict rows bound to `block_version` and `content_hash`; history response includes comments and verdicts.

- [ ] Write failing tests proving verdicts bind to the evaluated version/hash and do not mutate content.
- [ ] Add the D1 table and indexes.
- [ ] Implement `verdictOnBlock`, `blockVerdicts`, API read/write routes, and aggregate counts in article/block graphs.
- [ ] Run migration tests and the focused suite to green.

### Task 4: Replace hidden glyphs with a first-class article Edit mode

**Files:**
- Modify: `functions/_lib/voxel_graph.js`
- Modify: `functions/_lib/recursive_content.test.mjs`

**Interfaces:**
- Consumes: article graph, block comments/history/verdicts, every block mutation route.
- Produces: a visible owner bar and contextual block editor entirely on `/a/<slug>`.

- [ ] Write failing static interface tests for the explicit toolbar and all action labels.
- [ ] Add `Edit page` beside the article reading surface; entering it outlines addressable prose and explains “select text to make a block; click a block to edit.”
- [ ] Replace the hidden `◈` affordance with a visible contextual `Edit block` control in Edit mode.
- [ ] On block click, replace the rendered block in place with an editor and `Save inline edit` / `Cancel`; show reference blast radius before save.
- [ ] On text selection, show the selection excerpt and `Make block`; post `isolate-selection`; reload and focus the new stable block.
- [ ] Render comment form, version history, verdict controls, move, split, retire, detach, corpus search, and reuse in one contextual tray beside the selected block.
- [ ] Improve Markdown-to-rendered matching for headings, tables, lists, quotes, and rich inline markup; report unmatched blocks as a visible error in Edit mode.
- [ ] Keep the controls absent in guest/read mode while leaving the permanent explanation visible.
- [ ] Run static tests to green.

### Task 5: Immediate corpus-wide delivery

**Files:**
- Modify: `functions/_middleware.js`
- Modify: `functions/_lib/recursive_content.test.mjs`

**Interfaces:**
- Consumes: the article edge cache.
- Produces: a new cache-key version that cannot serve pre-editor article HTML.

- [ ] Write a failing test against the old cache version.
- [ ] Bump `ARTICLE_EDGE_CACHE_VERSION` to the inline-editor release.
- [ ] Verify a bare, no-query request to `/a/oip-governance-ontology` contains the new surface after deployment.

### Task 6: Live owner proof on the reported article

**Files:**
- No production file changes.

**Interfaces:**
- Consumes: authenticated owner browser on `/a/oip-governance-ontology`.
- Produces: visible proof tabs and ledger receipts.

- [ ] Open the exact reported article in the owner's active browser without a query string.
- [ ] Enter Edit mode, select a harmless exact phrase, click `Make block`, and verify the selected block receives a stable ID.
- [ ] Edit that block inline, save, verify the visible prose changes, then restore the exact original through the same inline editor.
- [ ] Add a version-bound comment and each verdict type; verify history shows their original version/hash.
- [ ] Exercise split, move, reuse, detach, and retire on a temporary proof article so the reported article ends byte-identical.
- [ ] Leave the ordinary article proof tab open with Edit mode visible.

### Task 7: Close every original-session use case

**Files:**
- No production file changes unless a failed row exposes a defect.

**Interfaces:**
- Consumes: the original 4,491-word session and live browser/API evidence.
- Produces: a request ledger with one row per capability: front-end operation, stable identity, edit, move, split, retire, comment/protest, version history, positive/negative/edit/delete verdict, cross-article reuse, live propagation, scoped-model operation, new-article wrapping, and targeted model reads.

- [ ] Mark each row `proved`, `failed`, or `outstanding`; never infer one row from another.
- [ ] Repair every failed row and repeat its browser/API proof.
- [ ] Submit WF-0003 only after the ordinary article browser workflow and every request-ledger row pass.
