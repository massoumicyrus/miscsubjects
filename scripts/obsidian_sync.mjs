#!/usr/bin/env node
/**
 * Bidirectional Obsidian sync — local annotations → challenges/claims on live ledger; then pull.
 * Usage: node scripts/obsidian_sync.mjs [--vault=~/miscsubjects-vault] [--dry-run] [--pull-only]
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const args = process.argv.slice(2);
const vaultArg = args.find((a) => a.startsWith("--vault="));
const dryRun = args.includes("--dry-run");
const pullOnly = args.includes("--pull-only");
const ingestOnly = args.includes("--ingest-only");
const vaultRoot = (vaultArg ? vaultArg.split("=")[1] : "~/miscsubjects-vault").replace(
  /^~/,
  homedir(),
);

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  const m = raw.match(/TERMINAL_KEY=(.+)/);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  throw new Error("TERMINAL_KEY not found");
}

function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split("\n")) {
    const p = line.indexOf(":");
    if (p <= 0) continue;
    const k = line.slice(0, p).trim();
    let v = line.slice(p + 1).trim().replace(/^["']|["']$/g, "");
    out[k] = v;
  }
  return out;
}

function localAnnotation(text) {
  const marker = "### Local annotation";
  const i = text.indexOf(marker);
  if (i < 0) return "";
  return text
    .slice(i + marker.length)
    .split("## Sync")[0]
    .trim()
    .replace(/^_Add.*_\n?/g, "")
    .trim();
}

function walkClaimAtoms(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "claims") walkClaimAtoms(p, out);
      else walkClaimAtoms(p, out);
    } else if (name.endsWith(".md") && p.includes("/claims/")) {
      out.push(p);
    }
  }
  return out;
}

function slugFromPath(filePath) {
  const parts = filePath.split("/");
  const idx = parts.findIndex((p) =>
    ["Peptides", "Stacks", "Conditions", "System", "Articles"].includes(p),
  );
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null;
}

async function api(path, body, key) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": key },
    body: JSON.stringify(body),
  });
  return { status: r.status, j: await r.json().catch(() => ({})) };
}

async function syncAnnotations(key) {
  const files = walkClaimAtoms(vaultRoot);
  const actions = [];
  for (const fp of files) {
    const text = readFileSync(fp, "utf8");
    const fm = parseFrontmatter(text);
    const note = localAnnotation(text);
    if (!note || note.length < 12) continue;
    const slug = fm.slug || slugFromPath(fp);
    const target = fm.id;
    if (!slug || !target) continue;
    const action = {
      type: "challenge",
      slug,
      target_claim_id: target,
      text: note.slice(0, 2000),
      tier: "mechanistic",
      channel: "obsidian_sync",
    };
    actions.push(action);
    if (!dryRun) {
      const r = await api("/api/protocol/challenge", action, key);
      console.log("challenge", target, r.status, r.j.error || r.j.challenge_claim_id || "ok");
    } else {
      console.log("[dry-run] challenge", target, "on", slug, ":", note.slice(0, 80));
    }
  }
  return actions.length;
}

async function pullVault() {
  const { spawnSync } = await import("child_process");
  const slugArg = args.find((a) => a.startsWith("--slugs="));
  const pullArgs = [join(__dir, "obsidian_pull.mjs"), `--out=${vaultRoot}`];
  if (slugArg) pullArgs.push(slugArg);
  else pullArgs.push("--slugs=protocol,bpc-157");
  const r = spawnSync(process.execPath, pullArgs, { stdio: "inherit" });
  return r.status === 0;
}

async function main() {
  const key = loadKey();
  if (!pullOnly && !ingestOnly) {
    const n = await syncAnnotations(key);
    console.log(n ? `Synced ${n} local annotation(s)` : "No local annotations to sync");
  }
  if (!dryRun) {
    console.log("Pulling fresh vault...");
    await pullVault();
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});