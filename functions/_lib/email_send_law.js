// STUB. The module that lived here is a tenant integration of the operating repository and is not
// part of the public primitive. The original (300 lines) exported the names below; each one
// throws with this path when used, so the kernel keeps its shape and a caller sees exactly what
// is absent. See docs/PUBLISHING.md, section "The primitive profile".
const excluded = (name) => new Proxy(function excluded() {}, {
  apply() { throw new Error('excluded from the public primitive: functions/_lib/email_send_law.js#' + name); },
  construct() { throw new Error('excluded from the public primitive: functions/_lib/email_send_law.js#' + name); },
  get(_t, p) { if (p === 'then' || p === Symbol.toPrimitive || p === Symbol.iterator || p === Symbol.toStringTag) return undefined; throw new Error('excluded from the public primitive: functions/_lib/email_send_law.js#' + name + '.' + String(p)); },
});
export const CLOSING_RE = excluded("CLOSING_RE");
export const CLOSING_TEMPLATE = excluded("CLOSING_TEMPLATE");
export const SENDER_CENTERED_RES = excluded("SENDER_CENTERED_RES");
export const VERIFY_RECEIPT_RE = excluded("VERIFY_RECEIPT_RE");
export const checkOutbound = excluded("checkOutbound");
export const senderCenteredHit = excluded("senderCenteredHit");
