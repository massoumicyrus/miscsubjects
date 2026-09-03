#!/usr/bin/env node
/**
 * Capability eater — scout MCP catalogs, dedup against builder_queue, file new servers as work.
 *
 * SAFE BY DESIGN: this only SCOUTS and QUEUES. It never installs, attaches, or executes
 * third-party code. Wrapping a scouted server (MCP_ATTACH = running an npm/remote server on
 * this machine) is staged in the queue body as [needs-approval] with the exact command, for a
 * one-tap human approve. Lifting that gate is a deliberate edit, not a default.
 *
 * Usage: node scripts/eat.mjs [--limit=25] [--dry]
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const args = process.argv.slice(2);
const LIMIT = Number((args.find((a) => a.startsWith("--limit=")) || "--limit=25").split("=")[1]);
const DRY = args.includes("--dry");

// Default: curated official reference list only (useful, low-noise). The uncurated
// community firehose (~2800 repos) is opt-in via --wide and is NOT what the timer runs.
const WIDE = args.includes("--wide");
const SOURCES = [
  { tag: "mcp/servers", url: "https://raw.githubusercontent.com/modelcontextprotocol/servers/main/README.md", priority: 3 },
  ...(WIDE ? [{ tag: "awesome-mcp", url: "https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md", priority: 5 }] : []),
];

// links we never want as "servers"
const SKIP = /(-sdk|\/discussions|\/blob\/|\/pulls?|\/issues|\/releases|LICENSE|CONTRIBUTING|servers-archived|modelcontextprotocol\/(specification|docs|inspector|registry)\b|awesome-mcp-servers|\/sponsors\/|shields\.io|badge)/i;
// junk link-texts that are not a server name
const NAME_SKIP = /^(official server|servers?|server|here|link|docs?|documentation|readme|example|demo|website|home(page)?|blog|source|code|repo|guide|discord|twitter|x)$/i;

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  const m = raw.match(/TERMINAL_KEY=(.+)/);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  throw new Error("TERMINAL_KEY not found");
}
const KEY = loadKey();

async function dispatch(key, body) {
  const r = await fetch(BASE + "/api/dispatch", {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": KEY },
    body: JSON.stringify({ key, body }),
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { ok: false, raw: t }; }
}

async function scout() {
  const byRepo = new Map(); // repo url -> {name, repo, source, priority}
  for (const s of SOURCES) {
    let md = "";
    try { md = await (await fetch(s.url)).text(); }
    catch (e) { console.error(`scout ${s.tag}:`, e.message); continue; }
    for (const m of md.matchAll(/\[([^\]\n]{2,60})\]\((https:\/\/github\.com\/[^)\s]+)\)/g)) {
      const name = m[1].replace(/[*`]/g, "").trim();
      const repo = m[2].trim().replace(/[.,)]+$/, "");
      if (SKIP.test(repo) || SKIP.test(name)) continue;
      if (NAME_SKIP.test(name) || name.length < 3) continue;
      if (!/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(repo)) continue;
      if (byRepo.has(repo)) continue;
      byRepo.set(repo, { name, repo, source: s.tag, priority: s.priority });
    }
  }
  return [...byRepo.values()];
}

function parseResult(r) {
  let res = r?.result;
  if (typeof res === "string") { try { res = JSON.parse(res); } catch {} }
  return res;
}

// BUILDER_LIST's envelope is intermittently null (D1 read hiccup) — retry until it's an array.
async function listRows(status) {
  for (let i = 0; i < 6; i++) {
    const res = parseResult(await dispatch("BUILDER_LIST", status));
    if (Array.isArray(res)) return res;
    await new Promise((s) => setTimeout(s, 600));
  }
  return null; // unreliable this run
}

async function existingTitles() {
  const set = new Set();
  let reliable = true;
  for (const st of ["all", "done", "wont"]) {
    const rows = await listRows(st);
    if (rows === null) { reliable = false; continue; }
    for (const row of rows) if (row?.title) set.add(String(row.title).toLowerCase());
  }
  return { set, reliable };
}

const titleFor = (c) => `${c.name} MCP server`.replace(/\s+/g, " ").slice(0, 90);

async function main() {
  const scouted = await scout();
  const { set: existing, reliable } = await existingTitles();
  if (!reliable && !DRY) {
    console.log(JSON.stringify({ aborted: "dedup read unreliable this run — refusing to add (fail-safe against duplicates)", scouted: scouted.length }, null, 2));
    return;
  }
  scouted.sort((a, b) => a.priority - b.priority);

  let added = 0, skipped = 0;
  const addedList = [], failed = [];
  for (const c of scouted) {
    if (added >= LIMIT) break;
    const title = titleFor(c);
    if (existing.has(title.toLowerCase())) { skipped++; continue; }
    const attach = `MCP_ATTACH ${c.repo}`;
    const body = `[needs-approval] Wrap ${c.name} via MCP_ATTACH. Source ${c.source}. Repo ${c.repo}. Gate: approve -> run \`${attach}\` -> prove with one live invocation. Reject if it duplicates an existing capability. Auto-filed by scripts/eat.mjs; installs nothing on its own.`;
    if (DRY) { addedList.push(`${title} (dry)`); added++; continue; }
    const r = await dispatch("BUILDER_ADD", `${title}|${body}|${c.priority}`);
    if (r.ok) { added++; existing.add(title.toLowerCase()); addedList.push(`${title} <- ${c.source}`); }
    else failed.push(`${title}: ${r.result || r.raw}`);
  }

  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    scouted: scouted.length,
    already_known: existing.size,
    added, skipped, dry: DRY,
    addedList: addedList.slice(0, 40),
    failed: failed.slice(0, 10),
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
