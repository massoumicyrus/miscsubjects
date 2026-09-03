#!/usr/bin/env node
/**
 * Download the build as an Obsidian vault (ontology layout + SHA256SUMS).
 *
 * Whole build:  node scripts/obsidian_pull.mjs --all --out=~/miscsubjects-vault --zip
 * A few pages:  node scripts/obsidian_pull.mjs --slugs=protocol,bpc-157
 *
 * The corpus does not fit in one Worker invocation — 1,191 articles answered error
 * 1102 after 104 seconds — so the export is paged and this script walks every page
 * into one folder. Before that it fetched a single URL, which meant --all printed a
 * Cloudflare error page and wrote nothing at all.
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { spawnSync } from "child_process";
import { createHash } from "crypto";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const args = process.argv.slice(2);
const flag = (name, dflt = null) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};

const all = args.includes("--all");
const zip = args.includes("--zip");
const clean = args.includes("--clean");
const slugs = flag("slugs", "protocol,bpc-157");
const pageSize = Math.min(100, Math.max(1, Number(flag("page-size", 50)) || 50));
const outRoot = flag("out", "~/miscsubjects-vault").replace(/^~/, homedir());

const query = all ? "all=1" : "slugs=" + encodeURIComponent(slugs);

async function getJSON(url, tries = 3) {
  let lastErr = null;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      const text = await r.text();
      // The edge answers 5xx as an HTML/plain error page. Parsing it as JSON and
      // reporting "no files" hid a 1102 behind a generic message for weeks.
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 120).replace(/\s+/g, " ")}`);
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`non-JSON response: ${text.slice(0, 120).replace(/\s+/g, " ")}`);
      }
    } catch (e) {
      lastErr = e;
      if (i < tries) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw lastErr;
}

function verifySums(root, sumsContent) {
  let ok = 0;
  const bad = [];
  for (const line of sumsContent.trim().split("\n").filter(Boolean)) {
    const [expected, ...rest] = line.split(/\s+/);
    const path = rest.join(" ");
    if (path === "SHA256SUMS") continue;
    try {
      const hash = createHash("sha256").update(readFileSync(join(root, path), "utf8")).digest("hex");
      if (hash === expected) ok++;
      else bad.push(path);
    } catch {
      bad.push(path + " (missing)");
    }
  }
  return { ok, bad };
}

async function main() {
  const manifest = await getJSON(`${BASE}/api/articles/obsidian-vault?${query}&page_size=${pageSize}&manifest=1`);
  const pages = manifest.pages || 1;
  console.log(`Corpus: ${manifest.total_slugs} articles · ${pages} page(s) of ${manifest.page_size} · ${outRoot}`);

  if (clean) {
    rmSync(outRoot, { recursive: true, force: true });
    console.log("Cleaned", outRoot);
  }

  let written = 0;
  let sumsOk = 0;
  const sumsBad = [];
  const seenSlugs = new Set();

  for (let page = 1; page <= pages; page++) {
    const url = `${BASE}/api/articles/obsidian-vault?${query}&page=${page}&page_size=${pageSize}`;
    const j = await getJSON(url);
    if (!j.ok || !j.files?.length) throw new Error(`page ${page} returned no files: ${j.error || "(no error given)"}`);

    for (const f of j.files) {
      if (f.path === "SHA256SUMS") continue;
      const path = join(outRoot, f.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, f.content, "utf8");
      written++;
    }
    // SHA256SUMS is per page; verify this page's files, then append to a vault-wide file.
    const sums = j.files.find((f) => f.path === "SHA256SUMS");
    if (sums) {
      const v = verifySums(outRoot, sums.content);
      sumsOk += v.ok;
      sumsBad.push(...v.bad);
      const sumsPath = join(outRoot, "SHA256SUMS");
      mkdirSync(dirname(sumsPath), { recursive: true });
      writeFileSync(sumsPath, sums.content, { encoding: "utf8", flag: page === 1 ? "w" : "a" });
    }
    (j.slugs || []).forEach((s) => seenSlugs.add(s));
    process.stdout.write(`  page ${page}/${pages} · ${j.files.length} files · ${written} total\r`);
  }

  console.log(`\nWrote ${written} files · ${seenSlugs.size} articles · ${outRoot}`);
  console.log(`SHA256SUMS: ${sumsOk} verified${sumsBad.length ? `, ${sumsBad.length} FAILED: ${sumsBad.slice(0, 5).join(", ")}` : ""}`);

  if (seenSlugs.size !== manifest.total_slugs) {
    console.warn(`WARNING: expected ${manifest.total_slugs} articles, wrote ${seenSlugs.size}.`);
  }

  console.log("Open in Obsidian: File → Open folder as vault →", outRoot);
  console.log("Start at index.md · contract SCHEMA.md · queue next.md · health lint.md");
  console.log("Sync edits back: node scripts/obsidian_sync.mjs --vault=" + outRoot);

  if (zip) {
    const zipPath = outRoot + ".zip";
    rmSync(zipPath, { force: true });
    const z = spawnSync("zip", ["-qr", zipPath, "."], { cwd: outRoot, stdio: "inherit" });
    if (z.status === 0) console.log("Created", zipPath);
    else console.warn("zip failed — install zip, or download one page as an archive with &format=zip");
  }

  if (sumsBad.length) process.exit(1);
}

main().catch((e) => {
  console.error("pull failed:", e.message || e);
  process.exit(1);
});
