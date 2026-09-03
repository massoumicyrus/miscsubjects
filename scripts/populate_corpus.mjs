#!/usr/bin/env node
/**
 * Audit corpus → run GRAPH_GROW across all slugs → report before/after.
 * Usage:
 *   node scripts/populate_corpus.mjs --batch=10 --all
 *   node scripts/populate_corpus.mjs --audit-only
 *   node scripts/populate_corpus.mjs --slug=bpc-157-glp1-gut-damage --batch=3
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const args = process.argv.slice(2);
const auditOnly = args.includes("--audit-only");
const all = args.includes("--all") || args.includes("--corpus");
const batchArg = args.find((a) => a.startsWith("--batch="));
const slugArg = args.find((a) => a.startsWith("--slug="));
const phoneArg = args.find((a) => a.startsWith("--phone="));
const batch = batchArg ? Number(batchArg.split("=")[1]) : 5;
const phone = phoneArg ? phoneArg.split("=")[1] : process.env.OWNER_PHONE || "";

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  const m = raw.match(/TERMINAL_KEY=(.+)/);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  throw new Error("TERMINAL_KEY not found");
}

async function auditSlug(slug) {
  const v = await fetch(`${BASE}/api/articles/${slug}/voxels`)
    .then((r) => r.json())
    .catch(() => ({}));
  const h = await fetch(`${BASE}/api/articles/${slug}/health`)
    .then((r) => r.json())
    .catch(() => ({}));
  const claims = v.counts?.claims ?? v.voxels?.length ?? 0;
  const sources = v.counts?.sources ?? v.sources?.length ?? 0;
  const ok = claims >= 15 && sources >= 8 && h.ok;
  return { slug, claims, sources, health: h.ok, ok };
}

async function auditCorpus() {
  const arts = await fetch(`${BASE}/api/articles`).then((r) => r.json());
  const rows = [];
  for (const a of arts.articles) rows.push(await auditSlug(a.slug));
  rows.sort((a, b) => a.claims - b.claims || a.sources - b.sources);
  return rows;
}

function summarize(rows) {
  const ok = rows.filter((r) => r.ok);
  const needsWork = rows.filter((r) => !r.ok);
  return {
    total: rows.length,
    populated: ok.length,
    needsWorkCount: needsWork.length,
    rows,
    ok,
    needsWork,
  };
}

async function grow(key, body) {
  const r = await fetch(`${BASE}/api/protocol/grow`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": key },
    body: JSON.stringify(body),
  });
  return r.json().catch(() => ({}));
}

async function dispatch(key, body, terminalKey) {
  const r = await fetch(`${BASE}/api/dispatch`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": terminalKey },
    body: JSON.stringify({ key, body }),
  });
  return { status: r.status, text: await r.text() };
}

function formatReport(label, s) {
  const lines = [
    `${label}: ${s.populated}/${s.total} populated · ${s.needsWorkCount} need work`,
    "",
    "THIN (claims/sources/health):",
  ];
  for (const r of s.needsWork.slice(0, 25)) {
    lines.push(`  ${r.slug} · c=${r.claims} s=${r.sources} h=${r.health}`);
  }
  if (s.needsWork.length > 25) lines.push(`  … +${s.needsWork.length - 25} more`);
  return lines.join("\n");
}

async function main() {
  const key = loadKey();
  console.log("Auditing corpus…");
  const before = summarize(await auditCorpus());
  console.log(formatReport("BEFORE", before));

  if (auditOnly) return;

  const slug = slugArg ? slugArg.split("=")[1] : null;
  const useAll = all || !slug;

  console.log(`\nRunning ${batch} GRAPH_GROW ticks (sequential — avoids CF 524) all=${useAll}…`);
  const ticks = [];
  const used = [];
  for (let i = 0; i < batch; i++) {
    const body = useAll ? { all: true, excludeSlugs: used } : { slug };
    const j = await grow(key, body);
    if (j.tick?.slug) used.push(j.tick.slug);
    ticks.push(j);
    const tick = j.tick || {};
    console.log(`  [${i + 1}/${batch}] ${tick.slug} · ${tick.step} — ${tick.reason || ""}`);
    if (j.result?.claims_added?.length) console.log(`    +claims ${j.result.claims_added.join(", ")}`);
    if (j.result?.added) console.log(`    +sources ${j.result.added}`);
    if (j.result?.error) console.log(`    ERR: ${j.result.error}`);
    if (j.error) {
      console.log(`    FATAL: ${j.error}`);
      break;
    }
  }

  console.log("\nRe-auditing…");
  const after = summarize(await auditCorpus());
  console.log(formatReport("AFTER", after));

  const msg = [
    "📊 Corpus populate",
    `Before: ${before.populated}/${before.total}`,
    `After: ${after.populated}/${after.total}`,
    `Batch: ${ticks.length} ticks`,
    "",
    ...ticks.map((t) => `${t.tick?.slug} · ${t.tick?.step}`).filter(Boolean),
    "",
    `Graph: ${BASE}/graph.html`,
  ].join("\n");

  if (phone) {
    for (let i = 0; i < msg.length; i += 900) {
      const chunk = msg.slice(i, i + 900);
      const d = await dispatch("SEND_BY_CHANNEL", `blooio|${phone}|${chunk}`, key);
      console.log("sms:", d.status);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});