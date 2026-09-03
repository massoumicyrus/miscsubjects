-- 0219 — LEDGER db (loop-shared-events).
-- events_stats: incrementally-maintained rollup so no view ever GROUP-BYs the full events table.
-- Backfilled here once; event_log.js keeps it current on every insert.
CREATE TABLE IF NOT EXISTS events_stats (
  source  TEXT NOT NULL,
  key     TEXT NOT NULL DEFAULT '',
  n       INTEGER NOT NULL DEFAULT 0,
  errors  INTEGER NOT NULL DEFAULT 0,
  last_ts TEXT,
  PRIMARY KEY (source, key)
);

INSERT INTO events_stats (source, key, n, errors, last_ts)
SELECT source,
       COALESCE(key, ''),
       COUNT(*),
       SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END),
       MAX(ts)
FROM events
GROUP BY source, COALESCE(key, '')
ON CONFLICT(source, key) DO UPDATE SET
  n = excluded.n,
  errors = excluded.errors,
  last_ts = excluded.last_ts;

-- Covering index for any residual ad-hoc source/key aggregation.
CREATE INDEX IF NOT EXISTS events_source_key_idx ON events(source, key);

-- Partial index: rows still holding full payloads in D1. The archive tick scans this;
-- it shrinks toward empty as payloads move to R2, so the scan stays O(batch).
CREATE INDEX IF NOT EXISTS events_payload_resident_idx ON events(ts)
  WHERE request_json IS NOT NULL OR response_json IS NOT NULL;
