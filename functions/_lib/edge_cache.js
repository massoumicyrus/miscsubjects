export const ARTICLE_EDGE_CACHE_VERSION = "2026-08-09-public-collaboration-1";

// The exact cache keys the middleware stores a path under: one for browsers, one for the
// lean fetcher copy (see functions/_lib/fetcher_lean.js). Purging must hit both.
export function edgeCacheUrls(pathname, origin = "https://miscsubjects.com") {
  return [
    `${origin}${pathname}?__edge_v=${ARTICLE_EDGE_CACHE_VERSION}`,
    `${origin}${pathname}?__lean=1&__edge_v=${ARTICLE_EDGE_CACHE_VERSION}`,
  ];
}

// Purge everything that can serve a stale copy of one article in the same request as the
// write: the KV last-good snapshots and the versioned edge cache entries (browser + lean).
// indexes:true also clears the index pages that show the article's title/hero.
// cacheStore is injectable for tests; defaults to the runtime edge cache.
export async function purgeArticlePageCache(env, slug, opts = {}) {
  const { origin = "https://miscsubjects.com", indexes = false, cacheStore } = opts;
  const s = String(slug || "").trim();
  if (!s) return;
  if (env?.KV) {
    for (const key of ["lastgood:/a/" + s, "lastgood:/api/articles/" + s]) {
      try { await env.KV.delete(key); } catch {}
    }
  }
  const store = cacheStore || globalThis.caches?.default;
  if (!store) return;
  const paths = ["/a/" + s, ...(indexes ? ["/content", "/latest"] : [])];
  for (const p of paths) {
    for (const u of edgeCacheUrls(p, origin)) {
      try { await store.delete(new Request(u, { method: "GET" })); } catch {}
    }
  }
}
