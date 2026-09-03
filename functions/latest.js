// /latest — the recency feed as static server-rendered HTML (owner, 2026-07-24).
// The homepage journal loads client-side, so crawlers and LLM fetchers saw nothing.
// This page is plain anchors, newest first, no JS required. Machine variants:
// /latest?format=json and /latest?format=txt. RSS lives at /feed.xml.
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function latestRows(env, limit = 50) {
  const r = await env.DB.prepare(
    `SELECT slug, title,
            COALESCE(json_extract(meta,'$.posted_at'), created_at) AS posted_at,
            updated_at
     FROM articles
     WHERE published = 1
       AND COALESCE(json_extract(meta,'$.status'),'') != 'retracted'
       AND COALESCE(json_extract(meta,'$.home'), 1) != 0
       AND COALESCE(json_extract(meta,'$.register'),'standard') NOT IN ('audit','source','source_ledger')
       AND slug NOT LIKE 'field-%'
     ORDER BY posted_at DESC LIMIT ?`,
  )
    .bind(limit)
    .all();
  return r.results || [];
}

// THE READING FLOW. Recency is the wrong order for a body of work that argues in
// sequence: the routing article assumes the Messages API article, the comparison
// assumes the catalogue article, every Cloudflare OS page assumes the index. This
// list is the order a stranger should meet them in. Everything not named here
// follows, newest first, so the flow never dead-ends.
export const FLOW_VOLUMES = [
  {
    key: "routing",
    label: "Running a coding CLI on your own models",
    blurb:
      "Point Claude Code at models you pay Cloudflare for, and read the bill. Start here, then take the five pages it depends on.",
    slugs: [
      "claude-code-on-cloudflare-ai-gateway",
      "what-is-the-anthropic-messages-api",
      "cloudflare-ai-gateway-setup",
      "cloudflare-unified-billing",
      "workers-ai-coding-models",
      "mcp-tool-search-cost",
    ],
  },
  {
    key: "tooling",
    label: "Capabilities as data, not as tool definitions",
    blurb:
      "891 capabilities reachable by a model that is shown nine tools. What the row contains, how a call is made, and what it costs against the alternatives.",
    slugs: [
      "tooling-as-data",
      "directory-row-contract",
      "dispatch-four-step-loop",
      "tool-search-vs-catalogue-as-data",
      "mcp-as-a-projection",
    ],
  },
  {
    key: "cloudflare-os",
    label: "One application on Cloudflare, end to end",
    blurb:
      "Every binding this site runs on, what each one is for, what it costs, and where it breaks — starting with the inventory.",
    slugs: [
      "cloudflare-os",
      "cloudflare-os-d1",
      "cloudflare-os-kv",
      "cloudflare-os-r2",
      "cloudflare-os-functions",
      "cloudflare-os-workers",
      "cloudflare-os-async",
      "cloudflare-os-browser",
      "cloudflare-os-email",
      "cloudflare-os-access",
    ],
  },
];

export const FLOW_SLUGS = FLOW_VOLUMES.flatMap((v) => v.slugs);

const FLOW_POSITION = new Map(FLOW_SLUGS.map((slug, i) => [slug, i]));
const FLOW_VOLUME_OF = new Map(
  FLOW_VOLUMES.flatMap((v) => v.slugs.map((slug, i) => [slug, { key: v.key, label: v.label, index: i + 1, of: v.slugs.length }])),
);

// First sentence of the body, markdown stripped. A card that only carries a title
// makes the reader open the page to find out whether they want it.
function deckOf(body) {
  const text = String(body || "")
    .replace(/^---[\s\S]*?---/, "")
    .replace(/^#+ .*$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  const cut = text.slice(0, 400);
  const end = cut.search(/[.!?](\s|$)/);
  const sentence = end > 60 ? cut.slice(0, end + 1) : cut;
  return sentence.length > 240 ? sentence.slice(0, 237).trimEnd() + "…" : sentence;
}

// The one number the page delivers, taken from its own first stat widget. Not
// invented here: if the article carries no stat, the card carries no number.
function statOf(widgets) {
  const list = Array.isArray(widgets) ? widgets : [];
  const stat = list.find((w) => w && w.type === "stat" && w.value);
  return stat ? { value: String(stat.value), label: String(stat.label || "") } : null;
}

function shapeFlowRow(row) {
  let meta = {};
  try {
    meta = JSON.parse(row.meta || "{}");
  } catch {
    meta = {};
  }
  const volume = FLOW_VOLUME_OF.get(row.slug) || null;
  return {
    slug: row.slug,
    title: row.title || row.slug,
    url: "https://miscsubjects.com/a/" + row.slug,
    href: "/a/" + row.slug,
    hero: meta.hero || null,
    deck: deckOf(meta.description || row.body_head),
    stat: statOf(meta.widgets),
    tags: Array.isArray(meta.tags) ? meta.tags.slice(0, 3) : [],
    posted_at: row.posted_at,
    sources: Array.isArray(meta.sources) ? meta.sources.length : 0,
    claims: Array.isArray(meta.claims) ? meta.claims.length : 0,
    volume,
  };
}

// One page of the flow: the curated sequence first, then everything else by date.
export async function flowRows(env, offset = 0, limit = 12) {
  const namedCount = FLOW_SLUGS.length;
  const out = [];

  if (offset < namedCount) {
    const want = FLOW_SLUGS.slice(offset, offset + limit);
    const placeholders = want.map(() => "?").join(",");
    const r = await env.DB.prepare(
      `SELECT slug, title, meta, substr(body,1,900) AS body_head,
              COALESCE(json_extract(meta,'$.posted_at'), created_at) AS posted_at
       FROM articles
       WHERE published = 1 AND slug IN (${placeholders})`,
    )
      .bind(...want)
      .all();
    const byslug = new Map((r.results || []).map((row) => [row.slug, row]));
    for (const slug of want) {
      const row = byslug.get(slug);
      if (row) out.push(shapeFlowRow(row));
    }
  }

  if (out.length < limit) {
    const restOffset = Math.max(0, offset - namedCount);
    const restLimit = limit - out.length;
    const placeholders = FLOW_SLUGS.map(() => "?").join(",");
    const r = await env.DB.prepare(
      `SELECT slug, title, meta, substr(body,1,900) AS body_head,
              COALESCE(json_extract(meta,'$.posted_at'), created_at) AS posted_at
       FROM articles
       WHERE published = 1
         AND COALESCE(json_extract(meta,'$.status'),'') != 'retracted'
         AND COALESCE(json_extract(meta,'$.home'), 1) != 0
         AND COALESCE(json_extract(meta,'$.register'),'standard') NOT IN ('audit','source','source_ledger')
         AND slug NOT LIKE 'field-%'
         AND slug NOT IN (${placeholders})
       ORDER BY posted_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...FLOW_SLUGS, restLimit, restOffset)
      .all();
    for (const row of r.results || []) out.push(shapeFlowRow(row));
  }

  return { items: out, offset, next_offset: offset + out.length, has_more: out.length === limit };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "html";

  // The homepage feed asks here for its next page. Same order, same shaping, one source.
  if (url.searchParams.get("flow")) {
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    const limit = Math.min(24, Math.max(1, Number(url.searchParams.get("limit")) || 12));
    const page = await flowRows(env, offset, limit);
    return new Response(JSON.stringify(page, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=120",
        "access-control-allow-origin": "*",
      },
    });
  }
  const rows = await latestRows(env, Math.min(Number(url.searchParams.get("limit")) || 50, 200));

  if (format === "json") {
    return new Response(
      JSON.stringify(
        rows.map((a) => ({
          slug: a.slug,
          title: a.title,
          posted_at: a.posted_at,
          updated_at: a.updated_at,
          url: "https://miscsubjects.com/a/" + a.slug,
        })),
        null,
        2,
      ),
      { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } },
    );
  }
  if (format === "txt") {
    const body = rows
      .map((a) => `${String(a.posted_at || "").slice(0, 10)}  https://miscsubjects.com/a/${a.slug}  ${a.title}`)
      .join("\n");
    return new Response(body + "\n", {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" },
    });
  }

  // CORPUS SCALE. This page lists a page of recent items; without the total, a cold reader
  // counts the rows and concludes the library holds ~50 articles a week old. It holds
  // thousands, with a publication record going back years. State both.
  let scale = null;
  try {
    scale = await env.DB.prepare(
      `SELECT COUNT(*) AS total,
              MIN(COALESCE(json_extract(meta,'$.posted_at'), created_at)) AS first_at
       FROM articles
       WHERE published = 1
         AND COALESCE(json_extract(meta,'$.status'),'') != 'retracted'
         AND COALESCE(json_extract(meta,'$.register'),'standard') NOT IN ('audit','source','source_ledger')`,
    ).first();
  } catch {
    scale = null;
  }
  const scaleLine =
    scale && Number(scale.total)
      ? `<p class="m"><b>${Number(scale.total).toLocaleString("en-US")}</b> published articles in the library${
          scale.first_at
            ? `, earliest dated ${esc(String(scale.first_at).slice(0, 10))}`
            : ""
        }. This page lists the ${rows.length} most recent — browse the full library at <a href="/content">/content</a>.</p>`
      : "";

  const items = rows
    .map(
      (a) =>
        `<li><time datetime="${esc(a.posted_at)}">${esc(String(a.posted_at || "").slice(0, 10))}</time> <a href="/a/${esc(a.slug)}">${esc(a.title || a.slug)}</a></li>`,
    )
    .join("\n");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Latest articles — miscsubjects</title>
<meta name="description" content="Every article on miscsubjects.com, newest first. Server-rendered: no JavaScript required.">
<link rel="canonical" href="https://miscsubjects.com/latest">
<link rel="alternate" type="application/rss+xml" title="miscsubjects — latest articles" href="/feed.xml">
<meta name="robots" content="index,follow">
<style>body{font:16px/1.6 -apple-system,'Source Sans 3',sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#111}h1{font-size:26px}li{margin:6px 0}time{font:13px ui-monospace,monospace;color:#777;margin-right:10px}a{color:#111}p.m{color:#777;font-size:14px}</style>
</head><body>
<h1>Latest articles</h1>
<p class="m">Newest first · server-rendered · machine formats: <a href="/latest?format=json">JSON</a> · <a href="/latest?format=txt">plain text</a> · <a href="/feed.xml">RSS</a></p>
${scaleLine}
<ol>
${items}
</ol>
</body></html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
