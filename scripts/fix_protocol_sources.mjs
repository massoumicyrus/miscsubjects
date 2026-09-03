#!/usr/bin/env node
/**
 * Break protocol s1 star — constitution only on axioms; repo on design claims; live evidence on c31/Kimi.
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  const m = raw.match(/TERMINAL_KEY=(.+)/);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  throw new Error("TERMINAL_KEY not found");
}

function sourceIdsForClaim(c) {
  const id = c.id;
  if (["c1", "c2", "c3"].includes(id)) return ["s1"];
  if (id === "c31") return ["s2", "s3"];
  if (/^c(4|5|6|7|8|9|10|11|12|13|14|15|16|17)$/.test(id) || id === "c37" || id === "c42")
    return ["s3"];
  if (["c38", "c39", "c40", "c41"].includes(id)) return ["s2"];
  if (["c18", "c19", "c20", "c21", "c22", "c23", "c24", "c25", "c26", "c27", "c28", "c29", "c30"].includes(id))
    return [];
  if (["c32", "c33", "c34", "c35", "c36"].includes(id)) return [];
  return c.source_ids || [];
}

async function main() {
  const key = loadKey();
  const art = await fetch(BASE + "/api/articles/protocol", {
    headers: { "x-terminal-key": key },
  }).then((r) => r.json());

  const claims = (art.claims || []).map((c) => {
    const source_ids = sourceIdsForClaim(c);
    return {
      ...c,
      source_ids,
      source_status: source_ids.length ? "sourced" : "unsourced",
    };
  });

  const bySource = { s1: [], s2: [], s3: [], s4: [] };
  for (const c of claims) {
    for (const sid of c.source_ids || []) {
      if (bySource[sid]) bySource[sid].push(c.id);
    }
  }

  const sources = (art.sources || []).map((s) => ({
    ...s,
    claim_ids: bySource[s.id] || [],
  }));

  const pr = await fetch(BASE + "/api/articles/protocol", {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-terminal-key": key },
    body: JSON.stringify({
      claims,
      sources,
      prov: { model: "system/source-forest", action: "break-s1-star" },
    }),
  });
  console.log("PATCH", pr.status, await pr.json().then((j) => j.error || "ok"));

  const rep = await fetch(BASE + "/api/protocol/repair", {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": key },
    body: JSON.stringify({ slug: "protocol", normalize_provenance: true }),
  }).then((r) => r.json());
  console.log("repair", rep.after?.issues || rep.error);

  const dist = {};
  const fresh = await fetch(BASE + "/api/articles/protocol").then((r) => r.json());
  for (const c of fresh.claims || []) {
    for (const sid of c.source_ids || []) dist[sid] = (dist[sid] || 0) + 1;
  }
  console.log("source distribution", dist);
  console.log("unsourced", (fresh.claims || []).filter((c) => !c.source_ids?.length).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});