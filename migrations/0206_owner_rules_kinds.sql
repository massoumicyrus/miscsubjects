-- Profile statefulness: allow 'identity' + 'goal' kinds in owner_rules so a fresh model can
-- read WHO it's working for. SQLite can't ALTER a CHECK, so recreate the table. The hash chain
-- is stored as data (prev_hash/hash), so copying rows verbatim preserves it — /api/rules/verify
-- stays valid.
CREATE TABLE owner_rules_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seq INTEGER NOT NULL,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('rule', 'preference', 'thought', 'ban', 'boolean', 'identity', 'goal')),
  content TEXT NOT NULL,
  added_by TEXT DEFAULT 'owner',
  prev_hash TEXT NOT NULL DEFAULT 'genesis',
  hash TEXT NOT NULL
);
INSERT INTO owner_rules_new (id, seq, ts, kind, content, added_by, prev_hash, hash)
  SELECT id, seq, ts, kind, content, added_by, prev_hash, hash FROM owner_rules;
DROP TABLE owner_rules;
ALTER TABLE owner_rules_new RENAME TO owner_rules;
