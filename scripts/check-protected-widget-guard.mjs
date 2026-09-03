#!/usr/bin/env node
// LAW: protected widget guard artifacts must exist and be wired into the pre-commit hook.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

const required = {
  'PROTECTED_WIDGETS.md': join(ROOT, 'PROTECTED_WIDGETS.md'),
  '.githooks/pre-commit': join(ROOT, '.githooks', 'pre-commit'),
  'scripts/guard.mjs': join(ROOT, 'scripts', 'guard.mjs'),
  'scripts/check-protected-features.mjs': join(ROOT, 'scripts', 'check-protected-features.mjs'),
  '.protected/baseline/': join(ROOT, '.protected', 'baseline'),
};

const failures = [];
for (const [name, path] of Object.entries(required)) {
  if (!existsSync(path)) {
    failures.push({ missing: name, path });
  }
}

const hook = readFileSync(required['.githooks/pre-commit'], 'utf8');
if (!hook.includes('scripts/guard.mjs') || !hook.includes('scripts/check-protected-features.mjs')) {
  failures.push({ where: '.githooks/pre-commit', error: 'missing guard/check-protected-features invocation' });
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, law: 'PROTECTED_WIDGET_GUARD_LAW', failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, law: 'PROTECTED_WIDGET_GUARD_LAW', checked: Object.keys(required).join(', ') }));
