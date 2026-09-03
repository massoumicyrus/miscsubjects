-- 0071_content_items.sql — thin production bridge for the Loop content framework.
-- One generic content table + versioning + model comments. No approval bureaucracy.
-- Represents the reference (the Loop Strategic Expansion + Content Brief + maps + voice law)
-- as editable, versioned, API-addressable, model-commentable site records.

CREATE TABLE IF NOT EXISTS content_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  section     TEXT,
  body_md     TEXT NOT NULL DEFAULT '',
  body_json   TEXT,                 -- JSON string; structured fields per type
  status      TEXT NOT NULL DEFAULT 'active',   -- draft | active | archived
  tags_json   TEXT,                 -- JSON array of strings
  source_doc  TEXT,                 -- provenance label
  source_order INTEGER,             -- numbered topic id, tissue row order, etc.
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_type    ON content_items(type, source_order);
CREATE INDEX IF NOT EXISTS idx_content_status  ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_section ON content_items(section);

CREATE TABLE IF NOT EXISTS content_versions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_slug   TEXT NOT NULL,
  version     INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,      -- full row at this version
  change_note TEXT,
  created_by  TEXT,                 -- operator | model name
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_versions_slug ON content_versions(item_slug, version DESC);

CREATE TABLE IF NOT EXISTS content_comments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_slug     TEXT NOT NULL,
  model_name    TEXT NOT NULL,      -- grok | claude | gemini | gpt | kimi | operator
  comment_type  TEXT,               -- critique | variant | micro_answer | suggestion | prompt_thought | mechanism_note
  comment_md    TEXT NOT NULL DEFAULT '',
  proposed_patch_json TEXT,         -- optional proposed field changes, JSON
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_comments_slug ON content_comments(item_slug, created_at DESC);
