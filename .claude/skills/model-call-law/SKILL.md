---
name: model-call-law
description: Use before writing, editing, or invoking ANY model prompt or model call — a system prompt, an agent prompt, a prompt version, a sweep, an eval, a batch of generations. Also use when a model call is slow, silent, timing out, or being polled. Binding rules — where a prompt lives, how it is written, how it is called.
---

# Model Call Law

Numbered. Lower numbers win. No rule below overrides a rule above it.

## 1. Where a prompt lives

1.1 A system prompt is a row in the `directory` D1 table. It is not a string literal in
JavaScript, not a template in a Worker, not a `.md` file the deploy ships.

1.2 A prompt is created or changed with REST — `POST /api/directory`,
`PATCH /api/directory/<key>` — or in the browser at `/admin/prompts/<key>`. Never by
editing code and deploying.

1.3 If a prompt string appears in a diff to any `.js` file, that diff is wrong. Move it to
a directory row and reference the row by key.

1.4 Per-call variation is not a reason to put a prompt in code. `memory`, `includes`, and
`vars` on the call object cover appended memory, composed blocks, and substitution.

## 2. How a model is called

2.1 One call is one JSON object through `POST /api/invoke`:
`{key, model?, system?, memory?, includes?, input?, vars?, temperature?, max_tokens?}`.

2.2 A batch is the same object with `inputs: [...]`, or `{calls: [...]}`, or `n: N`. Every
call in a batch is in flight at once. 100 replies is one round trip, not 100 waits.

2.3 A model call has a hard timeout — 25s default, 60s ceiling. There is no polling loop,
no background job the caller waits on, no "check back in a few minutes".

2.4 A prompt sweep runs as one batch of N versions against the same input, compared side
by side. It never runs as N sequential turns.

2.5 A non-200 from the gateway is a RESULT with `ok:false` and a named error, never
silence. An HTML body from an edge is `edge_error_page` — never counted as a model answer,
never counted as a refusal, never counted as data.

## 3. How a system prompt is written

3.1 Literal and binding. The reader is strictly literal and will exploit any ambiguity.

3.2 Numbered clauses in a Boolean precedence tree. Lower-numbered rules win. State that
precedence inside the prompt.

3.3 No decorative language. No "you are a world-class…", no tone-setting adjective that
does not change a decision, no metaphor standing in for a rule.

3.4 Every clause must be testable: a reader must be able to say whether an output violated
it. A clause nobody can fail is not a clause — delete it.

3.5 A prompt written as prose is a defect, regardless of whether its content is correct.
Rewrite it before testing anything against it.

## 4. What counts as evidence

4.1 A measurement made against a prose prompt, a single wording, or a run whose failures
included harness timeouts is not evidence. It is not publishable and not citable.

4.2 A result is quotable only when the prompt was clause-numbered, the wording varied
across at least three versions, and every non-answer was classified by cause.

## Failure conditions

- A prompt string in a `.js` file.
- A model call without a timeout.
- Any poll loop or wait-and-retry around a generation.
- Sequential calls where a batch would do.
- An error page, timeout, or empty body reported as a model refusal or a model answer.
- A prose system prompt shipped or tested against.
