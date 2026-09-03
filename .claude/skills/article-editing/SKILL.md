---
name: article-editing
description: Use when creating, editing, sourcing, illustrating, exporting, or deleting any article on miscsubjects.com — from the admin studio, curl, a coding agent, a Cloudflare Gateway model, or Google Sheets. One REST contract for all of them.
---

# Article editing — the one contract

Every article on miscsubjects.com is one row in one table, reachable through one REST API.
The admin studio (`/admin/articles`), the public page's admin bar, curl, coding agents,
Gateway models, and the Google Sheets poller are all clients of the same verbs. There is
no second write path. If you are about to write an article any other way, stop and use this.

## The verbs

| Action | Call |
|---|---|
| List + filter | `GET /api/articles?q=&tag=&category=&status=&model=&has_hero=1&register=all&limit=250` |
| Read | `GET /api/articles/<slug>` — full object; `?format=post` = the exact re-postable body; `?rev=N` = an old revision |
| Create / replace | `PUT /api/articles/<slug>` body `{"title","body","tags":[],"category","register","status","hero","claims":[],"sources":[],"replace":true,"prov":{"model":"<you>","action":"write"}}` |
| Surgical edit | `PATCH /api/articles/<slug>` body `{"find":"<exact>","replace":"<new>","expected_hash":"<sha256 of the body you read>"}` — 409 on concurrent edit, 422 on 0 or ambiguous matches |
| Whole-body edit | `PATCH /api/articles/<slug>` body `{"body":"<new body>","expected_hash":"<the body_hash your GET returned>"}` — expected_hash is REQUIRED (428 without it); 409 hash_mismatch means another agent shipped since your read: re-read, merge into the current body, resend with the new hash. Never resend your original body over a moved head. |
| Append a source | `POST /api/articles/<slug>/webhook` body `{"kind":"source","data":{"url","title","quote","claim_ids":[]}}` (also kinds: claim, widget, provenance, contribution, review) |
| Model rewrite | `POST /api/articles/<slug>/rewrite` body `{"find","instruction","model":"workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast"}` — returns the proposal + the exact PATCH that applies it; nothing is applied until you send that PATCH |
| Delete | `DELETE /api/articles/<slug>` (immutable slugs refuse; retract via `status`) |
| Download one | `GET /api/articles/export?slug=<slug>` (.md attachment) |
| Download a set | `GET /api/articles/export?tag=<tag>` or `?category=<cat>` or `?all=1` |
| Object folder | `GET /api/articles/<slug>/bundle?format=zip` (markdown + json + skill + manifest) |
| Revisions | `GET /api/articles/<slug>/revisions`; restore = `GET ?rev=N` then `PUT` its fields back |

## Auth — one token, every transport

There is ONE token format. Present it any of three ways — they are interchangeable by design,
so a browser-based model and its curl fallback never diverge:

- browser URL: append `?share=<token>`
- curl: header `Authorization: Bearer <token>`
- legacy header: `x-write-token: <token>`

Validate any token, either transport: `GET /api/token/validate?share=<token>` or
`curl /api/token/validate -H 'Authorization: Bearer <token>'` — returns scope, expiry,
exactly what it permits, and its revoke + ledger links.

Scopes: **act** = read + write (search the directory, read any article, PUT/PATCH/DELETE it,
append sources, invoke any capability — the write gate is satisfied). **row:/rows:/pfx:** =
the same token format attenuated to named capabilities. Owner mints:
`GET /api/dispatch?mint_share=1&scope=act` (with the owner key or admin cookie).

Other lanes that still work: the owner's `/admin/login` cookie (studio + admin bar);
`x-terminal-key` for the owner's own terminal; and a model holding NOTHING can still earn a
prose write by reading the live law — `GET /api/write-gate/challenge` → answer → token.

## Writing a new article — the short path

1. `GET /api/articles/writing-law/skill` — the live writing law. Follow it.
2. Draft first: `PUT /api/articles/<slug>` with `"draft": true` — invisible everywhere public until you publish.
3. Sources as you go: one `POST /webhook {"kind":"source"}` per source. Embed any of them inline in the body with `[[embed:source:sN]]` — the page renders a full source card at that spot. Other inline shortcodes: `[[embed:<other-article-slug>]]` embeds an article card.
4. Claims: include `claims:[{id,text,section,tier,source_ids}]` in the PUT — claims are the atomized, checkable objects; tiers and source links render on the page.
5. Hero image: generate through the build's image pipeline (`/admin/generate`, or the image-to-R2 capability in the directory), take the returned `https://miscsubjects.com/img/gen/...` URL, set it as `hero`.
6. Publish: `PUT` again with `"draft": false` (or just without draft). Sign your provenance: `prov.model` is never omitted.
7. Verify: open `https://miscsubjects.com/a/<slug>` and `GET /api/articles/<slug>/health`.

## Guardrails you will hit (they are features)

- `shrink_guard` 409 — you replaced a 2k+ body with something under 40% its size without `"replace":true`.
- `write gate` 428 — you wrote prose without a token; follow the challenge in the response.
- `find_not_present` / `find_ambiguous` 422 — your PATCH `find` must be an exact, unique substring.
- `hash_mismatch` 409 — someone edited between your read and write; re-read and re-target.
- `register_refused` 422 — test titles, model self-introductions, and hashtag blocks never publish.
- `corpus_freeze` 423 — canonical corpus pages are owner-locked; contribute claims/sources/objections instead.

## Why some articles have DIVs and some don't

DIV/voxel structure (`GET /api/articles/<slug>/voxels`) is generated from `claims` in meta.
An article with atomized claims has addressable DIVs, hashes, and a challengeable surface;
an article that is only prose does not. To give a prose article DIVs, add claims
(`POST /webhook {"kind":"claim"}` or `claims:[]` on PUT) — never a parallel format.

## Interfaces over this contract

- **Directory**: every article is simultaneously a directory object. Search: `GET /api/directory/search?q=<words>` returns `article:<slug>` projections; `GET /api/directory/article:<slug>` resolves to the canonical article with its verbs (no content is duplicated); opening `article:<slug>` in the admin directory lands on the article editor.
- **Admin studio**: `/admin/articles` (list, filter, create) and `/admin/articles/<slug>` (edit everything; every button prints its REST + curl).
- **On-page admin bar**: when logged in, every `/a/<slug>` page shows Edit / Admin / View as guest / Log out, bottom-right.
- **Google Sheets**: `operator-console/Articles.js` polls AND pushes through this same API — but its push lane truncates bodies at 45,000 chars before a full PUT. Do not bulk-push from Sheets until the truncation guard lands.
- **Everything downloadable**: article, tag, category, or whole library as one .md; any object as a .zip folder.

Update this skill whenever the API changes: edit `.claude/skills/article-editing/SKILL.md`
and its sibling in `.agents/skills/`, then run `node scripts/sync_skill_pages.mjs` — the
live page at `/skills/article-editing` regenerates from these files.
