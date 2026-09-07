# Flows: composition without code, and flows learned from the ledger

A `flow` is a directory row whose `content` is a small DSL that composes other rows. It dispatches,
composes into other flows, schedules, projects into sheets, MCP and curl, and receipts exactly like
every other row. The interpreter is in `functions/api/dispatch.js`; learned flows are
`functions/_lib/flow_learn.js`; the JSON-path reader is `functions/_lib/json_path.js`.

## 1. The grammar

```
STEP > STEP > STEP            steps run in order; $PREV is the previous step's output
STEP | STEP                   fan-out branches, joined
KEY: body                     one step: a row key and its argument body
$1                            the run input
$PREV                         the previous step's whole output
$PREV.body.items[0].id        a path into the previous output (dots walk objects, [n] arrays)
```

`>` and `|` separate only at the top level: the splitter tracks brace and bracket depth, so a
balanced JSON object inside a step body is an ordinary constant. What cannot be written is a
top-level `>` or `|`, an unbalanced brace, or a body that begins with `{` before its key. A missing
path step reads as an empty string, never a throw, so a step reading inside a payload degrades to
blank rather than to a crash. An `http` step's output carries its transport prefix (`HTTP 200:{…}`);
the path reader sees through it.

## 2. Step verbs

Three verbs move data between steps. They are not directory rows: nothing about them reaches the
ledger as an invocation and nothing about them can spend money.

| Verb | Does |
|---|---|
| `JSON: $.a.b[0].c` | pull one value out of `$PREV` |
| `EACH: KEY: body` | run a step once per element of `$PREV`, with `$PREV` bound to the element; results joined; capped at 25 |
| `MERGE: a=$x, b=$y` | build one JSON object out of earlier bindings |

Before these existed, "call X, take field Y, call Z with it" needed a JavaScript function, which is
a large part of why most rows were type `fn`.

## 3. A flow is a receipt tree

A top-level dispatch is one invocation, but every step it took (each flow member, each tool an
agent called) is its own ledger row under the same `trace_id`, with a step number and parent. A
flow that stops on an `ERR:` result stops there and the receipt says which step.

## 4. Learned flows

Successful work becomes a **flow**, not instructions a future model has to reason through again.

`FLOW_LEARN <trace_id>` reads the steps a trace actually took from the ledger and compiles them
into a flow row:

- the run input becomes `$1`;
- a step whose input was the previous step's output becomes `$PREV`;
- a literal that cannot be proven to have come from the input stays a constant, and a balanced JSON
  literal inside a step body is a constant too;
- a step whose row is unknown, disabled or failed is refused, and the flow is not written;
- a step that is sensitive or side-effecting (`TRIGGER`, `DELIVER`, `NOTIFY`, `DISPATCH`, sends,
  posts, payments, deletes) leaves the new row **disabled** until `FLOW_PROMOTE`;
- a trace that already contains a flow row is a flow execution, not a candidate.

`FLOW_CANDIDATES` groups traces by their step signature over the ledger and surfaces procedures the
system has watched succeed repeatedly, skipping traces whose outermost row is already a flow. A
compiled procedure that delivers or triggers never auto-runs; it is proposed.

A row written by code is not dispatchable in the same request, because the directory snapshot in KV
lags a moment; it runs on the next.

Tests: `scripts/flow-learn.test.mjs`, `functions/_lib/json_path.test.mjs`.
