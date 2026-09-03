-- Question graph: questions and ingested evidence as hash-chained nodes on article topology.

CREATE TABLE IF NOT EXISTS question_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL UNIQUE,
  ts TEXT NOT NULL,
  primary_slug TEXT NOT NULL,
  slugs_json TEXT,
  question TEXT NOT NULL,
  answer_preview TEXT,
  confidence TEXT,
  status TEXT DEFAULT 'answered',
  parent_node_id TEXT,
  gaps_json TEXT,
  needs_json TEXT,
  cited_claims_json TEXT,
  cited_sources_json TEXT,
  channel TEXT DEFAULT 'ask',
  author TEXT DEFAULT 'anonymous',
  hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL DEFAULT 'genesis'
);

CREATE TABLE IF NOT EXISTS evidence_ingest (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingest_id TEXT NOT NULL UNIQUE,
  ts TEXT NOT NULL,
  slug TEXT NOT NULL,
  question_node_id TEXT,
  channel TEXT DEFAULT 'imessage',
  author TEXT DEFAULT 'anonymous',
  raw_text TEXT NOT NULL,
  summary TEXT,
  source_ids_json TEXT,
  claim_ids_json TEXT,
  model TEXT,
  hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL DEFAULT 'genesis',
  status TEXT DEFAULT 'promoted'
);

CREATE INDEX IF NOT EXISTS idx_question_nodes_slug ON question_nodes(primary_slug);
CREATE INDEX IF NOT EXISTS idx_question_nodes_ts ON question_nodes(ts);
CREATE INDEX IF NOT EXISTS idx_question_nodes_status ON question_nodes(status);
CREATE INDEX IF NOT EXISTS idx_evidence_ingest_slug ON evidence_ingest(slug);
CREATE INDEX IF NOT EXISTS idx_evidence_ingest_qnode ON evidence_ingest(question_node_id);

-- ROUTER / iMessage: ingest evidence from user or external model into article ledger
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'ARTICLE_INGEST',
  'fn',
  'protoIngest',
  '',
  '# WHAT: Parse user-submitted evidence (Grok/Gemini/GPT export, study paste, anecdote) and write to article source ledger + optional claims. Hash-chained.
# WHEN_TO_USE: user texts evidence to add to a peptide article, or replies to a question node with new info.
# ARGS: slug|evidence text   OR   slug|q:NODE_ID|evidence text
#   e.g. bpc-157|Grok said: preclinical disc repair data from Sikiric 2018...
#   e.g. recovery-stack-herniated-disc|q:qn_abc123|here is the PubMed abstract...
# EX: [ARTICLE_INGEST]bpc-157|paste from another model here[/ARTICLE_INGEST]
["$1"]',
  'content',
  44,
  1,
  1,
  datetime('now')
);