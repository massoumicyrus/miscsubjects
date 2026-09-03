-- The corpus link graph, materialized.
--
-- WHY THIS TABLE EXISTS: buildLinkGraph() in functions/_lib/knowledge_loop.js
-- derived every edge on every request by SELECTing `body` for all ~2,300
-- published articles and regexing them inside the Worker. On 2026-08-06 that
-- read ~90 MB per call and GET /api/articles/graph-links answered
-- "error code: 1102" (Worker resource limit) — so backlinks, orphan detection,
-- related-article surfaces and the Obsidian vault projection were all built on
-- an endpoint that could not run at corpus scale.
--
-- The repair is mechanical, not a cache: edges are extracted once at the write
-- path (the only moment a body changes) and read back by index. A request that
-- wants the graph does an indexed lookup, never a corpus scan.
--
-- IDENTITY: an edge is identified by (from_slug, target, kind), never by row id,
-- so re-syncing one article is an idempotent delete-then-insert of its own rows
-- and can never disturb another article's edges.
--
-- to_slug IS NULL means the target did not resolve to a published article. Those
-- rows are kept, not discarded: an unresolved link is the highest-value lint
-- finding on the site (it names an article that should exist), and deleting it
-- would make the graph look healthier than it is.

CREATE TABLE IF NOT EXISTS article_links (
  from_slug  TEXT NOT NULL,           -- the article the link was typed in
  target     TEXT NOT NULL,           -- raw target as written, lowercased
  kind       TEXT NOT NULL,           -- wikilink | link | embed
  to_slug    TEXT,                    -- resolved slug; NULL when unresolved
  label      TEXT,                    -- display text from [[target|label]]
  anchor     TEXT,                    -- #heading fragment, without the #
  resolved   INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (from_slug, target, kind)
);

-- Backlinks: "what points at me" must be one indexed lookup, because it renders
-- on every article page.
CREATE INDEX IF NOT EXISTS idx_article_links_to
  ON article_links(to_slug);

-- Outbound + the delete half of a per-article re-sync.
CREATE INDEX IF NOT EXISTS idx_article_links_from
  ON article_links(from_slug);

-- The lint queue: every link that names an article that does not exist.
CREATE INDEX IF NOT EXISTS idx_article_links_unresolved
  ON article_links(resolved, target);
