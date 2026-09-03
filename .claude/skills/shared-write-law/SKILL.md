---
name: shared-write-law
description: Use when about to edit any shared file in miscsubjects-pages, .claude/skills, or .agents/skills. Prevents write collisions and overwritten work.
---

# Shared Write Law — claim before edit, enforced at commit

## Pairs with the Coding Law — both, never either
A claim says **who** is working on a file. It does not say **what text they are working from**, so an agent that read a file, went away to think, and came back to write holds a claim that tells it nothing about whether the file moved underneath it. The [coding-law](../coding-law/SKILL.md) skill supplies the missing half: a sha256 of every file as you read it, declared before your first edit, and again as you leave it, checked at commit. `scripts/check-coding-law.mjs` fails the deploy for any changed code file with no committed lease. Run both.

## Overview
Shared files in this build are edited by multiple agents. Editing without a claim causes collisions, overwritten work, and repeated fixes. This skill makes the existing AGENTS.md WRITE LAW automatic and mechanically enforced.

## When to Use
- Before editing any file under `miscsubjects-pages/`, `~/.claude/skills/`, or `~/.agents/skills/`.
- When resuming work on a file you edited earlier in the same session.
- When you see `FILE_CLAIM` DENIED or the file is already claimed.

## Core Pattern

```
Read file → FILE_CLAIM claim → Edit → FILE_CLAIM release
```

2. **Claim it:** `FILE_CLAIM|claim|<absolute-path>|<agent>:<session-prefix>|90`
   - Path must match what the pre-commit hook will see. Use the repo-relative path inside `miscsubjects-pages/` (e.g. `scripts/check-write-law.mjs`) or include the repo directory (e.g. `miscsubjects-pages/scripts/check-write-law.mjs`). The commit gate checks both forms.
3. **Only if the response starts with `CLAIMED:`** — edit the file.
4. **Release when done:** `FILE_CLAIM|release|<absolute-path>|<agent>:<session-prefix>`

## Mechanical Enforcement

- `scripts/check-write-law.mjs` runs inside `scripts/check-protected-features.mjs` and inside `.githooks/pre-commit`.
- It blocks any commit of a shared file unless the committing agent/session holds a current `FILE_CLAIM` KV lock for that file.
- `WRITE_LAW_BYPASS=<reason>` bypasses the check for emergencies.
- If the commit tool does not set a session ID, set `FILE_CLAIM_HOLDER=<agent>:<session-prefix>` in the environment.

## Stranded Work — a saved line is a debt, not a save

- Work committed on any line other than main DOES NOT EXIST for the build until it is folded into main. The June 2026 guard work (17 changes) and the July 2026 lead/traffic work stranded exactly this way and had to be forensically dispositioned a month later (2026-07-22).
- Finishing a task on a side line has exactly two legal exits, same session:
  1. Fold it into main (plain, non-destructive integration — preserve every ref), or
  2. Record its disposition: `git config --add quadsync.dispositioned "<branch>:<tip-sha>"` plus one STATE.md line saying what the line contains and why it is not folded.
- The quadsync cycle (every 10 min) reports every undispositioned line to the ledger as a `stranded_work` event, and `scripts/ship.mjs` prints what each deploy does NOT carry. Check either at session start; a non-zero stranded count is your FIRST task, not background noise.
- Dispositions bind to the exact tip: new commits on a dispositioned line re-alarm automatically.

## Rules

- **DENIED means stop.** Read the file fresh, find who holds the claim, coordinate. Do not edit.
- **Claims are per-file.** Editing five files requires five claims.
- **Release after your last edit** in the session. Do not hold claims you are not actively using.
- **TTL is 90 minutes.** If your session crashes, the claim expires automatically.
- **Success prefix matters.** A `FILE_CLAIM` result starting with `CLAIMED:` succeeded. Parse that prefix, not substring matches on the word "error" elsewhere in the response.
- **A claim is not optional.** The pre-commit hook will reject the commit if a shared file is unclaimed or held by another agent.

## Red Flags — STOP and Claim

- "I'll just patch this quickly."
- "The file is probably free."
- "I'll check the claim after editing."
- Reading a file and immediately reaching for Edit/Write without FILE_CLAIM.
- Commit failed with `WRITE_LAW` unclaimed error.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Editing before claiming | Claim first. If denied, do not proceed. |
| Releasing with wrong holder string | Use the same `<agent>:<session-prefix>` you claimed with. |
| Assuming free because FILE_CLAIM check said FREE | Claim anyway; FREE can change between check and edit. |
| Editing a file another agent changed since your read | Re-read, re-claim, merge changes. |
| Committing without FILE_CLAIM_HOLDER set | Export `FILE_CLAIM_HOLDER=<agent>:<session>` before `git commit`. |

## Verify

Before every edit, confirm: `Read` ✓ → `FILE_CLAIM claim` returned `CLAIMED:` ✓ → `Edit` ✓ → `FILE_CLAIM release` ✓.

Before every commit of shared files, confirm: `scripts/check-write-law.mjs` passes ✓.
