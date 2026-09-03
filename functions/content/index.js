// /content — canonical public research library under the master design law.
// Reads from the articles table (content_items is legacy and empty).
import {
  governanceHeader,
  governanceFooter,
  governanceChromeStyles,
} from "../_lib/governance_chrome.js";

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function json(s) {
  try {
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function excerpt(row) {
  const raw =
    row.mech ||
    row.mechanism ||
    row.tissue ||
    row.condition ||
    row.descr ||
    row.summ ||
    "";
  return String(raw).slice(0, 180) || "Evidence record and relationship map.";
}

function hasTag(row, tag) {
  // tags arrive as a JSON string from json_extract; parse only that small field.
  let tags = [];
  try {
    tags = row.tags ? JSON.parse(row.tags) : [];
  } catch {
    tags = [];
  }
  return Array.isArray(tags) && tags.includes(tag);
}

function familyFor(slug, title) {
  // what-are-peptides-<condition> → title-case condition
  const m = String(slug || "").match(/^what-are-peptides-(.+)$/);
  if (m) {
    return String(m[1])
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return title || "General";
}

export async function onRequestGet(context) {
  try {
    return await renderLibrary(context);
  } catch (e) {
    // Never hard-500 the library. If the query or render throws, serve a minimal valid
    // shell (200) with a link into the site rather than a broken page.
    const shell =
      `<!doctype html><html lang="en"><head><meta charset="UTF-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Research library — miscsubjects</title>` +
      `<meta name="robots" content="noindex"><style>${governanceChromeStyles()}` +
      `main{width:min(720px,calc(100% - 40px));margin:var(--space-5) auto;font:400 var(--fs-body)/1.6 var(--font)}` +
      `h1{font:700 var(--fs-h2)/1.1 var(--font-display)}a{color:var(--ds-accent)}</style></head><body>` +
      `${governanceHeader("articles")}<main><h1>Research library</h1>` +
      `<p>The library index is refreshing. Browse everything at <a href="/governance">the homepage</a> ` +
      `or open any article directly.</p></main>${governanceFooter()}</body></html>`;
    return new Response(shell, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
}
async function renderLibrary({ env }) {
  const rows =
    (
      // Extract ONLY the small fields the library needs via SQLite json_extract — never
      // transfer or JSON.parse 2,149 full meta blobs (40–80KB each). That full scan was the
      // cold-start memory blowup → 500 and the slowness. This pulls a few short strings/row.
      // json_extract throws a hard SQL error on any row whose meta is NULL or not valid
      // JSON (7 such published rows exist), which would fail the whole query → 500. Guard it:
      // compute a valid-JSON `m` once in a subquery (bad meta → '{}'), then extract from m.
      await env.DB.prepare(
        "SELECT slug, title, created_at, " +
          "json_extract(m,'$.tags') AS tags, " +
          "json_extract(m,'$.image_key') AS image_key, " +
          "json_extract(m,'$.def_mechanism_25w') AS mech, " +
          "json_extract(m,'$.mechanism') AS mechanism, " +
          "json_extract(m,'$.tissue') AS tissue, " +
          "json_extract(m,'$.condition') AS condition, " +
          "json_extract(m,'$.description') AS descr, " +
          "json_extract(m,'$.summary') AS summ " +
          "FROM (SELECT slug, title, created_at, " +
          "CASE WHEN json_valid(meta) THEN meta ELSE '{}' END AS m " +
          "FROM articles WHERE published=1 ORDER BY updated_at DESC)",
      ).all()
    ).results || [];

  const peptides = [];
  const topics = [];
  for (const row of rows) {
    const item = { ...row, excerpt: excerpt(row) };
    if (hasTag(row, "topic") || hasTag(row, "matrix")) {
      topics.push(item);
    } else if (hasTag(row, "peptide")) {
      peptides.push(item);
    }
  }

  const groups = new Map();
  for (const topic of topics) {
    const key = familyFor(topic.slug, topic.title);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(topic);
  }

  const primerCards = peptides
    .map(
      (p, i) =>
        `<a class="primer-card${p.image_key ? "" : " primer-card--text"}" href="/a/${esc(p.slug)}" data-search="${esc((p.title + " " + p.excerpt).toLowerCase())}">${p.image_key ? `<span class="primer-image" style="background-image:url('/img/${esc(p.image_key)}')"></span>` : ""}<span class="primer-copy"><small>Peptide primer</small><b>${esc(p.title)}</b><span>${esc(p.excerpt)}</span></span></a>`,
    )
    .join("");

  const groupCards = [...groups.entries()]
    .map(
      ([name, items]) =>
        `<details class="library-group" data-group="${esc(name.toLowerCase())}"><summary><span><small>Research family</small><b>${esc(name)}</b></span><em>${items.length} article${items.length === 1 ? "" : "s"}</em></summary><div class="article-grid">${items.map((t) => `<a class="article-card" href="/a/${esc(t.slug)}" data-search="${esc((t.title + " " + t.excerpt + " " + name).toLowerCase())}"><small>${esc(name)}</small><b>${esc(t.title)}</b><span>${esc(t.excerpt)}</span><i>Read article →</i></a>`).join("")}</div></details>`,
    )
    .join("");

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Research library",
    url: "https://miscsubjects.com/content",
    hasPart: [...peptides, ...topics]
      .slice(0, 200)
      .map((r) => ({
        "@type": "Article",
        name: r.title,
        url: `https://miscsubjects.com/a/${r.slug}`,
      })),
  };

  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Research library — miscsubjects</title><meta name="description" content="A searchable, relationship-first library of peptide primers, conditions, evidence reviews, and AI governance research."><link rel="canonical" href="https://miscsubjects.com/content"><script type="application/ld+json">${JSON.stringify(schema)}</script><style>
${governanceChromeStyles()}
*{box-sizing:border-box}.library{width:min(1180px,calc(100% - 40px));margin:auto;padding:var(--space-5) 0}.crumb{font:700 10px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ds-dim);margin-bottom:var(--space-3)}.crumb a{color:#000;text-decoration:underline}.library-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,1fr);gap:var(--space-4);align-items:end;padding-bottom:var(--space-5);border-bottom:1px solid var(--ds-line)}.library h1{font:700 var(--fs-display)/var(--lh-display) var(--font-display);margin:0;max-width:20ch}.library-lede{font:400 var(--fs-lead)/1.6 var(--font);color:var(--ds-soft);max-width:48rem}.library-counts{margin-top:var(--space-2);font:700 10px/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:#000}
.orientation{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:var(--space-4) 0}.orientation a{min-height:140px;display:flex;flex-direction:column;justify-content:flex-end;padding:18px;border:1px solid var(--ds-line);border-radius:14px;background:var(--ds-surface);color:var(--ds-ink);text-decoration:none}.orientation a:hover{border-color:var(--ds-accent)}.orientation small,.section-k{font:700 9px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ds-accent)}.orientation b{margin:8px 0 5px;font:700 1.5rem/1 var(--font-display);text-transform:uppercase}.orientation span{font-size:13px;line-height:1.4;color:var(--ds-dim)}
.library-tools{position:sticky;top:68px;z-index:20;display:flex;align-items:center;gap:12px;margin:0 0 var(--space-4);padding:12px;background:color-mix(in srgb, var(--ds-surface) 92%, transparent);backdrop-filter:blur(12px);border:1px solid var(--ds-line);border-radius:14px}.library-tools input{width:100%;border:0;background:transparent;color:var(--ds-ink);font:400 16px var(--font);outline:0}.library-tools span{font:700 10px/1 var(--font-mono);color:var(--ds-dim);white-space:nowrap}
.section-head{display:flex;justify-content:space-between;align-items:end;gap:20px;margin:var(--space-5) 0 var(--space-3)}.section-head h2{font:700 var(--fs-h2)/1 var(--font-display);margin:7px 0 0}.section-head p{max-width:40ch;color:var(--ds-dim)}.primer-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.primer-card{min-height:240px;display:flex;flex-direction:column;border:1px solid var(--ds-line);border-radius:16px;overflow:hidden;background:var(--ds-surface);color:var(--ds-ink);text-decoration:none}.primer-card:hover{border-color:var(--ds-accent)}.primer-image{height:128px;background-size:cover;background-position:center}.primer-card--text{border-top:3px solid var(--ds-accent)}.primer-card--text .primer-copy{justify-content:flex-start;padding:20px}.primer-copy{display:flex;flex-direction:column;gap:6px;padding:16px}.primer-copy small,.article-card small{font:700 9px/1 var(--font-mono);letter-spacing:.11em;text-transform:uppercase;color:var(--ds-accent)}.primer-copy b{font-size:18px}.primer-copy>span{font-size:13px;line-height:1.42;color:var(--ds-dim)}
.groups{display:grid;gap:10px}.library-group{border:1px solid var(--ds-line);border-radius:16px;background:var(--ds-surface);overflow:hidden}.library-group>summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px 20px}.library-group>summary::-webkit-details-marker{display:none}.library-group>summary span{display:grid;gap:6px}.library-group>summary small{font:700 9px/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ds-accent)}.library-group>summary b{font:700 1.55rem/1 var(--font-display);text-transform:uppercase}.library-group>summary em{font:400 12px var(--font-mono);font-style:normal;color:var(--ds-dim)}.library-group[open]>summary{border-bottom:1px solid var(--ds-line)}.article-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--ds-line)}.article-card{min-height:190px;display:flex;flex-direction:column;padding:20px;background:var(--ds-bg);color:var(--ds-ink);text-decoration:none}.article-card:hover{background:var(--ds-raised)}.article-card b{font-size:18px;line-height:1.2;margin:10px 0 8px}.article-card span{font-size:13px;line-height:1.45;color:var(--ds-dim)}.article-card i{margin-top:auto;padding-top:16px;font:700 11px var(--font);font-style:normal;color:var(--ds-accent)}.is-hidden{display:none!important}
@media(max-width:850px){.library-hero{grid-template-columns:1fr}.orientation,.primer-grid{grid-template-columns:1fr 1fr}.article-grid{grid-template-columns:1fr}}@media(max-width:560px){.library{width:min(100% - 28px,1180px);padding-top:var(--space-4)}.orientation,.primer-grid{grid-template-columns:1fr}.library-tools{top:0}.library h1{font-size:3.5rem}}
</style></head><body>${governanceHeader("articles")}<main class="library"><div class="crumb"><a href="/governance">Home</a> / Research library</div><section class="library-hero"><div><span class="section-k">Reader library</span><h1>Research by relationship.</h1></div><div><p class="library-lede">Choose a category, understand where you are, then move through evidence—not through a wall of links.</p><div class="library-counts">${peptides.length} primers · ${topics.length} research articles · ${groups.size} families · <a href="/api/articles/export?all=1">download the whole library (.md)</a></div></div></section><nav class="orientation" aria-label="Library categories"><a href="#peptides"><small>Category 01</small><b>Peptides</b><span>Foundational primers and mechanism records</span></a><a href="#research"><small>Category 02</small><b>Conditions</b><span>Evidence reviews organized by biological relationship</span></a><a href="/a/oip-model-governance-and-privacy"><small>Category 03</small><b>AI governance</b><span>Protocols, privacy, assurance, and model literature</span></a></nav><label class="library-tools"><input id="librarySearch" type="search" placeholder="Search titles, subjects, mechanisms…" autocomplete="off"><span id="libraryResult">${peptides.length + topics.length} records</span></label><section id="peptides"><div class="section-head"><div><span class="section-k">Category 01</span><h2>Peptide primers</h2></div><p>Begin with the object before following its relationships.</p></div><div class="primer-grid">${primerCards || '<p class="feed-note">No primers indexed.</p>'}</div></section><section id="research"><div class="section-head"><div><span class="section-k">Category 02</span><h2>Research families</h2></div><p>Expand one family at a time. Every article keeps its context.</p></div><div class="groups">${groupCards || '<p class="feed-note">No research families indexed.</p>'}</div></section></main>${governanceFooter()}<script>(function(){var q=document.getElementById('librarySearch'),out=document.getElementById('libraryResult');function run(){var s=q.value.trim().toLowerCase(),n=0;document.querySelectorAll('[data-search]').forEach(function(el){var show=!s||el.getAttribute('data-search').includes(s);el.classList.toggle('is-hidden',!show);if(show)n++});out.textContent=n+' records'}q.addEventListener('input',run)})();</script></body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // The library is the same for everyone and changes only when articles are added —
      // edge-cache it instead of re-running the 2,149-row query on every visit.
      "cache-control": "public, max-age=120, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
