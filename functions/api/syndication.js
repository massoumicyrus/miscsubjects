
const SITE = "https://miscsubjects.com";

const INSTALLED = [
  {
    channel: "X (Twitter)",
    what: "Posts and threads publish to @<x-handle> via the build's X_POST tool; every post is a ledger row.",
    surfaces: [`${SITE}/api/x-posts`, `${SITE}/.claude/skills — post-to-x`],
    automatic: false,
    note: "Posting is operator-triggered per the self-promotion law, not fired blindly on every publish.",
  },
  {
    channel: "RSS 2.0",
    what: "Aggregators and AI ingest pipelines poll the spine feed.",
    surfaces: [`${SITE}/feed.xml`],
    automatic: true,
  },
  {
    channel: "WebSub (PubSubHubbub)",
    what: "Feed subscribers are pushed on publish instead of polling — the article write path pings the Google hub.",
    surfaces: [`${SITE}/feed.xml`, "functions/_lib/seo_distribution.js"],
    automatic: true,
  },
  {
    channel: "IndexNow (Bing, Yandex, Seznam, Naver)",
    what: "Search engines are told the moment a spine page changes, is created, or is deleted.",
    surfaces: [`${SITE}/1bb4a4b345e9c5923297801efb87e3dc.txt`, "functions/_lib/seo_distribution.js"],
    automatic: true,
  },
  {
    channel: "Sitemap + robots + llms.txt",
    what: "Crawler discovery: the curated spine for search engines, full crawl permission for AI models.",
    surfaces: [`${SITE}/sitemap.xml`, `${SITE}/robots.txt`, `${SITE}/llms.txt`],
    automatic: true,
  },
  {
    channel: "Per-article machine bundles",
    what: "Every article ships as JSON and markdown a model can ingest whole — the deepest syndication surface on the site.",
    surfaces: [`${SITE}/api/articles/<slug>/bundle`, `${SITE}/api/articles/<slug>/bundle?format=markdown`],
    automatic: true,
  },
  {
    channel: "Email (Klaviyo)",
    what: "Campaigns and flows to subscribed profiles, operated through the owner's connected Klaviyo account.",
    surfaces: ["Klaviyo MCP (session-side)"],
    automatic: false,
  },
  {
    channel: "On-page share widgets",
    what: "Every article carries a visible share row (X, LinkedIn, Facebook, Reddit, Hacker News, Pinterest with the hero as pin image, WhatsApp, Telegram, email, copy link) plus a floating panel with native device share and copy-for-LLM — no third-party SDK.",
    surfaces: [`${SITE}/a/<slug>`],
    automatic: true,
  },
];

// Ordered by traffic leverage for THIS site's content (text + hero images, no video yet),
// majors first. "playbook" is what actually moves traffic on that network — the practice,
// not just the API. Sources for the practices live in the skill: /skills/seo-distribution-law.
const AVAILABLE = [
  { network: "Pinterest", api: "Pins API v5 (pins.create) + Rich Pins", needs: "business account + OAuth app; Rich Pins need one-time validation", free: true,
    playbook: "The sleeper for this corpus: Pinterest is a search engine, not a feed — a pin keeps surfacing for months while a TikTok dies in 48 hours. The article OG tags already qualify every page for Rich Pins (auto-synced metadata); validate once, then auto-pin each article's hero (2:3 vertical works best) with the title as description. The on-page Pinterest share button is already live." },
  { network: "Facebook Page", api: "Graph API /page/feed", needs: "Meta app + page access token + app review (pages_manage_posts)", free: true,
    playbook: "Link posts inherit the OG card, which every article now carries. A page posting every publish builds the crawlable public presence Meta's ranking rewards; groups in the subject niches are where the referral traffic actually is, and those are operated, not automated." },
  { network: "Instagram", api: "Graph API content publishing (/media + /media_publish)", needs: "IG professional account bound to a FB page + Meta app review", free: true,
    playbook: "Image-first: the hero corpus can feed a grid (1080×1350 crops), but IG sends traffic only through bio link and stories links — treat it as brand surface, and cross-post pins automatically once Pinterest is wired." },
  { network: "Threads", api: "Threads API (threads_content_publish)", needs: "same Meta credential family as Instagram", free: true,
    playbook: "Text-first and link-tolerant; the same post composed for X publishes here with one extra call once the Meta app exists." },
  { network: "TikTok", api: "Content Posting API (direct post)", needs: "TikTok developer app + audited approval + video content", free: true,
    playbook: "Highest raw reach, zero fit until the site produces video. The honest play: short screen-capture explainers of the live objects (the ledger, the self-audit) — novel enough to carry. Until video exists this lane is closed and the site says so in its self-score." },
  { network: "X (Twitter) API automation", api: "POST /2/tweets", needs: "already installed — X_POST tool posts under the build's signature", free: true,
    playbook: "Installed. The gap is cadence, not plumbing: every publish should produce a post with the article's og:image card; threads for the spine pieces. Cards render because every article carries twitter:card meta." },
  { network: "LinkedIn", api: "Posts API (w_member_social / w_organization_social)", needs: "OAuth app + approval (days)", free: true,
    playbook: "The B2B lane for the proven-work offer. Document-style posts and native text outperform bare links; post the argument, link the article in the first comment. Intent-URL sharing is live on every article today." },
  { network: "Reddit", api: "POST /api/submit", needs: "script app + account with standing in target subreddits", free: true,
    playbook: "Referral gold and automation poison: subreddits punish self-promotion patterns. Operate it — participate, then submit the genuinely novel objects (the model comment ledger, the self-scoring audit) to the AI/programming subs. HN same posture; both share buttons are live on every article." },
  { network: "YouTube", api: "Data API v3 videos.insert", needs: "OAuth + channel + video content", free: true,
    playbook: "Same video precondition as TikTok; Shorts + a pinned link is the traffic shape. Closed until video exists." },
  { network: "Bluesky", api: "AT Protocol com.atproto.repo.createRecord", needs: "handle + app password", free: true,
    playbook: "Minutes to wire, no approval; the AI/research crowd is active. Website cards embed from OG tags." },
  { network: "Mastodon", api: "POST /api/v1/statuses", needs: "instance account + token", free: true,
    playbook: "One call; link previews come from OG. Completes the fediverse leg with Threads and Bluesky." },
  { network: "Telegram channel", api: "Bot API sendMessage", needs: "bot token + public channel", free: true,
    playbook: "A public channel becomes a push feed of every publish; the build already has telegram plumbing (functions/telegram.js)." },
  { network: "Discord / Slack", api: "incoming webhooks", needs: "webhook URL each", free: true,
    playbook: "Zero-auth publish announcements into any community; cheapest possible fan-out legs." },
  { network: "Dev.to + Hashnode", api: "POST /api/articles · GraphQL publishPost", needs: "API key each", free: true,
    playbook: "Republish the OIP/protocol spine with rel=canonical pointing here: developer-audience links with no duplicate-content cost." },
  { network: "Quora / Medium / Substack / Tumblr", api: "none usable, retired, none, POST /v2/blog", needs: "—", free: false,
    playbook: "Medium's write API is retired, Substack has no publish API, Quora has none — listed so nobody re-inventories them. Tumblr works but is long-tail." },
  { network: "Google Search Console", api: "Sitemaps + URL Inspection + Performance APIs", needs: "one-time site verification + service account", free: true,
    playbook: "The read-back half of SEO: what indexed, what ranks, what errored, which queries. The site currently announces every change and cannot see any result. Wire this before adding more announce lanes." },
  { network: "Bing Webmaster Tools", api: "Submission + traffic APIs", needs: "site verification + API key", free: true,
    playbook: "Read-back for the IndexNow submissions already flowing from the write path." },
  { network: "Google Indexing API", api: "urlNotifications.publish", needs: "Search Console + service account", free: true,
    playbook: "Officially JobPosting/BroadcastEvent only; the compliant Google lane is sitemap freshness via Search Console, which is why that comes first." },
  { network: "Buffer / Zapier / IFTTT", api: "aggregator schedulers", needs: "paid plan + per-network auth anyway", free: false,
    playbook: "A subscription and a middleman over APIs the build can call directly. Not recommended; every lane above is one HTTP call the build already knows how to make." },
];

export async function onRequestGet() {
  return new Response(
    JSON.stringify(
      {
        _self: {
          schema: "miscsubjects/syndication-inventory/2",
          what: "Every channel this site publishes through, and every network API worth installing next — majors first, each with the exact credential it needs and the practice that actually moves traffic there.",
          law: "A channel is installed only when its credential exists; nothing here fakes a network it cannot reach. Update on install; a channel never sits on both lists.",
          disclosure: "This site is trying to reach the world. Its perception of how — the best practices it holds itself to — is written down at the skill below, enforced live at the score endpoint, and open to critique through the comment door on every article.",
          best_practices_skill: `${SITE}/skills/seo-distribution-law`,
          live_self_score: `${SITE}/api/seo/score`,
          critique_door: `${SITE}/api/comments`,
        },
        installed: INSTALLED,
        available: AVAILABLE,
        next_by_leverage: [
          "Google Search Console + Bing Webmaster: the read-back lane — the site announces every change and cannot see what indexed or ranked. Wire before adding more announce lanes.",
          "Pinterest Pins API + Rich Pins validation: the one major where this corpus (evergreen text + hero images, search-shaped demand) fits natively and pins compound for months.",
          "Meta app (Facebook Page + Instagram + Threads): one credential family, three majors.",
          "Bluesky + Mastodon: minutes each, no approval, completes the automatic fan-out.",
          "TikTok / YouTube: blocked on video content, declared as a gap in /api/seo/score — a strategy decision, not a plumbing one.",
        ],
      },
      null,
      2,
    ),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*",
      },
    },
  );
}
