#!/usr/bin/env node
// Populate article_links from the corpus that already exists.
//
// WHY. The edge table is written at the article write path, so it only ever learns
// about articles published after it shipped. Every link typed before 2026-08-06
// lives in a body and nowhere else. This reads them once.
//
// WHY IT RUNS HERE AND NOT IN A WORKER. Extracting edges corpus-wide means reading
// every body — ~90 MB. Doing that inside a request is the exact defect this table
// was built to remove (GET /api/articles/graph-links answered 1102). The backfill
// is a one-off local pass in rowid windows; the steady state is one article at a
// time at the write path.
//
// The extractor is IMPORTED from functions/_lib/article_links.js, never re-written
// here. Two copies of a link regex is two link graphs.
//
// Usage:
//   node scripts/backfill-article-links.mjs            # write
//   node scripts/backfill-article-links.mjs --dry-run  # report only

import { spawnSync } from "node:child_process";
import { extractLinks, VIRTUAL_PAGES } from "../functions/_lib/article_links.js";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const DB = "loop-content-spine";
const DRY = process.argv.includes("--dry-run");
// Bodies are wide. Narrow windows keep a single wrangler call inside D1's response
// limits; every window is scanned, so this is paging, not sampling.
const WINDOW = 25;

function d1(sql, attempt = 0) {
  const r = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", DB, "--remote", "--json", "--command", sql],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  const out = String(r.stdout || "");
  const all = String(r.stderr || "") + out;
  if (r.status !== 0 || !out.trim().startsWith("[")) {
    if (
      /7429|isolate exceeded its memory limit|Network connection lost|fetch failed/i.test(
        all,
      ) &&
      attempt < 4
    ) {
      return d1(sql, attempt + 1);
    }
    throw new Error("d1 failed: " + all.slice(-500));
  }
  return JSON.parse(out)[0]?.results || [];
}

const q = (s) => String(s).replace(/'/g, "''");

// Only articles that can carry an edge are read. An article with no link pattern
// and no embeds contributes zero rows, so pulling its body would be pure cost.
const CANDIDATE_WHERE = `published = 1 AND (
     body LIKE '%](/a/%'
  OR body LIKE '%](https://miscsubjects.com/a/%'
  OR body LIKE '%[[%'
  OR json_extract(meta,'$.embeds') IS NOT NULL )`;

// RECONCILIATION, BEFORE EXTRACTION. The candidate filter below exists so the pass
// reads only bodies that can carry an edge. On its own that makes the backfill
// incapable of ever REMOVING an edge: an article whose links were deleted no longer
// matches the filter, is never visited, and keeps its rows forever. Observed
// 2026-08-06 — ten oip-convergence-edge pages were repaired upstream and the graph
// still reported 100 broken links pointing at pages nobody had linked to in hours.
//
// So the pass first deletes every row that cannot be re-derived: rows from articles
// that are no longer published, and rows from published articles that no longer
// carry any link pattern at all. Everything surviving is then re-extracted below.
function reconcile() {
  const gone = d1(
    `DELETE FROM article_links
       WHERE from_slug NOT IN (SELECT slug FROM articles WHERE published = 1)`,
  );
  const emptied = d1(
    `DELETE FROM article_links
       WHERE from_slug IN (
         SELECT slug FROM articles WHERE published = 1 AND NOT (${CANDIDATE_WHERE})
       )`,
  );
  return { gone, emptied };
}

console.log("reading the published slug set…");
const slugRows = d1("SELECT slug FROM articles WHERE published = 1");
const known = new Set(slugRows.map((r) => r.slug));
// The same rule the write path uses. Two resolvers would be two link graphs.
const resolvable = (t) => known.has(t) || VIRTUAL_PAGES.has(t);
// The same rule the write path uses: a target exists if the corpus holds it OR the
// site renders it. Two resolvers would be two link graphs.
const resolvable = (t) => known.has(t) || VIRTUAL_PAGES.has(t);
console.log(`  ${known.size} published articles`);

const bounds = d1(
  `SELECT MIN(rowid) AS lo, MAX(rowid) AS hi, COUNT(*) AS n FROM articles WHERE ${CANDIDATE_WHERE}`,
)[0];
const lo = Number(bounds?.lo || 0);
const hi = Number(bounds?.hi || 0);
console.log(`  ${bounds?.n || 0} candidates carrying a link pattern`);

if (!DRY) {
  console.log("reconciling rows that can no longer be re-derived…");
  reconcile();
  const left = d1("SELECT COUNT(*) AS n FROM article_links")[0];
  console.log(`  ${left.n} rows remain before re-extraction`);
}

let scanned = 0;
let edges = 0;
let unresolved = 0;
const perArticle = [];
const wantedBy = new Map();

for (let start = lo; start <= hi; start += WINDOW) {
  const rows = d1(
    `SELECT slug, body, meta FROM articles
      WHERE ${CANDIDATE_WHERE} AND rowid >= ${start} AND rowid < ${start + WINDOW}`,
  );
  for (const r of rows) {
    scanned++;
    const links = extractLinks(r.body, r.meta).filter((l) => l.target !== r.slug);
    if (!links.length) continue;
    let u = 0;
    for (const l of links) {
      if (!resolvable(l.target)) {
        u++;
        wantedBy.set(l.target, (wantedBy.get(l.target) || 0) + 1);
      }
    }
    edges += links.length;
    unresolved += u;
    perArticle.push({ slug: r.slug, links });
  }
  process.stdout.write(
    `\r  scanned ${scanned} · ${edges} edges · ${unresolved} unresolved`,
  );
}
console.log("");

if (DRY) {
  console.log(`\nDRY RUN — nothing written.`);
  console.log(`  articles with at least one edge: ${perArticle.length}`);
  console.log(`  edges: ${edges}  (unresolved: ${unresolved})`);
  const top = [...wantedBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (top.length) {
    console.log(`\n  most-wanted pages that do not exist:`);
    for (const [t, n] of top) console.log(`    ${String(n).padStart(3)}  ${t}`);
  }
  process.exit(0);
}

// Written in statement batches. Each article's rows are deleted then inserted, so
// re-running the backfill converges rather than duplicating.
const BATCH = 60;
let written = 0;
const now = new Date().toISOString();
let pending = [];

function flush() {
  if (!pending.length) return;
  d1(pending.join(" "));
  written += pending.length;
  pending = [];
  process.stdout.write(`\r  wrote ${written} statements`);
}

for (const a of perArticle) {
  pending.push(`DELETE FROM article_links WHERE from_slug='${q(a.slug)}';`);
  for (const l of a.links) {
    const hit = resolvable(l.target);
    pending.push(
      `INSERT OR REPLACE INTO article_links (from_slug,target,kind,to_slug,label,anchor,resolved,updated_at) VALUES (` +
        `'${q(a.slug)}','${q(l.target)}','${l.kind}',` +
        `${hit ? `'${q(l.target)}'` : "NULL"},` +
        `${l.label ? `'${q(l.label)}'` : "NULL"},` +
        `${l.anchor ? `'${q(l.anchor)}'` : "NULL"},` +
        `${hit ? 1 : 0},'${now}');`,
    );
  }
  if (pending.length >= BATCH) flush();
}
flush();
console.log("");

const after = d1(
  `SELECT COUNT(*) AS edges,
          SUM(CASE WHEN resolved=0 THEN 1 ELSE 0 END) AS unresolved,
          COUNT(DISTINCT from_slug) AS linking
     FROM article_links`,
)[0];
console.log(`\nstored: ${after.edges} edges from ${after.linking} articles`);
console.log(`unresolved: ${after.unresolved}`);
console.log(
  `unlinked articles: ${known.size - Number(after.linking || 0)} of ${known.size}`,
);
