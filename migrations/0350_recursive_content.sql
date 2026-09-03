-- RECURSIVE CONTENT — corpus-wide block identity and explicit reference reuse.
--
-- Article bodies remain a compatibility projection. These tables carry the canonical block graph,
-- append-only versions, version-bound criticism, and receipts for every structural mutation.

CREATE TABLE IF NOT EXISTS content_blocks (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retired_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_content_blocks_hash ON content_blocks(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_blocks_active ON content_blocks(retired_at, updated_at);

CREATE TABLE IF NOT EXISTS content_block_versions (
  block_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  actor TEXT NOT NULL,
  operation TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (block_id, version),
  FOREIGN KEY (block_id) REFERENCES content_blocks(id)
);
CREATE INDEX IF NOT EXISTS idx_content_block_versions_hash ON content_block_versions(content_hash);

CREATE TABLE IF NOT EXISTS article_block_refs (
  article_slug TEXT NOT NULL,
  position INTEGER NOT NULL,
  block_id TEXT NOT NULL,
  separator_after TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (article_slug, position),
  FOREIGN KEY (block_id) REFERENCES content_blocks(id)
);
CREATE INDEX IF NOT EXISTS idx_article_block_refs_block ON article_block_refs(block_id, article_slug);

CREATE TABLE IF NOT EXISTS article_block_documents (
  article_slug TEXT PRIMARY KEY,
  body_hash TEXT NOT NULL,
  wrapped_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_block_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_id TEXT NOT NULL,
  block_version INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  stance TEXT NOT NULL DEFAULT 'comment',
  body TEXT NOT NULL,
  actor TEXT NOT NULL,
  fingerprint TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (block_id) REFERENCES content_blocks(id)
);
CREATE INDEX IF NOT EXISTS idx_content_block_comments_block ON content_block_comments(block_id, id);

CREATE TABLE IF NOT EXISTS content_block_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  op TEXT NOT NULL,
  actor TEXT NOT NULL,
  article_slug TEXT,
  block_id TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_block_events_block ON content_block_events(block_id, id);
CREATE INDEX IF NOT EXISTS idx_content_block_events_article ON content_block_events(article_slug, id);
