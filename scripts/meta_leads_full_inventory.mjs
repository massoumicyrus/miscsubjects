#!/usr/bin/env node
/**
 * Full Blooio inventory: all ebook / health-guide signups (not just 7d).
 * Writes /tmp/meta_leads_full.json
 */
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  const m = raw.match(/TERMINAL_KEY=(.+)/);
  if (!m) throw new Error("TERMINAL_KEY missing");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

async function dispatch(key, body) {
  const r = await fetch(BASE + "/api/dispatch", {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": key },
    body: JSON.stringify({ key: "BLOOIO", body }),
  });
  const j = await r.json().catch(() => ({}));
  const res = String(j.result || "");
  const m = res.match(/HTTP \d+:(.*)/s);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

const STAFF_SUFFIX = [
  "[OWNER_PHONE]", "[BUILD_PHONE]", "2065711028", "4052032699",
  "4158186348", "4158186483", "3393640018", "3104069604",
  "15555555555", "15555555556",
];
const EBOOK_KW = [
  "ebook", "e-book", "regeneration vs", "degeneration",
  "health hacks", "health hack", "health ai",
  "send me the regeneration", "send me the health",
  "free ebook", "grab the regeneration",
];
const OUTBOUND_EBOOK = ["miscsubjects.com/a/", "article ledger"];
const BROADCAST_KW = ["article ledger", "miscsubjects.com/a/", "breakdown vs. repair"];
const REFUSAL_KW = [
  "don't have", "do not have", "cannot send", "no tool",
  "refusal", "not available", "no such ebook", "no ebook",
];

function norm(p) {
  return String(p || "").replace(/\D/g, "");
}
function isStaff(n) {
  const d = norm(n);
  return STAFF_SUFFIX.some((s) => d.endsWith(s));
}
function isInbound(msg) {
  const dir = String(msg.direction || msg.type || "").toLowerCase();
  if (dir && !/in/.test(dir)) return false;
  const from = norm(msg.sender || msg.from || msg.external_id);
  const to = norm(msg.receiver || msg.to || msg.internal_id);
  if (from && to && from === to) return false;
  return true;
}

function classify(inboundTexts, outboundTexts) {
  const inBlob = inboundTexts.join(" ").toLowerCase();
  const outBlob = outboundTexts.join(" ").toLowerCase();
  if (!EBOOK_KW.some((k) => inBlob.includes(k))) return null;
  if (BROADCAST_KW.some((k) => outBlob.includes(k))) return "already_broadcast";
  if (OUTBOUND_EBOOK.some((k) => outBlob.includes(k))) return "got_ebook_link_only";
  if (REFUSAL_KW.some((k) => outBlob.includes(k))) return "refused_or_no_ebook";
  if (outboundTexts.length === 0) return "no_reply";
  return "other_response";
}

const key = loadKey();
const chatsData = await dispatch(key, "chats_list|500|recent");
const chats = (chatsData?.chats || []).filter((c) => {
  const id = c.id || c.external_id;
  return id && !c.is_group && !String(id).startsWith("grp_") && !isStaff(id);
});

const leads = [];
for (let i = 0; i < chats.length; i++) {
  const phone = chats[i].id || chats[i].external_id;
  const msgsData = await dispatch(key, `messages_list|${phone}|60|0`);
  const items = msgsData?.messages || msgsData?.data || [];
  const inbound = [];
  const outbound = [];
  for (const msg of items) {
    const text = String(msg.text || msg.body || "");
    if (!text) continue;
    if (isInbound(msg)) inbound.push(text);
    else outbound.push(text);
  }
  const status = classify(inbound, outbound);
  if (!status) continue;
  const firstAsk = inbound.find((t) =>
    EBOOK_KW.some((k) => t.toLowerCase().includes(k))
  ) || inbound[0] || "";
  leads.push({
    phone,
    status,
    first_ask: firstAsk.slice(0, 140),
    last_inbound: inbound[0]?.slice(0, 100) || "",
    last_outbound: outbound[0]?.slice(0, 100) || "",
    msg_count: items.length,
  });
  if ((i + 1) % 40 === 0) console.error(`scanned ${i + 1}/${chats.length}`);
}

const byStatus = {};
for (const l of leads) {
  byStatus[l.status] = (byStatus[l.status] || 0) + 1;
}

const needFirstMessage = leads.filter(
  (l) => !["already_broadcast"].includes(l.status)
);

const out = {
  scanned_at: new Date().toISOString(),
  total_chats_scanned: chats.length,
  ebook_leads_total: leads.length,
  by_status: byStatus,
  need_first_message_count: needFirstMessage.length,
  need_first_message: needFirstMessage,
  all_leads: leads,
};
writeFileSync("/tmp/meta_leads_full.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  ebook_leads_total: out.ebook_leads_total,
  by_status: out.by_status,
  need_first_message_count: out.need_first_message_count,
}));