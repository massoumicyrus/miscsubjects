#!/usr/bin/env node
/**
 * Ingest one external URL into article source ledger (PubMed, Reddit, X, etc.)
 * Usage: node scripts/ingest_source_url.mjs --slug=bpc-157 --url=https://... --type=pubmed --title="..." [--quote="..."]
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";
const args = process.argv.slice(2);
const get = (k) => args.find((a) => a.startsWith(k + "="))?.split("=").slice(1).join("=");

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const raw = readFileSync(join(homedir(), ".config/grok-bridge.env"), "utf8");
  const m = raw.match(/TERMINAL_KEY=(.+)/);
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  throw new Error("TERMINAL_KEY not found");
}

async function main() {
  const slug = get("--slug");
  const url = get("--url");
  const type = get("--type") || "other";
  const title = get("--title") || url;
  const quote = get("--quote") || "";
  const summary = get("--summary") || title;
  if (!slug || !url) {
    console.error("Usage: --slug=bpc-157 --url=https://... [--type=pubmed] [--title=] [--quote=]");
    process.exit(1);
  }
  const key = loadKey();
  const r = await fetch(BASE + "/api/protocol/sources", {
    method: "POST",
    headers: { "content-type": "application/json", "x-terminal-key": key },
    body: JSON.stringify({
      slug,
      model: "system/ingest-url",
      sources: [
        {
          type,
          url,
          title,
          quote: quote || summary.slice(0, 500),
          summary,
          found_by: "system/ingest-url",
        },
      ],
    }),
  });
  const j = await r.json();
  console.log(r.status, j.error || j.added || j);
  if (j.added?.length) {
    const s = await fetch(BASE + "/api/articles/" + slug + "/sources").then((x) => x.json());
    console.log("chain valid:", s.verification?.valid, "head:", s.verification?.head?.slice(0, 16));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});