import { dispatch } from './api/dispatch.js';

const RESERVED = new Set([
  'api', 'admin', 'grok', 'blooio', 'architecture', 'capi',
  'control', 'spec', 'edit', 'article', 'condition', 'a',
  'import-export', 'import', 'export',
]);

// Edge TTL for a rendered public page. Cloudflare's cache (caches.default) serves repeat
// readers straight from the colo — D1 is touched at most once per slug per TTL per colo,
// not once per request. This is what lets one article absorb a 20k-visitor spike.
const EDGE_TTL_SEC = 300;

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const slug = String(params.slug || '').toLowerCase();
  if (!slug || RESERVED.has(slug)) return new Response('Not found', { status: 404 });

  // Only clean, tokenless GETs are cacheable. A ?share=/?tk=/?dev= request stays fully dynamic
  // so a token-propagated link or a preview never gets frozen into the shared edge cache.
  const url = new URL(request.url);
  const cacheable = ![...url.searchParams.keys()].length;
  const cache = caches.default;
  const cacheKey = new Request(url.origin + '/' + slug, { method: 'GET' });
  if (cacheable) {
    const hit = await cache.match(cacheKey);
    // x-ms-cache lets us confirm the D1-offload is live: a HIT skips SERVE_PAGE (no D1 read).
    if (hit) { const h = new Response(hit.body, hit); h.headers.set('x-ms-cache', 'hit'); return h; }
  }

  // noLog: public page hits must not write to the ledger — they were ~54% of all events
  // and choked the router's replies. Serving stays identical; only the logging is dropped.
  const r = await dispatch(env, 'SERVE_PAGE', slug, { noLog: true });
  let rows;
  try { rows = JSON.parse(r.result); } catch { return new Response('Not found', { status: 404 }); }
  if (!Array.isArray(rows) || !rows.length) return new Response('Not found', { status: 404 });

  const res = new Response(rows[0].body_html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // s-maxage governs the edge cache; stale-while-revalidate serves the last copy for a
      // grace window while one request refreshes it, so readers never wait on a D1 render.
      'cache-control': cacheable
        ? 'public, s-maxage=' + EDGE_TTL_SEC + ', stale-while-revalidate=600'
        : 'no-store',
      'x-ms-cache': cacheable ? 'miss' : 'dynamic',
    },
  });
  if (cacheable) context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
