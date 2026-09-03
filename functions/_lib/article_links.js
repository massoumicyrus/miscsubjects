// The corpus link graph, read and written as rows.
//
// D1 owns identity. This module owns the edges between identities. Every edge is
// extracted from the article body at the write path and read back by index —
// never re-derived over the corpus at read time, which is what made
// /api/articles/graph-links answer 1102 at 2,300 articles (see
// migrations/0349_article_links.sql).
//
// Edge kinds:
//   wikilink  [[slug]] / [[slug|label]] / [[slug#anchor]]   — Obsidian syntax
//   link      [](/a/slug) or [](https://miscsubjects.com/a/slug)
//   embed     meta.embeds[]
//
// A link whose target is not a published article is stored with to_slug NULL and
// resolved 0. It is a finding, not an error: it names a page that should exist.

const WIKILINK_RE =
  /\[\[([a-z0-9][a-z0-9_-]{1,80})(?:#([^\]|\n]{1,120}))?(?:\|([^\]\n]{1,160}))?\]\]/gi;
const SITE_LINK_RE =
  /\]\((?:https?:\/\/miscsubjects\.com)?\/a\/([a-z0-9][a-z0-9_-]*)(?:#([^)\s]{1,120}))?\)/gi;

// [[graph]] is the graph *view*, not an article. Anything else that collides with
// a route rather than a slug belongs here too.
const RESERVED_WIKI = new Set(["graph"]);

// Pages that render at /a/<slug> without being a row in `articles`. The laws are built
// from code objects, so a resolver that only checks the articles table calls every link
// to a law broken. That is the worst false positive available here: an unresolved target
// is meant to BE a commission, a page a writer named that nobody has written, and a list
// salted with pages that already answer 200 is a list nobody can act on.
// Verified live 2026-08-06: each returns 200 at /a/<slug>.
export const VIRTUAL_PAGES = new Set([
  "writing-law",
  "coding-law",
  "logic-law",
  "design-law",
  "loop-law",
  "outreach-law",
  "skill-law",
  "agent-work-law",
]);

// A target exists if the corpus holds it or the site renders it.
function resolvable(target, known) {
  return known.has(target) || VIRTUAL_PAGES.has(target);
}

function parseMeta(m) {
  if (m && typeof m === "object") return m;
  try {
    return JSON.parse(m || "{}") || {};
  } catch {
    return {};
  }
}

// Extract every edge typed in one article. Pure: same body → same edges, in a
// stable order, so a re-sync that changes nothing writes identical rows.
export function extractLinks(body, meta) {
  const s = String(body || "");
  const out = new Map(); // dedupe on target|kind, first occurrence wins
  const put = (target, kind, label, anchor) => {
    const t = String(target || "").toLowerCase();
    if (!t || RESERVED_WIKI.has(t)) return;
    const key = t + "|" + kind;
    if (out.has(key)) return;
    out.set(key, {
      target: t,
      kind,
      label: label ? String(label).slice(0, 160) : null,
      anchor: anchor ? String(anchor).slice(0, 120) : null,
    });
  };

  let m;
  const wre = new RegExp(WIKILINK_RE.source, "gi");
  while ((m = wre.exec(s))) put(m[1], "wikilink", m[3], m[2]);

  const lre = new RegExp(SITE_LINK_RE.source, "gi");
  while ((m = lre.exec(s))) put(m[1], "link", null, m[2]);

  for (const e of parseMeta(meta).embeds || []) put(e, "embed", null, null);

  return [...out.values()];
}

// The set of slugs an edge may resolve to. Cached per request via the caller —
// one indexed scan of slugs only (no bodies), which is cheap even at corpus size.
export async function publishedSlugSet(env) {
  const r = await env.DB.prepare(
    "SELECT slug FROM articles WHERE published = 1",
  ).all();
  return new Set((r.results || []).map((x) => x.slug));
}

// Replace one article's outbound edges. Idempotent, and scoped to from_slug so it
// can never disturb another article's rows.
export async function syncArticleLinks(env, slug, body, meta, slugSet) {
  if (!slug) return { slug, written: 0, unresolved: 0 };
  const known = slugSet || (await publishedSlugSet(env));
  const links = extractLinks(body, meta);
  const now = new Date().toISOString();

  const stmts = [
    env.DB.prepare("DELETE FROM article_links WHERE from_slug = ?").bind(slug),
  ];
  let unresolved = 0;
  for (const l of links) {
    if (l.target === slug) continue; // an article linking itself is not an edge
    const hit = resolvable(l.target, known);
    if (!hit) unresolved++;
    stmts.push(
      env.DB.prepare(
        `INSERT OR REPLACE INTO article_links
           (from_slug, target, kind, to_slug, label, anchor, resolved, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        slug,
        l.target,
        l.kind,
        hit ? l.target : null,
        l.label,
        l.anchor,
        hit ? 1 : 0,
        now,
      ),
    );
  }
  await env.DB.batch(stmts);
  return { slug, written: stmts.length - 1, unresolved };
}

// What points at this article. One indexed lookup — this renders on every page.
export async function backlinksFor(env, slug, limit = 50) {
  const r = await env.DB.prepare(
    `SELECT l.from_slug AS slug, a.title, l.kind, l.label
       FROM article_links l
       JOIN articles a ON a.slug = l.from_slug AND a.published = 1
      WHERE l.to_slug = ?
      GROUP BY l.from_slug
      ORDER BY a.updated_at DESC
      LIMIT ?`,
  )
    .bind(slug, Math.max(1, Math.min(200, Number(limit) || 50)))
    .all();
  return r.results || [];
}

// What this article points at, resolved and unresolved together.
export async function outboundFor(env, slug, limit = 200) {
  const r = await env.DB.prepare(
    `SELECT l.target, l.kind, l.to_slug, l.label, l.anchor, l.resolved, a.title
       FROM article_links l
       LEFT JOIN articles a ON a.slug = l.to_slug AND a.published = 1
      WHERE l.from_slug = ?
      ORDER BY l.resolved DESC, l.kind, l.target
      LIMIT ?`,
  )
    .bind(slug, Math.max(1, Math.min(500, Number(limit) || 200)))
    .all();
  return r.results || [];
}

// Corpus-level counts. Aggregates only — never pulls a body.
export async function graphCounts(env) {
  const r = await env.DB.prepare(
    `SELECT COUNT(*) AS edges,
            SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) AS resolved,
            SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) AS unresolved,
            COUNT(DISTINCT from_slug) AS linking_articles,
            COUNT(DISTINCT to_slug) AS linked_articles
       FROM article_links`,
  ).first();
  const total = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM articles WHERE published = 1",
  ).first();
  const edges = Number(r?.edges || 0);
  const linking = Number(r?.linking_articles || 0);
  const published = Number(total?.n || 0);
  return {
    published,
    edges,
    resolved: Number(r?.resolved || 0),
    unresolved: Number(r?.unresolved || 0),
    linking_articles: linking,
    linked_articles: Number(r?.linked_articles || 0),
    // The number the owner actually asked about: how much of the corpus is
    // connected to anything at all.
    unlinked_articles: Math.max(0, published - linking),
  };
}

// Articles nothing points at. The write-next queue, as a query rather than a scan.
export async function orphanSlugs(env, limit = 100) {
  const r = await env.DB.prepare(
    `SELECT a.slug, a.title, a.updated_at
       FROM articles a
      WHERE a.published = 1
        AND NOT EXISTS (SELECT 1 FROM article_links l WHERE l.to_slug = a.slug)
      ORDER BY a.updated_at DESC
      LIMIT ?`,
  )
    .bind(Math.max(1, Math.min(500, Number(limit) || 100)))
    .all();
  return r.results || [];
}

// Every link that names a page that does not exist, most-wanted first. An
// unresolved target cited by six articles is a stronger commission than one
// cited once.
export async function unresolvedTargets(env, limit = 100) {
  const r = await env.DB.prepare(
    `SELECT target, COUNT(*) AS wanted_by, GROUP_CONCAT(from_slug) AS sources
       FROM article_links
      WHERE resolved = 0
      GROUP BY target
      ORDER BY wanted_by DESC, target
      LIMIT ?`,
  )
    .bind(Math.max(1, Math.min(500, Number(limit) || 100)))
    .all();
  return (r.results || []).map((x) => ({
    target: x.target,
    wanted_by: Number(x.wanted_by || 0),
    sources: String(x.sources || "").split(",").filter(Boolean),
  }));
}

// The whole edge set, paged. For the vault projection and the graph view, which
// want edges but never bodies.
export async function allEdges(env, { limit = 5000, offset = 0 } = {}) {
  const r = await env.DB.prepare(
    `SELECT from_slug, to_slug, target, kind, resolved
       FROM article_links
      ORDER BY from_slug, kind, target
      LIMIT ? OFFSET ?`,
  )
    .bind(
      Math.max(1, Math.min(20000, Number(limit) || 5000)),
      Math.max(0, Number(offset) || 0),
    )
    .all();
  return r.results || [];
}
