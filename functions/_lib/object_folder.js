// OBJECT FOLDER — the atomic object is the folder, not the page.
// One link, one identity, many representations, downloadable as one folder.
// A URL resolves to a bundle of typed representations sharing one canonical id,
// version, and hash lineage. Humans read article.html/README.md; models read
// skill/SKILL.md and article.json; auditors read manifest.json and receipts/.
// Composition: page folder → collection folder of page folders → root folder
// of collection folders. Every level is readable and exportable at its level.

const textEncoder = new TextEncoder();

// ---------- CRC32 (zip integrity) ----------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++)
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(v) {
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
}
function u32(v) {
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
}
function concat(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function dosDateTime(date = new Date()) {
  const time =
    (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1);
  const day =
    (((date.getUTCFullYear() - 1980) & 0x7f) << 9) |
    ((date.getUTCMonth() + 1) << 5) |
    date.getUTCDate();
  return { time, day };
}

function localHeader(nameBytes, crc, size, at) {
  return concat([
    u32(0x04034b50),
    u16(20), // version needed
    u16(0x0800), // UTF-8 names
    u16(0), // store, no compression — representations stay byte-identical
    u16(at.time),
    u16(at.day),
    u32(crc),
    u32(size),
    u32(size),
    u16(nameBytes.length),
    u16(0),
    nameBytes,
  ]);
}

function centralRecord(entry) {
  return concat([
    u32(0x02014b50),
    u16(20),
    u16(20),
    u16(0x0800),
    u16(0),
    u16(entry.at.time),
    u16(entry.at.day),
    u32(entry.crc),
    u32(entry.size),
    u32(entry.size),
    u16(entry.nameBytes.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(entry.offset),
    entry.nameBytes,
  ]);
}

function endOfCentral(count, centralSize, centralOffset) {
  return concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(count),
    u16(count),
    u32(centralSize),
    u32(centralOffset),
    u16(0),
  ]);
}

// Build a complete zip in memory. files: [{ path, bytes|text }]
export function zipBytes(files) {
  const at = dosDateTime();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const bytes =
      file.bytes instanceof Uint8Array ? file.bytes : textEncoder.encode(String(file.text ?? ""));
    const nameBytes = textEncoder.encode(file.path);
    const crc = crc32(bytes);
    const header = localHeader(nameBytes, crc, bytes.length, at);
    chunks.push(header, bytes);
    central.push({ nameBytes, crc, size: bytes.length, offset, at });
    offset += header.length + bytes.length;
  }
  const centralParts = central.map(centralRecord);
  const centralBytes = concat(centralParts);
  return concat([...chunks, centralBytes, endOfCentral(central.length, centralBytes.length, offset)]);
}

// Stream a zip from an async iterable of { path, bytes|text }. Memory stays at
// one file plus central-directory records, so a collection or the whole site
// can ship as one folder without holding it all at once.
export function zipStream(entries) {
  const at = dosDateTime();
  const central = [];
  let offset = 0;
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const file of entries) {
          const bytes =
            file.bytes instanceof Uint8Array
              ? file.bytes
              : textEncoder.encode(String(file.text ?? ""));
          const nameBytes = textEncoder.encode(file.path);
          const crc = crc32(bytes);
          const header = localHeader(nameBytes, crc, bytes.length, at);
          controller.enqueue(header);
          controller.enqueue(bytes);
          central.push({ nameBytes, crc, size: bytes.length, offset, at });
          offset += header.length + bytes.length;
        }
        const centralBytes = concat(central.map(centralRecord));
        controller.enqueue(centralBytes);
        controller.enqueue(endOfCentral(central.length, centralBytes.length, offset));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Fetch a representation from its canonical route on this deployment. The
// folder never re-implements a representation — it collects what the routes
// already serve, so folder content and live content cannot diverge.
async function representationText(origin, route, accept) {
  try {
    const res = await fetch(new URL(route, origin), {
      headers: accept ? { accept } : undefined,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Assemble one article-object folder: [{ path, text }] plus manifest.json.
// Every file that exists on the live routes is included; nothing is invented.
export async function buildObjectFolder(env, origin, slug) {
  const s = String(slug || "").trim().toLowerCase();
  if (!s) return { error: "need slug" };
  const api = `/api/articles/${encodeURIComponent(s)}`;
  const wanted = [
    { path: "article.html", route: `/a/${encodeURIComponent(s)}` },
    { path: "README.md", route: `${api}/bundle?format=markdown` },
    { path: "article.json", route: api },
    { path: "bundle.json", route: `${api}/bundle` },
    { path: "skill/SKILL.md", route: `${api}/skill` },
    { path: "graph.json", route: `${api}/voxels` },
    { path: "sources/sources.json", route: `${api}/sources` },
    { path: "tests/conformance.json", route: `${api}/conformance` },
    { path: "schema.json", route: "/api/knowledge-action-schema" },
  ];
  const files = [];
  for (const item of wanted) {
    const text = await representationText(origin, item.route);
    if (text == null || !text.length) continue;
    // Routes that only exist for law objects fall through to the generic
    // article handler elsewhere; a conformance file must actually be one.
    if (item.path === "tests/conformance.json") {
      try {
        const parsed = JSON.parse(text);
        if (!parsed || !Array.isArray(parsed.checks)) continue;
      } catch {
        continue;
      }
    }
    files.push({ path: item.path, text, route: item.route });
  }
  if (!files.some((f) => f.path === "article.json" || f.path === "article.html"))
    return { error: "object not found: " + s };

  // article.md — the authored markdown itself, derived from the canonical JSON,
  // never a re-render.
  const articleJson = files.find((f) => f.path === "article.json");
  if (articleJson) {
    try {
      const parsed = JSON.parse(articleJson.text);
      const body = parsed?.body || parsed?.article?.body || "";
      const articleTitle = parsed?.title || parsed?.article?.title || s;
      if (body)
        files.push({
          path: "article.md",
          text: `---\nslug: ${s}\ntitle: ${String(articleTitle).replace(/\n/g, " ")}\ncanonical: https://miscsubjects.com/a/${s}\n---\n\n${body}\n`,
          route: api,
        });
    } catch {
      /* article.json unparsable — folder ships without article.md */
    }
  }

  // Hash lineage: per-file sha256 plus the chain heads the bundle already proves.
  let chain = null;
  let updatedAt = null;
  let title = s;
  const bundleFile = files.find((f) => f.path === "bundle.json");
  if (bundleFile) {
    try {
      const bundle = JSON.parse(bundleFile.text);
      title = bundle?.identity?.title || bundle?.masthead?.title || title;
      updatedAt = bundle?.identity?.updated_at || bundle?.updated_at || null;
      chain = {
        sources_chain: bundle?.chain?.sources || bundle?.source_chain || bundle?.srcVerify || null,
        provenance_chain: bundle?.chain?.provenance || bundle?.provVerify || null,
      };
    } catch {
      chain = null;
    }
  }
  const hashes = {};
  for (const file of files)
    hashes[file.path] = await sha256Hex(textEncoder.encode(file.text));

  const manifest = {
    law: "One link, one identity, many representations, downloadable as one folder.",
    id: `article:${s}`,
    slug: s,
    title,
    canonical_url: `https://miscsubjects.com/a/${s}`,
    version: { updated_at: updatedAt, generated_at: new Date().toISOString() },
    hash_lineage: { files_sha256: hashes, chains: chain },
    files: files.map((file) => ({ path: file.path, route: file.route, sha256: hashes[file.path] })),
    representations: {
      human: `/a/${s}`,
      json: api,
      markdown: `${api}?format=markdown`,
      skill: `${api}/skill`,
      graph: `${api}/voxels`,
      bundle_markdown: `${api}/bundle?format=markdown`,
      folder_zip: `${api}/bundle?format=zip`,
      folder_manifest: `${api}/bundle?format=manifest`,
    },
    composition: {
      parent_collections: `/api/articles/bundle?format=manifest`,
      note: "This folder nests: a collection folder contains this folder; the root folder contains every collection folder.",
    },
  };
  return {
    slug: s,
    manifest,
    files: [
      ...files.map(({ path, text }) => ({ path, text })),
      { path: "manifest.json", text: JSON.stringify(manifest, null, 2) },
    ],
  };
}

// LEAN folder for composition levels: built purely from the stored row (no
// subrequests), so a collection or the whole site zips inside platform limits.
// Page-level folders (buildObjectFolder) stay the full representation set;
// lean folders carry the canonical content and point to live routes for the rest.
export function leanFolderFiles(row, articleSkillMarkdown) {
  const s = row.slug;
  let meta = {};
  try {
    meta = JSON.parse(row.meta || "{}");
  } catch {
    meta = {};
  }
  const api = `/api/articles/${encodeURIComponent(s)}`;
  const manifest = {
    law: "One link, one identity, many representations, downloadable as one folder.",
    id: `article:${s}`,
    slug: s,
    title: row.title || s,
    canonical_url: `https://miscsubjects.com/a/${s}`,
    version: { updated_at: row.updated_at || null },
    lean: true,
    full_folder: `${api}/bundle?format=zip`,
    representations: {
      human: `/a/${s}`,
      json: api,
      skill: `${api}/skill`,
      graph: `${api}/voxels`,
      folder_manifest: `${api}/bundle?format=manifest`,
    },
  };
  const articleJson = {
    slug: s,
    title: row.title,
    body: row.body,
    meta,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  const files = [
    {
      path: `${s}/article.md`,
      text: `---\nslug: ${s}\ntitle: ${String(row.title || s).replace(/\n/g, " ")}\ncanonical: https://miscsubjects.com/a/${s}\n---\n\n${row.body || ""}\n`,
    },
    { path: `${s}/article.json`, text: JSON.stringify(articleJson, null, 2) },
    { path: `${s}/manifest.json`, text: JSON.stringify(manifest, null, 2) },
  ];
  if (typeof articleSkillMarkdown === "function")
    files.push({ path: `${s}/skill/SKILL.md`, text: articleSkillMarkdown(row) });
  return files;
}

// Async generator: folder-of-folders entries for a set of slugs, chunked D1 reads.
export async function* collectionEntries(env, slugs, articleSkillMarkdown, prefix = "") {
  const CHUNK = 40;
  for (let i = 0; i < slugs.length; i += CHUNK) {
    const batch = slugs.slice(i, i + CHUNK);
    const placeholders = batch.map(() => "?").join(",");
    const rows =
      (
        await env.DB.prepare(
          `SELECT slug, title, body, meta, created_at, updated_at FROM articles WHERE slug IN (${placeholders})`,
        )
          .bind(...batch)
          .all()
      ).results || [];
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    for (const slug of batch) {
      const row = bySlug.get(slug);
      if (!row) continue;
      for (const file of leanFolderFiles(row, articleSkillMarkdown))
        yield { path: prefix + file.path, text: file.text };
    }
  }
}

// THE LAWS — the site's constitution travels with the site. Pure in-process:
// each law object renders its own markdown, JSON, and skill from one identity.
export async function lawFolderEntries(prefix = "laws/") {
  const [design, writing, skill] = await Promise.all([
    import("./design_law_object.js"),
    import("./writing_law_object.js"),
    import("./skill_law_object.js"),
  ]);
  const laws = [
    {
      slug: "design-law",
      object: design.DESIGN_LAW_OBJECT,
      md: design.designLawMarkdown,
      skillMd: design.designLawSkillMarkdown,
    },
    {
      slug: "writing-law",
      object: writing.WRITING_LAW_OBJECT,
      md: writing.writingLawMarkdown,
      skillMd: writing.writingLawSkillMarkdown,
    },
    {
      slug: "skill-law",
      object: skill.SKILL_LAW_OBJECT,
      md: skill.skillLawMarkdown,
      skillMd: skill.skillLawSkillMarkdown,
    },
  ];
  const files = [];
  for (const law of laws) {
    const base = prefix + law.slug + "/";
    const manifest = {
      law: "One link, one identity, many representations, downloadable as one folder.",
      id: law.object.identity.id,
      slug: law.slug,
      title: law.object.identity.title,
      canonical_url: `https://miscsubjects.com/a/${law.slug}`,
      version: law.object.version.current,
      representations: {
        human: `/a/${law.slug}`,
        json: `/api/articles/${law.slug}`,
        skill: `/api/articles/${law.slug}/skill`,
        conformance: `/api/articles/${law.slug}/conformance`,
        folder_zip: `/api/articles/${law.slug}/bundle?format=zip`,
      },
    };
    files.push(
      { path: base + "article.md", text: typeof law.md === "function" ? law.md() : law.object.content.thesis },
      { path: base + "article.json", text: JSON.stringify(law.object, null, 2) },
      { path: base + "skill/SKILL.md", text: law.skillMd() },
      { path: base + "manifest.json", text: JSON.stringify(manifest, null, 2) },
    );
  }
  return files;
}

// THE SKILLS — every public operating skill travels with the site.
export async function skillFolderEntries(prefix = "skills/") {
  const { SKILL_REGISTRY } = await import("./skill_registry.js");
  const files = [
    {
      path: prefix + "manifest.json",
      text: JSON.stringify(
        {
          law: "One link, one identity, many representations, downloadable as one folder.",
          scope: "collection:skills",
          skills: SKILL_REGISTRY.skills.length,
          governed_by: "/a/skill-law",
        },
        null,
        2,
      ),
    },
  ];
  for (const s of SKILL_REGISTRY.skills) {
    const base = prefix + s.name + "/";
    files.push(
      { path: base + "SKILL.md", text: s.raw },
      { path: base + "skill.json", text: JSON.stringify(s, null, 2) },
      {
        path: base + "manifest.json",
        text: JSON.stringify(
          {
            id: `skill:${s.name}`,
            name: s.name,
            family: s.family,
            canonical_url: `https://miscsubjects.com/skills/${s.name}`,
            source: s.source,
            representations: {
              human: `/skills/${s.name}`,
              json: `/api/skills/${s.name}`,
              skill: `/api/skills/${s.name}/skill`,
              folder_zip: `/api/skills/${s.name}/bundle?format=zip`,
            },
          },
          null,
          2,
        ),
      },
    );
  }
  return files;
}

// THE DIRECTORY — every live capability row as a folder: its documented
// contract (article.md), its public object (article.json), and its Skill.
// Same columns the public /api/directory/<KEY> route serves; nothing extra.
export async function* directoryEntries(env, directoryRowSkillMarkdown, prefix = "directory/") {
  const rows =
    (
      await env.DB.prepare(
        "SELECT key, type, category, content, enabled FROM directory WHERE enabled <> 0 ORDER BY key",
      ).all()
    ).results || [];
  for (const row of rows) {
    const key = String(row.key || "").trim();
    if (!key) continue;
    const base = prefix + key + "/";
    const manifest = {
      law: "One link, one identity, many representations, downloadable as one folder.",
      id: `directory:${key}`,
      key,
      type: row.type,
      category: row.category || null,
      canonical_url: `https://miscsubjects.com/a/directory/${encodeURIComponent(key)}`,
      representations: {
        human: `/a/directory/${encodeURIComponent(key)}`,
        json: `/api/directory/${encodeURIComponent(key)}`,
        skill: `/api/directory/${encodeURIComponent(key)}?format=skill`,
        contract: `/api/dispatch?key=${encodeURIComponent(key)}`,
      },
    };
    yield {
      path: base + "article.md",
      text: `# ${key}\n\ntype: ${row.type || "fn"} · category: ${row.category || "uncategorized"}\n\n${row.content || ""}\n`,
    };
    yield { path: base + "article.json", text: JSON.stringify(row, null, 2) };
    if (typeof directoryRowSkillMarkdown === "function")
      yield { path: base + "skill/SKILL.md", text: directoryRowSkillMarkdown(row) };
    yield { path: base + "manifest.json", text: JSON.stringify(manifest, null, 2) };
  }
}

// Collections are the middle layer: tag → member slugs.
export async function listCollections(env) {
  const rows =
    (
      await env.DB.prepare(
        "SELECT slug, title, meta FROM articles WHERE published=1 ORDER BY slug",
      ).all()
    ).results || [];
  const collections = new Map();
  for (const row of rows) {
    let tags = [];
    try {
      const meta = JSON.parse(row.meta || "{}");
      tags = Array.isArray(meta.tags) ? meta.tags : [];
    } catch {
      tags = [];
    }
    const buckets = tags.length ? tags : ["untagged"];
    for (const tag of buckets) {
      const key = String(tag).toLowerCase();
      if (!collections.has(key)) collections.set(key, []);
      collections.get(key).push(row.slug);
    }
  }
  return { total_articles: rows.length, all_slugs: rows.map((r) => r.slug), collections };
}
