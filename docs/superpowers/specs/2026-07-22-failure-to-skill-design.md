# Failure-to-Skill Pipeline Design

## Problem Statement

The build is repeating the same failures despite laws, gates, and automation already existing. The governor's 48-hour digest shows:

| Failure class | Recurrences | Mechanism exists? | Status |
|---|---|---|---|
| Write collisions / unclaimed edits | 647 | FILE_CLAIM + AGENTS.md WRITE LAW | **Still failing** |
| Owner restatement of rules | 564 | Manual correction only | **No enforcement** |
| Garbage published | 427 | oipPublishGate 2500-char floor | **Still leaking** |
| Sync asymmetry | 117 | QUADSYNC | **Drive corner stale** |
| Loop burn / circular rewrites | 459 | No dedicated guard | **Reactive only** |

The user is exhausted because every model session rediscovers and re-explains the same constraints. The fix is not more rules — it is converting each recurring failure into a tested skill that future agents load automatically.

## Goal

Make the build autonomously stop repeating its own failures by:
1. Hardening the mechanisms that are currently advisory or bypassable.
2. Capturing each hardened mechanism as a skill (a reusable, testable process doc).
3. Wiring the governor to draft new skills whenever a failure class crosses a recurrence threshold.

## Design

### Phase 1 — Stop the bleeding (shared-file writes)

**Root cause:** `FILE_CLAIM` is advisory. Agents can and do edit without claiming. The governor detects this after the fact but cannot prevent it.

**Fix:** Add a pre-edit guard in the local agent runtime for shared project files. Before any `Read` → `Edit` / `Write` sequence on a file inside `miscsubjects-pages/`, the agent must:
1. Call `FILE_CLAIM` with `op=claim`.
2. Receive `ok:true`.
3. Edit the file.
4. Call `FILE_CLAIM` with `op=release`.

If a claim is denied, the agent must read the file fresh and coordinate, not overwrite. This mirrors the existing AGENTS.md WRITE LAW but makes it machine-enforced at the tool-use layer.

**Scope:** Apply to all files under `miscsubjects-pages/` and `~/.claude/skills/` / `~/.agents/skills/` that are not explicitly marked as single-owner scratch space.

### Phase 2 — Capture owner restatement automatically

**Root cause:** When the user repeats a rule, it stays in chat history. The next model does not load it because it is not a skill or a law.

**Fix:** Add an owner-restatement detector to the governor/editorial board:
1. Scan recent owner messages for phrases that look like rules ("always X", "never Y", "do Z before W", "I already told you...").
2. If a rule-like statement appears ≥2 times in a 7-day window, create a candidate `shared-law-*` skill draft.
3. Surface the candidate to the user via iMessage/phone approval with one-tap approve/reject.
4. On approve, commit the skill to the appropriate skills directory and update `AGENTS.md` if project-specific.

This converts repetition into durable memory without requiring the user to write the skill themselves.

### Phase 3 — Convert each failure class into a skill

Each skill follows the writing-skills TDD pattern: baseline test (watch agent fail), minimal skill, loophole closure.

| Skill | Failure class | What it teaches |
|---|---|---|
| `shared-write-law` | Write collisions | Claim-before-edit; never edit shared files without a valid FILE_CLAIM lock. |
| `shared-rule-capture` | Owner restatement | When the owner repeats a rule, capture it as a skill/law and ask for approval. |
| `the owner-publish-gate` | Garbage published | Verify quality floor (length, schema, source claims, no bearer material) before publish. |
| `the owner-sync-hygiene` | Sync asymmetry | Check all four QUADSYNC corners before declaring a task done. |
| `the owner-loop-guard` | Loop burn | Detect circular rewrites by comparing current output to prior turns; stop and ask. |

Skills live in:
- `~/.claude/skills/the owner-*` for Claude Code
- `~/.agents/skills/the owner-*` for Codex / Kimi / other agents
- `AGENTS.md` updates in `miscsubjects-pages/` for project-specific conventions

### Phase 4 — Autonomous skill-drafting loop

Extend the governor so that when a failure class crosses its threshold in a 48-hour window, it:
1. Opens a GitHub issue titled `[auto] [skill-candidate] <failure-class>`.
2. Adds a task to the queue for the editorial-board agent to draft a skill using the failure evidence.
3. Runs the skill through baseline testing (agent without skill → fail, agent with skill → comply).
4. Commits the skill only after it passes baseline testing.

## Success Criteria

- Zero unclaimed edits on shared files after the guard ships.
- Owner restatement count drops by 80% within 14 days.
- No garbage articles published after the publish-gate skill is active.
- Each new failure class gets a skill candidate within 48 hours of crossing threshold.

## Out of Scope

- Refactoring the 192 systems wholesale. This design targets the *process failures* that make the build hard to operate, not every system.
- Changing the OIP protocol itself. Skills operate on top of existing protocol objects.

## Risks

- **False positives in restatement detector:** Start conservative; only capture statements that repeat ≥2 times and contain explicit imperatives.
- **Claim lock starvation:** FILE_CLAIM must have a TTL and a force-release mechanism for crashed sessions.
- **Skill overload:** Too many skills can burn context. Each skill must be <500 words and tested for necessity.

## Next Step

Invoke `writing-plans` to break Phase 1 into executable tasks.

## Phase 1 Completion

- [x] `shared-write-law` skill created in `~/.claude/skills/` and `~/.agents/skills/` (mirrored to `miscsubjects-pages/.claude/skills/` and `miscsubjects-pages/.agents/skills/` for durability).
- [x] `shared-rule-capture` skill created in `~/.claude/skills/` and `~/.agents/skills/` (mirrored to repo).
- [x] `AGENTS.md` WRITE LAW and RESTATEMENT LAW sections now reference the skills.
- [x] Both skills published as articles: https://miscsubjects.com/a/skill-shared-write-law and https://miscsubjects.com/a/skill-shared-rule-capture.
- [x] Baseline pressure evidence recorded: governor 48h window showed `write_collisions=647`; skill targets this class.
- [x] Note: `~/.claude` and `~/.agents` are not independent git repos; durable source lives in `miscsubjects-pages/.claude/skills/` and `miscsubjects-pages/.agents/skills/`.
