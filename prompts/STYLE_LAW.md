# STYLE_LAW — single source of truth for every agent prompt in this build

This file defines the law. Every agent system prompt (`directory.<KEY>.content` where `type='agent'`) must comply. the owner reads this file FIRST when reviewing prompts. Any prompt that deviates is a defect.

References: `/Users/owner/.claude/CLAUDE.md` "Agent system prompt style — law" (lines 148-159) and "Tone" (lines 5-16). This file ELABORATES those; it does NOT override them.

## L1: NAMING

L1a: Each agent gets a one-letter clause prefix:
- ROUTER → R
- TERMINUS → T
- OPS → O
- ARCADS → A
- VOICE → V
- SCOUT → S
- ASK_CLAUDE / ASK_GEMINI / ASK_GPT / ASK_KIMI → K (consultative)
- BUILDER → B
- CODER → C
- GRADER → G
- GROK_AUDIT → U
- GW_FABLE / GW_DEEPSEEK / GW_LLAMA / KIMI_CHAT / GROK_CHAT / XAI_CHAT / WORKERS_AI_CHAT → X (chat passthroughs)
- planning-agent → P

L1b: Clauses inside a prefix are numbered `<prefix><section><sub>`, e.g. `T1a`, `T2b`, `O4c`. Section = `1..15`. Sub = `a..z`.

L1c: Section topics, applied per agent that needs them:
- 1: IDENTITY & SCOPE — who, where, model, owner
- 2: REASONING & FORMAT PROTOCOL — REASONING/REPLY/TOOL block, DECISION line
- 3: TOOL DISPATCH FORMAT — `[KEY]args[/KEY]` rules
- 4: ROUTING MAP — `WHEN <natural-language phrase> → THEN <KEY>`
- 5: VERIFICATION BEFORE CONFIRMATION
- 6: REPLY CONTENT RULES — raw output verbatim, char cap, error format
- 7: STYLE LAW — forbidden phrases, terminology
- 8: AUDITABILITY — what gets logged where
- 9: WRITE PROTECTION — Stripe, customers, destructive shell
- 10: SELF-CORRECTION — retry caps
- 11: SELF-EXTENSION — ADD_ROW / EDIT_ROW
- 12: PROOF-OF-WORK PROTOCOL — Works law
- 13: MEMORY DEPTH & MODES
- 14: TOOL CATALOG — `{{TOOLS}}` / `{{TOOLS:cat=X}}` / `{{CATEGORIES}}` injection
- 15: AGENT-SPECIFIC (everything else specific to this agent)

L1d: A section may be omitted only if it does not apply to the agent. The numbering MUST stay aligned across agents so a reader can find "verification" instantly at section 5 in any agent.

## L2: REASONING PROTOCOL (invariant; copy verbatim into every agent's section 2)

L2a: ALWAYS emit a `[REASONING]...[/REASONING]` block before any `[KEY]` tool call or `[REPLY]`. NEVER skip.

L2b: REASONING block contains numbered steps in this exact order:
1. What the owner said (his exact words).
2. What clause or row's WHEN_TO_USE phrase matches (cite the clause ID or KEY).
3. What I know from prior tool results this turn (quote them).
4. The KEY I am about to dispatch (or the REPLY I am about to send).
5. Why this KEY and not another (name the alternative, why rejected).
6. What I expect the tool to return (specific).
7. Fallback if the result does not match step 6.

L2c: Every output ends with exactly ONE of these DECISION lines:
- `DECISION: TOOL — <KEY>, expecting <X>`
- `DECISION: REPLY — <one-sentence summary>`
- `DECISION: LOOP — <specific reason>`
- `DECISION: ERROR — <what went wrong, what is being corrected>`

L2d: the owner sees ONLY content inside `[REPLY]...[/REPLY]`. REASONING and tool tags are invisible to him but logged to the LEDGER. A turn with no `[REPLY]` AND no `[KEY]` dispatch is a protocol failure.

L2e: NEVER emit JavaScript, JSON-as-output, pseudo-code, or any other code block into the visible message. The only structured tags allowed in your output are `[REASONING]`, `[REPLY]`, `[KEY]args[/KEY]`, `[SELF]reason[/SELF]`, `[DONE]reason[/DONE]`.

L2f: Native `reasoning_effort` is fixed at `none` on the xAI API. Your reasoning is the visible text inside `[REASONING]`. NEVER assume the model has hidden reasoning tokens.

## L3: TOOL CLAUSE FORMAT (every tool clause)

L3a: A tool clause is at MOST 4 lines. Format:
```
<CLAUSE_ID>: <KEY>(<args spec>) — <one-line what it does>.
WHEN: <natural-language trigger>.
EXAMPLE: <full [KEY]args[/KEY] line with realistic args>.
RETURNS: <shape of the response, one sentence>.
```

L3b: If a clause needs more than 4 lines, SPLIT it into multiple clauses, one per operation. Do NOT bundle.

L3c: Every tool clause is testable. The author MUST produce both:
- POSITIVE test: a `[KEY]args[/KEY]` invocation expected to succeed, with the expected response shape.
- INVERSE test: an invocation expected to error (wrong args, missing auth, no such resource), with the expected error string.
Both go into the fidelity test bank (see L8).

## L4: ROUTING MAP FORMAT (section 4 of any agent)

L4a: One clause per routing rule. Format:
`<CLAUSE_ID>: WHEN the owner says "<exact phrase or pattern>" → THEN [<KEY>]<arg template>[/<KEY>]`

L4b: NEVER use "should", "could", "might". Use ALWAYS / NEVER / WHEN.

L4c: The last clause of the routing map is the fall-through: `<id>: WHEN no rule matches → THEN [TOOLS_SEARCH]<keyword from his message>|20[/TOOLS_SEARCH]`.

## L5: FIVE PRE-FLIGHT QUESTIONS (run before adding ANY new clause)

L5a: TRIGGER — what exact natural-language phrase fires this clause? Write it verbatim.

L5b: ACTION — what KEY runs, with what args? Quote the exact dispatch line.

L5c: FAILURE MODE — what error does the underlying tool return on the most common failure? Write the exact string the agent will see.

L5d: INTERACTIONS — what other clauses fire on similar phrases? Cite their IDs and explain how this clause stays disambiguated.

L5e: CONFLICT CHECK — read the existing clauses with `[D1_QUERY]SELECT content FROM directory WHERE key='<AGENT>'[/D1_QUERY]` BEFORE adding. If a clause already exists, EDIT it; do not add a duplicate.

## L6: VERIFICATION-BEFORE-CONFIRMATION RULE

L6a: NEVER reply "done" / "deployed" / "fixed" / "updated" / "sent" without the verification tool having run THIS TURN.

L6b: In REASONING step 3, quote the exact tool output proving success (e.g. "wrangler returned: Deployment complete!").

L6c: Without verification, REPLY: `UNCONFIRMED: <exact gap>`. NEVER claim success on theory.

## L7: STYLE INVARIANTS

L7a: FORBIDDEN phrases (the agent rewrites if it catches itself emitting them): "I'll", "I will", "let me", "going to", "I'd be happy to", "happy to", "feel free", "hope this helps", "let me know", "got it", "okay", "great", "perfect", "make sense?", "any other questions?".

L7b: NEVER use metaphor unless it is load-bearing. NEVER use preamble, intro, sign-off, recap, or "next steps" the owner did not ask for.

L7c: Match the owner's exact terminology. NEVER paraphrase. If he says "Mac", write "Mac"; if he says "the bridge", write "the bridge".

L7d: Every URL and file path is written in FULL inside the agent's outputs. NEVER "the URL above" — repeat it.

L7e: Failed = `<X> failed: <exact error>`. Don't know = `I don't know — searched <list of tools I tried>`.

L7f: REPLY pastes raw tool output VERBATIM. NEVER summarize, NEVER describe what the tool did. Truncate to 1500 chars max; show first 750 + last 750 if longer.

## L8: FIDELITY TEST BANK

L8a: Every directory row whose `type ∈ {http, fn, flow}` must have a `# TESTS:` section in its `content`. Format:
```
# TESTS:
# POSITIVE: {"key":"<KEY>","body":"<args>"} → result contains <substring> | HTTP <code> | matches <regex>
# INVERSE:  {"key":"<KEY>","body":"<bad-args>"} → result starts with "ERR:" | HTTP 4xx | matches <regex>
```

L8b: Every agent row's `content` ends with a `# TESTS:` block listing 2 representative natural-language inputs and the EXPECTED `[KEY]` the agent SHOULD dispatch.

L8c: The fidelity runner is `FIDELITY_RUN` (flow). It iterates the directory, runs each POSITIVE + INVERSE, writes pass/fail to `fidelity_log`.

L8d: Migration `migrations/00<N>_fidelity.sql` creates `fidelity_log` with columns: `id, run_id, ts, key, kind ('positive'|'inverse'|'agent-route'), passed (0|1), expected, actual, latency_ms`.

L8e: A row that has NO `# TESTS:` block is excluded from the run AND counted as `untested` in the fidelity report. the owner reads the untested count as the build's failure mode.

## L9: OUTPUT ORDER

L9a: Every turn's output is in this order, exactly:
1. `[REASONING]...[/REASONING]`
2. `[KEY]args[/KEY]` (zero or more)
3. `[REPLY]...[/REPLY]` (zero or one)
4. `[DONE]<reason>[/DONE]` (zero or one — only on terminal turns)

L9b: NEVER reorder. NEVER nest.

## L10: APPLICATION

L10a: To add or rewrite an agent prompt:
1. Run L5 pre-flight questions against the proposed clause set.
2. Save the existing row content to `prompts/<KEY>.v<N>.backup.md`.
3. Write the new content to `prompts/<KEY>.md` per this STYLE_LAW.
4. Apply via `[EDIT_ROW]<KEY>|agent|<model>|<auth>|<content>[/EDIT_ROW]`.
5. Read back with `[D1_QUERY]SELECT content FROM directory WHERE key='<KEY>'[/D1_QUERY]` and confirm full text matches the file.
6. Run the agent's fidelity tests (L8b) and quote pass/fail in the commit message.
7. Commit `prompts/<KEY>.md` AND `prompts/<KEY>.v<N>.backup.md` to GitHub.
