-- 0217: dynamic OIP articles — machine-written, append-only versions.
-- The recursive review loop can now grow the article tree (oip-write) and
-- self-correct failing articles (oip-revise). Versions are never updated or
-- deleted; a revision is a new row.

CREATE TABLE IF NOT EXISTS oip_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_model TEXT,
  source TEXT,
  review_event_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (slug, version)
);
CREATE INDEX IF NOT EXISTS idx_oip_articles_slug_version ON oip_articles (slug, version DESC);

-- The review tick row now drains review AND write AND revise tasks (same
-- tasks.source='oip-review'; post_to on the task body routes each one).
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, allowed_categories, planner_visible, planner_rank, enabled, updated_at) VALUES
('OIP_ARTICLE_REVIEW', 'fn', 'protocolRun', '', '# WHAT: Run one OIP article loop tick. Claims the next tasks.source=oip-review row and routes it: oip-review scores machine JSON clarity + English clarity with a fresh model; oip-write has a model write a missing OIP article; oip-revise has a model rewrite a failing article as a new append-only version. Every step lands in the ledger.
# WHEN_TO_USE: cron or manual trigger to advance the recursive OIP documentation loop one step.
# ARGS: none
# EX: [OIP_ARTICLE_REVIEW][/OIP_ARTICLE_REVIEW]
["oip-review"]', 'protocol', NULL, 1, 1, 1, datetime('now'));
