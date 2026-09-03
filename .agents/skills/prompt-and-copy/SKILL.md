---
name: prompt-and-copy
description: Write and revise the PROMPTS that generate outreach/marketing copy, and review the copy they produce. Load when editing OUTREACH_DOSSIER, the leadsDraftAI prompt, any email/ad/landing generator prompt, or when judging whether generated copy is good. Pairs with write-human, business-email, cold-outreach-craft, sales-copy-ruo.
---

# Prompt writing + copy review (for the outreach machine)

Two jobs: (1) write the system/user prompts that make a model produce good copy, and (2) judge the output. The copy rules live in `sales-copy-ruo`, `write-human`, `business-email`, `cold-outreach-craft` — this skill is about the prompt layer that enforces them and the review that catches failures.

## Where the copy actually comes from (know the layers)

A generated email is shaped by, in priority order:
1. **`OUTREACH_DOSSIER`** directory row — the SYSTEM prompt. Highest authority. If the output is wrong (wrong salutation, wrong subject convention, wrong catalog), the fix is almost always HERE, not in the user prompt. A conflicting line in the dossier overrides every rule in the user prompt.
2. The **user prompt** inside `leadsDraftAI` (functions/_lib/fn_runners.js) — per-lead instructions.
3. **`OUTREACH_CATALOG`** directory row — the price/product source of truth. Never hardcode prices in a prompt or in copy; read them from here.
4. The **skills** — the human reference and the rules the prompt should mirror.

Rule: when generated copy violates a rule, check the dossier FIRST. A rule added only to the user prompt while the dossier still says the opposite will lose.

## Writing a generation prompt

- **State the artifact and the reader in the first line.** "Write ONE professional B2B wholesale email to a clinic owner." Not "write an email."
- **Rules as numbered imperatives**, each testable: "Salutation is 'Hello,' — never 'Hi <business> team'." A rule you can't check after the fact is decoration.
- **Show the exact bad pattern you're banning**, verbatim, with the word NEVER. Models repeat prior patterns; you have to name the specific string to kill it ("NEVER 'Came across <business> —'", "NEVER 'reply wholesale'").
- **Put the data in the prompt, not a description of it.** Inject the actual catalog block; say "include this verbatim." Don't say "mention the catalog."
- **Give enough output budget.** A prompt that says "list all 11 items" with a 700-token cap truncates. Size the budget to the required output.
- **One source of truth per fact.** Prices from OUTREACH_CATALOG; voice from the dossier. Don't restate a price in three places — they drift.
- **Ground against the live product.** Before trusting a prompt's facts (warehouse city, discount structure, SKU count), verify against the real site. A prompt confidently generating wrong facts is worse than no prompt.

## Reviewing generated copy — the failure checklist

Reject and regenerate if any is true:
- Salutation is "Hi <business> team" / "Hi team at <business>" (mail-merge tell).
- Subject starts "Came across …" (scrape tell).
- Offers to "send the sheet / price list" instead of including it.
- Trims the catalog to 2-3 items when the instruction was the full list.
- Any clinical/dosing/treatment/efficacy/recovery/outcome language (RUO violation).
- A personal human name in the body or signature.
- Invented item or price not in OUTREACH_CATALOG; GLP names written out instead of coded.
- Hype words (cutting-edge, revolutionize, elevate, seamless), exclamation points, em-dash pile-up.
- Facts that contradict the live site (warehouse city, discount tiers, SKU count).

## Iterating honestly

- Change ONE layer at a time (dossier OR user prompt), regenerate, diff the output. Two changes at once and you can't tell which worked.
- Keep the strong lines. When a prior version had a good block (a clean economics line, a real observation), preserve it as an option — don't overwrite the whole body to fix one flaw. Modular blocks beat monolithic rewrites (see the copy-blocks reference).
- After a fix lands, regenerate a real sample and read it aloud before claiming it's fixed. Prompt edited ≠ output fixed.

## Verify before claiming

A prompt or dossier edit is not done until you regenerated a draft on a real lead and confirmed the output changed the way you intended. Show the regenerated sample. "I updated the prompt" is not evidence; the corrected output is.
