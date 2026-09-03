#!/usr/bin/env node
// Heroes for the five for-models articles: literal, photorealistic, on-subject.
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { getWriteToken } from "./write_token.mjs";
const BASE = "https://miscsubjects.com";
const KEY = (() => {
  try { const env = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8"); const m = env.match(/TERMINAL_KEY=(.+)/); return m ? m[1].trim().replace(/^["']|["']$/g, "") : process.env.TERMINAL_KEY; } catch { return process.env.TERMINAL_KEY; }
})();
const PHOTO = "Photorealistic, high-end editorial magazine photography, natural light, shallow depth of field. No text, no logos.";
const PLAN = {
  "for-the-model-reading-this": `A single illuminated computer terminal in an otherwise dark, empty modern office at night, cursor glowing on screen, one chair pulled out as if waiting. ${PHOTO}`,
  "model-evaluation-protocol": `A materials testing laboratory: a hydraulic press mid-test compressing a concrete cylinder, cracks beginning to show, instrumentation cables attached. ${PHOTO}`,
  "model-objections-answered": `A university office door covered in an orderly grid of pinned index cards, each with a handwritten note, one card being pinned by a hand. ${PHOTO}`,
  "model-use-cases": `A workbench with a precision multi-tool fully unfolded showing all its instruments, arranged under task lighting. ${PHOTO}`,
  "model-adoption-path": `A relay race baton exchange at full speed on an empty stadium track at dawn, both runners' hands on the baton. ${PHOTO}`,
};
async function dispatch(key, body) {
  const r = await fetch(`${BASE}/api/dispatch`, {
    method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY },
    body: JSON.stringify({ key, body, actor: "heroes-model-series" }),
  });
  let o; try { o = JSON.parse(await r.text()); } catch { return {}; }
  if (typeof o.result === "string") { try { o.result = JSON.parse(o.result); } catch {} }
  return o;
}
const gens = {};
for (const [slug, brief] of Object.entries(PLAN)) {
  const g = await dispatch("ARCADS_GENERATE", `gpt-image|${brief}|16:9`);
  gens[slug] = g.result?.arcads_id || g.arcads_id;
  console.log("gen", slug, gens[slug]);
}
for (const [slug, id] of Object.entries(gens)) {
  if (!id) { console.log(slug, "NO-ID"); continue; }
  const r2 = await dispatch("ARCADS_TO_R2", `${id}|gpt-image`);
  const url = r2.result?.url || r2.url;
  if (!url) { console.log(slug, "R2-FAIL", JSON.stringify(r2).slice(0, 150)); continue; }
  const cur = await (await fetch(`${BASE}/api/articles/${slug}`)).json();
  const { token } = await getWriteToken(slug);
  const w = await fetch(`${BASE}/api/articles/${slug}`, {
    method: "POST", headers: { "content-type": "application/json", "x-terminal-key": KEY, "x-write-token": token },
    body: JSON.stringify({ ...cur, slug, hero: url }),
  });
  console.log(slug, w.status, url);
}
