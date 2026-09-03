// STUB. The module that lived here is a tenant integration of the operating repository and is not
// part of the public primitive. The original (197 lines) exported the names below; each one
// throws with this path when used, so the kernel keeps its shape and a caller sees exactly what
// is absent. See docs/PUBLISHING.md, section "The primitive profile".
const excluded = (name) => new Proxy(function excluded() {}, {
  apply() { throw new Error('excluded from the public primitive: functions/_lib/normandy_contract.js#' + name); },
  construct() { throw new Error('excluded from the public primitive: functions/_lib/normandy_contract.js#' + name); },
  get(_t, p) { if (p === 'then' || p === Symbol.toPrimitive || p === Symbol.iterator || p === Symbol.toStringTag) return undefined; throw new Error('excluded from the public primitive: functions/_lib/normandy_contract.js#' + name + '.' + String(p)); },
});
export const NORMANDY_SLOTS = excluded("NORMANDY_SLOTS");
export const STANDING_ANSWER_LIMITS = excluded("STANDING_ANSWER_LIMITS");
export const completeNormandyAssignment = excluded("completeNormandyAssignment");
export const contributionSimilarity = excluded("contributionSimilarity");
export const findClaimDuplicate = excluded("findClaimDuplicate");
export const normandyMarkdown = excluded("normandyMarkdown");
export const readNormandyAssignment = excluded("readNormandyAssignment");
export const reserveNormandyAssignment = excluded("reserveNormandyAssignment");
