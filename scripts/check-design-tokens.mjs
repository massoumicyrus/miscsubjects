#!/usr/bin/env node
// LAW: every --ds-* token referenced in functions/ must either be defined in the
// canonical CSS renderer or carry an inline fallback (var(--token, fallback)).

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

// Derive the canonical defined --ds-* tokens from the CSS renderer source.
const cssSource = readFileSync(join(ROOT, 'functions/_lib/design/representations/css.js'), 'utf8');
const defined = new Set();
for (const m of cssSource.matchAll(/(--ds-[a-z0-9-]+):\s*/g)) {
  defined.add(m[1]);
}

const failures = [];
const tokenRe = /var\((--ds-[a-z0-9-]+)(?:\s*,\s*([^)]+))?\)/g;

for (const path of walk(join(ROOT, 'functions'))) {
  const text = readFileSync(path, 'utf8');
  const rel = path.replace(ROOT + '/', '');
  // Skip the CSS renderer itself.
  if (rel === 'functions/_lib/design/representations/css.js') continue;
  let m;
  while ((m = tokenRe.exec(text)) !== null) {
    const token = m[1];
    const fallback = m[2];
    if (!defined.has(token) && !fallback) {
      failures.push({ where: rel, token, has_fallback: false });
    }
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, law: 'DESIGN_TOKEN_LAW', failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, law: 'DESIGN_TOKEN_LAW', defined: [...defined].sort(), checked: 'functions/**/*.js' }));
