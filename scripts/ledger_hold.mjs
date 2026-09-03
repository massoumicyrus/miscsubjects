#!/usr/bin/env node
/**
 * Ledger hold — post immutable protocol article + repair flagship slugs.
 * Usage: node scripts/ledger_hold.mjs [--repair-only] [--slug=bpc-157]
 * TERMINAL_KEY from env or ~/.config/grok-bridge.env
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const args = process.argv.slice(2);
const repairOnly = args.includes("--repair-only");
const slugArg = args.find((a) => a.startsWith("--slug="));
const slugs = slugArg
  ? [slugArg.split("=")[1]]
  : ["bpc-157", "tb-500", "wolverine-stack-glp1"];

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

async function postProtocol(key) {
  const existing = await get("/api/articles/protocol");
  if (existing.status === 200) {
    console.log("protocol article already exists");
    return existing.j;
  }
  const constitution = await fetch(BASE + "/api/articles/constitution?format=markdown").then(
    (r) => r.text(),
  );
  const body = {
    slug: "protocol",
    title: "miscsubjects article protocol (constitution)",
    register: "technical",
    immutable_slug: true,
    body:
      constitution +
      "\n\n## Binding\n\nEvery writer, populate, ingest, and claim path is bound by this document. Read `GET /api/articles/system-map` for the full feature index.\n",
    claims: [
      {
        id: "c1",
        text: "Articles are voxel graphs of tiered claims with hash-chained sources.",
        tier: "mechanistic",
        section: "what_it_is",
        slot: "what_it_is",
        source_status: "unsourced",
        why_material: "Core architecture invariant",
        who_claims: "miscsubjects protocol",
      },
      {
        id: "c2",
        text: "Every new claim must include posted_by provenance.",
        tier: "mechanistic",
        section: "limitations",
        slot: "limitations",
        source_status: "unsourced",
        why_material: "Provenance rule",
        who_claims: "miscsubjects protocol",
      },
      {
        id: "c3",
        text: "Not medical advice — tier-honest evidence only.",
        tier: "human",
        section: "disclaimer",
        slot: "disclaimer",
        source_status: "unsourced",
        why_material: "Legal/safety",
        who_claims: "miscsubjects protocol",
      },
    ],
    prov: { model: "ledger_hold", action: "post-protocol" },
  };
  const { status, j } = await api("/api/articles/protocol", body, key);
  console.log("post protocol:", status, j.error || j.slug || j);
  return j;
}

async function repairSlug(slug, key) {
  const before = await get("/api/articles/" + slug + "/health");
  console.log("\n" + slug + " before:", before.j.issues || before.j);
  const { status, j } = await api("/api/protocol/repair", { slug }, key);
  console.log(slug + " repair:", status, {
    materialized: j.materialized?.length,
    after_issues: j.after?.issues,
    claims: j.claims,
    sources: j.sources,
  });
  return j;
}

async function fillSlots(slug, key) {
  const { status, j } = await api("/api/protocol/fill-slots", { slug }, key);
  console.log(slug + " fill-slots:", status, {
    added: j.added,
    ok: j.health?.ok,
    issues: j.health?.issues,
  });
  return j;
}

async function main() {
  const key = loadKey();
  if (!repairOnly) await postProtocol(key);
  for (const slug of slugs) {
    await repairSlug(slug, key);
    await fillSlots(slug, key);
  }
  console.log("\nDone. Verify: GET " + BASE + "/api/articles/bpc-157/health");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});