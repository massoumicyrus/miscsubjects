# Recursive Content implementation plan

**Goal:** Ship Recursive Content as the live article substrate: stable corpus-wide blocks, reusable references, version-bound discussion, direct owner controls, scoped model verbs, lossless wrapping, and permanent public explanation.

**Architecture:** Keep `articles.body` as the rendered materialization for compatibility, while `content_blocks` and `article_block_refs` become the canonical graph for block-native mutations. Each block has an immutable ID and append-only versions. Each article reference carries order and its exact separator, so wrapping and recomposition are byte-preserving. A single block service owns edit, split, move, detach, reuse, retire, comment, history, and article materialization. The article write route resynchronizes the graph after whole-body writes. The article page receives one directly visible progressive control layer and a permanent human/machine explanation.

**Stack:** Cloudflare Pages Functions, D1, browser JavaScript, Node test runner, Wrangler, existing admin-cookie/share-token authority.

## 1. Contract tests

- [ ] Add pure contract tests for byte-exact atomization/recomposition.
- [ ] Prove deterministic import IDs stay stable when content is later edited.
- [ ] Prove explicit reuse preserves one block ID across article references.
- [ ] Prove split, move, detach, retire, and comments change only their declared scope.
- [ ] Prove comments retain the targeted version and content hash.
- [ ] Prove the widget contains direct controls, corpus search, reuse, history, and permanent explanation.
- [ ] Run the new tests and observe the expected failures before implementation.

## 2. Canonical storage and service

- [ ] Add `content_blocks`, `content_block_versions`, `article_block_refs`, `content_block_comments`, and `content_block_events` with indexes and referential guards.
- [ ] Implement deterministic IDs, content hashes, byte-exact separators, and transaction-safe graph reads.
- [ ] Implement idempotent article wrapping from existing `meta.divs`, falling back to byte-exact body atomization.
- [ ] Implement edit with CAS and propagation to every referencing article.
- [ ] Implement move as an article-reference operation, not a global block mutation.
- [ ] Implement split with an explicit split point and lossless replacement of one reference with two.
- [ ] Implement detach as copy-on-write for one article reference.
- [ ] Implement retire without deleting bytes or history; refuse retirement while live references remain unless the declared reference is removed.
- [ ] Implement corpus search and explicit insert-by-reference; never deduplicate by similarity.
- [ ] Implement block-version-bound comments and history reads.
- [ ] Append an event receipt for every mutation.

## 3. One authenticated API for humans and models

- [ ] Add public reads for article blocks, individual blocks, search, history, comments, and procedure.
- [ ] Add owner-cookie and signed-token mutations through the same handlers.
- [ ] Permit wrapping and reference insertion with owner/act authority.
- [ ] Require owner or explicit `BLOCK_*` scope for content edits, split, move, detach, and retire.
- [ ] Derive actor identity from authority; keep caller-supplied model names as display metadata only.
- [ ] Return current state on stale hash/order conflicts.
- [ ] Return clickable human and machine addresses plus mutation receipts.

## 4. Article write convergence

- [ ] Resynchronize block references after every new article or deliberate whole-body replacement.
- [ ] Preserve explicit shared references for block-native edits by routing them only through the block service.
- [ ] Keep legacy `meta.divs` in sync as a compatibility projection where present.
- [ ] Purge article edge snapshots after materialization changes.
- [ ] Add a corpus backfill runner that calls the guarded API rather than writing D1 directly.

## 5. Directly usable article controls

- [ ] Replace fuzzy article-local DIV identity with the global block/ref payload.
- [ ] Put a stable block ID and direct Comment, Edit, Split, Move, Detach, Retire, History, and Reuse controls on the selected visible block.
- [ ] Detect the logged-in owner session automatically; never require the owner to paste a token in a signed-in browser.
- [ ] Give scoped models the same verbs and request shapes on the machine side.
- [ ] Add corpus block search and insert-reference picker inside the visible article tool.
- [ ] Keep reading uncluttered: one restrained control rail, expanded only when a block is selected.
- [ ] Render mutation results and errors next to the block that caused them.

## 6. Permanent self-explanation

- [ ] Add a visible `How recursive content works` block to every article page.
- [ ] State plainly that IDs are stable, references are shared, edits propagate, comments bind to versions, detach creates a private copy, and retirement never erases history.
- [ ] Link the human article, machine procedure, current article graph, and global search.
- [ ] Ensure the explanation remains useful with JavaScript disabled.
- [ ] Publish `/a/recursive-content` at 700+ words with concrete workflows, authority boundaries, failure cases, and exact public routes.

## 7. Deployment and corpus conversion

- [ ] Run focused tests, existing article/API tests, navigation checks, writing/design/SEO gates, and the complete pre-deploy gate set.
- [ ] Apply the D1 migration through the guarded migration path.
- [ ] Deploy through `scripts/ship.mjs`.
- [ ] Backfill every published article through the authenticated block API and record totals/failures.
- [ ] Publish the explanatory article through the canonical article API with its writing-law lease.
- [ ] Re-run the backfill for the new article.

## 8. Live proof and acceptance

- [ ] In a signed-in browser, select a real block and exercise comment, edit, history, move, split, detach, search, insert-reference, and retire/recovery safely.
- [ ] With a bounded signed token, exercise the same API on the proof article and confirm a stale write is refused.
- [ ] Prove one shared edit appears in two article references, then leave both pages in their intended final state.
- [ ] Prove a comment still names the version/hash it criticized after an edit.
- [ ] Prove an existing article wraps and recomposes byte-for-byte.
- [ ] Verify `/a/recursive-content`, its machine graph, the footer explanation, mobile layout, and no-JavaScript explanation.
- [ ] Submit all required evidence to WT-0082 and stop only when infrastructure returns `accepted:true`.
