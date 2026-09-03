// https://miscsubjects.com/robots.txt
// Self-describing API (/api/handoff, /api/dispatch, /api/articles) must be fetchable by model web_fetch.

export function onRequestGet() {
  const body = `# miscsubjects.com — open to search engines and AI models.
# Machine-readable entry points: /llms.txt  /sitemap.xml  /api/handoff  /api/dispatch  /api/articles
# Everything readable is crawlable. Only the private admin backend is closed.

User-agent: *
Allow: /
Disallow: /admin/

# --- AI model crawlers & assistants (full read access) ---
User-agent: ClaudeBot
Allow: /
Disallow: /admin/

User-agent: Claude-Web
Allow: /
Disallow: /admin/

User-agent: Claude-SearchBot
Allow: /
Disallow: /admin/

User-agent: anthropic-ai
Allow: /
Disallow: /admin/

User-agent: GPTBot
Allow: /
Disallow: /admin/

User-agent: ChatGPT-User
Allow: /
Disallow: /admin/

User-agent: OAI-SearchBot
Allow: /
Disallow: /admin/

User-agent: Google-Extended
Allow: /
Disallow: /admin/

User-agent: PerplexityBot
Allow: /
Disallow: /admin/

User-agent: Perplexity-User
Allow: /
Disallow: /admin/

User-agent: Applebot
Allow: /
Disallow: /admin/

User-agent: Applebot-Extended
Allow: /
Disallow: /admin/

User-agent: Amazonbot
Allow: /
Disallow: /admin/

User-agent: cohere-ai
Allow: /
Disallow: /admin/

User-agent: Meta-ExternalAgent
Allow: /
Disallow: /admin/

User-agent: DuckAssistBot
Allow: /
Disallow: /admin/

User-agent: Bytespider
Allow: /
Disallow: /admin/

User-agent: YandexAdditional
Allow: /
Disallow: /admin/

# --- Search-engine crawlers ---
User-agent: Googlebot
Allow: /
Disallow: /admin/

User-agent: Bingbot
Allow: /
Disallow: /admin/

User-agent: DuckDuckBot
Allow: /
Disallow: /admin/

User-agent: Slurp
Allow: /
Disallow: /admin/

User-agent: YandexBot
Allow: /
Disallow: /admin/

Sitemap: https://miscsubjects.com/sitemap.xml
`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=60, must-revalidate",
      "cdn-cache-control": "max-age=60",
    },
  });
}