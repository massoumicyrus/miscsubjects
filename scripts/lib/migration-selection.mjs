// DETERMINISTIC MIGRATION SELECTION (WF-0005).
//
// The failure this replaces: ship.mjs picked one migration by file mtime (descending), breaking
// ties by filename (descending). In a fresh worktree every checkout mtime is identical, so the
// tie-break ran, and 9999_ref_images.sql beat a real new migration like 0354_canonical_token_manual.sql.
// The release of 0354 was skipped and 9999 ran instead.
//
// The repair removes mtime from the decision entirely and never lets a reseed sentinel win:
//   1. Only files matching /^\d+_.*\.sql$/ are candidates.
//   2. Files whose numeric prefix is >= SENTINEL_FLOOR (9000) are reseed/reference-data scripts,
//      not schema steps; they are excluded from automatic selection and only run when named
//      explicitly on the command line.
//   3. Among the real migrations the one with the highest NUMERIC prefix is selected. Numeric
//      order is total, so there is no tie to break and mtime is irrelevant.
//
// This keeps ship's one-migration-per-deploy contract while guaranteeing a newly added numbered
// migration is the one selected, on any machine, regardless of checkout timestamps.

export const SENTINEL_FLOOR = 9000;

const NUMBERED = /^(\d+)_.*\.sql$/;

export function migrationPrefix(name) {
  const m = NUMBERED.exec(String(name || ''));
  return m ? Number(m[1]) : null;
}

export function isSentinelMigration(name) {
  const p = migrationPrefix(name);
  return p !== null && p >= SENTINEL_FLOOR;
}

/**
 * Choose the migration ship should apply from a directory listing.
 * @param {string[]} files - bare filenames present in migrations/.
 * @returns {string[]} zero or one filename (bare), the highest-numbered non-sentinel migration.
 *   mtimes are intentionally not an input: selection must not depend on them.
 */
export function selectMigrationsToApply(files) {
  const real = (files || [])
    .filter((f) => migrationPrefix(f) !== null && !isSentinelMigration(f))
    .sort((a, b) => migrationPrefix(a) - migrationPrefix(b));
  if (!real.length) return [];
  return [real[real.length - 1]];
}
