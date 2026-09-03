// STUB. The module that lived here is a tenant integration of the operating repository and is not
// part of the public primitive. The original (273 lines) exported the names below; each one
// throws with this path when used, so the kernel keeps its shape and a caller sees exactly what
// is absent. See docs/PUBLISHING.md, section "The primitive profile".
const excluded = (name) => new Proxy(function excluded() {}, {
  apply() { throw new Error('excluded from the public primitive: functions/_lib/send_proof.js#' + name); },
  construct() { throw new Error('excluded from the public primitive: functions/_lib/send_proof.js#' + name); },
  get(_t, p) { if (p === 'then' || p === Symbol.toPrimitive || p === Symbol.iterator || p === Symbol.toStringTag) return undefined; throw new Error('excluded from the public primitive: functions/_lib/send_proof.js#' + name + '.' + String(p)); },
});
export const WITNESS_ROW_KEY = excluded("WITNESS_ROW_KEY");
export const WITNESS_VERDICTS = excluded("WITNESS_VERDICTS");
export const backfillFromEmailSends = excluded("backfillFromEmailSends");
export const getProof = excluded("getProof");
export const mintSendProof = excluded("mintSendProof");
export const sha256Hex = excluded("sha256Hex");
export const verifyBlockText = excluded("verifyBlockText");
export const verifyChain = excluded("verifyChain");
export const verifyUrlOf = excluded("verifyUrlOf");
export const witnessSign = excluded("witnessSign");
