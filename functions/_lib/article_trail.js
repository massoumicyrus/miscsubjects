// The trail bar: where you are, and the folder you can take away from here.
//
// WHY IT EXISTS. Every download this renders already worked before 2026-08-06 —
// article .md, article folder .zip, tag folder .zip, whole-site folder .zip. All
// of it was reachable only by knowing the URL, or by three plain-text links in
// the article footer below the sources. A capability nobody can find is
// indistinguishable from one that was never built, which is why the owner asked
// twice for downloads that already existed.
//
// TAXONOMY. The middle crumb is the article's primary tag, not meta.category:
// 2,235 of 2,317 published articles have no category, and the handful that do
// disagree with themselves ("Governance" and "governance", "system" and
// "systems"). Tags cover 2,174 of 2,317, and listCollections() in
// object_folder.js already buckets the corpus by tag — so the tag IS the folder,
// and the breadcrumb names the same thing the download hands you.
//
// No JavaScript. The menu is <details>, so it works with scripting off and
// cannot break the reading surface.

function esc(s) {
  return String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
const u = encodeURIComponent;

// The primary tag is the first tag as authored. Author order is meaningful — the
// writer put the subject first — so this does not re-sort it.
export function primaryTag(meta) {
  const tags = Array.isArray(meta?.tags) ? meta.tags : [];
  const first = tags.find((t) => String(t || "").trim());
  return first ? String(first).toLowerCase() : null;
}

// One row per scope. Each names the scope, then every representation of it, so
// the same gesture works at article, tag and site level — the folder-of-folders
// the owner described.
function scopeRow(label, note, links) {
  return (
    `<div class="trail-scope"><div class="trail-scope-head">${esc(label)}` +
    (note ? `<span class="trail-scope-note">${esc(note)}</span>` : "") +
    `</div><div class="trail-scope-links">` +
    links.map((l) => `<a href="${esc(l.href)}">${esc(l.text)}</a>`).join("") +
    `</div></div>`
  );
}

export function renderTrail(slug, title, meta, opts = {}) {
  const tag = primaryTag(meta);
  const crumbs = [
    { name: "Home", href: "/" },
    ...(tag ? [{ name: tag, href: "/t/" + u(tag) }] : []),
    { name: title || slug, href: "/a/" + u(slug), current: true },
  ];

  const trail = crumbs
    .map((c) =>
      c.current
        ? `<span class="trail-current" aria-current="page">${esc(c.name)}</span>`
        : `<a href="${esc(c.href)}">${esc(c.name)}</a>`,
    )
    .join('<span class="trail-sep" aria-hidden="true">/</span>');

  const rows = [
    scopeRow("This article", title || slug, [
      { text: "markdown", href: `/api/articles/export?slug=${u(slug)}` },
      { text: "json", href: `/api/articles/${u(slug)}` },
      { text: "folder (.zip)", href: `/api/articles/${u(slug)}/bundle?format=zip` },
      { text: "skill", href: `/api/articles/${u(slug)}/skill` },
    ]),
    scopeRow("Its history", "every revision of this page", [
      { text: "last 1", href: `/api/articles/${u(slug)}/revisions?limit=1&format=md` },
      { text: "last 10", href: `/api/articles/${u(slug)}/revisions?limit=10&format=md` },
      { text: "last 100", href: `/api/articles/${u(slug)}/revisions?limit=100&format=md` },
      { text: "all (json)", href: `/api/articles/${u(slug)}/revisions` },
    ]),
    ...(tag
      ? [
          scopeRow(`Everything tagged ${tag}`, "a folder of page folders", [
            { text: "markdown", href: `/api/articles/export?tag=${u(tag)}` },
            {
              text: "folder (.zip)",
              href: `/api/articles/bundle?format=zip&collection=${u(tag)}`,
            },
            { text: "browse", href: `/t/${u(tag)}` },
          ]),
        ]
      : []),
    scopeRow("The whole site", "a folder of folders", [
      { text: "markdown", href: "/api/articles/export?all=1" },
      { text: "folder (.zip)", href: "/api/articles/bundle?format=zip" },
      { text: "obsidian vault", href: "/api/articles/obsidian-vault" },
      { text: "link graph", href: "/api/articles/graph-links" },
    ]),
  ];

  return (
    `<nav class="trail" aria-label="Breadcrumb">` +
    `<div class="trail-path">${trail}</div>` +
    `<details class="trail-export"><summary>Download<span aria-hidden="true"> ▾</span></summary>` +
    `<div class="trail-menu">${rows.join("")}` +
    `<div class="trail-foot">Every level is a folder: a page, a tag, the site. ` +
    `Unzip the site folder and it opens as an Obsidian vault.</div>` +
    `</div></details></nav>`
  );
}

// What points here. Read from article_links by index, so this costs one indexed
// lookup rather than a corpus scan.
export function renderBacklinks(rows, opts = {}) {
  if (!Array.isArray(rows) || !rows.length) return "";
  const items = rows
    .slice(0, opts.limit || 24)
    .map(
      (r) =>
        `<li><a href="/a/${u(r.slug)}">${esc(r.title || r.slug)}</a>` +
        (r.kind === "wikilink" ? '<span class="bl-kind">wikilink</span>' : "") +
        `</li>`,
    )
    .join("");
  return (
    `<section class="backlinks" id="backlinks">` +
    `<h2>What links here</h2>` +
    `<p class="bl-note">${rows.length} page${rows.length === 1 ? "" : "s"} on this site point at this one. ` +
    `These are edges in the corpus graph, not a recommendation feed.</p>` +
    `<ul class="bl-list">${items}</ul>` +
    `</section>`
  );
}

export function trailStyles(ink, line, accent, soft) {
  return `
.trail{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;
  margin:0 0 1.25rem;padding:.5rem 0;border-bottom:1px solid ${line};font-size:.82rem}
.trail-path{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;min-width:0}
.trail-path a{color:${soft};text-decoration:none;border-bottom:1px solid transparent}
.trail-path a:hover{color:${accent};border-bottom-color:${accent}}
.trail-sep{color:${line}}
.trail-current{color:${ink};font-weight:500;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;max-width:min(46ch,60vw)}
.trail-export{position:relative;flex:0 0 auto}
.trail-export summary{cursor:pointer;list-style:none;color:${soft};padding:.2rem .55rem;
  border:1px solid ${line};border-radius:4px;white-space:nowrap}
.trail-export summary::-webkit-details-marker{display:none}
.trail-export summary:hover{color:${accent};border-color:${accent}}
.trail-export[open] summary{color:${ink};border-color:${accent}}
.trail-menu{position:absolute;right:0;top:calc(100% + .35rem);z-index:40;min-width:19rem;
  max-width:min(24rem,90vw);background:var(--bg,#fff);border:1px solid ${line};border-radius:6px;
  padding:.6rem .75rem;box-shadow:0 6px 28px rgba(0,0,0,.13)}
.trail-scope{padding:.4rem 0;border-bottom:1px solid ${line}}
.trail-scope:last-of-type{border-bottom:0}
.trail-scope-head{color:${ink};font-weight:500;font-size:.8rem;display:flex;gap:.4rem;
  align-items:baseline;flex-wrap:wrap}
.trail-scope-note{color:${soft};font-weight:400;font-size:.72rem;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;max-width:22ch}
.trail-scope-links{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.25rem}
.trail-scope-links a{color:${soft};text-decoration:none;font-size:.76rem;
  border-bottom:1px solid ${line}}
.trail-scope-links a:hover{color:${accent};border-bottom-color:${accent}}
.trail-foot{color:${soft};font-size:.7rem;line-height:1.45;padding-top:.5rem}
.backlinks{margin:2rem 0 0;padding-top:1.1rem;border-top:1px solid ${line}}
.backlinks h2{font-size:1rem;margin:0 0 .3rem;color:${ink}}
.bl-note{color:${soft};font-size:.78rem;margin:0 0 .6rem;line-height:1.5}
.bl-list{list-style:none;padding:0;margin:0;display:grid;
  grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:.3rem .9rem}
.bl-list li{font-size:.84rem;display:flex;gap:.4rem;align-items:baseline}
.bl-list a{color:${soft};text-decoration:none;border-bottom:1px solid transparent}
.bl-list a:hover{color:${accent};border-bottom-color:${accent}}
.bl-kind{color:${line};font-size:.66rem;text-transform:uppercase;letter-spacing:.04em}
@media(max-width:640px){.trail-menu{position:static;min-width:0;max-width:none;margin-top:.4rem}}
`;
}
