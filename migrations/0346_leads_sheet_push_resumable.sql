UPDATE directory
   SET updated_at = '2026-08-05T06:52:00Z',
       content = '# WHAT: Write the enriched lead list (name, city, email, score, website, status) to the LEADS_ENRICHED tab of the master sheet, in chunks, reporting how many rows the Apps Script itself confirmed writing.
# WHY IN CHUNKS, AND WHY RESUMABLE: one large POST to the Apps Script loses its body and nothing is written; and the full 5,841 rows take more sequential round-trips to Google than Cloudflare''s 100-second edge limit allows, which returned 524 with the work half done. So each call does a bounded number of chunks and hands back next_offset. Offset 0 replaces the tab (a re-run from 0 is idempotent); any offset above 0 appends. Keep calling with next_offset until done is true.
# WHEN_TO_USE: after an enrichment run, or any time the sheet needs to match D1.
# ARGS: $1 = rows per chunk (default 250, min 25, max 500). $2 = start offset (default 0). $3 = chunks this call (default 4, max 8). $4 = max rows total (default 0 = every enriched lead).
# EX: [LEADS_SHEET_PUSH]500|0|6[/LEADS_SHEET_PUSH] then [LEADS_SHEET_PUSH]500|3000|6[/LEADS_SHEET_PUSH]
["$1","$2","$3","$4"]'
 WHERE key = 'LEADS_SHEET_PUSH';
