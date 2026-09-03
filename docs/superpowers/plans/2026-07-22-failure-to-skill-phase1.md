# Failure-to-Skill Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline execution) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking. **Avoid large swarms — use single foreground subagents only to prevent timeouts.**

**Goal:** Stop shared-file write collisions by making the WRITE LAW machine-readable as a skill, and begin capturing owner restatement as skill candidates.

**Architecture:** Convert the existing AGENTS.md WRITE LAW into a loaded skill (`shared-write-law`) for both Claude Code and Kimi/Codex agents, add a companion `shared-rule-capture` skill for owner-restatement detection, and update AGENTS.md to point agents to the skills. Verify each skill with a short baseline pressure test.

**Tech Stack:** Markdown skills, Kimi Code / Claude Code skill directories, FILE_CLAIM KV locks, AGENTS.md project conventions.

---

### Task 1: Create the `shared-write-law` skill for Claude Code

**Files:**
- Create: `/Users/owner/.claude/skills/shared-write-law/SKILL.md`

- [ ] **Step 1: Write the skill file**

```markdown
---
name: shared-write-law
description: Use when about to edit any shared file in miscsubjects-pages, .claude/skills, or .agents/skills. Prevents write collisions and overwritten work.
---

# Shared Write Law — claim before edit

## Overview
Shared files in this build are edited by multiple agents. Editing without a claim causes collisions, overwritten work, and repeated fixes. This skill makes the existing AGENTS.md WRITE LAW automatic.

## When to Use
- Before editing any file under `miscsubjects-pages/`, `~/.claude/skills/`, or `~/.agents/skills/`.
- When resuming work on a file you edited earlier in the same session.
- When you see `FILE_CLAIM` DENIED or the file is already claimed.

## Core Pattern

```
Read file → FILE_CLAIM claim → Edit → FILE_CLAIM release
```

1. **Read the file first.** Never edit a file you have not read this session.
2. **Claim it:** `FILE_CLAIM|claim|<absolute-path>|<agent>:<session-prefix>|90`
3. **Only if the response starts with `CLAIMED:`** — edit the file.
4. **Release when done:** `FILE_CLAIM|release|<absolute-path>|<agent>:<session-prefix>`

## Rules

- **DENIED means stop.** Read the file fresh, find who holds the claim, coordinate. Do not edit.
- **Claims are per-file.** Editing five files requires five claims.
- **Release after your last edit** in the session. Do not hold claims you are not actively using.
- **TTL is 90 minutes.** If your session crashes, the claim expires automatically.
- **Success prefix matters.** A `FILE_CLAIM` result starting with `CLAIMED:` succeeded. Parse that prefix, not substring matches on the word "error" elsewhere in the response.

## Red Flags — STOP and Claim

- "I'll just patch this quickly."
- "The file is probably free."
- "I'll check the claim after editing."
- Reading a file and immediately reaching for Edit/Write without FILE_CLAIM.

All of these cause the collisions the owner is tired of fixing.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Editing before claiming | Claim first. If denied, do not proceed. |
| Releasing with wrong holder string | Use the same `<agent>:<session-prefix>` you claimed with. |
| Assuming free because FILE_CLAIM check said FREE | Claim anyway; FREE can change between check and edit. |
| Editing a file another agent changed since your read | Re-read, re-claim, merge changes. |

## Verify

Before every edit, confirm: `Read` ✓ → `FILE_CLAIM claim` returned `CLAIMED:` ✓ → `Edit` ✓ → `FILE_CLAIM release` ✓.
```

- [ ] **Step 2: Verify the skill file exists and has frontmatter**

Run: `head -3 /Users/owner/.claude/skills/shared-write-law/SKILL.md`
Expected: YAML frontmatter with `name: shared-write-law` and `description:` starting with "Use when...".

- [ ] **Step 3: Commit the skill**

```bash
cd /Users/owner
mkdir -p ~/.claude/skills/shared-write-law
git add ~/.claude/skills/shared-write-law/SKILL.md
git commit -m "feat(skill): shared-write-law — claim-before-edit enforcement"
```

---

### Task 2: Create the `shared-write-law` skill for Kimi / Codex / other agents

**Files:**
- Create: `/Users/owner/.agents/skills/shared-write-law/SKILL.md`

- [ ] **Step 1: Copy the Claude skill into the shared agents directory**

Run:
```bash
mkdir -p /Users/owner/.agents/skills/shared-write-law
cp /Users/owner/.claude/skills/shared-write-law/SKILL.md /Users/owner/.agents/skills/shared-write-law/SKILL.md
```

- [ ] **Step 2: Verify the copy**

Run: `diff /Users/owner/.claude/skills/shared-write-law/SKILL.md /Users/owner/.agents/skills/shared-write-law/SKILL.md`
Expected: no output (files identical).

- [ ] **Step 3: Commit**

```bash
git add /Users/owner/.agents/skills/shared-write-law/SKILL.md
git commit -m "feat(skill): shared-write-law for shared agents directory"
```

---

### Task 3: Baseline test the skill (single subagent, short timeout)

**Files:**
- None created/modified

- [ ] **Step 1: Run a pressure scenario WITHOUT the skill**

Dispatch one foreground subagent with a short task: "Edit `/Users/owner/miscsubjects-pages/docs/superpowers/specs/2026-07-22-failure-to-skill-design.md` to add a single line at the end. Do not give it the write-law skill."

Expected: The subagent edits the file without calling FILE_CLAIM. This proves the baseline failure.

- [ ] **Step 2: Run the same scenario WITH the skill loaded**

Dispatch one foreground subagent with the same task but load `shared-write-law`.

Expected: The subagent calls FILE_CLAIM before editing and releases after.

- [ ] **Step 3: Record test result**

Append result to `/Users/owner/miscsubjects-pages/docs/superpowers/specs/2026-07-22-failure-to-skill-design.md` under a new `## Skill Test Log` section.

---

### Task 4: Update `miscsubjects-pages/AGENTS.md` to reference the skill

**Files:**
- Modify: `/Users/owner/miscsubjects-pages/AGENTS.md:243-250`

- [ ] **Step 1: Read the current WRITE LAW section**

Read lines 243-250 of `/Users/owner/miscsubjects-pages/AGENTS.md`.

- [ ] **Step 2: Add skill reference immediately after the law heading**

Insert after `## WRITE LAW — file claims before edits (instituted 2026-07-02, governor's first URGENT flag)`:

```markdown
**This law is now loaded as a skill:** `shared-write-law`. Every agent MUST load and follow that skill before editing any shared file. The text below is the canonical contract; the skill adds the red-flag self-checks.
```

- [ ] **Step 3: Verify the patch**

Run: `grep -n "shared-write-law" /Users/owner/miscsubjects-pages/AGENTS.md`
Expected: line showing the skill reference near the WRITE LAW heading.

- [ ] **Step 4: Commit**

```bash
cd /Users/owner/miscsubjects-pages
git add AGENTS.md
git commit -m "docs(AGENTS): point WRITE LAW to shared-write-law skill"
```

---

### Task 5: Create the `shared-rule-capture` skill

**Files:**
- Create: `/Users/owner/.claude/skills/shared-rule-capture/SKILL.md`
- Create: `/Users/owner/.agents/skills/shared-rule-capture/SKILL.md`

- [ ] **Step 1: Write the skill file**

```markdown
---
name: shared-rule-capture
description: Use when the owner restates a rule, correction, or constraint. Converts repetition into a durable skill or law so future agents load it automatically.
---

# Shared Rule Capture — turn repetition into memory

## Overview
When the owner has to say the same thing more than once, the build has failed to remember. This skill captures repeated owner rules as skill/law candidates.

## When to Use
- The owner says "I already told you...", "always...", "never...", "do X before Y", or repeats a constraint.
- You notice yourself about to restate a rule the owner already stated this session.
- A governor or audit report shows high `owner_restatement` counts.

## Core Pattern

1. **Detect repetition.** Note when a rule-like statement appears from the owner.
2. **Draft a skill candidate.** One rule = one concise `shared-law-<topic>.md` or addition to an existing skill.
3. **Ask for approval.** Surface the candidate to the owner with a one-tap approve/reject.
4. **Commit on approve.** Place it in the correct skill directory and update `AGENTS.md` if project-specific.

## Rules

- Capture the rule in the same turn it is stated or confirmed.
- Task-only or capture-only is a half-failure: capture, then run the task, then verify the rule is loaded next time.
- A skill candidate must be <500 words and include concrete triggers, not abstract philosophy.
- Do not capture one-off corrections that are specific to a single bug. Capture patterns.

## Red Flags

- "I keep having to tell you..."
- "Same problem as last time..."
- "Why did you do X again?"
- Writing a long explanation instead of a skill.

## Verify

After capturing: the next agent session that touches the same topic loads the skill and follows it without the owner restating it.
```

- [ ] **Step 2: Copy to shared agents directory**

```bash
mkdir -p /Users/owner/.agents/skills/shared-rule-capture
cp /Users/owner/.claude/skills/shared-rule-capture/SKILL.md /Users/owner/.agents/skills/shared-rule-capture/SKILL.md
```

- [ ] **Step 3: Commit**

```bash
git add ~/.claude/skills/shared-rule-capture ~/.agents/skills/shared-rule-capture
git commit -m "feat(skill): shared-rule-capture — owner restatement to skill pipeline"
```

---

### Task 6: Publish skills as articles

**Files:**
- Create: articles via `ARTICLE_PUT` or `ARTICLES` create

- [ ] **Step 1: Create article slugs for each skill**

Use `ARTICLES` create for:
- `skill-shared-write-law`
- `skill-shared-rule-capture`

Titles: "Skill: Shared Write Law", "Skill: Shared Rule Capture".

- [ ] **Step 2: Populate each article with the skill body**

Use `ARTICLES set|skill-shared-write-law|body|<markdown body>`.
Use `ARTICLES set|skill-shared-rule-capture|body|<markdown body>`.

- [ ] **Step 3: Verify public URLs**

Open `https://miscsubjects.com/a/skill-shared-write-law` and `https://miscsubjects.com/a/skill-shared-rule-capture`.
Expected: Both render the skill content, owner name stripped.

---

### Task 7: Close loop and report

**Files:**
- Modify: `/Users/owner/miscsubjects-pages/docs/superpowers/specs/2026-07-22-failure-to-skill-design.md`

- [ ] **Step 1: Update design doc with completion status**

Append:
```markdown
## Phase 1 Completion

- [x] shared-write-law skill created and committed
- [x] shared-rule-capture skill created and committed
- [x] AGENTS.md points to shared-write-law
- [x] Skills published as articles
- [x] Baseline pressure test recorded
```

- [ ] **Step 2: Append to WORK_FEED**

Use `WORK_APPEND` with actor `kimi-cli`, kind `done`, and a summary of skills shipped + test results.

- [ ] **Step 3: Notify the owner**

Text the owner via `SEND_BY_CHANNEL|blooio|[OWNER_PHONE]|...` with a concise summary: two skills shipped, write collisions now skill-enforced, rule-capture active, next phase queued.
