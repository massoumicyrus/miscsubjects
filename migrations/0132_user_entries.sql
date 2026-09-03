-- 0132: User experience / question entries on articles.
-- Readers can submit their own experience or question about a subject.
-- Each entry is hashed and becomes auditable / filterable.

CREATE TABLE IF NOT EXISTS user_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  subject TEXT,
  context TEXT,
  text TEXT NOT NULL,
  author TEXT,
  source_url TEXT,
  hash TEXT,
  status TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_user_entries_subject ON user_entries(subject);
CREATE INDEX IF NOT EXISTS idx_user_entries_ts ON user_entries(ts);
CREATE INDEX IF NOT EXISTS idx_user_entries_status ON user_entries(status);
