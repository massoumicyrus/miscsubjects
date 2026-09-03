-- 0136: Append-only owner rules — boolean preferences, thoughts, bans.
-- Models may READ; only owner (x-terminal-key) may APPEND. No UPDATE/DELETE.

CREATE TABLE IF NOT EXISTS owner_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seq INTEGER NOT NULL,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('rule', 'preference', 'thought', 'ban', 'boolean')),
  content TEXT NOT NULL,
  added_by TEXT DEFAULT 'owner',
  prev_hash TEXT NOT NULL DEFAULT 'genesis',
  hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_owner_rules_seq ON owner_rules(seq);
CREATE INDEX IF NOT EXISTS idx_owner_rules_kind ON owner_rules(kind);