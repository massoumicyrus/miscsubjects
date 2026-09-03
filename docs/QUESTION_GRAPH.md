# Question Graph — How It Works, How to Test, How to Sync

**Repo:** https://github.com/[OWNER_HANDLE]/miscsubjects-pages  
**Live:** https://miscsubjects.com

Questions and pasted evidence are **first-class graph nodes** — not ephemeral chat. Each ask creates a hash-chained `question_node`; each ingest creates an `evidence_ingest` node linked to sources and claims on the article page.

---

## Mental model

```
Person asks (iMessage / API / self-test)
  → question_node (gaps, needs_user_info, cited claims/sources)
  → answer from topology only

Person pastes evidence (Grok / GPT / Gemini / study)
  → parsed → source ledger + optional claims on /a/<slug>
  → evidence_ingest node linked to question_node

Next person asks same thing
  → topology is bigger (prior questions + ingested evidence)
```

Three storage layers:

| Layer | Table / field | What it holds |
|-------|----------------|---------------|
| **Article ledger** | `articles.meta` — `sources[]`, `claims[]` | Tier-weighted evidence the page renders |
| **Question graph** | `question_nodes` | Every ask as a node (question, answer preview, gaps) |
| **Evidence graph** | `evidence_ingest` | Every paste as a node (summary, linked source ids) |

Edges (in `GET .../question-graph`): question → evidence, question → cited claim/source, follow-up questions.

---

## User-facing paths

### Ask (creates question node)

**iMessage / WhatsApp** — text the build ([BUILD_PHONE]):

```
bpc-157|I have herniated discs — what does your catalogue say, and what don't you know?
```

ROUTER calls `ARTICLE_ASK` → `protoAsk` → `POST /api/protocol/ask`.

Reply includes `[Question node: qn_...]` and, if there are gaps:

```
Have evidence? Text: ingest bpc-157|q:qn_...|paste from Grok/GPT/Gemini or a study
```

**Multi-article (condition + stack)** — keywords like `herniated disc` auto-expand to stack slugs (`recovery-stack-herniated-disc`, `bpc-157`, `tb-500`, etc.).

### Ingest (writes to ledger + graph)

```
ingest bpc-157|q:qn_abc123|Grok said: [paste full response]
```

Or without a prior question:

```
ingest bpc-157|[paste study or model output]
```

ROUTER → `ARTICLE_INGEST` → `POST /api/protocol/ingest` (model parse, or `deterministic: true` for self-test).

### Inspect

```bash
curl https://miscsubjects.com/api/articles/bpc-157/topology          # includes question_graph
curl https://miscsubjects.com/api/articles/bpc-157/question-graph    # nodes + edges
curl https://miscsubjects.com/api/articles/bpc-157/graph-topology?question=herniated%20disc%20stack
curl https://miscsubjects.com/api/articles/bpc-157/prompts
```

### Copy bundle (paste into Grok / GPT / Gemini)

One shot: **body + claims + source ledger + provenance + question graph + LLM manifest**.

```bash
# Markdown paste (recommended)
curl https://miscsubjects.com/api/articles/bpc-157/bundle?format=markdown

# JSON
curl https://miscsubjects.com/api/articles/bpc-157/bundle

# Global LLM manifest (how to read/write any article)
curl https://miscsubjects.com/api/articles/llm-manifest
```

On-page: `/a/bpc-157` — **Copy for LLM** button (top of article), claim weights, suggested prompts.

---

## API reference (operator)

```bash
export TERMINAL_KEY=...   # ~/.config/grok-bridge.env

# Ask — creates question_node
curl -X POST https://miscsubjects.com/api/protocol/ask \
  -H "x-terminal-key: $TERMINAL_KEY" -H "content-type: application/json" \
  -d '{"slug":"bpc-157","question":"What good and bad outcomes are logged?"}'

# Ingest — model parse
curl -X POST https://miscsubjects.com/api/protocol/ingest \
  -H "x-terminal-key: $TERMINAL_KEY" -H "content-type: application/json" \
  -d '{"slug":"bpc-157","evidence":"Paste from another model here...","question_node_id":"qn_..."}'

# Ingest — deterministic (self-test / no gateway)
curl -X POST https://miscsubjects.com/api/protocol/ingest \
  -H "x-terminal-key: $TERMINAL_KEY" -H "content-type: application/json" \
  -d '{
    "slug":"bpc-157",
    "evidence":"SELFTEST anecdote...",
    "deterministic":true,
    "sources":[{"type":"reddit","title":"Report","quote":"...","summary":"..."}],
    "claims":[{"text":"...","tier":"anecdotal","why_material":"..."}]
  }'

# Graph populate self-test (6-step script)
curl -X POST https://miscsubjects.com/api/selftest \
  -H "x-terminal-key: $TERMINAL_KEY" -H "content-type: application/json" \
  -d '{"action":"graph_run","notify":false}'

# Graph step status
curl "https://miscsubjects.com/api/selftest?graph=1"
```

---

## Self-test graph populate

**Script:** `functions/_lib/graph_selftest.js` — `GRAPH_POPULATE_SCRIPT`

| Step | What it tests |
|------|----------------|
| g1 `ask` | Question node + gaps on `bpc-157` |
| g2 `ingest` | Evidence → ledger + `evidence_ingest` (linked to question) |
| g3 `ask` | Topology includes ingested SELFTEST material |
| g4 `ask_only` | **Negative control** — no new evidence rows |
| g5 `fn_ask` | `ARTICLE_ASK` directory fn |
| g6 `fn_ingest` | `ARTICLE_INGEST` directory fn |

**Run standalone:**

```bash
curl -X POST https://miscsubjects.com/api/selftest \
  -H "x-terminal-key: $TERMINAL_KEY" \
  -H "content-type: application/json" \
  -d '{"action":"graph_run","notify":true}'
```

`notify: true` posts step labels to the audit group (ButterCup asks, Pepper reports PASS/FAIL).

**After full e2e self-test** (optional):

```json
{"action":"run", "offset": 0, "limit": 1, "fresh_run": true, "run_graph": true, "graph_notify": true}
```

**Sibling workflow** (`workers/sibling`) — after paced e2e completes, automatically runs `graph_run`.

**Admin UI:** https://miscsubjects.com/admin/selftest → **Run graph populate**.

**Tier 9 e2e** (`directory_tests`) — ROUTER conversational questions for ask/ingest/how-to inspect (normal self-test loop).

---

## Deploy & sync to GitHub

Code is in `miscsubjects-pages`. Relevant commits:

- `053f7ff` — ask topology, prompts, ARTICLE_ASK
- `566ce69` — cross-graph ask, follow-up prompts, user-entry promotion
- `a8e99bb` — question_nodes + evidence_ingest + ARTICLE_INGEST
- `5b0348d` — graph self-test loop

### Push local changes

```bash
cd miscsubjects-pages
git add docs/QUESTION_GRAPH.md docs/ASK_TOPOLOGY.md
git commit -m "docs: question graph + self-test populate guide"
git push origin main
```

### Deploy Pages (functions + site)

```bash
npx wrangler pages deploy public --project-name=loop-safe-miscsubjects
```

### Apply D1 migrations (remote)

```bash
npx wrangler d1 execute loop-content-spine --remote --file=migrations/0186_question_graph.sql
npx wrangler d1 execute loop-content-spine --remote --file=migrations/0187_graph_selftest.sql
npx wrangler d1 execute loop-content-spine --remote --file=migrations/0188_article_ask_pipe_args.sql
```

(Also `0170_article_ask_directory.sql`, `0171_article_ask_graph.sql` if not yet applied on a fresh DB.)

### Verify after deploy

```bash
# Graph self-test should score 100% (6/6)
curl -X POST https://miscsubjects.com/api/selftest \
  -H "x-terminal-key: $TERMINAL_KEY" -H "content-type: application/json" \
  -d '{"action":"graph_run","notify":false}'

# Question graph should show nodes after a run
curl https://miscsubjects.com/api/articles/bpc-157/question-graph
```

---

## Key files

| File | Role |
|------|------|
| `functions/_lib/question_graph.js` | Create/load question + evidence nodes |
| `functions/_lib/article_topology.js` | Topology + `resolveAskSlugs` + graph merge |
| `functions/_lib/graph_selftest.js` | 6-step populate script |
| `functions/api/protocol/[[path]].js` | `ask`, `ingest` handlers |
| `functions/api/selftest.js` | `action: graph_run` |
| `functions/api/dispatch.js` | `protoAsk`, `protoIngest` |
| `migrations/0186_question_graph.sql` | Tables + ARTICLE_INGEST row |
| `migrations/0187_graph_selftest.sql` | Graph suite + tier 9 questions |
| `migrations/0188_article_ask_pipe_args.sql` | `$2+` pipe fix for ask/ingest |

---

## Known limits

- `POST /api/protocol/ask` and model-based `ingest` need a working Grok gateway key; self-test uses **deterministic ingest** and **fallback question nodes** when the gateway is down.
- Repeat ingest of identical quote+url is deduped by the source ledger — self-test appends a unique `run-<id>` tag per run.
- Not medical advice; topology answers cite tiers and record gaps explicitly.