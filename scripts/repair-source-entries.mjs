#!/usr/bin/env node
// Corpus repair for SOURCE_QUOTE_LAW: source entries that are not objects.
//
// A `meta.sources` array is meant to hold {type,url,title,quote,...}. Some articles hold bare
// strings — a sentence someone meant as a note, sitting where a source object belongs. Every one of
// them renders as an empty fallback card: no quote, no link, no provenance. There is no version of
// that entry a reader benefits from, so the repair removes them and rechains the ledger.
//
// The write path now refuses these (functions/_lib/source_law.js), and scripts/check-source-quotes.mjs
// fails the deploy if one reappears. This closes the ones already stored.
//
// Usage: node scripts/repair-source-entries.mjs [--apply]
//        Without --apply it reports what it would change and touches nothing.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const DB = 'loop-content-spine';
const WINDOW = 200;
const APPLY = process.argv.includes('--apply');

function d1(sql) {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
  });
  const out = String(r.stdout || '');
  if (r.status !== 0 || !out.trim().startsWith('[')) throw new Error((String(r.stderr || '') + out).slice(-500));
  return JSON.parse(out)[0]?.results || [];
}

/** The same source-ledger body the write path hashes, so a rechained ledger still verifies. */
function srcBody(s) {
  return [s.id, s.type, s.url, s.title, s.quote, s.summary, (s.claim_ids || []).join(','), s.accessed_at, s.prev].join('|');
}
function sha256(t) { return createHash('sha256').update(String(t)).digest('hex'); }

const hi = Number(d1('SELECT MAX(rowid) AS hi FROM articles')[0]?.hi || 0);
const affected = new Map();
for (let lo = 0; lo < hi; lo += WINDOW) {
  const rows = d1(
    `SELECT a.slug, COUNT(*) AS n FROM articles a, json_each(a.meta,'$.sources') j`
    + ` WHERE a.rowid>${lo} AND a.rowid<=${lo + WINDOW} AND json_type(a.meta,'$.sources')='array'`
    + ` AND j.type<>'object' GROUP BY a.slug`,
  );
  for (const r of rows) affected.set(r.slug, Number(r.n));
}

if (!affected.size) {
  console.log(JSON.stringify({ ok: true, law: 'SOURCE_QUOTE_LAW', repaired: 0, note: 'no non-object source entries in the corpus' }));
  process.exit(0);
}

const plan = [];
for (const [slug, n] of affected) {
  const row = d1(`SELECT json_extract(meta,'$.sources') AS s FROM articles WHERE slug='${slug.replace(/'/g, "''")}'`);
  const list = JSON.parse(row[0]?.s || '[]');
  const kept = list.filter((e) => e && typeof e === 'object' && !Array.isArray(e));
  const dropped = list.length - kept.length;
  // Rechain what remains so the public source-ledger verification at
  // GET /api/articles/<slug>/sources still reports a valid chain after the removal.
  let prev = 'genesis';
  for (const s of kept) { s.prev = prev; s.hash = sha256(srcBody(s)); prev = s.hash; }
  plan.push({ slug, non_objects: n, before: list.length, after: kept.length, dropped, kept, head: prev });
}

if (!APPLY) {
  console.log(JSON.stringify({
    ok: true, law: 'SOURCE_QUOTE_LAW', dry_run: true,
    articles: plan.map(({ slug, before, after, dropped }) => ({ slug, before, after, dropped })),
    total_dropped: plan.reduce((a, p) => a + p.dropped, 0),
    apply_with: 'node scripts/repair-source-entries.mjs --apply',
  }, null, 2));
  process.exit(0);
}

let done = 0;
for (const p of plan) {
  const json = JSON.stringify(p.kept).replace(/'/g, "''");
  d1(
    `UPDATE articles SET meta=json_set(json_set(meta,'$.sources',json('${json}')),'$.source_head','${p.head}'),`
    + ` updated_at='${new Date().toISOString()}' WHERE slug='${p.slug.replace(/'/g, "''")}'`,
  );
  done += 1;
}
console.log(JSON.stringify({
  ok: true, law: 'SOURCE_QUOTE_LAW', applied: true, articles_repaired: done,
  total_dropped: plan.reduce((a, x) => a + x.dropped, 0),
  articles: plan.map(({ slug, dropped, after }) => ({ slug, dropped, sources_now: after })),
}, null, 2));
