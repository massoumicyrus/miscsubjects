// STUB. The module that lived here is a tenant integration of the operating repository and is not
// part of the public primitive. The original (1176 lines) exported the names below; each one
// throws with this path when used, so the kernel keeps its shape and a caller sees exactly what
// is absent. See docs/PUBLISHING.md, section "The primitive profile".
const excluded = (name) => new Proxy(function excluded() {}, {
  apply() { throw new Error('excluded from the public primitive: functions/_lib/obsidian_vault.js#' + name); },
  construct() { throw new Error('excluded from the public primitive: functions/_lib/obsidian_vault.js#' + name); },
  get(_t, p) { if (p === 'then' || p === Symbol.toPrimitive || p === Symbol.iterator || p === Symbol.toStringTag) return undefined; throw new Error('excluded from the public primitive: functions/_lib/obsidian_vault.js#' + name + '.' + String(p)); },
});
export const bodyToWikilinks = excluded("bodyToWikilinks");
export const buildObsidianVault = excluded("buildObsidianVault");
export const frontmatterFirst = excluded("frontmatterFirst");
export const obsidianVaultManifest = excluded("obsidianVaultManifest");
export const paging = excluded("paging");
export const vaultFolder = excluded("vaultFolder");
export const wantsAll = excluded("wantsAll");
export const zipFiles = excluded("zipFiles");
