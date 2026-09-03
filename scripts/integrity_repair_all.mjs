#!/usr/bin/env node
/**
 * Scan all articles for broken source hash chains; repair via POST /api/protocol/repair.
 * Texts the owner with report.
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const PHONE = "[OWNER_PHONE]";
const RUN_ID = `integrity-${Date.now()}`;

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  const m = raw.match(/TERMINAL_KEY=(.+)/);
  if (!m) throw new Error("TERMINAL_KEY not found");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

async function get(path) {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`${path} HTTP ${r.status}`);
  return r.json();
}

async function repair(slug, key) {
  const r = await fetch(BASE + "/api/protocol/repair", {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": key },
    body: JSON.stringify({
      slug,
      normalize_provenance: true,
      model: "system/integrity-repair",
      channel: RUN_ID,
    }),
  });
  return { status: r.status, j: await r.json().catch(() => ({})) };
}

async function listSlugs(key) {
  // D1 is canonical — ARTICLES dispatch list is a slim subset (~188), misses oip-v3-* etc.
  const { execSync } = await import("child_process");
  const out = execSync(
    'wrangler d1 execute loop-content-spine --remote --command "SELECT slug FROM articles ORDER BY slug" --json',
    { cwd: new URL("..", import.meta.url).pathname, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  const parsed = JSON.parse(out);
  return parsed[0].results.map((r) => r.slug);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function text(key, msg) {
  await fetch(BASE + "/api/dispatch", {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": key },
    body: JSON.stringify({
      key: "SEND_BY_CHANNEL",
      body: `blooio|${PHONE}|${msg}`,
    }),
  });
}

async function main() {
  const key = loadKey();
  const slugs = await listSlugs(key);
  const broken = [];
  const stubs = [];
  const fixed = [];
  const failed = [];

  for (const slug of slugs) {
    let src;
    try {
      src = await get(`/api/articles/${slug}/sources`);
    } catch {
      continue;
    }
    const v = src.verification || {};
    if (v.valid !== false) continue;

    let body = "";
    try {
      const art = await get(`/api/articles/${slug}?format=json`);
      body = art.body || "";
    } catch {
      /* */
    }
    const row = {
      slug,
      reason: v.reason,
      sources: src.count || 0,
      body_len: body.length,
      stub: body.includes("canonical Total Structure shelf"),
    };
    broken.push(row);
    if (row.stub) stubs.push(slug);

    await sleep(250);
    const rep = await repair(slug, key);
    if (rep.j.error) {
      failed.push({ slug, error: rep.j.error });
      continue;
    }
    const src2 = await get(`/api/articles/${slug}/sources`);
    if (src2.verification?.valid) fixed.push(slug);
    else failed.push({ slug, still: src2.verification?.reason });
  }

  const lines = [
    "🔧 Integrity repair — Grok Build",
    `articles scanned: ${slugs.length}`,
    `broken chains found: ${broken.length}`,
    `repaired OK: ${fixed.length}`,
    `still broken: ${failed.length}`,
    `redirect stubs in broken set: ${stubs.length}`,
    "",
  ];
  if (fixed.length) {
    lines.push("FIXED:");
    for (const s of fixed.slice(0, 25)) lines.push(`  ✓ ${s}`);
    if (fixed.length > 25) lines.push(`  …+${fixed.length - 25} more`);
  }
  if (failed.length) {
    lines.push("", "STILL BROKEN:");
    for (const f of failed.slice(0, 15)) {
      lines.push(`  ✗ ${f.slug} ${f.error || f.still || ""}`);
    }
    if (failed.length > 15) lines.push(`  …+${failed.length - 15} more`);
  }
  if (stubs.length) {
    lines.push("", "STUBS (need body merge, not just rehash):");
    for (const s of stubs.slice(0, 10)) lines.push(`  → ${s}`);
  }

  const report = lines.join("\n");
  console.log(report);
  await text(key, report.slice(0, 3500));
  console.log("texted");
}

main().catch(async (e) => {
  console.error(e);
  try {
    const key = loadKey();
    await text(key, `Integrity repair FAILED: ${String(e.message || e).slice(0, 500)}\n— Grok Build`);
  } catch {
    /* */
  }
  process.exit(1);
});