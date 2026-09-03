#!/usr/bin/env node
// WF-0005 deploy gate + regression. Proves the migration selector picks a real new migration
// over the 9999 reseed sentinel regardless of checkout mtimes, on any machine.
//
// The exact production incident: a clean worktree shipped 0354_canonical_token_manual.sql, but
// ship.mjs selected 9999_ref_images.sql because every checkout mtime tied and the filename
// tie-break preferred the higher name. This gate fails the deploy if that can recur.

import { selectMigrationsToApply, isSentinelMigration, migrationPrefix } from './lib/migration-selection.mjs';

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) { console.error(`FAIL ${name}: got ${a}, expected ${e}`); failures++; }
  else console.log(`ok   ${name}`);
}

// 1. The exact 0354-vs-9999 incident: both present, order in the listing must not matter.
check('0354 beats 9999 (listing order A)',
  selectMigrationsToApply(['0354_canonical_token_manual.sql', '9999_ref_images.sql']),
  ['0354_canonical_token_manual.sql']);
check('0354 beats 9999 (listing order B)',
  selectMigrationsToApply(['9999_ref_images.sql', '0354_canonical_token_manual.sql']),
  ['0354_canonical_token_manual.sql']);

// 2. A newly added higher-numbered migration is selected automatically.
check('0356 selected over 0354 and 9999',
  selectMigrationsToApply(['0354_x.sql', '0356_new.sql', '9999_ref_images.sql']),
  ['0356_new.sql']);

// 3. The reseed sentinel never auto-runs, even when it is the only file present.
check('sentinel alone selects nothing',
  selectMigrationsToApply(['9999_ref_images.sql']),
  []);

// 4. Numeric prefix beats lexical: 0099 must not beat 0100.
check('numeric not lexical (0100 > 0099)',
  selectMigrationsToApply(['0099_a.sql', '0100_b.sql']),
  ['0100_b.sql']);

// 5. Sentinel classification and prefix parsing.
check('9999 is a sentinel', isSentinelMigration('9999_ref_images.sql'), true);
check('0354 is not a sentinel', isSentinelMigration('0354_canonical_token_manual.sql'), false);
check('prefix parse', migrationPrefix('0354_canonical_token_manual.sql'), 354);

// 6. Selection is independent of any mtime: the function takes only names, so mtime cannot
//    influence it. Re-running with a shuffled listing yields the same result (idempotent).
const shuffledA = selectMigrationsToApply(['0354_a.sql', '0410_b.sql', '9999_ref_images.sql']);
const shuffledB = selectMigrationsToApply(['9999_ref_images.sql', '0410_b.sql', '0354_a.sql']);
check('order-independent', shuffledA, shuffledB);

if (failures) { console.error(`\n${failures} check(s) failed — migration selector would misfire.`); process.exit(1); }
console.log('\nmigration-selection: all checks passed');
