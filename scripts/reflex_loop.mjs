#!/usr/bin/env node
/**
 * Run reflex pass — graph probes live state vs vision claims; text the owner summary.
 * Usage: node scripts/reflex_loop.mjs [--slug=protocol] [--phone=[OWNER_PHONE]]
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const PHONE = process.env.OWNER_PHONE || "[OWNER_PHONE]";
const args = process.argv.slice(2);
const slugArg = args.find((a) => a.startsWith("--slug="));
const phoneArg = args.find((a) => a.startsWith("--phone="));
const slug = slugArg ? slugArg.split("=")[1] : "protocol";
const phone = phoneArg ? phoneArg.split("=")[1] : PHONE;

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  try {
    const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
    const m = raw.match(/TERMINAL_KEY=(.+)/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
  throw new Error("TERMINAL_KEY not found");
}

async function dispatch(key, body, terminalKey) {
  const r = await fetch(BASE + "/api/dispatch", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-terminal-key": terminalKey,
    },
    body: JSON.stringify({ key, body }),
  });
  return { status: r.status, text: await r.text() };
}

async function main() {
  const key = loadKey();
  console.log("Reflex pass on", slug, "...");

  const r = await fetch(BASE + "/api/protocol/reflex", {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": key },
    body: JSON.stringify({ slug }),
  });
  const j = await r.json().catch(() => ({}));
  console.log(r.status, j.error || j.claims_added || j.probes?.length);

  if (j.error) {
    console.error(j.error);
    process.exit(1);
  }

  const ok = (j.probes || []).filter((p) => p.ok);
  const fail = (j.probes || []).filter((p) => !p.ok && !p.gap);
  const gap = (j.probes || []).filter((p) => p.gap);

  const lines = [
    "🪞 Reflex pass — graph proving its shape",
    "",
    `slug: ${slug} · pass #${j.reflex_passes || "?"}`,
    `+${(j.claims_added || []).join(", ") || "none (already ran today)"}`,
    "",
    `✓ ${ok.length} OK · ✗ ${fail.length} FAIL · ○ ${gap.length} GAP (weaknesses)`,
    "",
    ...(j.probes || []).map((p) => {
      const mark = p.ok ? "✓" : p.gap ? "○" : "✗";
      return `${mark} ${p.vision_id}: ${p.label}\n   ${p.detail || ""}`;
    }),
    "",
    "Canvas: " + (j.url || BASE + "/graph.html?slugs=protocol,bpc-157&layer=reflex"),
  ];

  const msg = lines.join("\n");
  console.log("\n" + msg);

  const chunks = [];
  for (let i = 0; i < msg.length; i += 900) chunks.push(msg.slice(i, i + 900));
  for (const chunk of chunks) {
    const d = await dispatch("SEND_BY_CHANNEL", `blooio|${phone}|${chunk}`, key);
    console.log("text:", d.status, d.text.slice(0, 120));
  }
  console.log("\nDone. Texted", phone);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});