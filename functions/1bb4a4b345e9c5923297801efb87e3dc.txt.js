// https://miscsubjects.com/1bb4a4b345e9c5923297801efb87e3dc.txt — IndexNow key verification file.
// Served as a Function (not a static asset) because the middleware's
// article-not-found fallback swallows bare root-level static files.
export function onRequestGet() {
  return new Response("1bb4a4b345e9c5923297801efb87e3dc", {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
