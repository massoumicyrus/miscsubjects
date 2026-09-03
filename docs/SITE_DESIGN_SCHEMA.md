# Site + Article Design Schema v2

This is the interim single source of truth for redesigning `miscsubjects.com`. It unifies the public home page, article pages, metadata, hashtags, filtering, native brand widgets, user ledger entries, and LLM agent surfaces.

## What just happened

- **Old `/content` items archived.** All 374 `content_items` rows are now `status='archived'`. `https://miscsubjects.com/content` returns 0 peptides / 0 articles.
- **Home page improved.** Article cards now show posted date, register, and tags (live).
- **`/api/articles` enriched.** It now returns `created_at`, `posted_at`, `tags`, `hashtags`, `register`, `hero`, `model`, `status`.

## JSON schema

See [`SITE_DESIGN_SCHEMA.json`](./SITE_DESIGN_SCHEMA.json) for the machine-readable spec covering:

- `design_tokens` — **monochrome black & white palette** (keep current sizes/spacing/geometry, only color changes).
- `article_schema` — full article metadata shape including `hashtags`.
- `widget_schema` — native brand widgets:
  - `instagram`, `x`, `tiktok`, `whatsapp`, `imessage`
  - `llm_agent` (Anthropic, OpenAI, Google, Grok, Kimi, Meta, Perplexity logos)
  - `user_entry` (reader adds their own experience/question to the ledger)
  - `audit_trail` (hash chain of every model pass)
- `claim_schema` + `source_schema` — evidence-tier atoms and hash-chained source ledger.
- `homepage_schema` — feed source, default sort/filter, card shape, facets.
- `component_registry` — shell, article card, article page, native widgets, source/claim cards, tag pills, user input, LLM agent widget.
- `interaction_model` — user → ledger, LLM agent threads, background harvest loops, subject graph navigation.
- `routing` — current route map and retirement status.

## The product vision

The site becomes an **auditable reasoning surface**:

1. **Native widgets.** Every embedded post (Instagram, X, TikTok, WhatsApp, iMessage) looks like the real app but shares a common monochrome chrome. Brand identity is limited to the avatar/logo.
2. **User entries.** Readers can add their own experience or question via a widget that looks like iMessage/WhatsApp. The entry is hash-chained and filterable by subject/tag.
3. **LLM agents.** Each article hosts a graph of model passes (writer, reviewer, adversary, endorser). Readers can click a suggested follow-up or type a custom question to a specific model; the response becomes a new ledger entry rendered as an `llm_agent` widget.
4. **Harvest loop.** Background agents fetch public comments about a subject, normalize them into source ledger entries, and surface summary widgets.
5. **Subject graph.** Sideways navigation by subject, tag, hashtag, model, evidence tier, and source type.
6. **No lying.** Every LLM prompt/response is hashed, linked, and verifiable via `/api/articles/{slug}/provenance` and `/sources`.

## Recommended build order

1. **Monochrome theme** — apply black & white tokens to `public/index.html` and `functions/a/[slug].js` without changing layout/sizing.
2. **Native widget renderer** — extend `functions/a/[slug].js` to render all `widget_schema` types.
3. **User entry endpoint** — `POST /api/event_log_ingest` accepts `{subject, context, text, author, source_url}` and writes a hash-chained ledger row.
4. **LLM follow-up endpoint** — `POST /api/articles/{slug}/ask` routes a reader question to a chosen model, records provenance, and returns a widget payload.
5. **Harvest worker** — sibling Worker cron or on-demand dispatch fetches comments for a subject and writes source entries.
6. **Subject graph UI** — filters + related links on article and home pages.

## Cleanup still open

- `pages` table still has 17 old stubs (`a1`, `a2`, `b3`, `esh-a1..a9`, `reta`, `topology`). Decide which to keep/delete.
