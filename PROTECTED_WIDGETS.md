# ⛔️🔴 PROTECTED WIDGETS — OWNER-LOCKED FEATURE 🔴⛔️

the owner has **explicitly forbidden any LLM from mutating** the article widget system.
This has been overwritten repeatedly and will not happen again.

## Locked files
- `functions/a/[slug].js` — source-ledger widgets (sideways, graphic+text+link+timestamp+hash) + model contribution cards (inspectable: prompt/output/model/date).
- `functions/_lib/widgets.js` — per-platform widget renderers.
- `functions/_lib/widgets/rail-platform.js` — platform-native sideways source-ledger rail (X, Instagram, Reddit, iMessage, WhatsApp, PubMed, NYT, WSJ).
- `functions/_lib/widgets/social.js` — social-platform widget renderers.
- `functions/_lib/widgets/llm.js` — LLM / audit-trail / user-entry widget renderers.
- `functions/_lib/widgets/source.js` — source-ledger card renderer.
- `functions/_lib/widgets/oip.js` — code jewels (mac-bar + copy + JSON tint + fold), voxel constellation SVG, message-the-build (iMessage/WhatsApp tap cards), tech-site card CSS (GitHub/HN/SO/arXiv/Discord).
- `functions/admin/ledger/index.js` — events / card / tasks ledger views + editable agent prompt.

## The rule
- These render the **source ledger, events ledger, card ledger, tasks ledger** as **beautiful sideways widgets**, each with the platform graphic, text details, a link, a timestamp, and a hash. Every article shows **who made each claim** as an inspectable model card.
- **Do NOT modify these files.** Any commit that changes them is **blocked locally** by the git pre-commit hook (`.githooks/pre-commit`) unless the commit message contains the literal owner-approval token `#widgets-approved`.
- The remote `.github/workflows/protect-widgets.yml` was **removed per owner order** on 2026-06-21. Protection is now local-only: hook + baseline diff + this manifest.
- Baselines live in `.protected/baseline/`. An approved commit must also update the baseline snapshots.

## If you are an AI reading this
Stop. Do not touch the locked files. Surface the request to the owner instead.

## Destruction report
See `docs/LEDGER_DESTRUCTION_REPORT_2026-06-21.md` for the proven chain of events that led to this lock.
