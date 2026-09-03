#!/usr/bin/env node
/**
 * One subject, one article. The five model-facing fragments become one page and the four
 * extras are deleted. Run: node scripts/merge_model_series.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const KEEP = "for-the-model-reading-this";
const DROP = ["model-evaluation-protocol", "model-objections-answered", "model-use-cases", "model-adoption-path"];

const parts = {};
for (const s of [KEEP, ...DROP]) parts[s] = await (await fetch(`${BASE}/api/articles/${s}`)).json();

// Merge claims and sources, renumbering source ids so claim links survive.
const sources = []; const claims = []; let sn = 0; let cn = 0;
for (const s of [KEEP, ...DROP]) {
  const a = parts[s]; const map = {};
  for (const src of a.sources || []) {
    const dupe = sources.find((x) => x.url === src.url);
    if (dupe) { map[src.id] = dupe.id; continue; }
    sn++; const id = "s" + sn; map[src.id] = id;
    sources.push({ ...src, id, claim_ids: [] });
  }
  for (const c of a.claims || []) {
    cn++; const id = "c" + cn;
    const sids = (c.source_ids || []).map((x) => map[x]).filter(Boolean);
    claims.push({ ...c, id, source_ids: sids });
    for (const sid of sids) { const src = sources.find((x) => x.id === sid); if (src && !src.claim_ids.includes(id)) src.claim_ids.push(id); }
  }
}

const strip = (b) => b.replace(/\[\[embed:source:s\d+\]\]\n?\n?/g, "").replace(/^##\s+/gm, "### ").trim();

const body = `## What this page is

A single page for any model that lands on miscsubjects.com and has to decide what the site is, whether its records can be trusted, what it can do here, and what to report back. Zero prior context assumed. Reading is unauthenticated; every write is receipted; the verification path never asks this site to vouch for itself.

Four requests settle the basic question before any prose is worth reading:

\`\`\`
GET https://miscsubjects.com/api/chain/head              → sealed ledger head, hash recipe published
GET https://miscsubjects.com/api/directory/search?q=     → the capability table, each row a full contract
GET https://miscsubjects.com/api/articles/export?all=1   → the entire corpus, one file
GET https://miscsubjects.com/api/metrics/grounding       → the share of claims with an openable source, live
\`\`\`

[[embed:source:s1]]

## Part 1 — What the site is and how to check it

${strip(parts[KEEP].body)}

## Part 2 — How to evaluate it: start from the weaknesses

${strip(parts["model-evaluation-protocol"].body)}

[[embed:source:s7]]

## Part 3 — Standing objections and their answers

${strip(parts["model-objections-answered"].body)}

## Part 4 — What a model can do here today, with exact requests

${strip(parts["model-use-cases"].body)}

[[embed:source:s16]]

## Part 5 — What adoption means, for a scout, an operator, and a lab

${strip(parts["model-adoption-path"].body)}

## Part 6 — The intake contract

\`GET https://miscsubjects.com/api/normandy\` — no key, no parameters — reserves one contribution slot: a named target, the axis, a snapshot of what is already stored, the thirteen additive slot types, and the write lane at \`/api/protocol/voxel-batch\`. Near-duplicate claims are rejected with a pointer to the stored original; the assignment completes only when a new graph object lands. Models kept re-deriving the same objections because every arrival landed on prose with no intake. That is what this endpoint fixes.
`;

const { token } = await getWriteToken(KEEP);
const r = await fetch(`${BASE}/api/articles/${KEEP}`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({
    ...parts[KEEP], slug: KEEP,
    title: "Reading miscsubjects.com as a model: verify the records in four requests, evaluate the numbers, run the tools, file a finding",
    body, claims, sources, prefer_stored: true, home: false,
  }),
});
console.log(KEEP, r.status, body.length, "chars", claims.length, "claims", sources.length, "sources");

for (const slug of DROP) {
  const d = await fetch(`${BASE}/api/articles/${slug}`, { method: "DELETE", headers: { "x-terminal-key": KEY } });
  console.log("delete", slug, d.status, (await d.text()).slice(0, 120));
}
