// Writer-queue cron matches enrichment pipeline tasks by source column (not literal "writer-queue").

export const WRITER_QUEUE_SOURCES = [
  "writer",
  "source-hunt",
  "anecdote-hunt",
  "reddit-x-hunt",
  "repair",
  "fill-slots",
  "prose",
  "kimi",
  "gemini",
  "writer-queue",
  "adversary",
  "poll",
];

/** Sub-priority within writer-queue rows (parsed from tasks.body JSON). */
export const WRITER_QUEUE_POST_TO_ORDER_SQL = `CASE
  WHEN body LIKE '%/api/protocol/write%' THEN 1
  WHEN body LIKE '%/api/protocol/populate%' THEN 2
  WHEN body LIKE '%/api/protocol/repair%' THEN 3
  WHEN body LIKE '%/api/protocol/fill-slots%' THEN 4
  WHEN body LIKE '%/api/protocol/synthesize-body%' THEN 5
  WHEN body LIKE '%/api/protocol/collaborate%' THEN 6
  WHEN body LIKE '%/api/protocol/poll%' THEN 7
  WHEN body LIKE '%/api/protocol/critique%' THEN 8
  ELSE 9 END`;

/** SQL ORDER BY — new articles first, enrichment tail last. */
export const WRITER_QUEUE_ORDER_SQL = `CASE LOWER(COALESCE(source,''))
  WHEN 'writer' THEN 1
  WHEN 'source-hunt' THEN 2
  WHEN 'anecdote-hunt' THEN 3
  WHEN 'reddit-x-hunt' THEN 4
  WHEN 'repair' THEN 5
  WHEN 'fill-slots' THEN 6
  WHEN 'prose' THEN 7
  WHEN 'kimi' THEN 8
  WHEN 'gemini' THEN 9
  WHEN 'writer-queue' THEN 10
  WHEN 'adversary' THEN 11
  WHEN 'poll' THEN 12
  ELSE 99 END,
  ${WRITER_QUEUE_POST_TO_ORDER_SQL},
  CASE WHEN LOWER(COALESCE(source,''))='writer' THEN -id ELSE id END`;

export function isWriterQueueRole(want) {
  return String(want || "").toLowerCase().trim() === "writer-queue";
}

export function writerQueueInClause() {
  return WRITER_QUEUE_SOURCES.map(() => "?").join(", ");
}

export function writerQueueBindParams() {
  return WRITER_QUEUE_SOURCES.map((s) => s.toLowerCase());
}

/** Skip full rewrite when ledger already populated (enrich-only corpus). */
export function articleIsEnriched(meta, opts = {}) {
  const claims = (meta?.claims || []).length;
  const sources = (meta?.sources || []).length;
  const minClaims = opts.min_claims ?? 8;
  const minSources = opts.min_sources ?? 6;
  return claims >= minClaims || sources >= minSources;
}