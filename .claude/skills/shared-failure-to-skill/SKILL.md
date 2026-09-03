---
name: shared-failure-to-skill
description: Use when the owner reports a recurring failure, repeated fix, or systemic issue. Convert the failure into a skill and a mechanical gate so it stops repeating.
---

# Failure → Skill — stop the same problem from recurring

## When to Use
- The owner says "this keeps happening", "I already fixed this", "same problem as last time", or expresses anger about repeated failures.
- A governor/audit report shows the same error class, collision type, or owner-restatement count recurring.
- You find yourself about to apply the same fix more than once.

## Core Pattern

```
Verify failure exists → Fix root cause → Add mechanical gate → Write skill → Verify counts drop
```

1. **Verify the failure with fresh evidence.** Do not trust a summary that says "done". Run the governor, read the ledger, or reproduce the failure yourself.
   anything, write one sentence answering: *which input, rule, affordance, or default made the
   wrong choice feel natural to the model that made it?* Not "I forgot" — the actual mechanism
   (a harness prompt nudging toward private memory; a doc that says the old thing; an API that
   silently accepts the bad shape; a missing refusal). If you cannot name the machinery, you have
   not found the root cause and you may not proceed to the fix. The fix must change THAT surface —
   the goal is a system that must be right, not a model that promises to remember. Moving the
   artifact to the right place without changing the machinery is the banned half-fix: it waits
   for the owner to lose his composure again.
3. **Fix the root cause, not the symptom.** One fix. If the fix touches shared files, claim them first.
3. **Add a mechanical gate** so the failure is blocked automatically:
   - Code pattern failures → pre-commit check or protected-feature check.
   - Owner-restatement failures → `shared-rule-capture` skill + governor detector.
   - Write collisions → `shared-write-law` + `FILE_CLAIM` enforcement.
   - Published garbage → cleanup script + check.
4. **Write the skill** that encodes the detection + fix + gate. The skill is the article. It must load automatically for every future agent.
5. **Verify the failure count drops** before declaring anything fixed. Evidence only.

## Rules

- **Do not bring new problems.** A fix that creates a new failure mode is not a fix.
- **A skill without a gate is half-done.** Abstract advice does not stop recurrence; code does.
- **Verify before declaring.** Run the governor, run the checks, look at the ledger. Numbers must move.
- **Capture the owner's meta-rules in the same turn.** If the owner states a principle ("don't use my name", "convert failures to skills"), write a skill for it immediately.

## Red Flags

- "I can just patch this now and document later."
- "The owner can approve the skill after I write it."
- "This is a one-time issue, no need for a skill."
- "The fix is obvious, I don't need to verify."
- Declaring work complete while checks still fail or counts haven't dropped.

## Verify

Before saying a failure is fixed:
- The mechanical gate runs and blocks the failure mode.
- The skill is written and placed where all agents load it.
- Governor/ledger evidence shows the recurrence count dropped.
