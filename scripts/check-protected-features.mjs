#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const checks = [
  'scripts/check-write-law.mjs',
  'scripts/check-backend-navigation.mjs',
  'scripts/check-directory-audit-drop.mjs',
  'scripts/check-tap-go-drop-golden.mjs',
  'scripts/check-ledger-continuity.mjs',
  'scripts/check-ledger-contrast.mjs',
  'scripts/check-owner-name-leak.mjs',
  'scripts/check-owner-bcc.mjs',
  'scripts/check-data-leaks.mjs',
  'scripts/check-content-counters.mjs',
  'scripts/check-design-tokens.mjs',
  'scripts/check-dark-component-contrast.mjs',
  'scripts/check-widget-contrast.mjs',
  'scripts/check-opos-render.mjs',
  'scripts/check-protected-widget-guard.mjs',
  'scripts/check-failure-vault.mjs',
];

for (const check of checks) {
  const result = spawnSync(process.execPath, [check], { encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error(JSON.stringify({ ok: false, failed_check: check }));
    process.exit(result.status || 1);
  }
}
console.log(JSON.stringify({ ok: true, protected_feature_checks: checks.length }));
