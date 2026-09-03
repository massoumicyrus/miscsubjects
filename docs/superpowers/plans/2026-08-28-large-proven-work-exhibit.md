# Large Proven Work Exhibit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/a/the-run-that-found-you` as one browser-visible door into a task-bound run of 1,000 candidate organizations, 100 verified public contacts, 100 individualized receipted sends, four cold-model audits, and cryptographic verification.

**Architecture:** New execution-case tables bind candidates, decisions, reviewed email bodies, sends, and audits directly to WT-0090 and invocation receipts. Existing discovery, enrichment, send-proof, work-evidence, checkpoint, and article machinery remain the authoritative lanes; the change adds the missing task/run linkage and a public privacy-preserving projection. The article embeds the projection and links machine-readable payload, verification, comments, corrections, and reproduction doors.

**Tech Stack:** Cloudflare Pages Functions, D1, Node/Vitest, existing OIP dispatch/invoke lanes, Cloudflare Email Sending, article renderer.

## Global Constraints

- Every acceptance count is scoped to `task_id='WT-0090'`; ambient leads or sends never count.
- Every returned candidate receives one stored inclusion or exclusion decision and reason.
- Contact addresses come only from the organization’s own public site; public projections redact addresses and expose commitments.
- Every first-contact body is individually grounded, independently reviewed, exactly owner-reviewed, and sent through the existing lawful send gate.
- Every accepted send carries a public `snd_…` proof and links back to its candidate and decision.
- Cold models need no terminal key, repository access, prior endpoint knowledge, or owner explanation.

---

### Task 1: Task-bound execution-case schema and contracts

**Files:**
- Create: `migrations/0361_large_execution_case.sql`
- Create: `functions/_lib/execution_case.js`
- Create: `functions/_lib/execution_case.test.mjs`

**Interfaces:**
- Produces candidate, send, and audit row contracts keyed by task ID and immutable receipt IDs.

- [ ] Write failing tests for inclusion/exclusion completeness, public contact redaction, per-send binding, and aggregate counts.
- [ ] Run the focused test and confirm the missing module failure.
- [ ] Implement the schema helpers and public projection until the focused test passes.

### Task 2: Discovery and enrichment linkage

**Files:**
- Modify: `functions/_lib/promo_loop.js`
- Modify: `functions/_lib/fn_runners.js`
- Test: `functions/_lib/execution_case.test.mjs`

**Interfaces:**
- Consumes an optional WT-0090 task ID on discovery and enrichment calls.
- Produces one decision row for every returned candidate, exact query text and source URL, plus contact verification state.

- [ ] Add failing tests showing excluded candidates and task linkage are lost today.
- [ ] Extend the existing runners without creating a parallel scraper.
- [ ] Run focused and existing lead tests to green.

### Task 3: Browser and machine projection

**Files:**
- Create: `functions/api/execution-case/[[path]].js`
- Create: `functions/execution-case/[[path]].js`
- Modify: `functions/_lib/widgets/proven_work_widget.js`
- Test: `functions/_lib/execution_case.test.mjs`

**Interfaces:**
- Produces `/execution-case/WT-0090`, `/api/execution-case/WT-0090`, payload resolution, verification, comments, and reproduction links.

- [ ] Write failing projection tests for navigation, redaction, counts, decisions, sends, audits, and verifier doors.
- [ ] Implement the public HTML and JSON views using the shared projection.
- [ ] Run tests and local render checks to green.

### Task 4: Large real run

**Files:**
- Live rows only through the guarded discovery, enrichment, drafting, review, and send lanes.

**Interfaces:**
- Produces at least 1,000 candidate rows, 100 verified contacts, 100 reviewed bodies, and 100 provider-accepted `snd_…` rows bound to WT-0090.

- [ ] Run diverse public-source discovery queries through receipted invocation calls until 1,000 decisions exist.
- [ ] Resolve and enrich official sites until 100 contacts are verified.
- [ ] Generate one evidence-grounded body per selected contact and run four-family KEEP/CHANGE/DELETE review.
- [ ] Publish the exact owner review surface and record its approval receipt.
- [ ] Send only approved bodies through the existing send gate and verify all 100 provider receipts.

### Task 5: Signed proof, article, cold-model test, and acceptance

**Files:**
- Update through guarded article API: `the-run-that-found-you`

**Interfaces:**
- Produces the public article and the WT-0090 evidence bundle.

- [ ] Seal a signed checkpoint covering the task rows and verify its inclusion proof.
- [ ] Execute four model-family cold audits using the article URL as their only context and store their full verdicts and receipts.
- [ ] Patch the article with measured counts, objections, repairs, and every browser/machine door.
- [ ] Deploy through `scripts/ship.mjs` and verify in the active browser and by public API.
- [ ] Submit the required evidence to WT-0090 and require `accepted:true` from infrastructure.

