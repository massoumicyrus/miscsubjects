#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { POINTER_FILES } from './sync_pointer_files.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const MAX_BYTES = 4000;

// Authority language. A pointer file states where the law is; it never states the law.
const FORBIDDEN = [
  [/^#{2,3}\s+.*\b(LAW|RULE|BANNED|NEVER|ALWAYS)\b/im, 'a rule heading'],
  [/^-\s*(NEVER|ALWAYS|BANNED|Do not|Never|You must)\b/im, 'an imperative rule bullet'],
  [/\b(OPEN|OUTSTANDING|TODO|NEXT ACTION|next action|unfinished)\b\s*[:\-]/i, 'a task or state list'],
  [/priority\s*[:=]\s*\d/i, 'a priority assignment'],
  [/acceptance (criteria|tests?)\s*[:\-]/i, 'acceptance criteria'],
  [/^##\s*20\d\d-\d\d-\d\d/m, 'a dated state handoff entry'],
];

const failures = [];
for (const name of POINTER_FILES) {
  const text = await readFile(join(ROOT, name), 'utf8').catch(() => null);
  if (text == null) { failures.push({ file: name, why: 'missing — regenerate with scripts/sync_pointer_files.mjs' }); continue; }
  if (Buffer.byteLength(text) > MAX_BYTES) {
    failures.push({ file: name, why: `${Buffer.byteLength(text)} bytes — a pointer file over ${MAX_BYTES} is carrying content` });
  }
  if (!/\/a\/the-work-object/.test(text)) {
    failures.push({ file: name, why: 'does not point at the canonical work object' });
  }
  for (const [re, what] of FORBIDDEN) {
    if (re.test(text)) failures.push({ file: name, why: `contains ${what} — authority belongs in the work object, not in this file` });
  }
}

if (failures.length) {
  console.log(JSON.stringify({ ok: false, law: 'POINTER_FILES_LAW', failing: failures.length, failures }, null, 1));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, law: 'POINTER_FILES_LAW', checked: POINTER_FILES.length }));
