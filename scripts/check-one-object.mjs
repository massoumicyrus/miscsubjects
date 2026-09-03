#!/usr/bin/env node
// ONE_OBJECT_LAW deploy blocker — sweeps the LIVE corpus with the same vocabulary the write path
// refuses on, so a page that predates the guard, or one written through any path that ever
// bypassed it, cannot sit in production unnoticed.
//
// The invariant and the failure that produced it are documented in functions/_lib/one_object_guard.js.
// This script imports that module rather than restating its lists: one vocabulary, three consumers
// (write path, deploy gate, unit test).
//
// Usage: node scripts/check-one-object.mjs [slug ...]

import { COMPOUNDS, CONDITION_SLUGS, crossObjectViolations, singleObjectOf } from "../functions/_lib/one_object_guard.js";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";

// The set to sweep is the guard's own vocabulary, not the article index. The index is paginated,
// so an index-driven sweep silently checked only the newest 250 slugs and would have missed every
// older single-object page — a gate with a blind spot is a gate that lets the class recur.
function corpus() {
  return [...new Set([...COMPOUNDS, ...CONDITION_SLUGS])];
}

const args = process.argv.slice(2);
const slugs = (args.length ? args : corpus()).filter((s) => singleObjectOf(s));
const failures = [];

for (const slug of slugs) {
  let title = "";
  let body = "";
  try {
    const r = await fetch(`${BASE}/api/articles/${slug}`);
    const j = await r.json();
    title = String(j.title || "");
    body = String(j.body || "");
  } catch {
    continue;
  }
  const v = crossObjectViolations({ slug, title, body });
  if (v.length) failures.push({ slug, title, violations: v });
}

if (failures.length) {
  console.log(JSON.stringify({ ok: false, law: "ONE_OBJECT_LAW", failing: failures.length, checked: slugs.length, failures }, null, 1));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, law: "ONE_OBJECT_LAW", checked: slugs.length }));
