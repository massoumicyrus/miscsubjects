# Product vision — ask/audit anything, on a hash-chained ledger

> Captured from 2026-06-21 session. This is the north-star; build it in small, verifiable pieces.

## Core premise

The site is an **API, a CLI, an MCP surface, and a graph**. That makes it the perfect place for people to:

- Ask any question.
- Say anything about their own experience.
- Name a site, claim, company, or product to audit.

Beyond a small set of high-level safety rules, every submission triggers a **model audit**, is **hash-chained**, and lands on a **ledger that cannot change itself** — only be re-audited when asked again.

## Key interaction loops

### 1. Ask / audit anything

A reader can type:

> "Is this peptide site a scam?"  
> "I just started this drug — could it harm me?"  
> "Are dragons real?"

The system:

- Separates **factual questions** from **considerations / advice requests**.
- Searches the ledger and, if needed, the public web.
- Runs one-shot prompts across multiple LLMs (Anthropic, OpenAI, Google, Grok, Kimi, Meta, Perplexity).
- Returns a synthesized, adversarially checked answer.
- Posts the full reasoning + result to the ledger as an `llm_agent` widget.
- If the user provided a channel (iMessage / WhatsApp / email), sends the answer back there.

Bad-faith or unanswerable prompts ("are dragons real") get discarded or marked as `out_of_scope`; they do not enter the evidence chain.

### 2. User experience entries

A reader can send an experience via iMessage/WhatsApp-style widgets:

> "I took BPC-157 and my gut healed in 3 weeks."  
> "I took this peptide and it hurt me."  
> "I am a 45-year-old male considering TB-500 for a shoulder tear."

Each entry:

- Is hashed and written to the ledger.
- Is tagged with subject, condition, demographic, affinity.
- Can trigger an LLM audit ("based on known data, here is the risk/benefit logic for this person").
- Can be picked up by the user as a suggested iMessage/WhatsApp conversation with an LLM.

### 3. Site / company / claim audits

A reader names a target:

> "Audit peptidescience.com"  
> "Audit the claim 'BPC-157 heals torn ligaments'"

The system:

- Gathers public signals: site content, reviews, Reddit/X/Instagram/TikTok mentions, regulatory warnings, source ledger.
- Scores trust dimensions: transparency, evidence quality, red flags, consistency.
- Produces a **trust score** + a **hash-chained audit report**.
- Sends the result to the requester and posts it publicly on the graph.

Unlike LinkedIn/Twitter, truthful negative audits cannot be suppressed by the target — they live on an append-only ledger.

### 4. LLM via messaging apps

LLM widgets are not just site-side chrome. A suggested question can be handed off:

- Rendered as an iMessage/WhatsApp bubble.
- User taps "Ask Claude" / "Ask GPT" / "Ask Grok".
- The message is sent from the user's own iMessage/WhatsApp to the build's number.
- The build routes to the chosen model, audits the answer, and replies back in the same thread.
- The full exchange is mirrored to the ledger.

This makes the site feel like **native messaging with provably grounded AI**.

### 5. App-like ledger browsing

The ledger cards should be swipeable like a **birthday-year picker wheel**:

- Vertical or horizontal card wheel.
- Snap-to-card physics.
- Filter wheels: subject · disease · demographic · affinity · model · evidence tier.
- Each card opens the full audit/article/thread.
- PWA-ready so it behaves like a beta app.

## Tracking & categorization

- **Pixel tracker** + **Google Analytics** for traffic and conversion events.
- **Ontology extraction** on every entry:
  - Disease / condition
  - Interest / goal
  - Demography (age, sex, self-reported)
  - Affinity (peptides, nootropics, pain, longevity, etc.)
- These become filter facets on the graph and personalization signals for audits.

## Cloudflare architecture

- Keep the split:
  - **Pages Functions** — public site, article rendering, admin UIs, REST API.
  - **Sibling Worker** — cron, durable objects, queues, browser rendering, heavy harvest jobs.
- Move harvest loops, LLM dispatch bursts, and messaging webhooks to the sibling Worker to stay inside the 100s Pages cap.
- Store ledger bulk / large audit payloads in R2 (`loop-safe-storage`) and index in D1.

## Build order suggestion

1. Fix admin task visibility (terminal-key casing).
2. iMessage + WhatsApp widget renderer + user entry endpoint.
3. `/api/ask` endpoint: ask anything, multi-model audit, ledger post.
4. Site/claim audit endpoint + trust score.
5. Messaging handoff: widget → iMessage/WhatsApp → model → reply.
6. Ontology tagging + graph filters.
7. Swipeable ledger wheel / PWA app shell.
8. Pixel + GA instrumentation.
9. Cloudflare architecture review + move heavy work to sibling Worker.

## Relation to the design schema

This vision is encoded in `docs/SITE_DESIGN_SCHEMA.json` v2 under:

- `widget_schema` — native widgets and `llm_agent` / `user_entry` / `audit_trail`.
- `interaction_model` — user→ledger, LLM threads, harvest loop, subject graph.
- `component_registry.user_input_widget` and `llm_agent_widget`.
