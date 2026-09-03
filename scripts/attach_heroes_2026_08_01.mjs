#!/usr/bin/env node
/**
 * Collect the 41 ArcAds renders started by retitle_rehero_2026_08_01.mjs (whose dispatch
 * result is a JSON *string* — the reason heroes were not attached) and set each article's hero.
 * Run: node scripts/attach_heroes_2026_08_01.mjs <path-to-task-output-log>
 */
import { readFileSync, appendFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";

const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try {
    const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
    const m = env.match(/TERMINAL_KEY=(.+)/);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY;
  } catch { return process.env.TERMINAL_KEY; }
})();

const logText = readFileSync(process.argv[2], "utf8");
const pairs = {};
for (const line of logText.split("\n")) {
  const m = line.match(/^(\S+) GEN-FAIL .*?arcads_id\\":\\"([0-9a-f-]{36})/);
  if (m) pairs[m[1]] = m[2];
}
console.log(Object.keys(pairs).length, "renders to collect");

async function dispatch(key, body) {
  const r = await fetch(`${BASE}/api/dispatch`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": KEY },
    body: JSON.stringify({ key, body, actor: "attach-heroes-2026-08-01" }),
  });
  const t = await r.text();
  let o; try { o = JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; }
  if (typeof o.result === "string") { try { o.result = JSON.parse(o.result); } catch {} }
  return o;
}

const slugs = Object.keys(pairs);
let i = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (i < slugs.length) {
    const slug = slugs[i++];
    try {
      const r2 = await dispatch("ARCADS_TO_R2", `${pairs[slug]}|gpt-image`);
      const url = r2.result?.url || r2.url;
      if (!url) { console.log(slug, "R2-FAIL", JSON.stringify(r2).slice(0, 200)); continue; }
      const cur = await (await fetch(`${BASE}/api/articles/${slug}`)).json();
      const { token } = await getWriteToken(slug);
      const w = await fetch(`${BASE}/api/articles/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
        body: JSON.stringify({ ...cur, slug, hero: url }),
      });
      console.log(slug, w.status, url);
    } catch (e) { console.log(slug, "ERROR", e.message); }
  }
}));
console.log("DONE");
