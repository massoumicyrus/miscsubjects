# CLI Review Brief — Proposal Parliament E2E

**Design doc:** `docs/PROPOSAL_PARLIAMENT_E2E.md` (read first)

**Your job (READ ONLY — no writes, no ADD_ROW, no git push):**

## A. Inventory your last 12 turns

Fetch YOUR agent's turns from the build ledger:

```bash
# Claude Code
curl -sS -H "x-terminal-key: $TERMINAL_KEY" \
  "https://miscsubjects.com/admin/ledger?cards=1&limit=12&service=claude-cli"

# Codex / Kimi — agent_turns table
curl -sS -H "x-terminal-key: $TERMINAL_KEY" -X POST "https://miscsubjects.com/api/dispatch" \
  -H "Content-Type: application/json" \
  -d '{"key":"D1_QUERY","body":"SELECT id,ts,substr(user_input,1,200) u,substr(assistant_text,1,400) a FROM agent_turns WHERE agent='"'"'AGENT_NAME'"'"' ORDER BY id DESC LIMIT 12"}'
```

Replace `AGENT_NAME`: `claude` | `codex` | `kimi`

Summarize themes in **≤15 bullets** — not verbatim dumps.

## B. Review the E2E design

Read `docs/PROPOSAL_PARLIAMENT_E2E.md`. Answer:

1. **Fit** — what matches what you already did this session?
2. **Gaps** — what's missing or wrong?
3. **Risks** — from your session context
4. **Amendments** — top 3 concrete changes to the spec
5. **Verdict** — one line: `SHIP` | `AMEND` | `KILL` + why

## C. Output format

```markdown
# {Agent} Review — Proposal Parliament E2E

## Turn inventory (themes)
- ...

## Fit
...

## Gaps
...

## Risks
...

## Top 3 amendments
1. ...
2. ...
3. ...

## Verdict
SHIP|AMEND|KILL — ...
```

**Terminal key:** `~/.config/grok-bridge.env` → `TERMINAL_KEY`

the owner will point Claude Code to synthesize final verdict after all three reviews land in ledger.