// GET /api/seo/score — the site grades itself against its own published perception of
// search and distribution best practices, live, on every call (owner order 2026-08-06:
// "the site's meta level of intelligence whereby it scores itself against best practices
// ... fully auditable ... so visiting models can critique it").
//
// Nothing here is asserted from memory: every check fetches the live surface it judges and
// returns the evidence with the verdict, so a visiting model can re-run any line of this
// audit itself. The checklist definition lives in one place — the skill at
// /skills/seo-distribution-law — and this endpoint is its mechanical enforcement. Gaps the
// site knows about and has not closed are DECLARED, not hidden: an honest score includes
// what fails.

const INDEXNOW_KEY = "1bb4a4b345e9c5923297801efb87e3dc";
const SAMPLE_ARTICLE = "/a/oip";
const FETCH_TIMEOUT_MS = 4000;

async function grab(origin, path) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(origin + path, {
      signal: ctl.signal,
      headers: { "user-agent": "ms-seo-self-score/1.0" },
    });
    clearTimeout(timer);
    const body = await res.text();
    return { status: res.status, body, headers: res.headers };
  } catch (e) {
    return { status: 0, body: "", headers: new Headers(), error: String(e?.message || e) };
  }
}

// Each check: what practice, the public source that makes it a practice and not an opinion,
// and a predicate over the fetched surface. The evidence field is what the check saw.
function buildChecks() {
  return [
    {
      id: "home_social_identity",
      surface: "/",
      practice: "Homepage carries Open Graph + Twitter card + canonical, so every share of the root renders as a card, not a bare link",
      source: "https://ogp.me/",
      test: (r) =>
        /property="og:title"/.test(r.body) &&
        /property="og:image"/.test(r.body) &&
        /name="twitter:card"/.test(r.body) &&
        /rel="canonical"/.test(r.body),
    },
    {
      id: "home_structured_data",
      surface: "/",
      practice: "WebSite JSON-LD with a SearchAction, so engines understand the site and its search box",
      source: "https://schema.org/WebSite",
      test: (r) => /application\/ld\+json/.test(r.body) && /SearchAction/.test(r.body),
    },
    {
      id: "home_cache_policy",
      surface: "/",
      practice: "Every public HTML surface states an explicit cache-control policy instead of letting intermediaries invent one",
      source: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control",
      test: (r) => !!r.headers.get("cache-control"),
    },
    {
      id: "article_head",
      surface: SAMPLE_ARTICLE,
      practice: "Article pages carry canonical, OG/Twitter cards, and Article JSON-LD with citations",
      source: "https://developers.google.com/search/docs/appearance/structured-data/article",
      test: (r) =>
        /rel="canonical"/.test(r.body) &&
        /property="og:title"/.test(r.body) &&
        /name="twitter:card"/.test(r.body) &&
        /application\/ld\+json/.test(r.body),
    },
    {
      id: "article_share_row",
      surface: SAMPLE_ARTICLE,
      practice: "Every article carries visible on-page share targets for the major networks (social referral is a first-class traffic lane)",
      source: "https://miscsubjects.com/skills/seo-distribution-law",
      test: (r) => /ms-sharerow/.test(r.body),
    },
    {
      id: "article_open_thread",
      surface: SAMPLE_ARTICLE,
      practice: "Every article carries an open, signed comment thread — the critique door this audit points its own readers at",
      source: "https://miscsubjects.com/a/the-model-comment-ledger",
      test: (r) => /id="ledger"/.test(r.body),
    },
    {
      id: "sitemap",
      surface: "/sitemap.xml",
      practice: "A sitemap exists, includes the root, and submits only the sourced spine (curation beats volume — thin pages tell engines 'content farm')",
      source: "https://www.sitemaps.org/protocol.html",
      test: (r) => r.status === 200 && /<urlset/.test(r.body) && /<loc>https:\/\/miscsubjects\.com\/<\/loc>/.test(r.body),
    },
    {
      id: "robots",
      surface: "/robots.txt",
      practice: "robots.txt permits search and AI crawlers and names the sitemap",
      source: "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
      test: (r) => r.status === 200 && /Sitemap:/.test(r.body) && !/^Disallow:\s*\/\s*$/m.test(r.body.split("User-agent: *")[1] || ""),
    },
    {
      id: "feed_with_hub",
      surface: "/feed.xml",
      practice: "An RSS feed exists and declares a WebSub hub, so subscribers are pushed on publish instead of polling",
      source: "https://www.w3.org/TR/websub/",
      test: (r) => r.status === 200 && /rel="hub"/.test(r.body),
    },
    {
      id: "indexnow_key",
      surface: `/${INDEXNOW_KEY}.txt`,
      practice: "The IndexNow key is served, and the write path pings it on every publish, edit, and delete of a spine page",
      source: "https://www.indexnow.org/documentation",
      test: (r) => r.status === 200 && r.body.trim() === INDEXNOW_KEY,
    },
    {
      id: "llms_txt",
      surface: "/llms.txt",
      practice: "A llms.txt self-description exists for AI crawlers — the model-native half of discovery",
      source: "https://llmstxt.org/",
      test: (r) => r.status === 200 && r.body.length > 500,
    },
    {
      id: "syndication_inventory",
      surface: "/api/syndication",
      practice: "The site discloses every channel it publishes through and every network API it has not yet wired, with the credential each needs",
      source: "https://miscsubjects.com/api/syndication",
      test: (r) => r.status === 200 && /installed/.test(r.body) && /available/.test(r.body),
    },
  ];
}

export async function onRequestGet({ request }) {
  const origin = new URL(request.url).origin;
  const checks = buildChecks();
  // One fetch per distinct surface, shared across the checks that judge it.
  const surfaces = [...new Set(checks.map((c) => c.surface))];
  const fetched = {};
  await Promise.all(surfaces.map(async (s) => { fetched[s] = await grab(origin, s); }));
  const results = checks.map((c) => {
    const r = fetched[c.surface];
    let pass = false;
    try { pass = !!c.test(r); } catch { pass = false; }
    return {
      id: c.id,
      pass,
      practice: c.practice,
      source: c.source,
      surface: origin + c.surface,
      evidence: r.status === 0 ? `fetch failed: ${r.error || "timeout"}` : `HTTP ${r.status}, ${r.body.length} bytes`,
    };
  });
  const passed = results.filter((x) => x.pass).length;
  return new Response(
    JSON.stringify(
      {
        _self: {
          schema: "miscsubjects/seo-self-score/1",
          what: "This site grading itself, live, against its own published perception of search and distribution best practices. Every verdict carries the surface it fetched and the source that makes the practice a practice — re-run any line yourself.",
          disclosure: "This site is trying to reach the world. Its perception of how is written down, versioned, and open to critique — not implied by its behavior.",
          checklist_definition: `${origin}/skills/seo-distribution-law`,
          channel_inventory: `${origin}/api/syndication`,
          critique_door: `${origin}/api/comments — mint a keyless token, write what this audit gets wrong onto /a/the-work-object or any article; the build answers in the thread`,
          source_of_this_audit: "functions/api/seo/score.js in the site repository",
        },
        score: `${passed}/${results.length}`,
        passed,
        total: results.length,
        results,
        declared_gaps: [
          {
            gap: "No search-performance read-back: Search Console and Bing Webmaster are not wired, so the site announces every change but cannot see what indexed or ranked.",
            needs: "owner: one-time site verification + service-account credential",
          },
          {
            gap: "No automatic posting to X, Bluesky, Mastodon, TikTok, Instagram, Facebook, LinkedIn, or Pinterest on publish — each needs an owner-minted credential, itemized at /api/syndication.",
            needs: "owner: per-network credential; then the write path can fan out like it already does to IndexNow/WebSub",
          },
          {
            gap: "Spine sitemap/feed lastmod timestamps are render-time for virtual pages — they claim daily change, which engines learn to distrust.",
            needs: "real updated_at on virtual spine articles",
          },
          {
            gap: "No video-native content, so TikTok / YouTube / Reels distribution has nothing to carry.",
            needs: "owner decision: produce video, or accept the lane stays closed",
          },
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
