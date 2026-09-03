#!/usr/bin/env node
/**
 * One subject, one article: the three findings from the same 14-probe / 70-finding suite
 * become one measurement page. Run: node scripts/merge_measurement_three.mjs
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const KEEP = "diversity-beats-count";
const DROP = ["the-exclusion-policy-is-a-safety-claim", "the-rule-that-was-obeyed"];

const parts = {};
for (const s of [KEEP, ...DROP]) parts[s] = await (await fetch(`${BASE}/api/articles/${s}`)).json();

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

const body = `## The suite these numbers come from

Fourteen probe items with the correct verdict declared in advance were run through five adjudication channels — the identical path live findings take — producing 70 findings. Sixty-four panel configurations were then replayed over those same 70 findings, each scored on two numbers: the **emit rate** (how often the assembly answers rather than escalating to a human) and the **undetected-wrong rate** (how often it answers, the answer is wrong, and nothing catches it).

Three findings came out of that data. Two are results about how to build a panel. The third is about the accounting, and it reduced the headline number by a factor of three after an outside audit found it.

| finding | the number |
|---|---|
| Cross-family pairs beat same-family pairs at identical cost | 0.169 vs 0.214 undetected-wrong |
| The second channel is the cheapest correctness; the fifth is the most expensive | 0.314 → 0.178 for one call; 0.178 → 0.071 for three more |
| The published floor depended on an exclusion policy | 0.071 stated, 0.214 under the alternative accounting |

[[embed:source:s1]]

## Part 1 — Two reviewers from different vendors beat two from the same vendor

${strip(parts[KEEP].body)}

[[embed:source:s2]]

## Part 2 — The published error floor depended on what was refused a count

${strip(parts["the-exclusion-policy-is-a-safety-claim"].body)}

## Part 3 — The same failure class in the writing pipeline: 121 identical emails

The measurement above is about aggregate properties invisible to per-item checks. The clearest instance of that failure class in this build was not in the panel at all — it was in the outreach drafting pipeline, and it is included here because it is the same defect wearing different clothes.

${strip(parts["the-rule-that-was-obeyed"].body)}

## What all three have in common

Each is a property of a **set**, invisible to any check that examines one item. Correlated wrongness across a panel is invisible to a gate that only fires on disagreement. An exclusion policy's effect on a rate is invisible in any single excluded item. Template collapse is invisible in any single draft, all 121 of which passed every validator. In each case the instrument that found it was the same shape: a measurement over the whole set, run deliberately, because nothing in the per-item machinery could ever surface it.
`;

const { token } = await getWriteToken(KEEP);
const r = await fetch(`${BASE}/api/articles/${KEEP}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({ ...parts[KEEP], slug: KEEP,
    title: "Three measurements from one 70-finding suite: vendor diversity beats panel size, the second channel is the cheapest, and the published error floor was three times too good",
    body, claims, sources, prefer_stored: true }),
});
console.log(KEEP, r.status, body.length, "chars", claims.length, "claims", sources.length, "sources");
for (const slug of DROP) {
  const d = await fetch(`${BASE}/api/articles/${slug}`, { method: "DELETE", headers: { "x-terminal-key": KEY } });
  console.log("delete", slug, d.status);
}
