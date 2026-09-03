CREATE TABLE IF NOT EXISTS content_block_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_slug TEXT,
  block_id TEXT NOT NULL REFERENCES content_blocks(id),
  block_version INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('isolate','move','edit','delete','reuse','split')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  note TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL,
  fingerprint TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_block_proposals_block ON content_block_proposals(block_id,id);

CREATE TABLE IF NOT EXISTS content_block_proposal_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL REFERENCES content_block_proposals(id),
  decision TEXT NOT NULL CHECK(decision IN ('accepted','rejected')),
  actor TEXT NOT NULL,
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_block_proposal_decisions_proposal ON content_block_proposal_decisions(proposal_id,id);
