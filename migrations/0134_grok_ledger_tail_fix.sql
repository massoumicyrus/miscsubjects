-- 0134: GROK_LEDGER_TAIL queried a phantom `grok_ledger` table → D1_ERROR: no such table.
-- That table was migrated away; the live ledger is the events table in miscsubjects-events,
-- read via LEDGER_QUERY (D1_QUERY targets miscsubjects-content, which has no events table).
-- Repoint the flow at events with its real columns (ts/source, not timestamp).
UPDATE directory
SET content = '# Last 20 ledger rows (id, ts, source, action, status). Use to find a recent LLM/HTTP call, then LEDGER_QUERY its request_json / response_json by id.
LEDGER_QUERY: SELECT id, ts, source, action, status FROM events ORDER BY ts DESC LIMIT 20',
    updated_at = '2026-06-21T00:00:00Z'
WHERE key = 'GROK_LEDGER_TAIL';
