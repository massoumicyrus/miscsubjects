// SEO distribution — tells search infrastructure that a page changed, the moment it changes.
//
// Two free, credential-less protocols:
//   IndexNow (Bing, Yandex, Seznam, Naver — and the shared IndexNow pool) — the key file is
//   already served at /1bb4a4b345e9c5923297801efb87e3dc.txt; until now nothing ever pinged it,
//   so the key existed and did nothing.
//   WebSub (Google's open hub) — tells feed subscribers /feed.xml has a new entry, instead of
//   waiting for their next poll.
//
// CURATION LAW (owner-set, same gate as /sitemap.xml, /feed.xml, /llms.txt): only the
// defensible, sourced spine is submitted to search engines. A ping for a slug outside the
// spine is refused here, so no write path can accidentally submit the unsourced corpus.
// Membership is checked against the same source the sitemap renders from — never a copy.

import { listOipArticleSummaries } from "./oip_articles.js";

const SITE = "https://miscsubjects.com";
const HOST = "miscsubjects.com";
const INDEXNOW_KEY = "1bb4a4b345e9c5923297801efb87e3dc";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const WEBSUB_HUB = "https://pubsubhubbub.appspot.com/";
const PING_TIMEOUT_MS = 2000;

async function fetchQuiet(url, init) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), PING_TIMEOUT_MS);
    const res = await fetch(url, { ...init, signal: ctl.signal });
    clearTimeout(timer);
    return res.status;
  } catch {
    return 0;
  }
}

/** True when this slug is part of the search-submittable spine — the exact set the sitemap serves. */
export async function isSearchSubmittable(env, slug) {
  const s = String(slug || "").toLowerCase();
  if (!s) return false;
  try {
    const spine = await listOipArticleSummaries(env, true);
    return spine.some((a) => a && a.slug === s);
  } catch {
    return false;
  }
}

/** Submit URLs to IndexNow and publish the feed to the WebSub hub. Never throws. */
export async function pingSearchEngines(urls) {
  const list = (Array.isArray(urls) ? urls : [urls])
    .map((u) => String(u || "").trim())
    .filter((u) => u.startsWith(SITE))
    .slice(0, 100);
  if (!list.length) return { pinged: false };
  const indexnow = await fetchQuiet(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
      urlList: list,
    }),
  });
  const websub = await fetchQuiet(WEBSUB_HUB, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "hub.mode=publish&hub.url=" + encodeURIComponent(`${SITE}/feed.xml`),
  });
  return { pinged: true, indexnow, websub, urls: list };
}

/**
 * The one call a write path makes. Curation-law gated, bounded to two 2s pings, and it
 * never throws and never fails the write that triggered it.
 */
export async function notifyArticleChanged(env, slug) {
  try {
    if (!(await isSearchSubmittable(env, slug))) return { pinged: false, reason: "outside_spine" };
    return await pingSearchEngines([
      `${SITE}/a/${encodeURIComponent(String(slug).toLowerCase())}`,
      `${SITE}/sitemap.xml`,
    ]);
  } catch {
    return { pinged: false, reason: "error" };
  }
}
