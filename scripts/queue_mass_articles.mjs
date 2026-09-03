#!/usr/bin/env node
/**
 * Queue protocol/write for every missing peptide×condition×drug article in the matrix.
 * Writes use source=writer (priority 1) — cron drains before enrichment tail.
 *
 * Usage:
 *   node scripts/queue_mass_articles.mjs              # all missing (~900+)
 *   node scripts/queue_mass_articles.mjs --nerve      # nerve conditions only
 *   node scripts/queue_mass_articles.mjs --limit=50   # cap batch
 *   node scripts/queue_mass_articles.mjs --purge-tail # cancel enrichment tail first
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const args = process.argv.slice(2);
const nerveOnly = args.includes("--nerve");
const purgeTail = args.includes("--purge-tail");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;

const PEPTIDES = [
  "bpc-157", "tb-500", "ara-290", "semax", "selank", "dsip", "ghk-cu", "pt-141", "kpv",
  "cjc-1295", "ss-31", "mots-c", "ipamorelin", "tesamorelin", "aod-9604", "tirzepatide",
  "semaglutide", "retatrutide", "epitalon", "dihexa", "ll-37", "humanin", "pinealon",
  "thymosin-alpha-1", "mk-677", "melanotan-ii", "vip", "nad-plus", "glutathione",
  "bdnf-explained", "what-are-peptides",
];

const CONDITIONS = [
  { id: "neuropathy", nerve: true },
  { id: "diabetic-neuropathy", nerve: true },
  { id: "chemo-neuropathy", nerve: true },
  { id: "carpal-tunnel", nerve: true },
  { id: "sciatica", nerve: true },
  { id: "nerve-damage", nerve: true },
  { id: "trigeminal", nerve: true },
  { id: "postherpetic", nerve: true },
  { id: "herniated-disc", nerve: false },
  { id: "frozen-shoulder", nerve: false },
  { id: "plantar-fasciitis", nerve: false },
  { id: "tendon", nerve: false },
  { id: "gut", nerve: false },
  { id: "ibd", nerve: false },
  { id: "glp1-gut", nerve: false },
  { id: "muscle-loss", nerve: false },
  { id: "ozempic-face", nerve: false },
  { id: "insomnia", nerve: false },
  { id: "benzo-withdrawal", nerve: false },
  { id: "brain-fog", nerve: true },
  { id: "cognition", nerve: true },
  { id: "skin", nerve: false },
  { id: "post-surgery", nerve: false },
];

const DRUGS = [
  "metformin", "gabapentin", "glp-1", "nsaids", "ppis", "stimulants",
  "statins", "benzodiazepines", "corticosteroids", "chemo", "semaglutide", "tirzepatide",
];

const PEPTIDE_LABEL = Object.fromEntries(
  PEPTIDES.map((id) => [
    id,
    id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      .replace("Bpc", "BPC").replace("Tb", "TB").replace("Ara", "ARA")
      .replace("Ghk", "GHK").replace("Dsip", "DSIP").replace("Pt", "PT")
      .replace("Aod", "AOD").replace("Glp", "GLP").replace("Nad", "NAD"),
  ]),
);

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  const m = raw.match(/TERMINAL_KEY=(.+)/);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  throw new Error("TERMINAL_KEY not found");
}

function titleFor(slug) {
  const map = JSON.parse(readFileSync(join(__dir, "content_map_57.json"), "utf8"));
  const hit = map.find((x) => x.slug === slug);
  if (hit) return hit.title;
  const parts = slug.split("-");
  const pep = PEPTIDES.find((p) => slug === p || slug.startsWith(p + "-"));
  const pepLabel = pep ? PEPTIDE_LABEL[pep] : "";
  let rest = slug;
  if (pep) rest = slug.slice(pep.length + 1) || pep;
  const restLabel = rest.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return pepLabel ? `${pepLabel} for ${restLabel}` : restLabel;
}

function writeAsk(slug, title) {
  return [
    `Write an enrichment article: ${title}`,
    `Slug: ${slug}`,
    "Voice: condition-first. Reader asks — if I have this problem, WHY would each compound help ME?",
    "Structure: What's breaking down → one ## section per peptide/compound with explicit if-then logic → how they fit together → evidence tiers.",
    "Multi-pathway: cover every peptide in the slug; stacks get 3–5 separate compound sections. Spine/disc + GLP-1: include ~4 lb less spinal load per 1 lb lost. Stimulant crosses: Semax (neural), BPC (gut), Selank (calm), DSIP (sleep) as relevant.",
    "Rules: tier every claim (human|preclinical|anecdotal|mechanistic|speculative). No medical advice. register: source_ledger.",
  ].join("\n");
}

function buildMatrix() {
  const slugs = new Set();
  const map = JSON.parse(readFileSync(join(__dir, "content_map_57.json"), "utf8"));
  for (const m of map) slugs.add(m.slug);

  const conds = nerveOnly ? CONDITIONS.filter((c) => c.nerve) : CONDITIONS;
  for (const p of PEPTIDES) {
    for (const c of conds) slugs.add(`${p}-${c.id}`);
    if (!nerveOnly) {
      for (const d of DRUGS) slugs.add(`${p}-${d}`);
    }
  }
  return [...slugs].sort();
}

async function api(key, path, body) {
  const r = await fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", "x-terminal-key": key },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, j };
}

async function main() {
  const key = loadKey();
  console.log("=== Mass article write queue ===\n");

  if (purgeTail) {
    const { ok, j } = await api(key, "/api/tasks/purge-tail", {});
    console.log("Purged tail tasks:", j.cancelled_tail_tasks ?? 0, ok ? "ok" : j.error);
  }

  const { j: list } = await api(key, "/api/articles");
  const existing = new Set((list.articles || []).map((a) => a.slug));
  console.log("Existing articles:", existing.size);

  const matrix = buildMatrix();
  const missing = matrix.filter((s) => !existing.has(s));
  console.log("Matrix:", matrix.length, "· missing:", missing.length, nerveOnly ? "(nerve)" : "");

  const batch = limit > 0 ? missing.slice(0, limit) : missing;
  let queued = 0;
  let stubs = 0;

  for (const slug of batch) {
    const title = titleFor(slug);
    const stub = await api(key, `/api/articles/${slug}`, {
      title,
      body: `## ${title}\n\nEvidence-graded overview — sources loading via writer queue.`,
      tags: ["peptide", "matrix"],
      register: "source_ledger",
    });
    if (stub.ok) stubs++;

    const job = {
      ask: writeAsk(slug, title),
      slug,
      title,
      web_search: true,
      register: "source_ledger",
      model: "grok/grok-4.3",
      max_tokens: 4500,
      post_to: "/api/protocol/write",
      role: "writer",
    };
    const { ok, j } = await api(key, "/api/tasks", job);
    if (ok && j.id) {
      queued++;
      if (queued <= 5 || queued % 50 === 0) {
        console.log("  #" + j.id + " writer · " + slug);
      }
    } else {
      console.log("  FAIL " + slug, j.error || "");
    }
  }

  console.log("\nStubs:", stubs, "· write jobs queued:", queued);
  console.log("Order: writer (priority 1) → populate → tail");
  console.log("Drain: ~1/min with writer_queue_autorun=1");
  console.log("ETA:", Math.round(queued / 60), "hours for this batch");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});