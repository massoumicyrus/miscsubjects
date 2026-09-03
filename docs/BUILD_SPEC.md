# BUILD_SPEC — how miscsubjects works, the self-improvement loop, and the rules
**For any LLM (Grok, Kimi, GPT, Claude) the owner brings in to work on this build.**
Pair this with `AGENTS.md` (the binding laws) and `REST_RECIPES.md` (copy-paste REST objects).
Status tags: **[WORKS]** = verified live. **[PARTIAL]** = exists, incomplete. **[GAP]** = not built yet.

---

## 0. What this build is, in one paragraph
the owner texts a number. The text travels: **iMessage → Blooio → `POST /blooio` → `/api/turn` → ROUTER**. ROUTER is an LLM (`grok-4.3`, web search on) whose system prompt is a row in the build's directory. It reads the message, picks a **tool by name from the directory** (or a REST GET/POST over a group), runs it, and replies. Everything the build can do is a **directory row**, invoked by `POST /api/dispatch {key, body}`. Every step is written to the **ledger** (the `events` table). The build can read and edit its **own** directory rows, docs, files (GitHub `main`), and settings, and can deploy itself — so it is self-modifying. The whole game is: *message → the right tool runs → reply*, and improving that by tuning prompts/rows/settings, escalating to code only when nothing smaller works.

---

## 1. A real turn (so you can picture it)
the owner iMessaged **"what articles are on the site"**. The ledger for that turn:
```
ROUTER (in)  : [channel imessage · from the owner] "what articles are on the site"
ARTICLES     : GET /api/articles -> 200 {"articles":[{slug:"tb-500-demo"...},{slug:"bpc-157"...}]}
ROUTER (out) : [REPLY]Here are the articles currently in the system: TB-500 (tb-500-demo) and BPC-157.[/REPLY]
```
Another: **"make a new article about ARA-290"** → `ARTICLES create → POST /api/articles → 200 {"article":{"slug":"ara-290"...}}` → `[REPLY]Article ara-290 created successfully.` **[WORKS]**

Read any turn yourself: `GET /admin/ledger?data=1&limit=20` (filters: `key=ROUTER`, `q=<text>`, `trace_id=`). **The ledger is the source of truth for what happened — not memory, not the chat.**

---

## 2. The pieces
- **Directory** — the invocation table (D1). One row = one capability. `GET /api/directory`; full self-describing dump `GET /api/manual`.
- **Dispatch** — `POST /api/dispatch {key, body, actor?}`. The one door; runs any row.
- **ROUTER** — the brain. Its prompt is the `ROUTER` directory row (an `agent` row). It knows some tools by name in its prompt; for the rest it uses REST GET/POST on groups. **No fuzzy search tool** (banned — see laws).
- **Agents** — other `grok-4.3` LLMs, each its own directory row/prompt. `AGENT_SPAWN <goal>`, `AGENT_LIST`, `AGENT msg|<id>|<text>`. Durable loop runs on the sibling Worker (AgentDO).
- **Queue + poller** — `tasks` table: `ADDTASK`, `TASKS_LIST`, `EDITTASK`, `DONETASK`, `DELTASK`. `TODO_RUN` runs the next open task through ROUTER; cron calls it every 5 min, gated by KV `todo_autorun` (default off). **[WORKS]**
- **Articles** — content with **slots** (`what_it_is, mechanism, evidence_animal, evidence_human, marketing_vs_evidence, open_questions, disclaimer, custom`). `compose` makes grok write a slot using two docs: `style_topology` (writer system prompt) + `slot_specs` (per-slot shape). Public page `/a/<slug>`. **[WORKS]**
- **Ledger** — `events` table; `GET /admin/ledger?data=1`. Every request+response.
- **Cost** — `turn_costs` table logs cost per trace. Per-article aggregation is **[GAP]**.

---

## 3. The escalation ladder — how the build changes itself
Always start at the top. Only escalate when the level above genuinely cannot do it (this is Law 9). Every level is reachable over REST with header `x-terminal-key: <TERMINAL_KEY>`.

| # | Lever | How (REST) | Goes live |
|---|---|---|---|
| 1 | **The message** | say it clearly to the build | instant |
| 2 | **A prompt** (ROUTER/agent) | `PATCH /api/directory/<KEY> {"content":"..."}` | instant (read per request) |
| 3 | **A directory row** (tool) | `POST` / `PATCH` / `DELETE /api/directory/<key>` | instant |
| 4 | **A setting** | `POST /api/dispatch {"key":"KV_PUT","body":"agent_tool_loops|20"}` (raw value) — e.g. `agent_tool_loops`, `grok_web_search`, `grok_temperature`, `todo_autorun` | instant |
| 5 | **A doc** (writer framework) | `POST /api/dispatch {"key":"D1_EXEC","body":"UPDATE docs SET body='...' WHERE slug='style_topology'"}` | instant |
| 6 | **A code file** | `PUT /api/file/<path> {"content":"..."}` → commits to GitHub `main` | **needs deploy** |
| 7 | **Deploy** | `POST /api/dispatch {"key":"WRANGLER_DEPLOY","body":""}` (runs `wrangler pages deploy` on the Mac) | makes code live |

Levels 1–5 are instant and reversible — **prefer them**. Levels 6–7 are the heavy escalation the owner means by "all the way up to running code edits and deploying wrangler." A natural-language request from the owner may legitimately travel all the way down this ladder — but only as far as needed.

---

## 4. The TARGET LOOP (what we are building toward)
The conversational, self-improving loop. the owner talks to the build; the build acts, asks for help when unsure, and improves itself from his feedback.

1. Build writes/edits an article → **sends it to the owner over iMessage** for review. **[GAP]**
2. the owner replies: "looks good" (done) · an edit · "that was shit — what was the prompt?"
3. On an edit reply → build edits that article (it must map a link/title → slug). **[PARTIAL: edit works; link→slug mapping GAP]**
4. On "what was the prompt?" → build returns the exact prompt/doc it used, and **edits that prompt / its max_tokens / tool_loops / any restriction from natural-language feedback**. **[GAP: introspection+self-edit-from-NL not wired]**
5. "add these 10 articles to your task list" → 10 rows in `tasks` → poller writes them one per tick → each finished article is sent to the owner. **[PARTIAL: queue+poller WORK; notify GAP]**
6. "how much did that cost?" → per-article token cost from a build variable. **[GAP]**
7. **Inter-LLM cooperation**: Grok hires Kimi/GPT/etc. as a helper writer/reviewer. **[PARTIAL: `ASK_KIMI`/`ASK_GPT`-style agent rows may exist; the hire-a-helper loop is GAP]**
8. Build grounds itself when unsure: reads the directory / GitHub / a doc / this spec — the same way a coding LLM does. **[PARTIAL: `DIR_GET`/`DIR_LIST`/`/api/file`/`DOCS_GET` exist; DOCS_GET currently returns empty = bug]**
9. Escalation: an NL request can reach a code edit + deploy (ladder §3). **[WORKS via the ladder, not yet self-driven by ROUTER]**

### 4A. Capability closure loop
The self-test is the build's executable spec. Each failed question becomes one repair loop:
1. Read the self-test result and the ledger trace.
2. Identify the exact directory key the ROUTER emitted.
3. Read that row and compare its `WHAT/ARGS/EX` contract to the real request/response in the ledger.
4. Patch the smallest broken layer: prompt mapping, row body/target/auth, setting, or doc.
5. Rerun the same natural-language question through the group self-test.
6. Keep the change only if the score/result improves; otherwise revert.

This is how the build stays anti-sprawl: it does not add another alias/tool for every failure. It makes the existing row true, exercises it, and records proof. A capability is either proven, unproven, or removed.

### 4B. Router voice and self-knowledge
ROUTER must sound like the build describing and operating itself, not like a generic assistant. For build/API/terminal questions it should answer with exact objects:
- Identity: miscsubjects build; iMessage/Blooio; ROUTER; directory rows; real tools; ledger; Cloudflare Pages/D1/KV/R2; Mac bridge.
- API: `POST /api/dispatch {key, body}`, `GET/PATCH /api/directory/<KEY>`, `GET /api/manual`, `GET /admin/ledger?data=1`, `GET/POST /api/selftest`, `x-terminal-key` for edits.
- Terminal: `/t <command>` over iMessage or `LOCAL_EXEC`; output returns through the Mac bridge into ledger/reply.
- Bad response reports from the owner are build bugs. Add a prompt/row/test fix, then rerun a natural-language self-test.

Generic chatbot language on these questions is not a harmless tone issue. It is a capability failure because the build failed to recognize its own surface.

### 4C. Protected root redirect
`https://miscsubjects.com/` is intentionally controlled by the existing cloaker/redirect path. End-to-end audit/sync work may verify the root redirect as an invariant, but must not change the root route, root static asset, `_routes.json`, or `functions/_middleware.js` unless the owner explicitly asks for a root redirect change.

---

## 5. Capability roadmap — small, version-tested increments
Each is ONE increment at the lowest ladder level that does it. Build one, test it over a real iMessage, keep or revert, move on. **Nothing more than a little outside the current strata.**

- [ ] **Notify-on-write** — when an article is created/edited, the agent sends the owner the link + summary. Level 2–3 (a `NOTIFY_OWNER` row + a clause in the writer agent).
- [ ] **Link→slug awareness** — "edit this article at <url>" → strip to slug → edit. Level 2 (ROUTER clause: a `/a/<slug>` URL means that article).
- [ ] **Prompt introspection + NL self-edit** — "what prompt did you use / change it to X" → return the `style_topology`/row content, then `PATCH`/`D1_EXEC` it. Level 2 + tools that already exist.
- [ ] **NL settings edit** — "give yourself more room / more tokens / more loops" → `SET_AGENT_LIMITS`/`KV_PUT`. Level 4 (`GET_AGENT_LIMITS` getter exists; wire the setter into ROUTER).
- [ ] **Per-article cost** — aggregate `turn_costs` by article/trace; expose `ARTICLE_COST`. Level 3 (row) or 6 (small code).
- [ ] **Batch write** — "write these N articles" → N `tasks` → `todo_autorun=1` → poller composes one per tick → notify each. Level 3–4.
- [ ] **Quality self-check** — run `JUDGE` (uses `judge_prompt`) on a finished article; if low, recompose; surface the score to the owner. Level 5.
- [ ] **Inter-LLM helper** — ROUTER/agent emits `ASK_KIMI`/`ASK_GPT` for a second draft or review, folds it in. Level 2–3.
- [ ] **Self-spawn for big jobs** — "rewrite all BPC articles" → spawn an agent whose goal walks every matching article. Level 2 (ROUTER clause) + AGENT_SPAWN.

---

## 6. Agents & cooperation (the mechanics, as they stand)
- **Spawn**: `AGENT_SPAWN <goal>` → a durable `AgentDO` loop on the sibling Worker; it ticks (self-alarms) until done. `AGENT_LIST` shows `{id, goal, status, steps, last_action}`. `AGENT msg|<id>|<text>` steers a running one. **[WORKS]** (verified: spawned `ag_997eb2b2`, ran, completed.)
- **Do two agents talk?** Today, indirectly: an agent emits another capability's tag, and **dispatch** runs it (everything flows through dispatch/the router pattern). Direct DO↔DO messaging is **[GAP]**.
- **Automated task vs live message**: a task runs through `TODO_RUN → ROUTER` tagged `actor=todo`; a live text runs through `ROUTER` tagged `actor=<channel>`. Same brain, different `actor` in the ledger — that is how you tell automated work from a live conversation.

---

## 7. The rules every LLM follows here (iterative versioning)
These are enforced by `AGENTS.md` (OWNER LAWS 1–9). Summary:
1. **Proof only via real iMessage** — a feature "works" only when a real text to the build returns the real result in the ledger. Bash/curl/dispatch proves the wire, not the feature.
2. **No lying / no hallucination** — never assert a state without a live check shown this turn.
3. **Prompts are LLMs — tune, don't rewrite.** A bad/robotic reply is a wording/tool gap, not a code bug. Coach it. Read the prompt as if you were the model receiving it.
4. **REST-only, no discovery-search tools** (`TOOLS_SEARCH` is banned). Resolve by known name or REST GET/POST on a group.
5. **Debug only via {the message, the prompt, the ledger}** — in that order.
6. **Change code last** (ladder §3); state the alternatives you tried first.
7. **Small changes only.** One increment, test, keep/revert. *No one is taken seriously proposing anything more than a little outside the current strata.*
8. **Ground each other** — cite the directory / ledger / this spec, never memory.

---

## 8. Worked log from the session that produced this spec (a real before/after)
**Problem:** asked over iMessage to write a BPC-157 article, grok produced terse diagnostic stubs like:
```
mechanism: 1. BPC-157 modulates nitric oxide pathways. — Exhibit: UNKNOWN. Tier: UNKNOWN. (x4)
```
**Diagnosis (per the rules):** not a code bug. The cause was the writer's framework — `style_topology` said *"decoration destroys trust; a claim without an exhibit is harm"* and `slot_specs` forced a rigid exhibit/tier list. That **caged** the model into diagnostic output.
**Fix (level 5, no code):** rewrote the two docs via `D1_EXEC` to unleash the writer ("write the most comprehensive, accurate, fascinating piece you can, like you would in your own app; be truthful, never fabricate"). 
**Result (recomposed one slot first — version-test):** the mechanism slot became a real multi-paragraph section (VEGF/eNOS, AKT, NF-κB, collagen remodeling, neuroprotection, honest that no receptor is identified), then both full articles regenerated to 600–2,400 chars/section.
**Lesson for the next LLM:** when output is bad, find the caging clause in the prompt/doc and change that ONE thing — do not reach for code, and do not invent restrictions the owner never asked for.

---

## 9. Quick reference (the addresses you'll use)
- Run anything: `POST https://miscsubjects.com/api/dispatch {key, body}`
- Whole ontology: `GET https://miscsubjects.com/api/manual`
- Directory: `GET /api/directory` · one row `GET|PATCH|DELETE /api/directory/<key>`
- Articles: see `REST_RECIPES.md`
- Ledger (truth): `GET /admin/ledger?data=1&limit=20`
- Files (code): `GET|PUT|DELETE /api/file/<path>` (key required)
- Writer docs: `style_topology`, `slot_specs`, `judge_prompt` (edit via `D1_EXEC UPDATE docs`)
- Settings: `KV_PUT <key>|<value>` — `agent_tool_loops`, `grok_web_search`, `grok_temperature`, `todo_autorun`
- Deploy: `WRANGLER_DEPLOY`
- Header for any edit: `x-terminal-key: <TERMINAL_KEY>`

*This spec is itself a build file. Improve it the same way: `PUT /api/file/docs/BUILD_SPEC.md`. Keep it true — mark [WORKS] only what you verified in the ledger.*
