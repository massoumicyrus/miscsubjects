// /t/<tag> — the folder, as a page.
//
// WHY THIS EXISTS. The trail bar on every article reads Home / <tag> / <page>, and
// the middle crumb pointed at /t/<tag>, which was never a route: /t/peptide and
// /t/zzzznotatag both returned the homepage, byte for byte. A breadcrumb whose
// middle level silently lands somewhere else is worse than no breadcrumb, because it
// asserts a hierarchy the site cannot honour.
//
// It is also the level the owner asked for by name: a category is a folder of page
// folders, and it should be downloadable as one from the place that names it. Tags —
// not meta.category — are the real grouping here: 2,235 of 2,317 published articles
// carry no category, while tags cover 2,174, and listCollections() in
// object_folder.js already buckets the corpus by tag. So the page, the crumb and the
// zip all name the same set.
//
// Server-rendered, no JavaScript, machine formats alongside the HTML.

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
const u = encodeURIComponent;

const NON_ARTICLE_REGISTERS = ["audit", "source", "source_ledger"];

async function rowsForTag(env, tag) {
  const NON = NON_ARTICLE_REGISTERS.map((r) => `'${r}'`).join(",");
  const r = await env.DB.prepare(
    `SELECT slug, title, updated_at,
            COALESCE(json_extract(meta,'$.posted_at'), created_at) AS posted_at,
            SUBSTR(COALESCE(json_extract(meta,'$.subject'),
                            json_extract(meta,'$.summary'),
                            json_extract(meta,'$.description'),''),1,200) AS summary
       FROM articles
      WHERE published = 1
        AND COALESCE(json_extract(meta,'$.status'),'') != 'retracted'
        AND COALESCE(json_extract(meta,'$.register'),'standard') NOT IN (${NON})
        AND EXISTS (
          SELECT 1 FROM json_each(articles.meta,'$.tags') t
           WHERE t.type = 'text' AND LOWER(t.value) = ?
        )
      ORDER BY posted_at DESC`,
  )
    .bind(tag)
    .all();
  return r.results || [];
}

// Neighbouring tags: what else the articles in this folder are filed under. It is
// the graph one level up, and it costs one indexed pass over the same rows.
async function siblingTags(env, tag, limit = 14) {
  const r = await env.DB.prepare(
    `SELECT LOWER(t2.value) AS tag, COUNT(*) AS n
       FROM articles a, json_each(a.meta,'$.tags') t1, json_each(a.meta,'$.tags') t2
      WHERE a.published = 1
        AND t1.type = 'text' AND t2.type = 'text'
        AND LOWER(t1.value) = ? AND LOWER(t2.value) != ?
      GROUP BY tag
      ORDER BY n DESC, tag
      LIMIT ?`,
  )
    .bind(tag, tag, limit)
    .all();
  return r.results || [];
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const tag = String(params.tag || "").trim().toLowerCase();
  if (!tag) return Response.redirect("https://miscsubjects.com/content", 302);

  const rows = await rowsForTag(env, tag);
  const fmt = String(url.searchParams.get("format") || "html").toLowerCase();

  // An unknown tag is a 404 that says what to do next, never a silent homepage.
  if (!rows.length) {
    const body = {
      error: "no published articles carry this tag",
      tag,
      browse: "https://miscsubjects.com/content",
      every_folder: "https://miscsubjects.com/api/articles/bundle",
    };
    if (fmt === "json")
      return new Response(JSON.stringify(body, null, 2), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    return new Response(
      `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>No articles tagged ${esc(tag)} — miscsubjects</title>` +
        `<meta name="robots" content="noindex,follow">` +
        `<style>body{font:16px/1.6 -apple-system,'Source Sans 3',sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#111}a{color:#111}p.m{color:#777;font-size:14px}</style>` +
        `</head><body><h1>Nothing is tagged &ldquo;${esc(tag)}&rdquo;</h1>` +
        `<p class="m">No published article carries this tag. ` +
        `<a href="/content">Browse everything</a> &middot; ` +
        `<a href="/api/articles/bundle">every folder</a></p></body></html>`,
      { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  const exportMd = `/api/articles/export?tag=${u(tag)}`;
  const folderZip = `/api/articles/bundle?format=zip&collection=${u(tag)}`;
  const manifest = `/api/articles/bundle?format=manifest&collection=${u(tag)}`;

  if (fmt === "json") {
    return new Response(
      JSON.stringify(
        {
          tag,
          count: rows.length,
          downloads: { markdown: exportMd, folder_zip: folderZip, manifest },
          articles: rows.map((r) => ({
            slug: r.slug,
            title: r.title,
            url: "/a/" + r.slug,
            updated_at: r.updated_at,
            summary: r.summary || null,
          })),
        },
        null,
        2,
      ),
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      },
    );
  }

  if (fmt === "txt" || fmt === "md" || fmt === "markdown") {
    const lines = [
      `# Everything tagged ${tag}`,
      "",
      `${rows.length} published article${rows.length === 1 ? "" : "s"}.`,
      "",
      `Folder: https://miscsubjects.com${folderZip}`,
      `Markdown: https://miscsubjects.com${exportMd}`,
      "",
    ];
    for (const r of rows)
      lines.push(`- [${r.title}](https://miscsubjects.com/a/${r.slug})`);
    return new Response(lines.join("\n") + "\n", {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }

  const siblings = await siblingTags(env, tag);
  const items = rows
    .map(
      (r) =>
        `<li><a href="/a/${u(r.slug)}">${esc(r.title)}</a>` +
        (r.summary ? `<div class="s">${esc(r.summary)}</div>` : "") +
        `</li>`,
    )
    .join("\n");
  const sibs = siblings.length
    ? `<p class="m">Also filed under: ` +
      siblings
        .map(
          (s) =>
            `<a href="/t/${u(s.tag)}">${esc(s.tag)}</a> <span class="n">${s.n}</span>`,
        )
        .join(" &middot; ") +
      `</p>`
    : "";

  const crumbLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://miscsubjects.com/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: tag,
        item: "https://miscsubjects.com/t/" + u(tag),
      },
    ],
  });

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Everything tagged ${esc(tag)} — miscsubjects</title>
<meta name="description" content="${rows.length} articles tagged ${esc(tag)} on miscsubjects.com, downloadable as one folder.">
<link rel="canonical" href="https://miscsubjects.com/t/${u(tag)}">
<meta name="robots" content="index,follow">
<script type="application/ld+json">${crumbLd}</script>
<style>
body{font:16px/1.6 -apple-system,'Source Sans 3',sans-serif;max-width:820px;margin:40px auto;padding:0 20px;color:#111}
h1{font-size:26px;margin:0 0 .2rem}
a{color:#111}
p.m{color:#777;font-size:14px;margin:.4rem 0}
nav.crumb{font-size:13px;color:#777;margin:0 0 1rem;padding-bottom:.5rem;border-bottom:1px solid #e6e6e6}
nav.crumb a{color:#777;text-decoration:none}nav.crumb a:hover{color:#111}
nav.crumb .sep{color:#ccc;margin:0 .35rem}
nav.crumb .cur{color:#111}
.dl{border:1px solid #e6e6e6;border-radius:6px;padding:.7rem .9rem;margin:1rem 0;font-size:14px}
.dl b{display:block;font-weight:600;margin-bottom:.25rem;font-size:13px}
.dl a{margin-right:.9rem;color:#444}
ol{padding-left:1.4rem}
li{margin:10px 0}
.s{color:#777;font-size:13.5px;line-height:1.5}
.n{color:#bbb;font-size:11px}
</style>
</head><body>
<nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">/</span><span class="cur">${esc(tag)}</span></nav>
<h1>Everything tagged ${esc(tag)}</h1>
<p class="m">${rows.length} published article${rows.length === 1 ? "" : "s"} &middot; newest first &middot; server-rendered</p>
<div class="dl">
  <b>Take this folder</b>
  <a href="${esc(folderZip)}">folder (.zip)</a>
  <a href="${esc(exportMd)}">markdown</a>
  <a href="${esc(manifest)}">manifest</a>
  <a href="/t/${u(tag)}?format=json">json</a>
  <a href="/api/articles/bundle?format=zip">the whole site</a>
</div>
${sibs}
<ol>
${items}
</ol>
<p class="m">Every article here carries its own folder, its history, and this folder, from the trail at the top of its page.</p>
</body></html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-articles-in-tag": String(rows.length),
    },
  });
}
