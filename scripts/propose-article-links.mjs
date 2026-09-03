#!/usr/bin/env node
// Propose links for articles that link to nothing. Proposes; never writes.
//
// WHY A PROPOSER AND NOT A LINKER. 1,721 of 2,321 published articles point at nothing.
// The obvious mechanical fix — link articles that share a tag — is wrong: a probe on
// 2026-08-06 found the shared-tag relation produces over 5,000 candidate pairs among
// orphans alone, because nearly every article shares a tag with something. Linking on
// that signal would bury the corpus in noise and make the graph mean less than it does
// now.
//
// THE ONE NEAR-CERTAIN SIGNAL is a title the writer already typed. When article A's
// prose contains article B's exact title, the reference exists in the text already and
// linking it invents nothing — it only makes an authored reference navigable. Everything
// weaker than that is a judgment, and by the invariant a model may propose a
// reorganisation and may not certify its own, so this script stops at a patch file.
//
// Guards, each one there because the naive version is wrong:
//   - a title under MIN_TITLE chars is skipped; short titles collide with ordinary prose
//   - a match inside an existing markdown link or wikilink is skipped, or the pass would
//     propose linking text that is already a link
//   - a match inside a heading is skipped; a heading naming another page is usually the
//     subject of the section, not a reference to follow
//   - the longest title wins when two overlap, so a subtitle cannot shadow its parent
//   - self-references are skipped
//
// Usage:
//   node scripts/propose-article-links.mjs            # report + write the patch file
//   node scripts/propose-article-links.mjs --limit 40 # cap proposals

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const DB = "loop-content-spine";
const WINDOW = 25;
const MIN_TITLE = 22;
const OUT = ROOT + "/link-proposals.json";
const LIMIT = Number(
  (process.argv.find((a) => a.startsWith("--limit")) || "").split(/[= ]/)[1] ||
    process.argv[process.argv.indexOf("--limit") + 1] ||
    0,
);

function d1(sql, attempt = 0) {
  const r = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", DB, "--remote", "--json", "--command", sql],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  const out = String(r.stdout || "");
  const all = String(r.stderr || "") + out;
  if (r.status !== 0 || !out.trim().startsWith("[")) {
    if (/7429|memory limit|Network connection lost|fetch failed/i.test(all) && attempt < 4)
      return d1(sql, attempt + 1);
    throw new Error("d1 failed: " + all.slice(-400));
  }
  return JSON.parse(out)[0]?.results || [];
}

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

console.log("reading titles…");
const all = d1(
  "SELECT slug, title FROM articles WHERE published = 1 AND COALESCE(json_extract(meta,'$.status'),'') != 'retracted'",
);
// Longest first, so a subtitle cannot shadow the page it belongs to.
const targets = all
  .filter((r) => String(r.title || "").trim().length >= MIN_TITLE)
  .map((r) => ({ slug: r.slug, title: String(r.title).trim() }))
  .sort((a, b) => b.title.length - a.title.length);
console.log(`  ${all.length} published, ${targets.length} with a title long enough to match on`);

const bounds = d1(
  `SELECT MIN(rowid) AS lo, MAX(rowid) AS hi, COUNT(*) AS n FROM articles a
    WHERE a.published = 1
      AND NOT EXISTS (SELECT 1 FROM article_links l WHERE l.from_slug = a.slug)`,
)[0];
console.log(`  ${bounds?.n || 0} articles currently linking to nothing`);

// Regions where a match must be ignored: existing links, wikilinks, headings, code.
function maskedRanges(body) {
  const out = [];
  const add = (re) => {
    let m;
    const r = new RegExp(re.source, "gm");
    while ((m = r.exec(body))) out.push([m.index, m.index + m[0].length]);
  };
  add(/\[[^\]]*\]\([^)]*\)/); // markdown links
  add(/\[\[[^\]]*\]\]/); // wikilinks
  add(/^#{1,6}[^\n]*$/); // headings
  add(/```[\s\S]*?```/); // fenced code
  add(/`[^`\n]+`/); // inline code
  return out;
}
const inside = (ranges, i, j) => ranges.some(([a, b]) => i >= a && j <= b);

const proposals = [];
let scanned = 0;
for (let s = Number(bounds.lo || 0); s <= Number(bounds.hi || 0); s += WINDOW) {
  const rows = d1(
    `SELECT a.slug, a.title, a.body FROM articles a
      WHERE a.published = 1 AND a.rowid >= ${s} AND a.rowid < ${s + WINDOW}
        AND NOT EXISTS (SELECT 1 FROM article_links l WHERE l.from_slug = a.slug)`,
  );
  for (const r of rows) {
    scanned++;
    const body = String(r.body || "");
    if (body.length < 200) continue;
    const masked = maskedRanges(body);
    const taken = [];
    for (const t of targets) {
      if (t.slug === r.slug) continue;
      const re = new RegExp("(?<![\\w-])" + esc(t.title) + "(?![\\w-])", "i");
      const m = re.exec(body);
      if (!m) continue;
      const i = m.index;
      const j = i + m[0].length;
      if (inside(masked, i, j)) continue;
      if (taken.some(([a, b]) => i < b && j > a)) continue; // overlapping match already used
      taken.push([i, j]);
      proposals.push({
        from: r.slug,
        to: t.slug,
        matched_text: m[0],
        target_title: t.title,
        context: body.slice(Math.max(0, i - 90), j + 90).replace(/\s+/g, " "),
      });
      if (taken.length >= 3) break; // three per orphan is enough to unorphan it
    }
  }
  process.stdout.write(`\r  scanned ${scanned} orphans · ${proposals.length} proposals`);
}
console.log("");

const capped = LIMIT > 0 ? proposals.slice(0, LIMIT) : proposals;
const byFrom = new Set(capped.map((p) => p.from));
writeFileSync(
  OUT,
  JSON.stringify(
    {
      generated_for: "articles that link to nothing",
      rule: "the target title already appears verbatim in the source prose, outside links, headings and code",
      min_title_chars: MIN_TITLE,
      orphans_scanned: scanned,
      proposals: capped.length,
      orphans_this_would_connect: byFrom.size,
      note: "Proposals only. A model may propose a reorganisation and may not certify its own; each edit goes through the article write path with its own provenance.",
      items: capped,
    },
    null,
    2,
  ),
);

console.log(`\n${capped.length} proposals covering ${byFrom.size} of ${scanned} orphans`);
console.log(`written to ${OUT}`);
for (const p of capped.slice(0, 12)) {
  console.log(`\n  ${p.from}  ->  ${p.to}`);
  console.log(`    matched: "${p.matched_text}"`);
  console.log(`    ...${p.context.slice(0, 150)}...`);
}
