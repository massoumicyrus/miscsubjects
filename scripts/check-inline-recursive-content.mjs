#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

// A backend form or hidden hover affordance is not the feature. This runs the executable contract
// for the ordinary /a/<slug> reading surface, exact selection-to-block, inline mutation, versioned
// criticism, stable identity, reuse, ordering, detachment, retirement, and cache invalidation.
const result = spawnSync(process.execPath, ['--test', 'functions/_lib/recursive_content.test.mjs'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status || 1);

console.log(JSON.stringify({ ok: true, law: 'INLINE_RECURSIVE_CONTENT', surface: '/a/<slug>' }));
