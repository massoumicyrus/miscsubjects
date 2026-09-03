#!/usr/bin/env node
/**
 * Send approved meta-leads broadcast to all phones in /tmp/meta_leads.json via Blooio.
 * Usage: TERMINAL_KEY=... node scripts/meta_leads_broadcast.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from "fs";
import { buildBroadcastMessage } from "../functions/_lib/meta_leads.js";

const DISPATCH = "https://miscsubjects.com/api/dispatch";
const KEY = process.env.TERMINAL_KEY;
const dryRun = process.argv.includes("--dry-run");

const BROADCAST = buildBroadcastMessage();

const STAFF_SUFFIXES = ["[OWNER_PHONE]", "4158186348", "4052032699", "[BUILD_PHONE]", "2065711028", "3104069604"];
const WA_GROUP = "WAG845ab708-58da-4867-b714-ea172823d82a";

function isStaff(phone) {
  const d = String(phone).replace(/\D/g, "");
  return STAFF_SUFFIXES.some((s) => d.endsWith(s));
}

async function dispatch(key, body) {
  const r = await fetch(DISPATCH, {
    method: "POST",
    headers: { "x-terminal-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ key, body }),
  });
  const j = await r.json().catch(() => ({}));
  return j;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!KEY) {
    console.error("TERMINAL_KEY required");
    process.exit(1);
  }
  const data = JSON.parse(readFileSync("/tmp/meta_leads.json", "utf8"));
  const phones = (data.phones || []).filter((p) => !isStaff(p));
  console.log(`Broadcasting to ${phones.length} leads${dryRun ? " (dry-run)" : ""}...`);

  const results = [];
  for (const phone of phones) {
    if (dryRun) {
      console.log("would send", phone);
      results.push({ phone, status: "dry-run" });
      continue;
    }
    const body = `send|${phone}|${BROADCAST}`;
    const j = await dispatch("BLOOIO", body);
    const ok = String(j.result || "").includes("202") || String(j.result || "").includes("200");
    results.push({ phone, trace: j.trace, result: String(j.result || "").slice(0, 120), ok });
    console.log(ok ? "✓" : "✗", phone, j.trace);
    await sleep(1200);
  }

  const sent = results.filter((r) => r.ok).length;
  const report = { at: new Date().toISOString(), total: phones.length, sent, results };
  writeFileSync("/tmp/meta_leads_broadcast.json", JSON.stringify(report, null, 2));

  if (!dryRun) {
    const summary = `✅ Broadcast sent to ${sent}/${phones.length} ebook leads.\nLead replies → this group (# + message, no auto-reply).`;
    await dispatch("TWOCHAT_SEND_GROUP", `[PHONE]|${WA_GROUP}|${summary}`);
    await dispatch("BLOOIO", `send|grp_98e1acc03a3148f3|${summary}`);
  }
  console.log(JSON.stringify({ sent, total: phones.length }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});