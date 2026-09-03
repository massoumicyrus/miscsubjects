-- 0044: turn watchdog. A routed agent turn (phase B) can die mid-flight when its model
-- call runs long (web search turns take minutes and can outlive the invocation). The
-- job is persisted BEFORE phase B runs; /api/deliver re-posts stale running jobs.

CREATE TABLE IF NOT EXISTS turn_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_json TEXT NOT NULL,
  status TEXT DEFAULT 'running',  -- running | done | failed
  attempts INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS turn_jobs_status_idx ON turn_jobs(status);
