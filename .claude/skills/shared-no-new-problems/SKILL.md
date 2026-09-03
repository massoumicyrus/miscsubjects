---
name: shared-no-new-problems
description: Use when the owner asks for a fix or reports a failure. Fix it without asking permission and without creating new problems.
---

# No New Problems — fix the failure the owner gave you

## Overview
When the owner reports a failure or asks for a fix, the only acceptable output is the fix. Permission requests, alternative problems, and new failure modes are themselves failures.

## When to Use
- The owner says "fix this", "this is broken", "I keep having to fix the same thing", or expresses anger about a problem.
- You are about to ask the owner for permission to proceed.
- You are about to tell the owner about a secondary problem instead of fixing the primary one.

## Core Pattern

```
Owner reports failure → Fix root cause → Verify → Report evidence only
```

2. **Do not ask permission.** Auto-permission mode is the default. Asking permission to fix a failure is a new problem.
3. **Do not bring new problems.** A fix that creates a new failure mode, new manual step, or new decision for the owner is not a fix.
4. **Verify with fresh evidence.** Run the governor, run the checks, reproduce the symptom. Numbers must move before you claim success.
5. **Report evidence only.** State what you changed and what the verification showed. No satisfaction language. No hedging.

## Rules

- **New problems are regressions.** If your fix introduces another issue, revert the fix and try again.
- **Evidence before claims.** Never say "fixed" until a check or count proves it.
- **Capture the rule.** If the owner states a principle while correcting you, write it as a skill/law in the same turn.

## Red Flags

- "Should I commit this?"
- "There's another issue I noticed..."
- "This fix might break X."
- "I think this is done."
- "Do you want me to push?"

## Verify

Before reporting a fix:
- The original symptom is gone or the relevant count dropped.
- No new errors, flags, or failures appeared.
- The change is committed or the state is otherwise durable.
