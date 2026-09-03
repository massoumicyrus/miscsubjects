
export const CORPUS_EXCLUDED_REGISTERS = ["source_ledger", "source", "audit"];

export const CORPUS_COUNT_LABEL =
  "published articles across all reader registers (excludes source_ledger/source/audit)";

/** The canonical corpus counts: { articles, claims, sources }. One query, one truth. */
export async function corpusCounts(env) {
  const r = await env.DB.prepare(
    `SELECT COUNT(*) AS articles,
            SUM(COALESCE(json_array_length(json_extract(meta,'$.claims')),0)) AS claims,
            SUM(COALESCE(json_array_length(json_extract(meta,'$.sources')),0)) AS sources
     FROM articles
     WHERE published = 1
       AND COALESCE(json_extract(meta,'$.register'),'standard') NOT IN ('source_ledger','source','audit')`,
  ).first();
  return {
    articles: Number(r?.articles) || 0,
    claims: Number(r?.claims) || 0,
    sources: Number(r?.sources) || 0,
  };
}
