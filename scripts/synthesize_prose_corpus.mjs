#!/usr/bin/env node
/**
 * Rewrite thin article bodies from ledger topology — plain English.
 * Usage: node scripts/synthesize_prose_corpus.mjs [--slug bpc-157] [--all] [--force]
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const force = process.argv.includes("--force");
const slugArg = process.argv.find((a, i) => process.argv[i - 1] === "--slug");
const all = process.argv.includes("--all");

function terminalKey() {
  try {
    const envPath = join(homedir(), ".config", "grok-bridge.env");
    const m = readFileSync(envPath, "utf8").match(/TERMINAL_KEY=(.+)/);
    return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : "";
  } catch {
    return process.env.TERMINAL_KEY || "";
  }
}

async function listSlugs() {
  const r = await fetch(`${BASE}/api/articles`);
  const j = await r.json();
  return (j.articles || j.items || []).map((a) => a.slug).filter(Boolean);
}

async function synthesize(slug, key) {
  const r = await fetch(`${BASE}/api/protocol/synthesize-body`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-terminal-key": key,
    },
    body: JSON.stringify({ slug, force }),
  });
  const j = await r.json().catch(() => ({}));
  return { slug, status: r.status, ...j };
}

async function main() {
  const key = terminalKey();
  if (!key) {
    console.error("TERMINAL_KEY missing");
    process.exit(1);
  }
  const slugs = slugArg ? [slugArg] : all ? await listSlugs() : ["bpc-157", "semax", "selank", "tb-500"];
  for (const slug of slugs) {
    process.stdout.write(`${slug}… `);
    const out = await synthesize(slug, key);
    if (out.skipped) console.log("skip", out.reason);
    else if (out.error) console.log("ERR", out.error);
    else console.log("ok", out.chars || 0, "chars");
    await new Promise((r) => setTimeout(r, 1500));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});