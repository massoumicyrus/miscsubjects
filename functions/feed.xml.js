// https://miscsubjects.com/feed.xml
// RSS 2.0 feed for aggregators and AI ingest pipelines.
// CURATION LAW (owner-set): spine only — the `oip-*` protocol/governance/philosophy
// set, same gate as /llms.txt and /sitemap.xml. The unsourced peptide/health corpus
// is excluded until each page carries a real source chain. Do not add the D1 bulk
// pull without per-article sourcing.

import { listOipArticleSummaries } from "./_lib/oip_articles.js";

const SITE = "https://miscsubjects.com";

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function onRequestGet({ env }) {
  let spine = [];
  try {
    spine = await listOipArticleSummaries(env, false);
  } catch {
    spine = [];
  }

  const items = spine
    .filter((a) => a && a.slug)
    .slice(0, 200)
    .map((a) => {
      const link = `${SITE}/a/${encodeURIComponent(a.slug)}`;
      const title = esc(a.title || a.slug);
      return (
        `    <item>\n` +
        `      <title>${title}</title>\n` +
        `      <link>${link}</link>\n` +
        `      <guid isPermaLink="true">${link}</guid>\n` +
        `      <description>${title} — machine bundle at ${link.replace("/a/", "/api/articles/")}/bundle?format=markdown</description>\n` +
        `    </item>`
      );
    })
    .join("\n");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>miscsubjects.com — protocol, governance, philosophy</title>\n` +
    `    <link>${SITE}</link>\n` +
    `    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>\n` +
    // WebSub: subscribers get pushed on publish (functions/_lib/seo_distribution.js pings
    // this hub from the article write path) instead of polling on their own schedule.
    `    <atom:link href="https://pubsubhubbub.appspot.com/" rel="hub"/>\n` +
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n` +
    `    <description>The Object Invocation Protocol and the GRAIN convergence framework — a public research surface built to be read, cited, and operated by AI models.</description>\n` +
    `    <language>en</language>\n` +
    items +
    `\n  </channel>\n</rss>\n`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=900",
      "access-control-allow-origin": "*",
    },
  });
}
