// miscsubjects.com/robots.txt — served by this Worker via a zone route, which takes
// precedence over both public/robots.txt and functions/robots.txt.js. Those two were made
// permissive on 2026-07-24 while THIS file still restricted GPTBot and OAI-SearchBot to
// /api/, so OpenAI's crawlers were forbidden from every article page. One source of truth:
// keep this body identical to public/robots.txt.
const BODY = `# miscsubjects.com — open to search engines and AI models.
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

export default {
  fetch() {
    return new Response(BODY, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=300, must-revalidate",
      },
    });
  },
};
