// Grounding ratio — the anti-sealed-canon tripwire (owner brief 2026-07-24,
// builder #39). Corpus-wide external-sources-per-claim plus the fraction of
// claims carrying at least one source id. Public, cacheable, cheap to poll.
// Constitutional floor: below GROUNDING_FLOOR the response says so plainly.
const GROUNDING_FLOOR = 0.5;

export async function onRequestGet(context) {
  const { env } = context;
  // The published rows are not all articles: source ledgers, source records and audit
  // records live in the same table under meta.register. This endpoint used to report the
  // whole row count as "articles", which contradicted /latest and /audit by the site's own
  // arithmetic (1015 + 1100 + 25 + 10 = 2150). Both figures are now reported under names
  // that mean what they say.
  const totals = await env.DB.prepare(
    `SELECT COUNT(*) AS published_records,
            SUM(CASE WHEN COALESCE(json_extract(meta,'$.register'),'standard')
                     IN ('source_ledger','source','audit') THEN 0 ELSE 1 END) AS articles,
            SUM(COALESCE(json_array_length(json_extract(meta,'$.claims')),0)) AS claims_total,
            SUM(COALESCE(json_array_length(json_extract(meta,'$.sources')),0)) AS sources_total
     FROM articles WHERE published = 1`,
  ).first();
  // claims_with_sources_fraction is the figure the public pages point at, so it has to
  // actually compute. It returned null in production because 35 of the 10,479 claim entries
  // are bare strings rather than objects, and EVERY per-element JSON function — json_extract,
  // json_type, even json_valid applied to the element — aborts the whole statement on the
  // first one it meets. Measured, not assumed: json_each alone returns all 10,479 rows;
  // adding any json_*(c.value) call fails with SQLITE_ERROR malformed JSON.
  //
  // So the element test is text-level, which never parses: an object serializes starting
  // with '{', and a populated source list cannot serialize as an empty array. This is a
  // deliberate approximation of a JSON read — it is reported as such in the response, and
  // it is the difference between publishing the ratio and publishing null.
  let sourced = null;
  try {
    sourced = await env.DB.prepare(
      `SELECT COUNT(*) AS claims,
              SUM(CASE WHEN v LIKE '{%'
                        AND v LIKE '%"source_ids"%'
                        AND v NOT LIKE '%"source_ids":[]%'
                        AND v NOT LIKE '%"source_ids": []%'
                       THEN 1 ELSE 0 END) AS sourced
       FROM (SELECT c.value AS v
               FROM articles,
                    json_each(CASE WHEN json_valid(meta) = 1
                                    AND json_type(json_extract(meta,'$.claims')) = 'array'
                                   THEN json_extract(meta,'$.claims') ELSE '[]' END) AS c
              WHERE published = 1)`,
    ).first();
  } catch {
    sourced = null;
  }
  const claims = Number(totals?.claims_total || 0);
  const sources = Number(totals?.sources_total || 0);
  const ratio = claims ? Math.round((sources / claims) * 1000) / 1000 : null;
  const sourcedFraction =
    sourced && Number(sourced.claims)
      ? Math.round((Number(sourced.sourced) / Number(sourced.claims)) * 1000) / 1000
      : null;
  const body = {
    computed_at: new Date().toISOString(),
    articles: Number(totals?.articles || 0),
    published_records: Number(totals?.published_records || 0),
    counts_note:
      "articles excludes the source_ledger, source and audit registers, which share the same table; published_records counts every published row. articles is the figure /latest reports.",
    claims_total: claims,
    sources_total: sources,
    sources_per_claim: ratio,
    claims_with_sources_fraction: sourcedFraction,
    claims_with_sources_method:
      "text-level test on each serialized claim ('{' prefix, a source_ids key, a non-empty array); per-element JSON functions cannot be used because a minority of claim entries are bare strings and any json_*() call on them aborts the statement",
    floor: GROUNDING_FLOOR,
    above_floor: ratio == null ? null : ratio >= GROUNDING_FLOOR,
    note: "sources_per_claim below the floor means the corpus is citing itself faster than it cites the world.",
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300, must-revalidate",
      "access-control-allow-origin": "*",
    },
  });
}
