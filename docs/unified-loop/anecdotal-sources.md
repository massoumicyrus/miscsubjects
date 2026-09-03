# Anecdotal sources — MCP tool-definition token cost

Subject: every tool an MCP server exposes ships its JSON definition into the model prompt on every message, whether used or not. At scale this dominates the token bill. Cards are human artefacts only (not vendor docs). Verified via live fetch; invented handles/numbers/permalinks are forbidden.

---

## Card 1

- platform: x
- handle: @dani_avila7
- quote: "tool definitions alone can eat 50K-100K tokens before you even start working."
- date: 2025-11-25
- permalink: https://x.com/dani_avila7/status/1993134510364389555
- engagement: 686 likes, 83 reposts, 27 replies, 62,014 views
- position: COST-IS-REAL

## Card 2

- platform: x
- handle: @aakashgupta
- quote: "Users with 7 MCP servers were burning 67k tokens before typing a single character."
- date: 2026-01-15
- permalink: https://x.com/aakashgupta/status/2011664388424454262
- engagement: 599 likes, 56 reposts, 31 replies, 109,674 views
- position: COST-IS-REAL

## Card 3

- platform: x
- handle: @dzhng
- quote: "Instead of injecting dozens of tool definitions upfront and burning through context windows, a code-execution agent loads nothing until it needs something"
- date: 2026-03-05
- permalink: https://x.com/dzhng/status/2029518820872945889
- engagement: 298 likes, 39 reposts, 35 replies, 83,047 views (X Article body)
- position: COST-IS-REAL

## Card 4

- platform: x
- handle: @milvusio
- quote: "Load 50 tool definitions into context and the agent struggles to pick the right one. Your context window fills up before the real work starts."
- date: 2026-04-22
- permalink: https://x.com/milvusio/status/2047014068888703391
- engagement: 0 likes, 0 reposts, 1 reply, 240 views
- position: COST-IS-REAL

## Card 5

- platform: reddit
- handle: u/whathatabout (r/mcp)
- quote: "theres now a max of about 40 mcp tools you can have at once otherwise it floods your context window."
- date: 2025-03-15
- permalink: https://www.reddit.com/r/mcp/comments/1jbiqex/max_mcp_tool_limits_hit_in_cursor/
- engagement: 1 upvotes, 0 comments
- position: COST-IS-REAL

## Card 6

- platform: reddit
- handle: u/JunXiangLin (r/mcp)
- quote: "when there are too many tools, the prompt becomes bloated, which can lead to instability in the LLM and cause it to generate hallucinations."
- date: 2025-03-24
- permalink: https://www.reddit.com/r/mcp/comments/1jimv3u/whatll_hapen_if_there_has_a_lots_of_tool_in_mcp/
- engagement: 1 upvotes, 1 comment
- position: COST-IS-REAL

## Card 7

- platform: reddit
- handle: u/Bubbly_Layer_6711 (r/ClaudeAI)
- quote: "tool specifications themselves take up token-space and if you have too many configured at once performance in all of them will degrade."
- date: 2025-05-01
- permalink: https://www.reddit.com/r/ClaudeAI/comments/1ka3jao/why_is_claude_is_so_good_at_tool_calling/mpz8b2g/
- engagement: 1 upvotes
- position: COST-IS-REAL

## Card 8

- platform: github
- handle: anomalyco/opencode#35376 (jijoyo)
- quote: "this results in ~40,000-70,000 tokens of tool definitions loaded upfront — even if the user only needs 2-3 tools."
- date: 2026-07-05
- permalink: https://github.com/anomalyco/opencode/issues/35376
- engagement: 2 comments, 1 reaction
- position: COST-IS-REAL

## Card 9

- platform: github
- handle: github/copilot-cli#4189 (SqlBenjamin)
- quote: "the reported figure was ~20× the real deferred cost (98.8k reported vs ~5k actual)."
- date: 2026-07-20
- permalink: https://github.com/github/copilot-cli/issues/4189
- engagement: 1 comment, 0 reactions
- position: COST-IS-OVERSTATED

## Card 10

- platform: hn
- handle: 827a (item 48331540, story "MCP is dead?")
- quote: "The idea that MCP tool definitions take up a certain number of tokens is laughable. That's an implementation detail of the agent harness."
- date: 2026-05-30
- permalink: https://news.ycombinator.com/item?id=48331540
- engagement: 0 replies on comment; parent story 400 points, 410 comments
- position: COST-IS-OVERSTATED

---

## Additional verified OVERSTATED artefacts (not seated — only one HN slot)

These were verified live but excluded so the platform split stays 4/3/2/1. They are the third (and fourth) sceptics the search actually found; they are not invented.

### Extra S1 — HN BeetleB

- platform: hn
- handle: BeetleB (item 47719249)
- quote: "Completely false. I was dealing with this problem recently (a few tools, consuming too many tokens on each request)."
- date: 2026-04-10
- permalink: https://news.ycombinator.com/item?id=47719249
- engagement: 0 replies; parent story "I still prefer MCP over skills" 460 points, 375 comments
- position: COST-IS-OVERSTATED
- note: argues progressive disclosure / dynamic tool updates solve it; first quiet tool "~60 tokens".

### Extra S2 — HN kanodiaayush

- platform: hn
- handle: kanodiaayush (item 47160970)
- quote: "If we use prompt caching - isn't a largish MCP tools section just like a fixed token penalty in return for higher speed at runtime"
- date: 2026-02-26
- permalink: https://news.ycombinator.com/item?id=47160970
- engagement: points not exposed by Algolia/Firebase for this comment
- position: COST-IS-OVERSTATED

### Extra REAL (GitHub, displaced by SqlBenjamin seat)

- platform: github
- handle: NousResearch/hermes-agent#67273 (Helder-Lira)
- quote: "tool JSON schemas account for 83.1% of every API request's token budget"
- date: 2026-07-19
- permalink: https://github.com/NousResearch/hermes-agent/issues/67273
- engagement: 3 comments, 0 reactions
- position: COST-IS-REAL

---

## Sceptic shortfall on X / Reddit

Only **two** COST-IS-OVERSTATED cards fit the required platform split (GitHub SqlBenjamin + HN 827a). A third OVERSTATED human artefact was verified on HN (BeetleB, kanodiaayush) but the split allows only one HN seat. No verified OVERSTATED card was confirmed on X or Reddit after the searches below — X results were dominated by people measuring the cost as real; Reddit hits were complaints or architecture questions, not sceptics.

Searches run for sceptics (X/Reddit):

- Brave: `MCP tool definitions "implementation detail" OR "doesn't matter" OR overblown OR overstated tokens`
- Brave: `MCP "tool definitions" (caching OR "prompt cache" OR "not a problem" OR "already solved") site:x.com`
- Brave: `MCP tools "prompt cache" OR caching tokens site:x.com`
- Pullpush Reddit comment: `MCP "not a big deal" tokens`, `MCP tokens "doesn't matter"`, `MCP "overblown" OR "overstated" context`, `MCP "prompt caching" tools tokens` (r/ClaudeAI), `"tool search" MCP tokens solved OR fixed` (r/ClaudeAI), `"60 tokens" MCP tool`
- HN Algolia (found the extra sceptics): `MCP "prompt caching" tools`, `"tool definitions" "cached" MCP`, `MCP tokens "implementation detail"`

---

CARDS: 10 verified
BY_PLATFORM: x=4 reddit=3 github=2 hn=1
SCEPTICS: 2 (in the seated ten); 2 additional verified OVERSTATED on HN listed above but not seated
FETCH_METHOD_THAT_WORKED_FOR_REDDIT: api.pullpush.io (reddit.com, old.reddit.com, and r.jina.ai all blocked — 403/401/network security)
UNVERIFIED: deleted — empty X text fields for @dzhng main tweet body (used verified X Article block text from same status via api.fxtwitter.com instead); HN comment point scores (Algolia/Firebase return null for comment scores — reported reply counts and parent-story scores only); r/LocalLLaMA and r/LLMDevs specific token-bloat posts matching the subject (searched, no on-topic verified hit kept); @kamathematic / @ShrekOverflow article tweet (verified fetch but off-subject for tool-definition cost); BROWSER_USE X scrape (credits exhausted); nitter/xcancel/DDG/Bing status URL extraction (antibot or zero status links)
