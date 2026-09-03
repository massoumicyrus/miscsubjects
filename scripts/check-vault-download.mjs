#!/usr/bin/env node
import { isBackpressure, exitUnread } from './_lib/backpressure.mjs';

const BASE = process.env.SMOKE_BASE || process.env.MISC_BASE || 'https://miscsubjects.com';
const V = BASE + '/api/articles/obsidian-vault';
const cb = () => 'cb=' + Date.now() + Math.floor(Math.random() * 1e6);

const failures = [];
const notes = [];

const TRANSIENT = new Set([429, 500, 502, 503, 504, 522, 524]);

async function getJSON(url, tries = 3) {
  let last = null;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      const text = await r.text();
      if (!r.ok) {
        const err = new Error(`HTTP ${r.status} — ${text.slice(0, 160).replace(/\s+/g, ' ')}`);
        err.transient = TRANSIENT.has(r.status);
        throw err;
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`non-JSON — ${text.slice(0, 160).replace(/\s+/g, ' ')}`);
      }
    } catch (e) {
      last = e;
      if (i < tries && (e.transient || /fetch failed|network|timeout/i.test(e.message))) {
        await new Promise((r) => setTimeout(r, 2000 * i));
        continue;
      }
      throw e;
    }
  }
  throw last;
}

// 1. What does the rest of the site think the corpus is? The export must agree.
let siteTotal = null;
try {
  const list = await getJSON(`${BASE}/api/articles?limit=1&${cb()}`);
  siteTotal = Number(list.total);
  if (!Number.isFinite(siteTotal) || siteTotal < 1) failures.push(`/api/articles reported no usable total (${list.total})`);
} catch (e) {
  failures.push(`/api/articles is not answering, so the export cannot be judged against it: ${e.message}`);
}

// 2. The manifest is the cheap contract: how many pages is the whole build?
let manifest = null;
try {
  manifest = await getJSON(`${V}?all=1&manifest=1&${cb()}`);
  if (!manifest.ok) failures.push('manifest returned ok:false');
  const total = Number(manifest.total_slugs);
  if (!Number.isFinite(total) || total < 1) {
    failures.push(`manifest reported total_slugs=${manifest.total_slugs}; the export believes the corpus is empty`);
  } else if (siteTotal != null && total !== siteTotal) {
    // This is defect 3. The export selected every register in the table.
    failures.push(
      `the export and the site disagree about the corpus: manifest says ${total} articles, /api/articles says ${siteTotal}. ` +
        `The vault query must exclude source_ledger/source/audit registers and unpublished rows.`,
    );
  }
  const pages = Number(manifest.pages);
  if (!Number.isFinite(pages) || pages < 1) failures.push(`manifest reported pages=${manifest.pages}`);
  else if (pages * Number(manifest.page_size) < total) {
    failures.push(`manifest pages (${pages} x ${manifest.page_size}) cannot cover ${total} articles`);
  }
  if ((manifest.page_urls || []).length !== pages) {
    failures.push(`manifest advertises ${pages} pages but lists ${(manifest.page_urls || []).length} page URLs`);
  }
  notes.push(`manifest: ${total} articles across ${pages} pages of ${manifest.page_size}`);
} catch (e) {
  failures.push(`?all=1&manifest=1 failed: ${e.message}`);
}

// 3. Defect 1: every spelling of "all" must mean the same corpus. ?all=1 silently
//    meant "two articles" — the gate has to catch a wrong answer, not just an error.
if (manifest?.total_slugs) {
  for (const spelling of ['all=1', 'all=true', 'all=yes', 'all']) {
    try {
      const m = await getJSON(`${V}?${spelling}&manifest=1&${cb()}`);
      if (Number(m.total_slugs) !== Number(manifest.total_slugs)) {
        failures.push(
          `?${spelling} means a different corpus than ?all=1: ${m.total_slugs} vs ${manifest.total_slugs} articles`,
        );
      }
    } catch (e) {
      failures.push(`?${spelling} failed: ${e.message}`);
    }
  }
  notes.push('4 spellings of all checked');
}

// 4. Defect 2: the pages must actually render. First, last, and one in the middle —
//    the middle page is where a per-article render blows the CPU budget if it will.
let filesSeen = 0;
let slugsSeen = 0;
if (manifest?.pages) {
  const pages = Number(manifest.pages);
  const probe = [...new Set([1, Math.max(1, Math.ceil(pages / 2)), pages])];
  for (const p of probe) {
    try {
      const j = await getJSON(`${V}?all=1&page=${p}&page_size=${manifest.page_size}&${cb()}`);
      if (!j.ok || !j.files?.length) {
        failures.push(`page ${p} of ${pages} returned no files`);
        continue;
      }
      filesSeen += j.files.length;
      slugsSeen += (j.slugs || []).length;
      if (Number(j.pages) !== pages) failures.push(`page ${p} reports ${j.pages} pages, manifest says ${pages}`);
      if (Number(j.total_slugs) !== Number(manifest.total_slugs)) {
        failures.push(`page ${p} reports total_slugs=${j.total_slugs}, manifest says ${manifest.total_slugs}`);
      }
      if (!(j.slugs || []).length) failures.push(`page ${p} carries no articles`);
      // Root files ship on page 1 and nowhere else, or a paged pull rewrites the
      // index once per page and the last write wins with a partial list.
      const hasIndex = j.files.some((f) => f.path === 'index.md');
      if (p === 1 && !hasIndex) failures.push('page 1 is missing index.md — a pulled vault would have no entry point');
      if (p !== 1 && hasIndex) failures.push(`page ${p} re-emits index.md; root files belong on page 1 only`);
      // SHA256SUMS is an integrity claim. If it is wrong the feature is lying.
      const sums = j.files.find((f) => f.path === 'SHA256SUMS');
      if (!sums) failures.push(`page ${p} has no SHA256SUMS`);
      else {
        const listed = sums.content.trim().split('\n').filter(Boolean).length;
        if (listed !== j.files.length - 1) {
          failures.push(`page ${p} SHA256SUMS covers ${listed} files but the page holds ${j.files.length - 1}`);
        }
      }
    } catch (e) {
      failures.push(`page ${p} of ${pages} failed: ${e.message}`);
    }
  }
  notes.push(`${probe.length} pages rendered, ${filesSeen} files, ${slugsSeen} articles`);
}

// 5. A person has to be able to download it as a file, not a JSON array.
try {
  let r = null;
  let zipWhy = '';
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    if (attempt > 1) await new Promise((res) => setTimeout(res, Math.min(25000, attempt * 6000)));
    const got = await fetch(`${V}?slugs=protocol,bpc-157&format=zip&${cb()}`).catch((e) => ({ ok: false, status: 0, _err: e }));
    if (got.ok) { r = got; break; }
    zipWhy = (got._err && String(got._err.message)) || `HTTP ${got.status}`;
    if (!isBackpressure(zipWhy)) break;
  }
  if (!r) {
    if (isBackpressure(zipWhy)) exitUnread('VAULT_DOWNLOAD_LAW', `${V}?format=zip — ${zipWhy}`, 5);
    throw new Error(zipWhy);
  }
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('zip')) failures.push(`format=zip served content-type ${ct}`);
  if (!/attachment/.test(r.headers.get('content-disposition') || '')) {
    failures.push('format=zip did not send a download disposition, so a browser renders it as text');
  }
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length < 22) failures.push(`format=zip returned ${buf.length} bytes; too small to be an archive`);
  else {
    const magic = [...buf.slice(0, 4)].join(',');
    if (magic !== '80,75,3,4') failures.push(`format=zip is not a ZIP: first bytes ${magic}`);
    const eocd = buf.slice(buf.length - 22);
    if ([...eocd.slice(0, 4)].join(',') !== '80,75,5,6') failures.push('format=zip has no end-of-central-directory record');
    else {
      const ev = new DataView(eocd.buffer, eocd.byteOffset, eocd.byteLength);
      const entries = ev.getUint16(10, true);
      const cdOffset = ev.getUint32(16, true);
      if (entries < 1) failures.push('format=zip is an empty archive');
      if ([...buf.slice(cdOffset, cdOffset + 4)].join(',') !== '80,75,1,2') {
        failures.push('format=zip central-directory offset does not point at a central directory');
      }
      notes.push(`zip: ${buf.length} bytes, ${entries} entries, opens`);
    }
  }
} catch (e) {
  failures.push(`format=zip failed: ${e.message}`);
}

// 6. The narrow default still has to work — this is the path everything else uses.
try {
  const j = await getJSON(`${V}?slugs=bpc-157&${cb()}`);
  if (!j.ok || !j.files?.length) failures.push('the single-slug export returned no files');
  if (Number(j.pages) !== 1) failures.push(`a two-slug export reported ${j.pages} pages`);
  const readme = j.files?.find((f) => f.path.endsWith('/README.md'));
  if (!readme) failures.push('the single-slug export has no article README');
  else if (!readme.content.startsWith('---')) {
    failures.push('an exported note does not open with its YAML block — Obsidian will read no properties');
  }
} catch (e) {
  failures.push(`single-slug export failed: ${e.message}`);
}

console.log(`VAULT_DOWNLOAD_LAW — ${notes.join(' · ') || 'nothing examined'}`);

if (failures.length) {
  console.error(`\nVAULT_DOWNLOAD_LAW FAILED (${failures.length}):`);
  for (const f of failures) console.error('  - ' + f);
  console.error('\nThe whole build must be downloadable. Repair the export, never this gate.');
  process.exit(1);
}

if (!manifest || !filesSeen) {
  console.error('VAULT_DOWNLOAD_LAW examined zero pages — that is a broken gate, not a pass.');
  process.exit(1);
}

console.log('VAULT_DOWNLOAD_LAW passed.');
