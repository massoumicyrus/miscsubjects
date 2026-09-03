-- 0100_forge.sql — Multi-model article forge pipeline
-- Stages: outline → draft → review → publish
-- Each model contribution is logged with ledger hash

CREATE TABLE IF NOT EXISTS forge_runs (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  slug TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'outline',
  model_count INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  final_score INTEGER
);

CREATE TABLE IF NOT EXISTS forge_contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  model_key TEXT NOT NULL,
  stage TEXT NOT NULL,
  slot_key TEXT,
  content TEXT NOT NULL,
  ledger_hash TEXT,
  score INTEGER,
  accepted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES forge_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_forge_runs_stage ON forge_runs(stage);
CREATE INDEX IF NOT EXISTS idx_forge_contributions_run ON forge_contributions(run_id);
CREATE INDEX IF NOT EXISTS idx_forge_contributions_model ON forge_contributions(model_key, stage);

INSERT OR REPLACE INTO directory(key, type, target, auth, content, category, allowed_categories, seq, enabled, planner_visible, planner_rank, input_schema, examples, updated_at) VALUES
('FORGE', 'http',
'target_map:{
"list":{"method":"GET","url":"https://miscsubjects.com/api/forge"},
"get":{"method":"GET","url":"https://miscsubjects.com/api/forge/$1"},
"create":{"method":"POST","url":"https://miscsubjects.com/api/forge","body":"{\"topic\":\"$1\",\"slug\":\"$2\",\"model_count\":$3}"},
"stage":{"method":"POST","url":"https://miscsubjects.com/api/forge/$1/stage","body":"{\"stage\":\"$2\"}"},
"contribute":{"method":"POST","url":"https://miscsubjects.com/api/forge/$1/contribute","body":"{\"model_key\":\"$2\",\"stage\":\"$3\",\"slot_key\":\"$4\",\"content\":\"$5\"}"},
"accept":{"method":"POST","url":"https://miscsubjects.com/api/forge/$1/accept","body":"{\"contribution_id\":$2}"},
"publish":{"method":"POST","url":"https://miscsubjects.com/api/forge/$1/publish"}
}',
'',
'# Multi-model article forge. One topic → N models outline concurrently → one writes → others review → publish.
# Stages: outline → draft → review → publish
# ARGS:
#   list                                           → all forge runs
#   get|<id>                                       → one run + all contributions
#   create|<topic>|<slug>|<model_count?>             → start a new forge run
#   stage|<id>|<stage>                             → advance run to next stage
#   contribute|<id>|<model_key>|<stage>|<slot_key?>  → add model contribution
#   accept|<id>|<contribution_id>                  → mark contribution as accepted
#   publish|<id>                                   → finalize article from accepted contributions
# WHEN_TO_USE: "forge an article about X", "write about X with multiple models", "start a forge run".',
'forge', '', 85, 1, 1, 35,
'{"args":["op","arg1","arg2","arg3","arg4","arg5"]}',
'[{"args":"create|RUO peptides|ruo-peptides|3","desc":"Start a forge run on RUO peptides with 3 models"},{"args":"get|fr_123","desc":"Check forge run status"},{"args":"stage|fr_123|draft","desc":"Advance to draft stage"}]',
strftime('%Y-%m-%dT%H:%M:%SZ','now'));
