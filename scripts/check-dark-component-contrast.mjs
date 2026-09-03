#!/usr/bin/env node
// LAW: dark components (related-rail, graph-map-widget) set explicit light foregrounds
// and must NOT inherit page --ink* tokens, which would render black-on-black.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const s = statSync(path);
    if (s.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git') continue;
      walk(path, files);
    } else if (s.isFile() && entry.endsWith('.js')) {
      files.push(path);
    }
  }
  return files;
}

const failures = [];
// Detect dark background declarations followed by a page-ink color within the same CSS block.
const darkBgRe = /background[^:]*:\s*(?:linear-gradient\([^)]*)?#(?:0|1)[0-9a-f]{5}/gi;
const pageInkRe = /color:\s*var\(--(?:ink|ds-ink)[^)]*\)/gi;

for (const path of walk(join(ROOT, 'functions/_lib'))) {
  const text = readFileSync(path, 'utf8');
  const rel = path.replace(ROOT + '/', '');
  // Split into template-literal/CSS chunks.
  const cssChunks = text.match(/`[^`]*background[^`]*`/g) || [];
  for (const chunk of cssChunks) {
    if (darkBgRe.test(chunk) && pageInkRe.test(chunk)) {
      failures.push({ where: rel, kind: 'dark_surface_inherits_page_ink' });
    }
  }
}

{
  const rail = readFileSync(join(ROOT, 'functions/_lib/widgets/rail-platform.js'), 'utf8');
  const gfRule = rail.match(/\.rp-gf\{[^}]*\}/);
  const opaqueLight = gfRule && /background:#(?:f|e)[0-9a-f]{5}/i.test(gfRule[0]);
  if (!gfRule || !opaqueLight) {
    failures.push({ where: 'functions/_lib/widgets/rail-platform.js', kind: 'rp_gf_panel_not_opaque_light — dark-ink finding panel would vanish on dark brand cards' });
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, law: 'DARK_CONTRAST_LAW', failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, law: 'DARK_CONTRAST_LAW', checked: 'functions/_lib/**/*.js' }));
