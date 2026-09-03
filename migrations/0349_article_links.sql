
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
