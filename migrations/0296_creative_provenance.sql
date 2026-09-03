-- Every generated image/video gets an immutable evidence chain:
-- exact redacted request + raw provider response + final result in R2, indexed here.
CREATE TABLE IF NOT EXISTS creative_runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  kind TEXT NOT NULL DEFAULT 'image',
  channel TEXT NOT NULL DEFAULT 'unknown',
  directory_key TEXT,
  provider TEXT,
  model TEXT,
  prompt TEXT,
  request_preview TEXT,
  request_r2_key TEXT,
  response_preview TEXT,
  response_r2_key TEXT,
  result_preview TEXT,
  result_r2_key TEXT,
  trace_id TEXT,
  actor TEXT,
  provider_asset_id TEXT,
  parent_run_id TEXT,
  asset_id TEXT,
  asset_url TEXT,
  r2_asset_key TEXT,
  rating TEXT NOT NULL DEFAULT 'unreviewed',
  feedback TEXT,
  version_label TEXT,
  error TEXT,
  FOREIGN KEY(parent_run_id) REFERENCES creative_runs(id)
);
CREATE INDEX IF NOT EXISTS creative_runs_created_idx ON creative_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS creative_runs_provider_idx ON creative_runs(provider,model,created_at DESC);
CREATE INDEX IF NOT EXISTS creative_runs_asset_idx ON creative_runs(provider_asset_id);
CREATE INDEX IF NOT EXISTS creative_runs_parent_idx ON creative_runs(parent_run_id,created_at);
CREATE INDEX IF NOT EXISTS creative_runs_rating_idx ON creative_runs(rating,created_at DESC);

CREATE TABLE IF NOT EXISTS creative_run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  preview TEXT,
  FOREIGN KEY(run_id) REFERENCES creative_runs(id)
);
CREATE INDEX IF NOT EXISTS creative_run_events_run_idx ON creative_run_events(run_id,created_at);

-- Keep every historical R2 asset visible without pretending missing evidence exists.
INSERT OR IGNORE INTO creative_runs
  (id,created_at,updated_at,status,kind,channel,directory_key,provider,model,prompt,
   request_preview,result_preview,asset_id,asset_url,r2_asset_key,rating,feedback,version_label)
SELECT 'legacy_' || id,created_at,created_at,'legacy_missing_payload',
  CASE WHEN lower(COALESCE(r2_key,'')) LIKE '%.mp4' THEN 'video' ELSE 'image' END,
  COALESCE(NULLIF(protocol,''),NULLIF(chat,''),'legacy asset import'),'LEGACY_ASSET',
  CASE WHEN engine LIKE 'arcads:%' THEN 'arcads' WHEN engine='grok' THEN 'xai' WHEN engine IN ('openai','gpt-image') THEN 'openai' ELSE engine END,
  CASE WHEN instr(COALESCE(engine,''),':')>0 THEN substr(engine,instr(engine,':')+1) ELSE engine END,
  prompt,'Unavailable: this asset predates durable creative provenance.',
  json_object('asset_url',url,'r2_key',r2_key,'source_url',source_url),
  id,url,r2_key,'unreviewed',NULL,'Imported legacy asset'
FROM assets;

INSERT OR REPLACE INTO directory
  (key,type,target,auth,content,category,planner_rank,enabled,planner_visible,sensitive,updated_at)
VALUES ('CREATIVE_GENERATE','fn','creativeAdminGenerate','',
'# WHAT: Generate one explicitly owner-requested image/video version while preserving its exact payload, raw response, channel, R2 result, and parent lineage in creative_runs.
# ARGS: one JSON object: {engine,prompt,model?,size?,aspect_ratio?,reference_url?,duration?,resolution?,product_id?,enhance?}. engine=openai|grok|arcads-image|arcads-video.
# EX: [CREATIVE_GENERATE]{"engine":"grok","prompt":"exact prompt"}[/CREATIVE_GENERATE]
# TESTS: pipe characters inside prompt survive because the whole JSON body uses $1+; this row never runs unless explicitly invoked.
["$1+"]',
'creative',20,1,0,1,datetime('now'));

-- Owner correction, permanently scored. No generation is needed to test the law.
INSERT INTO directory_tests (key,kind,args,tier,expect_kind,expect_value,expected_text,note)
VALUES ('ROUTER','e2e','When the build generates an image or video, what must be preserved so I can judge and version the creative?',4,'reply_ok','payload|response|channel|good|bad|version','Preserve the exact provider request payload, raw provider response and final asset/result, the generation channel/tool/model, and the owner good/bad review plus parent/child version lineage.','creative provenance law');
