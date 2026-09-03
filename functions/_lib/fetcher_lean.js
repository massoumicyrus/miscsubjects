// FETCHER LEAN LANE (owner law, 2026-07-24).
//
// The problem it solves, measured: an article page ships ~255KB, of which ~112KB (47%) is
// inline CSS and only ~31KB (12%) is the text a reader or a model actually wants. A browser
// needs that stylesheet. An LLM fetcher or a crawler never renders it — it downloads the
// bytes, then truncates or times out on extraction. That is why web-based models kept failing
// to read pages that were serving fine.
//
// For known model/search fetchers we serve the SAME HTML with presentation stripped:
// <style>, <script>, and stylesheet/preload <link> tags removed. Content and markup are
// byte-identical otherwise, so this is a presentation diet, NOT cloaking — a fetcher and a
// browser read the same words in the same order.

export const FETCHER_UA =
  /(GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|Claude-Web|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|Googlebot|Google-Extended|Bingbot|Applebot|Amazonbot|DuckAssistBot|Bytespider|Meta-ExternalAgent|cohere-ai|YandexBot|facebookexternalhit|Twitterbot|Slurp|python-requests|node-fetch|undici|axios|Go-http-client|okhttp|libwww-perl|Wget|curl)/i;

// A request that should get the lean copy: a declared bot/fetcher, a scripted client, or a
// request with no user-agent at all (never a real browser). `?lean=1` forces it for testing.
export function wantsLean(request, url) {
  try {
    if (url && url.searchParams && url.searchParams.get("lean") === "1") return true;
  } catch {}
  const ua = request.headers.get("user-agent") || "";
  if (!ua.trim()) return true;
  return FETCHER_UA.test(ua);
}

export function leanHtml(html) {
  return String(html)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b(?![^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi, "")
    .replace(/<link\b[^>]*rel=["']?preload["']?[^>]*>/gi, "")
    .replace(/\n{3,}/g, "\n\n");
}

// JSON-LD is deliberately preserved: it is the structured data crawlers came for.
export async function leanResponse(res) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return res;
    const html = await res.text();
    const headers = new Headers(res.headers);
    headers.delete("content-length");
    headers.set("x-ms-lean", "1");
    // A lean copy must never enter Cloudflare's edge cache under the bare URL: the edge does
    // not vary on user-agent, so a cached lean copy outlives every per-div write and gets
    // served stale to fetcher UAs while browsers see the fresh page (reproduced live
    // 2026-08-08 on /a/philosophy: curl UA got the pre-edit page with cf-cache-status HIT
    // after the write-path purge and a version bump had both landed). The versioned
    // caches.default entry is the only sanctioned cache for rendered articles.
    headers.set("cache-control", "no-store");
    return new Response(leanHtml(html), {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  } catch {
    return res;
  }
}
