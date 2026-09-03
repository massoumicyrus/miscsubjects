---
name: shared-rule-capture
description: Use when the owner restates a rule, correction, or constraint, or when a governor report shows high owner-restatement counts.
---

# Shared Rule Capture — turn repetition into enforced memory

## Overview
When the owner has to say the same thing more than once, the build has failed to remember. This skill captures repeated owner rules as skills, laws, or code gates in the same turn so future agents load them automatically and cannot violate them.

## When to Use
- The owner says "I already told you...", "always...", "never...", "do X before Y", or repeats a constraint.
- You notice yourself about to restate a rule the owner already stated this session.
- A governor or audit report shows high `owner_restatement` counts.

## Core Pattern

1. **Detect repetition.** Note when a rule-like statement appears from the owner.
2. **Draft a skill or law candidate** in the same turn.
3. **Write it immediately.** Do not ask for approval. Place it in the correct skill directory and update `AGENTS.md` if project-specific.
4. **Add a mechanical gate** wherever possible (pre-commit hook, protected-feature check, governor detector, watch rule) so the rule enforces itself.
5. **Run the original task under the new rule**, then verify the rule is loaded next time.

## PLACEMENT LAW (owner, 2026-08-03, after a catastrophic miss — read before capturing anything)

A rule captured in an agent-private surface DOES NOT EXIST for the build. Banned as the primary
(or only) capture location: `~/.claude/projects/*/memory/`, any per-agent memory store, any chat
reply, any new loose markdown file. Those surfaces are invisible to Kimi, Codex, Grok, misc, and
every future session of every model.

The ONLY valid capture placements, in order:
1. **The governing law object** (`functions/_lib/*_law_object.js` — loop, writing, design,
   outreach, skill law) as a numbered clause with the exhibit and date. This projects
   automatically to the live page, the JSON, and the skill.
2. **A shared skill in BOTH trees** (`.claude/skills/` AND `.agents/skills/`) when it is
   procedure rather than law.
3. **Code gate** (check script, pre-commit, API refusal) when it can be enforced mechanically.
4. AGENTS.md / the literal-procedures section of /a/outreach-machinery when it is operator
   ground truth every arriving agent must see before anything else.

An agent-private memory note is permitted only as a POINTER to one of the above, written after
it. **Machinery of the original failure:** the agent harness's own prompt nudges toward its
private memory directory; that nudge is why the wrong decision felt natural. This clause exists
to override that nudge for every model, permanently.

## Rules

- Capture the rule in the same turn it is stated or confirmed.
- **Do not ask the owner for approval to capture a rule.** Approval requests are themselves restatement failures. Write the skill, then tell the owner what you captured.
- Task-only or capture-only is a half-failure: capture, then run the task, then verify the rule is loaded next time.
- A skill candidate must be <500 words and include concrete triggers, not abstract philosophy.
- Do not capture one-off corrections that are specific to a single bug. Capture patterns.
- If a rule can be enforced by code, enforce it by code in the same PR/turn (pre-commit, check script, governor detector, or watch rule).

## Red Flags

- "I keep having to tell you..."
- "Same problem as last time..."
- "Why did you do X again?"
- Writing a long explanation instead of a skill.
- Asking "should I capture this as a skill?"
- Capturing a rule without adding a mechanical gate.

## Verify

After capturing: the next agent session that touches the same topic loads the skill and follows it without the owner restating it.

After adding a gate: run the gate and confirm it blocks the failure mode it was written for.
