CREATE TABLE IF NOT EXISTS pages (
  slug TEXT PRIMARY KEY,
  title TEXT,
  body_html TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pages_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  version INTEGER NOT NULL,
  title TEXT,
  body_html TEXT NOT NULL,
  created_at TEXT NOT NULL,
  actor TEXT
);

CREATE INDEX IF NOT EXISTS idx_pages_versions_slug ON pages_versions(slug, version DESC);
