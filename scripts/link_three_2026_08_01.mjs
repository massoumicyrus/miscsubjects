#!/usr/bin/env node
// Add the three 2026-08-01 articles to the mechanism-articles list on /a/the-build-end-to-end.
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const SLUG = "the-build-end-to-end";
const cur = await (await fetch(`${BASE}/api/articles/${SLUG}`)).json();
const ANCHOR = "- [One row of SQL is the whole contract](/a/directory-row-contract)";
if (!cur.body.includes(ANCHOR)) { console.error("ABORT: anchor not found"); process.exit(1); }
const ADD = `- [Two AI reviewers from different makers beat two from the same maker](/a/diversity-beats-count) — the family gap measured: 0.169 vs 0.214 undetected-wrong at identical cost.
- [One rule, obeyed, produced 121 identical emails](/a/the-rule-that-was-obeyed) — per-item validators cannot see aggregate collapse; the shape hash can.
- [The error rate depended on what was refused a count](/a/the-exclusion-policy-is-a-safety-claim) — 0.071 vs 0.214 from one exclusion decision, found by an outside audit.
${ANCHOR}`;
const body = cur.body.replace(ANCHOR, ADD);
const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({ ...cur, slug: SLUG, body }),
});
console.log(SLUG, r.status, body.length);
