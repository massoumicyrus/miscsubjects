# Ask Topology — From Ledger to iMessage Q&A

**Vision:** The first AI that can answer *"I have herniated discs — what peptide stack might help, and what don't you know?"* by **GET-ing the article topology** (claims, studies, anecdotes) — never inventing doses or blurring evidence tiers.

---

## Layers

| Layer | What | Status |
|-------|------|--------|
| **Harvest** | Grok populate harvests PubMed + Reddit/X/YouTube (good & bad anecdotes) | Live — final round anecdote-focused |
| **Ledger** | Hash-chained sources + tiered claims + `user_entries` | Live |
| **Topology** | `GET /api/articles/<slug>/topology` — one JSON bundle | Live |
| **Suggested prompts** | `GET /api/articles/<slug>/prompts` — from claims & anecdotes | Live |
| **Ask** | `POST /api/protocol/ask {slug, question}` — answers only from topology | Live |
| **iMessage** | `[ARTICLE_ASK]slug\|question[/ARTICLE_ASK]` via ROUTER | Live (directory row) |
| **On-page** | "Ask this article" suggested prompts + copy for iMessage | Live on `/a/<slug>` |
| **Question graph** | `question_nodes` + `evidence_ingest` hash-chained tables | Live |
| **Ingest** | `POST /api/protocol/ingest` + `ARTICLE_INGEST` (paste → ledger) | Live |
| **Graph self-test** | `POST /api/selftest {"action":"graph_run"}` — populate script | Live |
| **Cross-graph ask** | Condition keywords → multi-slug topology | Live |

See **[QUESTION_GRAPH.md](./QUESTION_GRAPH.md)** for full how-to, test commands, and GitHub sync.

---

## End-to-end flow

```
Populate (Grok + web)
  → scientific sources (pubmed, trials)
  → anecdote round (reddit, x, youtube — good & bad)
  → claims with tiers
  → user_entries (reader submissions)

User texts: "bpc-157|herniated disc — what stack?"
  → ROUTER [ARTICLE_ASK]
  → GET topology (internal)
  → Grok answers from JSON only
  → needs_user_info: ["MRI severity", "medications", ...]
  → gaps: ["no human RCT for disc + BPC"]
  → [REPLY] plain English, not medical advice
```

---

## Honest answer shape

```json
{
  "answer": "From the catalogue: BPC-157 has preclinical tendon/disc-adjacent data...",
  "confidence": "low",
  "cited_claim_ids": ["c2", "c4"],
  "cited_source_ids": ["s1", "s7"],
  "needs_user_info": ["Which level herniation?", "Current NSAID use?"],
  "gaps": ["No human herniated-disc RCT in ledger"],
  "related_slugs": ["tb-500", "wolverine-stack-glp1"],
  "disclaimer": "not medical advice"
}
```

---

## Next level (roadmap)

1. ~~**Cross-article graph ask**~~ — live (`graph-topology`, `resolveAskSlugs`).
2. ~~**ROUTER auto-prompts**~~ — live (`suggested_followups` on ask + protoAsk reply).
3. ~~**User anecdote → source ledger**~~ — live (`POST /api/user-entry` promotes on submit).
4. ~~**Weight visible on claims**~~ — live on `/a/<slug>`.
5. ~~**Question graph + self-test populate**~~ — live; see [QUESTION_GRAPH.md](./QUESTION_GRAPH.md).
6. **Constitution** — bind all writers/poll/ask passes to dual-ledger rules.
7. **ROUTER proactive prompts** — suggest 3 questions before user asks (not only after ask).

---

## Operator commands

```bash
curl https://miscsubjects.com/api/articles/bpc-157/topology
curl https://miscsubjects.com/api/articles/bpc-157/prompts

curl -X POST https://miscsubjects.com/api/protocol/ask \
  -H "x-terminal-key: $TERMINAL_KEY" \
  -H "content-type: application/json" \
  -d '{"slug":"bpc-157","question":"What bad outcomes are reported on Reddit?"}'
```

Text the build: `bpc-157|What does the ledger say for herniated discs?` → ROUTER uses `ARTICLE_ASK`.