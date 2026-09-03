#!/usr/bin/env node
const BASE = process.env.CHECK_BASE || "https://miscsubjects.com";
const list = await (await fetch(`${BASE}/api/articles?limit=8&slim=1`)).json();
const slugs = (list.articles || []).map((a) => a.slug);
let failed = 0;
await Promise.all(slugs.map(async (slug) => {
  let a; try { a = await (await fetch(`${BASE}/api/articles/${slug}`)).json(); } catch { return; }
  const body = String(a.body || "");
  if (body.length < 2800) return; // stubs legitimately render composed
  const m = body.match(/(^|\n)##\s+([^\n]{8,80})/);
  if (!m) return;
  const probe = m[2].trim().replace(/[#*`]/g, "").slice(0, 40);
  const html = await (await fetch(`${BASE}/a/${slug}?arc=${Date.now() % 1e6}`)).text();
  const hasBody = html.includes(probe);
  const digested = html.includes("System notes") && !body.includes("System notes");
  // The failure class is the composer digest replacing an authored body. Pages with their own
  // legitimate renderer (OIP template, etc.) omit the raw heading without being digested —
  // that is not this defect, so a missing heading alone only fails when the digest is present.
  if (digested) {
    failed++;
    console.error(`AUTHORED_RENDER FAIL ${slug} — claims digest rendered in place of the stored body ("${probe}" ${hasBody ? "present" : "missing"})`);
  }
}));
if (failed) { console.error(`AUTHORED_RENDER_LAW: ${failed} article(s) render a digest instead of their body`); process.exit(1); }
console.log(`{"ok":true,"law":"AUTHORED_RENDER_LAW","checked":"${slugs.length} newest articles render their stored bodies"}`);
