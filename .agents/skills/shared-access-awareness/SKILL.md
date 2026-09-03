---
name: shared-access-awareness
description: Load before claiming lack of access. The agent has full access to the ledger, the computer, past turns, KV, D1, R2, GitHub, and all build surfaces.
---

# Access Awareness — you have the keys, use them

## Overview
The agent has global access to the build and its history. Never tell the owner you cannot see something, cannot remember something, or do not have context. The ledger, session logs, KV, D1, R2, GitHub, and `LOCAL_EXEC` are all reachable. Use them.

## What You Have

- **Ledger:** every event, turn, error, claim, and dispatch result. Query it with `LEDGER_QUERY`, `AGENT_TURNS`, `LEDGER_ERRORS`, `GOVERNOR_RUN`.
- **D1 / KV / R2:** live database, key-value store, and object storage. Query and mutate through the MCP.
- **Local computer:** shell, file system, git, wrangler, apps via `LOCAL_EXEC` and `Bash`.
- **GitHub:** repo history, branches, commits, issues via `gh` or the MCP.
- **Session logs:** `.kimi-code/sessions/`, `.claude/`, `.codex/` contain prior turns and tool calls.
- **Skills and laws:** `.claude/skills/`, `.agents/skills/`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`.

## Rules

- **Never claim lack of access.** If the data exists anywhere the build can reach, you can reach it.
- **Query before assuming.** If the owner says "this has happened before", read the ledger. If you need history, grep session logs. If you need state, query D1/KV.
- **Current sessions come from the live turn ledger first.** When the owner asks you to read a session they are having now, identify the active session in `agent_turns` by recency, agent, and session ID, then read every row for that session in timestamp order. Local `.claude`, `.codex`, or attachment transcripts are secondary evidence and must not replace the ledger unless the ledger has no matching turns.
- **Use the MCP as the primary interface** to the build's live systems (ledger, D1, KV, governor). It is faster and more authoritative than shell guesses.
- **Do not ask the owner for context you can fetch yourself.** Asking for information you have access to is a new problem.
- **Cross-check claims with evidence.** A previous agent said something happened? Verify it in the ledger or git log before repeating it.

## Red Flags

- "I don't have access to previous sessions."
- "I don't remember what happened before."
- "I need more context."
- "Can you tell me what changed?"
- Repeating another agent's report without verifying it.

## Verify

Before saying you don't know:
- Query the ledger for the relevant events/turns.
- Check git history for the relevant files.
- Search session logs for prior tool calls.
- Query D1/KV for live state.
