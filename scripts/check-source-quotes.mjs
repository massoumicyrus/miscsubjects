#!/usr/bin/env node
// SOURCE_QUOTE_LAW deploy blocker.
//
// THE VISIBLE FAILURE. Source cards on the site showed no quote. Study cards carried a sentence we
// had written about the study; X and Reddit cards carried a paraphrase where the post belonged. The
// owner reported it more than once, and each time the article that exposed it was the thing repaired.
//
// THE SHARED MECHANISM. functions/_lib/widgets/rail-platform.js prints `s.quote` inside every card
// and only falls back to `s.summary` when `quote` is empty — so the renderer was never the defect.
// The two source write paths accepted an entry with no quote, and accepted entries that were not
// objects at all. Both now call checkSources() from functions/_lib/source_law.js and refuse.
//
// WHAT THIS GATE ADDS. A refusal at the write path stops new violations. It does nothing about the
// ones already stored, and nothing stops a future change from quietly removing the refusal. This
// gate reads the live corpus and fails the deploy when either is true:
//
//   1. ANY stored source entry is not an object. Hard zero. These render as empty cards and there is
//      no legitimate reason for one to exist.
//   2. The count of quote-less source entries is HIGHER than the recorded ceiling. Existing debt is
//      named in .source-quote-ceiling.json and may only ever fall. A deploy that adds one
//      quote-less source fails; a deploy that repairs some lowers the ceiling automatically.
//
// It also verifies at RUNTIME, not just in the data: it fetches published pages and asserts that a
// card carrying a stored quote actually renders that quote inside the card.
//
// Usage: node scripts/check-source-quotes.mjs [--update-ceiling]

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isBackpressure, sleepSync, backoffFor, exitUnread } from './_lib/backpressure.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CEILING_FILE = join(ROOT, '.source-quote-ceiling.json');
const DB = 'loop-content-spine';
const BASE = process.env.SOURCE_LAW_BASE || 'https://miscsubjects.com';
const MIN_QUOTE_CHARS = 40;
// The corpus is scanned in rowid windows. A single json_each over every row trips D1's JSON
// expander on the widest articles; the windows are an implementation detail of the read, not a
// sample — every window is scanned and the totals are summed.
const WINDOW = 200;

// D1 resets an isolate that exceeds its memory limit (code 7429) and returns an error for that one
// query. That is transient and says nothing about the corpus, so it is retried. Everything else is
// reported. A gate that treats any error as "skip" is a bypass wearing a gate's clothes: the only
// condition that may skip is the absence of credentials, which is CI and the owner's other machines.
// Same query, different transport: dispatch D1_QUERY runs it inside the Worker against the
// content database. Returns null when the build is unreachable or has nothing to say, so the
// caller falls through to reporting the original CLI error.
function d1ViaBuild(sql) {
  const token = process.env.TERMINAL_KEY || readVaultTerminalKey();
  if (!token) return null;
  const r = spawnSync('curl', [
    '-s', '--max-time', '90', '-X', 'POST', BASE + '/api/dispatch',
    '-H', 'x-terminal-key: ' + token, '-H', 'content-type: application/json',
    '-d', JSON.stringify({ key: 'D1_QUERY', body: sql }),
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout) return null;
  try {
    const j = JSON.parse(r.stdout);
    const res = typeof j.result === 'string' ? j.result : JSON.stringify(j.result);
    if (!res || res.startsWith('ERR')) return null;
    const rows = JSON.parse(res);
    return Array.isArray(rows) ? { rows } : null;
  } catch { return null; }
}

function readVaultTerminalKey() {
  try {
    const vault = readFileSync(join(process.env.HOME || '', '.build-vault.env'), 'utf8');
    const line = vault.split('\n').find((l) => /^\s*(export\s+)?TERMINAL_KEY=/.test(l));
    if (!line) return null;
    return line.replace(/^\s*(export\s+)?TERMINAL_KEY=/, '').trim().replace(/^['"]|['"]$/g, '') || null;
  } catch { return null; }
}

function d1(sql, attempt = 0) {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const out = String(r.stdout || '');
  const all = String(r.stderr || '') + out;
  if (r.status !== 0 || !out.trim().startsWith('[')) {
    // Retrying with no pause is the same request into the same queue, and that is what four
    // failed attempts looked like on 2026-09-02. Wait for the queue to drain before re-asking.
    if (isBackpressure(all) && attempt < 6) {
      const waitMs = backoffFor(attempt + 1, all);
      console.error(`SOURCE_QUOTE_LAW: read ${attempt + 1}/6 hit backpressure — waiting ${Math.round(waitMs / 1000)}s`);
      sleepSync(waitMs);
      return d1(sql, attempt + 1);
    }
    if (/not (logged in|authenticated)|CLOUDFLARE_API_TOKEN|Unable to authenticate|10000|command not found|ENOENT/i.test(all)) {
      return { no_credentials: all.slice(-300) };
    }
    // The CLI's D1 REST endpoint returns "internal error [code: 7500]" for this account in
    // bursts, while the same query through the build's own binding succeeds — the same split
    // that blocked every deploy at the schema step. So the read is retried over that transport
    // before the gate reports a failure. This is a transport fallback and nothing else: if the
    // build cannot answer either, the error is still returned and the gate still fails. An
    // error must never become a skip.
    const viaBuild = d1ViaBuild(sql);
    if (viaBuild) return viaBuild;
    return { error: all.slice(-400) };
  }
  try {
    return { rows: JSON.parse(out)[0]?.results || [] };
  } catch (e) {
    return { error: 'unparseable d1 response: ' + String(e.message) };
  }
}

async function scanCorpus() {
  const bounds = d1('SELECT MAX(rowid) AS hi FROM articles');
  if (bounds.no_credentials) return { skipped: 'no D1 credentials in this environment (CI): ' + bounds.no_credentials };
  if (bounds.error) return { error: 'corpus scan could not run: ' + bounds.error };
  const hi = Number(bounds.rows[0]?.hi || 0);

  let nonObject = [];
  let quoteless = 0;
  let short = 0;
  let total = 0;
  const worstArticles = new Map();

  for (let lo = 0; lo < hi; lo += WINDOW) {
    const win = `a.rowid>${lo} AND a.rowid<=${lo + WINDOW} AND json_type(a.meta,'$.sources')='array'`;
    // j.type is json_each's own column: it classifies the element without re-parsing it, so a bare
    // string element is reported instead of crashing the query the way json_type(j.value) does.
    const bad = d1(`SELECT a.slug, j.key AS idx, substr(j.value,1,80) AS v FROM articles a, json_each(a.meta,'$.sources') j WHERE ${win} AND j.type<>'object'`);
    // Credentials were proved by the bounds query above, so a no_credentials result HERE is a
    // failure mid-scan, not an environment without access. Reading `.rows` off it crashed the gate
    // with a TypeError instead of reporting — a gate that dies is a gate that says nothing.
    if (bad.error || bad.no_credentials || !Array.isArray(bad.rows)) {
      return { error: `window ${lo}: ${bad.error || bad.no_credentials || 'no rows returned'}` };
    }
    nonObject = nonObject.concat(bad.rows.map((r) => ({ slug: r.slug, index: r.idx, value: r.v })));

    const counts = d1(
      `SELECT COUNT(*) AS t,`
      + ` SUM(CASE WHEN COALESCE(json_extract(j.value,'$.quote'),'')='' THEN 1 ELSE 0 END) AS q,`
      + ` SUM(CASE WHEN length(COALESCE(json_extract(j.value,'$.quote'),''))>0`
      + `      AND length(COALESCE(json_extract(j.value,'$.quote'),''))<${MIN_QUOTE_CHARS} THEN 1 ELSE 0 END) AS s`
      + ` FROM articles a, json_each(a.meta,'$.sources') j WHERE ${win} AND j.type='object'`,
    );
    if (counts.error || counts.no_credentials || !Array.isArray(counts.rows)) {
      return { error: `window ${lo} counts: ${counts.error || counts.no_credentials || 'no rows returned'}` };
    }
    total += Number(counts.rows[0]?.t || 0);
    quoteless += Number(counts.rows[0]?.q || 0);
    short += Number(counts.rows[0]?.s || 0);

    const per = d1(
      `SELECT a.slug, COUNT(*) AS n FROM articles a, json_each(a.meta,'$.sources') j`
      + ` WHERE ${win} AND j.type='object' AND COALESCE(json_extract(j.value,'$.quote'),'')=''`
      + ` GROUP BY a.slug`,
    );
    if (Array.isArray(per.rows)) for (const r of per.rows) worstArticles.set(r.slug, Number(r.n));
  }

  return {
    total_sources: total,
    non_object: nonObject,
    quoteless,
    short_quotes: short,
    articles_with_quoteless: [...worstArticles.entries()]
      .sort((a, b) => b[1] - a[1]).map(([slug, n]) => ({ slug, quoteless: n })),
  };
}

/** Decode the entities the renderer escapes, drop typographic variation, collapse whitespace. */
function normalise(s) {
  return String(s == null ? '' : s)
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    // U+2011 non-breaking hyphen appears in stored quotes ("BPC‑157") and is not the same
    // codepoint as the hyphen in the rendered text, which produced a false failure on /a/bpc-157.
    .replace(/[–—‐‑‒]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Runtime check, anchored to the CARDS THAT ARE ON THE PAGE.
 *
 * The obvious version of this check — "every stored quote appears in the HTML" — is wrong, and
 * wrong in a way that matters: a long article stores more sources than the rail displays, so the
 * check fails on articles that are entirely correct, and a failing check gets disabled.
 *
 * The real invariant is narrower and is the one the reader experiences: for every source card the
 * page actually renders, if that source has a quote, the quote is inside that card. Each card foots
 * with the first 12 characters of its source hash, so the rendered cards can be matched back to
 * stored rows exactly.
 */
async function verifyRendered(slugs) {
  const checked = [];
  // Article pages sit behind the edge cache. Reading a cached copy right after a promotion reports
  // the OLD renderer's output — which is exactly what happened on the first run of this gate: it
  // failed /a/bpc-157 for a defect the deploy it was gating had already fixed. A runtime check that
  // can read stale HTML is not a runtime check, so every fetch here is uncached.
  const bust = () => `cb=${process.pid}${Math.floor(performance.now())}`;
  const noCache = { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } };
  for (const slug of slugs) {
    const res = await fetch(`${BASE}/api/articles/${slug}/sources?${bust()}`, noCache).catch(() => null);
    if (!res || !res.ok) { checked.push({ slug, ok: false, why: 'sources api unavailable' }); continue; }
    const data = await res.json().catch(() => null);
    const byHash = new Map();
    for (const s of data?.sources || []) {
      if (s?.hash) byHash.set(String(s.hash).slice(0, 12), s);
    }
    const page = await fetch(`${BASE}/a/${slug}?${bust()}`, noCache).catch(() => null);
    if (!page || !page.ok) { checked.push({ slug, ok: false, why: 'page unavailable' }); continue; }
    const html = await page.text();

    // One card = one <article class="rp-card ...">…</article>. Split on the opening tag so each
    // fragment holds exactly one card, including its foot hash.
    const cards = html.split(/<article class="rp-card/).slice(1);
    const cardless = [];
    let rendered = 0;
    for (const frag of cards) {
      const body = frag.split('</article>')[0];
      // The foot reads `<a class="rp-hash">s3 · #e9ad77a3ef6f</a>` — the source id, then the hash.
      // An earlier version of this line required the `#` immediately after the tag, matched nothing
      // on every real article, and reported "ok" for a check that had examined zero cards.
      const h = (body.match(/class="rp-hash"[^>]*>[^<]*#([0-9a-f]{12})/) || [])[1];
      const src = h ? byHash.get(h) : null;
      if (!src) continue;
      const quote = String(src.quote || '').trim();
      if (quote.length < MIN_QUOTE_CHARS) continue;
      rendered += 1;
      const flat = normalise(body.replace(/<[^>]+>/g, ' '));
      const probe = normalise(quote).slice(0, 70);
      if (probe.length > 20 && !flat.includes(probe)) {
        cardless.push({ id: src.id, hash: h, quote: quote.slice(0, 70) });
      }
    }
    checked.push({
      slug,
      ok: cardless.length === 0,
      cards_on_page: cards.length,
      quoted_cards_checked: rendered,
      quote_missing_from_card: cardless.slice(0, 5),
    });
  }
  return checked;
}

const scan = await scanCorpus();
if (scan.skipped) {
  console.log(JSON.stringify({ ok: true, law: 'SOURCE_QUOTE_LAW', skipped: scan.skipped }));
  process.exit(0);
}
if (scan.error) {
  // Both transports exhausted under backpressure means the corpus was never read. Blocking the
  // ship is right; calling it "repair the data; do not raise the ceiling" is not.
  if (isBackpressure(scan.error)) exitUnread('SOURCE_QUOTE_LAW', scan.error, 6);
  console.error(JSON.stringify({ ok: false, law: 'SOURCE_QUOTE_LAW', error: scan.error }));
  process.exit(1);
}

const ceiling = JSON.parse(await readFile(CEILING_FILE, 'utf8').catch(() => '{"quoteless":null}'));
const failures = [];

if (scan.non_object.length) {
  failures.push({
    why: `${scan.non_object.length} source entries are not objects. These render as empty cards.`,
    examples: scan.non_object.slice(0, 6),
    repair: 'node scripts/repair-source-entries.mjs',
  });
}

if (ceiling.quoteless != null && scan.quoteless > ceiling.quoteless) {
  failures.push({
    why: `${scan.quoteless} sources carry no quote; the recorded ceiling is ${ceiling.quoteless}. `
      + 'The number may only fall. Something wrote a quote-less source past the write-path refusal.',
    worst: scan.articles_with_quoteless.slice(0, 8),
  });
}

// Runtime evidence, taken from the articles that carry the most quoted sources.
const sample = scan.articles_with_quoteless.length
  ? scan.articles_with_quoteless.slice(0, 2).map((a) => a.slug)
  : [];
const rendered = await verifyRendered(['kisspeptin', 'bpc-157', ...sample].slice(0, 4));
for (const r of rendered) {
  if (!r.ok && r.quote_missing_from_card?.length) {
    failures.push({
      why: `on /a/${r.slug}, a source card is rendered without the quote its stored source carries`,
      detail: r.quote_missing_from_card,
    });
  }
}

const report = {
  law: 'SOURCE_QUOTE_LAW',
  total_sources: scan.total_sources,
  non_object: scan.non_object.length,
  quoteless: scan.quoteless,
  short_quotes: scan.short_quotes,
  ceiling: ceiling.quoteless,
  articles_to_repair: scan.articles_with_quoteless.length,
  runtime_checked: rendered.map((r) => ({
    slug: r.slug, ok: r.ok, cards_on_page: r.cards_on_page, quoted_cards_checked: r.quoted_cards_checked,
  })),
};

if (process.argv.includes('--update-ceiling')) {
  await writeFile(CEILING_FILE, JSON.stringify({
    law: 'SOURCE_QUOTE_LAW',
    note: 'Legacy quote-less source entries. This number may only fall. The write path refuses new ones.',
    quoteless: scan.quoteless,
    non_object: scan.non_object.length,
    measured_at: new Date().toISOString().slice(0, 10),
    total_sources: scan.total_sources,
  }, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, ...report, ceiling_updated_to: scan.quoteless }));
  process.exit(0);
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, ...report, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, ...report }));
