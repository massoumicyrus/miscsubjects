// Recent X posts, read from the shared ledger (every X_POST is logged there). Powers the
// homepage "On X" feed so the site stays a running feed, not a static page. Returns the most
// recent successful posts as {url, text, ts}. JSON only; the homepage fetches it same-origin.
//
// These two were deleted from @CannibalCapital directly via the owner's browser (X API
// creds were dead at the time, so the deletion never produced an X_DELETE ledger row to
// filter against). Hardcoded until a real retraction record exists — a feed proving
// liveness must not link a reader to posts that no longer exist.
const MANUALLY_DELETED_X_URLS = new Set([
  "https://x.com/i/web/status/2080749124673302742",
  "https://x.com/i/web/status/2080747385870041543",
]);

export async function onRequestGet({ env }) {
  const empty = () =>
    new Response(JSON.stringify({ posts: [] }), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=120" },
    });
  if (!env.LEDGER) return empty();
  let rows = [];
  try {
    rows =
      (
        await env.LEDGER.prepare(
          "SELECT ts, response_json, response_preview FROM events WHERE key='X_POST' ORDER BY ts DESC LIMIT 60",
        ).all()
      ).results || [];
  } catch {
    return empty();
  }
  const seen = new Set();
  const posts = [];
  for (const r of rows) {
    const raw = r.response_json || r.response_preview || "";
    let obj = null;
    try {
      obj = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!obj || obj.ok !== true || !obj.url) continue;
    if (MANUALLY_DELETED_X_URLS.has(obj.url)) continue;
    if (seen.has(obj.url)) continue;
    seen.add(obj.url);
    // Full text: prefer the requested text, fall back to the returned (t.co-shortened) text.
    const text = String(obj.requested_text || obj.response?.data?.text || "").trim();
    posts.push({ url: obj.url, text, ts: r.ts });
    if (posts.length >= 6) break;
  }
  return new Response(JSON.stringify({ posts }), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=120" },
  });
}
