// https://miscsubjects.com/sitemap.xml

import { listOipArticleSummaries } from "./_lib/oip_articles.js";

const SITE = "https://miscsubjects.com";

// CURATION LAW (owner-set): the sitemap submits ONLY the defensible, sourced,
// non-medical spine — the OIP protocol, governance, and philosophy/convergence
// essays (the `oip-*` virtual set). The auto-generated peptide/health article
// corpus in the D1 `articles` table is deliberately EXCLUDED from search-engine
// submission until each page carries a real source chain. Submitting ~2,000
// thinly-sourced medical pages to Google is the content-farm / diligence risk we
// gate against. Do not re-add the D1 bulk pull without per-article sourcing.
//
// EXPLICIT ALLOWLIST: individual D1 `articles` rows that already carry a real
// source chain and were verified by hand. Add here one at a time — never widen
// the blanket exclusion above without doing that per-article check.
const D1_ARTICLE_ALLOWLIST = [
  "the-canonical-morgh-index",
];

export async function onRequestGet({ env }) {
  const virtualOip = await listOipArticleSummaries(env, false);
  const seen = new Set();
  const { SKILL_REGISTRY } = await import("./_lib/skill_registry.js");
  const allowlisted = await Promise.all(
    D1_ARTICLE_ALLOWLIST.map((slug) =>
      env.DB.prepare("SELECT slug, updated_at FROM articles WHERE slug = ?").bind(slug).first()
    )
  );
  const urls = [
    { loc: `${SITE}/`, pri: "1.0", changefreq: "daily" },
    { loc: `${SITE}/latest`, pri: "0.8", changefreq: "daily" },
    { loc: `${SITE}/ledger`, pri: "0.6", changefreq: "daily" },
    { loc: `${SITE}/governance`, pri: "0.6", changefreq: "weekly" },
    { loc: `${SITE}/graph`, pri: "0.8", changefreq: "weekly" },
    { loc: `${SITE}/skills`, pri: "0.85", changefreq: "weekly" },
    { loc: `${SITE}/a/skill-law`, pri: "0.85", changefreq: "weekly" },
    ...SKILL_REGISTRY.skills.map((s) => ({
      loc: `${SITE}/skills/${encodeURIComponent(s.name)}`,
      pri: "0.7",
      changefreq: "weekly",
    })),
    ...virtualOip.map((a) => ({
      loc: `${SITE}/a/${encodeURIComponent(a.slug)}`,
      lastmod: String(a.updated_at || "").slice(0, 10),
      pri: a.slug === "oip" ? "0.9" : "0.75",
      changefreq: "daily",
    })),
    ...allowlisted
      .filter(Boolean)
      .map((a) => ({
        loc: `${SITE}/a/${encodeURIComponent(a.slug)}`,
        lastmod: String(a.updated_at || "").slice(0, 10),
        pri: "0.6",
        changefreq: "monthly",
      })),
  ];

  const uniqueUrls = urls.filter((u) => {
    if (seen.has(u.loc)) return false;
    seen.add(u.loc);
    return true;
  });

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    uniqueUrls
      .map((u) => {
        let block = `  <url><loc>${u.loc}</loc>`;
        if (u.lastmod) block += `<lastmod>${u.lastmod}</lastmod>`;
        block += `<changefreq>${u.changefreq}</changefreq><priority>${u.pri}</priority></url>`;
        return block;
      })
      .join("\n") +
    "\n</urlset>";

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
