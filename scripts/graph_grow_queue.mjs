#!/usr/bin/env node
/**
 * Run model growth queue — populate → Kimi → Gemini → repair → reflex.
 * Usage: node scripts/graph_grow_queue.mjs [--batch=10] [--all] [--slug=bpc-157] [--phone=[OWNER_PHONE]]
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const PHONE = process.env.OWNER_PHONE || "";
const args = process.argv.slice(2);
const batchArg = args.find((a) => a.startsWith("--batch="));
const slugArg = args.find((a) => a.startsWith("--slug="));
const phoneArg = args.find((a) => a.startsWith("--phone="));
const all = args.includes("--all") || args.includes("--corpus");
const batch = batchArg ? Number(batchArg.split("=")[1]) : 3;
const phone = phoneArg ? phoneArg.split("=")[1] : PHONE;

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  const m = raw.match(/TERMINAL_KEY=(.+)/);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  throw new Error("TERMINAL_KEY not found");
}

async function dispatch(key, body, terminalKey) {
  const r = await fetch(BASE + "/api/dispatch", {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": terminalKey },
    body: JSON.stringify({ key, body }),
  });
  return { status: r.status, text: await r.text() };
}

async function main() {
  const key = loadKey();
  const body = { batch, all: all || !slugArg };
  if (slugArg) {
    body.slug = slugArg.split("=")[1];
    delete body.all;
  }

  console.log("GRAPH_GROW batch", batch, "...");
  const r = await fetch(BASE + "/api/protocol/grow", {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": key },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));

  const lines = ["🌱 Graph grow queue", ""];
  const ticks = j.results || (j.tick ? [j] : []);
  for (const t of ticks) {
    const tick = t.tick || {};
    const ex = t.explain_step || t.explain || {};
    lines.push(`${tick.slug} · ${tick.step} — ${tick.reason || ""}`);
    if (ex.why) lines.push(`  why: ${ex.why}`);
    if (t.result?.claims_added?.length) lines.push(`  +claims ${t.result.claims_added.join(", ")}`);
    if (t.result?.added) lines.push(`  +sources ${t.result.added}`);
    if (t.result?.error) lines.push(`  ERR: ${t.result.error}`);
  }
  if (j._explain?.how) lines.push("", "how: " + j._explain.how);
  lines.push("", "Graph: " + BASE + "/graph.html?slugs=protocol,bpc-157");

  const msg = lines.join("\n");
  console.log(msg);

  if (phone) {
    const chunks = [];
    for (let i = 0; i < msg.length; i += 900) chunks.push(msg.slice(i, i + 900));
    for (const chunk of chunks) {
      const d = await dispatch("SEND_BY_CHANNEL", `blooio|${phone}|${chunk}`, key);
      console.log("text:", d.status);
    }
  } else {
    console.log("(skip SMS — set OWNER_PHONE or --phone=)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});