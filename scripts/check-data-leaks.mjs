#!/usr/bin/env node
// FAIL on dead template tokens or serialized objects leaking into public surfaces.
// LAW: directory rows and public JSON/HTML must never expose {{SHARED}}, {{TOOLS}},
// {{CATEGORIES}}, or [object Object].

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const PRODUCTION_ORIGIN = 'https://miscsubjects.com';

const LEAK_TOKENS = [
  /\{\{SHARED\}\}/g,
  /\{\{TOOLS\}\}/g,
  /\{\{CATEGORIES\}\}/g,
  /\[object Object\]/g,
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const s = statSync(path);
    if (s.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git' || entry === '_archive') continue;
      walk(path, files);
    } else if (s.isFile() && (entry.endsWith('.js') || entry.endsWith('.mjs') || entry.endsWith('.css'))) {
      files.push(path);
    }
  }
  return files;
}

const failures = [];

function stripJsComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

// 1. Local source files: CSS-in-JS strings and template literals must not contain leak tokens.
for (const path of walk(join(ROOT, 'functions'))) {
  const raw = readFileSync(path, 'utf8');
  const text = path.endsWith('.js') || path.endsWith('.mjs') ? stripJsComments(raw) : raw;
  const rel = path.replace(ROOT + '/', '');
  for (const re of LEAK_TOKENS) {
    for (const match of text.matchAll(re)) {
      const line = raw.slice(0, match.index).split('\n').length;
      failures.push({ where: rel, line, token: match[0], kind: 'local_source' });
    }
  }
}

// 2. Public JSON endpoints: these are machine-readable surfaces; dead tokens break clients.
const publicUrls = [
  '/api/opos',
  '/api/opos?format=drop',
  '/api/capability-atlas',
  '/api/capability-atlas?summary=1',
];

for (const path of publicUrls) {
  try {
    const res = await fetch(PRODUCTION_ORIGIN + path);
    const text = await res.text();
    for (const re of LEAK_TOKENS) {
      if (re.test(text)) {
        failures.push({ where: PRODUCTION_ORIGIN + path, line: 0, token: re.source, kind: 'public_json' });
      }
    }
  } catch (e) {
    failures.push({ where: PRODUCTION_ORIGIN + path, line: 0, token: 'fetch failed: ' + e.message, kind: 'public_json' });
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, law: 'DATA_LEAK_LAW', failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, law: 'DATA_LEAK_LAW', checked: publicUrls.length + ' public URLs, local functions/' }));
