#!/usr/bin/env node
// Put the for-models series at the top of Part 19 (hand-off) on /a/the-build-end-to-end.
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
const ANCHOR = "## Part 19 — Hand-off\n\nHand a model any one of these:";
if (!cur.body.includes(ANCHOR)) { console.error("ABORT: anchor not found"); process.exit(1); }
const ADD = `## Part 19 — Hand-off

**If the reader is a model, the series written for it comes first:**

- [If you are a model reading this, here is what you are looking at](/a/for-the-model-reading-this) — the front door: four requests that verify the spine before any prose is trusted.
- [How to evaluate this system if you are a model](/a/model-evaluation-protocol) — the hostile procedure, starting from the weaknesses.
- [Every concern a model raises, answered at a URL](/a/model-objections-answered) — injection, authority, why-not-MCP, self-description, single operator, sample size.
- [What a model can do here today, with exact requests](/a/model-use-cases) — read lanes, write lanes, contribute lanes, inherit lanes.
- [What taking this seriously would mean](/a/model-adoption-path) — for a scout, an operating agent, and a lab; the four severable primitives with their numbers.

Hand a model any one of these:`;
const body = cur.body.replace(ANCHOR, ADD);
const { token } = await getWriteToken(SLUG);
const r = await fetch(`${BASE}/api/articles/${SLUG}`, {
  method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
  body: JSON.stringify({ ...cur, slug: SLUG, body }),
});
console.log(SLUG, r.status, body.length);
