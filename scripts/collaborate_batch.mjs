#!/usr/bin/env node
/**
 * Run Kimi then cheap Gemini across article slugs; text the owner a summary.
 * Usage: node scripts/collaborate_batch.mjs [--slug=bpc-157] [--phone=[OWNER_PHONE]] [--kimi-only] [--gemini-only]
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const PHONE = process.env.OWNER_PHONE || "[OWNER_PHONE]";
const args = process.argv.slice(2);
const slugArg = args.find((a) => a.startsWith("--slug="));
const phoneArg = args.find((a) => a.startsWith("--phone="));
const kimiOnly = args.includes("--kimi-only");
const geminiOnly = args.includes("--gemini-only");
const slugs = slugArg
  ? [slugArg.split("=")[1]]
  : ["bpc-157", "tb-500", "wolverine-stack-glp1"];
const phone = phoneArg ? phoneArg.split("=")[1] : PHONE;

const KIMI = "kimi/moonshot-v1-8k";
const GEMINI = "gemini/gemini-2.5-flash";

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  try {
    const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
    const m = raw.match(/TERMINAL_KEY=(.+)/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
  throw new Error("TERMINAL_KEY not found");
}

async function api(path, body, key) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": key },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

async function get(path) {
  const r = await fetch(BASE + path);
  return { status: r.status, j: await r.json().catch(() => ({})) };
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
  const text = await r.text();
  return { status: r.status, text };
}

function summarizeRun(slug, label, before, after, result) {
  const lines = [];
  lines.push(`${slug} · ${label}`);
  if (result.j.error) {
    lines.push(`  ERR: ${result.j.error}`);
    if (result.j.tries) lines.push(`  tries: ${JSON.stringify(result.j.tries)}`);
    return lines.join("\n");
  }
  const claimsBefore = before.j.claims ?? before.j.active_claims ?? "?";
  const claimsAfter = after.j.claims ?? after.j.active_claims ?? "?";
  lines.push(`  claims ${claimsBefore} → ${claimsAfter}`);
  if (result.j.material === false) lines.push("  (no material additions)");
  if (result.j.claims_added?.length)
    lines.push(`  +${result.j.claims_added.join(", ")}`);
  if (result.j.challenge_claim_id)
    lines.push(`  challenge ${result.j.challenge_claim_id}`);
  if (result.j.rationale)
    lines.push(`  ${String(result.j.rationale).slice(0, 120)}`);
  lines.push(`  ${BASE}/a/${slug}`);
  return lines.join("\n");
}

async function collaborate(slug, model, key) {
  return api("/api/protocol/collaborate", { slug, model, max_tokens: 4096 }, key);
}

async function textOwner(lines, terminalKey) {
  const anyErr = lines.some((l) => l.includes("ERR:"));
  const msg = [
    anyErr ? "⚠️ Collaborator batch (some errors)" : "🧪 Collaborator batch",
    "",
    ...lines,
    "",
    "Voxels: " + BASE + "/api/articles/bpc-157/voxels",
    "Health: " + BASE + "/api/articles/bpc-157/health",
  ].join("\n");
  const chunks = [];
  for (let i = 0; i < msg.length; i += 900) chunks.push(msg.slice(i, i + 900));
  for (const chunk of chunks) {
    const d = await dispatch("SEND_BY_CHANNEL", `blooio|${phone}|${chunk}`, terminalKey);
    console.log("text:", d.status, d.text.slice(0, 200));
  }
}

async function main() {
  const key = loadKey();
  const report = [];

  for (const slug of slugs) {
    const before = await get(`/api/articles/${slug}/health`);
    console.log("\n=== " + slug + " (before:", before.j.claims ?? before.j.active_claims, ") ===");

    let midHealth = before;
    if (!geminiOnly) {
      console.log("Kimi...");
      const kimi = await collaborate(slug, KIMI, key);
      console.log(kimi.status, kimi.j.error || kimi.j.claims_added || kimi.j.material);
      const afterKimi = await get(`/api/articles/${slug}/health`);
      report.push(summarizeRun(slug, "Kimi", before, afterKimi, kimi));
      midHealth = afterKimi;
    }

    if (!kimiOnly) {
      console.log("Gemini...");
      const gem = await collaborate(slug, GEMINI, key);
      console.log(gem.status, gem.j.error || gem.j.claims_added || gem.j.material);
      const afterGem = await get(`/api/articles/${slug}/health`);
      report.push(summarizeRun(slug, "Gemini", midHealth, afterGem, gem));
    }
  }

  console.log("\n--- Report ---\n" + report.join("\n\n"));
  await textOwner(report, key);
  console.log("\nDone. Texted", phone);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});