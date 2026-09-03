// Obsidian vault export v3 — a lossless projection of the canonical graph.
// D1 stays the authority; the vault is Karpathy's compiled wiki over it:
// index.md catalog, append-only log.md, SCHEMA.md maintainer contract,
// lint.md + next.md (the compounding-loop surfaces), wikilinked bodies,
// backlinks, JSON Canvas, a Bases table, SHA256SUMS integrity.

import { buildArticleBundle } from "./article_bundle.js";
import { summarizeArticleYield, yieldMetricsForPass } from "./model_yield.js";
import { buildVoxelGraph } from "./voxel_graph.js";
import { classifySlug } from "./article_ontology.js";
import { constitutionMarkdown } from "./article_constitution.js";
import { loadQuestionGraph } from "./question_graph.js";
import { selfMarkdown, wrapMarkdown } from "./self_explain.js";
import { buildLinkGraph, graphLint, nextActs } from "./knowledge_loop.js";

const BASE = "https://miscsubjects.com";

function parseMeta(m) {
  try {
    return JSON.parse(m || "{}") || {};
  } catch {
    return {};
  }
}

async function sha256(text) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ── ZIP, so "download the build" is a file and not a JSON array ───────────────
// The export handed back a files[] array that only scripts/obsidian_pull.mjs knew
// how to unpack, so a person who wanted the vault could not simply download it.
// Store method, no compression: the payload is markdown, and the Worker's CPU
// budget is the scarce resource here (see the 1102 note in buildObsidianVault).
let CRC_TABLE = null;
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  CRC_TABLE = t;
  return t;
}

function crc32(buf) {
  const t = crcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Fixed 1980-01-01 timestamp on every entry: the same corpus must zip to the same
// bytes, or the SHA256SUMS the vault ships stop meaning anything for the archive.
const DOS_DATE = 0x0021;

export function zipFiles(entries) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const e of entries) {
    const name = enc.encode(e.path);
    const data = enc.encode(e.content);
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 filenames
    lv.setUint16(8, 0, true); // store
    lv.setUint16(10, 0, true);
    lv.setUint16(12, DOS_DATE, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    locals.push(local, data);

    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, DOS_DATE, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cd.set(name, 46);
    centrals.push(cd);

    offset += local.length + data.length;
  }

  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const all = [...locals, ...centrals, eocd];
  const total = all.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function vaultFolder(slug, role) {
  const r = role || classifySlug(slug);
  switch (r) {
    case "system_root":
      return "System/" + slug;
    case "peptide_root":
      return "Peptides/" + slug;
    case "stack":
      return "Stacks/" + slug;
    case "condition":
      return "Conditions/" + slug;
    default:
      return "Articles/" + slug;
  }
}

function yamlEscape(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ");
}

function frontmatter(obj) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${yamlEscape(item)}`);
    } else if (typeof v === "object") {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    } else {
      lines.push(`${k}: "${yamlEscape(v)}"`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

// YAML MUST BE THE FIRST BYTES OF THE FILE. Obsidian parses properties only when
// the opening `---` is at byte 0 — one character before it and the note has no
// properties at all, the Bases views that query them return nothing, and the
// stable id a round trip needs is invisible.
//
// wrapMarkdown() puts the §SELF preamble first, so every note in this vault was
// being emitted with its frontmatter buried a few hundred bytes in: generated
// correctly, then made unreadable by the wrapper. Same shape as the authored-prose
// defect in the invariants — the wrapper won over the content.
//
// This splits a leading frontmatter block off the inner text, wraps what remains,
// and puts the block back at the front.
export function frontmatterFirst(widgetId, inner, ctx) {
  const m = /^---\n[\s\S]*?\n---\n?/.exec(inner);
  if (!m) return wrapMarkdown(widgetId, inner, ctx);
  const block = m[0].replace(/\n?$/, "\n");
  return block + "\n" + wrapMarkdown(widgetId, inner.slice(m[0].length), ctx);
}

function syncBlock(slug) {
  return (
    "\n\n## Sync (append-only)\n\n" +
    "Local edits feel like edits; sync posts **new claims/challenges**, never silent overwrites.\n\n" +
    "```bash\nnode scripts/obsidian_sync.mjs --vault=~/miscsubjects-vault\n```\n\n" +
    "- `claim " + slug + "|tier|assertion`\n" +
    "- `ingest " + slug + "|evidence paste`\n" +
    "- Live: " + BASE + "/api/articles/" + slug + "/bundle?format=markdown\n"
  );
}

function buildWikiRegistry(slugs) {
  const reg = {};
  for (const slug of slugs) reg[slug] = vaultFolder(slug);
  return reg;
}

function wiki(reg, slug, label) {
  const p = reg[slug] || vaultFolder(slug);
  return label ? `[[${p}/README|${label}]]` : `[[${p}/README]]`;
}

// Lossless projection of links: canonical /a/<slug> URLs and typed [[slug]]
// wikilinks both become vault-resolvable wikilinks on export; the site route
// renders the same [[slug]] back to /a/<slug>. Slugs outside the export set
// keep their canonical URL (never lossy). Reserved [[...]] block grammars
// (embed:, object:, stack-embed:, graph) carry a colon or the word "graph"
// and are left untouched.
export function bodyToWikilinks(md, reg) {
  let out = String(md || "");
  out = out.replace(
    /\[([^\]\n]+)\]\((?:https?:\/\/miscsubjects\.com)?\/a\/([a-z0-9][a-z0-9_-]*)\)/gi,
    (m, text, slug) => (reg[slug.toLowerCase()] ? `[[${reg[slug.toLowerCase()]}/README|${text}]]` : m),
  );
  out = out.replace(
    /\[\[([a-z0-9][a-z0-9_-]{1,80})(?:\|([^\]\n]{1,160}))?\]\]/gi,
    (m, slug, label) => {
      const key = slug.toLowerCase();
      if (key === "graph" || !reg[key]) return m;
      return `[[${reg[key]}/README|${label || slug}]]`;
    },
  );
  return out;
}

function articleReadme(slug, row, meta, bundle, reg, backlinks, bodyHash) {
  const embedLinks = (meta.embeds || []).map((e) => wiki(reg, e, e));
  const body = bodyToWikilinks(bundle?.body || row.body || "", reg);
  const inbound = backlinks || [];
  const inner =
    frontmatter({
      // ms:article:<slug> is the durable identity. The slug is the address today;
      // the prefixed id is what a sync compares when a path, title or folder moves.
      id: "ms:article:" + slug,
      slug,
      title: row.title,
      type: "article",
      role: classifySlug(slug),
      status: row.published === 0 ? "draft" : "published",
      // revision + content_hash are what make a round trip checkable: a local file
      // whose hash still matches has not been edited, and one whose revision is
      // behind the site must not overwrite it.
      revision: (meta.revisions || []).length,
      // Computed here, not read from a field. bundle.body_hash and meta.body_hash are
      // both usually absent, and frontmatter() drops null values — so every note went
      // out with no content_hash at all, which is precisely the property a round trip
      // compares. A hash that is sometimes missing is a hash nobody can rely on.
      content_hash: bodyHash || null,
      tags: ["miscsubjects", "article", ...(meta.tags || [])],
      aliases: [row.title, slug],
      permalink: "/a/" + slug,
      url: BASE + "/a/" + slug,
      created: row.created_at || null,
      updated: row.updated_at,
      claims: (meta.claims || []).length,
      sources: (meta.sources || []).length,
      backlinks: inbound.length,
      live_graph: BASE + "/graph.html?slugs=" + slug,
    }) +
    "\n\n# " +
    row.title +
    "\n\n" +
    `> [[_MOC/graph|Graph MOC]] · [[index]] · [[next]] · ${wiki(reg, "protocol", "protocol")} · [canvas](${BASE}/graph.html?slugs=${slug})\n\n` +
    body +
    "\n\n## Linked from\n\n" +
    (inbound.length
      ? inbound.slice(0, 40).map((s) => wiki(reg, s, s)).join(" · ")
      : "_no inbound links — orphan; see [[lint]]_") +
    "\n\n## Folder index\n\n" +
    "- [[claims]] — all claim atoms\n" +
    "- [[sources]] — hash-chained source ledger\n" +
    "- [[voxels]] — edge topology\n" +
    "- [[provenance]] — model passes + yield\n" +
    "- [[question_graph]] — ask nodes + ingests\n" +
    "- [[constitution]] — binding rules\n" +
    "- [[yield]] — $/output under disclosed constraints\n\n" +
    "## Embeds\n\n" +
    (embedLinks.join(" · ") || "_none_") +
    syncBlock(slug);
  return frontmatterFirst("obsidian_article", inner, {
    slug,
    contains: "article README with §SELF — open this folder in Obsidian",
  });
}

function claimsAggregate(slug, claims, reg) {
  const lines = [
    frontmatter({
      slug,
      type: "claims_index",
      tags: ["miscsubjects", "claims"],
      dataview: true,
    }),
    "",
    "# Claims · " + slug,
    "",
    `Article: ${wiki(reg, slug)}`,
    "",
  ];
  for (const c of claims) {
    const src = (c.source_ids || []).join(", ");
    lines.push(
      "## " + c.id,
      "",
      frontmatter({
        id: c.id,
        tier: c.tier,
        weight: c.weight,
        posted_by: c.posted_by?.actor || c.who_claims,
        source_ids: c.source_ids || [],
        status: c.status || "active",
        slot: c.slot || c.section,
        hash: c.posted_by?.ts ? null : undefined,
      }),
      "",
      (c.text || "") + "",
      "",
      src ? "- sources: " + src : "- sources: _unsourced_",
      "- atom: [[claims/" + c.id + "|" + c.id + "]]",
      "",
      "### Local annotation",
      "_Add notes below. Run obsidian_sync to post as challenge/claim._",
      "",
    );
  }
  lines.push(syncBlock(slug));
  return lines.join("\n");
}

function claimAtom(slug, claim, reg) {
  const challenged = (claim.challenged_by || []).map(
    (id) => `[[claims/${id}|${id}]]`,
  );
  return (
    frontmatter({
      id: claim.id,
      slug,
      type: "claim",
      tier: claim.tier,
      weight: claim.weight,
      slot: claim.slot || claim.section,
      status: claim.status || "active",
      posted_by: claim.posted_by?.actor || claim.who_claims,
      posted_at: claim.posted_by?.ts,
      source_ids: claim.source_ids || [],
      tags: ["miscsubjects", "claim", "tier/" + (claim.tier || "unknown")],
      miscsubjects_sync: "obsidian_sync",
    }) +
    "\n\n# " +
    claim.id +
    "\n\n" +
    `Article: ${wiki(reg, slug)}\n\n` +
    (claim.text || "") +
    "\n\n## Challenged by\n\n" +
    (challenged.join(" · ") || "_none_") +
    "\n\n### Local annotation\n\n_Add challenge or correction here → `node scripts/obsidian_sync.mjs`_\n" +
    syncBlock(slug)
  );
}

function sourcesAggregate(slug, sources, reg) {
  const lines = [
    frontmatter({ slug, type: "sources_index", tags: ["miscsubjects", "sources"] }),
    "",
    "# Sources · " + slug,
    "",
    `Article: ${wiki(reg, slug)}`,
    "",
  ];
  for (const s of sources) {
    lines.push(
      "## " + s.id,
      "",
      frontmatter({
        id: s.id,
        type: s.type,
        url: s.url,
        prev: s.prev || "genesis",
        hash: s.hash,
        link_status: s.link_status,
        claim_ids: s.claim_ids || [],
      }),
      "",
      (s.title || "") + "",
      s.url ? `[${s.url}](${s.url})` : "",
      s.quote ? "\n> " + String(s.quote).slice(0, 1500) : "",
      "- atom: [[sources/" + s.id + "]]",
      "",
    );
  }
  return lines.join("\n");
}

function voxelsDoc(slug, meta, reg) {
  const g = buildVoxelGraph(slug, meta);
  const lines = [
    frontmatter({ slug, type: "voxels", tags: ["miscsubjects", "graph"] }),
    "",
    "# Voxels · " + slug,
    "",
    `Live: ${BASE}/api/articles/${slug}/voxels`,
    "",
  ];
  for (const v of (g.voxels || []).slice(0, 60)) {
    const edges = (v.edges || []).map((e) => e.type + (e.target ? "→" + e.target : "")).join(", ");
    lines.push("- **" + v.id + "** [" + v.tier + "] edges: " + (edges || "—"));
  }
  return lines.join("\n");
}

function provenanceDoc(slug, meta, reg) {
  const y = summarizeArticleYield(meta);
  const lines = [
    frontmatter({ slug, type: "provenance", tags: ["miscsubjects", "yield"] }),
    "",
    "# Provenance · " + slug,
    "",
    "```json",
    JSON.stringify(y, null, 2),
    "```",
    "",
  ];
  for (const p of meta.contributions || []) {
    const ym = yieldMetricsForPass(p);
    lines.push(
      "- **" +
        p.id +
        "** " +
        p.model +
        " · " +
        p.action +
        " · " +
        ym.tokens_total +
        " tok · $" +
        ym.cost_usd +
        (ym.output_count ? " · " + ym.output_count + " outputs" : ""),
    );
  }
  return lines.join("\n");
}

async function questionGraphDoc(env, slug, reg) {
  const g = await loadQuestionGraph(env, slug, { limit: 24 });
  const lines = [
    frontmatter({ slug, type: "question_graph", tags: ["miscsubjects", "questions"] }),
    "",
    "# Question graph · " + slug,
    "",
  ];
  for (const q of g.questions || []) {
    lines.push(
      "- **" + q.node_id + "** " + String(q.question || "").slice(0, 120),
    );
    if (q.gaps?.length) lines.push("  - gaps: " + q.gaps.join("; "));
  }
  return lines.join("\n");
}

function mocOntology(slugs, reg) {
  const byFolder = {};
  for (const s of slugs) {
    const folder = vaultFolder(s).split("/")[0];
    (byFolder[folder] = byFolder[folder] || []).push(s);
  }
  let body = selfMarkdown("obsidian_vault", { contains: "ontology MOC for Obsidian graph view" }) + "\n\n# Graph MOC\n\n";
  for (const [folder, list] of Object.entries(byFolder).sort()) {
    body += "\n## " + folder + "\n\n";
    for (const s of list.sort()) body += "- " + wiki(reg, s, s) + "\n";
  }
  body +=
    "\n\n## Canvas layers\n\n" +
    "- [Full graph](" +
    BASE +
    "/graph.html?slugs=" +
    slugs.join(",") +
    ")\n" +
    "- [Reflex](" +
    BASE +
    "/graph.html?slugs=protocol,bpc-157&layer=reflex)\n" +
    "- [Yield](" +
    BASE +
    "/graph.html?slugs=" +
    slugs.join(",") +
    "&layer=yield)\n\n" +
    "## Dataview\n\n" +
    "```dataview\nTABLE tier, weight, posted_by\nFROM \"Peptides/bpc-157/claims\"\nWHERE tier = \"human\"\n```\n\n" +
    "Live query: `GET /api/v1/query?from=bpc-157&kind=claim&where=tier=human`\n";
  return body;
}

function vaultReadme(slugs, reg) {
  return wrapMarkdown(
    "obsidian_vault",
    frontmatter({
      id: "miscsubjects-vault",
      type: "vault",
      tags: ["miscsubjects"],
      version: "2",
    }) +
      "\n\n# miscsubjects vault\n\n" +
      "**Local-first working copy** of the global argument graph. Canonical ledger: miscsubjects.com — this vault is a lossless projection; the site wins every conflict.\n\n" +
      "## Quick start\n\n" +
      "1. `node scripts/obsidian_pull.mjs --out=~/miscsubjects-vault`\n" +
      "2. Obsidian → Open folder as vault\n" +
      "3. Start at [[index]]; the maintainer contract is [[SCHEMA]]\n" +
      "4. The ranked work queue is [[next]]; graph health is [[lint]]; chronology is [[log]]\n" +
      "5. Edit → `node scripts/obsidian_sync.mjs`\n\n" +
      "## Ontology folders\n\n" +
      "- `System/` — protocol, constitution\n" +
      "- `Peptides/` — root peptide articles\n" +
      "- `Conditions/` — condition branches\n" +
      "- `Stacks/` — composition articles\n\n" +
      "## Per-article folder\n\n" +
      "Each slug folder contains README, claims.md, sources.md, voxels.md, provenance.md, question_graph.md, constitution.md, yield.md, and `claims/{id}.md` atoms.\n\n" +
      "## Integrity\n\n" +
      "Root `SHA256SUMS` verifies offline export against live ledger.\n\n" +
      "## Articles\n\n" +
      slugs.map((s) => "- " + wiki(reg, s, s)).join("\n"),
    { contains: "Obsidian vault root README with §SELF" },
  );
}

function dailyIngestTemplate() {
  return (
    frontmatter({
      type: "daily_ingest",
      tags: ["miscsubjects", "ingest"],
      ingest_slug: "bpc-157",
      tier: "anecdotal",
    }) +
    "\n\n# Daily ingest\n\n" +
    "## Ingest: bpc-157\n\n" +
    "source: https://...\n" +
    'quote: "..."\n' +
    "tier: anecdotal\n\n" +
    "_Sync posts to `/api/protocol/ingest`_\n\n" +
    "```bash\nnode scripts/obsidian_sync.mjs --ingest-only\n```\n"
  );
}

// index.md — Karpathy's content catalog: every page, one line, by category.
// The first file any model (or reader) opens.
function indexDoc(graph, exported, reg) {
  const byFolder = {};
  for (const slug of exported) {
    const folder = (reg[slug] || vaultFolder(slug)).split("/")[0];
    (byFolder[folder] = byFolder[folder] || []).push(slug);
  }
  const lines = [
    frontmatter({ id: "index", type: "index", tags: ["miscsubjects", "index"] }),
    "",
    "# Index",
    "",
    "One line per page. Canonical ledger: " + BASE + ". Open [[next]] for the ranked work queue, [[lint]] for graph health, [[log]] for the chronology.",
    "",
  ];
  for (const [folder, list] of Object.entries(byFolder).sort()) {
    lines.push("## " + folder, "");
    for (const slug of list.sort()) {
      const n = graph.nodes[slug];
      if (!n) continue;
      const inb = (graph.inbound[slug] || []).length;
      lines.push(
        "- " +
          wiki(reg, slug, n.title || slug) +
          " — " +
          (n.summary || n.role) +
          " · " +
          n.claims +
          " claims · " +
          n.sources +
          " sources · " +
          inb +
          " backlinks · updated " +
          String(n.updated_at || "").slice(0, 10),
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

// log.md — append-only chronology, projected from the canonical events ledger.
async function logDoc(env, limit = 200) {
  const lines = [
    frontmatter({ id: "log", type: "log", tags: ["miscsubjects", "log"] }),
    "",
    "# Log",
    "",
    "Append-only projection of the live ledger (" + BASE + "/admin → Ledger is canonical; this file is a read model).",
    "",
  ];
  try {
    const rows = await env.LEDGER.prepare(
      "SELECT ts, source, key, action, status FROM events ORDER BY ts DESC LIMIT ?",
    )
      .bind(limit)
      .all();
    for (const e of rows.results || []) {
      lines.push(
        "## [" +
          String(e.ts || "").slice(0, 16).replace("T", " ") +
          "] " +
          (e.action || e.source || "event") +
          " | " +
          (e.key || "") +
          (e.status != null ? " · " + e.status : ""),
      );
    }
  } catch (e) {
    lines.push("_ledger unavailable in this environment: " + String(e?.message || e) + "_");
  }
  return lines.join("\n") + "\n";
}

// SCHEMA.md — the portable, model-independent maintainer contract.
// CLAUDE.md and AGENTS.md are thin pointers so any agentic CLI auto-loads it.
function schemaDoc() {
  return (
    frontmatter({ id: "schema", type: "schema", tags: ["miscsubjects", "schema"] }) +
    `

# SCHEMA — how this vault is maintained

## Authority

miscsubjects.com (D1 + the events ledger) is canonical. This vault is a lossless
projection. Local edits are proposals: sync posts them as **new claims or
challenges** on the live ledger — never silent overwrites of canon.

## Layers (Karpathy's compiled-wiki pattern)

1. **Raw sources** — immutable. Each article's \`sources.md\` + \`sources/{id}.md\`
   atoms are a hash-chained ledger; never edit them locally.
2. **Wiki** — the article READMEs, claims, and this index. Generated, wikilinked,
   re-derived from canon on every pull.
3. **Schema** — this file. Structure, conventions, operations.

## The three operations

- **ingest** — new evidence arrives: add it under \`### Local annotation\` on the
  claim it touches (or use \`_Daily/ingest-template.md\`), then run
  \`node scripts/obsidian_sync.mjs\`. The sync posts a challenge/ingest to the
  live ledger; the next pull shows the graph revised. One source may touch many
  pages — that is the point.
- **query** — start at [[index]], follow wikilinks, or query live:
  \`GET ${BASE}/api/v1/query?from=<slug>&kind=claim&where=tier=human\`.
  Valuable analyses get filed back as articles via the protocol intake.
- **lint** — [[lint]] is the standing health report (orphans, missing pages,
  unsourced claims, open challenges, stale hubs). Live:
  \`GET ${BASE}/api/articles/graph-lint\`. Every finding names the page and the
  defect; clearing one changes the next pull.

## What to do next

[[next]] is the ranked queue derived from the same graph — write, resolve,
source, revise, connect, respond, outreach. Live:
\`GET ${BASE}/api/articles/next-acts\`.

## Conventions

- Folders are ontology: System/, Peptides/, Conditions/, Stacks/, Articles/.
- Every page = folder with README.md + claims/sources/voxels/provenance/
  question_graph/constitution/yield.
- Wikilinks in bodies round-trip: the site renders \`[[slug]]\` as /a/slug; the
  export rewrites canonical links to vault wikilinks. A wikilink to a page that
  does not exist is a recorded request for that page (it feeds [[next]]).
- Frontmatter properties are typed (Obsidian): dates ISO 8601, tags/aliases lists.
- \`Misc.base\` gives table views over these properties; \`_MOC/graph.canvas\` is
  the ontology map; the graph view shows the same topology natively.
- Integrity: \`SHA256SUMS\` at root verifies this export against the ledger.

## Tooling

- Pull: \`node scripts/obsidian_pull.mjs --out=~/miscsubjects-vault [--all]\`
- Sync: \`node scripts/obsidian_sync.mjs --vault=~/miscsubjects-vault\`
- Obsidian official CLI (app running): \`obsidian vault="miscsubjects-vault" backlinks file="README"\`
- Everything here is also live JSON: /api/articles/graph-links, /graph-lint,
  /next-acts, /obsidian-vault.
`
  );
}

function agentPointer(name) {
  return (
    "# " +
    name +
    "\n\nRead [[SCHEMA]] (SCHEMA.md) first — it is the maintainer contract for this vault.\n" +
    "Canonical system: " +
    BASE +
    " (this vault is a projection; the site/API/ledger win every conflict).\n" +
    "Operations: ingest → query → lint, then take the top item in [[next]].\n"
  );
}

function lintDoc(lint, reg) {
  const L = [
    frontmatter({ id: "lint", type: "lint", tags: ["miscsubjects", "lint"], generated: lint.generated_at }),
    "",
    "# Lint — graph health",
    "",
    "Live: " + BASE + "/api/articles/graph-lint · counts: " + JSON.stringify(lint.counts),
    "",
    "## Missing pages (wikilinked, not yet written)",
    "",
  ];
  for (const m of lint.missing_pages.slice(0, 40))
    L.push("- `" + m.target + "` ← requested by " + m.requested_by.map((s) => wiki(reg, s, s)).join(", "));
  if (!lint.missing_pages.length) L.push("_none_");
  L.push("", "## Orphans (no inbound links)", "");
  for (const o of lint.orphans.slice(0, 60)) L.push("- " + wiki(reg, o.slug, o.title || o.slug) + " (" + o.role + ")");
  if (!lint.orphans.length) L.push("_none_");
  L.push("", "## Unsourced claims", "");
  for (const u of lint.unsourced_claims.slice(0, 40)) L.push("- " + wiki(reg, u.slug, u.slug) + " — " + u.unsourced_claims + " claim(s) without a source");
  if (!lint.unsourced_claims.length) L.push("_none_");
  L.push("", "## Open challenges", "");
  for (const c of lint.open_challenges.slice(0, 40)) L.push("- " + wiki(reg, c.slug, c.slug) + " — " + c.open_challenges + " active challenge(s)");
  if (!lint.open_challenges.length) L.push("_none_");
  L.push("", "## Stale hubs", "");
  for (const s of lint.stale.slice(0, 40)) L.push("- " + wiki(reg, s.slug, s.title || s.slug) + " — " + s.inbound + " backlinks, " + s.days_since_update + " days old");
  if (!lint.stale.length) L.push("_none_");
  return L.join("\n") + "\n";
}

function nextDoc(next, reg) {
  const L = [
    frontmatter({ id: "next", type: "next", tags: ["miscsubjects", "next"], generated: next.generated_at }),
    "",
    "# Next — the ranked work queue",
    "",
    "Derived from the live graph on every pull; perform the top act and the queue re-derives. Live: " + BASE + "/api/articles/next-acts",
    "",
  ];
  for (const a of next.acts) {
    L.push(
      "- **" +
        a.kind +
        "** " +
        (reg[a.target] ? wiki(reg, a.target, a.target) : "`" + a.target + "`") +
        " (score " +
        a.score +
        ") — " +
        a.reason +
        ". Clears: " +
        a.clears,
    );
  }
  return L.join("\n") + "\n";
}

// Misc.base — Obsidian Bases table views over the exported frontmatter.
function baseFile() {
  return `filters:
  and:
    - file.hasTag("miscsubjects")
views:
  - type: table
    name: Articles
    filters:
      and:
        - 'type == "article"'
    order:
      - file.name
      - role
      - claims
      - sources
      - backlinks
      - updated
    groupBy:
      property: note.role
      direction: ASC
    summaries:
      claims: Sum
      sources: Sum
  - type: table
    name: Orphans
    filters:
      and:
        - 'type == "article"'
        - 'backlinks == 0'
    order:
      - file.name
      - claims
      - updated
  - type: table
    name: Claim atoms
    filters:
      and:
        - 'type == "claim"'
    order:
      - file.name
      - tier
      - status
      - posted_by
`;
}

// _MOC/graph.canvas — JSON Canvas 1.0 map of the exported ontology.
function canvasFile(exported, reg, graph) {
  const byFolder = {};
  for (const slug of exported) {
    const folder = (reg[slug] || vaultFolder(slug)).split("/")[0];
    (byFolder[folder] = byFolder[folder] || []).push(slug);
  }
  const nodes = [];
  const edges = [];
  const colors = { System: "6", Peptides: "4", Conditions: "2", Stacks: "5", Articles: "1" };
  let gx = 0;
  for (const [folder, list] of Object.entries(byFolder).sort()) {
    const shown = list.sort().slice(0, 8);
    const h = 120 + shown.length * 70;
    nodes.push({
      id: "grp-" + folder,
      type: "group",
      label: folder + " (" + list.length + ")",
      x: gx,
      y: 0,
      width: 460,
      height: h,
      color: colors[folder] || "3",
    });
    shown.forEach((slug, i) => {
      nodes.push({
        id: "f-" + slug,
        type: "file",
        file: (reg[slug] || vaultFolder(slug)) + "/README.md",
        x: gx + 30,
        y: 60 + i * 70,
        width: 400,
        height: 60,
      });
    });
    gx += 520;
  }
  const present = new Set(nodes.map((n) => n.id));
  for (const e of graph.edges) {
    if (e.kind !== "embed") continue;
    if (present.has("f-" + e.from) && present.has("f-" + e.to)) {
      edges.push({
        id: "e-" + e.from + "-" + e.to,
        fromNode: "f-" + e.from,
        toNode: "f-" + e.to,
        fromSide: "right",
        toSide: "left",
      });
    }
  }
  return JSON.stringify({ nodes, edges: edges.slice(0, 120) }, null, 2);
}

// The registers that share the articles table but are not articles — the same set
// /api/articles excludes. The vault selected every row, so a whole-corpus pull
// would have carried 2,321 rows of source ledger and unpublished drafts into a
// reader's second brain instead of the 1,191 published articles.
const NON_ARTICLE_REGISTERS = ["source_ledger", "source", "audit"];

const CORPUS_SQL =
  "SELECT slug FROM articles WHERE published = 1 AND " +
  "COALESCE(json_extract(meta,'$.register'),'standard') NOT IN ('source_ledger','source','audit') " +
  "ORDER BY slug";

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 100;

// "?all=1", "?all=yes", "?all" and "?all=true" all mean the whole corpus. Only the
// literal string "true" was accepted, so every other spelling fell through to the
// two-slug example list and answered ok:true — a caller asking for the whole build
// got two articles out of 1,191 and nothing said so.
export function wantsAll(url) {
  if (!url.searchParams.has("all")) return false;
  const v = String(url.searchParams.get("all") ?? "").toLowerCase();
  return v !== "false" && v !== "0" && v !== "no";
}

async function corpusSlugs(env, url) {
  if (wantsAll(url)) {
    const rows = await env.DB.prepare(CORPUS_SQL).all();
    return (rows.results || []).map((r) => r.slug);
  }
  return [
    ...new Set(
      (url.searchParams.get("slugs") || "protocol,bpc-157")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function paging(url, total) {
  const pageSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, Number(url.searchParams.get("page_size") || PAGE_SIZE_DEFAULT) || PAGE_SIZE_DEFAULT),
  );
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pages, Math.max(1, Number(url.searchParams.get("page") || 1) || 1));
  return { pageSize, pages, page };
}

// A manifest costs one indexed query, so a caller can learn how many pages the
// whole build is before committing to twenty-four multi-megabyte requests.
export async function obsidianVaultManifest(env, url) {
  const allSlugs = await corpusSlugs(env, url);
  const { pageSize, pages, page } = paging(url, allSlugs.length);
  const q = wantsAll(url) ? "all=1" : "slugs=" + allSlugs.join(",");
  return {
    ok: true,
    vault: "miscsubjects",
    version: 3,
    manifest: true,
    total_slugs: allSlugs.length,
    page_size: pageSize,
    pages,
    page,
    page_urls: Array.from(
      { length: pages },
      (_, i) =>
        BASE + "/api/articles/obsidian-vault?" + q + "&page=" + (i + 1) + "&page_size=" + pageSize,
    ),
    zip_urls: Array.from(
      { length: pages },
      (_, i) =>
        BASE +
        "/api/articles/obsidian-vault?" +
        q +
        "&page=" +
        (i + 1) +
        "&page_size=" +
        pageSize +
        "&format=zip",
    ),
    whole_build: "node scripts/obsidian_pull.mjs --all --out=~/miscsubjects-vault --zip",
    slugs: allSlugs,
  };
}

export async function buildObsidianVault(env, url) {
  const allSlugs = await corpusSlugs(env, url);

  // The whole corpus cannot be rendered in one Worker invocation. 1,191 articles
  // each cost a bundle build, a voxel graph, a question graph and a constitution,
  // and ?all=true answered error 1102 after 104 seconds — so "download the build"
  // had no working path at all: the default gave two articles and all gave a crash.
  // Notes are emitted one page at a time. The wikilink registry is still built from
  // every slug in the corpus, so a [[link]] on page 1 resolves to a note that only
  // arrives on page 19 — Obsidian reads the folder, not the response.
  const { pageSize, pages, page } = paging(url, allSlugs.length);
  const slugs = allSlugs.slice((page - 1) * pageSize, page * pageSize);
  const includeRoot = page === 1;

  const includeAtoms = url.searchParams.get("atoms") !== "false";
  const maxClaims = Math.min(300, Number(url.searchParams.get("max_claims") || 120));
  const reg = buildWikiRegistry(allSlugs);
  const files = [];

  // One derivation pass powers backlinks, index, lint, next, and the canvas —
  // the corpus is scanned exactly once, then reused (a triple scan 1102'd the
  // Worker on 2026-08-02).
  // Backlinks on every per-article note need the graph, so it is built on every
  // page. The lint and queue surfaces only feed root files, so they are built once.
  const linkGraph = await buildLinkGraph(env);
  const lint = includeRoot ? await graphLint(env, { graph: linkGraph }) : null;
  const next = includeRoot && lint ? await nextActs(env, { lint }) : null;

  // Root files carry the whole corpus, not this page's slice — the index has to
  // list every article or a paged pull leaves a vault whose index knows about
  // fifty of its 1,191 notes. They are written once, on page 1.
  if (includeRoot) {
    files.push({ path: "README.md", content: vaultReadme(allSlugs, reg) });
    files.push({ path: "SCHEMA.md", content: schemaDoc() });
    files.push({ path: "CLAUDE.md", content: agentPointer("CLAUDE.md") });
    files.push({ path: "AGENTS.md", content: agentPointer("AGENTS.md") });
    files.push({ path: "index.md", content: indexDoc(linkGraph, allSlugs, reg) });
    files.push({ path: "log.md", content: await logDoc(env) });
    files.push({ path: "lint.md", content: lintDoc(lint, reg) });
    files.push({ path: "next.md", content: nextDoc(next, reg) });
    files.push({ path: "Misc.base", content: baseFile() });
    files.push({ path: "_MOC/graph.md", content: mocOntology(allSlugs, reg) });
    files.push({ path: "_MOC/graph.canvas", content: canvasFile(allSlugs, reg, linkGraph) });
    files.push({ path: "_Daily/ingest-template.md", content: dailyIngestTemplate() });
    files.push({
      path: ".obsidian/app.json",
      content: JSON.stringify({ strictLineBreaks: false, alwaysUpdateLinks: true }, null, 2),
    });
    files.push({
      path: ".obsidian/graph.json",
      content: JSON.stringify(
        {
          colorGroups: [
            { query: 'path:"System"', color: { a: 1, rgb: 11621088 } },
            { query: 'path:"Peptides"', color: { a: 1, rgb: 4431943 } },
            { query: 'path:"Conditions"', color: { a: 1, rgb: 16744192 } },
            { query: 'path:"Stacks"', color: { a: 1, rgb: 42495 } },
          ],
          showTags: false,
          showAttachments: false,
        },
        null,
        2,
      ),
    });
  }

  for (const slug of slugs) {
    const row = await env.DB.prepare(
      "SELECT slug, title, body, meta, updated_at, published FROM articles WHERE slug=?",
    )
      .bind(slug)
      .first();
    if (!row) continue;
    const meta = parseMeta(row.meta);
    const folder = vaultFolder(slug);
    const prefix = folder + "/";

    let bundle = null;
    try {
      bundle = await buildArticleBundle(env, slug);
    } catch {}

    const claims = (meta.claims || []).slice(0, maxClaims);
    const sources = meta.sources || [];

    const bodyHash = await sha256(String(bundle?.body ?? row.body ?? ""));
    files.push({
      path: prefix + "README.md",
      content: articleReadme(
        slug,
        row,
        meta,
        bundle,
        reg,
        linkGraph.inbound[slug] || [],
        bodyHash,
      ),
    });
    files.push({ path: prefix + "claims.md", content: claimsAggregate(slug, claims, reg) });
    files.push({ path: prefix + "sources.md", content: sourcesAggregate(slug, sources, reg) });
    files.push({ path: prefix + "voxels.md", content: voxelsDoc(slug, meta, reg) });
    files.push({ path: prefix + "provenance.md", content: provenanceDoc(slug, meta, reg) });
    files.push({
      path: prefix + "question_graph.md",
      content: await questionGraphDoc(env, slug, reg),
    });
    files.push({
      path: prefix + "constitution.md",
      content: wrapMarkdown(
        "article_constitution",
        constitutionMarkdown(slug),
        { slug },
      ),
    });
    files.push({
      path: prefix + "yield.md",
      content:
        frontmatter({ slug, type: "yield" }) +
        "\n\n# Yield\n\n```json\n" +
        JSON.stringify(summarizeArticleYield(meta), null, 2) +
        "\n```\n",
    });

    if (includeAtoms) {
      for (const c of claims) {
        files.push({
          path: prefix + "claims/" + c.id + ".md",
          content: claimAtom(slug, c, reg),
        });
      }
      for (const s of sources) {
        files.push({
          path: prefix + "sources/" + s.id + ".md",
          content:
            frontmatter({
              id: s.id,
              slug,
              type: "source",
              source_type: s.type,
              url: s.url,
              hash: s.hash,
              prev: s.prev || "genesis",
              tags: ["miscsubjects", "source"],
            }) +
            "\n\n# " +
            s.id +
            "\n\n" +
            (s.title || "") +
            "\n" +
            (s.url ? `[link](${s.url})\n` : "") +
            (s.quote ? "\n> " + String(s.quote).slice(0, 2000) : ""),
        });
      }
    }
  }

  const sums = [];
  for (const f of files) {
    const hash = await sha256(f.content);
    sums.push(hash + "  " + f.path);
    f.sha256 = hash;
  }
  files.push({
    path: "SHA256SUMS",
    content: sums.join("\n") + "\n",
  });

  const q = wantsAll(url) ? "all=1" : "slugs=" + allSlugs.join(",");
  const pageUrl = (n) =>
    BASE + "/api/articles/obsidian-vault?" + q + "&page=" + n + "&page_size=" + pageSize;

  return {
    ok: true,
    vault: "miscsubjects",
    version: 3,
    slugs,
    total_slugs: allSlugs.length,
    page,
    pages,
    page_size: pageSize,
    has_more: page < pages,
    next: page < pages ? pageUrl(page + 1) : null,
    root_files_on: 1,
    paging_note:
      pages > 1
        ? "This response holds page " +
          page +
          " of " +
          pages +
          ". Write every page into the same folder to get the whole vault; root files and the index ship on page 1 and cover all " +
          allSlugs.length +
          " articles. One command does all of it: node scripts/obsidian_pull.mjs --all --out=~/miscsubjects-vault --zip"
        : "Single page — this response is the whole requested vault.",
    manifest_url: BASE + "/api/articles/obsidian-vault?" + q + "&manifest=1",
    zip_url: pageUrl(page) + "&format=zip",
    file_count: files.length,
    loop: {
      lint: BASE + "/api/articles/graph-lint",
      next_acts: BASE + "/api/articles/next-acts",
      link_graph: BASE + "/api/articles/graph-links",
      counts: lint ? lint.counts : null,
    },
    obsidian: {
      open_as: "folder vault",
      start_at: "index.md",
      root_files: ["index.md", "log.md", "lint.md", "next.md", "SCHEMA.md", "CLAUDE.md", "AGENTS.md", "Misc.base", "_MOC/graph.canvas"],
      ontology_folders: ["System", "Peptides", "Conditions", "Stacks", "Articles"],
      per_article: [
        "README.md",
        "claims.md",
        "sources.md",
        "voxels.md",
        "provenance.md",
        "question_graph.md",
        "constitution.md",
        "yield.md",
      ],
      sync_cli: "node scripts/obsidian_sync.mjs",
      official_cli: 'obsidian vault="miscsubjects-vault" backlinks file="README" (desktop app running)',
      query_api: BASE + "/api/v1/query?from=bpc-157&kind=claim&where=tier=human",
    },
    pull_script: "node scripts/obsidian_pull.mjs --all --out=~/miscsubjects-vault --zip",
    api: pageUrl(page),
    files,
  };
}