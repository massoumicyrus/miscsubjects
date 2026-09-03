// STUB. The module that lived here is a tenant integration of the operating repository and is not
// part of the public primitive. The original (129 lines) exported the names below; each one
// throws with this path when used, so the kernel keeps its shape and a caller sees exactly what
// is absent. See docs/PUBLISHING.md, section "The primitive profile".
const excluded = (name) => new Proxy(function excluded() {}, {
  apply() { throw new Error('excluded from the public primitive: functions/_lib/meta_leads.js#' + name); },
  construct() { throw new Error('excluded from the public primitive: functions/_lib/meta_leads.js#' + name); },
  get(_t, p) { if (p === 'then' || p === Symbol.toPrimitive || p === Symbol.iterator || p === Symbol.toStringTag) return undefined; throw new Error('excluded from the public primitive: functions/_lib/meta_leads.js#' + name + '.' + String(p)); },
});
export const DRAFT_BROADCAST_TEMPLATE = excluded("DRAFT_BROADCAST_TEMPLATE");
export const META_ARTICLE_BASE = excluded("META_ARTICLE_BASE");
export const META_OPS_2CHAT_NAME = excluded("META_OPS_2CHAT_NAME");
export const META_OPS_2CHAT_SETTING = excluded("META_OPS_2CHAT_SETTING");
export const META_OPS_GROUP = excluded("META_OPS_GROUP");
export const META_OPS_GROUP_2 = excluded("META_OPS_GROUP_2");
export const META_STAFF = excluded("META_STAFF");
export const buildBroadcastMessage = excluded("buildBroadcastMessage");
export const formatLeadForward = excluded("formatLeadForward");
export const getMetaOps2chatGroup = excluded("getMetaOps2chatGroup");
export const isBuildLine = excluded("isBuildLine");
export const isMetaLeadInbound = excluded("isMetaLeadInbound");
export const isMetaOpsGroup = excluded("isMetaOpsGroup");
export const isMetaStaff = excluded("isMetaStaff");
export const isStatePepGroupName = excluded("isStatePepGroupName");
export const saveMetaOps2chatGroup = excluded("saveMetaOps2chatGroup");
