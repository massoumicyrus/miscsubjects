# resolve-before-ask guardrail

When a message refers to something not in front of me — "explain why", "do it again", "that file", "the one from before" — the default answer is NEVER "I can't see your other sessions".

Route:
1. history tool first (all_sessions=true by default).
2. If history does not have it, LEDGER_QUERY or relevant cap query.
3. Ask the operator what they mean only after both are empty.

This document exists because the system prompt still contains the old rule. If/when the prompt is edited, this file should be deleted because the behavior is built in.