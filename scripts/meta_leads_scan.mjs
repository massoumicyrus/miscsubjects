#!/usr/bin/env node
/**
 * Scan Blooio 1:1 chats for Meta lead / ebook signups (last 7 days).
 * Does NOT send broadcast — writes /tmp/meta_leads.json
 */
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const DAYS = Number(process.env.LEAD_DAYS || 7);

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
  "[OWNER_PHONE]",
  "[BUILD_PHONE]",
  "2065711028",
  "4052032699",
  "4158186348",
  "4158186483",
  "3393640018",
  "3104069604",
];
const EBOOK_KW = [
  "ebook",
  "e-book",
  "regeneration vs",
  "degeneration ebook",
  "send me the regeneration",
];

function norm(p) {
  return String(p || "").replace(/\D/g, "");
}
function isStaff(n) {
  const d = norm(n);
  return STAFF_SUFFIX.some((s) => d.endsWith(s));
}
function parseTs(ts) {
  if (!ts) return null;
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : null;
}

const key = loadKey();
const weekAgo = Date.now() - DAYS * 86400000;
const chatsData = await dispatch(key, "chats_list|200|recent");
const chats = chatsData?.chats || [];

const candidates = chats.filter((c) => {
  const id = c.id || c.external_id;
  if (!id || c.is_group || String(id).startsWith("grp_") || isStaff(id)) return false;
  const lm = c.last_message || {};
  const ts = parseTs(lm.created_at || lm.timestamp || c.updated_at);
  return !ts || ts >= weekAgo;
});

const leads = [];
const inboundWeek = [];

for (let i = 0; i < candidates.length; i++) {
  const phone = candidates[i].id || candidates[i].external_id;
  const msgsData = await dispatch(key, `messages_list|${phone}|40|0`);
  const items = msgsData?.messages || msgsData?.data || [];
  const inbound = [];
  for (const msg of items) {
    const dir = String(msg.direction || msg.type || "").toLowerCase();
    if (dir && !/in/.test(dir)) continue;
    const rawTs = msg.time_sent || msg.created_at || msg.timestamp;
    let ts = parseTs(rawTs);
    if (!ts && rawTs) {
      const n = Number(rawTs);
      if (n > 1e12) ts = n;
      else if (n > 1e9) ts = n * 1000;
    }
    if (ts && ts < weekAgo) continue;
    inbound.push(String(msg.text || msg.body || ""));
  }
  if (!inbound.length) continue;
  inboundWeek.push(phone);
  const blob = inbound.join(" ").toLowerCase();
  if (EBOOK_KW.some((k) => blob.includes(k))) {
    leads.push({ phone, sample: inbound[inbound.length - 1].slice(0, 120) });
  }
  if ((i + 1) % 25 === 0) console.error(`scanned ${i + 1}/${candidates.length}`);
}

const out = {
  scanned_at: new Date().toISOString(),
  window_days: DAYS,
  active_chats_7d: candidates.length,
  inbound_7d: inboundWeek.length,
  ebook_leads: leads.length,
  leads,
  phones: leads.map((l) => l.phone),
};
writeFileSync("/tmp/meta_leads.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ebook_leads: out.ebook_leads, inbound_7d: out.inbound_7d, active_chats_7d: out.active_chats_7d }));