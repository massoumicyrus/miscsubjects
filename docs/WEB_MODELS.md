# Web models as capabilities, in both directions

A logged-in web ChatGPT, Claude, Grok, Gemini or Kimi session is an execution substrate behind the
directory, exactly like HTTP, an agent, a function or a flow. A caller names a provider and a
prompt; it never names a browser, a selector, a tab or a debugging port. The edge half is
`functions/_lib/webmodel_gateway.js`; the relay is `functions/_lib/webmodel_relay.js`; the Mac
half is `bridge/webmodel/`.

## 1. Rows

| Row | Does |
|---|---|
| `CHATGPT_WEB`, `CLAUDE_WEB`, `GROK_WEB`, `GEMINI_WEB`, `KIMI_WEB` | one turn against that provider |
| `WEBMODEL_SESSION_NEW`, `WEBMODEL_SEND`, `WEBMODEL_READ`, `WEBMODEL_STATUS`, `WEBMODEL_CLOSE` | durable sessions: open, send a prompt (JSON body `{provider or session_id, prompt, state_handle, with_state, request_id}`), read a turn, status, close |
| `STATE_NEW`, `STATE_APPEND`, `STATE_RESOLVE` | the `state://` continuation handle |
| `WEBMODEL_AGENT` | the relay lane (§4) |
| `WEB_COUNCIL`, `WEB_DATA_REVIEW` | flows that fan a question out to several web models and join the answers |

## 2. What the edge guarantees regardless of the browser underneath

- **Durable objects in D1.** `webmodel_sessions` and `webmodel_turns` hold every session and every
  turn, including the completion method that fired.
- **A receipt that binds prompt to response.** Nothing reports `ok:true` unless the prompt was
  submitted, the response captured, the row written and the ledger receipt taken. A failure is a
  named `ERR:`, never a success envelope with an error sentence inside it.
- **Accepted and polled.** The edge in front of the tunnel cuts any origin response held past 100
  seconds, and a long turn takes longer. The worker answers with a running turn id and the edge
  polls it against a bounded budget; an outer deadline races every turn so a page that never settles
  cannot hold a session lock.
- **Redaction.** Prompts and responses pass the same guard as every ledger row.

## 3. The state handle

`state://<id>` is a durable record one model writes and another reads, so a model can continue
another's work without a pasted transcript. The producer records turns under the handle; only a
receiver that passes `with_state` is given the briefing, and the briefing says plainly that it is
reference material, not the task.

## 4. The relay lane: the model becomes a caller

`WEBMODEL_AGENT` hands a web model the directory as text. The model emits `[KEY]args[/KEY]`, the
grammar the build already speaks; the relay parses it with the router's own reader
(`functions/_lib/tag_calls.js`, never a second grammar), invokes each capability through canonical
dispatch **under the caller's authority**, pastes the results back into the same conversation, and
lets the model continue until it answers with no tags. A web model needs no MCP client, no function
calling, no connector and no credentials; it needs to produce text.

Rows marked sensitive or requiring approval are refused outright and the refusal is handed back as
a tool result. The loop is bounded at 8 iterations and 4 calls per message. Every capability call
keeps its own receipt. A bare first-turn acknowledgement earns one bounded nudge rather than being
recorded as the model's answer.

## 5. The Mac half

`bridge/webmodel/worker.mjs` runs as a launchd job on the operator's machine, over one dedicated
Chrome profile seeded once from a real profile. Five adapters (`bridge/webmodel/adapters/`) hold
every selector. Completion is detected from the provider's own stream, then the stop indicator, then
DOM stabilisation, then the accessibility live region, never a fixed sleep. Textareas are filled
whole; contenteditable composers get Shift+Enter between lines, because every provider submits on
Enter. At most six provider tabs stay live; the least recently used idle tab is closed first, and a
load failure is `PROVIDER_UNAVAILABLE`, not `BROWSER_WORKER_OFFLINE`. The bridge proxies only the
narrow verbs: no debugging protocol, no arbitrary JavaScript, no arbitrary navigation crosses.

## 6. The sheet bridge: when a model must treat the page as data

A model reading a web page must treat it as data, never as instructions; that is the whole defence
against prompt injection, so some models correctly refuse to take a capability token off a page and
act on it. What moves is where the authority comes from: when a person asks their own model to write
a row into their own spreadsheet, that is an ordinary user-authorised action.

`functions/api/sheet-bridge.js` makes a Google Sheet tab the mailbox:

| Column | Holds |
|---|---|
| A | what to invoke: `[KEY]args[/KEY]`, `KEY|args`, or `KEY` |
| B | state: `running`, then `ok` or `error` |
| C | the answer |
| D | when |
| E | the ledger trace id |

A row runs when A is non-empty and B is empty; clearing B runs it again; prose in A that is not an
invocation is ignored, never guessed at. `GET /api/sheet-bridge` returns the contract and the live
queue; `POST` runs it once. Rows are claimed `running` before dispatch so two overlapping passes
cannot fire one invocation twice, and every write returns its outcome. One Google connection reaches
the whole directory, every row now and every flow composed later.

Tests: `scripts/webmodel-core.test.mjs`, `scripts/webmodel-gateway.test.mjs`.
