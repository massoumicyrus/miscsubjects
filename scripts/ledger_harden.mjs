#!/usr/bin/env node
/**
 * Harden ledger per assessment items 9–13.
 * Usage: node scripts/ledger_harden.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const PHONE = "[OWNER_PHONE]";

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  const m = raw.match(/TERMINAL_KEY=(.+)/);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  throw new Error("TERMINAL_KEY not found");
}

async function api(path, body, key) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": key },
    body: JSON.stringify(body),
  });
  return { status: r.status, j: await r.json().catch(() => ({})) };
}

async function get(path) {
  return fetch(BASE + path).then((r) => r.json());
}

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
  const report = ["🔧 Ledger harden", ""];

  // 9 — constitution as source s1 on protocol
  const protocol = await get("/api/articles/protocol");
  const claimIds = (protocol.meta?.claims || protocol.claims || [])
    .filter((c) => c.status !== "retracted")
    .map((c) => c.id);
  const constitution = await fetch(
    BASE + "/api/articles/constitution?format=markdown",
  ).then((r) => r.text());
  const principle =
    constitution.match(/principle[^\n]*\n+([^\n]+)/i)?.[1] ||
    "Articles are voxel graphs of claims — not prose blobs.";

  const src = await api(
    "/api/protocol/sources",
    {
      slug: "protocol",
      model: "system/verdict-post",
      sources: [
        {
          id: "s1",
          type: "review",
          url: BASE + "/api/articles/constitution?format=markdown",
          title: "Article constitution (miscsubjects)",
          quote: principle.slice(0, 500),
          summary:
            "Binding constitution: slots, claim rules, source rules, ontology rules, post_protocol.",
          found_by: "system/verdict-post",
          claim_ids: claimIds,
        },
      ],
    },
    key,
  );
  report.push(
    "9 protocol source s1: " +
      (src.j.error || `+${src.j.added?.length || 0} source, ${claimIds.length} claims linked`),
  );

  // 10 + 11 — repair with provenance normalize + hash recompute
  for (const slug of ["protocol", "bpc-157"]) {
    const rep = await api(
      "/api/protocol/repair",
      {
        slug,
        normalize_provenance: true,
        model: "system/repair",
        ...(slug === "protocol" ? { anchor_source: "s1" } : {}),
      },
      key,
    );
    const chain = await get(`/api/articles/${slug}/sources`);
    report.push(
      `10–11 ${slug}: repair ok=${!rep.j.error} chain=${chain.verification?.valid ? "valid" : "BROKEN"} head=${(chain.verification?.head || "").slice(0, 12)}…`,
    );
  }

  // 12 — retract duplicate claims on bpc-157 (keep c5, c6)
  for (const cid of ["c7", "c8", "c9", "c10"]) {
    const ret = await api(
      "/api/protocol/retract",
      {
        slug: "bpc-157",
        claim_id: cid,
        reason: `Duplicate — merged into ${cid === "c7" || cid === "c9" ? "c5" : "c6"} by ledger harden`,
        model: "system/repair",
      },
      key,
    );
    report.push(`12 retract ${cid}: ${ret.j.error || "ok"}`);
  }

  // Re-repair bpc-157 after retractions (rehash sources)
  await api(
    "/api/protocol/repair",
    { slug: "bpc-157", normalize_provenance: true },
    key,
  );

  // 13 — Kimi pass on protocol
  const kimi = await api(
    "/api/protocol/collaborate",
    { slug: "protocol", model: "kimi/moonshot-v1-8k", max_tokens: 4096 },
    key,
  );
  report.push(
    "13 Kimi on protocol: " +
      (kimi.j.error ||
        `+${(kimi.j.claims_added || []).join(",") || "none"} challenge=${kimi.j.challenge_claim_id || "—"}`),
  );

  if (kimi.j.ok) {
    await api(
      "/api/protocol/repair",
      { slug: "protocol", normalize_provenance: true, anchor_source: "s1" },
      key,
    );
  }

  const ph = await get("/api/articles/protocol/health");
  const pv = await get("/api/articles/protocol/voxels");
  const bh = await get("/api/articles/bpc-157/health");
  const bc = await get("/api/articles/bpc-157/sources");

  report.push(
    "",
    "protocol: " +
      ph.counts.claims +
      " claims, " +
      ph.counts.sources +
      " sources, " +
      (pv.edges?.length || ph.counts.voxel_edges) +
      " edges",
    "bpc-157: chain " +
      (bc.verification?.valid ? "valid" : "broken") +
      ", " +
      bh.counts.claims +
      " claims",
    "",
    BASE + "/a/protocol",
    BASE + "/api/articles/protocol/voxels",
  );

  console.log(report.join("\n"));
  await text(key, report.join("\n"));
  console.log("texted");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});