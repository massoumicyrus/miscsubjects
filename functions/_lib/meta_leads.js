// Meta / iMessage ad lead funnel — ops group routing, no unsolicited auto-replies.

export const META_OPS_GROUP = "grp_98e1acc03a3148f3"; // the owner + Will (Xxxxx marker group)
export const META_OPS_GROUP_2 = "grp_bf3156c4514448d3"; // Will + Meagan + model

/** WhatsApp ops on 2chat (Oompa Loompa = [PHONE]). UUID captured from webhooks. */
export const META_OPS_2CHAT_NAME = "StatePep";
export const META_OPS_2CHAT_SETTING = "meta_ops_2chat_group";

/** Article links — /a/ paths are not cloaked (only `/` root is). */
export const META_ARTICLE_BASE = "https://miscsubjects.com/a/";

/** Staff who may command the build in ops groups or 1:1. */
export const META_STAFF = [
  { name: "the owner", phone: "[OWNER_PHONE]", role: "owner" },
  { name: "Will", phone: "[PHONE]", role: "cto" },
  { name: "JP", phone: "[PHONE]", role: "ceo" },
];

const BUILD_LINES = ["[BUILD_PHONE]", "[PHONE]", "[PHONE]"];

function norm(p) {
  return String(p || "").replace(/\D/g, "");
}

export function isBuildLine(p) {
  const d = norm(p);
  return BUILD_LINES.some((b) => d.endsWith(norm(b)));
}

export function isMetaStaff(p) {
  const d = norm(p);
  return META_STAFF.some((s) => d.endsWith(norm(s.phone)));
}

export function isStatePepGroupName(name) {
  return String(name || "").trim().toLowerCase() === META_OPS_2CHAT_NAME.toLowerCase();
}

export function isMetaOpsGroup(chat, { groupName, ops2chatGroup } = {}) {
  const id = String(chat || "");
  if (id === META_OPS_GROUP || id === META_OPS_GROUP_2) return true;
  if (ops2chatGroup && id === ops2chatGroup) return true;
  if (isStatePepGroupName(groupName)) return true;
  return false;
}

export async function getMetaOps2chatGroup(env) {
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = ?"
    ).bind(META_OPS_2CHAT_SETTING).first();
    const v = String(row?.value || "").trim();
    return v || null;
  } catch {
    return null;
  }
}

export async function saveMetaOps2chatGroup(env, uuid, waGroupId) {
  const id = String(uuid || "").trim();
  if (!id.startsWith("WAG")) return;
  const ts = new Date().toISOString();
  const payload = waGroupId ? `${id}|${waGroupId}` : id;
  await env.DB.prepare(
    "INSERT OR REPLACE INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)"
  ).bind(
    META_OPS_2CHAT_SETTING,
    payload,
    "StatePep WhatsApp ops group (2chat WAG uuid|wa_group_id)",
    ts
  ).run();
}

/** Inbound from a Meta lead (not staff, not build line, not ops group). */
export function isMetaLeadInbound(m) {
  if (!m || m.isGroup) return false;
  if (isBuildLine(m.from)) return false;
  if (isMetaStaff(m.from)) return false;
  return true;
}

export function formatLeadForward(m) {
  const phone = m.from || m.chat || "?";
  const preview = String(m.messageBody || "(attachment)").slice(0, 500);
  return (
    `📩 Lead reply (iMessage)\n` +
    `# ${phone}\n` +
    `Message: ${preview}\n\n` +
    `Reply lead: SEND ${phone} | your message\n` +
    `Coding agent: /grok <task>\n` +
    `(Build will not auto-reply to this lead.)`
  );
}

/** Expand DRAFT_BROADCAST_TEMPLATE for outbound send. */
export function buildBroadcastMessage() {
  return DRAFT_BROADCAST_TEMPLATE;
}

export const DRAFT_BROADCAST_TEMPLATE = `Hi — thanks for reaching out about Regeneration vs. Degeneration.

Our research articles on miscsubjects.com are the guide — breakdown vs. repair in plain language: what "degeneration" looks like day to day, and what "regeneration" means when people talk about tissue, nerves, and inflammation.

Each article has an article ledger — a source list behind the page (studies, reviews, etc.) so you can see where a claim came from, not just our summary. Research context only; not medical advice.

BPC-157 (tissue repair):
• Overview: ${META_ARTICLE_BASE}bpc-157
• Degenerative disc: ${META_ARTICLE_BASE}bpc-157-degenerative-disc
• vs NSAIDs (repair vs suppression): ${META_ARTICLE_BASE}bpc-vs-nsaids-comparison
• + ARA for herniated disc: ${META_ARTICLE_BASE}bpc-ara-herniated-disc
• After steroid injections: ${META_ARTICLE_BASE}bpc-157-corticosteroid-injection

TB-500 (recovery & mobility):
• Overview: ${META_ARTICLE_BASE}tb-500

ARA-290 (nerve repair):
• Overview: ${META_ARTICLE_BASE}ara-290
• Herniated disc: ${META_ARTICLE_BASE}ara-290-herniated-disc
• Sciatica: ${META_ARTICLE_BASE}ara-290-sciatica
• vs gabapentin/Lyrica: ${META_ARTICLE_BASE}ara-290-gabapentin-lyrica

Back / spine stacks:
• Recovery stack (herniated disc): ${META_ARTICLE_BASE}recovery-stack-herniated-disc
• How peptides fit the picture: ${META_ARTICLE_BASE}what-are-peptides

Peptides for research → LeoResearch.com (storefront only; links above are articles).

Questions? Just reply here.`;