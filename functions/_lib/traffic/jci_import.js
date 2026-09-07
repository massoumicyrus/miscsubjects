// STUB. The module that lived here is a tenant integration of the operating repository and is not
// part of the public primitive. The original (272 lines) exported the names below; each one
// throws with this path when used, so the kernel keeps its shape and a caller sees exactly what
// is absent. See docs/PUBLISHING.md, section "The primitive profile".
const excluded = (name) => new Proxy(function excluded() {}, {
  apply() { throw new Error('excluded from the public primitive: functions/_lib/traffic/jci_import.js#' + name); },
  construct() { throw new Error('excluded from the public primitive: functions/_lib/traffic/jci_import.js#' + name); },
  get(_t, p) { if (p === 'then' || p === Symbol.toPrimitive || p === Symbol.iterator || p === Symbol.toStringTag) return undefined; throw new Error('excluded from the public primitive: functions/_lib/traffic/jci_import.js#' + name + '.' + String(p)); },
});
export const REASON_GUIDE = excluded("REASON_GUIDE");
export const comparisonMatrix = excluded("comparisonMatrix");
export const finalizeHistory = excluded("finalizeHistory");
export const historyFor = excluded("historyFor");
export const importJciPage = excluded("importJciPage");
export const ledgerImport = excluded("ledgerImport");
export const newId = excluded("newId");
export const normalizeJciReason = excluded("normalizeJciReason");
export const reasonInventory = excluded("reasonInventory");
export const replayHistoryPage = excluded("replayHistoryPage");
export const seedPopulations = excluded("seedPopulations");
export const upsertMembership = excluded("upsertMembership");
