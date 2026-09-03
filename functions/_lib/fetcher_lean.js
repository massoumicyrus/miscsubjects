
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
