#!/usr/bin/env node
/**
 * Post-audit corpus repair — retier mislabeled claims, fill constitution slots.
 * Usage:
 *   node scripts/audit_repair_corpus.mjs --flagship
 *   node scripts/audit_repair_corpus.mjs --all
 *   node scripts/audit_repair_corpus.mjs --slug cognitive-stack-adderall-insomnia
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";

const FLAGSHIP = [
  "cognitive-stack-adderall-insomnia",
  "cognitive-stack-intro",
  "semax-selank-adderall",
  "adderall-stack-intro",
  "dsip-adderall-insomnia",
  "semax",
  "selank",
  "dsip",
  "bpc-157",
  "protocol",
];

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  const m = raw.match(/TERMINAL_KEY=(.+)/);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  throw new Error("TERMINAL_KEY not found");
}

async function get(path) {
  const r = await fetch(BASE + path, {
    headers: { "user-agent": "audit-repair-corpus/1.0" },
  });
  return { status: r.status, j: await r.json().catch(() => ({})) };
}

async function post(path, body, key) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-terminal-key": key,
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, j: await r.json().catch(() => ({})) };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function repairSlug(slug, key) {
  const before = await get(`/api/articles/${slug}/health`);
  const rep = await post(
    "/api/protocol/repair",
    {
      slug,
      materialize_orphans: false,
      retier_claims: true,
      backfill_posted_by: true,
      normalize_provenance: true,
      model: "system/audit-repair",
    },
    key,
  );
  await sleep(400);
  const fill = await post(
    "/api/protocol/fill-slots",
    { slug, model: "system/audit-repair" },
    key,
  );
  await sleep(400);
  const afterRep = await post(
    "/api/protocol/repair",
    {
      slug,
      materialize_orphans: false,
      retier_claims: true,
      model: "system/audit-repair",
    },
    key,
  );
  await sleep(300);
  const after = await get(`/api/articles/${slug}/health`);
  const topo = await get(`/api/articles/${slug}/topology`);
  const claims = topo.j.claims || [];
  const preMis = claims.filter((c) => {
    if (c.tier !== "preclinical") return false;
    const sid = (c.source_ids || [])[0];
    const src = (topo.j.sources || []).find((s) => s.id === sid);
    if (!src) return true;
    const u = (src.url || "").toLowerCase();
    return !u.includes("pubmed") && !["pubmed", "clinical_trial"].includes(src.type);
  });
  const safety = claims.filter((c) => c.interaction_risk || c.slot === "limitations");
  return {
    slug,
    before_ok: before.j.ok,
    repair_ok: !rep.j.error,
    fill_ok: !fill.j.error,
    fill_added: (fill.j.added || []).map((a) => a.slot),
    after_ok: after.j.ok,
    after_http: after.status,
    after_issues: after.j.issues || [],
    preclinical_mislabeled: preMis.length,
    safety_claims: safety.map((c) => c.id),
    tiers: claims.reduce((acc, c) => {
      const k = `${c.tier}`;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
    rep_status: rep.status,
    fill_status: fill.status,
    error: rep.j.error || fill.j.error || afterRep.j.error,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const key = loadKey();
  let slugs = [];

  if (args.includes("--slug")) {
    slugs = [args[args.indexOf("--slug") + 1]];
  } else if (args.includes("--flagship")) {
    slugs = FLAGSHIP;
  } else if (args.includes("--all")) {
    const list = await get("/api/articles");
    slugs = (list.j.articles || list.j || []).map((a) => a.slug);
  } else {
    slugs = FLAGSHIP;
  }

  console.log(`audit_repair_corpus: ${slugs.length} slug(s) @ ${BASE}\n`);
  const results = [];
  for (const slug of slugs) {
    try {
      const row = await repairSlug(slug, key);
      results.push(row);
      console.log(
        `${slug}: repair=${row.repair_ok} fill=${row.fill_ok} slots+${row.fill_added.join(",") || "—"} ` +
          `health=${row.after_ok} (http ${row.after_http}) mislabeled_preclinical=${row.preclinical_mislabeled} ` +
          `safety=${row.safety_claims.join(",") || "—"} tiers=${JSON.stringify(row.tiers)}`,
      );
    } catch (e) {
      console.error(`${slug}: ERROR ${e.message}`);
      results.push({ slug, error: e.message });
    }
    await sleep(600);
  }

  const healthy = results.filter((r) => r.after_ok).length;
  console.log(`\nDone: ${healthy}/${results.length} healthy`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});