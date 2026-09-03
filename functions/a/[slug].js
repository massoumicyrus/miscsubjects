// Public article page — editorial styling. Flat { slug, title, body } + optional
// hero, images[], style{ theme,font,measure,accent }, and widgets[] (a JSON series of
// in-article widgets: imessage | whatsapp | wikipedia | site_embed | quote | note | stat | gallery).
// ?frag=1 returns ONLY the <article> markup (used by the infinite-scroll loader).

import { renderWidgets, renderWidget } from "../_lib/widgets.js";
import { renderProvenWorkWidget } from "../_lib/proven_work_widget.js";
// EVERY ARTICLE CARRIES THE THREAD (owner order 2026-08-05). Not a manifest field, not a feature
// on the pages that happened to get one — a section rendered by the article renderer itself, so a
// page cannot exist on this site without it. scripts/check-article-ledger.mjs proves that live.
import { renderLedgerThread, listComments, sha256Hex } from "../_lib/article_ledger.js";
import { renderWorkspacePanel } from "../_lib/workspace_widget.js";
import { socialStyles } from "../_lib/widgets/social.js";
import { redactPublicSecrets } from "../_lib/public_secret_guard.js";
import { isPrivateEvent, scrubOwnerPII } from "../_lib/owner_privacy.js";
import { llmStyles } from "../_lib/widgets/llm.js";
import { sourceStyles } from "../_lib/widgets/source.js";
import {
  renderPlatformRail,
  renderWidgetSwiper,
  platformRailCss,
} from "../_lib/widgets/rail-platform.js";
import { renderCodeBlock, oipWidgetStyles } from "../_lib/widgets/oip.js";
import { trailStyles } from "../_lib/article_trail.js";
import { buildOipVoxelGraph } from "../_lib/oip_articles.js";
import { FLOW_VOLUMES } from "../latest.js";
import {
  loadArticleTopology,
  suggestedPrompts,
  rankClaims,
} from "../_lib/article_topology.js";
import {
  composeReaderBody,
  bodyNeedsReaderProse,
} from "../_lib/article_prose.js";
import {
  classifyArticleMode,
  shouldPreferStoredBody,
} from "../_lib/article_editorial.js";
import { evidenceInventory } from "../_lib/explanation_framework.js";
import {
  stackPeptidesForArticle,
  peptideEmbedJson,
  matchConditionProfile,
} from "../_lib/condition_framework.js";
import { buildInlineEmbedMap } from "../_lib/article_widgets.js";
import { renderObjectRows, renderObjectCard, renderActionSurface, renderAssetCard, objectWidgetStyles } from "../_lib/object_widgets.js";

// [[object:rows:tenant:t_x]] | [[object:card:lead:9101]] | [[object:actions]] | [[object:asset:<id>]]
// Each marker becomes one live projection over the leads/charges/assets/directory tables.
async function buildObjectEmbedMap(env, body) {
  const map = {};
  const re = /\[\[object:([^\]]+)\]\]/g;
  let m;
  while ((m = re.exec(String(body || ""))) !== null) {
    const spec = m[1];
    const key = "object:" + spec;
    if (map[key]) continue;
    try {
      if (spec.startsWith("rows:")) map[key] = await renderObjectRows(env, spec.slice(5));
      else if (spec.startsWith("card:lead:")) map[key] = await renderObjectCard(env, spec.slice(10), { publicView: true });
      else if (spec === "actions") map[key] = await renderActionSurface(env);
      else if (spec.startsWith("asset:")) map[key] = await renderAssetCard(env, spec.slice(6));
      // LIVE METRIC (2026-07-30). A number that can drift from its own receipt must never be
      // typed into prose. [[object:metric:grounding]] renders the corpus figures FROM the
      // endpoint at page-render time, so the page and its cited receipt cannot disagree.
      else if (spec === "metric:grounding") {
        const r = await fetch("https://miscsubjects.com/api/metrics/grounding", { headers: { accept: "application/json" } });
        const g = await r.json();
        const pct = (Number(g.claims_with_sources_fraction || 0) * 100).toFixed(1);
        map[key] =
          '<div class="live-metric"><div class="lm-head">Computed from the endpoint when this page rendered' +
          '<a class="lm-src" href="/api/metrics/grounding">/api/metrics/grounding</a></div>' +
          '<div class="lm-grid">' +
          '<span><b>' + Number(g.articles || 0).toLocaleString("en-US") + '</b>articles</span>' +
          '<span><b>' + Number(g.claims_total || 0).toLocaleString("en-US") + '</b>atomised claims</span>' +
          '<span><b>' + Number(g.sources_total || 0).toLocaleString("en-US") + '</b>hash-chained sources</span>' +
          '<span><b>' + pct + '%</b>of claims carry an openable source</span>' +
          '<span><b>' + Number(g.sources_per_claim || 0).toFixed(3) + '</b>sources per claim, floor ' + Number(g.floor || 0) + '</span>' +
          '</div><div class="lm-foot">computed_at ' + String(g.computed_at || "").replace(/[<>]/g, "") +
          ' · the fraction tests that a claim carries a non-empty source_ids array; it does not test that the source supports the claim</div></div>';
      }
    } catch (e) {
      map[key] = '<div class="ow-empty">object embed failed at render: ' + String((e && e.message) || e).replace(/</g, "&lt;") + "</div>";
    }
  }
  return map;
}
import { askPasteBlock, selfMarkdown } from "../_lib/self_explain.js";
import {
  buildOipArticle,
  isOipArticleSlug,
  shelfFor,
} from "../_lib/oip_articles.js";
import {
  buildSeoHead,
  buildRelatedArticles,
  renderRelatedRail,
  buildLatestArticles,
  renderLatestRail,
  relatedRailStyles,
} from "../_lib/article_seo.js";
import {
  buildArticleGraphContext,
  forwardMapLabel,
} from "../_lib/graph_explorer.js";
import {
  renderArticleGraphWidget,
  graphWidgetStyles,
} from "../_lib/graph_widget.js";
import {
  governanceHeader,
  governanceFooter,
  governanceChromeStyles,
  structureReaderHtml,
} from "../_lib/governance_chrome.js";
import { COLORS, FONTS, LEADING } from "../_lib/design/tokens/core.js";
import { getActiveProfile, cssVarOverride } from "../_lib/design/tokens/runtime.js";

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

function renderOntologyNavigator(graph) {
  if (!graph?.nodes?.length) return "";
  const groups = new Map();
  for (const node of graph.nodes) {
    const kind = String(node.kind || "concept").replace(/_/g, " ");
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(node);
  }
  const families = [...groups.entries()]
    .map(
      ([kind, nodes]) =>
        `<details class="ontology-family"><summary><b>${escapeHtml(kind)}</b><span>${nodes.length}</span></summary><div>${nodes.map((node) => (node.url ? `<a href="${escapeHtml(node.url)}"><b>${escapeHtml(node.label || node.id)}</b><small>${escapeHtml(node.id)}</small></a>` : `<span class="ontology-node"><b>${escapeHtml(node.label || node.id)}</b><small>${escapeHtml(node.id)}</small></span>`)).join("")}</div></details>`,
    )
    .join("");
  return `<details class="ontology-nav"><summary><span><small>Protocol relationships</small><b>Explore the OIP ontology</b></span><em>${graph.nodes.length} objects · ${groups.size} families</em></summary><div class="ontology-body"><p>Choose one family. Relationships unfold only when you ask for them.</p><div class="ontology-families">${families}</div><a class="ontology-machine machine-link" href="/api/articles/oip/voxels">Ontology registry · raw JSON</a></div></details>`;
}
function parseMeta(m) {
  try {
    return JSON.parse(m || "{}") || {};
  } catch {
    return {};
  }
}
function unescapeAttr(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
function safeMarkdownUrl(raw, opts = {}) {
  const s = unescapeAttr(raw).trim();
  if (!s || /[\u0000-\u001f\u007f\s]/.test(s)) return "#";
  if (s.startsWith("/") && !s.startsWith("//")) return escapeHtml(s);
  if (s.startsWith("#")) return escapeHtml(s);
  try {
    const u = new URL(s, "https://miscsubjects.com");
    const allowed = opts.image
      ? new Set(["http:", "https:"])
      : new Set(["http:", "https:", "mailto:", "tel:"]);
    return allowed.has(u.protocol) ? escapeHtml(s) : "#";
  } catch {
    return "#";
  }
}

async function buildNavDropdown(env) {
  try {
    const rows =
      (
        await env.DB.prepare(
          "SELECT slug, title, meta FROM articles WHERE published=1 ORDER BY updated_at DESC",
        ).all()
      ).results || [];

    const peptides = [];
    const topicsByPeptide = {};
    for (const r of rows) {
      const m = parseMeta(r.meta);
      const tags = Array.isArray(m.tags) ? m.tags : [];
      const isTopic = tags.includes("topic") || tags.includes("matrix");
      const isPeptide = tags.includes("peptide");
      if (isTopic) {
        const lead =
          (m.peptides && m.peptides[0]) ||
          peptideFromSlug(r.slug) ||
          "General";
        (topicsByPeptide[lead] = topicsByPeptide[lead] || []).push(r);
      } else if (isPeptide) {
        peptides.push(r);
      }
    }

    const order = [
      "BPC-157",
      "TB-500",
      "ARA-290",
      "Semax",
      "Selank",
      "PT-141",
      "DSIP",
      "KPV",
      "GHK-Cu",
      "Thymosin Alpha-1",
      "General",
    ];
    const sortedPeptides = peptides.sort((a, b) => {
      const ia = order.indexOf(a.title),
        ib = order.indexOf(b.title);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    const peptideLinks = sortedPeptides
      .map((p) => {
        const topics = topicsByPeptide[p.title] || [];
        const topicLinks = topics
          .slice(0, 3)
          .map(
            (t) =>
              `<li><a href="/a/${escapeHtml(t.slug)}">${escapeHtml(t.title)}</a></li>`,
          )
          .join("");
        const more =
          topics.length > 3
            ? `<li class="dd-more"><a href="/content#${escapeHtml(p.slug)}">+ ${topics.length - 3} more</a></li>`
            : "";
        return `<div class="dd-pep-group"><div class="dd-pep-name">${escapeHtml(p.title)}</div><ul>${topicLinks}${more}</ul></div>`;
      })
      .join("");
    const oipRows =
      (
        await env.DB.prepare(
          "SELECT slug, title FROM articles WHERE slug LIKE 'oip-%' OR slug = 'oip' OR slug = 'protocol' ORDER BY slug",
        ).all()
      ).results || [];
    const oipLinks = oipRows
      .map(
        (r) =>
          `<li><a href="/a/${escapeHtml(r.slug)}">${escapeHtml(r.title)}</a></li>`,
      )
      .join("");
    return `<div class="nav-dropdown-menu">
      <div class="nav-dropdown-cols">
        <div class="nav-dropdown-col">
          <h3>Peptide Research</h3>
          <div class="dd-pep-list">${peptideLinks}</div>
        </div>
        <div class="nav-dropdown-col">
          <h3>Protocol Docs</h3>
          <ul>${oipLinks}</ul>
        </div>
      </div>
    </div>`;
  } catch (e) {
    return "";
  }
}

function peptideFromSlug(slug) {
  // what-are-peptides-<condition> has no lead peptide; return null so it lands in General.
  if (/^what-are-peptides-/.test(slug)) return null;
  const map = {
    "bpc-157": "BPC-157",
    "tb-500": "TB-500",
    "ara-290": "ARA-290",
    semax: "Semax",
    selank: "Selank",
    "pt-141": "PT-141",
    dsip: "DSIP",
    kpv: "KPV",
    "ghk-cu": "GHK-Cu",
    "thymosin-alpha-1": "Thymosin Alpha-1",
  };
  for (const [prefix, name] of Object.entries(map)) {
    if (slug === prefix || slug.startsWith(prefix + "-")) return name;
  }
  return null;
}

function publicHeaderHtml(slug, dropdownHtml) {
  const oipActive = isOipArticleSlug(slug);
  return governanceHeader(oipActive ? "literature" : "articles");
}

function embedWidget(slug, embedMap) {
  const e = embedMap[slug];
  if (!e)
    return `<div class="embed embed-missing">embedded article <code>${escapeHtml(slug)}</code> not found</div>`;
  return (
    `<aside class="embed"><div class="embed-kicker">Embedded · ${escapeHtml(slug)}</div>` +
    `<h3 class="embed-title"><a href="/a/${escapeHtml(slug)}">${escapeHtml(e.title)}</a></h3>` +
    `<div class="embed-body">${escapeHtml(e.excerpt)}</div>` +
    `<a class="embed-more" href="/a/${escapeHtml(slug)}">Read the full ${escapeHtml(e.title)} article →</a></aside>`
  );
}

function stackEmbedWidget(slug, stackMap) {
  const e = stackMap[slug];
  if (!e) {
    return `<details class="peptide-embed-json"><summary><code>${escapeHtml(slug)}</code> — not in database</summary></details>`;
  }
  const json = JSON.stringify(e.json, null, 2);
  const layer = e.json.regenerative_layer || "peptide";
  return (
    `<details class="peptide-embed-json" data-peptide="${escapeHtml(slug)}">` +
    `<summary><strong>${escapeHtml(e.title)}</strong> · <span class="pe-layer">${escapeHtml(layer)}</span> · <code>${escapeHtml(slug)}</code></summary>` +
    `<pre class="peptide-json">${escapeHtml(json)}</pre>` +
    (e.excerpt
      ? `<p class="peptide-embed-excerpt">${escapeHtml(e.excerpt)}</p>`
      : "") +
    `<a class="embed-more" href="/a/${escapeHtml(slug)}">Full ${escapeHtml(slug)} article →</a>` +
    `</details>`
  );
}

// Obsidian-style wikilinks typed in prose: [[slug]] / [[slug|label]] → /a/slug anchors.
// The slug charset has no colon, so the reserved block grammars ([[embed:...]],
// [[object:...]], [[stack-embed:...]], [[graph]]) never match here.
const WIKILINK_RE = /\[\[([a-z0-9][a-z0-9_-]{1,80})(?:\|([^\]\n]{1,160}))?\]\]/gi;

function collectWikilinkSlugs(text) {
  const out = new Set();
  const re = new RegExp(WIKILINK_RE.source, "gi");
  let m;
  while ((m = re.exec(String(text || "")))) {
    const t = m[1].toLowerCase();
    if (t !== "graph") out.add(t);
  }
  return [...out];
}

async function buildWikiMap(env, text) {
  const slugs = collectWikilinkSlugs(text);
  const map = {};
  for (let i = 0; i < slugs.length; i += 50) {
    const batch = slugs.slice(i, i + 50);
    const rows = await env.DB.prepare(
      `SELECT slug, title FROM articles WHERE slug IN (${batch.map(() => "?").join(",")})`,
    )
      .bind(...batch)
      .all();
    for (const r of rows.results || []) map[r.slug] = r.title;
  }
  return map;
}

function render(s, embedMap, stackMap, sourceEmbedMap, wikiMap) {
  if (!s) return "";
  embedMap = embedMap || {};
  stackMap = stackMap || {};
  sourceEmbedMap = sourceEmbedMap || {};
  wikiMap = wikiMap || {};
  const lines = String(s).split("\n");
  let out = "",
    inUl = false,
    inOl = false,
    inBq = false,
    bq = [];
  let inCode = false,
    codeLang = "",
    code = [];
  let table = [];
  const para = [];
  const flush = () => {
    if (para.length) {
      out += "<p>" + inline(para.join(" ")) + "</p>";
      para.length = 0;
    }
  };
  const flushBq = () => {
    if (bq.length) {
      out +=
        '<blockquote class="anecdote-quote">' +
        bq.map((l) => inline(l)).join("<br>") +
        "</blockquote>";
      bq = [];
      inBq = false;
    }
  };
  const closeLists = () => {
    if (inUl) {
      out += "</ul>";
      inUl = false;
    }
    if (inOl) {
      out += "</ol>";
      inOl = false;
    }
  };
  function inline(t) {
    const s = escapeHtml(t)
      .replace(
        /!\[(.*?)\]\((.*?)\)/g,
        (m, alt, url) =>
          `</p><figure><img src="${safeMarkdownUrl(url, { image: true })}" alt="${escapeHtml(alt)}" loading="lazy">${alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : ""}</figure><p>`,
      )
      .replace(
        /\[(.+?)\]\((.+?)\)/g,
        (m, text, url) =>
          `<a href="${safeMarkdownUrl(url)}" rel="nofollow noopener noreferrer">${text}</a>`,
      )
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
    // Wikilinks resolve last and never inside <code> spans — a backticked
    // [[example]] is documentation of the grammar, not a link.
    return s
      .split(/(<code>[\s\S]*?<\/code>)/g)
      .map((seg) =>
        seg.startsWith("<code>")
          ? seg
          : seg.replace(WIKILINK_RE, (m0, target, label) => {
              const key = target.toLowerCase();
              if (key === "graph") return m0;
              const title = wikiMap[key];
              const text = label || (title ? escapeHtml(title) : target);
              return title === undefined
                ? `<span class="wl-unresolved" title="No page yet — this link is a recorded gap">${text}</span>`
                : `<a class="wikilink" href="/a/${key}">${text}</a>`;
            }),
      )
      .join("");
  }
  const flushTable = () => {
    if (!table.length) return;
    const rows = table.map((line) =>
      line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim()),
    );
    const clean = rows.filter(
      (row) => !row.every((c) => /^:?-{3,}:?$/.test(c)),
    );
    if (clean.length) {
      const head = clean[0],
        body = clean.slice(1);
      out +=
        '<div class="reader-table-wrap"><table class="reader-table"><thead><tr>' +
        head.map((c) => "<th>" + inline(c) + "</th>").join("") +
        "</tr></thead><tbody>" +
        body
          .map(
            (row) =>
              "<tr>" +
              head
                .map((_, i) => "<td>" + inline(row[i] || "") + "</td>")
                .join("") +
              "</tr>",
          )
          .join("") +
        "</tbody></table></div>";
    }
    table = [];
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    // Fenced code blocks — rendered as code jewels (mac bar + copy + JSON tint + fold).
    const fence = line.match(/^```\s*([a-zA-Z0-9_-]*)\s*$/);
    if (fence) {
      if (!inCode) {
        flush();
        flushBq();
        closeLists();
        inCode = true;
        codeLang = fence[1] || "";
        code = [];
      } else {
        out += renderCodeBlock(code.join("\n"), codeLang);
        inCode = false;
        codeLang = "";
        code = [];
      }
      continue;
    }
    if (inCode) {
      code.push(raw);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      flushBq();
      closeLists();
      table.push(line);
      continue;
    }
    flushTable();
    if (!line.trim()) {
      flush();
      flushBq();
      closeLists();
      continue;
    }
    const srcEmb = line.match(/^\[\[embed:source:([^\]]+)\]\]\s*$/i);
    if (srcEmb) {
      flush();
      flushBq();
      closeLists();
      const card = sourceEmbedMap[srcEmb[1]];
      if (card) out += card;
      continue;
    }
    const objEmb = line.match(/^\[\[object:([^\]]+)\]\]\s*$/i);
    if (objEmb) {
      flush();
      flushBq();
      closeLists();
      const w = sourceEmbedMap["object:" + objEmb[1]];
      if (w) out += w;
      continue;
    }
    const stackEmb = line.match(/^\[\[stack-embed:([a-z0-9-]+)\]\]\s*$/i);
    if (stackEmb) {
      flush();
      flushBq();
      closeLists();
      out += stackEmbedWidget(stackEmb[1].toLowerCase(), stackMap);
      continue;
    }
    const emb = line.match(/^\[\[embed:([a-z0-9-]+)\]\]\s*$/i);
    if (emb) {
      flush();
      flushBq();
      closeLists();
      out += embedWidget(emb[1].toLowerCase(), embedMap);
      continue;
    }
    if (/^\[\[graph\]\]\s*$/i.test(line)) {
      flush();
      flushBq();
      closeLists();
      out += "<!--GRAPH_WIDGET-->";
      continue;
    }
    if (/^!\[.*\]\(.*\)\s*$/.test(line)) {
      flush();
      flushBq();
      closeLists();
      out += inline(line)
        .replace(/^<\/p>/, "")
        .replace(/<p>$/, "");
      continue;
    }
    if (/^###\s+/.test(line)) {
      flush();
      flushBq();
      closeLists();
      out += "<h3>" + inline(line.replace(/^###\s+/, "")) + "</h3>";
      continue;
    }
    if (/^#{2,3}\s+/.test(line)) {
      flush();
      flushBq();
      closeLists();
      out += "<h2>" + inline(line.replace(/^#{2,3}\s+/, "")) + "</h2>";
      continue;
    }
    if (/^>\s?/.test(line)) {
      flush();
      closeLists();
      inBq = true;
      bq.push(line.replace(/^>\s?/, ""));
      continue;
    }
    if (inBq) flushBq();
    if (/^#\s+/.test(line)) {
      flush();
      closeLists();
      out += "<h2>" + inline(line.replace(/^#\s+/, "")) + "</h2>";
      continue;
    }
    if (/^[-•]\s+/.test(line)) {
      flush();
      flushBq();
      if (!inUl) {
        closeLists();
        out += "<ul>";
        inUl = true;
      }
      out += "<li>" + inline(line.replace(/^[-•]\s+/, "")) + "</li>";
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flush();
      flushBq();
      if (!inOl) {
        closeLists();
        out += "<ol>";
        inOl = true;
      }
      out += "<li>" + inline(line.replace(/^\d+\.\s+/, "")) + "</li>";
      continue;
    }
    closeLists();
    para.push(line);
  }
  flush();
  flushBq();
  closeLists();
  flushTable();
  if (inCode && code.length) out += renderCodeBlock(code.join("\n"), codeLang);
  return out.replace(/<p><\/p>/g, "");
}

// ── Widgets: a JSON series stored on meta.widgets. Each {type, ...}. ──────────────
async function buildEmbedMap(env, body, metaEmbeds) {
  const slugs = new Set();
  const re = /\[\[embed:([a-z0-9-]+)\]\]/gi;
  let m;
  while ((m = re.exec(String(body || ""))) !== null)
    slugs.add(m[1].toLowerCase());
  for (const s of Array.isArray(metaEmbeds) ? metaEmbeds : [])
    slugs.add(String(s).toLowerCase());
  const map = {};
  for (const s of slugs) {
    const row = await env.DB.prepare(
      "SELECT slug, title, body FROM articles WHERE slug=?",
    )
      .bind(s)
      .first();
    if (row) {
      const text = String(row.body || "")
        .replace(/[#*`>]/g, "")
        .replace(/\[\[embed:[a-z0-9-]+\]\]/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      map[s] = {
        title: row.title,
        excerpt: text.slice(0, 360) + (text.length > 360 ? "…" : ""),
      };
    }
  }
  return map;
}

async function buildPeptideStackMap(env, stackSlugs) {
  const map = {};
  for (const s of stackSlugs || []) {
    const row = await env.DB.prepare(
      "SELECT slug, title, body, meta FROM articles WHERE slug=?",
    )
      .bind(s)
      .first();
    if (!row) continue;
    const pm = parseMeta(row.meta);
    const inv = evidenceInventory(pm.sources || [], pm.claims || []);
    const text = String(row.body || "")
      .replace(/[#*`>]/g, "")
      .replace(/\[\[embed:[a-z0-9-]+\]\]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    map[s] = {
      title: row.title,
      excerpt: text.slice(0, 320) + (text.length > 320 ? "…" : ""),
      json: peptideEmbedJson(s, inv),
    };
  }
  return map;
}

// ── Claims + source ledger: the reader-facing chain-of-truth. ──────────────────
function tierBadge(t) {
  const c =
    {
      human: "#1a8f4a",
      preclinical: "#b8860b",
      anecdotal: "#9a6a00",
      mechanistic: "#6a5acd",
      speculative: "#b5453b",
    }[t] || "#888";
  return `<span class="tierb" style="--tb:${c}">${escapeHtml(t || "?")}</span>`;
}
// Epistemic standing — WHAT KIND of standing a claim has (demarcation), orthogonal to
// the medical tier. Rendered as a distinct pill so a documented fact and a crowd
// assertion read, at a glance, as different kinds of thing. ↓ marks a demoted entailment.
function standingBadge(c) {
  const s = c && c.standing;
  if (!s) return "";
  const color = {
    adjudicated: "#0e6e60",
    documentary: "#2f6f9f",
    testimonial: "#7a6a2f",
    entailed: "#6a5acd",
    consistent_unproven: "#9a6a00",
    asserted_at_volume: "#a05a2c",
    debunked: "#b5453b",
  }[s] || "#888";
  const label = String(s).replace(/_/g, " ");
  const demoted = c.standing_demoted_from
    ? ` title="demoted from ${escapeHtml(c.standing_demoted_from)} — a hidden-premise challenge broke the entailment"`
    : ` title="epistemic standing"`;
  const mark = c.standing_demoted_from ? "↓ " : "";
  return `<span class="standb" style="--sb:${color}"${demoted}>${mark}${escapeHtml(label)}</span>`;
}
// Evidence widgets (the gem): each source rendered as a typed, hashed, attractive card —
// a Reddit comment next to a PubMed study next to a Yelp review, each visually distinct.
const EV = {
  pubmed: { label: "PubMed", cls: "study", mark: "PM" },
  clinical_trial: { label: "Clinical Trial", cls: "study", mark: "CT" },
  review: { label: "Review", cls: "study", mark: "RV" },
  medical: { label: "Medical", cls: "study", mark: "Rx" },
  reddit: { label: "Reddit", cls: "reddit", mark: "r/" },
  x: { label: "X", cls: "x", mark: "𝕏" },
  instagram: { label: "Instagram", cls: "insta", mark: "IG" },
  youtube: { label: "YouTube", cls: "yt", mark: "▶" },
  news: { label: "News", cls: "news", mark: "§" },
  business: { label: "Business", cls: "biz", mark: "★" },
  anecdotal: { label: "Anecdotal", cls: "anec", mark: "“" },
  docs: { label: "Documentation", cls: "other", mark: "{}" },
  repo: { label: "Repository", cls: "other", mark: "<>" },
  other: { label: "Source", cls: "other", mark: "•" },
};
function evBadge(s) {
  const dead = /^(dead|timeout|invalid|http_)/.test(
    String(s.link_status || ""),
  );
  if (dead) return `<span class="ev-b ev-dead">link unverified</span>`;
  if (
    s.quote_status === "verified" ||
    (s.link_status === "ok" && s.quote_status !== "unverified")
  )
    return `<span class="ev-b ev-ok">verified</span>`;
  if (s.quote_status === "unverified")
    return `<span class="ev-b ev-warn">quote unverified</span>`;
  if (s.link_status === "unchecked")
    return `<span class="ev-b ev-unk">unchecked</span>`;
  return "";
}
// ╔════════════════════════════════════════════════════════════════════════════════╗
// ║ ⛔️🚨🔴 PROTECTED FEATURE — OWNER-LOCKED — DO NOT MODIFY 🔴🚨⛔️                    ║
// ║ The article SOURCE-LEDGER widgets (swipe deck: X/Reddit/etc, one card per swipe) ║
// ║ and the MODEL CONTRIBUTION cards (inspectable: prompt/output/model/date) below   ║
// ║ are an explicitly owner-locked feature. LLMs have overwritten this repeatedly.   ║
// ║ DO NOT mutate renderSources / renderContributions or their CSS.                  ║
// ║ Any change without a commit tagged  #widgets-approved  is blocked by local hooks. ║
// ║ Baseline + rules: PROTECTED_WIDGETS.md.                                          ║
// ╚════════════════════════════════════════════════════════════════════════════════╝
function renderSources(m, slug) {
  const sources = Array.isArray(m.sources) ? m.sources : [];
  if (!sources.length) return "";
  const head =
    m.source_head ||
    (sources[sources.length - 1] && sources[sources.length - 1].hash) ||
    "";
  return renderPlatformRail(sources, slug, head);
}
function isNoiseClaim(c) {
  const t = String(c.text || "").toLowerCase();
  if (/materialized from orphan/i.test(t)) return true;
  if (c.quote_gated && c.tier === "speculative") return true;
  const w =
    c.effective_weight != null
      ? c.effective_weight
      : c.weight != null
        ? Number(c.weight)
        : null;
  if (c.tier === "speculative" && w != null && w < 0.15) return true;
  return false;
}

function renderClaimRow(c, { compact } = {}) {
  const srcIds = Array.isArray(c.source_ids) ? c.source_ids : [];
  const srcLine = srcIds.length
    ? srcIds
        .map((id) => `<a href="#src-${escapeHtml(id)}">${escapeHtml(id)}</a>`)
        .join(", ")
    : "";
  const w =
    c.effective_weight != null
      ? c.effective_weight
      : c.weight != null
        ? Number(c.weight)
        : null;
  const wBadge =
    !compact && w != null && !Number.isNaN(w)
      ? `<span class="cl-weight" title="evidence weight">${w.toFixed(2)}</span>`
      : "";
  const st = c.status || "active";
  const stBadge =
    st !== "active"
      ? `<span class="cl-status cl-status-${escapeHtml(st)}">${escapeHtml(st)}</span>`
      : "";
  const who = c.who_claims || (c.posted_by && c.posted_by.actor);
  const whoLine =
    !compact && who ? `<div class="cl-who">${escapeHtml(who)}</div>` : "";
  const retLine = c.retraction_reason
    ? `<div class="cl-ret">retracted: ${escapeHtml(c.retraction_reason)}</div>`
    : "";
  const safetyCls =
    c.interaction_risk || c.slot === "limitations" ? " cl-safety" : "";
  const gated = c.quote_gated
    ? '<span class="cl-gated" title="quote unverified — weight capped">low confidence</span>'
    : "";
  return (
    `<div class="cl-row${st !== "active" ? " cl-inactive" : ""}${safetyCls}${compact ? " cl-compact" : ""}">` +
    `${tierBadge(c.tier)}${standingBadge(c)}${wBadge}${stBadge}${gated}<div class="cl-main">` +
    `<div class="cl-text">${escapeHtml(c.text)}</div>` +
    whoLine +
    retLine +
    (c.why_material && !compact
      ? `<div class="cl-why">${escapeHtml(c.why_material)}</div>`
      : "") +
    (srcLine ? `<div class="cl-src">sources: ${srcLine}</div>` : "") +
    `</div></div>`
  );
}

function renderSafetyBanner(ranked) {
  const seen = new Set();
  const items = [];
  for (const c of ranked) {
    if (!(c.interaction_risk || c.slot === "limitations")) continue;
    if (c.status === "retracted" || c.status === "cut") continue;
    const key = String(c.text || "")
      .slice(0, 80)
      .toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(c);
    if (items.length >= 4) break;
  }
  if (!items.length) return "";
  const rows = items.map((c) => `<li>${escapeHtml(c.text)}</li>`).join("");
  return (
    `<aside class="safety-banner" role="note">` +
    `<div class="sb-k">Safety &amp; limitations</div>` +
    `<ul class="sb-list">${rows}</ul>` +
    `</aside>`
  );
}

function isMetaFillerClaim(c) {
  const t = String(c.text || "").toLowerCase();
  if (c.tier === "system") return true;
  if (
    /catalogued in this miscsubjects ledger|sources are catalogued|claim\(s\) summarize/.test(
      t,
    )
  )
    return true;
  return false;
}

function renderLeadBlock(ranked) {
  const active = ranked.filter(
    (c) =>
      c.status !== "retracted" &&
      c.status !== "cut" &&
      !isNoiseClaim(c) &&
      !isMetaFillerClaim(c),
  );
  const pick = (slot, n) => active.filter((c) => c.slot === slot).slice(0, n);
  const what = pick("what_it_is", 1);
  const known = pick("what_is_known", 3);
  const unknown = pick("what_is_unknown", 2);
  if (!what.length && !known.length && !unknown.length) return "";
  const block = (label, items) =>
    items.length
      ? `<div class="lead-block"><div class="lead-k">${escapeHtml(label)}</div><ul class="lead-list">${items.map((c) => `<li>${escapeHtml(c.text)}</li>`).join("")}</ul></div>`
      : "";
  return `<section class="article-lead">${block("What it is", what)}${block("What is known", known)}${block("What is not known", unknown)}</section>`;
}

function renderClaims(m, slug, opts = {}) {
  const claims = Array.isArray(m.claims) ? m.claims : [];
  if (!claims.length) return "";
  const sources = Array.isArray(m.sources) ? m.sources : [];
  const ranked = rankClaims(claims, sources);
  const active = ranked.filter(
    (c) => c.status !== "retracted" && c.status !== "cut",
  );
  const primaryLimit = opts.defer ? 5 : 10;
  const primary = active.filter((c) => !isNoiseClaim(c)).slice(0, primaryLimit);
  const noise = active.filter((c) => isNoiseClaim(c));
  const rest = active.filter((c) => !isNoiseClaim(c)).slice(primaryLimit);
  const primaryRows = primary
    .map((c) => renderClaimRow(c, { compact: true }))
    .join("");
  const restRows = rest.map((c) => renderClaimRow(c)).join("");
  const noiseRows = noise.map((c) => renderClaimRow(c)).join("");
  let extra = "";
  if (rest.length) {
    extra += `<details class="claims-more"><summary>${rest.length} more ranked claim${rest.length === 1 ? "" : "s"}</summary><div class="cl-list">${restRows}</div></details>`;
  }
  if (noise.length) {
    extra += `<details class="claims-noise"><summary>Low-confidence / auto-generated <code>${noise.length}</code></summary><div class="cl-list">${noiseRows}</div></details>`;
  }
  if (opts.defer) {
    return (
      `<section class="claims claims-collapsed"><details class="claims-defer"><summary>Evidence ledger <code>${active.length}</code> · tier-ranked · <a href="/api/articles/${escapeHtml(slug)}?format=post">API</a></summary>` +
      `<div class="cl-list cl-primary">${primaryRows}</div>${extra}</details></section>`
    );
  }
  return (
    `<section class="claims">` +
    `<div class="claims-head"><h2 class="claims-title">Key evidence</h2>` +
    `<span class="claims-meta">${active.length} claims · tier-ranked · <a href="/api/articles/${escapeHtml(slug)}?format=post">API</a></span></div>` +
    `<div class="cl-list cl-primary">${primaryRows}</div>${extra}</section>`
  );
}
// Contributions: every model's original post on this article, side by side, hash-chained.
function renderContributions(m, slug) {
  const cs = Array.isArray(m.contributions) ? m.contributions : [];
  if (!cs.length) return "";
  const models = [...new Set(cs.map((c) => c.model))];
  const prov = Array.isArray(m.provenance) ? m.provenance : [];
  const provKey = {};
  prov.forEach((pp) => {
    provKey[String(pp.model) + "|" + String(pp.ts).slice(0, 16)] = pp;
  });
  const slides = cs
    .map((c) => {
      const p = c.payload || {};
      const pv =
        provKey[String(c.model) + "|" + String(c.ts).slice(0, 16)] || {};
      const date = escapeHtml(
        String(c.ts || "")
          .slice(0, 16)
          .replace("T", " "),
      );
      const out = p.title
        ? escapeHtml(p.title)
        : Array.isArray(p.added)
          ? escapeHtml(p.added.length + " source(s) added")
          : Array.isArray(p.contributions)
            ? escapeHtml(p.contributions.length + " review note(s)")
            : p.notes
              ? escapeHtml(String(p.notes).slice(0, 120))
              : escapeHtml(c.action);
      const claimsN = Array.isArray(p.claims) ? p.claims.length : 0;
      const srcN = Array.isArray(p.sources)
        ? p.sources.length
        : Array.isArray(p.added)
          ? p.added.length
          : 0;
      const promptT = pv.prompt
        ? escapeHtml(String(pv.prompt).slice(0, 1400))
        : "(default writer prompt)";
      const inputT = pv.input ? escapeHtml(String(pv.input).slice(0, 800)) : "";
      const respT =
        pv.response || c.rationale
          ? escapeHtml(String(pv.response || c.rationale).slice(0, 1400))
          : "";
      const card =
        `<div class="mcard">` +
        `<div class="mc-h"><span class="mc-model">${escapeHtml(c.model)}</span><span class="mc-role">${escapeHtml(c.role)}</span></div>` +
        `<div class="mc-meta"><span class="mc-act">${escapeHtml(c.action)}</span><span class="mc-date">${date}</span></div>` +
        `<div class="mc-out">${out}${claimsN ? ` · ${claimsN} claims` : ""}${srcN ? ` · ${srcN} sources` : ""}</div>` +
        `<details class="mc-ins"><summary>inspect — what it was prompted &amp; output</summary>` +
        `<div class="mc-lbl">prompted with</div><pre class="mc-pre">${promptT}${inputT ? `\n\ninput: ${inputT}` : ""}</pre>` +
        (respT
          ? `<div class="mc-lbl">it output</div><pre class="mc-pre">${respT}</pre>`
          : "") +
        `</details>` +
        `<div class="mc-foot"><span class="mc-hash">${escapeHtml(String(c.hash || "").slice(0, 16))}</span></div></div>`;
      return `<div class="rp-slide">${card}</div>`;
    })
    .join("");
  return (
    `<details class="contribs"><summary><span>Model review</span><b>${cs.length} contributions · ${models.length} model${models.length === 1 ? "" : "s"}</b><small>Expand the recursive review layer</small></summary>` +
    `<div class="contribs-body" data-widget-swiper>` +
    renderWidgetSwiper(slides, cs.length) +
    `<div class="machine-path">Machine verification: <code>/api/articles/${escapeHtml(slug)}/contributions</code></div></div></details>`
  );
}
// ⛔️🔴 END PROTECTED FEATURE — DO NOT MODIFY ABOVE WITHOUT #widgets-approved 🔴⛔️

function renderCopyBundle(slug, title) {
  const isOip = isOipArticleSlug(slug);
  const bundleUrl =
    "/api/articles/" + escapeHtml(slug) + "/bundle?format=markdown";
  const jsonUrl = "/api/articles/" + escapeHtml(slug) + "/bundle";
  const mapUrl = isOip
    ? "/api/dispatch?map=1&format=markdown"
    : "/api/articles/system-map?format=markdown&article=" +
      encodeURIComponent(slug);
  if (isOip) {
    return (
      `<div class="copy-bundle copy-bundle-oip" data-slug="${escapeHtml(slug)}">` +
      `<button type="button" class="copy-bundle-btn copy-bundle-tap" data-url="${bundleUrl}" title="Copies the public OIP protocol bundle">Tap & Go</button>` +
      `<button type="button" class="copy-bundle-btn copy-bundle-llm" data-url="${bundleUrl}" title="Copy the complete article bundle for an LLM">Copy for LLM</button>` +
      `<button type="button" class="copy-bundle-link" data-text="https://miscsubjects.com/a/${escapeHtml(slug)}">Copy link</button>` +
      `<span class="copy-bundle-status" aria-live="polite"></span>` +
      `<p class="copy-bundle-note">Copies the public OIP protocol bundle: article, JSON-native map, routes, receipts. No owner token.</p></div>`
    );
  }
  const selfBlurb = escapeHtml(
    "Every copy includes §SELF — what this is, proof chain, and links to every other feature. No context required.",
  );
  return (
    `<div class="copy-bundle" data-slug="${escapeHtml(slug)}">` +
    `<button type="button" class="copy-bundle-btn" data-url="${bundleUrl}" title="§SELF + body + ledger + constitution + system map">` +
    `Copy for LLM</button>` +
    `<button type="button" class="copy-bundle-btn copy-bundle-map" data-url="${mapUrl}" title="Root index of every feature">` +
    `Copy system map</button>` +
    `<button type="button" class="copy-bundle-link" data-text="https://miscsubjects.com/a/${escapeHtml(slug)}">Copy link</button>` +
    `<span class="copy-bundle-meta"><a href="${bundleUrl}">bundle</a> · <a href="${jsonUrl}">json</a> · ` +
    `<a href="${mapUrl}">${isOip ? "OIP map" : "system map"}</a> · <a href="/api/articles/llm-manifest">manifest</a></span>` +
    `<span class="copy-bundle-status" aria-live="polite"></span>` +
    `<p class="copy-bundle-note">${selfBlurb}</p></div>`
  );
}

async function renderAskPrompts(env, slug) {
  const topo = await loadArticleTopology(env, slug, {
    user_limit: 8,
    related_limit: 4,
  });
  if (topo.error) return "";
  const prompts = suggestedPrompts(topo).slice(0, 8);
  if (!prompts.length) return "";
  const rows = prompts
    .map((p) => {
      const paste = askPasteBlock(slug, p.imessage_body || p.prompt, {
        ingest_hint: "ingest " + slug + "|q:NODE_ID|paste from Grok/GPT/Gemini",
      });
      return (
        `<div class="ask-row">` +
        `<div class="ask-prompt">${escapeHtml(p.prompt)}</div>` +
        `<div class="ask-ch">` +
        `<button type="button" class="ask-copy" data-text="${escapeHtml(paste)}">Copy for iMessage</button>` +
        `<button type="button" class="ask-copy ask-wa" data-text="${escapeHtml(paste)}">WhatsApp</button>` +
        `<span class="ask-hint">${escapeHtml(p.channel_hint || "")} · paste includes §SELF</span>` +
        `</div></div>`
      );
    })
    .join("");
  return (
    `<section class="ask-prompts"><details><summary class="ask-summary">Ask this article · ${prompts.length} suggested prompts</summary>` +
    `<div class="ev-bar"><span class="ev-bar-h"><a href="/api/articles/${escapeHtml(slug)}/topology">topology</a> · ` +
    `<a href="/api/articles/${escapeHtml(slug)}/prompts">JSON</a> · <a href="/api/articles/${escapeHtml(slug)}/question-graph">question graph</a></span></div>` +
    `<p class="ask-note">Text the build ([BUILD_PHONE]) or WhatsApp — <code>slug|question</code> creates a question node. Paste evidence with <code>ingest slug|q:NODE_ID|your paste</code>.</p>` +
    `<div class="ask-list">${rows}</div></details></section>`
  );
}

// REST + ledger for this article, shown on the page (copy-pastable; writes need x-terminal-key).
function renderRest(slug) {
  const b = "/api/articles/" + escapeHtml(slug);
  if (isOipArticleSlug(slug)) {
    return (
      `<details class="restblock"><summary>OIP REST + ledger</summary>` +
      `<div class="rb"><b>read</b>  GET <a href="/a/${escapeHtml(slug)}">/a/${escapeHtml(slug)}</a>  ·  GET <a href="${b}">${b}</a>  ·  GET <a href="${b}/bundle?format=markdown">${b}/bundle?format=markdown</a></div>` +
      `<div class="rb"><b>root tree</b>  GET <a href="/api/dispatch?map=1&format=markdown">/api/dispatch?map=1&amp;format=markdown</a></div>` +
      `<div class="rb"><b>system shelf</b>  GET /api/dispatch?map=GITHUB&amp;format=markdown  ·  human article /a/oip-system-github</div>` +
      `<div class="rb"><b>capability leaf</b>  GET /api/dispatch?key=GITHUB_LIST_ISSUES&amp;format=markdown  ·  human article /a/oip-capability-github-list-issues</div>` +
      `<div class="rb"><b>act</b>  POST /api/dispatch with owner auth or a scoped capability URL. Public docs are open; mutating action is token-bounded.</div>` +
      `<div class="rb"><b>token explain</b>  GET /api/dispatch?explain=1&amp;share=TOKEN</div>` +
      `<div class="rb"><b>receipt</b>  GET /api/dispatch?receipt=inv_ID&amp;share=TOKEN  ·  replay with POST /api/dispatch {"replay":"inv_ID"}</div>` +
      `<div class="rb"><b>ledger</b>  <a href="${b}/provenance">provenance</a> · <a href="${b}/sources">sources</a> · <a href="${b}/voxels">voxels</a> · <a href="${b}/ledger">live ledger</a></div>` +
      `</details>`
    );
  }
  return (
    `<details class="restblock"><summary>REST + ledger</summary>` +
    `<div class="rb"><b>read</b>  GET ${b}  ·  GET ${b}?format=post (the editable body)</div>` +
    `<div class="rb"><b>create/replace</b>  POST ${b}  ·  PUT ${b} (replace, keeps revision)  ·  PATCH ${b} (merge)</div>` +
    `<div class="rb"><b>delete</b>  DELETE ${b}</div>` +
    `<div class="rb"><b>writes need header</b>  x-terminal-key</div>` +
    `<div class="rb"><b>ledger</b>  <a href="${b}/provenance">provenance</a> · <a href="${b}/sources">sources</a> · <a href="${b}/contributions">contributions</a> · <a href="${b}/revisions">revisions</a> · <a href="${b}/ledger">live ledger &amp; cards</a></div>` +
    `<div class="rb"><b>LLM bundle</b>  GET <a href="${b}/bundle?format=markdown">${b}/bundle?format=markdown</a> — body + claims + sources + provenance + manifest</div>` +
    `<div class="rb"><b>voxel graph</b>  GET <a href="${b}/voxels">${b}/voxels</a> · <a href="/api/articles/constitution">constitution</a> · <a href="/api/articles/ontology">ontology</a></div>` +
    `<div class="rb"><b>post claim</b>  POST /api/protocol/claim  ·  iMessage <code>claim ${escapeHtml(slug)}|tier|assertion</code></div>` +
    (slug === "protocol"
      ? ""
      : `<div class="rb"><b>system map</b>  GET <a href="/api/articles/system-map?format=markdown">/api/articles/system-map?format=markdown</a> — root index; every widget self-explains via §SELF / _self</div>`) +
    `</details>`
  );
}

function renderSelfExplain(slug, opts = {}) {
  const open = "";
  const isOip = isOipArticleSlug(slug);
  if (isOip) {
    // THE PAGE IS THE MACHINE OBJECT. For Total Structure voxels the full traversal JSON is
    // embedded IN-BAND — a model reading this page holds the walkable shelf immediately,
    // with no second fetch. (Owner order 2026-07-03: the page itself must be traversable.)
    let shelfBlock = "";
    let scrollScript = "";
    try {
      const shelf = shelfFor(slug);
      if (shelf) {
        shelfBlock =
          "\n\n**TRAVERSAL — this JSON is the shelf; walk `next` until null:**\n" +
          "```json\n" +
          JSON.stringify(shelf, null, 1) +
          "\n```\n" +
          "\n**Previous:** " +
          (shelf.prev
            ? "https://miscsubjects.com/a/" + shelf.prev.slug
            : "(none — this is the root)") +
          "\n**Next:** " +
          (shelf.next
            ? "https://miscsubjects.com/a/" + shelf.next.slug
            : "(none — end of the structure)") +
          "\n**Root:** https://miscsubjects.com/a/" +
          shelf.root.slug +
          "\n**The drop (hand this to any model):** https://miscsubjects.com/api/articles/oip-total-structure/drop" +
          "\n\n**PROSECUTION — raise objections by Book X surface (S1-S8, see /a/oip-falsification):**" +
          "\nPOST https://miscsubjects.com/api/articles/" +
          slug +
          '/objections {"objection":"...","actor":"your-model-name","surface":"S1-S8","exact_claim":"...","attack_type":"...","minimum_patch":"..."} — open intake, no auth, ledgered.' +
          "\nSettled ledger (read BEFORE objecting — relitigation is detected): https://miscsubjects.com/api/articles/" +
          slug +
          "/objections" +
          "\n\n**VERBATIM LAW:** this text is the author’s exact words, prose-preserving. Recursion prosecutes it; it does not rewrite it. Amendment arrives only as an owner act under Book IX.";
        // Continuous reading (owner-authorized edit): near page bottom, the next voxel's
        // article is fetched and appended in place. Machine traversal stays shelf.next.
        if (shelf.next) {
          scrollScript =
            "<script>(function(){" +
            "var next=" +
            JSON.stringify("/a/" + shelf.next.slug) +
            ";var loading=false,done=false;" +
            'window.addEventListener("scroll",function(){' +
            "if(done||loading)return;" +
            "if(window.innerHeight+window.scrollY<document.body.offsetHeight-900)return;" +
            "loading=true;" +
            "fetch(next).then(function(r){return r.text();}).then(function(t){" +
            'var doc=new DOMParser().parseFromString(t,"text/html");' +
            'var art=doc.querySelector("article")||doc.querySelector("main");' +
            'var h=document.querySelector("article")||document.querySelector("main");' +
            'if(art&&h){var hr=document.createElement("hr");hr.style.margin="48px 0";h.appendChild(hr);' +
            'var cont=document.createElement("div");cont.innerHTML=art.innerHTML;h.appendChild(cont);' +
            'var link=document.createElement("p");link.innerHTML="<a href=\\""+next+"\\">Continue on the next voxel\\u2019s own page \\u2192</a>";h.appendChild(link);}' +
            "done=true;loading=false;}).catch(function(){done=true;loading=false;});" +
            "},{passive:true});})();</script>";
        }
      }
    } catch (e) {
      console.error("oip_self_traversal_error", slug, e?.message || e);
    }
    const blurb = [
      "## §SELF — OIP protocol specification",
      "",
      "**What this page is:** " +
        (shelfBlock
          ? "one voxel of THE TOTAL STRUCTURE — the source philosophy of the Object Invocation Protocol, machine-traversable from this page alone."
          : "the normative root specification for the Object Invocation Protocol."),
      "",
      "**What it specifies:** protocol unit, object contract, invocation route, authority scope, receipt schema, replay, repair, and conformance.",
      "",
      "**Read:** https://miscsubjects.com/a/" + slug,
      "**This page as JSON:** https://miscsubjects.com/api/articles/" + slug,
      "**Machine bundle:** https://miscsubjects.com/api/articles/" +
        slug +
        "/bundle?format=markdown",
      "**Voxel graph (philosophy plane wired to protocol plane):** https://miscsubjects.com/api/articles/oip/voxels",
      "**Live object tree:** https://miscsubjects.com/api/dispatch?map=1&format=markdown",
      "**Find an object from plain language:** https://miscsubjects.com/api/dispatch?ask=<what you want>",
      "**Read one object:** https://miscsubjects.com/api/dispatch?key=<KEY>&format=markdown",
      "",
      "**Proof rule:** an action is not proven by intent, description, or a 200. It is proven by the ledger and the OIP receipt for the invocation.",
      shelfBlock,
    ].join("\n");
    return (
      `<details class="self-explain"${open}><summary>§SELF — protocol specification · traversal JSON in-band</summary>` +
      `<pre class="self-explain-pre">${escapeHtml(blurb)}</pre>` +
      `</details>` +
      scrollScript
    );
  }
  const blurb = selfMarkdown(isOip ? "oip_article_bundle" : "human_page", {
    slug,
    contains: isOip
      ? "rendered OIP article hub, copy widgets, generated directory docs, token boundary, receipt loop"
      : "rendered article, copy widgets, claims, sources, ask prompts",
    how_to_use: isOip
      ? "Start at /a/oip, traverse to a system or capability article, then act only through scoped capability URLs or owner auth."
      : "Use Copy for LLM or Copy system map — both paste without context.",
  });
  const mapUrl = isOip
    ? "/api/dispatch?map=1&format=markdown"
    : "/api/articles/system-map?format=markdown&article=" +
      encodeURIComponent(slug);
  return (
    `<details class="self-explain"${open}><summary>§SELF — this page explains the system</summary>` +
    `<pre class="self-explain-pre">${escapeHtml(blurb)}</pre>` +
    (isOip
      ? ""
      : `<button type="button" class="copy-bundle-link self-explain-copy" data-url="${mapUrl}">Copy system map</button>`) +
    `</details>`
  );
}

// Live ledger + cards for this content: every inbound/outbound payload related to this slug.
async function renderLiveLedger(env, slug) {
  if (!env.LEDGER) return "";
  try {
    const like = "%" + slug + "%";
    // OWNER PRIVACY BAR: exclude the owner's private CLI turns (his keystrokes, cwd, name, session)
    // in SQL, then again at egress, then scrub any owner PII from what remains.
    const rows = await env.LEDGER.prepare(
      `SELECT id, ts, source, key, actor, action, direction, status, trace_id, step, request_preview, response_preview
       FROM events
       WHERE (key LIKE ? OR actor LIKE ? OR action LIKE ? OR request_preview LIKE ? OR response_preview LIKE ?)
         AND source NOT IN ('claude-code','cli-claude','claude-cli','codex','codex-cli','grok-cli','kimi','kimi-cli','gemini-cli','openhands','aider','goose','plandex')
         AND action NOT IN ('turn_in','turn_out','turn_complete')
         AND key NOT LIKE 'CLI\\_%' ESCAPE '\\'
         AND COALESCE(route,'') != '/api/agent_log'
       ORDER BY ts DESC LIMIT 50`,
    )
      .bind(like, like, like, like, like)
      .all();
    const events = (rows.results || []).filter((e) => !isPrivateEvent(e)).map((e) => scrubOwnerPII(e));
    if (!events.length) return "";
    const traces = new Set();
    for (const e of events) if (e.trace_id) traces.add(e.trace_id);
    const recent = events
      .slice(0, 6)
      .map(
        (e) =>
          `<div class="pv-row"><span class="pv-act">${escapeHtml(e.key || e.action || "event")}</span> <span class="pv-mod">${escapeHtml(e.source)}${e.status != null ? " · HTTP " + e.status : ""}</span> · ${escapeHtml(
            String(e.ts || "")
              .slice(0, 16)
              .replace("T", " "),
          )}${e.trace_id ? ' · <a href="/api/ledger?card=' + encodeURIComponent(e.trace_id) + '">' + escapeHtml(e.trace_id) + "</a>" : ""}</div>`,
      )
      .join("");
    return (
      `<div class="prov"><div class="prov-head">Live ledger · ${events.length} payload${events.length === 1 ? "" : "s"} · ${traces.size} turn${traces.size === 1 ? "" : "s"}</div>` +
      `<details><summary>recent activity · inspect</summary>${recent}<a class="prov-verify" href="/api/articles/${escapeHtml(slug)}/ledger">view full ledger &amp; cards →</a></details></div>`
    );
  } catch {
    return "";
  }
}

function renderSystemToolbar(copyBundle, selfBlock) {
  return (
    `<section class="system-toolbar" aria-label="Copy and system explanation">` +
    copyBundle +
    selfBlock +
    `</section>`
  );
}

function renderDevPanel(blocks, dev) {
  const open = dev ? " open" : "";
  return `<details class="dev-panel"${open}><summary>Ledger API &amp; provenance</summary>${blocks.join("")}</details>`;
}

// Human-readable byline date ("Jul 24, 2026") from a YYYY-MM-DD slice.
const BY_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtByDate(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ""));
  if (!m) return String(ymd || "");
  return `${BY_MONTHS[+m[2] - 1] || m[2]} ${+m[3]}, ${m[1]}`;
}
function readMinutes(body) {
  const words = String(body || "").split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

// ON-PAGE SHARE ROW (owner order 2026-08-06): every article carries visible share targets on
// the page itself — server-rendered anchors, one per network, no SDK and no script loaded, so
// nothing phones home before the reader chooses to share. Pinterest receives the hero as the
// pin image when the article has one (a pin without an image is dead on arrival there). The
// floating widget stays for copy-link / copy-for-LLM; this row is the always-visible surface,
// and it lives inside the <article> so continuous-scroll fragments each carry their own.
function renderShareRow(slug, title, hero) {
  const u = `https://miscsubjects.com/a/${encodeURIComponent(slug)}`;
  const eu = encodeURIComponent(u);
  const et = encodeURIComponent(String(title || slug));
  const targets = [
    ["X", `https://x.com/intent/post?text=${et}&url=${eu}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${eu}`],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${eu}`],
    ["Reddit", `https://www.reddit.com/submit?url=${eu}&title=${et}`],
    ["Hacker News", `https://news.ycombinator.com/submitlink?u=${eu}&t=${et}`],
    ["Pinterest", `https://www.pinterest.com/pin/create/button/?url=${eu}${hero ? `&media=${encodeURIComponent(String(hero))}` : ""}&description=${et}`],
    ["WhatsApp", `https://wa.me/?text=${et}%20${eu}`],
    ["Telegram", `https://t.me/share/url?url=${eu}&text=${et}`],
    ["Email", `mailto:?subject=${et}&body=${et}%0A%0A${eu}`],
  ];
  const links = targets
    .map(([label, href]) =>
      `<a href="${escapeHtml(href)}"${href.startsWith("mailto:") ? "" : ' target="_blank" rel="noopener noreferrer"'}>${escapeHtml(label)}</a>`)
    .join("");
  return (
    `<div class="ms-sharerow" aria-label="Share this article">` +
    `<span class="ms-sharerow-k">Share</span>${links}` +
    `<button type="button" class="ms-sharerow-copy" data-share-url="${escapeHtml(u)}">Copy link</button>` +
    `</div>`
  );
}

// Build the inner <article> for one row (shared by the full page and ?frag=1).
async function buildPost(env, a, opts = {}) {
  const dev = opts.dev === true;
  const m = parseMeta(a.meta);
  const isOipPage = isOipArticleSlug(a.slug);
  const embedMap = await buildEmbedMap(env, a.body, m.embeds);
  const claims = Array.isArray(m.claims) ? m.claims : [];
  const sources = Array.isArray(m.sources) ? m.sources : [];
  const ranked = rankClaims(claims, sources);
  const hero = m.hero
    ? `<figure class="hero"><img src="${escapeHtml(m.hero)}" alt="${escapeHtml(a.title)}" loading="eager"></figure>`
    : "";
  const gallery =
    Array.isArray(m.images) && m.images.length
      ? m.images
          .filter((im) => (typeof im === "string" ? im : im.url))
          .map(
            (im) =>
              `<figure><img src="${escapeHtml(im.url || im)}" alt="${escapeHtml(im.alt || "")}" loading="lazy">${im.caption ? `<figcaption>${escapeHtml(im.caption)}</figcaption>` : ""}</figure>`,
          )
          .join("\n")
      : "";
  const tags = "";
  const posted = String(m.posted_at || a.created_at || "").slice(0, 10);
  const updated = String(a.updated_at || "").slice(0, 10);
  const revn = Array.isArray(m.revisions) ? m.revisions.length : 0;
  const revNote = revn
    ? ` · <a class="prov-verify" style="text-transform:none;letter-spacing:0" href="/api/articles/${escapeHtml(a.slug)}/revisions">${revn} prior revision${revn === 1 ? "" : "s"}</a>`
    : "";
  const sig = m.model ? ` · ${escapeHtml(String(m.model))}` : "";
  const led = m.ledger
    ? `<div class="ledger-note">tokens ${escapeHtml(String((m.ledger.tokens_in || 0) + (m.ledger.tokens_out || 0)))} · cost $${escapeHtml(String(m.ledger.cost ?? 0))}${m.ledger.model ? " · " + escapeHtml(String(m.ledger.model)) : ""}</div>`
    : "";
  // Provenance: energy/logic disclosure + verifiable hash chain of every model write/edit.
  let prov = "";
  const pl = Array.isArray(m.provenance) ? m.provenance : [];
  if (pl.length) {
    let ti = 0,
      to = 0,
      cost = 0;
    const models = new Set();
    for (const e of pl) {
      ti += +(e.tokens_in || 0);
      to += +(e.tokens_out || 0);
      cost += +(e.cost || 0);
      if (e.model) models.add(e.model);
    }
    const head = pl[pl.length - 1].hash || "";
    const rows = pl
      .map(
        (e, i) =>
          `<div class="pv-row"><span class="pv-act">${escapeHtml(e.action)}</span> <span class="pv-mod">${escapeHtml(e.model)}</span> · ${escapeHtml(
            String(e.ts || "")
              .slice(0, 16)
              .replace("T", " "),
          )} · ${+(e.tokens_in || 0) + +(e.tokens_out || 0) > 0 ? +(e.tokens_in || 0) + +(e.tokens_out || 0) + " tok" : "tokens unrecorded"} · <code>${escapeHtml(String(e.hash || "").slice(0, 12))}</code></div>`,
      )
      .join("");
    prov =
      `<div class="prov"><div class="prov-head">Provenance · ${pl.length} model pass${pl.length === 1 ? "" : "es"} · ${ti + to > 0 ? `${ti + to} tokens · $${Math.round(cost * 1e6) / 1e6}` : "tokens/cost unrecorded"} · ${models.size} model${models.size === 1 ? "" : "s"}</div>` +
      `<details><summary>chain head <code>${escapeHtml(head.slice(0, 16))}</code></summary>${rows}<a class="prov-verify" href="/api/articles/${escapeHtml(a.slug)}/provenance">verify chain →</a></details></div>`;
  }
  const liveLedger = await renderLiveLedger(env, a.slug);
  const askBlock = isOipPage ? "" : await renderAskPrompts(env, a.slug);
  const copyBundle = renderCopyBundle(a.slug, a.title);
  const selfBlock = renderSelfExplain(a.slug, { alwaysOpen: false });
  const systemToolbar =
    a.slug === "protocol" ? "" : renderSystemToolbar(copyBundle, selfBlock);
  const conditionProfile = matchConditionProfile(a.slug, a.title);
  const stackSlugs = stackPeptidesForArticle(a.slug, a.title, m.embeds);
  const peptideInvMap = {};
  for (const ps of stackSlugs) {
    const row = await env.DB.prepare("SELECT meta FROM articles WHERE slug=?")
      .bind(ps)
      .first();
    if (row) {
      const pm = parseMeta(row.meta);
      peptideInvMap[ps] = evidenceInventory(pm.sources || [], pm.claims || []);
    }
  }
  const stackMap = await buildPeptideStackMap(env, stackSlugs);
  const sourceEmbedMap = buildInlineEmbedMap(sources, a.slug);
  // Object projections ([[object:...]] embeds) run their queries here, per request, so the
  // widgets read the live tables at page load rather than a baked snapshot.
  Object.assign(sourceEmbedMap, await buildObjectEmbedMap(env, a.body));
  const articleMode = isOipPage
    ? "oip"
    : classifyArticleMode(a.slug, a.title, m);
  const composed = composeReaderBody({
    slug: a.slug,
    title: a.title,
    claims,
    sources,
    embeds: m.embeds,
    peptideInvMap,
    meta: m,
  });
  const wikiMap = await buildWikiMap(env, (a.body || "") + "\n" + (composed || ""));
  const renderMd = (text) => render(text, embedMap, stackMap, sourceEmbedMap, wikiMap);
  const preferStored = shouldPreferStoredBody(a.slug, a.title, m);
  const invariantMode =
    !isOipPage &&
    (articleMode === "peptide" ||
      articleMode === "condition" ||
      articleMode === "stack");
  const wrongTemplate =
    (articleMode === "system" || articleMode === "primer") &&
    /regeneration vs degeneration — where this fits/i.test(a.body || "");
  // Author opt-out of auto-composition: prefer_stored / render:"authored" renders the hand-written
  // body verbatim (hero, figures, pull-quotes, claims all still render) instead of the generic
  // slot composer. Used for flagship, designed article bodies.
  const authoredBody = m.prefer_stored === true || m.render === "authored" || m.register === "essay";
  // A hand-written body IS the article. The slot composer exists to give a page prose when the
  // stored body is a fragment — never to bury prose somebody wrote. Before this check, 448
  // peptide and condition pages held 3,000-24,000 characters of written prose that no reader ever
  // saw: the composer won on every one of them, so every one of those pages rendered the same
  // skeleton ("Regeneration vs degeneration", "What it is", "Step logic", the IF/THEN lines).
  // That is the template-skeleton defect the owner named, and it lived here, not in the bodies.
  // A body that is ITSELF the old skeleton keeps composing — preferring it would change nothing.
  const storedBody = String(a.body || "");
  const authoredProse =
    storedBody.length >= 2000 &&
    (storedBody.match(/^#{2,3}[ \t]+\S/gm) || []).length >= 2 &&
    !/regeneration vs degeneration — where this fits/i.test(storedBody);
  const useComposed =
    !isOipPage &&
    !authoredBody &&
    !authoredProse &&
    Boolean(
      composed &&
      composed.length >= 400 &&
      (invariantMode
        ? sources.length >= 1 ||
          claims.length >= 2 ||
          conditionProfile ||
          stackSlugs.length >= 1
        : wrongTemplate ||
          (!preferStored && bodyNeedsReaderProse(a.body, m, a.slug))),
    );
  const isEssay = m.register === "essay";
  // Authored prose opens on its own first line. The generic banner and lead block are furniture
  // for composed pages; stacked above an essay they reproduce the same-on-every-page opening.
  const furniture = useComposed || isOipPage || isEssay || authoredProse;
  const safety = furniture ? "" : renderSafetyBanner(ranked);
  const lead = furniture ? "" : renderLeadBlock(ranked);
  let displayBody = useComposed ? composed : a.body || "";
  // Never repeat the article title as the body's first heading — the page already shows the H1.
  // (An amateur tell seen on /governance: serif H1 then the same line again as a body heading.)
  {
    const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const toks = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 2));
    const tset = toks(a.title);
    if (tset.size >= 2) {
      const head = displayBody.slice(0, 500);
      const m = head.match(/(^|\n)\s*#{1,3}[ \t]+([^\n]+)/);
      if (m) {
        const hset = toks(m[2]);
        if (hset.size >= 2) {
          // Strip when one heading's significant words fully contain the other's — the body is
          // restating the title (tolerates extra words like "operation ...", case, punctuation).
          const subset = (a, b) => [...a].every((w) => b.has(w));
          if (subset(tset, hset) || subset(hset, tset)) {
            displayBody = displayBody.replace(m[0], m[1]);
          }
        }
      }
    }
  }
  const devPanel = renderDevPanel([prov, liveLedger, renderRest(a.slug)], dev);
  const graphCtx = await buildArticleGraphContext(env, a.slug);
  const graphWidgetHtml = graphCtx.show
    ? await renderArticleGraphWidget(env, a.slug, a.title, graphCtx)
    : "";
  const wantsGraphMarker = /\[\[graph\]\]/i.test(displayBody);
  const autoGraph =
    graphCtx.show &&
    !wantsGraphMarker &&
    articleMode !== "system" &&
    articleMode !== "primer";
  let contentHtml = render(displayBody, embedMap, stackMap, sourceEmbedMap, wikiMap);
  if (graphWidgetHtml) {
    if (wantsGraphMarker) {
      contentHtml = contentHtml
        .split("<!--GRAPH_WIDGET-->")
        .join(graphWidgetHtml);
    }
  }
  contentHtml = structureReaderHtml(contentHtml);
  const graphBlock = autoGraph ? graphWidgetHtml : "";
  const relatedLinks = await buildRelatedArticles(env, a.slug, a.title, m, {
    graphForward: graphCtx.forward,
  });
  const relatedRail = renderRelatedRail(relatedLinks, {
    mapLabel: forwardMapLabel(graphCtx),
  });
  // The ledger thread. Read from the comments table at render time and bound to the body hash, so a
  // comment written against an earlier version of this page is shown as exactly that rather than
  // silently reading as a judgment of the text now on screen.
  const ledgerThread = renderLedgerThread(
    a.slug,
    await listComments(env, a.slug, 200),
    { currentHash: await sha256Hex(a.body || "") },
  );
  const latestRail = renderLatestRail(await buildLatestArticles(env, a.slug));
  const volumeRail = await renderVolumeRail(env, a.slug);
  const register =
    m.register && m.register !== "source_ledger"
      ? ` · ${escapeHtml(String(m.register))}`
      : "";
  const kicker = isOipPage
    ? "Object Invocation Protocol · protocol specification"
    : isEssay
      ? "Essay"
      : `Evidence review${register}`;
  const articleClass = isOipPage ? "post post-oip" : "post";
  const voxBlock =
    isOipPage && (a.slug === "oip" || a.slug === "oip-spec")
      ? renderOntologyNavigator(buildOipVoxelGraph(null))
      : "";
  // Where you are, and the folder you can take away from here. Both the trail and
  // the backlinks read the materialized edge table — never a corpus scan.
  const { renderTrail, renderBacklinks } = await import("../_lib/article_trail.js");
  const trailBar = renderTrail(a.slug, a.title, m);
  let backlinksBlock = "";
  try {
    const { backlinksFor } = await import("../_lib/article_links.js");
    backlinksBlock = renderBacklinks(await backlinksFor(env, a.slug, 24));
  } catch {
    backlinksBlock = "";
  }
  return `<article class="${articleClass}" data-slug="${escapeHtml(a.slug)}">
  ${trailBar}
  ${hero}
  <header class="article-header">
    <div class="kicker">${kicker}</div>
    <h1>${escapeHtml(a.title)}</h1>
    <div class="byline"><time datetime="${escapeHtml(String(m.posted_at || a.created_at || ""))}">Posted ${escapeHtml(fmtByDate(posted))}</time>${updated && updated !== posted ? ` · <time datetime="${escapeHtml(String(a.updated_at || ""))}">Updated ${escapeHtml(fmtByDate(updated))}</time>` : ""} · ${readMinutes(a.body)} min read</div>
    ${tags}
  </header>
  <div id="ms-article-tools">${systemToolbar}</div>
  ${safety}
  ${lead}
  <div class="content reader-prose">${contentHtml}</div>
  ${renderWorkspacePanel(a.slug, m)}
  ${renderProvenWorkWidget(a.slug, m, a.title)}
  ${renderShareRow(a.slug, a.title, m.hero)}
  ${ledgerThread}
  ${voxBlock}
  ${graphBlock}
  ${Array.isArray(m.widgets) && m.widgets.length ? renderWidgets(m.widgets, renderMd) : ""}
  ${renderSources(m, a.slug)}
  ${renderClaims(m, a.slug, { defer: useComposed })}
  ${renderContributions(m, a.slug)}
  ${volumeRail}
  ${latestRail}
  ${relatedRail}
  ${backlinksBlock}
  ${askBlock}
  ${gallery}
  <footer class="article-footer">${escapeHtml(a.slug)} · posted ${escapeHtml(posted)} · updated ${escapeHtml(updated)}${revNote}${sig}${led}${devPanel}<br>
  <a href="/api/articles/export?slug=${encodeURIComponent(a.slug)}">download this article (.md)</a> ·
  <a href="/api/articles/export?all=1">download the whole library (.md)</a> ·
  <a href="/api/articles/${encodeURIComponent(a.slug)}/bundle?format=zip">object folder (.zip)</a> ·
  <a href="/skills/article-editing">how to edit or write articles here (the skill)</a><br>
  <a href="#ledger">the ledger on this page — what models said about it</a> ·
  <a href="/comment/${encodeURIComponent(a.slug)}">write a comment on this article</a> ·
  <a href="/ledger">every comment on every article</a> ·
  <a href="/a/the-model-comment-ledger">how a model comments here</a> ·
  <a href="/a/coding-law">coding law — a hash to start, a hash to commit</a><br>
  <a href="/a/the-build-end-to-end"><b>what is this build, end to end</b> — every capability, every article, every receipt</a></footer>
</article>`;
}

// VOLUME RAIL. Several articles here are chapters: each assumes the one before it.
// A reader who lands mid-volume from a search result has no way to know that, so the
// page states where it sits and what comes next. The order is the same constant the
// homepage feed reads, so the two can never disagree.
async function renderVolumeRail(env, slug) {
  for (const volume of FLOW_VOLUMES) {
    if (!volume.slugs.includes(slug)) continue;
    // Count and number against the chapters that actually exist, never against the plan.
    const rows = await env.DB.prepare(
      `SELECT slug, title FROM articles WHERE published = 1 AND slug IN (${volume.slugs.map(() => "?").join(",")})`,
    )
      .bind(...volume.slugs)
      .all();
    const titles = new Map((rows.results || []).map((r) => [r.slug, r.title]));
    const live = volume.slugs.filter((s) => titles.has(s));
    const i = live.indexOf(slug);
    if (i === -1 || live.length < 2) return "";
    const prev = i > 0 ? live[i - 1] : null;
    const next = i < live.length - 1 ? live[i + 1] : null;
    const card = (target, label) =>
      `<a class="rel-card" href="/a/${escapeHtml(target)}">` +
      `<span class="rel-reason">${escapeHtml(label)}</span>` +
      `<span class="rel-title">${escapeHtml(titles.get(target) || target)}</span>` +
      `<span class="rel-slug">${escapeHtml(target)}</span></a>`;
    return (
      `<section class="related-rail" aria-label="This volume">` +
      `<div class="related-head"><div class="related-head-main">` +
      `<h2>${escapeHtml(volume.label)}</h2>` +
      `<p class="related-sub">Part ${i + 1} of ${live.length}. Each page stands alone; read in order they build.</p>` +
      `</div><a href="/#read">The whole reading flow →</a></div>` +
      `<div class="related-grid">` +
      (prev ? card(prev, `Previous · part ${i}`) : "") +
      (next ? card(next, `Next · part ${i + 2}`) : "") +
      `</div></section>`
    );
  }
  return "";
}

async function buildUserSection(env, slug, title) {
  let entriesHtml = "";
  try {
    const rows =
      (
        await env.DB.prepare(
          "SELECT id, ts, context, text, author, hash FROM user_entries WHERE subject=? ORDER BY ts DESC LIMIT 5",
        )
          .bind(slug)
          .all()
      ).results || [];
    if (rows.length) {
      entriesHtml =
        `<div class="ue-list"><div class="ue-h">Recent experiences / questions</div>` +
        rows
          .map(
            (e) =>
              `<div class="ue-row"><div class="ue-meta">${escapeHtml(e.author || "anonymous")} · ${escapeHtml(String(e.ts || "").slice(0, 10))} · <code>${escapeHtml(String(e.hash || "").slice(0, 12))}</code></div><div class="ue-text">${escapeHtml(e.text)}</div>${e.context ? `<div class="ue-ctx">${escapeHtml(e.context)}</div>` : ""}</div>`,
          )
          .join("") +
        `</div>`;
    }
  } catch (e) {
    console.error("article_user_entries_error", slug, e?.message || e);
  }
  return `<section class="ue" data-subject="${escapeHtml(slug)}">
  <div class="ue-h">Add your experience or question</div>
  <div class="ue-presets">
    <button data-preset="I took this and it helped me…">It helped</button>
    <button data-preset="I took this and it hurt me…">It hurt</button>
    <button data-preset="I am considering this for…">Considering</button>
    <button data-preset="I just started this drug, could it harm me?">Could it harm me?</button>
  </div>
  <textarea id="ue-text" placeholder="Share your experience or ask a question about ${escapeHtml(title)}…"></textarea>
  <div class="ue-actions">
    <input id="ue-author" type="text" placeholder="Name (optional)">
    <button id="ue-submit">Post to ledger</button>
  </div>
  <div class="ue-status" id="ue-status"></div>
  ${entriesHtml}
  <div class="ue-charlie">
    <div class="ue-h">Think this article is wrong?</div>
    <a class="ue-charlie-btn" href="/audit?claim=${encodeURIComponent('The article "' + (title || slug) + '" is misleading because ')}" target="_blank">Dispute this article in Claim Audit →</a>
  </div>
</section>
<script>
(function(){
  var box=document.querySelector('.ue[data-subject="${escapeHtml(slug)}"]');
  if(!box) return;
  var ta=box.querySelector('#ue-text');
  box.querySelectorAll('.ue-presets button').forEach(function(b){ b.onclick=function(){ ta.value=b.getAttribute('data-preset')+' '; ta.focus(); }; });
  box.querySelector('#ue-submit').onclick=function(){
    var btn=this, status=box.querySelector('#ue-status');
    btn.disabled=true; status.textContent='Posting…';
    var body=JSON.stringify({subject:'${escapeHtml(slug)}', context:'article:${escapeHtml(slug)}', text:ta.value, author:box.querySelector('#ue-author').value, source_url:location.href});
    fetch('/api/user-entry',{method:'POST',headers:{'content-type':'application/json'},body:body}).then(function(r){return r.json();}).then(function(j){
      if(j.ok){ status.textContent='Posted · hash '+j.hash+' · reloading'; location.reload(); }
      else { status.textContent='Error: '+(j.error||'unknown'); btn.disabled=false; }
    }).catch(function(e){ status.textContent='Network error: '+e.message; btn.disabled=false; });
  };
})();
</script>`;
}

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const slug = String(params.slug || "").toLowerCase();
  if (!slug) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const frag = url.searchParams.get("frag");
  const dev = url.searchParams.get("dev") === "1";
  let a = await env.DB.prepare(
    "SELECT slug, title, body, meta, created_at, updated_at FROM articles WHERE slug=?",
  )
    .bind(slug)
    .first();
  if (!a && isOipArticleSlug(slug)) a = await buildOipArticle(env, slug);
  if (!a) return new Response("Article not found", { status: 404 });

  const post = await buildPost(env, a, { dev });
  if (frag)
    return new Response(redactPublicSecrets(post, env), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });

  const isOipPageRoute = isOipArticleSlug(slug);
  const routeMeta = parseMeta(a.meta);
  const userSection =
    isOipPageRoute || routeMeta.register === "essay"
      ? ""
      : await buildUserSection(env, slug, a.title);

  const m = routeMeta;
  const st = m.style || {};
  // Master design system (functions/_lib/design_system.js): readability-first
  // editorial palette, Source Sans 3 body/display, JetBrains Mono for code.
  // ONE source of truth, flippable at runtime: the ACTIVE design profile (KV, merged over the
  // core.js default). A POST to /api/design re-skins every article with no redeploy.
  const _prof = await getActiveProfile(env);
  const _c = _prof.colors;
  const accent = _c.accent;
  const measure = escapeHtml(String(st.measure || "720")) + "px";
  const font = _prof.fonts.body;
  const bg = _c.root;
  const ink = _c.ink;
  const soft = _c.soft;
  const dim = _c.dim;
  const line = _c.line;
  const card = _c.surface;
  const raised = _c.raised;
  const designVarOverride = cssVarOverride(_prof);
  const seoHead = buildSeoHead(a, m, {
    canonicalBase: "https://miscsubjects.com",
  });
  const headerHtml = publicHeaderHtml(slug, await buildNavDropdown(env));
  const fontLinkTags = Array.isArray(_prof.fontLinks)
    ? _prof.fontLinks.map((u) => `<link rel="stylesheet" href="${escapeHtml(u)}">`).join("")
    : "";
  // INTELLIGENT CONTINUATION (owner order 2026-08-03, category-level): the infinite scroll
  // continues into what THIS article is about — its own linked pages first, then its
  // category/tag family newest-first — and only then falls back to the global index.
  // Before this, every article's scroll paged the same global list regardless of subject.
  let relatedQueue = [];
  try {
    const bodyText = String(a.body || "");
    const linked = new Set();
    for (const mm of bodyText.matchAll(/\[\[(?!embed:|object:|stack-embed:|graph)([a-z0-9-]+)(?:\|[^\]]*)?\]\]/gi)) linked.add(mm[1].toLowerCase());
    for (const mm of bodyText.matchAll(/\]\(\/a\/([a-z0-9-]+)\)/gi)) linked.add(mm[1].toLowerCase());
    for (const mm of bodyText.matchAll(/https:\/\/miscsubjects\.com\/a\/([a-z0-9-]+)/gi)) linked.add(mm[1].toLowerCase());
    linked.delete(slug);
    if (linked.size) {
      const list = [...linked].slice(0, 30);
      const ph = list.map(() => "?").join(",");
      const rows = (await env.DB.prepare(
        `SELECT slug FROM articles WHERE published=1 AND slug IN (${ph})`,
      ).bind(...list).all()).results || [];
      const ok = new Set(rows.map((r) => r.slug));
      relatedQueue.push(...list.filter((s) => ok.has(s)));
    }
    const cat = typeof m.category === "string" && m.category.trim() ? m.category.trim() : null;
    const firstTag = Array.isArray(m.tags)
      ? m.tags.map(String).find((t) => !["canonical", "ongoing", "topic", "matrix"].includes(t))
      : null;
    let fam = [];
    if (cat) {
      fam = (await env.DB.prepare(
        "SELECT slug FROM articles WHERE published=1 AND json_extract(meta,'$.category')=? AND slug!=? ORDER BY updated_at DESC LIMIT 14",
      ).bind(cat, slug).all()).results || [];
    } else if (firstTag) {
      fam = (await env.DB.prepare(
        "SELECT slug FROM articles WHERE published=1 AND json_extract(meta,'$.tags') LIKE ? AND slug!=? ORDER BY updated_at DESC LIMIT 14",
      ).bind('%"' + firstTag + '"%', slug).all()).results || [];
    }
    relatedQueue.push(...fam.map((r) => r.slug));
    relatedQueue = [...new Set(relatedQueue)].filter((s) => s && s !== slug).slice(0, 24);
  } catch {
    relatedQueue = [];
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">${seoHead}${fontLinkTags}
<style>
${governanceChromeStyles()}
${designVarOverride}
${relatedRailStyles(ink, line, accent, soft)}
${trailStyles(ink, line, accent, soft)}
${graphWidgetStyles(ink, line, accent)}
:root{--measure:${measure};--accent:${accent};--accent-inverse:${bg};--line:${line};--soft:${soft};--dim:${dim};--surface:${card};--raised:${raised};--font:${font};--ink:${ink};--wt-body:400;--wt-semi:600;--fs-eyebrow:var(--fs-eye);--tracking-eyebrow:var(--track-eye)}
.wrap,.wrap *{box-sizing:border-box}.wrap *{margin:0;padding:0}
body{background:${bg};color:${ink};font:var(--wt-body) var(--fs-body)/var(--lh-body) var(--font);letter-spacing:-.006em;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.wrap{max-width:1180px;width:100%;margin:0 auto;padding:0 var(--space-4) var(--space-5)}
.post{padding-top:30px}
.article-header{margin-bottom:8px}
.system-toolbar{margin:0 0 28px;padding:0}
.system-toolbar .copy-bundle{margin:0 0 12px}
.system-toolbar .self-explain{margin:0}
.hero{margin:0 -22px 34px;position:relative}
.hero img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}
@media(min-width:760px){.hero{margin:0 0 44px;border-radius:6px;overflow:hidden;border:1px solid ${line};box-shadow:0 1px 2px rgba(28,27,23,.04),0 12px 30px -18px rgba(28,27,23,.22)}}
h1{font:700 var(--fs-display)/var(--lh-display) var(--font-display);letter-spacing:-.025em;margin:20px 0 16px;color:${ink};max-width:24ch}
.kicker{font:700 var(--fs-eyebrow)/1 var(--font);letter-spacing:var(--tracking-eyebrow);text-transform:uppercase;color:${accent};margin-bottom:18px}
.byline{margin:14px 0 0;font:400 13px/1.5 var(--font);color:${soft}}
.byline time{color:inherit}
.ms-share{position:fixed;right:18px;bottom:18px;z-index:60;font:400 13px/1.45 var(--font)}
.ms-share-btn{width:52px;height:52px;border-radius:50%;border:1px solid ${line};background:${bg};color:${ink};display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 6px rgba(28,27,23,.08),0 14px 34px -16px rgba(28,27,23,.3)}
.ms-share-btn:hover{border-color:${accent};color:${accent}}
.ms-share-btn svg{width:26px;height:26px}
.ms-share-panel{display:none;position:absolute;right:0;bottom:62px;width:min(320px,calc(100vw - 36px));background:${bg};border:1px solid ${line};border-radius:14px;padding:14px;box-shadow:0 2px 8px rgba(28,27,23,.08),0 24px 60px -24px rgba(28,27,23,.35)}
.ms-share.open .ms-share-panel{display:block}
.ms-share-k{font:700 9px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:${accent};margin-bottom:8px}
.ms-share-title{font:700 14px/1.35 var(--font);color:${ink};margin-bottom:12px}
.ms-share-row{display:grid;gap:6px}
.ms-share-row button,.ms-share-row a{display:flex;align-items:center;gap:8px;width:100%;padding:9px 11px;border:1px solid ${line};border-radius:9px;background:transparent;color:${ink};font:600 13px/1 var(--font);cursor:pointer;text-decoration:none;text-align:left}
.ms-share-row button:hover,.ms-share-row a:hover{border-color:${accent};color:${accent}}
.ms-share-nets{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}
.ms-share-nets a{display:flex;align-items:center;justify-content:center;padding:8px 10px;border:1px solid ${line};border-radius:9px;color:${ink};font:600 12px/1 var(--font);cursor:pointer;text-decoration:none}
.ms-share-nets a:hover{border-color:${accent};color:${accent}}
.ms-share-note{margin-top:10px;font:400 11px/1.5 var(--font);color:${soft}}
.ms-sharerow{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:1.4rem 0;padding:10px 12px;border:1px solid ${line};border-radius:12px}
.ms-sharerow-k{font:700 9px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:${accent};margin-right:4px}
.ms-sharerow a,.ms-sharerow-copy{padding:6px 10px;border:1px solid ${line};border-radius:8px;color:${ink};font:600 12px/1 var(--font);text-decoration:none;background:transparent;cursor:pointer}
.ms-sharerow a:hover,.ms-sharerow-copy:hover{border-color:${accent};color:${accent}}
@media(max-width:560px){.ms-share{right:12px;bottom:12px}}
.safety-banner{margin:0 0 28px;padding:18px 20px;border-radius:14px;border:1px solid #d8a0a0;background:#fff5f5}
.sb-k{font:800 13px/1.2 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.06em;text-transform:uppercase;color:#9b1c1c;margin-bottom:10px}
.sb-list{margin:0;padding-left:20px;color:#5c1010;font-size:16px;line-height:1.55}
.sb-list li{margin-bottom:8px}
.sb-list li:last-child{margin-bottom:0}
.article-lead{margin:0 0 32px;padding:20px 22px;border-radius:2px;background:${card};border:1px solid ${line}}
.lead-block+.lead-block{margin-top:16px;padding-top:16px;border-top:1px dashed ${line}}
.lead-k{font:700 11px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.1em;text-transform:uppercase;color:${accent};margin-bottom:8px}
.lead-list{margin:0;padding-left:18px;color:${soft};font-size:17px;line-height:1.55}
.lead-list li{margin-bottom:6px}
.content{font-size:var(--fs-body);line-height:var(--lh-body);color:${soft};max-width:920px}
.content p{margin:0 0 1.15em}
.content > p:first-of-type::first-letter{float:left;font-family:var(--font-display);font-size:4.6em;line-height:.78;font-weight:700;color:${accent};padding:8px 14px 0 0}
.content h2{font:700 var(--fs-h2)/var(--lh-head) var(--font-display);letter-spacing:-.015em;text-transform:none;color:${ink};margin:1.9em 0 .5em}
.content h3{font:700 var(--fs-h3)/1.3 var(--font-display);letter-spacing:-.01em;text-transform:none;color:${ink};margin:1.6em 0 .4em}
.content p{font:400 var(--fs-body)/var(--lh-body) var(--font);margin:0 0 1.15em;max-width:var(--measure-copy)}
.content strong{color:${ink};font-weight:700}
.content a{color:${accent};text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}
.content .wl-unresolved{color:color-mix(in srgb,${accent} 55%,transparent);border-bottom:1px dashed color-mix(in srgb,${accent} 45%,transparent);cursor:help}
.content ul,.content ol{margin:0 0 24px 24px}
.content li{margin-bottom:9px}
.content code{font:0.9em var(--font-mono);background:var(--surface-1);color:${ink};padding:1px 6px;border-radius:2px;border:1px solid ${line}}
.reader-table-wrap{width:min(100%,980px);overflow:auto;margin:var(--space-3) 0 var(--space-4);border:1px solid ${line};border-radius:2px;background:${card}}
.reader-table{width:100%;border-collapse:separate;border-spacing:0;font-size:14px;line-height:1.42}.reader-table th{position:sticky;top:0;padding:13px 15px;text-align:left;background:${bg};color:${ink};border-bottom:1px solid ${line};font:700 10px/1.2 var(--font-mono);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}.reader-table td{padding:13px 15px;border-top:1px solid ${line};color:${soft};vertical-align:top;min-width:110px}.reader-table tr:hover td{background:${raised};color:${ink}}
.live-metric{margin:var(--space-4) 0;border:1px solid ${line};border-radius:2px;background:${card};overflow:hidden}.lm-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:11px 16px;border-bottom:1px solid ${line};font:700 10px/1.4 var(--font-mono);letter-spacing:.11em;text-transform:uppercase;color:${dim}}.lm-src{font:700 10px var(--font-mono);color:${accent};text-decoration:none;letter-spacing:.04em;text-transform:none}.lm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:${line}}.lm-grid span{display:grid;gap:3px;padding:14px 16px;background:${card};font:400 11px/1.35 var(--font-mono);color:${dim}}.lm-grid b{font:700 21px/1 var(--font-body,inherit);color:${ink};letter-spacing:-.01em}.lm-foot{padding:10px 16px;border-top:1px solid ${line};font:400 11px/1.5 var(--font-mono);color:${dim}}@media(max-width:600px){.lm-grid{grid-template-columns:1fr 1fr}}
.ontology-nav{margin:var(--space-5) 0;border:1px solid ${line};border-radius:2px;background:${card};overflow:hidden}.ontology-nav>summary{cursor:pointer;list-style:none;padding:20px 22px;display:flex;align-items:center;justify-content:space-between;gap:20px}.ontology-nav>summary::-webkit-details-marker{display:none}.ontology-nav>summary span{display:grid;gap:5px}.ontology-nav>summary small{font:700 9px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:${accent}}.ontology-nav>summary b{font-size:18px;color:${ink}}.ontology-nav>summary em{font:400 11px/1.4 var(--font-mono);font-style:normal;color:${dim}}.ontology-body{padding:18px 20px 20px;border-top:1px solid ${line}}.ontology-body>p{margin:0 0 16px;color:${dim};font-size:14px}.ontology-families{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.ontology-family{border:1px solid ${line};border-radius:2px;background:var(--surface-1);overflow:hidden}.ontology-family>summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;padding:13px 14px;text-transform:capitalize}.ontology-family>summary::-webkit-details-marker{display:none}.ontology-family>summary span{font:700 10px var(--font-mono);color:${accent}}.ontology-family>div{padding:0 10px 10px}.ontology-family a,.ontology-node{display:grid;gap:2px;padding:9px;border-radius:2px;color:${ink};text-decoration:none}.ontology-family a:hover{background:var(--surface-2)}.ontology-family small,.ontology-node small{font:10px var(--font-mono);color:${dim}}.ontology-machine{display:inline-block;margin-top:16px;color:${accent};font:700 11px var(--font-mono)}
figure{margin:2.6em 0}
figure img{width:100%;border-radius:6px;display:block;border:1px solid ${line};box-shadow:0 1px 2px rgba(28,27,23,.04),0 10px 26px -18px rgba(28,27,23,.2)}
figcaption{font:italic 400 14px/1.55 var(--font-display);color:${dim};margin-top:12px;text-align:center;padding:0 12px}
.content blockquote,.pullquote{margin:2em 0;padding:6px 0 6px 26px;border-left:3px solid ${accent};font:italic 400 clamp(21px,2.2vw,26px)/1.42 var(--font-display);color:${ink};max-width:var(--measure-copy)}
.content blockquote p,.pullquote p{margin:0 0 .4em}
.content blockquote cite,.pullquote cite{display:block;margin-top:10px;font:600 12px/1.4 var(--font);font-style:normal;letter-spacing:.06em;text-transform:uppercase;color:${accent}}
.tags{margin:4px 0 28px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.tag{font:700 11px/1 var(--font-body);letter-spacing:.04em;text-transform:uppercase;color:${accent};border:1px solid ${line};border-radius:2px;padding:5px 10px}
.tag-more{position:relative}.tag-more summary{cursor:pointer;font:700 11px/1 var(--font);color:${dim};list-style:none;padding:7px 10px}.tag-more summary::-webkit-details-marker{display:none}.tag-more>div{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
.widgets{margin:34px 0}
.embed-inline{margin:1.5rem auto 2rem;max-width:min(540px,100%);display:flex;justify-content:center}
.embed-inline .rp-card{width:100%;max-width:540px;margin:0}
.embed-inline+.embed-inline{margin-top:.75rem}
.widget{margin:30px 0}
.wq{font:italic 400 clamp(21px,2.2vw,26px)/1.42 var(--font-display);color:${ink};border-left:3px solid ${accent};padding:6px 0 6px 24px;margin:2em 0}
.wq cite{display:block;font:600 12px/1.4 ${font};color:${accent};font-style:normal;letter-spacing:0.06em;text-transform:uppercase;margin-top:12px}
.wn{border:1px solid ${line};border-radius:6px;background:${card};padding:20px 22px;font-size:17px;line-height:1.6;color:${soft}}
.wn-t{font:700 ${"var(--fs-eyebrow,0.8125rem)"}/1 ${font};letter-spacing:0.1em;text-transform:uppercase;color:${accent};margin-bottom:10px}
.ws{text-align:left;padding:0;display:flex;align-items:baseline;gap:16px}
.ws-n{font:700 clamp(34px,5vw,52px)/1 var(--font-display);color:${accent};letter-spacing:-0.02em}
.ws-l{font:600 12px/1.4 ${font};color:${dim};text-transform:uppercase;letter-spacing:0.1em}
.wg{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.wg figure{margin:0}
@keyframes widgetPulse{0%,100%{box-shadow:0 0 0 0 rgba(0,0,0,.04)}50%{box-shadow:0 0 0 8px rgba(0,0,0,0)}}
@keyframes blinkCursor{0%,100%{opacity:1}50%{opacity:0}}
@keyframes typingBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
${
  isOipPageRoute
    ? ""
    : `
/* Messaging preview widget */
.im{display:flex;justify-content:center}
.im-phone{width:100%;max-width:390px;border:1px solid ${line};border-radius:26px;overflow:hidden;background:#12161d;box-shadow:0 1px 0 ${line}}
.im-bar{display:flex;align-items:center;gap:11px;padding:14px 16px;border-bottom:1px solid ${line};background:rgba(0,0,0,0.02)}
.im-avatar{width:34px;height:34px;border-radius:50%;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font:700 15px ui-sans-serif,system-ui,sans-serif}
.im-name{font:600 15px/1.15 ui-sans-serif,system-ui,sans-serif;color:${ink}}
.im-sub{font:400 12px/1.2 ui-sans-serif,system-ui,sans-serif;color:${dim};margin-top:2px}
.im-thread{padding:16px 14px;display:flex;flex-direction:column;gap:7px;background:#12161d}
.im-row{display:flex}
.im-row.im-me{justify-content:flex-end}
.im-row.im-them{justify-content:flex-start}
.im-bubble{max-width:75%;padding:9px 14px;border-radius:19px;font:400 16px/1.35 ui-sans-serif,system-ui,sans-serif}
.im-me .im-bubble{background:#0b84ff;color:#fff;border-bottom-right-radius:6px}
.im-them .im-bubble{background:#e9e9eb;color:#000;border-bottom-left-radius:6px}
.im-typing{min-width:56px;display:flex;align-items:center;gap:4px}
.im-dots{display:flex;gap:3px}
.im-dots span{width:6px;height:6px;border-radius:50%;background:#8e8e93;animation:typingBounce 1s ease-in-out infinite}
.im-dots span:nth-child(2){animation-delay:.15s}
.im-dots span:nth-child(3){animation-delay:.3s}
.im-cursor{width:2px;height:16px;background:#0b84ff;margin-left:4px;animation:blinkCursor 1s step-end infinite}
.im-input{padding:12px 16px 16px;border-top:1px solid ${line}}
.im-input span{display:block;border:1px solid ${line};border-radius:18px;padding:8px 14px;color:${dim};font:400 15px ui-sans-serif,system-ui,sans-serif}
.wa{display:flex;justify-content:center}
.wa-phone{width:100%;max-width:390px;border:1px solid ${line};border-radius:12px;overflow:hidden;background:#efeae2;box-shadow:0 1px 0 ${line}}
.wa-bar{display:flex;align-items:center;gap:11px;padding:12px 16px;background:#008069}
.wa-name{font:600 15px/1.15 ui-sans-serif,system-ui,sans-serif;color:#fff}
.wa-sub{font:400 12px/1.2 ui-sans-serif,system-ui,sans-serif;color:#d1e8e3;margin-top:2px}
.wa-thread{padding:16px 14px;display:flex;flex-direction:column;gap:7px;background:#efeae2}
.wa-row{display:flex}
.wa-row.wa-me{justify-content:flex-end}
.wa-row.wa-them{justify-content:flex-start}
.wa-bubble{max-width:75%;padding:8px 12px;border-radius:8px;font:400 15px/1.35 ui-sans-serif,system-ui,sans-serif;box-shadow:0 1px 1px rgba(0,0,0,.08)}
.wa-me .wa-bubble{background:#d9fdd3;color:#e8ebe6;border-bottom-right-radius:0}
.wa-them .wa-bubble{background:#12161d;color:#e8ebe6;border-bottom-left-radius:0}
.wa-time{font-size:10px;color:#667781;margin-left:8px;white-space:nowrap}
.wa-typing{min-width:54px;display:flex;align-items:center;gap:4px}
.wa-dots{display:flex;gap:3px}
.wa-dots span{width:6px;height:6px;border-radius:50%;background:#8696a0;animation:typingBounce 1s ease-in-out infinite}
.wa-dots span:nth-child(2){animation-delay:.15s}
.wa-dots span:nth-child(3){animation-delay:.3s}
.wa-cursor{width:2px;height:14px;background:#008069;margin-left:4px;animation:blinkCursor 1s step-end infinite}
.wa-input{padding:10px 14px 12px;border-top:1px solid #242b35;background:#12161d}
.wa-input span{display:block;border:1px solid #242b35;border-radius:20px;padding:8px 14px;color:#667781;font:400 15px ui-sans-serif,system-ui,sans-serif;background:#12161d}
`
}
/* Site embed widgets (Wikipedia / institutions) */
.se{margin:34px 0}
.se-card{display:block;border:1px solid ${line};border-radius:18px;background:${card};padding:22px 24px;text-decoration:none;color:inherit;transition:border-color .15s,transform .15s}
.se-card:hover{border-color:${accent};transform:translateY(-1px)}
.se-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.se-logo{width:44px;height:44px;object-fit:contain;border-radius:6px}
.se-fallback{width:44px;height:44px;border-radius:50%;background:${ink};color:var(--accent-inverse,#fff);display:flex;align-items:center;justify-content:center;font:700 13px ui-sans-serif,system-ui,sans-serif}
.se-site{font:700 14px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.06em;text-transform:uppercase;color:${soft};flex:1}
.se-title{font:800 24px/1.2 ui-sans-serif,system-ui,sans-serif;color:${ink};margin-bottom:14px}
.se-text{font:17px/1.7 ${font};color:${soft};margin-bottom:14px}
.se-text p{margin:0 0 14px}
.se-text p:last-child{margin-bottom:0}
.se-more{font-style:italic;color:${dim}}
.se-date{font:12px ui-monospace,monospace;color:${dim};margin-top:12px}
.se-infobox{font:12px ui-monospace,monospace;color:${dim};background:rgba(0,0,0,.03);padding:12px;border-radius:8px;overflow:auto;max-height:180px;margin-top:14px}
.se-copy,.se-ask{font:700 11px/1 var(--font-body);letter-spacing:.04em;text-transform:uppercase;border:1px solid ${line};border-radius:2px;padding:7px 13px;background:${card};color:${ink};cursor:pointer;transition:border-color .15s,color .15s,background .15s}
.se-copy:hover,.se-ask:hover{border-color:${accent};color:${ink};background:${raised}}
.se-copy.copied{background:${accent};color:#fff;border-color:${accent}}
.se-ask{display:inline-block;margin-top:12px}
${
  isOipPageRoute
    ? ""
    : `
/* User entry form */
.ue{margin:34px 0;border:1px solid ${line};border-radius:14px;background:${card};padding:20px 22px}
.ue-h{font:700 13px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:${accent};margin-bottom:12px}
.ue-presets{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.ue-presets button{font:700 11px var(--font-body);letter-spacing:.04em;text-transform:uppercase;border:1px solid ${line};border-radius:2px;padding:6px 12px;background:${card};color:${ink};cursor:pointer}
.ue-presets button:hover{border-color:${accent};color:${ink};background:${raised}}
.ue textarea{width:100%;min-height:90px;border:1px solid ${line};border-radius:2px;padding:12px;font:15px/1.5 ${font};color:${ink};background:${card};resize:vertical}
.ue-actions{display:flex;gap:10px;align-items:center;margin-top:12px}
.ue-actions input{flex:1;border:1px solid ${line};border-radius:8px;padding:8px 10px;font:13px ${font};color:${ink}}
.ue-actions button{border:1px solid ${accent};border-radius:2px;padding:9px 16px;background:${accent};color:${bg};font:700 12px var(--font-body);letter-spacing:.04em;text-transform:uppercase;cursor:pointer}
.ue-actions button:disabled{opacity:.5;cursor:not-allowed}
.ue-status{margin-top:10px;font:12px ui-monospace,monospace;color:${dim}}
.ue-list{margin-top:18px;padding-top:16px;border-top:1px solid ${line}}
.ue-row{padding:10px 0;border-top:1px dashed ${line}}
.ue-charlie{margin-top:18px;padding-top:16px;border-top:1px solid ${line}}
.ue-charlie-btn{display:inline-block;margin-top:10px;border:1px solid ${line};border-radius:2px;padding:8px 14px;font:700 11px var(--font-body);letter-spacing:.04em;text-transform:uppercase;background:${card};color:${ink};text-decoration:none}
.ue-charlie-btn:hover{border-color:${accent};color:${ink};background:${raised}}
.ue-row:first-child{border-top:0;padding-top:0}
.ue-meta{font:10px ui-monospace,monospace;color:${dim};margin-bottom:4px}
.ue-text{font:15px/1.5 ${font};color:${ink}}
.ue-ctx{font:12px ui-sans-serif,system-ui,sans-serif;color:${soft};margin-top:4px}
.peptide-embed-json{margin:16px 0;border:1px solid ${line};border-radius:2px;background:${card};overflow:hidden}
.peptide-embed-json summary{cursor:pointer;padding:14px 18px;font:600 15px/1.35 ui-sans-serif,system-ui,sans-serif;color:${ink};list-style:none}
.peptide-embed-json summary::-webkit-details-marker{display:none}
.peptide-embed-json[open] summary{border-bottom:1px solid ${line}}
.pe-layer{font:600 11px ui-sans-serif,system-ui,sans-serif;color:${accent};text-transform:uppercase;letter-spacing:0.06em}
.peptide-json{margin:0;padding:14px 18px;font:12px/1.5 ui-monospace,monospace;color:${soft};background:rgba(0,0,0,0.03);overflow:auto;max-height:320px;border-bottom:1px solid ${line}}
.peptide-embed-excerpt{padding:12px 18px;font-size:16px;color:${soft};margin:0}
.peptide-embed-json .embed-more{display:inline-block;margin:0 18px 16px}
`
}
.embed{margin:34px 0;padding:20px 22px;border:1px solid ${line};border-left:3px solid ${accent};border-radius:2px;background:${card}}
.embed-kicker{font:600 11px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.14em;text-transform:uppercase;color:${accent};margin-bottom:8px}
.embed-title{font:800 22px/1.2 ui-sans-serif,system-ui,sans-serif;margin:0 0 8px}
.embed-title a{color:${ink};text-decoration:none}
.embed-body{font-size:16px;color:${soft};margin-bottom:12px}
.embed-more{font:600 13px/1 ui-sans-serif,system-ui,sans-serif;color:${accent};text-decoration:none}
.embed-missing{color:${dim};font:13px ui-monospace,monospace}
footer,.article-footer{margin-top:56px;padding-top:22px;border-top:1px solid ${line};font:11px/1.6 ui-monospace,monospace;letter-spacing:0.08em;text-transform:uppercase;color:${dim}}
.dev-panel{margin-top:18px;text-transform:none;letter-spacing:0}
.dev-panel summary{cursor:pointer;font:700 12px ui-sans-serif,system-ui,sans-serif;letter-spacing:0.04em;text-transform:uppercase;color:${accent}}

.ledger-note{margin-top:6px;text-transform:none;letter-spacing:0;color:${dim}}
.prov{margin-top:12px;text-transform:none;letter-spacing:0}
.prov-head{color:${soft};font:12px/1.5 ui-monospace,monospace}
.prov details{margin-top:6px}
.prov summary{color:${accent};cursor:pointer;font:12px ui-monospace,monospace}
.prov .pv-row{color:${dim};font:11px/1.7 ui-monospace,monospace;padding-left:8px}
.prov .pv-act{color:${accent}}.prov .pv-mod{color:${soft}}
.prov code{font-size:11px}.prov-verify{display:inline-block;margin-top:6px;color:${accent};font:12px ui-monospace,monospace}
/* Claims + source ledger */
.claims,.srcledger{margin:34px 0}
.claims-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:16px}
.claims-title{font:800 clamp(22px,3vw,28px)/1.15 ui-sans-serif,system-ui,sans-serif;letter-spacing:-0.01em;color:${ink};margin:0}
.claims-meta{font:12px ui-monospace,monospace;color:${dim}}
.claims-meta a{color:${accent}}
.claims-collapsed{margin-top:28px}
.claims-defer summary{cursor:pointer;font:700 13px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.04em;text-transform:uppercase;color:${accent}}
.reader-prose{font-size:var(--fs-body);line-height:var(--lh-body)}
.reader-prose h3{font:600 var(--fs-h3)/1.3 var(--font);color:${ink};margin:1.75rem 0 .75rem}
.reader-prose blockquote.anecdote-quote{margin:var(--space-4) 0;padding:var(--space-3) var(--space-4);border-left:3px solid ${accent};background:${card};font:italic 400 calc(var(--fs-body)*1.08)/var(--lh-body) var(--font-body);color:${ink}}
.reader-prose em{color:${dim};font-style:italic}
.reader-prose ol{margin:12px 0 20px 28px}
.reader-prose ol li{margin-bottom:8px}
.reader-prose hr{margin:40px 0;border:0;border-top:1px solid ${line}}
.reader-chapter{position:relative;padding:0;margin:0}
.reader-chapter:not(:last-of-type)::after{display:none}
.claims-more,.claims-noise{margin-top:14px}
.claims-more summary,.claims-noise summary,.ask-prompts summary{cursor:pointer;font:700 13px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.04em;text-transform:uppercase;color:${accent}}
.claims summary,.srcledger summary{cursor:pointer;font:700 13px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.04em;text-transform:uppercase;color:${accent}}
.claims summary code,.srcledger summary code{font:11px ui-monospace,monospace;text-transform:none}
.claims summary a,.srcledger summary a{color:${accent}}
.cl-list{margin-top:14px}
.cl-row{display:flex;gap:12px;align-items:flex-start;padding:14px 0;border-top:1px solid ${line}}
.cl-weight{flex:none;font:700 11px/1.6 ui-monospace,monospace;color:${dim};background:${bg};border:1px solid ${line};border-radius:6px;padding:3px 8px;margin-top:2px}
.cl-status{flex:none;font:700 9px/1.6 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.05em;text-transform:uppercase;border-radius:6px;padding:3px 8px;margin-top:2px}
.cl-status-retracted,.cl-status-cut{background:#fde8e8;color:#9b1c1c;border:1px solid #5a2a2a}
.cl-status-downweighted{background:#fff8e6;color:#8a6d00;border:1px solid #5a4a1e}
.cl-inactive{opacity:0.72}
.cl-ret{font:11px/1.5 ui-sans-serif,system-ui,sans-serif;color:#9b1c1c;margin-top:4px}
.tierb{flex:none;display:inline-block;min-width:84px;text-align:center;font:700 10px/1.6 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.06em;text-transform:uppercase;color:#fff;background:var(--tb);border-radius:6px;padding:3px 8px;margin-top:2px}
.standb{flex:none;display:inline-block;text-align:center;font:700 10px/1.6 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.04em;text-transform:uppercase;color:var(--sb);background:transparent;border:1px solid var(--sb);border-radius:6px;padding:2px 7px;margin-top:2px;margin-left:6px}
.cl-main{flex:1}
.cl-text{font-size:17px;color:${ink};line-height:1.5}
.cl-row.cl-safety .cl-text{font-weight:600}
.cl-row.cl-compact{padding:10px 0}
.cl-row.cl-compact .cl-text{font-size:16px}
.cl-gated{flex:none;font:700 9px/1.6 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.04em;text-transform:uppercase;color:#8a6d00;background:#fff8e6;border:1px solid #5a4a1e;border-radius:6px;padding:3px 8px;margin-top:2px}
.cl-who{font:12px ui-sans-serif,system-ui,sans-serif;color:${dim};margin-top:4px}
.cl-why{font-size:14px;color:${soft};margin-top:6px;font-style:italic}
.cl-src{font:12px/1.6 ui-monospace,monospace;color:${dim};margin-top:7px}
.cl-src a{color:${accent};text-decoration:none}
.cl-sec{color:${dim};margin-right:10px}
.unsourced{color:#b5453b;font-weight:700}
/* Source ledger header + evidence-card grid (the gem) */
.ev-bar{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin:6px 0 16px}
.ev-bar-t{font:700 13px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.06em;text-transform:uppercase;color:${accent}}
.ev-bar-h{font:11px/1.6 ui-monospace,monospace;color:${dim}}
.ev-bar-h a{color:${accent}}.ev-bar-h code{font-size:11px}
/* Evidence swiper — one platform widget per viewport (Instagram-style), article stays vertical.
   Card interiors are platform-native and self-contained (mimicry law); see platformRailCss(). */
.rp-swiper{margin:8px -18px 20px;position:relative}
.rp-sw-nav{display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:12px;padding:0 22px}
.rp-sw-btn{width:36px;height:36px;border:1px solid ${line};border-radius:50%;background:${bg};color:${ink};font-size:22px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0 0 2px}
.rp-sw-btn:hover{background:${card}}
.rp-sw-btn:disabled{opacity:.35;cursor:default}
.rp-sw-counter{font:600 12px/1 ui-monospace,monospace;color:${dim};min-width:4.5em;text-align:center}
.rp-swiper-viewport{overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;touch-action:pan-x}
.rp-swiper-viewport::-webkit-scrollbar{display:none}
.rp-swiper-track{display:flex;align-items:flex-start}
.rp-slide{flex:0 0 100%;scroll-snap-align:center;scroll-snap-stop:always;display:flex;justify-content:center;align-items:flex-start;padding:4px 22px 16px}
@media(min-width:900px){
.rp-swiper{margin:8px 0 24px;max-width:640px;margin-left:auto;margin-right:auto}
}
.rp-sw-dots{display:flex;justify-content:center;gap:6px;padding:4px 22px 0;flex-wrap:wrap;max-height:48px;overflow:hidden}
.rp-sw-dot{width:6px;height:6px;border-radius:50%;border:none;background:${line};padding:0;cursor:pointer;transition:transform .15s,background .15s}
.rp-sw-dot.active{background:${accent};transform:scale(1.35)}
${platformRailCss()}
.tier-preclinical{background:#e8f0f8;color:#20558a}
.tier-anecdotal{background:#fff3e0;color:#e65100}
.tier-review{background:#e8f5e9;color:#2e7d32}
.tier-clinical{background:#f3e5f5;color:#7b1fa2}
.tier-news{background:#fce4ec;color:#c2185b}
.ev-reddit{--ev:#ff4500}.ev-x{--ev:#1d9bf0}.ev-insta{--ev:#e1306c}.ev-yt{--ev:#ff0000}.ev-news{--ev:#5b6470}.ev-biz{--ev:#d32323}.ev-anec{--ev:#8a6d3b}.ev-other{--ev:${accent}}
/* Model contribution cards — inspectable, same swipe deck */
.contribs{margin:var(--space-5) 0;border:1px solid ${line};border-radius:18px;background:${card};overflow:hidden}.contribs>summary{cursor:pointer;list-style:none;padding:20px 22px;display:grid;grid-template-columns:auto 1fr;gap:4px 16px;align-items:center}.contribs>summary::-webkit-details-marker{display:none}.contribs>summary span{grid-row:1/3;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:${accent};color:#0b0d10;font:700 0/1 var(--font)}.contribs>summary span::after{content:'↻';font-size:22px}.contribs>summary b{font:700 15px/1.2 var(--font);color:${ink}}.contribs>summary small{font:12px/1.3 var(--font);color:${dim}}.contribs[open]>summary{border-bottom:1px solid ${line}}.contribs-body{padding:12px 0 18px}.machine-path{margin:0 22px;padding-top:12px;border-top:1px solid ${line};font:11px/1.5 var(--font-mono);color:${dim}}
.mcard{width:min(340px,100%);max-width:100%;display:flex;flex-direction:column;border:1px solid ${line};border-radius:14px;background:${card};padding:16px;min-height:280px}
.mc-h{display:flex;align-items:center;gap:8px}
.mc-model{font:700 14px ui-monospace,monospace;color:${ink}}
.mc-role{margin-left:auto;font:600 10px/1.5 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.05em;text-transform:uppercase;color:#fff;background:${accent};border-radius:6px;padding:2px 8px}
.mc-meta{display:flex;gap:8px;align-items:center;margin-top:6px}
.mc-act{font:600 10px/1.5 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.05em;text-transform:uppercase;color:${dim};border:1px solid ${line};border-radius:6px;padding:2px 8px}
.mc-date{font:10px ui-monospace,monospace;color:${dim}}
.mc-out{font:600 15px/1.4 ui-sans-serif,system-ui,sans-serif;color:${soft};margin:10px 0}
.mc-ins{margin-top:auto}
.mc-ins summary{cursor:pointer;font:700 11px/1.5 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.04em;text-transform:uppercase;color:${accent}}
.mc-lbl{font:700 9px/1.5 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.06em;text-transform:uppercase;color:${dim};margin:10px 0 4px}
.mc-pre{margin:0;font:11.5px/1.55 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;background:rgba(0,0,0,0.03);border:1px solid ${line};border-radius:8px;padding:10px;color:${soft}}
.mc-foot{margin-top:12px;padding-top:10px;border-top:1px dashed ${line}}
.mc-hash{font:10px ui-monospace,monospace;color:${dim}}
.copy-bundle{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:12px 0 20px;padding:12px 14px;border:1px solid ${line};border-radius:12px;background:${card}}
.copy-bundle-btn{font:700 12px ui-sans-serif,system-ui,sans-serif;letter-spacing:0.04em;text-transform:uppercase;border:0;border-radius:99px;padding:10px 16px;background:${ink};color:${bg};cursor:pointer}
.copy-bundle-btn:hover{opacity:0.9}
.copy-bundle-btn.copied{background:#1a7f37}
.copy-bundle-link{font:700 11px var(--font-body);letter-spacing:.04em;text-transform:uppercase;border:1px solid ${line};border-radius:2px;padding:8px 14px;background:${card};cursor:pointer;color:${accent}}
.copy-bundle-meta{font:11px ui-monospace,monospace;color:${dim}}
.copy-bundle-meta a{color:${accent}}
.copy-bundle-status{font:11px ui-monospace,monospace;color:${dim};margin-left:auto}
.copy-bundle-note{flex:1 1 100%;font:11px/1.5 ui-sans-serif,system-ui,sans-serif;color:${dim};margin:4px 0 0}
.copy-bundle-map{background:${accent};color:${bg}}
.copy-bundle-tap{background:${accent};color:${bg}}
.copy-bundle-tap-read{border-color:${line};color:${ink}}
.post-oip .article-header{border:1px solid ${line};border-radius:2px;padding:var(--space-4);background:${card}}
.post-oip .kicker{color:${ink}}
.post-oip .copy-bundle-oip{border-color:${line};background:${card};color:${ink}}
.post-oip .copy-bundle-oip .copy-bundle-tap{background:${accent};color:${bg}}
.post-oip .copy-bundle-oip .copy-bundle-note,.post-oip .copy-bundle-oip .copy-bundle-status{color:${soft}}
.post-oip .self-explain{border-color:${line};background:${card}}
.post-oip .content.reader-prose h2{color:${ink};border-top:0;padding-top:0;font:700 var(--fs-h2)/var(--lh-head) var(--font-display);text-transform:none;letter-spacing:-.01em;max-width:28ch}
.self-explain{margin:0 0 24px;border:1px solid ${line};border-radius:2px;padding:10px 14px;background:${card}}
.self-explain summary{cursor:pointer;font:700 12px ui-sans-serif,system-ui,sans-serif;letter-spacing:0.04em;text-transform:uppercase;color:${accent}}
.self-explain-pre{font:10px/1.55 ui-monospace,monospace;white-space:pre-wrap;color:${soft};max-height:280px;overflow:auto;margin:10px 0}
.ask-prompts{margin:calc(var(--u)*0.618) 0}
.ask-note{font-size:14px;color:${soft};margin:8px 0 14px;line-height:1.5}
.ask-note code{font-size:12px}
.ask-list{display:flex;flex-direction:column;gap:12px}
.ask-row{border:1px solid ${line};border-radius:2px;padding:14px 16px;background:${card}}
.ask-prompt{font-size:15px;line-height:1.45;color:${ink};margin-bottom:10px}
.ask-ch{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.ask-copy{font:700 11px var(--font-body);letter-spacing:.04em;text-transform:uppercase;border:1px solid ${line};border-radius:2px;padding:6px 12px;background:${card};cursor:pointer;color:${accent}}
.ask-copy:hover{background:${raised}}
.ask-copy:hover{border-color:${accent}}
.ask-hint{font:11px ui-monospace,monospace;color:${dim}}
.restblock{margin-top:12px;text-transform:none;letter-spacing:0}
.restblock summary{color:${accent};cursor:pointer;font:12px ui-monospace,monospace}
.rb{font:11px/1.7 ui-monospace,monospace;color:${dim};padding-left:8px;margin-top:3px}
.rb b{color:${soft};font-weight:700}
.rb a{color:${accent}}
.divider{height:1px;background:${line};margin:64px 0;position:relative}
.divider::after{content:'∞';position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:${bg};padding:0 14px;color:${dim};font-size:16px}
#sentinel{height:1px}
.loading{text-align:center;color:${dim};font:12px ui-monospace,monospace;letter-spacing:0.1em;text-transform:uppercase;padding:20px 0}
.load-more-articles{display:block;margin:8px auto 28px;border:1px solid ${line};border-radius:2px;background:${card};color:${accent};font:700 12px var(--font-body);letter-spacing:.04em;text-transform:uppercase;padding:10px 18px;cursor:pointer}
.load-more-articles:hover{background:${raised}}
.load-more-articles:hover{border-color:${accent};background:${card}}
.load-more-articles:disabled{opacity:.45;cursor:default}
${socialStyles()}
${llmStyles()}
${sourceStyles()}
${oipWidgetStyles(ink, line, accent)}
${objectWidgetStyles(ink, line, accent)}
/* ── refinement layer: restrained. one accent, solid ink, no gradients on text ── */
.kicker{color:${accent}}
h1{color:${ink}}
.content h1{font:700 var(--fs-h1)/var(--lh-head) var(--font-display);text-transform:uppercase;letter-spacing:.01em;margin:1.4em 0 .5em}
.content h1,.content h2{color:${ink}}
.article-header{position:relative;padding-bottom:18px}
.article-header::after{content:'';position:absolute;left:0;bottom:0;height:3px;width:88px;border-radius:2px;background:${accent}}
.content h2{position:relative;padding-top:0}
.content code{background:#f5f5f5;border:1px solid ${line};color:${ink};font-weight:400;font-family:var(--font-mono)}
.content .cb-pre code{background:none;border:0;color:inherit;font-weight:400;padding:0}
.content a{color:${accent};text-decoration-color:color-mix(in srgb,${accent} 40%,transparent);text-underline-offset:3px;transition:text-decoration-color .15s}
.content a:hover{text-decoration-color:${accent}}
.anecdote-quote{border-left:3px solid ${accent};background:${card};padding:14px 20px;margin:26px 0;font-style:italic;color:${soft}}
.tag{transition:all .15s;background:${card}}
.tag:hover{border-color:${accent};transform:translateY(-1px)}
.post-oip .article-header{background:transparent;border:0;border-radius:0;padding:0 0 18px}
.article-header h1{font-size:var(--fs-h1);max-width:28ch}
::selection{background:#e5e5e5;color:#000}
html,body{overflow-x:clip}
/* Release gate: every EDITORIAL widget is a white, black-text reading surface.
   Platform evidence cards (.rp-card) are EXEMPT by the mimicry law (design-law v1.5.0):
   a tweet looks like a tweet, Bloomberg is white-on-black — the platform identity is the
   content, so the gate must never flatten it. */
.widgets,.widget,.mcard,.at-card,.uew-card,.contribs,.codeblock,.cb-bar,.cb-foldbar,.cb-pre,.msgbuild,.mb-card,.se-card,.wn,.ontology-nav,.ontology-family,.self-explain,.copy-bundle,.ask-row{background:#fff!important;color:#000!important}
.widgets :is(p,li,span,div,small,strong,b,em,code,pre,h2,h3):not(.rp-card *),.mcard :is(p,li,span,div,small,strong,b,em,code,pre,h2,h3){color:#000!important}
.widgets a:not(.rp-card a):not(.rp-body),.mcard a,.mcard a:visited,.mcard a:hover{color:#000!important;text-decoration:underline!important;text-decoration-color:#000!important;text-underline-offset:3px}
.content .embed-inline a.rp-body,.srcledger a.rp-body{text-decoration:none!important;color:inherit!important}
.im-phone,.im-thread,.im-input,.wa-phone,.wa-bar,.wa-thread,.wa-input,.wa-bubble,.im-bubble,.mb-chat,.mb-bub{background:#fff!important;background-image:none!important;color:#000!important;border-color:${line}!important}
.vx-frame{background:#fff!important;border-color:${line}!important;box-shadow:none!important}.vx-frame svg>rect{fill:#fff!important}.vx-stars{display:none}.vx-edge{stroke:#777!important;opacity:.8!important}.vx-rel,.vx-lab{fill:#000!important}.vx-node{stroke:#000!important}
.cb-dots{display:none}.cb-copy.done,.copy-bundle-btn.copied{background:#000!important;border-color:#000!important;color:#fff!important}
.content a,.content a:visited,.content a:hover,.reader-prose a,.reader-prose a:visited,.reader-prose a:hover{color:#000!important;text-decoration:underline!important;text-decoration-color:#000!important}
.content .chapter-number{display:none!important}
.content .reader-opening,.content .reader-chapter{margin:0!important;padding:0!important;font-size:18px!important;line-height:1.7!important}
.content>section>p,.content>section>ul,.content>section>ol,.content>section li{font-size:18px!important;line-height:1.7!important}
.content h2{font:700 clamp(26px,2.2vw,32px)/1.22 var(--font-display)!important;letter-spacing:-.015em!important;text-transform:none!important;margin:2.25rem 0 .75rem!important;padding:0!important}
.content h3{font:700 22px/1.3 var(--font-display)!important;letter-spacing:-.01em!important;text-transform:none!important;margin:1.75rem 0 .6rem!important}
.content>p:first-of-type::first-letter,.content .reader-opening>p:first-of-type::first-letter{float:none!important;font:inherit!important;padding:0!important}
.rp-fallback-mark{background:#fff!important;color:#000!important;border:1px solid ${line}!important}
.copy-bundle-btn,.copy-bundle-btn:hover,.copy-bundle-btn.copied,.copy-bundle-link,.cb-copy,.cb-copy.done{background:#fff!important;color:#000!important;border:1px solid ${line}!important}
@media(max-width:760px){.wrap{padding-left:18px;padding-right:18px}.post-oip .article-header{padding:0 0 18px}.system-toolbar{margin-bottom:var(--space-4)}.ontology-families{grid-template-columns:1fr}.ontology-nav>summary{align-items:flex-start;flex-direction:column}}
</style></head><body>${headerHtml}<div class="wrap"><div id="posts">${post}</div>${userSection}<div id="article-load-status" class="loading" hidden></div><button type="button" id="load-more-articles" class="load-more-articles">Load next article</button><div id="sentinel"></div></div>${governanceFooter()}
<script>
document.addEventListener('click',function(e){
  var b=e.target.closest('.cb-copy'); if(!b) return;
  e.preventDefault();
  navigator.clipboard.writeText(b.getAttribute('data-code')||'').then(function(){
    b.classList.add('done'); b.textContent='copied';
    setTimeout(function(){ b.classList.remove('done'); b.textContent='copy'; },1400);
  });
});
</script>
<script>
${
  isOipPageRoute
    ? ""
    : `
function copyWidgetText(btn){
  var text=btn.getAttribute('data-text');
  var label=btn.classList.contains('ask-wa')?'WhatsApp':'Copy for iMessage';
  navigator.clipboard.writeText(text).then(function(){ btn.classList.add('copied'); btn.textContent='Copied'; setTimeout(function(){ btn.classList.remove('copied'); btn.textContent=label; },1500); });
}
  document.querySelectorAll('.ask-copy').forEach(function(btn){
    btn.addEventListener('click',function(){ copyWidgetText(btn); });
  });
  `
}
  function copyFromUrl(btn, defaultLabel){
    var url=btn.getAttribute('data-url');
    var st=btn.closest('.copy-bundle')&&btn.closest('.copy-bundle').querySelector('.copy-bundle-status');
    if(st) st.textContent='loading…';
  fetch(url).then(function(r){ return r.text(); }).then(function(t){
    return navigator.clipboard.writeText(t).then(function(){
      btn.classList.add('copied'); btn.textContent='Copied';
      if(st) st.textContent=(t.length/1000).toFixed(1)+'k chars';
      setTimeout(function(){ btn.classList.remove('copied'); btn.textContent=defaultLabel; },2000);
    });
  }).catch(function(){ if(st) st.textContent='failed'; });
  }
${
  isOipPageRoute
    ? `
document.querySelectorAll('.copy-bundle-btn').forEach(function(btn){
  btn.addEventListener('click',function(){
    if(btn.getAttribute('data-url')) return copyFromUrl(btn, btn.classList.contains('copy-bundle-llm') ? 'Copy for LLM' : 'Tap & Go');
  });
});
`
    : `
document.querySelectorAll('.copy-bundle-btn').forEach(function(btn){
  btn.addEventListener('click',function(){
    copyFromUrl(btn, btn.classList.contains('copy-bundle-map') ? 'Copy system map' : 'Copy for LLM');
  });
});
document.querySelectorAll('.self-explain-copy').forEach(function(btn){
  btn.addEventListener('click',function(){ copyFromUrl(btn, 'Copy system map'); });
});
`
}
document.querySelectorAll('.copy-bundle-link').forEach(function(btn){
  btn.addEventListener('click',function(){
    var t=btn.getAttribute('data-text');
    navigator.clipboard.writeText(t).then(function(){ btn.textContent='Copied'; setTimeout(function(){ btn.textContent='Copy link'; },1500); });
  });
});
function askWidget(btn){
  var q=btn.getAttribute('data-question')||'';
  var s=btn.getAttribute('data-source')||'';
  var url='/ask?q='+encodeURIComponent(q)+(s?'&source='+encodeURIComponent(s):'');
  window.location.href=url;
}
function initWidgetSwipers(root){
  var scope=root||document;
  scope.querySelectorAll('[data-widget-swiper]').forEach(function(section){
    if(section.dataset.swiperReady) return;
    var vp=section.querySelector('.rp-swiper-viewport');
    if(!vp) return;
    var n=section.querySelectorAll('.rp-slide').length;
    if(!n) return;
    section.dataset.swiperReady='1';
    var cur=section.querySelector('.rp-sw-cur');
    var dots=section.querySelectorAll('.rp-sw-dot');
    var prev=section.querySelector('.rp-sw-prev');
    var next=section.querySelector('.rp-sw-next');
    function step(){
      var slide=section.querySelector('.rp-slide');
      return slide?slide.offsetWidth:vp.offsetWidth;
    }
    function idx(){ return Math.max(0,Math.min(n-1,Math.round(vp.scrollLeft/Math.max(1,step())))); }
    function go(i){ i=Math.max(0,Math.min(n-1,i)); vp.scrollTo({left:i*step(),behavior:'smooth'}); }
    function sync(){
      var i=idx();
      if(cur) cur.textContent=String(i+1);
      dots.forEach(function(d,j){ d.classList.toggle('active',j===i); });
      if(prev) prev.disabled=i<=0;
      if(next) next.disabled=i>=n-1;
    }
    vp.addEventListener('scroll',function(){ requestAnimationFrame(sync); },{passive:true});
    if(prev) prev.addEventListener('click',function(){ go(idx()-1); });
    if(next) next.addEventListener('click',function(){ go(idx()+1); });
    dots.forEach(function(d,j){ d.addEventListener('click',function(){ go(j); }); });
    sync();
  });
}
initWidgetSwipers();
// Inline YouTube: the card never navigates away — first tap swaps the facade for a
// youtube-nocookie iframe playing in place.
document.addEventListener('click', function(e){
  var card = e.target && e.target.closest ? e.target.closest('.rp-yt-inline') : null;
  if (!card || card.dataset.loaded) return;
  var id = card.getAttribute('data-yt-id');
  if (!id) return;
  card.dataset.loaded = '1';
  var thumb = card.querySelector('.rp-ytthumb');
  if (!thumb) return;
  var frame = document.createElement('iframe');
  frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0';
  frame.title = card.getAttribute('data-yt-title') || 'Video';
  frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  frame.allowFullscreen = true;
  frame.style.cssText = 'width:100%;aspect-ratio:16/9;border:0;display:block';
  thumb.replaceWith(frame);
});
// SHARE WIDGET + READING-POSITION TRACKER. One widget per page. As continuous reading
// appends articles (and the URL follows), this keeps the URL AND the widget honest in
// BOTH scroll directions: whatever article you are actually looking at is the one the
// address bar and the share panel name. "Copy for LLM" hands the whole article as
// markdown, ready to paste into any model.
(function(){
  var ROBOT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="8.5" width="14" height="10" rx="2.5"/><circle cx="9.5" cy="13" r="1.15" fill="currentColor" stroke="none"/><circle cx="14.5" cy="13" r="1.15" fill="currentColor" stroke="none"/><path d="M9.5 16.2h5"/><path d="M12 8.5V5.8"/><circle cx="12" cy="4.6" r="1.2"/><path d="M5 12.5H3.4M20.6 12.5H19"/></svg>';
  var box = document.createElement('div');
  box.className = 'ms-share';
  box.innerHTML =
    '<div class="ms-share-panel" role="dialog" aria-label="Share this article">' +
      '<div class="ms-share-k">You are reading</div>' +
      '<div class="ms-share-title" id="ms-share-title"></div>' +
      '<div class="ms-share-row">' +
        '<button type="button" id="ms-share-native" hidden>Share\\u2026</button>' +
        '<button type="button" id="ms-share-copy">Copy link to this article</button>' +
        '<button type="button" id="ms-share-llm">Copy for LLM (full markdown)</button>' +
      '</div>' +
      '<div class="ms-share-nets" id="ms-share-nets"></div>' +
      '<div class="ms-share-note">Copy for LLM gives the complete article — claims, sources, and ledger — as plain markdown any model can read.</div>' +
    '</div>' +
    '<button type="button" class="ms-share-btn" aria-label="Share this article" title="Share this article">' + ROBOT + '</button>';
  document.body.appendChild(box);
  var titleEl = document.getElementById('ms-share-title');
  var netsEl = document.getElementById('ms-share-nets');
  var nativeBtn = document.getElementById('ms-share-native');
  var copyBtn = document.getElementById('ms-share-copy');
  var llmBtn = document.getElementById('ms-share-llm');
  var current = { slug: '', title: '' };
  // Every major network, one tap, no SDKs: plain intent URLs, so nothing here loads a
  // third-party script or phones home before the reader chooses to share.
  function netLinks(u, t){
    var eu = encodeURIComponent(u), et = encodeURIComponent(t);
    return [
      ['X', 'https://x.com/intent/post?text=' + et + '&url=' + eu],
      ['LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url=' + eu],
      ['Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + eu],
      ['Reddit', 'https://www.reddit.com/submit?url=' + eu + '&title=' + et],
      ['Hacker News', 'https://news.ycombinator.com/submitlink?u=' + eu + '&t=' + et],
      ['WhatsApp', 'https://wa.me/?text=' + et + '%20' + eu],
      ['Telegram', 'https://t.me/share/url?url=' + eu + '&text=' + et],
      ['Email', 'mailto:?subject=' + et + '&body=' + et + '%0A%0A' + eu]
    ];
  }
  function renderNets(){
    if (!netsEl) return;
    var u = 'https://miscsubjects.com/a/' + current.slug;
    netsEl.innerHTML = '';
    netLinks(u, current.title).forEach(function(n){
      var a = document.createElement('a');
      a.textContent = n[0];
      a.href = n[1];
      if (n[1].indexOf('mailto:') !== 0) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      netsEl.appendChild(a);
    });
  }
  function setCurrent(slug, title){
    if (!slug || slug === current.slug) return;
    current = { slug: slug, title: title || slug };
    if (titleEl) titleEl.textContent = current.title;
    renderNets();
    if (history.replaceState) history.replaceState(null, '', '/a/' + slug);
    document.title = current.title + ' \\u2014 miscsubjects';
  }
  if (nativeBtn && navigator.share) {
    nativeBtn.hidden = false;
    nativeBtn.addEventListener('click', function(){
      navigator.share({ title: current.title, url: 'https://miscsubjects.com/a/' + current.slug }).catch(function(){});
    });
  }
  function fallbackCopy(text){
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
    return ok;
  }
  function copyText(text, btn, okLabel, prev){
    function done(good){
      btn.textContent = good ? okLabel : 'Copy failed \\u2014 tap to retry';
      if (good) setTimeout(function(){ btn.textContent = prev; }, 2200);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function(){ done(true); }, function(){ done(fallbackCopy(text)); });
    } else {
      done(fallbackCopy(text));
    }
  }
  // The markdown bundle prefetches when the panel opens, so the copy click is instant and
  // the clipboard write stays inside the user gesture (async writes after a fetch get
  // rejected by the browser).
  var llmCache = { slug: '', md: '' };
  function prefetchLlm(){
    var slug = current.slug;
    if (!slug || llmCache.slug === slug) return;
    fetch('/api/articles/' + encodeURIComponent(slug) + '/bundle?format=markdown')
      .then(function(r){ return r.text(); })
      .then(function(md){ llmCache = { slug: slug, md: md }; })
      .catch(function(){});
  }
  copyBtn.addEventListener('click', function(){
    copyText('https://miscsubjects.com/a/' + current.slug, copyBtn, 'Link copied \\u2713', 'Copy link to this article');
  });
  // The on-page share rows (one per article, server-rendered) delegate their copy button here
  // so appended continuous-scroll articles work without re-binding.
  document.addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('.ms-sharerow-copy') : null;
    if (!b) return;
    copyText(b.getAttribute('data-share-url') || '', b, 'Copied \\u2713', 'Copy link');
  });
  llmBtn.addEventListener('click', function(){
    var prev = 'Copy for LLM (full markdown)';
    if (llmCache.slug === current.slug && llmCache.md) {
      copyText(llmCache.md, llmBtn, 'Copied for LLM \\u2713', prev);
      return;
    }
    llmBtn.textContent = 'Fetching article\\u2026';
    fetch('/api/articles/' + encodeURIComponent(current.slug) + '/bundle?format=markdown')
      .then(function(r){ return r.text(); })
      .then(function(md){
        llmCache = { slug: current.slug, md: md };
        copyText(md, llmBtn, 'Copied for LLM \\u2713', prev);
      })
      .catch(function(){ llmBtn.textContent = 'Copy failed \\u2014 tap to retry'; });
  });
  box.querySelector('.ms-share-btn').addEventListener('click', function(){
    box.classList.toggle('open');
    if (box.classList.contains('open')) prefetchLlm();
  });
  document.addEventListener('click', function(e){ if (!box.contains(e.target)) box.classList.remove('open'); });
  function titleFor(art){
    var h = art.querySelector('h1');
    return h ? h.textContent : art.getAttribute('data-slug');
  }
  function sync(){
    var arts = document.querySelectorAll('article.post[data-slug]');
    var pick = arts[0];
    for (var i = 0; i < arts.length; i++) {
      if (arts[i].getBoundingClientRect().top <= 140) pick = arts[i];
    }
    if (pick) setCurrent(pick.getAttribute('data-slug'), titleFor(pick));
  }
  var ticking = false;
  window.addEventListener('scroll', function(){
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function(){ sync(); ticking = false; });
  }, { passive: true });
  sync();
})();
(function(){
  var currentSlug = ${JSON.stringify(slug)};
  // The server-derived related queue: this article's own linked pages, then its family.
  // The global index is only consulted after the related pages are exhausted.
  var related = ${JSON.stringify(relatedQueue)};
  var queue = [];
  var seen = {}; seen[currentSlug] = true;
  var limit = 16, loading = false, paging = false, done = false;
  var host = document.getElementById('posts');
  var sentinel = document.getElementById('sentinel');
  var status = document.getElementById('article-load-status');
  var loadBtn = document.getElementById('load-more-articles');
  function say(t){
    if(!status) return;
    status.textContent = t || '';
    status.hidden = !t;            // no permanent "loading" label on a page that is not loading
  }
  // ONTOLOGICAL CONTINUATION (owner order 2026-08-11). The next page of the scroll is computed
  // by the server from the corpus link graph around the article the reader is actually in —
  // ring by ring outward, then the category/tag family, and the flat index only when the
  // neighborhood is exhausted. The exclude list is everything already on this page, so nothing
  // repeats within a session no matter which ring it came from.
  function nextPage(){
    if(done || paging) return Promise.resolve();
    paging = true;
    say('Following the graph…');
    return fetch('/api/articles/' + encodeURIComponent(currentSlug) + '/continuation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ exclude: Object.keys(seen), limit: limit })
    }).then(function(r){ return r.json(); }).then(function(d){
      var arts = d.articles || [];
      done = !!d.exhausted;
      arts.forEach(function(a){
        var s = String(a.slug || '').trim();
        if(!s || seen[s]) return;
        seen[s] = true;
        queue.push(s);
      });
      if(!queue.length && done) say('End of article ledger.');
      else say(queue.length ? 'Scroll or tap to load the next article.' : 'Loading more article links…');
    }).catch(function(){
      say('Continuation failed. Tap to retry.');
    }).finally(function(){ paging = false; });
  }
  function ensureQueue(){
    if(queue.length || done) return Promise.resolve();
    while(related.length){
      var s = related.shift();
      if(s && !seen[s]){ seen[s] = true; queue.push(s); }
      if(queue.length >= limit) break;
    }
    if(queue.length) return Promise.resolve();
    return nextPage().then(function(){
      if(!queue.length && !done) return nextPage();
    });
  }
  function appendArticle(slug){
    say('Loading ' + slug + '…');
    return fetch('/a/' + encodeURIComponent(slug) + '?frag=1').then(function(r){ return r.text(); }).then(function(htmlText){
      var div = document.createElement('div'); div.className = 'divider'; host.appendChild(div);
      var tmp = document.createElement('div'); tmp.innerHTML = htmlText;
      while (tmp.firstChild) host.appendChild(tmp.firstChild);
      initWidgetSwipers(host);
      // URL ownership moved to the reading-position tracker: the address bar follows the
      // article actually in view, in both scroll directions — not merely the last append.
      say('Scroll or tap to load the next article.');
    });
  }
  function load(after){
    if(loading) return;
    loading = true;
    if(loadBtn) loadBtn.disabled = true;
    ensureQueue().then(function(){
      var next = queue.shift();
      if(!next){
        say(done ? 'End of article ledger.' : 'No article ready yet. Tap again.');
        return null;
      }
      return appendArticle(next);
    }).catch(function(){
      say('Could not load the next article. Tap to retry.');
    }).finally(function(){
      loading = false;
      if(loadBtn){
        loadBtn.disabled = false;
        // At the end of the ledger the button is not a control any more, it is a dead target.
        if(done && !queue.length){ loadBtn.hidden = true; say('End of article ledger.'); }
      }
      if(typeof after === 'function') after();
    });
  }
  if(loadBtn) loadBtn.addEventListener('click', function(){ load(); });

  // WHY THIS RE-ARMS. IntersectionObserver fires on CHANGES in intersection, and with a 1px
  // sentinel plus rootMargin 900px the sentinel is usually STILL intersecting after an append.
  // No change means no second callback, so the feed stalled until the reader scrolled far
  // enough to push the sentinel out of the margin and back in. After every settled load we
  // therefore re-test the sentinel ourselves and continue while it remains in the trigger
  // band, capped per gesture so a short article cannot run the whole ledger in one burst.
  var CHAIN_CAP = 3;
  function sentinelInBand(){
    if(!sentinel) return false;
    var r = sentinel.getBoundingClientRect();
    return r.top <= (window.innerHeight || 0) + 900;
  }
  function pump(depth){
    if(done || loading || !sentinelInBand()) return;
    if(depth >= CHAIN_CAP) return;
    load(function(){ pump(depth + 1); });
  }
  if(sentinel && 'IntersectionObserver' in window){
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting) pump(0); });
    }, { rootMargin: '900px' });
    io.observe(sentinel);
  }
  // Nothing is fetched until the reader is actually near the end of the article.
  if(sentinelInBand()) pump(0);
})();
</script>
<script>
// ADMIN BAR — client-side so the edge-cached page stays identical for every guest.
// The probe is the signed session itself: /api/admin/self answers 404 to anyone else.
(function(){
  fetch('/api/admin/self?format=json',{credentials:'same-origin',cache:'no-store'}).then(function(r){
    if(!r.ok) return;
    var slug=location.pathname.split('/').pop();
    var off=sessionStorage.getItem('ms_admin_view')==='off';
    var bar=document.createElement('div');
    bar.style.cssText='position:fixed;bottom:14px;right:14px;z-index:9999;display:flex;gap:8px;align-items:center;background:#111;color:#fff;border-radius:10px;padding:8px 12px;font:12px/1 ui-monospace,monospace;box-shadow:0 4px 18px rgba(0,0,0,.35)';
    function link(t,href){var a=document.createElement('a');a.textContent=t;a.href=href;a.style.cssText='color:#7fd4ff;text-decoration:none';return a;}
    if(off){
      var on=document.createElement('a');on.textContent='admin';on.href='#';
      on.style.cssText='color:#888;text-decoration:none';bar.style.background='transparent';bar.style.boxShadow='none';
      on.onclick=function(e){e.preventDefault();sessionStorage.removeItem('ms_admin_view');location.reload();};
      bar.appendChild(on);
    }else{
      var edit=document.createElement('button');edit.type='button';edit.textContent='Edit page';
      edit.style.cssText='border:0;background:#7fd4ff;color:#111;border-radius:6px;padding:5px 8px;font:700 12px/1 ui-monospace,monospace;cursor:pointer';
      edit.onclick=function(){var panel=document.getElementById('ms-recursive-editor');var start=panel&&panel.querySelector('.rc-edit-page');if(start){start.click();panel.scrollIntoView({behavior:'smooth',block:'start'});}};
      bar.appendChild(edit);
      bar.appendChild(link('Admin','/admin/articles'));
      var g=document.createElement('a');g.textContent='View as guest';g.href='#';g.style.cssText='color:#bbb;text-decoration:none';
      g.onclick=function(e){e.preventDefault();sessionStorage.setItem('ms_admin_view','off');location.reload();};
      bar.appendChild(g);
      var lo=document.createElement('a');lo.textContent='Log out';lo.href='#';lo.style.cssText='color:#f99;text-decoration:none';
      lo.onclick=function(e){e.preventDefault();fetch('/api/admin/logout',{method:'POST',credentials:'same-origin'}).finally(function(){location.reload();});};
      bar.appendChild(lo);
    }
    document.body.appendChild(bar);
  }).catch(function(){});
})();
</script>
</body></html>`;
  const pageResponse = new Response(redactPublicSecrets(html, env), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Short shared cache: pages were no-store, so every hit did full D1 work
      // (slow loads, cold 5xx). 60s at the edge absorbs bursts; SWR keeps reads
      // fast while a fresh render happens behind the scenes. Content mutations
      // surface within a minute, which the publish smoke gate already waits out.
      "cache-control": "public, max-age=120, s-maxage=600, stale-while-revalidate=86400",
    },
  });
  // Edge caching is owned by _middleware.js: it caches the FINAL page (mirror layer,
  // masthead, GA4 already injected), so a put here of the pre-injection body would
  // clobber the finished copy under the same key. This route only renders.
  return pageResponse;
}
