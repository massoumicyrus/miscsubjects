-- Append-only owner/model verdicts on an exact recursive-content block version.

CREATE TABLE IF NOT EXISTS content_block_verdicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_id TEXT NOT NULL,
  block_version INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('positive','negative','edit','delete')),
  note TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL,
  fingerprint TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (block_id) REFERENCES content_blocks(id)
);
CREATE INDEX IF NOT EXISTS idx_content_block_verdicts_block
  ON content_block_verdicts(block_id, id);
