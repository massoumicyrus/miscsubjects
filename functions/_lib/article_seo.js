// SEO + inter-article linking for public /a/{slug} pages.

import { parseArticleMeta } from "./article_topology.js";
import {
  matchConditionProfile,
  stackPeptidesForArticle,
} from "./condition_framework.js";
import { slugDisplayTitle } from "./graph_explorer.js";

const SITE = "https://miscsubjects.com";
const FAVICON = `${SITE}/favicon.svg?v=2`;
const DEFAULT_DESC =
  "Evidence-graded peptide research — human trials, preclinical data, and sourced anecdotes. Not medical advice.";
const RESEARCH_DESC =
  "Sourced, hash-chained evidence review — every claim tiered, cited, and individually challengeable.";
const OIP_DESC =
  "Object Invocation Protocol specification — a normative protocol for model-operated work objects, scoped invocation, machine-native JSON, ledger receipts, replay, repair, and conformance.";
const PHIL_DESC =
  "A living philosophy corpus — order, obligation, right action, and falsification, every claim hashed and individually challengeable.";

// TAGS ARE WHATEVER THE WRITE PATH ACCEPTED, AND IT ACCEPTS A STRING.
//
// 2026-08-05: /a/the-model-comment-ledger published cleanly through every write gate and then
// returned "render error" on every request. The cause was one line here — `(meta?.tags || [])
// .join(", ")` — against a tags value stored as "a, b, c" rather than ["a","b","c"]. Strings have no
// .join, the whole page threw, and the failure surfaced as a 500 with no message rather than as
// anything the author could have seen at publish time.
//
// The write path has always accepted both shapes. Six places in this file spread or joined tags as
// if only one existed, so every one of them was a 500 waiting for the next author who typed a
// comma-separated string. Normalising on read is the repair: the reader accepts what the writer
// accepts. Fixing the two stored rows would have left the trap armed for the third.
function tagList(tags) {
  if (Array.isArray(tags)) return tags.map((t) => String(t || "").trim()).filter(Boolean);
  if (typeof tags === "string") return tags.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clip(s, n) {
  const t = String(s || "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + "…";
}

function peptidesFromSlug(slug) {
  const ids = [
    "bpc-157",
    "tb-500",
    "ara-290",
    "semax",
    "selank",
    "dsip",
    "ghk-cu",
    "pt-141",
    "kpv",
    "mots-c",
    "ss-31",
    "aod-9604",
    "tirzepatide",
    "semaglutide",
    "retatrutide",
  ];
  return ids.filter(
    (p) =>
      slug === p ||
      slug.startsWith(`${p}-`) ||
      slug.includes(`-${p}-`) ||
      slug.endsWith(`-${p}`),
  );
}

export function articleDescription(article, meta) {
  if (meta?.description) return clip(String(meta.description), 300);
  if (meta?.register === "essay") {
    const plain = String(article?.body || "")
      .replace(/[#*_`>\[\]()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (plain) return clip(plain, 240);
  }
  if (isOipArticle(article, meta)) return OIP_DESC;
  const active = (meta?.claims || []).filter(
    (c) => !c.status || c.status === "active" || c.status === "downweighted",
  );
  if (isPhilosophyArticle(article, meta)) {
    const lead = active.find((c) => c.slot === "what_it_is" || c.tier === "human");
    const core = lead?.text ? clip(lead.text, 140) : clip(article.title, 120);
    const n = active.length;
    const note = n
      ? `${n} challengeable claim${n === 1 ? "" : "s"}`
      : "a living philosophy";
    return clip(`${core} — ${note}. ${PHIL_DESC}`, 300);
  }
  const claims = active;
  const human = claims.filter((c) => c.tier === "human").length;
  const pre = claims.filter((c) => c.tier === "preclinical").length;
  const lead = claims.find(
    (c) => c.slot === "what_it_is" || c.tier === "human",
  );
  const tierNote =
    human > 0
      ? `${human} human-trial claim${human === 1 ? "" : "s"}`
      : pre > 0
        ? `${pre} preclinical claim${pre === 1 ? "" : "s"}`
        : `${claims.length} sourced claim${claims.length === 1 ? "" : "s"}`;
  const core = lead?.text ? clip(lead.text, 140) : clip(article.title, 120);
  // Peptide branding only where the claim graph is health-tiered; a governance or
  // technical article self-describing as peptide research is template leakage.
  const health = isHealthArticle(article, meta);
  return clip(`${core} — ${tierNote}. ${health ? DEFAULT_DESC : RESEARCH_DESC}`, 300);
}

export function isHealthArticle(article, meta) {
  if (peptidesFromSlug(String(article?.slug || "")).length) return true;
  return (meta?.claims || []).some((c) =>
    ["human", "preclinical", "anecdotal"].includes(String(c?.tier || "")),
  );
}

function isOipArticle(article, meta) {
  const slug = String(article?.slug || "").toLowerCase();
  return (
    meta?.register === "oip_protocol" ||
    slug === "oip" ||
    slug.startsWith("oip-")
  );
}

function isPhilosophyArticle(article, meta) {
  const slug = String(article?.slug || "").toLowerCase();
  return (
    meta?.register === "philosophy" ||
    slug === "philosophy" ||
    slug.startsWith("philosophy-") ||
    slug.startsWith("grain-")
  );
}

export async function buildRelatedArticles(env, slug, title, meta, opts = {}) {
  const m = meta || {};
  const seen = new Set([slug]);
  const out = [];

  function push(row, reason) {
    if (!row?.slug || seen.has(row.slug)) return;
    seen.add(row.slug);
    out.push({
      slug: row.slug,
      title: row.title || row.slug,
      reason,
    });
  }

  if (isOipArticle({ slug }, m)) {
    [
      ["oip", "Object Invocation Protocol", "protocol root"],
      ["philosophy-protocol", "The Philosophy Protocol", "foundation protocol"],
      [
        "philosophy-source-documentation",
        "Philosophy Source Documentation",
        "source corpus",
      ],
      ["oip-spec", "OIP specification", "normative spec"],
      ["oip-operating-model", "OIP operating model", "operating loop"],
      ["oip-tap-go", "Tap & Go", "scoped drop"],
      ["oip-machine-json", "Machine-native JSON", "machine payload"],
      ["oip-ledger-receipts", "Invocation ledger", "proof and receipts"],
      [
        "oip-model-review-loop",
        "Models reviewing OIP articles",
        "recursive review",
      ],
      ["oip-curl", "How to operate the build with curl", "terminal operation"],
      ["oip-mcp", "What is MCP?", "protocol comparison"],
      ["oip-github", "What is GitHub?", "subsidiary concept"],
    ].forEach(([s, t, r]) => push({ slug: s, title: t }, r));
    return out.slice(0, 10);
  }

  for (const es of m.embeds || []) {
    const s = String(es).toLowerCase();
    const row = await env.DB.prepare(
      "SELECT slug, title FROM articles WHERE slug=? AND published=1",
    )
      .bind(s)
      .first();
    if (row) push(row, "embedded in this article");
  }

  for (const ps of stackPeptidesForArticle(slug, title, m.embeds)) {
    const row = await env.DB.prepare(
      "SELECT slug, title FROM articles WHERE slug=? AND published=1",
    )
      .bind(ps)
      .first();
    if (row) push(row, "peptide in this stack");
  }

  for (const gl of opts.graphForward || []) {
    push({ slug: gl.slug, title: gl.title }, gl.reason || "evidence map");
  }

  const profile = matchConditionProfile(slug, title);
  if (profile?.key) {
    const peers = await env.DB.prepare(
      "SELECT slug, title FROM articles WHERE published=1 AND slug LIKE ? AND slug != ? ORDER BY updated_at DESC LIMIT 6",
    )
      .bind(`%${profile.key.replace(/-stimulant$/, "")}%`, slug)
      .all();
    for (const row of peers.results || []) {
      push(row, "same condition family");
      if (out.length >= 12) break;
    }
  }

  for (const p of peptidesFromSlug(slug)) {
    const root = await env.DB.prepare(
      "SELECT slug, title FROM articles WHERE slug=? AND published=1",
    )
      .bind(p)
      .first();
    if (root) push(root, "root peptide primer");

    const peers = await env.DB.prepare(
      "SELECT slug, title FROM articles WHERE published=1 AND slug LIKE ? AND slug != ? ORDER BY updated_at DESC LIMIT 8",
    )
      .bind(`${p}-%`, slug)
      .all();
    for (const row of peers.results || []) {
      push(row, `also covers ${p.toUpperCase().replace("-", "-")}`);
      if (out.length >= 12) break;
    }
  }

  if (out.length < 6) {
    const tokens = slug.split("-").filter((t) => t.length >= 4);
    for (const tok of tokens.slice(0, 3)) {
      const peers = await env.DB.prepare(
        "SELECT slug, title FROM articles WHERE published=1 AND slug LIKE ? AND slug != ? ORDER BY updated_at DESC LIMIT 4",
      )
        .bind(`%${tok}%`, slug)
        .all();
      for (const row of peers.results || []) {
        push(row, "shared topic");
        if (out.length >= 12) break;
      }
    }
  }

  return out.slice(0, 6);
}

function reasonLabel(reason, mapLabel) {
  const r = String(reason || "");
  if (!r) return "";
  if (mapLabel && /^same (peptide|condition) map$/i.test(r)) return "";
  return r;
}

export function renderRelatedRail(links, opts = {}) {
  if (!links?.length) return "";
  const mapLabel = opts.mapLabel || "";
  const cards = links
    .map((l) => {
      const title = slugDisplayTitle(l.slug, l.title);
      const reason = reasonLabel(l.reason, mapLabel);
      return (
        `<a class="rel-card" href="/a/${esc(l.slug)}">` +
        `<span class="rel-title">${esc(title)}</span>` +
        (reason ? `<span class="rel-reason">${esc(reason)}</span>` : "") +
        `<span class="rel-slug">${esc(l.slug)}</span></a>`
      );
    })
    .join("");
  return (
    `<section class="related-rail" aria-label="Related articles">` +
    `<div class="related-head">` +
    `<div class="related-head-main">` +
    `<h2>Related articles</h2>` +
    (mapLabel ? `<p class="related-sub">${esc(mapLabel)}</p>` : "") +
    `</div>` +
    `<a href="/graph">Open evidence map →</a></div>` +
    `<div class="related-grid">${cards}</div></section>`
  );
}

export async function buildLatestArticles(env, slug, limit = 5) {
  const rows = await env.DB.prepare(
    `SELECT slug, title,
            COALESCE(json_extract(meta,'$.posted_at'), created_at) AS posted_at
     FROM articles
     WHERE published = 1 AND slug != ?
       AND COALESCE(json_extract(meta,'$.status'),'') != 'retracted'
       AND COALESCE(json_extract(meta,'$.home'), 1) != 0
     ORDER BY posted_at DESC LIMIT ?`,
  )
    .bind(slug, limit)
    .all();
  return (rows.results || []).map((r) => ({
    slug: r.slug,
    title: r.title || r.slug,
    reason: String(r.posted_at || "").slice(0, 10),
  }));
}

export function renderLatestRail(links) {
  if (!links?.length) return "";
  const cards = links
    .map(
      (l) =>
        `<a class="rel-card" href="/a/${esc(l.slug)}">` +
        `<span class="rel-title">${esc(slugDisplayTitle(l.slug, l.title))}</span>` +
        (l.reason ? `<span class="rel-reason">posted ${esc(l.reason)}</span>` : "") +
        `<span class="rel-slug">${esc(l.slug)}</span></a>`,
    )
    .join("");
  return (
    `<section class="related-rail latest-rail" aria-label="Latest articles">` +
    `<div class="related-head"><div class="related-head-main">` +
    `<h2>Latest from the journal</h2>` +
    `<p class="related-sub">Most recent pieces, site-wide</p></div>` +
    `<a href="/#articles">All articles →</a></div>` +
    `<div class="related-grid">${cards}</div></section>`
  );
}

export function buildSeoHead(article, meta, opts = {}) {
  const slug = article.slug;
  const title = article.title || slug;
  const canonical = `${SITE}/a/${encodeURIComponent(slug)}`;
  const oip = isOipArticle(article, meta);
  const phil = isPhilosophyArticle(article, meta);
  const description = articleDescription(article, meta);
  // Social card: a designed, titled+signed card when present (og_card), else the on-page
  // hero, else the default. Lets the page hero be a clean illustration while the X/OG card
  // carries the title and model signature — a raw illustration makes a poor social card.
  const ogImage = meta?.og_card || meta?.hero || `${SITE}/img/og-default.png`;
  const human = (meta?.claims || []).filter((c) => c.tier === "human").length;
  const sources = (meta?.sources || []).length;
  const jsonLd = oip
    ? {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        name: title,
        headline: title,
        description,
        url: canonical,
        mainEntityOfPage: canonical,
        inLanguage: "en",
        isPartOf: { "@type": "WebSite", name: "miscsubjects", url: SITE },
        author: { "@type": "Organization", name: "miscsubjects" },
        publisher: { "@type": "Organization", name: "miscsubjects", url: SITE },
        about: [
          { "@type": "Thing", name: "Object Invocation Protocol" },
          { "@type": "Thing", name: "protocol specification" },
          { "@type": "Thing", name: "machine-native JSON" },
          { "@type": "Thing", name: "ledger receipts" },
        ],
        citation: (meta?.sources || [])
          .filter((s) => s.url && /^https?:/i.test(s.url))
          .slice(0, 8)
          .map((s) => ({
            "@type": "CreativeWork",
            url: s.url,
            name: s.title || s.url,
          })),
        dateModified: article.updated_at || article.created_at || undefined,
        datePublished: article.created_at || undefined,
        keywords: [
          ...tagList(meta?.tags),
          "protocol specification",
          "machine native JSON",
          "Tap & Go",
          "receipts",
          "conformance",
        ].join(", "),
        proficiencyLevel: "Beginner",
      }
    : isHealthArticle(article, meta)
      ? {
          "@context": "https://schema.org",
          "@type": "MedicalWebPage",
          name: title,
          headline: title,
          description,
          url: canonical,
          mainEntityOfPage: canonical,
          inLanguage: "en",
          isPartOf: { "@type": "WebSite", name: "miscsubjects", url: SITE },
          author: { "@type": "Organization", name: "miscsubjects" },
          publisher: { "@type": "Organization", name: "miscsubjects", url: SITE },
          about: peptidesFromSlug(slug).map((p) => ({
            "@type": "Thing",
            name: p.replace(/-/g, " ").toUpperCase(),
          })),
          citation: (meta?.sources || [])
            .filter((s) => s.url && /^https?:/i.test(s.url))
            .slice(0, 8)
            .map((s) => ({
              "@type": "CreativeWork",
              url: s.url,
              name: s.title || s.url,
            })),
          dateModified: article.updated_at || article.created_at || undefined,
          datePublished: article.created_at || undefined,
          keywords: [...tagList(meta?.tags), ...peptidesFromSlug(slug)].join(", "),
          specialty: "Evidence synthesis (not medical advice)",
        }
      : {
          "@context": "https://schema.org",
          "@type": "Article",
          name: title,
          headline: title,
          description,
          url: canonical,
          mainEntityOfPage: canonical,
          inLanguage: "en",
          isPartOf: { "@type": "WebSite", name: "miscsubjects", url: SITE },
          author: { "@type": "Organization", name: "miscsubjects" },
          publisher: { "@type": "Organization", name: "miscsubjects", url: SITE },
          citation: (meta?.sources || [])
            .filter((s) => s.url && /^https?:/i.test(s.url))
            .slice(0, 8)
            .map((s) => ({
              "@type": "CreativeWork",
              url: s.url,
              name: s.title || s.url,
            })),
          dateModified: article.updated_at || article.created_at || undefined,
          datePublished: article.created_at || undefined,
          keywords: tagList(meta?.tags).join(", "),
        };
  // The trail a reader actually walks: Home → the tag folder → this page. It used
  // to publish "Articles → Article", which named neither the subject nor the
  // page, so the structured trail disagreed with the visible one. The middle
  // level is the primary tag because that is what the site groups by
  // (listCollections in object_folder.js) and what the folder download hands over
  // — see functions/_lib/article_trail.js.
  const primaryTag = (Array.isArray(meta?.tags) ? meta.tags : [])
    .map((t) => String(t || "").trim())
    .find(Boolean);
  const crumbTag = oip ? "Object Invocation Protocol" : primaryTag || null;
  const crumbTagUrl = oip
    ? SITE + "/a/oip"
    : primaryTag
      ? SITE + "/t/" + encodeURIComponent(primaryTag.toLowerCase())
      : null;
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      ...(crumbTag
        ? [{ "@type": "ListItem", position: 2, name: crumbTag, item: crumbTagUrl }]
        : []),
      {
        "@type": "ListItem",
        position: crumbTag ? 3 : 2,
        name: title,
        item: canonical,
      },
    ],
  };
  const keywords = oip
    ? [
        ...tagList(meta?.tags),
        "Object Invocation Protocol",
        "protocol specification",
        "machine native JSON",
        "Tap & Go",
        "receipts",
        "conformance",
      ]
    : phil
      ? [
          ...tagList(meta?.tags),
          "philosophy",
          "the grain",
          "right action",
          "falsification",
          "challengeable claims",
        ]
      : isHealthArticle(article, meta)
        ? [
            ...tagList(meta?.tags),
            ...peptidesFromSlug(slug),
            "peptide evidence",
            "source ledger",
          ]
        : [...tagList(meta?.tags), "evidence review", "source ledger", "challengeable claims"];

  return (
    `<title>${esc(title)} — miscsubjects</title>` +
    `<meta name="description" content="${esc(description)}">` +
    `<meta name="keywords" content="${esc(keywords.join(", "))}">` +
    `<link rel="canonical" href="${esc(canonical)}">` +
    `<link rel="icon" href="${esc(FAVICON)}" type="image/svg+xml">` +
    `<link rel="alternate icon" href="/favicon.ico">` +
    `<link rel="alternate" type="application/json" href="${esc(SITE + "/api/articles/" + encodeURIComponent(slug) + "/bundle")}">` +
    `<link rel="alternate" type="text/markdown" href="${esc(SITE + "/api/articles/" + encodeURIComponent(slug) + "/bundle?format=markdown")}">` +
    `<meta name="robots" content="index,follow,max-image-preview:large">` +
    `<meta property="og:type" content="article">` +
    `<meta property="og:site_name" content="miscsubjects">` +
    `<meta property="og:title" content="${esc(title)}">` +
    `<meta property="og:description" content="${esc(description)}">` +
    `<meta property="og:url" content="${esc(canonical)}">` +
    `<meta property="og:image" content="${esc(ogImage)}">` +
    `<meta name="twitter:card" content="summary_large_image">` +
    `<meta name="twitter:title" content="${esc(title)}">` +
    `<meta name="twitter:description" content="${esc(description)}">` +
    `<meta name="twitter:image" content="${esc(ogImage)}">` +
    (article.created_at
      ? `<meta property="article:published_time" content="${esc(article.created_at)}">`
      : "") +
    (article.updated_at
      ? `<meta property="article:modified_time" content="${esc(article.updated_at)}">`
      : "") +
    `<meta name="article:section" content="${oip ? "Object Invocation Protocol" : phil ? "Philosophy" : isHealthArticle(article, meta) ? "Peptide evidence" : "Research"}">` +
    (!oip && !phil && human
      ? `<meta name="evidence:human_claims" content="${human}">`
      : "") +
    (!oip && !phil && sources
      ? `<meta name="evidence:sources" content="${sources}">`
      : "") +
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` +
    `<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>`
  );
}

export function relatedRailStyles(ink, line, accent, soft) {
  return `
.related-rail{margin:calc(var(--u)*var(--phi)) 0 calc(var(--u)*1.618);padding-top:calc(var(--u)*0.618);border-top:1px solid ${line}}
.related-head{display:flex;align-items:flex-end;justify-content:space-between;gap:calc(var(--u)*0.618);margin-bottom:calc(var(--u)*0.618);flex-wrap:wrap}
.related-head-main{display:flex;flex-direction:column;gap:calc(var(--u)*0.22)}
.related-head h2{font:700 calc(var(--u)*0.722)/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.1em;text-transform:uppercase;color:${soft};margin:0}
.related-sub{font:500 calc(var(--u)*0.611)/1.35 ui-sans-serif,system-ui,sans-serif;color:${ink};margin:0}
.related-head>a{font:600 calc(var(--u)*0.611)/1 ui-sans-serif,system-ui,sans-serif;color:${accent};text-decoration:none}
.related-head>a:hover{text-decoration:underline}
.related-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.rel-card{display:flex;flex-direction:column;gap:3px;padding:12px 14px;border:1px solid ${line};border-radius:10px;background:transparent;text-decoration:none;color:${ink};transition:border-color .16s}
.rel-card:hover{border-color:${accent}}
.rel-title{font:600 0.95rem/1.35 ui-sans-serif,system-ui,sans-serif;color:${ink}}
.rel-reason{font:500 0.72rem/1.4 ui-sans-serif,system-ui,sans-serif;color:${soft}}
.rel-slug{font:500 0.62rem/1.3 var(--font-mono,ui-monospace,monospace);color:${accent};opacity:.75}
@media(max-width:700px){.related-grid{grid-template-columns:1fr}}
`;
}
