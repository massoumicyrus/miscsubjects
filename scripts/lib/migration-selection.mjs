
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
