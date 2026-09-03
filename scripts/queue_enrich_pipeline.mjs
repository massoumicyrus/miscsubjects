#!/usr/bin/env node
/**
 * Queue the full enrichment pipeline per slug into writer-queue tasks.
 * Cron drains one task/min via writer_queue_autorun + sibling worker.
 *
 * Per slug (in order):
 *   1. populate science (PubMed, trials, reviews)
 *   2. populate anecdote (Reddit, X, forums, YouTube comments)
 *   3. populate reddit_x (dedicated comment harvest)
 *   4. repair (materialize orphans → claims)
 *   5. fill-slots (constitution)
 *   6. synthesize-body (reader prose from ledger — does NOT replace claims)
 *   7. kimi collaborate
 *   8. gemini collaborate
 *
 * Usage:
 *   node scripts/queue_enrich_pipeline.mjs --flagship
 *   node scripts/queue_enrich_pipeline.mjs --all
 *   node scripts/queue_enrich_pipeline.mjs --slug=bpc-157
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const args = process.argv.slice(2);
const flagship = args.includes("--flagship");
const all = args.includes("--all");
const slugArg = args.find((a) => a.startsWith("--slug="));

const FLAGSHIP = [
  { slug: "bpc-157", title: "BPC-157: Body Protection Compound", peptide: "BPC-157 gut repair tendon healing" },
  { slug: "tb-500", title: "TB-500: Thymosin Beta-4", peptide: "TB-500 thymosin beta-4 muscle repair" },
  { slug: "bpc-vs-nsaids-comparison", title: "BPC-157 vs NSAIDs", peptide: "BPC-157 vs ibuprofen NSAID gut repair" },
  { slug: "recovery-stack-herniated-disc", title: "Recovery Stack for Herniated Discs", peptide: "BPC-157 TB-500 ARA-290 herniated disc nerve repair stack" },
  { slug: "bpc-ara-herniated-disc", title: "BPC-157 + ARA-290 for Herniated Discs", peptide: "BPC-157 ARA-290 herniated disc nerve" },
  { slug: "ara-290", title: "ARA-290: Nerve Repair", peptide: "ARA-290 nerve repair diabetic neuropathy" },
  { slug: "wolverine-stack-glp1", title: "Wolverine Stack GLP-1", peptide: "BPC-157 TB-500 GLP-1 gut muscle" },
  { slug: "bpc-157-glp1-gut-damage", title: "BPC-157 for GLP-1 Gut Damage", peptide: "BPC-157 Ozempic Mounjaro gut damage" },
  { slug: "tb-500-glp1-muscle-loss", title: "TB-500 for GLP-1 Muscle Loss", peptide: "TB-500 GLP-1 muscle loss semaglutide" },
];

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  const m = raw.match(/TERMINAL_KEY=(.+)/);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  throw new Error("TERMINAL_KEY not found");
}

function loadContentMap() {
  return JSON.parse(readFileSync(join(__dir, "content_map_57.json"), "utf8"));
}

function writeAsk(item) {
  return [
    "Write an enrichment article: " + item.title,
    item.spec || "",
    "Voice: condition-first — if I have this problem, WHY would each compound help ME? One ## per peptide with if-then logic; stack synergy in How these fit together.",
    "Rules: separate human trials from rat studies from Reddit/X anecdotes. Label every claim tier. No medical advice. register: source_ledger.",
  ].join("\n");
}

async function queueTask(key, job) {
  const source =
    job.role || (job.post_to?.includes("/write") ? "writer" : "writer-queue");
  const r = await fetch(BASE + "/api/tasks", {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": key },
    body: JSON.stringify({ ...job, role: source }),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && j.id, id: j.id, err: j.error };
}

function pipelineJobs(item) {
  const slug = item.slug;
  const peptide = item.peptide || item.title || slug.replace(/-/g, " ");
  const priority = item.priority ? 0 : 1;
  const base = { slug, peptide, priority };

  return [
    { ...base, post_to: "/api/protocol/populate", focus: "science", max_rounds: 6, role: "source-hunt" },
    { ...base, post_to: "/api/protocol/populate", focus: "anecdote", max_rounds: 6, role: "anecdote-hunt" },
    { ...base, post_to: "/api/protocol/populate", focus: "reddit_x", max_rounds: 4, role: "reddit-x-hunt" },
    { ...base, post_to: "/api/protocol/repair", materialize_orphans: true, role: "repair" },
    { ...base, post_to: "/api/protocol/fill-slots", role: "fill-slots" },
    { ...base, post_to: "/api/protocol/synthesize-body", model: "grok/grok-4.3", role: "prose" },
    { ...base, post_to: "/api/protocol/collaborate", model: "kimi/moonshot-v1-8k", role: "kimi" },
    { ...base, post_to: "/api/protocol/collaborate", model: "gemini/gemini-2.5-flash", role: "gemini" },
  ];
}

async function main() {
  const key = loadKey();
  let items = [];

  if (slugArg) {
    const slug = slugArg.split("=")[1];
    const map = loadContentMap();
    const hit = map.find((x) => x.slug === slug) || FLAGSHIP.find((x) => x.slug === slug);
    items = [hit || { slug, title: slug, peptide: slug.replace(/-/g, " ") }];
  } else if (flagship) {
    items = FLAGSHIP;
  } else if (all) {
    const map = loadContentMap();
    const roots = ["bpc-157", "tb-500", "ara-290", "semax", "selank", "pt-141", "dsip", "kpv", "ghk-cu", "thymosin-alpha-1"];
    items = [
      ...FLAGSHIP,
      ...roots.map((slug) => ({ slug, title: slug, peptide: slug.replace(/-/g, " ") })),
      ...map.filter((x) => !FLAGSHIP.some((f) => f.slug === x.slug)),
    ];
  } else {
    items = FLAGSHIP;
  }

  const seen = new Set();
  let queued = 0;
  for (const item of items) {
    if (!item?.slug || seen.has(item.slug)) continue;
    seen.add(item.slug);
    for (const job of pipelineJobs(item)) {
      const res = await queueTask(key, job);
      if (res.ok) {
        queued++;
        console.log("  queued #" + res.id + " " + job.role + " " + item.slug + (job.focus ? " " + job.focus : ""));
      } else {
        console.log("  FAIL " + item.slug + " " + job.role + " " + (res.err || ""));
      }
    }
  }

  console.log("\n=== Queued " + queued + " tasks for " + seen.size + " slugs ===");
  console.log("Enable cron:");
  console.log("  npx wrangler kv key put writer_queue_autorun 1 --namespace-id 58b303e666a8431685624e0cfd2fd63f --remote");
  console.log("  npx wrangler kv key put graph_grow_autorun 1 --namespace-id 58b303e666a8431685624e0cfd2fd63f --remote");
  console.log("Drain rate: ~1 task/min (sibling cron)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});