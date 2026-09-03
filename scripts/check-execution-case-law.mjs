#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const failures = [];

const SUITES = [
  'functions/_lib/execution_case.test.mjs',
  'functions/_lib/promo_loop.test.mjs',
  'functions/_lib/execution_case_review.test.mjs',
  'functions/_lib/execution_case_resolve.test.mjs',
  'functions/_lib/valid_tld.test.mjs',
];
const r = spawnSync(process.execPath, ['--test', ...SUITES], { cwd: ROOT, encoding: 'utf8' });
if (r.status !== 0) {
  failures.push('EXECUTION_CASE_LAW: test suites failed\n' + String(r.stdout).split('\n').filter((l) => /not ok|✖|fail/i.test(l)).slice(0, 12).join('\n'));
}

const invLog = readFileSync(ROOT + '/functions/_lib/invocation_log.js', 'utf8');
if (!invLog.includes('bindCandidatesToInvocation')) {
  failures.push('EXECUTION_CASE_LAW: functions/_lib/invocation_log.js lost the candidate→receipt binding — task-bound discovery rows would stop resolving to their invocation.');
}

const review = readFileSync(ROOT + '/functions/_lib/execution_case_review.js', 'utf8');
for (const needle of ["review_status !== 'approved'", 'proofId', "provider_status='refused'"]) {
  if (!review.includes(needle)) {
    failures.push(`EXECUTION_CASE_LAW: execution_case_review.js lost "${needle}" — the reviewed-send gate weakened.`);
  }
}

// The canonical resolver must keep its two audited invariants: verified requires a real TLD, and
// inclusion requires the quote to be on the firm's own site.
const resolve = readFileSync(ROOT + '/functions/_lib/execution_case_resolve.js', 'utf8');
for (const needle of ['isPlausiblePublicEmail', 'registrableDomain', 'planResolution']) {
  if (!resolve.includes(needle)) failures.push(`EXECUTION_CASE_LAW: execution_case_resolve.js lost "${needle}" — the dedupe/verify invariant weakened.`);
}
const norm = readFileSync(ROOT + '/functions/_lib/execution_case.js', 'utf8');
if (!norm.includes('registrableDomain(sourceUrl) !== registrableDomain(officialUrl)')) {
  failures.push('EXECUTION_CASE_LAW: execution_case.js lost the own-site inclusion rule — inclusions could again pass on third-party sources.');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
const tests = (String(r.stdout).match(/# pass (\d+)/) || [])[1] || 'all';
console.log(JSON.stringify({ ok: true, law: 'EXECUTION_CASE_LAW', suites: SUITES.length, tests_passed: tests, checked: 'task-bound counts, decision completeness, receipt binding, reviewed-send gate' }));
