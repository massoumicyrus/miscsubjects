#!/usr/bin/env node
/**
 * Unstick writer queue + queue prose synthesis jobs.
 * - Resets tasks stuck in `running` > 30min back to `open`
 * - Queues /api/protocol/synthesize-body per slug (prose role)
 *
 * Usage:
 *   node scripts/writer_queue_bootstrap.mjs --nerve
 *   node scripts/writer_queue_bootstrap.mjs --flagship
 *   node scripts/writer_queue_bootstrap.mjs --reset-only
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const args = process.argv.slice(2);
const nerve = args.includes("--nerve");
const flagship = args.includes("--flagship") || (!nerve && !args.includes("--reset-only"));
const resetOnly = args.includes("--reset-only");

const NERVE_SLUGS = [
  "ara-290",
  "ara-290-diabetic-neuropathy",
  "ara-290-carpal-tunnel",
  "ara-290-sciatica",
  "ara-290-post-surgical-nerve",
  "ara-290-trigeminal-neuralgia",
  "ara-290-postherpetic-neuralgia",
  "ara-290-chemo-neuropathy",
  "ara-290-gabapentin-lyrica",
  "bpc-ara-herniated-disc",
  "recovery-stack-herniated-disc",
];

const FLAGSHIP = [
  "bpc-157",
  "tb-500",
  "ara-290",
  "bpc-157-glp1-gut-damage",
  "tb-500-glp1-muscle-loss",
  "wolverine-stack-glp1",
];

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  const m = raw.match(/TERMINAL_KEY=(.+)/);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  throw new Error("TERMINAL_KEY not found");
}

async function api(key, path, body) {
  const r = await fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      "x-terminal-key": key,
      accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

async function resetStuck(key) {
  const { ok, j } = await api(key, "/api/tasks/reset-stuck", {});
  if (ok) {
    console.log("Reset stuck tasks:", j.reset_stuck_tasks ?? 0);
    return j.reset_stuck_tasks ?? 0;
  }
  console.log("Reset failed:", j.error || "unknown");
  return 0;
}

async function queueProse(key, slug) {
  const res = await api(key, "/api/tasks", {
    slug,
    priority: 0,
    post_to: "/api/protocol/synthesize-body",
    model: "grok/grok-4.3",
    role: "prose",
  });
  if (res.ok && res.j.id) {
    console.log("  queued prose #" + res.j.id + " " + slug);
    return true;
  }
  console.log("  FAIL " + slug, res.j.error || res.status);
  return false;
}

async function main() {
  const key = loadKey();
  console.log("=== Writer queue bootstrap ===\n");

  await resetStuck(key);
  if (resetOnly) return;

  const slugs = nerve ? NERVE_SLUGS : FLAGSHIP;
  let n = 0;
  for (const slug of slugs) {
    if (await queueProse(key, slug)) n++;
  }

  console.log("\nQueued " + n + " prose jobs.");
  console.log("Drain: sibling cron ~1/min when writer_queue_autorun=1");
  console.log("Manual tick:");
  console.log('  curl -X POST "' + BASE + '/api/protocol/run?role=writer-queue" -H "x-terminal-key: $TERMINAL_KEY"');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});