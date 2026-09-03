-- Content pipeline: inventories (peptide|condition|pharma) + combinatorial matrix (combo),
-- each row a work item that advances through phases queued -> outlined -> written.
CREATE TABLE IF NOT EXISTS pipeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT,            -- peptide | condition | pharma | combo
  name TEXT,
  phase TEXT,           -- queued | outlined | written
  pair_a TEXT,          -- combo: peptide
  pair_b TEXT,          -- combo: condition or pharma
  weight REAL,          -- combo: regenerative-relevance score 0..1
  evidence TEXT,        -- combo: human | preclinical | anecdotal
  slug TEXT,            -- published article slug
  data TEXT,            -- json (outline, notes)
  status TEXT,          -- pending | done
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_pipeline_kind ON pipeline(kind, status);

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES
('PIPELINE_SEED','fn','pipelineSeed','','# Inventory one kind (peptide|condition|pharma) via the model; inserts rows.\n# ARGS: kind\n["$1"]','pipeline',NULL,40,1,1,datetime('now')),
('PIPELINE_MAP','fn','pipelineMap','','# Build the combinatorial matrix: every peptide x (condition+pharma), weighted by the model.\n# ARGS: none\n[]','pipeline',NULL,40,1,1,datetime('now')),
('PIPELINE_WRITE','fn','pipelineWrite','','# Write one pipeline item (peptide or combo): outline -> article -> POST with provenance.\n# ARGS: id\n["$1"]','pipeline',NULL,40,1,1,datetime('now')),
('PIPELINE_STATUS','fn','pipelineStatus','','# Counts by kind/phase + top-weighted combos.\n# ARGS: none\n[]','pipeline',NULL,40,1,1,datetime('now'));
