// ONE CANONICAL CORPUS COUNT (defect fixed 2026-08-08): the homepage feed block said
// "1,015 articles" (its own filtered feed length — meta.home != 0) while the identity
// block on the SAME page said "1,173 articles" (llms.txt's own query), and the claims
// counts split the same way (10,479 vs 10,903). Two queries, two truths, one page.
//
// A raw COUNT(*) of the `articles` table is also wrong (~2,344): that table holds
// non-article registers — source_ledger, source, audit — so any published number must
// name its register set or it will be read as a contradiction by the next cold model.
//
// This is the ONE query every displayed number comes from:
//   published = 1, register NOT IN ('source_ledger','source','audit')
// i.e. published articles across all reader registers. Surfaces may still FILTER what
// they list (the homepage feed hides meta.home = 0 cards), but the NUMBERS they display
// come from here. Computed fresh per request — never cached across requests, so the
// figure is live at render, the same guarantee llms.txt already made.

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
