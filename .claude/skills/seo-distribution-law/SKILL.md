---
name: seo-distribution-law
description: Use when writing, reviewing, or shipping anything that affects how this site is found, indexed, shared, or syndicated — SEO heads, sitemaps, feeds, share surfaces, network posting, or the self-score. The site's perception of search and distribution best practices lives here, is enforced live at /api/seo/score, and is open to critique; never assert a practice from memory when this file and that endpoint disagree.
---

# SEO & Distribution Law — the site's auditable perception of how to reach the world

## The disclosure

This site is trying to reach the world. That intent is not implied by its behavior — it is
stated here, versioned in this file, enforced mechanically at a public endpoint, and open to
critique by any reader, human or model. What this site believes about being found is exactly
the list below; if the belief is wrong, the place to say so is the comment door, and the fix
lands here first.

## The mechanical gate

`GET https://miscsubjects.com/api/seo/score` — the site fetches its own live surfaces and
grades itself against every practice in this file, returning per-check evidence a visitor can
re-run. Gaps the site knows about and has not closed are returned as `declared_gaps`, not
hidden. The channel inventory (installed vs. installable, with the credential each needs)
lives at `GET https://miscsubjects.com/api/syndication`. Arguing with any of it takes two
calls at the comment door: mint a keyless token, write the critique onto any article, and the
build answers in the thread.

- Self-score: https://miscsubjects.com/api/seo/score
- Channel inventory: https://miscsubjects.com/api/syndication
- Critique door: https://miscsubjects.com/api/comments

## The practices this site holds itself to

Each line names its outside source. A practice with no source is an opinion and does not
belong in this list.

**Being understood by engines**
1. Every public page carries canonical, meta description, Open Graph, and Twitter card —
   a share that renders as a bare link is a lost referral. (https://ogp.me/,
   https://developer.x.com/en/docs/x-for-websites/cards/overview/abouts-cards)
2. Every article carries typed JSON-LD (Article / TechArticle / MedicalWebPage) with
   citations and a BreadcrumbList; the homepage carries WebSite + SearchAction.
   (https://developers.google.com/search/docs/appearance/structured-data/article)
3. robots.txt admits search and AI crawlers alike; llms.txt serves the model-native
   self-description. Being read by models is a distribution lane, not a threat.
   (https://llmstxt.org/)

**Being found fast**
4. The sitemap includes the root and submits only the sourced spine — curation beats volume;
   two thousand thin pages read as a content farm and poison the sharp set.
   (https://www.sitemaps.org/protocol.html, owner curation law in functions/sitemap.xml.js)
5. Change is announced, never awaited: IndexNow on every publish/edit/delete of a spine page,
   WebSub push on the feed. The key file existed for months while nothing pinged it — plumbing
   without a caller is the same as no plumbing. (https://www.indexnow.org/documentation,
   https://www.w3.org/TR/websub/)
6. Every public HTML surface states an explicit cache-control policy; timestamps never lie
   (a lastmod that says "changed daily" on every page teaches engines to distrust the site).
   (https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)

**Being carried by people**
7. Every article shows a visible share row for the majors — X, LinkedIn, Facebook, Reddit,
   Hacker News, Pinterest (hero as pin image), WhatsApp, Telegram, email — as plain intent
   URLs, no SDK, nothing loaded before the reader chooses. Social referral is a first-class
   traffic lane, not a garnish.
8. Every article carries an open signed comment thread. Criticism on the page is
   distribution: it is the reason a model or reader links back.
9. Network posting follows the network's own physics: Pinterest is a search engine (pins
   compound for months), Reddit and HN punish automation (operate, don't post blindly),
   TikTok/YouTube require video the site does not yet produce (a declared gap, not a secret),
   X/LinkedIn reward the argument in the post with the link behind it.

**Being honest about the loop**
10. Announce lanes without read-back are half a loop: Search Console and Bing Webmaster
    read-back comes before adding more announce lanes. Until wired, the site says it is
    publishing blind — in its own self-score.

## Exhibits (why this skill exists)

- 2026-08-06: the IndexNow key file had been served since June with no caller — discovered
  only during a full audit. Practice 5 and the /api/seo/score check `indexnow_key` exist so
  that class of dead plumbing cannot sit invisible again.
- 2026-08-06: the homepage carried no Open Graph, no Twitter card, no canonical — while every
  article did. Practice 1 now covers *every public page* and the check `home_social_identity`
  refuses the drift.
- 2026-08-06, owner order: distribution strategy that came back "Bluesky and Mastodon" when
  the question was the majors. Practice 9 and the ranked `next_by_leverage` list in
  /api/syndication exist so the answer starts from traffic physics, not from what is easiest
  to wire.

## Operating rule

Before shipping any change to discovery, sharing, or syndication surfaces: run the self-score,
ship only if the score does not drop, and update this file and the score endpoint together —
they are one object in two projections. A practice changed here without its check, or a check
added without its practice, is drift.
