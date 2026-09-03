-- THE ENRICHED LEAD LIST GOES TO THE SHEET WHOLE, IN CHUNKS, EACH CHUNK CONFIRMED.
--
-- LEADS_SHEET_ENRICHED ended in `LIMIT 30`. That was not a chosen sample: 5,000 rows came back as the
-- Apps Script's health payload, then 2,000, then 400, and 30 was the number that happened to survive
-- the transport. The sheet showed 30 of 5,841 resolved contacts and read as complete.
--
-- LEADS_SHEET_PUSH replaces the single oversized request with chunks well under where the transport
-- starts dropping bodies, retries a chunk that never arrived, and totals only what the script's own
-- receipts confirm. LEADS_SHEET_ENRICHED now points at it so no caller can reach the capped flow.

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, enabled, sensitive, planner_visible, planner_rank, input_schema, updated_at, created_at)
VALUES (
  'LEADS_SHEET_PUSH', 'fn', 'leadsSheetPush', '',
  '# WHAT: Write every enriched lead (name, city, email, score, website, status) to the LEADS_ENRICHED tab of the master sheet, in chunks, and report how many rows the script itself confirmed writing.
# WHY IN CHUNKS: a single large POST to the Apps Script loses its body — the health payload comes back and nothing is written. One request per chunk stays under that, a dropped chunk is retried, and the total returned is the sum of the receipts, never the number of rows sent.
# WHEN_TO_USE: after an enrichment run, or any time the sheet needs to match D1. Re-running is safe: the first chunk replaces the tab rather than appending to it.
# ARGS: $1 = rows per chunk (default 250, min 25, max 500). $2 = max rows total (default 0 = every enriched lead).
# EX: [LEADS_SHEET_PUSH]250[/LEADS_SHEET_PUSH]
["$1","$2"]',
  'biz-dev', 1, 0, 1, 40, NULL, '2026-08-05T06:34:00Z', '2026-08-05T06:34:00Z'
);

-- The old flow becomes a pointer. Nothing keeps a path to `LIMIT 30`.
UPDATE directory
   SET type = 'flow',
       updated_at = '2026-08-05T06:34:00Z',
       content = '# Superseded 2026-08-05. This flow ended in `LIMIT 30` because larger payloads were silently dropped by the transport; it wrote 30 of 5,841 resolved contacts and looked complete. LEADS_SHEET_PUSH chunks the write and counts only confirmed receipts.
LEADS_SHEET_PUSH: $1'
 WHERE key = 'LEADS_SHEET_ENRICHED';
