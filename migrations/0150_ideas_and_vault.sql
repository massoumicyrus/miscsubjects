
-- Ideas table: append-only, hash-chained, linkable
CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL CHECK(level IN ('macro', 'meso', 'micro', 'nano', 'prompt')),
  title TEXT NOT NULL,
  body TEXT,
  status TEXT DEFAULT 'raw' CHECK(status IN ('raw', 'refined', 'approved', 'implemented', 'archived')),
  parent_id TEXT,
  tags TEXT,        -- JSON array
  links TEXT,       -- JSON array of {type, target_id}
  source TEXT,      -- 'sms', 'rest', 'model', 'cron'
  author TEXT,
  hash TEXT,        -- SHA-256 of content
  prev_hash TEXT,   -- previous version hash (append-only chain)
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Vault events table: audit trail of every mutation attempt
CREATE TABLE IF NOT EXISTS vault_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TIMESTAMP NOT NULL,
  file_path TEXT NOT NULL,
  change_type TEXT,
  actor TEXT,
  tier INTEGER CHECK(tier IN (1, 2, 3)),
  blocked INTEGER DEFAULT 0,  -- 0 = allowed, 1 = blocked
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ideas_level ON ideas(level);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_parent ON ideas(parent_id);
CREATE INDEX IF NOT EXISTS idx_vault_events_ts ON vault_events(ts);
CREATE INDEX IF NOT EXISTS idx_vault_events_path ON vault_events(file_path);

-- Cron runs table: every cron job execution is logged here
CREATE TABLE IF NOT EXISTS cron_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TIMESTAMP NOT NULL,
  job_name TEXT NOT NULL,
  cost REAL DEFAULT 0,
  time_ms INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  files INTEGER DEFAULT 0,
  rows INTEGER DEFAULT 0,
  bytes INTEGER DEFAULT 0,
  notifications INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_ts ON cron_runs(ts);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs(job_name);
