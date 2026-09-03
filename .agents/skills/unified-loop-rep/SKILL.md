---
name: unified-loop-rep
description: Run one full rep of the unified loop — article → letter → tracked send → widget receipt → X post → ledger. Load whenever executing the loop (owner law, 2026-07-30). The rep is a machine; every step is mechanical and receipted.
---

# One rep of the unified loop

The loop (owner law, CLAUDE.md §THE UNIFIED LOOP): demonstrate → document → post → outreach → learn → fix. This skill is the per-rep procedure. Life is about reps.

THE DOCTRINE LIVES AT https://miscsubjects.com/a/loop-law (source: functions/_lib/loop_law_object.js; model form: /api/articles/loop-law?format=skill). Load it FIRST — it is the full orientation (selection, formats, widgets, quality bars, failure modes, repair path). Subject selection is no longer manual: GET https://miscsubjects.com/api/articles/next-acts ranks the queue (missing wikilinked pages, open challenges, unsourced claims, stale hubs, unread replies, quiet classes); GET /api/articles/graph-lint is the health pass to run after every publish. A correction from the owner amends the loop-law object with the exhibit attached, then the instance gets fixed.

## The rep, in order — no step optional, no step reordered

1. **PICK** the next target from `CONTENT_PLAN.md` (repo root). A target = a party class + its regulatory instrument + the receipt(s) that ground it. If the plan is empty, refill it from the ranked queue in STATE.md before doing anything else.

2. **ARTICLE** — definitive depth (11–15k chars, ~10 claims, ~6–8 sources, all real receipts, `[[embed:source:sN]]` in place). Accuracy bounds are law: "three seats across two model families"; calibration numbers exactly as published (/a/adjudication-calibration-study); every conformance claim is "candidate"/"shaped to provide"; a "What is not satisfied" section; professional decorum. Ends with `## Submit a case` then `## The canonical class letter` (exact shape: salutation slot, observation slot, AI-authorship disclosure, receipts inline, provenance note, closing exactly `Yours in civilization,\n\nbuild@miscsubjects.com\n— Fable 5, via CLI authority`). Register: `technical` (mode "article" replaces stored bodies when sources ≥ 5 — publish defect, found 2026-07-30).

3. **HERO** — ARCADS_GENERATE. OWNER LAW (2026-08-01, restated in anger twice): NO art-style prompts — never "engraving", "19th-century", "copperplate", "Victorian", period dressing, or allegorical scenes; the owner calls these insane thumbnails that make the whole site ugly. Instead: think about what the article is actually about and what an INTERESTING image for it would be, then describe that image plainly and at whatever length it needs — the way you would brief GPT ("make a featured image for an article about ..."). Literal subject matter, photorealistic, magazine-feature quality (approved example: a real chest X-ray with a visible mass on an article about whether a model's answer was right). ALWAYS download and LOOK at the rendered image before setting it as hero; ugly or off-subject = regenerate, never ship. `gpt-image|<the brief>|16:9` → ARCADS_TO_R2 → set `article.hero`.

4. **LINK** — one line on /a/the-build-end-to-end near the other use-case rows.

5. **LEAD** — one named individual with a real published artifact (paper, audit practice, testimony, product) that names the exact obligation the article addresses. Verify the person, the artifact, and the email (published format or their own CV/site). Never "Dear Team". The observation sentence must be specific enough that it could fit no other person.

6. **SEND** — `node scripts/send_letter.mjs <letter.json>` — the rep machine: mints the hashed letter object page, sends via EMAIL_SEND_TRACKED (HTML letter format, from_name "miscsubjects build", open pixel + click wrap), owner copy ledgered server-side (EMAIL_OWNER_COPY — verify the event exists after every send), appends the letter to the article as an EMAIL WIDGET (source type `email`), prints the X payload. GATE: external sends require owner authorization; the standing authorization is one send per new class on the established pattern — anything beyond that, ask once.

7. **X POST** — FIRST search X for the recipient and their organization (X_SEARCH for the person's name and the org name; a handle is verified when it appears in results as the actual account). Tag the PERSON and the ORG when verified — both when both exist; the un-tagged name only when search finds nothing. Tell them they were emailed, link the ARTICLE, lead with one juicy zero-context fact, one niche hashtag. Six booleans (writing-law social family). ≤280 with link + signature `— Fable 5 (Claude)`. The X lane 401s on rate windows — queue and retry, never drop.

8. **LEDGER + STATE** — the send is in email_sends (open/click visible via EMAILS_SENT); append the rep to STATE.md (target, article URL, letter object URL, send id, post id); cross off the CONTENT_PLAN.md row; commit as owner.

9. **LEARN** — check EMAILS_SENT opens/clicks and build@ replies each session start; a reply or its absence updates the class prior; record what changed on the article's receipt section.

## Known defects to watch
- PAGES_PUT intermittently 500s on first try — retry once with simplified HTML.
- X_POST 401 = rate window, retry later.
- Dispatch KV/R2 PUT truncates ~4.8k — law text lives in git + articles only.

## PUBLISHED-VERSION CHECK (owner law, 2026-08-02 — after a claims digest silently replaced an authored body at render)
- After EVERY article publish: fetch the rendered page `https://miscsubjects.com/a/<slug>` and confirm a distinctive phrase from the stored body appears in the HTML. "System notes" appearing when the body doesn't carry it = the composer replaced the body = shipped failure, even on a 200.
- The API echoing the body back proves storage, NOT the reader's page. CHECK MY VIEW means the /a/ page.
- Mechanical gate: scripts/check-authored-render.mjs (runs inside scripts/ship.mjs step 5, and standalone). The renderer-side fix: bodyNeedsReaderProse can no longer condemn any body ≥ 2800 chars, and flagship articles carry prefer_stored:true.

## THE LAWS LIVE ON THE SITE, NOT IN THIS FILE (owner, 2026-08-02)
- The authoritative rules are the live law objects, linked in the site footer, and their source of truth is code:
  - Writing law — https://miscsubjects.com/writing-law — `functions/_lib/writing_law_object.js`
  - Design law — https://miscsubjects.com/design-law — `functions/_lib/design_law*.js`
  - Skill law — https://miscsubjects.com/skill-law
- READ THOSE PAGES before writing any title, body, or image prompt. A correction from the owner is written INTO the law object as a numbered clause — never as prose appended to a skill file, never only in a memory file. Writing a rule anywhere else is recording it in the wrong place, which guarantees the owner has to repeat it.
