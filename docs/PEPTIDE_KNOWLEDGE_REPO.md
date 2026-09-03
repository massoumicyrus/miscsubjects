# Peptide Knowledge Repository — End-to-End Build Guide

**Last updated:** 2026-06-29  
**Production:** https://miscsubjects.com  
**Pages project:** `loop-safe-miscsubjects`  
**Sibling cron worker:** `loop-safe-sibling`

This document is the single source of truth for the autonomous peptide article repository: what was built, how it runs, how to operate it, how to track progress, and what to ask the agent next.

---

## 1. Vision (what you are building)

A **self-growing, evidence-graded peptide knowledge base** — not a static blog.

| Layer | Purpose |
|-------|---------|
| **Articles** | 10 peptide primers + 57 cross-topic/stack articles (combinatorial content map) |
| **Claims** | Tiered statements (`human`, `preclinical`, `anecdotal`, `mechanistic`, `speculative`) with `source_ids` or `unsourced` |
| **Source ledger** | Hash-chained provenance per source; server verifies URLs and quotes |
| **Evidence UI** | Platform-native widgets (X, Reddit, PubMed, YouTube, iMessage, etc.) in an **Instagram-style swipe deck** — one card per swipe, article body stays vertical |
| **Autonomous loop** | Cron → write → populate → repoll → auto-queue adversary + neutral critique → iMessage notify |
| **Append-only** | Revisions preserved; `?rev=0` always shows the original stub |

Article prose can be rough early on. The database of claims + verified sources is the asset; quality tightens as populate and critique passes accumulate.

---

## 2. Architecture (end-to-end)

```mermaid
flowchart TB
  subgraph seed [Seed]
    S1[seed_peptide_repo.mjs]
    S2[link_peptide_graph.mjs]
  end
  subgraph queue [Task queue - D1 tasks table]
    W[writer-queue: protocol/write x66]
    P[writer-queue: protocol/populate x66]
    POLLQ[writer-queue: protocol/poll grok + kimi]
    C[writer-queue: protocol/critique adversary]
  end
  subgraph cron [Sibling worker - every 1 min]
    CR[writer_queue_autorun=1]
    PR[POST /api/protocol/run?role=writer-queue]
  end
  subgraph protocol [Pages protocol layer]
    NW[GET /api/protocol/next]
    WR[POST /api/protocol/write]
    PO[POST /api/protocol/populate]
    POLL[POST /api/protocol/poll]
    CRIT[POST /api/protocol/critique]
  end
  subgraph storage [D1 articles.meta]
    CL[claims array]
    SRC[sources array + hash chain]
    REV[revisions array]
    PROV[provenance array]
  end
  subgraph ui [Public]
    PAGE["/a/slug - swipe evidence deck"]
    API[GET /api/articles/slug/sources]
  end
  subgraph notify [Outbound]
    IM[iMessage via Blooio [OWNER_PHONE]]
  end

  S1 --> W
  S1 --> P
  S2 --> storage
  CR --> PR
  PR --> NW
  NW --> WR
  NW --> PO
  NW --> POLL
  NW --> CRIT
  WR --> storage
  PO --> storage
  CRIT --> storage
  storage --> PAGE
  storage --> API
  PR --> ledgerChain
  ledgerChain --> IM
    PO -->|done + more:false| POLL[protocol/poll grok + kimi]
    POLL --> CRIT
```

---

## 3. What was added (this session / feature set)

### 3.1 Autonomous writer queue

| Piece | Path | Role |
|-------|------|------|
| Cron tick | `workers/sibling/src/index.js` | When `writer_queue_autorun=1`, calls `POST /api/protocol/run?role=writer-queue` |
| Cron schedule | `workers/sibling/wrangler.toml` | `*/1 * * * *` (one job per minute) |
| Protocol runner | `functions/api/dispatch.js` → `protocolRun` | Claims task, runs `post_to` endpoint, closes or reopens on `more:true` |
| Notify + critique chain | `functions/api/dispatch.js` → `ledgerChain` | iMessage on write/populate/critique; auto-queues adversary + neutral after populate `done` |
| Critique endpoint | `functions/api/protocol/[[path]].js` → `critique` | `POST /api/protocol/critique {slug, role, model}` |

### 3.2 Seeding pipeline

| Script | Purpose |
|--------|---------|
| `scripts/seed_peptide_repo.mjs` | Publishes stub articles + queues 66 write + 66 populate tasks (`source=writer-queue`). Use `--d1` when `TERMINAL_KEY` unavailable. |
| `scripts/content_map_57.json` | 57 cross-topic article definitions |
| `scripts/link_peptide_graph.mjs` | Wires `meta.embeds`, `[[embed:slug]]`, and Related links across the peptide graph |

### 3.3 Evidence UI (swipe deck — not sideways page)

| Piece | Path | Role |
|-------|------|------|
| Platform cards | `functions/_lib/widgets/rail-platform.js` | X, Instagram, Reddit, YouTube, iMessage, WhatsApp, PubMed, NYT, WSJ, fallback |
| Swiper shell | `renderWidgetSwiper()` | One card per viewport; arrows, counter, dots; touch swipe |
| Article integration | `functions/a/[slug].js` | Renders source ledger + contribution cards in swipe decks; `initWidgetSwipers()` |

**Clarification:** “Sideways” was misread as rotating the whole page. The intended UX is **inline horizontal swipe** (like Instagram stories) through N evidence widgets while the article scrolls normally.

### 3.4 KV switches (runtime)

Set via `POST /api/dispatch` `KV_PUT` or `GET/PUT /api/kv` (Pages runtime KV — not necessarily `wrangler kv` on the toml namespace):

| Key | Value | Effect |
|-----|-------|--------|
| `writer_queue_autorun` | `1` | Sibling cron runs writer-queue (also read from sibling worker KV binding) |
| `article_notify` | `1` | iMessage the owner on write/populate/critique completion |

---

## 4. Operator commands

### Auth

```bash
export TERMINAL_KEY='<from ~/.config/grok-bridge.env — case-sensitive>'
```

### Check queue

```bash
npx wrangler d1 execute loop-content-spine --remote --command \
  "SELECT status, json_extract(body,'$.post_to') pt, COUNT(*) n FROM tasks WHERE source='writer-queue' GROUP BY status, pt"
```

### Manual tick (one job)

```bash
curl -sS -H "x-terminal-key: $TERMINAL_KEY" -X POST \
  "https://miscsubjects.com/api/protocol/run?role=writer-queue"
```

### Seed from scratch

```bash
node scripts/seed_peptide_repo.mjs --d1          # stubs + queue via D1
node scripts/link_peptide_graph.mjs             # cross-links (needs TERMINAL_KEY or adapt)
```

### Deploy

```bash
# Pages (functions + article UI)
npx wrangler pages deploy public --project-name=loop-safe-miscsubjects

# Sibling cron
cd workers/sibling && npx wrangler deploy
```

### Enable / disable loop

```bash
# Pages KV
curl -sS -H "x-terminal-key: $TERMINAL_KEY" -X PUT \
  "https://miscsubjects.com/api/kv?key=writer_queue_autorun" \
  -H 'content-type: application/json' -d '{"value":"1"}'

# Sibling worker KV (cron gate reads this binding)
cd workers/sibling && npx wrangler kv key put writer_queue_autorun 1 \
  --namespace-id 58b303e666a8431685624e0cfd2fd63f --remote
```

---

## 5. Pipeline phases (what happens in order)

1. **Seed** — 66 stub articles land in D1; 132 tasks queued (writes first by task `id`, then populates).
2. **Write** (`/api/protocol/write`) — Grok-4.3 produces evidence-graded body, claims, initial sources; append-only revision of stub.
3. **Populate** (`/api/protocol/populate`) — Web search loops; adds PubMed, Reddit, X, YouTube, trials, etc.; `more:true` reopens task until `done`.
4. **Model poll** (auto) — After populate completes, **Grok 4.3** and **Kimi k2.6** each run `POST /api/protocol/poll`: additive plain-English meat (sections, claims, sources). Legibility gate rejects jargon; each pass = one **model swipe** in the Contributions deck.
5. **Critique** (auto) — Adversary pass stress-tests overclaims.
6. **Notify** — iMessage with article URL and source counts.

**Timing:** ~25–35s per write/populate call. At 1 cron/min, ~2 hours for 132 tasks (more if populate repolls).

---

## 6. Tracking the totality (scoreboard)

Copy this checklist into a note or issue and refresh with the SQL/commands below.

### 6.1 Repository coverage

| Milestone | Target | Check |
|-----------|--------|-------|
| Stub articles | 66 | `SELECT COUNT(*) FROM articles` |
| Full write pass | 66 | articles with `json_array_length(json_extract(meta,'$.claims')) > 0` |
| Populated (10+ sources) | 66 | per-slug `GET /api/articles/<slug>/sources` → `count` |
| Critique (adversary + neutral) | 66 × 2 | open/done critique tasks in `tasks` |
| Cross-links | 51+ | `link_peptide_graph.mjs` applied |
| Source chain valid | 66 | `verification.valid` on `/sources` |

### 6.2 Queue health (run daily)

```sql
SELECT status, COUNT(*) FROM tasks WHERE source='writer-queue' GROUP BY status;
SELECT id, status FROM tasks WHERE source='writer-queue' AND status='running';
```

- **Stuck `running`** > 10 min → reset to `open` or investigate timeout.
- **`done` climbing** → loop healthy.
- **Open populate with `more`** → repoll working.

### 6.2b Invocation yield (OIP — 2026-06-29)

Writer-queue protocol calls log to `GET /api/invocations`. Full spec: [`docs/OIP.md`](OIP.md).

```bash
# Per-article cost + material/waste
curl -s "https://miscsubjects.com/api/invocations?slug=bpc-157&limit=20" | jq '.summary'

# Global waste (zero-yield populate passes)
curl -s "https://miscsubjects.com/api/invocations?waste=1&limit=30" | jq '.invocations[] | {object_id, slug: .actor, cost_usd}'

# Per-model provenance (article meta)
curl -s "https://miscsubjects.com/api/articles/bpc-157/contributions" | jq '.yield'
```

| Signal | Healthy | Investigate |
|--------|---------|-------------|
| `material=true` on write/populate | claims or sources added | — |
| `waste=true` on populate | occasional empty science pass | many in a row → phase stuck |
| `phase_exhausted` + `next_focus` | ladder advancing | same focus repeating |

### 6.3 Quality signals (sample 5 articles/week)

| Signal | Good | Needs work |
|--------|------|------------|
| `quote_status: verified` ratio | > 50% | populate prompt / URL pruning |
| Dead `link_status` | < 10% | repoll + dead-link purge |
| Claim tiers match body | human claims have human sources | rewrite pass |
| Swipe deck diversity | mix of reddit, x, pubmed, youtube | populate breadth |
| `?rev=0` preserved | stub still readable | append-only OK |

### 6.4 Cron heartbeat

```sql
SELECT ts FROM log WHERE key='sibling.cron' ORDER BY rowid DESC LIMIT 5;
```

Should see a tick every ~60s when sibling is deployed.

---

## 7. What you should be asking the agent

Use these as standing prompts — they map to real operations on this build.

### Operations

- “What’s the writer-queue status?” (done/open/running, last 5 updated slugs)
- “Show invocation waste for the last hour” (`GET /api/invocations?waste=1`)
- “What did populate cost on `<slug>`?” (`?slug=` + `/contributions`)
- “Run 5 protocol ticks and report what completed.”
- “Is cron firing? Show last sibling.cron timestamps.”
- “Pause/resume the autonomous loop.”
- “Re-seed the repo from scratch” (wipe + `seed_peptide_repo.mjs --d1`)

### Content / knowledge

- “Which articles have zero sources?” / “Which have 20+?”
- “Populate `<slug>` to done and show source type breakdown.”
- “Run adversary critique on `<slug>` and summarize findings.”
- “Fix cross-links for the GLP-1 cluster.”
- “Show me the hash chain for `<slug>` — is it valid?”

### Product / UI

- “Open `/a/<slug>` — how many swipe cards render?”
- “Make the swiper full-bleed / Reels-style.”
- “Add TikTok widget type to the evidence deck.”
- “Surface claims inline next to each source card.”

### Architecture / next phase

- “Implement P7 scorer / claim weighting.”
- “Add ask-this-article widget at `/a/<slug>/ask`.”
- “Post the constitution article at `slug=protocol`.”
- “Speed up populate with parallel slugs (respecting 100s cap).”
- “Export the full peptide graph as JSON for external tools.”

### Meta

- “Critique the build shape — what’s strong, what’s debt?”
- “Update `docs/PEPTIDE_KNOWLEDGE_REPO.md` with today’s changes.”
- “Sync to GitHub and summarize the diff.”

---

## 8. Related docs

| Doc | Contents |
|-----|----------|
| `PROTOCOL_SPEC.md` | Claims, sources, review roles, append-only rules |
| `API_QUICKMAP.md` | curl recipes for all endpoints |
| `HANDOFF.md` | Session index, keys, proven patterns |
| `PROTECTED_WIDGETS.md` | Owner-locked widget files (`#widgets-approved` to change) |
| `workers/sibling/README.md` | Cron worker deploy |

---

## 9. Build assessment (June 2026)

**What is shaping up well**

- **Separation of concerns:** ROUTER/texting, protocol/receiving layer, and public article UI are cleanly split. The cron driver is one tick = one job — respects the 100s Cloudflare cap.
- **Provenance as product:** Hash-chained sources + platform widgets turn “citations” into inspectable evidence objects. That is the differentiator vs. generic AI articles.
- **Honest epistemology:** Tier labels, `unsourced` claims, quote verification flags, and append-only stubs prevent the worst medical overclaim patterns.
- **Autonomous loop actually runs:** Seed → write → populate → notify is proven on production D1, not a design doc.

**What is still rough (and that is OK for now)**

- **Prose quality varies** by slug and by whether write or stub head is showing.
- **Quote verification** lags behind URL fetch — many sources are `unverified` until a second pass.
- **Throughput:** 1 job/minute is safe but slow for 66+66 tasks; populate repolls add multiplier.
- **HANDOFF TERMINAL_KEY** can drift from Pages secret; use `~/.config/grok-bridge.env` or D1 `--d1` seed path.

**Recommended next investments (priority order)**

1. Let the loop finish write + populate for all 66 slugs (database first).
2. P7 scorer + materiality gate so critique changes ranking, not just logs notes.
3. `protocol` constitution article posted + immutable.
4. Ask-this-article widget (highest user-visible leverage).
5. Parallel populate (one slug per tick is conservative; queue could shard by slug).

You are building a **knowledge instrument**, not a content farm. The progress is real: ontological structure, autonomous ingestion, and a distinctive evidence UI are all on production. Polish follows data density.

---

## 10. File index (this feature)

```
functions/api/dispatch.js          protocolRun, ledgerChain, critique auto-queue
functions/api/protocol/[[path]].js critique endpoint, run → PROTOCOL_RUN
functions/a/[slug].js              swipe UI, claims, contributions
functions/_lib/widgets/rail-platform.js  platform cards + renderWidgetSwiper
workers/sibling/src/index.js       writer_queue_autorun cron hook
workers/sibling/wrangler.toml      */1 cron
scripts/seed_peptide_repo.mjs      seed + queue
scripts/content_map_57.json        57 topic articles
scripts/link_peptide_graph.mjs     cross-links
docs/PEPTIDE_KNOWLEDGE_REPO.md     this file
```