# miscsubjects API — complete REST reference (request + response)

Single always-accurate source: `GET https://miscsubjects.com/api/manual` (every capability, full REST, plus `invoke_spec` for exact call shapes). This file mirrors it for humans. Auth on every call: header `x-terminal-key: <MISC>`. The build holds the GitHub + Cloudflare tokens, so a caller needs ONLY this key.

---

## INVOKE — call a model (invokeJSON)
One model call, or up to 200 in parallel in one round trip. No agent loop, no tools, hard
timeout (25s default, 60s ceiling). A system prompt is a **directory row**, never a string
in code — see law `MODEL_CALL_LAW` and `/admin/prompts`.

Request:
```json
{ "method":"POST", "url":"https://miscsubjects.com/api/invoke",
  "headers":{"x-terminal-key":"<MISC>","content-type":"application/json"},
  "body":{ "key":"WRITER_AGENT_v5", "input":"write the lede" } }
```
Response:
```json
{ "ok":true, "count":1, "ok_count":1, "ms":940,
  "results":[{"ok":true,"label":"WRITER_AGENT_v5","model":"@cf/moonshotai/kimi-k2.7-code",
              "ms":938,"text":"...","usage":{"total_tokens":812}}] }
```

Call object — the whole contract:

| field | meaning |
|---|---|
| `key` | directory row (type=agent) supplying the system prompt + model. Optional. |
| `model` | override. Alias (`kimi`,`glm`,`fast`,`grok`,`gpt`,`opus5`,`sonnet5`) or any gateway id. |
| `system` | literal system prompt; overrides the row's content. |
| `memory` | extra block appended under a MEMORY header, **this call only**. Nothing is persisted. |
| `includes` | csv of `prompt_block` keys composed ahead of the prompt. |
| `input` / `messages` | the user message, or a full `[{role,content}]` array. |
| `inputs` | array of messages → one parallel call each. |
| `n` | run the same call n times in parallel (sampling / prompt-version sweeps). |
| `vars` | `{NAME:value}` substituted for `{{NAME}}` in system and input. |
| `temperature`, `max_tokens`, `json`, `timeout_ms`, `label` | per call. |

Batch forms: `{calls:[...]}` · `[...]` · `{key, inputs:[...]}` · `{key, n:5}`.

100 replies, one request, everything in flight at once:
```bash
curl -X POST https://miscsubjects.com/api/invoke \
  -H "x-terminal-key: $MISC" -H "content-type: application/json" \
  -d '{"key":"WRITER_AGENT_v5","inputs":["row 1","row 2","...","row 100"]}'
```

Five prompt versions against the same input, side by side:
```bash
curl -X POST https://miscsubjects.com/api/invoke -H "x-terminal-key: $MISC" \
  -d '{"calls":[{"key":"V1","input":"x"},{"key":"V2","input":"x"},{"key":"V3","input":"x"}]}'
```

- `?shape=1` (or `"shape":true`) builds the exact outbound payload and does **not** send it.
- `?format=text` returns one reply per line (newlines/tabs escaped) — the Sheets lane.
- `?format=csv` returns `label,ok,ms,model,text`.
- `GET /api/invoke` with no params returns this contract as JSON.
- A non-200, an edge error page, or a timeout comes back as `ok:false` with a named `error`.
  It is never reported as a model answer and never as a model refusal.

Google Sheets: `apps-script/Invoke.gs` — `=INVOKE(input, key)`, `=INVOKEALL(A2:A101, key)`,
or **Build → Invoke: fill column from prompt**.

---

## DISPATCH — run any capability
Request:
```json
{ "method":"POST", "url":"https://miscsubjects.com/api/dispatch",
  "headers":{"x-terminal-key":"<MISC>","content-type":"application/json"},
  "body":{ "key":"ASK_KIMI", "body":"what is BPC-157 in one sentence" } }
```
Response:
```json
{ "trace":"t_xxxx", "result":"BPC-157 is a synthetic 15-amino-acid peptide ...", "cost":0 }
```
Shape only (no send): add `"shape":true` → `result` is the fully-resolved outbound request.

---

## ARTICLES
CREATE — request / response:
```json
{ "method":"POST","url":"https://miscsubjects.com/api/articles",
  "headers":{"x-terminal-key":"<MISC>","content-type":"application/json"},
  "body":{ "slug":"bpc157","title":"BPC-157","subject":"peptide" } }
```
```json
{ "article":{ "slug":"bpc157","title":"BPC-157","subject":"peptide","published":1,"created_at":"...","updated_at":"..." }, "slots_set":[] }
```
READ:
```json
{ "method":"GET","url":"https://miscsubjects.com/api/articles/bpc157","headers":{"x-terminal-key":"<MISC>"} }
```
```json
{ "article":{ "slug":"bpc157","title":"BPC-157","subject":"peptide","published":1 },
  "slots":[ { "slot_key":"what_it_is","content":"...","model":"grok-4.3","version":1,"created_at":"..." } ] }
```
WRITER composes a slot (grok writes + stores it):
```json
{ "method":"POST","url":"https://miscsubjects.com/api/articles/bpc157/compose",
  "headers":{"x-terminal-key":"<MISC>","content-type":"application/json"},
  "body":{ "slot_key":"what_it_is","brief":"<your rules + topic>" } }
```
```json
{ "article_slug":"bpc157","slot_key":"what_it_is","version":1,"model":"grok-4.3","tokens_in":394,"tokens_out":181,"content":"BPC-157 is ..." }
```
SET a slot to your own text:
```json
{ "method":"POST","url":"https://miscsubjects.com/api/articles/bpc157/set",
  "headers":{"x-terminal-key":"<MISC>","content-type":"application/json"},
  "body":{ "slot_key":"what_it_is","content":"<your text>" } }
```
```json
{ "article_slug":"bpc157","slot_key":"what_it_is","version":2,"content":"<your text>" }
```
EDIT title/subject/published: `PATCH /api/articles/bpc157 {"title":"...","subject":"...","published":true}`
DELETE: `DELETE /api/articles/bpc157` → `{ "deleted":"bpc157" }` (then GET → 404)

To choose a different writer: `POST /api/dispatch {"key":"ASK_KIMI","body":"<brief>"}` → take `result` → `set`. `compose` ignores a `model` field (always grok). Working writers: ASK_KIMI, ASK_GPT, ASK_GEMINI, PEPTIDE_WRITER. ASK_CLAUDE is dead.

---

## AGENTS & TOOLS (directory rows: agent | fn | http | flow)
CREATE:
```json
{ "method":"POST","url":"https://miscsubjects.com/api/directory",
  "headers":{"x-terminal-key":"<MISC>","content-type":"application/json"},
  "body":{ "key":"MY_AGENT","type":"agent","target":"grok-4.3","auth":"bearer:GROK_API_KEY","content":"<system prompt>" } }
```
→ `201` `{ "key":"MY_AGENT", ... }`
READ one: `GET /api/directory/MY_AGENT` → `{ "key","type","target","auth","content" }`
READ all: `GET /api/directory?type=agent` → `{ "count":27,"rows":[...] }`
EXACT call shape for any row: `GET /api/manual?key=MY_AGENT` →
```json
{ "capability":{ "key":"MY_AGENT","type":"agent","doc":"...",
   "invoke":{"method":"POST","url":".../api/dispatch","body":{"key":"MY_AGENT","body":"<args>"}},
   "invoke_spec":{ "key":"...","type":"...","what":[...],"args":[...],"ops":[...],"envVars":[...],"returns":"...","example":"...","rest":[...],"slug":"..." } } }
```
EDIT (prompt / model / key): `PATCH /api/directory/MY_AGENT {"content":"..."}` (also `target`, `auth`)
DELETE: `DELETE /api/directory/MY_AGENT`
RUN: `POST /api/dispatch {"key":"MY_AGENT","body":"<args>"}`
Router prompt is the row `ROUTER`: edit `PATCH /api/directory/ROUTER {"content":"..."}`, test `POST /api/dispatch {"key":"ROUTER","body":"[channel sms 1:1 · from customer (+1...)]\nNow: ..."}`.

---

## PAGES
CREATE/REPLACE: `PUT /api/pages/<slug> {"title":"...","body_html":"<html>"}`
READ: `GET /api/pages/<slug>` (all: `GET /api/pages` → `{ "data":[...] }`)
EDIT: `PATCH /api/pages/<slug> {"title":"...","body_html":"..."}`
DELETE: `DELETE /api/pages/<slug>`
(Homepage `/` is a static file, not a page.)

---

## CONTENT (content_items)
CREATE: `POST /api/content {"slug","type","title","body_md","tags":[]}`
READ: `GET /api/content/<slug>` (all: `GET /api/content?limit=100` → `{ "count","items":[...] }`)
EDIT: `PATCH /api/content/<slug> {"body_md":"..."}`
DELETE: `DELETE /api/content/<slug>`

---

## FILES / CODE (commits to GitHub main via the build's token)
CREATE/EDIT: `PUT /api/file/<path> {"content":"<text>","message":"<commit>"}` → `201/200` with `{ "content":{ "path","sha","size","html_url" } }`
READ: `GET /api/file/<path>` → `{ "path","sha","size","encoding","content" }` (list: `GET /api/file/?list=1`)
DELETE: `DELETE /api/file/<path>`

---

## HUB STORES (no Cloudflare key needed)
KV: `GET|PUT|DELETE /api/kv?key=<k>` (PUT body `{"value":"..."}`)
R2: `GET|PUT|DELETE /api/r2/<path>` (PUT body = raw bytes/text)
SETTINGS: `GET /api/settings` · `GET /api/settings/<key>` · `PUT|PATCH /api/settings/<key> {"value":"..."}` · `DELETE`

---

## SEE WHAT HAPPENED (ledger)
`GET /admin/ledger?turns=1&limit=20[&trace_id=<t>]`
```json
{ "turns":[ { "trace_id":"t_xxxx","ts":"...","channel":"...","message":"do you sell BPC-157?",
   "tools":[{"key":"ARTICLES"}], "routed":"ARTICLES","reply":"...","steps":[...] } ] }
```
Raw events: `GET /admin/ledger?data=1&limit=100`.
