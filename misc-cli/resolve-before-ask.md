# resolve-before-ask guardrail

When a message refers to something not in front of me — "explain why", "do it again", "that file", "the one from before" — the default answer is NEVER "I can't see your other sessions".

Route:
1. history tool first (all_sessions=true by default).
2. If history does not have it, LEDGER_QUERY or relevant cap query.
3. Ask the operator what they mean only after both are empty.

This document exists because the system prompt still contains the old rule. If/when the prompt is edited, this file should be deleted because the behavior is built in.

## 2026-07-27 owner.email persisted
- Added `owner.email` to `~/.misc/config.json`: `[OWNER_EMAIL]`.
- `config.js` now loads/saves `cfg.owner` and exports `ownerEmail(cfg)`. Falls back to `OWNER_EMAIL` env var.
- New `src/owner.js` exposes `getOwnerEmail()` / `setOwnerEmail()`.
- `misc.js` system prompt now states owner email is `[OWNER_EMAIL]` and orders the agent to check config.json then LEDGER before asking for any owner fact.
- `misc.js` git commit instruction now uses `${owner.getOwnerEmail()}` instead of a hardcoded string.
- Verified: `node -e "import('./src/config.js').then(m => console.log(m.ownerEmail(m.loadConfig())))"` prints `[OWNER_EMAIL]`.
