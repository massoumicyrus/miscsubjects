#!/usr/bin/env node
/**
 * Backfill first message to leads who never got the article-library reply.
 * Reads phones from /tmp/meta_leads_backfill.json (or --phones file).
 * Usage: node scripts/meta_leads_backfill.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { buildBroadcastMessage } from "../functions/_lib/meta_leads.js";

const DISPATCH = "https://miscsubjects.com/api/dispatch";
const WA_GROUP = "WAG845ab708-58da-4867-b714-ea172823d82a";
const OPS_IMSG = "grp_98e1acc03a3148f3";
const MESSAGE = buildBroadcastMessage();

const STAFF_SUFFIXES = [
  "[OWNER_PHONE]", "4158186348", "4052032699", "[BUILD_PHONE]",
  "2065711028", "3104069604",
];

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  const m = raw.match(/TERMINAL_KEY=(.+)/);
  if (!m) throw new Error("TERMINAL_KEY missing");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

function isStaff(phone) {
  const d = String(phone).replace(/\D/g, "");
  return STAFF_SUFFIXES.some((s) => d.endsWith(s));
}

async function dispatch(apiKey, rowKey, body) {
  const r = await fetch(DISPATCH, {
    method: "POST",
    headers: { "x-terminal-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ key: rowKey, body }),
  });
  const text = await r.text();
  try {
    return { status: r.status, ...JSON.parse(text) };
  } catch {
    return { status: r.status, result: text.slice(0, 300), error: "bad_json" };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const phonesArg = process.argv.find((a) => a.startsWith("--phones="));
  const src = phonesArg
    ? phonesArg.slice("--phones=".length)
    : "/tmp/meta_leads_backfill.json";

  const key = loadKey();
  const data = JSON.parse(readFileSync(src, "utf8"));
  const phones = (data.phones || []).filter((p) => p && !isStaff(p));

  console.log(`Backfill → ${phones.length} leads${dryRun ? " (dry-run)" : ""}`);

  const results = [];
  for (const phone of phones) {
    if (dryRun) {
      console.log("would send", phone);
      results.push({ phone, status: "dry-run" });
      continue;
    }
    let j = await dispatch(key, "BLOOIO", `send|${phone}|${MESSAGE}`);
    let res = String(j.result || "");
    let ok = res.includes("202") || res.includes("200");
    if (!ok) {
      await sleep(2000);
      j = await dispatch(key, "BLOOIO", `send|${phone}|${MESSAGE}`);
      res = String(j.result || "");
      ok = res.includes("202") || res.includes("200");
    }
    results.push({
      phone,
      trace: j.trace,
      ok,
      status: j.status,
      result: res.slice(0, 200) || j.error || "",
    });
    console.log(ok ? "✓" : "✗", phone, res.slice(0, 80) || j.status);
    await sleep(2500);
  }

  const sent = results.filter((r) => r.ok).length;
  const report = {
    at: new Date().toISOString(),
    message_preview: MESSAGE.slice(0, 200),
    total: phones.length,
    sent,
    results,
  };
  writeFileSync("/tmp/meta_leads_backfill_sent.json", JSON.stringify(report, null, 2));
  writeFileSync(
    "/tmp/meta_leads_backfill.json",
    JSON.stringify({ first_message: MESSAGE, phones, count: phones.length }, null, 2)
  );

  if (!dryRun) {
    const summary =
      `✅ Article-library backfill sent to ${sent}/${phones.length} leads.\n` +
      `No ebook URL — miscsubjects.com/a/ articles only. Shop = LeoResearch.com.\n` +
      `Lead replies → ops (# + message, no auto-reply).`;
    await dispatch(key, "TWOCHAT_SEND_GROUP", `[PHONE]|${WA_GROUP}|${summary}`);
    await dispatch(key, "BLOOIO", `send|${OPS_IMSG}|${summary}`);
  }

  console.log(JSON.stringify({ sent, total: phones.length }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});