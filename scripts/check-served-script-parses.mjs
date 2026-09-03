#!/usr/bin/env node
// SERVED_SCRIPT_PARSES_LAW — the JavaScript the browser receives must parse.
//
// On 2026-09-02 one lone backslash blanked the whole sheets grid. The source was valid
// JavaScript, so `node --check` on the repo saw nothing wrong. The script ships inside a
// template literal, which processes escapes on the way out, so the SERVED text read
//
//   var IMG_RE=/^https?://[^s]+...
//
// where the // opened a comment, the regex never closed, and the SyntaxError took every line of
// the grid with it: no column letters, no rows, no tabs. It looked exactly like a dead back end.
//
// No heuristic about template literals can be trusted to catch that — the first two I wrote both
// misjudged which blocks were inside one. This checks the only thing that actually matters: fetch
// what the browser is served and parse it. Ground truth, no inference.
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.SMOKE_BASE || process.env.MISC_BASE || 'https://miscsubjects.com';
const KEY = process.env.TERMINAL_KEY || '';
// The operating surfaces. Each one is a page whose whole usefulness is its script.
const PAGES = ['/admin/sheets', '/admin/directory', '/admin/ledger', '/graph', '/admin/vault', '/start'];

if (!KEY) {
  console.error('SERVED_SCRIPT_PARSES_LAW needs TERMINAL_KEY to read the admin pages. Unset, so nothing was checked — a skipped check, not a pass.');
  process.exit(2);
}

const dir = mkdtempSync(join(tmpdir(), 'served-'));
const failures = [];
let blocks = 0;
let pages = 0;

for (const path of PAGES) {
  let html = null;
  let why = '';
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const r = await fetch(BASE + path, { headers: { 'x-terminal-key': KEY } }).catch((e) => ({ ok: false, status: 0, _e: e }));
    if (r.ok) { html = await r.text().catch(() => null); if (html) break; }
    why = (r._e && String(r._e.message)) || `HTTP ${r.status}`;
    if (attempt < 4) await new Promise((res) => setTimeout(res, attempt * 5000));
  }
  if (!html) {
    console.error(`SERVED_SCRIPT_PARSES_LAW could not read ${path}: ${why}. The page was not checked.`);
    process.exit(2);
  }
  pages += 1;
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  let i = 0;
  while ((m = re.exec(html)) !== null) {
    const body = m[1];
    if (!body.trim()) continue;
    // JSON-LD and similar are data, not script to parse.
    if (/^\s*[[{]/.test(body) && /application\/(ld\+)?json/.test(m[0])) continue;
    blocks += 1;
    i += 1;
    const f = join(dir, `p${pages}_b${i}.js`);
    writeFileSync(f, body);
    const chk = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    if (chk.status !== 0) {
      const first = String(chk.stderr || '').split('\n').filter(Boolean).slice(0, 4).join('\n');
      failures.push({ path, block: i, chars: body.length, first });
    }
  }
}

if (failures.length) {
  console.error('SERVED_SCRIPT_PARSES_LAW violations — the browser is being served JavaScript that does not parse:');
  for (const f of failures) {
    console.error(`- ${f.path} (script block ${f.block}, ${f.chars} chars)\n${f.first}`);
  }
  console.error('A SyntaxError in one block kills every line in it. Check the SERVED text, not the source: a template literal eats single backslashes on the way out.');
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  law: 'SERVED_SCRIPT_PARSES_LAW',
  pages_fetched: pages,
  script_blocks_parsed: blocks,
  checked: `${blocks} inline script block(s) across ${pages} live page(s) parsed with node --check, as the browser receives them`,
}));
