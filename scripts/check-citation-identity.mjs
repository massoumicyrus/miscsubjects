#!/usr/bin/env node
// CITATION_IDENTITY_LAW — does the identifier point at the paper we say it does?
//
// THE VISIBLE FAILURE. /a/retatrutide-stimulants cites source s2 as "Selank Administration Affects
// the Expression of Some Genes…" with PMID 19137605. That PMID is a survey of gastroenterologists'
// awareness of AGA guidelines on metabolic bone disease in inflammatory bowel disease. The link
// resolves, the page loads, the reference looks impeccable — and it is not the paper being cited.
//
// THE LAYER THAT PERMITTED IT. Every existing check on sources tests whether the URL is reachable
// (link_status) and whether the quote appears on the page (quote_status). Neither asks the question
// that matters: is the record at this identifier the record we named? A dead link is obvious to any
// reader. A live link to the wrong paper is invisible, survives every check, and is worse — because
// it looks verifiable.
//
// THE INVARIANT. A citation carrying a PubMed identifier must have a title that matches the title
// of the record at that identifier. Not exactly — punctuation, subtitles and casing differ between
// stores — but recognisably, by word overlap.
//
// Usage: node scripts/check-citation-identity.mjs [--limit N] [--all]
//   Default samples the health corpus, which is where a wrong citation does the most damage.
//   --all scans every article carrying PubMed-identified sources.

import { spawnSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const DB = 'miscsubjects-content';
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 400);
const ALL = process.argv.includes('--all');
const MATCH_FLOOR = 0.34;

function d1(sql, attempt = 0) {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const out = String(r.stdout || '');
  const all = String(r.stderr || '') + out;
  if (r.status !== 0 || !out.trim().startsWith('[')) {
    if (/7429|isolate exceeded|Network connection lost|fetch failed/i.test(all) && attempt < 4) return d1(sql, attempt + 1);
    if (/not (logged in|authenticated)|CLOUDFLARE_API_TOKEN|Unable to authenticate|ENOENT/i.test(all)) return { no_credentials: all.slice(-200) };
    return { error: all.slice(-300) };
  }
  try { return { rows: JSON.parse(out)[0]?.results || [] }; } catch (e) { return { error: String(e.message) }; }
}

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'for', 'with', 'to', 'by', 'from',
  'is', 'are', 'as', 'at', 'its', 'their', 'this', 'that', 'study', 'trial', 'review', 'analysis',
  'randomized', 'randomised', 'controlled', 'systematic', 'clinical', 'effects', 'effect', 'using']);

const words = (s) => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)));

function share(from, to) {
  if (!from.size || !to.size) return 1; // nothing to compare on — not evidence of a mismatch
  let hit = 0;
  for (const w of from) if (to.has(w)) hit += 1;
  return hit / from.size;
}

/**
 * How much the stored title and the real title are the same paper, scored in BOTH directions.
 *
 * One direction is not enough. Many stored titles carry an author list in front of the title —
 * "Cutuli M, Cristiani S, Lipton JM, Catania A. Antimicrobial effects of alpha-MSH peptides." The
 * surnames dilute the forward score to 0.25 and the citation gets reported as wrong when it is
 * exactly right. Scoring the real title's words against the stored string catches that case at 1.0.
 * A genuine mismatch scores near zero in both directions, which is what separates the two.
 */
function overlap(stored, real) {
  const a = words(stored); const b = words(real);
  return Math.max(share(a, b), share(b, a));
}

async function realTitle(pmid) {
  const u = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  u.searchParams.set('query', `EXT_ID:${pmid} AND SRC:MED`);
  u.searchParams.set('format', 'json');
  const r = await fetch(u).catch(() => null);
  if (!r || !r.ok) return null;
  const j = await r.json().catch(() => null);
  const rec = j?.resultList?.result?.[0];
  return rec ? String(rec.title || '').replace(/<[^>]+>/g, '').replace(/\.$/, '') : null;
}

const HEALTH = "(a.slug LIKE '%bpc%' OR a.slug LIKE '%tb-500%' OR a.slug LIKE '%ara-290%' OR a.slug LIKE '%peptide%'"
  + " OR a.slug LIKE '%disc%' OR a.slug LIKE '%sciatic%' OR a.slug LIKE '%tendon%' OR a.slug LIKE '%tendinopathy%'"
  + " OR a.slug LIKE '%neuropath%' OR a.slug LIKE '%shoulder%' OR a.slug LIKE '%stenosis%' OR a.slug LIKE '%fasciitis%'"
  + " OR a.slug LIKE '%carpal%' OR a.slug LIKE '%facet%' OR a.slug LIKE '%sacroiliac%' OR a.slug LIKE '%cuff%'"
  + " OR a.slug LIKE '%semaglutide%' OR a.slug LIKE '%tirzepatide%' OR a.slug LIKE '%retatrutide%' OR a.slug LIKE '%stack%'"
  + " OR a.slug LIKE '%ghk%' OR a.slug LIKE '%kpv%' OR a.slug LIKE '%semax%' OR a.slug LIKE '%selank%'"
  + " OR a.slug LIKE '%thymosin%' OR a.slug LIKE '%pt-141%' OR a.slug LIKE '%dsip%' OR a.slug LIKE '%kisspeptin%')";

const sql = `SELECT a.slug, json_extract(j.value,'$.id') sid,
   COALESCE(json_extract(j.value,'$.pmid'), json_extract(j.value,'$.external_id')) pmid,
   json_extract(j.value,'$.url') url, json_extract(j.value,'$.title') title
 FROM articles a, json_each(a.meta,'$.sources') j
 WHERE json_type(a.meta,'$.sources')='array' AND j.type='object'
   AND json_extract(j.value,'$.url') LIKE '%pubmed.ncbi.nlm.nih.gov%'
   AND COALESCE(json_extract(j.value,'$.title'),'') <> ''
   ${ALL ? '' : 'AND ' + HEALTH}
 LIMIT ${LIMIT}`;

const res = d1(sql);
if (res.no_credentials) {
  console.log(JSON.stringify({ ok: true, law: 'CITATION_IDENTITY_LAW', skipped: 'no D1 credentials in this environment (CI)' }));
  process.exit(0);
}
if (res.error) {
  console.error(JSON.stringify({ ok: false, law: 'CITATION_IDENTITY_LAW', error: res.error }));
  process.exit(1);
}

const mismatches = [];
let checked = 0;
let unresolvable = 0;
for (const row of res.rows) {
  const pmid = String(row.pmid || (String(row.url || '').match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/) || [])[1] || '');
  if (!/^\d{5,9}$/.test(pmid)) continue;
  const real = await realTitle(pmid);
  if (real === null) { unresolvable += 1; continue; }
  checked += 1;
  const score = overlap(row.title, real);
  if (score < MATCH_FLOOR) {
    mismatches.push({
      slug: row.slug, source_id: row.sid, pmid,
      cited_as: String(row.title).slice(0, 90),
      actually_is: real.slice(0, 90),
      word_overlap: Number(score.toFixed(2)),
    });
  }
}

const report = {
  law: 'CITATION_IDENTITY_LAW',
  scope: ALL ? 'whole corpus' : 'health corpus',
  citations_checked: checked,
  unresolvable_identifiers: unresolvable,
  mismatches: mismatches.length,
};

if (mismatches.length) {
  console.error(JSON.stringify({
    ok: false, ...report, detail: mismatches,
    why: 'A citation whose identifier points at a different paper is worse than a dead link: it '
      + 'resolves, it looks verifiable, and it survives every link and quote check. Correct the '
      + 'identifier or remove the source.',
  }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, ...report }));
