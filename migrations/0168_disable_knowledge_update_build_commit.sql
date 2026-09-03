-- KNOWLEDGE points at unimplemented knowledgeGet; disable until repaired and proven.
UPDATE directory SET enabled = 0, updated_at = datetime('now') WHERE key = 'KNOWLEDGE';

-- Anchor rollback to the repo commit that shipped this prompt/row pass.
INSERT INTO settings (key, value, description, updated_at)
VALUES ('build_commit', '5bd8523', 'Git SHA anchor for score-anchored rollback', datetime('now'))
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;