// https://miscsubjects.com/graph
// Multi-map evidence explorer — peptides · conditions · drugs · evidence tiers.
// GET                    → full map dashboard
// GET ?embed=1&slug=…    → compact dark embed inside article disclosure
// GET ?data=1            → full JSON
// GET ?data=1&slug=…     → article focus + forward links

import {
  buildExplorerData,
  buildArticleGraphContext,
  graphFocusForArticle,
} from "../_lib/graph_explorer.js";
import {
  governanceHeader,
  governanceChromeStyles,
} from "../_lib/governance_chrome.js";

function pageHtml(init) {
  const bodyClass = [
    init.embed ? "embed" : "full",
    init.theme === "light" ? "theme-light" : "theme-dark",
  ].join(" ");
  const safeInit = JSON.stringify(init).replace(/</g, "\\u003c");
  return HTML.replace("__BODY_CLASS__", bodyClass)
    .replace("__GOV_STYLE__", init.embed ? "" : governanceChromeStyles())
    .replace("__GOV_HEADER__", init.embed ? "" : governanceHeader(""))
    .replace("__GRAPH_INIT__", safeInit);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") || "").toLowerCase();
  const embed = url.searchParams.get("embed") === "1";
  const theme = url.searchParams.get("theme") || "light";

  if (url.searchParams.get("data") === "1") {
    if (slug) {
      const ctx = await buildArticleGraphContext(env, slug);
      return new Response(JSON.stringify(ctx), {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      });
    }
    const data = await buildExplorerData(env);
    return new Response(JSON.stringify(data), {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  }

  const init = {
    embed,
    theme,
    slug,
    mode: url.searchParams.get("mode") || null,
    selected: url.searchParams.get("focus") || null,
  };
  if (slug) {
    const data = await buildExplorerData(env);
    const focus = graphFocusForArticle(data, slug);
    if (focus.show) {
      init.mode = init.mode || focus.mode;
      init.selected = init.selected || focus.selected;
      init.nerve = focus.nerve;
    }
  }

  return new Response(pageHtml(init), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Evidence maps — miscsubjects</title>
<style>
__GOV_STYLE__
:root, body.theme-dark {
  --bg: #0c0b0f;
  --panel: #14131a;
  --panel2: #1b1a24;
  --ink: #faf8f5;
  --ink-soft: #e8e3da;
  --muted: #b0a99e;
  --line: #2a2835;
  --line2: #3a3748;
  --node-fill: #1b1a24;
  --node-stroke-text: #faf8f5;
  --svg-muted: #b0a99e;
  --peptide: #c8ff4d;
  --condition: #c8ff4d;
  --drug: #c8ff4d;
  --governance: #c8ff4d;
  --evidence: #4ecf8a;
  --nerve: #c77dff;
  --sans: 'Asap', ui-sans-serif, system-ui, -apple-system, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, monospace;
}
body.theme-light {
  --bg: #ffffff;
  --panel: #ffffff;
  --panel2: #f3f1ec;
  --ink: #141210;
  --ink-soft: #3d3830;
  --muted: #5c564e;
  --line: #ddd8cf;
  --line2: #c9c2b8;
  --node-fill: #ffffff;
  --node-stroke-text: #141210;
  --svg-muted: #5c564e;
}
body.theme-light .hdr {
  background: linear-gradient(180deg, #ffffff 0%, var(--bg) 100%);
}
body.theme-light .graph-card {
  box-shadow: 0 4px 20px rgba(0,0,0,0.07);
}
body.theme-light .edge { stroke: #9a9488 !important; }
* { box-sizing: border-box; }
html, body { height: 100%; margin:0; padding:0; background: var(--bg); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
body { display: flex; flex-direction: column; min-height: 100vh; overflow: auto; }
body.embed { min-height: 0; overflow: auto; --phi: 1.618; --u: 14px; }
body.embed .hdr-top .sub, body.embed .stats, body.embed footer { display: none; }
body.embed .hdr { padding: 10px 12px 8px; }
body.embed .maps { grid-template-columns: repeat(4, 1fr); gap: 5px; margin-top: 6px; }
body.embed .map-tab { padding: 7px 9px; }
body.embed .map-tab .k { font-size: 8px; letter-spacing: 0.1em; }
body.embed .map-tab .n { font-size: 12px; font-weight: 700; }
body.embed .map-tab .c { font-size: 9px; color: var(--ink-soft); }
body.embed h1 { font-size: 14px; }
body.embed .toolbar { padding: 6px 12px; }
body.embed #search { max-width: 200px; font-size: 12px; padding: 6px 10px; }
body.embed #nerveBtn { display: none; }
body.embed .main {
  grid-template-columns: 1fr;
  min-height: 280px;
  overflow: visible;
}
body.embed .rail {
  width: 100%;
  max-height: none;
  border-right: 0;
  border-bottom: 1px solid var(--line);
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  overflow-x: auto;
  gap: 6px;
  padding: 8px 10px;
  -webkit-overflow-scrolling: touch;
}
body.embed .rail-grp { display: none; }
body.embed .rail-item {
  flex: 0 0 auto;
  width: auto;
  min-width: 128px;
  max-width: 200px;
  margin: 0;
  padding: 7px 9px;
}
body.embed .rail-item .tenant { font-size: 12px; line-height: 1.25; }
body.embed .rail-item .meta { font-size: 9px; }
body.embed .stage { padding: 10px 12px 12px; }
body.embed .stage-h { margin-bottom: 8px; }
body.embed .stage-h h2 { font-size: 14px; }
body.embed .stage-h .hint { font-size: 10px; }
body.embed .graph-card { box-shadow: none; border-radius: 10px; }

.hdr {
  flex-shrink: 0;
  padding: 34px max(24px,calc((100vw - 1240px)/2)) 22px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, #12111a 0%, var(--bg) 100%);
}
.hdr-top { display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
h1 { margin:0; font:700 clamp(2.5rem,5vw,5rem)/1.05 var(--font-display);text-transform:none;letter-spacing:-.015em; }
.sub { font-size: 15px; color: var(--muted); max-width: 62ch; line-height: 1.55; margin-top: 12px; }
.stats { display: flex; gap: 8px; flex-wrap: wrap; margin-left: auto; }
.stat {
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--panel);
  border: 1px solid var(--line);
  font-size: 11px;
  color: var(--ink-soft);
}
.stat b { display: block; font: 600 16px/1 var(--mono); color: var(--ink); }

.maps {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-top: 12px;
}
.map-tab {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 18px 16px;
  background: var(--panel);
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.map-tab:hover { border-color: var(--line2); transform: translateY(-1px); }
.map-tab.on { border-width: 2px; background: var(--panel2); }
.map-tab.peptide.on,.map-tab.condition.on,.map-tab.drug.on { border-color: var(--governance); box-shadow: 0 0 24px rgba(200,255,77,0.12); }
.map-tab.governance.on { border-color: var(--governance); box-shadow: 0 0 24px rgba(200,255,77,0.15); }
.map-tab.evidence.on { border-color: var(--evidence); box-shadow: 0 0 24px rgba(78,207,138,0.15); }
.map-tab .k { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.map-tab .n { font-size: 15px; font-weight: 700; margin-top: 2px; color: var(--ink); }
.map-tab .c { font-size: 11px; color: var(--muted); margin-top: 4px; font-family: var(--mono); }

.toolbar {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--line);
  align-items: center;
  flex-wrap: wrap;
}
#search {
  flex: 1;
  min-width: 180px;
  max-width: 320px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--line2);
  background: var(--panel);
  color: var(--ink);
  font: 400 13px var(--sans);
  outline: none;
}
#search:focus { border-color: var(--peptide); }
.chip {
  padding: 6px 11px;
  border-radius: 99px;
  border: 1px solid var(--line2);
  background: var(--panel);
  color: var(--ink-soft);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.chip:hover { color: var(--ink); }
.chip.on { border-color: var(--nerve); color: var(--nerve); background: rgba(199,125,255,0.1); }

.main {
  flex: 1;
  display: grid;
  grid-template-columns: 300px minmax(0,1fr);
  min-height: 0;
  overflow: visible;
  width:min(1480px,100%);margin:0 auto;
}

.rail {
  border-right: 1px solid var(--line);
  overflow-y: auto;
  background: var(--panel);
  padding: 10px 8px;
}
.rail-grp {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 10px 8px 4px;
}
.rail-item {
  display: block;
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 9px 10px;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  margin-bottom: 4px;
  transition: all 0.12s;
}
.rail-item:hover { background: var(--panel2); border-color: var(--line); }
.rail-item.on { background: var(--panel2); border-color: var(--line2); }
.rail-item .tenant { font-size: 13px; font-weight: 600; line-height: 1.35; color: var(--ink); }
.rail-item .meta { font-size: 11px; color: var(--muted); font-family: var(--mono); margin-top: 3px; }
.mini-bar { display: flex; height: 4px; border-radius: 2px; overflow: hidden; margin-top: 6px; gap: 1px; }
.mini-bar span { display: block; min-width: 2px; }

.stage {
  overflow: auto;
  padding: 16px 18px;
  background: radial-gradient(ellipse at 30% 0%, rgba(212,168,83,0.04), transparent 50%),
              radial-gradient(ellipse at 80% 100%, rgba(91,159,212,0.04), transparent 45%),
              var(--bg);
}
.stage-h {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.stage-h h2 { font-size: 18px; font-weight: 700; color: var(--ink); }
.stage-h .hint { font-size: 11px; color: var(--muted); }

.graph-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: auto;
  max-height: 74vh;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35);
}
#svg { display: block; width: 100%; height: auto; }
.edge { transition: opacity 0.18s, stroke-width 0.18s, stroke 0.18s; }
.ln, .rn { transition: opacity 0.18s; }
.ln.dim, .rn.dim { opacity: 0.14; }
.ln.focus rect, .rn.focus rect { filter: drop-shadow(0 0 6px rgba(212,168,83,0.35)); }
.edge.dim { opacity: 0.08 !important; }
.edge.focus { opacity: 1 !important; stroke-width: 2.6 !important; }
.edge.focus[data-mode="peptide"] { stroke: var(--peptide) !important; }
.edge.focus[data-mode="condition"] { stroke: var(--condition) !important; }
.edge.focus[data-mode="drug"] { stroke: var(--drug) !important; }
.edge.focus[data-mode="governance"] { stroke: var(--governance) !important; }

.evidence-panel { display: none; }
.evidence-panel.on { display: block; }
.tier-chart { display: flex; align-items: flex-end; gap: 10px; height: 160px; margin-bottom: 20px; padding: 12px; background: var(--panel); border-radius: 12px; border: 1px solid var(--line); }
.tier-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
.tier-col .bar { width: 100%; border-radius: 6px 6px 2px 2px; min-height: 4px; transition: height 0.3s; }
.tier-col .tenant { font-size: 9px; color: var(--muted); text-align: center; line-height: 1.2; }
.tier-col .num { font: 600 13px var(--mono); }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.card {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  padding: 12px 14px;
  cursor: pointer;
  transition: border-color 0.12s, transform 0.12s;
  text-decoration: none;
  color: inherit;
  display: block;
}
.card:hover { border-color: var(--line2); transform: translateY(-2px); }
.card .t { font-size: 13px; font-weight: 600; line-height: 1.35; margin-bottom: 6px; color: var(--ink); }
.card .s { font-size: 10px; font-family: var(--mono); color: var(--muted); margin-bottom: 8px; }
.card .peps { font-size: 10px; color: var(--peptide); margin-bottom: 6px; }

body.theme-light a,body.theme-light a:visited,body.theme-light a:hover{color:#000;text-decoration:underline;text-underline-offset:3px}
body.theme-light ::selection{background:#e5e5e5;color:#000}

#tip {
  position: fixed;
  pointer-events: none;
  z-index: 99;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--panel2);
  border: 1px solid var(--line2);
  font-size: 11px;
  max-width: 280px;
  opacity: 0;
  transition: opacity 0.1s;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
#tip.on { opacity: 1; }

@media (max-width: 900px) {
  .maps { grid-template-columns: repeat(2, 1fr); }
  .main { grid-template-columns: 1fr; }
  .rail { max-height: 200px; border-right: 0; border-bottom: 1px solid var(--line); }
}
</style>
</head>
<body class="__BODY_CLASS__">
__GOV_HEADER__
<header class="hdr">
  <div class="hdr-top">
    <div>
      <h1>Evidence map lab</h1>
      <p class="sub">Five separate maps. Pick a lens — peptides, conditions, drugs, AI governance, or raw evidence tiers. Hover any node to isolate its edges. Click to open the article.</p>
    </div>
    <div class="stats" id="stats"></div>
  </div>
  <div class="maps" id="maps"></div>
</header>

<div class="toolbar">
  <input id="search" placeholder="Filter this map…" autocomplete="off">
  <button class="chip" id="nerveBtn" type="button">Nerve damage only</button>
  <span style="font-size:11px;color:var(--muted)" id="mapHint"></span>
</div>

<div class="main">
  <aside class="rail" id="rail"></aside>
  <section class="stage">
    <div class="stage-h">
      <h2 id="stageTitle">…</h2>
      <span class="hint" id="stageHint">hover a node — its path highlights; everything else dims</span>
    </div>
    <div id="bipartiteWrap" class="graph-card"><svg id="svg" xmlns="http://www.w3.org/2000/svg"></svg></div>
    <div id="evidencePanel" class="evidence-panel">
      <div class="tier-chart" id="tierChart"></div>
      <div class="grid" id="evGrid"></div>
    </div>
  </section>
</div>
<div id="tip"></div>

<script>
const INIT = __GRAPH_INIT__;
const MAPS = [
  { id: 'peptide', cls: 'peptide', k: 'Map 01', n: 'Peptides', c: 'primer → conditions' },
  { id: 'condition', cls: 'condition', k: 'Map 02', n: 'Conditions', c: 'disease → peptides' },
  { id: 'drug', cls: 'drug', k: 'Map 03', n: 'Pharma drugs', c: 'drug → peptides' },
  { id: 'governance', cls: 'governance', k: 'Map 04', n: 'AI Governance', c: 'family → articles' },
  { id: 'evidence', cls: 'evidence', k: 'Map 05', n: 'Evidence', c: 'tiers + leaderboard' },
];

let DATA = null;
let mode = INIT.mode || 'peptide';
let selected = INIT.selected || null;
let nerveOnly = !!INIT.nerve;
let filterQ = '';
const CURRENT_SLUG = INIT.slug || '';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function art(slug) { return DATA.articles.find(a => a.slug === slug); }

function shortNodeLabel(id, fallback) {
  const a = art(id);
  let stem = id;
  for (const p of (a?.peptides || [])) {
    if (stem === p) return DATA.peptides.find(x => x.id === p)?.label || p;
    if (stem.startsWith(p + '-')) { stem = stem.slice(p.length + 1); break; }
  }
  if (stem && stem !== id) {
    return stem.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      .replace(/\bGlp\b/g, 'GLP').replace(/\bAra\b/g, 'ARA').replace(/\bBpc\b/g, 'BPC');
  }
  const t = fallback || a?.title || id;
  return t.length > 40 ? t.slice(0, 38) + '…' : t;
}

function capSlugs(slugs, max) {
  if (!INIT.embed || slugs.length <= max) return slugs;
  const sorted = [...slugs].sort((a, b) => {
    const ah = art(a)?.tiers?.human || 0, bh = art(b)?.tiers?.human || 0;
    if (bh !== ah) return bh - ah;
    if (a === CURRENT_SLUG) return -1;
    if (b === CURRENT_SLUG) return 1;
    return 0;
  });
  const out = new Set();
  if (CURRENT_SLUG && slugs.includes(CURRENT_SLUG)) out.add(CURRENT_SLUG);
  for (const s of sorted) {
    out.add(s);
    if (out.size >= max) break;
  }
  return [...out];
}

function tierBar(tiers, w) {
  const order = DATA.tierMeta.order;
  const colors = DATA.tierMeta.color;
  const total = order.reduce((s, k) => s + (tiers[k] || 0), 0) || 1;
  return '<div class="mini-bar" style="width:' + (w || '100%') + '">' + order.map(k => {
    const n = tiers[k] || 0;
    if (!n) return '';
    return '<span style="flex:' + n + ';background:' + colors[k] + '" title="' + esc(DATA.tierMeta.label[k]) + ': ' + n + '"></span>';
  }).join('') + '</div>';
}

function renderStats() {
  const s = DATA.stats;
  document.getElementById('stats').innerHTML = [
    ['Articles', s.articles],
    ['Human claims', s.human],
    ['Sources', s.sources],
    ['Nerve articles', s.nerve_articles],
  ].map(([l, n]) => '<div class="stat"><b>' + n + '</b>' + l + '</div>').join('');
}

function renderMapTabs() {
  document.getElementById('maps').innerHTML = MAPS.map(m =>
    '<button type="button" class="map-tab ' + m.cls + (mode === m.id ? ' on' : '') + '" data-m="' + m.id + '">' +
    '<div class="k">' + m.k + '</div><div class="n">' + m.n + '</div><div class="c">' + m.c + '</div></button>'
  ).join('');
  document.getElementById('maps').querySelectorAll('.map-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.getAttribute('data-m');
      selected = null;
      render();
    });
  });
}

function itemsForMode() {
  if (mode === 'peptide') return DATA.peptides;
  if (mode === 'condition') return DATA.conditions;
  if (mode === 'drug') return DATA.drugs;
  if (mode === 'governance') return DATA.governance || [];
  return [];
}

function filteredItems(list) {
  return list.filter(item => {
    if (nerveOnly && mode === 'condition' && !item.nerve) return false;
    if (nerveOnly && mode !== 'condition' && mode !== 'evidence') {
      const arts = item.articles.map(art).filter(Boolean);
      if (!arts.some(a => a.nerve)) return false;
    }
    if (filterQ) {
      const q = filterQ.toLowerCase();
      return item.label.toLowerCase().includes(q) || item.id.includes(q);
    }
    return true;
  });
}

function renderRail() {
  const rail = document.getElementById('rail');
  if (mode === 'evidence') {
    rail.innerHTML = '<div class="rail-grp">Sort</div>' +
      ['human', 'score', 'claims'].map(k =>
        '<button type="button" class="rail-item' + (selected === k ? ' on' : '') + '" data-s="' + k + '">' +
        '<div class="tenant">' + (k === 'human' ? 'Human trials first' : k === 'score' ? 'Evidence score' : 'Most claims') + '</div></button>'
      ).join('');
    rail.querySelectorAll('.rail-item').forEach(btn => {
      btn.addEventListener('click', () => { selected = btn.getAttribute('data-s'); renderEvidence(); renderRail(); });
    });
    if (!selected) selected = 'human';
    return;
  }

  const list = filteredItems(itemsForMode()).slice(0, 14);
  let html = '';
  if (mode === 'condition') {
    const byGrp = {};
    list.forEach(item => { (byGrp[item.group || 'other'] = byGrp[item.group || 'other'] || []).push(item); });
    Object.keys(DATA.groups).forEach(gk => {
      if (!byGrp[gk]?.length) return;
      html += '<div class="rail-grp">' + esc(DATA.groups[gk]) + '</div>';
      byGrp[gk].forEach(item => { html += railItem(item); });
    });
  } else {
    html += '<div class="rail-grp">' + (mode === 'peptide' ? 'Peptide primers' : mode === 'governance' ? 'AI governance families' : 'Pharmaceuticals') + '</div>';
    list.forEach(item => { html += railItem(item); });
  }
  rail.innerHTML = html || '<div class="rail-grp">No matches</div>';
  rail.querySelectorAll('.rail-item').forEach(btn => {
    btn.addEventListener('click', () => {
      selected = btn.getAttribute('data-id');
      renderBipartite();
      renderRail();
    });
  });
  if (!selected && list.length) selected = list[0].id;
}

function railItem(item) {
  return '<button type="button" class="rail-item' + (selected === item.id ? ' on' : '') + '" data-id="' + esc(item.id) + '">' +
    '<div class="tenant">' + esc(item.label) + '</div>' +
    '<div class="meta">' + item.articles.length + ' articles · ' + (item.human || 0) + ' human</div>' +
    tierBar(item.tiers) + '</button>';
}

function renderBipartite() {
  document.getElementById('bipartiteWrap').style.display = '';
  document.getElementById('evidencePanel').classList.remove('on');

  const list = filteredItems(itemsForMode());
  const item = list.find(x => x.id === selected) || list[0];
  if (!item) {
    document.getElementById('svg').innerHTML = '';
    document.getElementById('stageTitle').textContent = 'No data';
    return;
  }
  selected = item.id;

  let leftLabel, rightLabel, leftNodes, rightNodes, edges;
  if (mode === 'peptide' || mode === 'governance') {
    const isGov = mode === 'governance';
    leftLabel = isGov ? 'ARTICLES' : 'CONDITIONS & ARTICLES';
    rightLabel = isGov ? 'FAMILY' : 'PEPTIDE';
    const arts = capSlugs(item.articles, 14);
    leftNodes = arts.map(slug => {
      const a = art(slug);
      const label = INIT.embed ? shortNodeLabel(slug, a?.title) : (a ? a.title : slug);
      return { id: slug, label, sub: slug, color: isGov ? 'var(--governance)' : 'var(--condition)' };
    });
    rightNodes = [{ id: item.id, label: item.label, sub: item.id, color: isGov ? 'var(--governance)' : 'var(--peptide)' }];
    edges = leftNodes.map(n => ({ l: n.id, r: item.id }));
    document.getElementById('stageTitle').textContent = item.label + ' → ' + leftNodes.length + ' articles';
  } else if (mode === 'condition') {
    leftLabel = 'CONDITION';
    rightLabel = 'PEPTIDES & ARTICLES';
    leftNodes = [{ id: item.id, label: item.label, sub: item.id, color: 'var(--condition)' }];
    const pepArts = new Map();
    capSlugs(item.articles, 14).forEach(slug => {
      const a = art(slug);
      (a?.peptides || []).forEach(p => {
        if (!pepArts.has(p)) pepArts.set(p, []);
        pepArts.get(p).push(slug);
      });
    });
    rightNodes = [];
    edges = [];
    pepArts.forEach((slugs, pid) => {
      const label = DATA.peptides.find(p => p.id === pid)?.label || pid;
      slugs.forEach(slug => {
        const a = art(slug);
        const label = INIT.embed ? shortNodeLabel(slug, a?.title) : (a ? a.title : slug);
        rightNodes.push({ id: slug, label, sub: pid, color: 'var(--peptide)' });
        edges.push({ l: item.id, r: slug });
      });
    });
    document.getElementById('stageTitle').textContent = item.label + ' ← ' + new Set(rightNodes.map(n => n.sub)).size + ' peptides';
  } else {
    leftLabel = 'DRUG';
    rightLabel = 'PEPTIDE ARTICLES';
    leftNodes = [{ id: item.id, label: item.label, sub: item.id, color: 'var(--drug)' }];
    const darts = capSlugs(item.articles, 14);
    rightNodes = darts.map(slug => {
      const a = art(slug);
      const label = INIT.embed ? shortNodeLabel(slug, a?.title) : (a ? a.title : slug);
      return { id: slug, label, sub: (a?.peptides || []).join(', '), color: 'var(--peptide)' };
    });
    edges = rightNodes.map(n => ({ l: item.id, r: n.id }));
    document.getElementById('stageTitle').textContent = item.label + ' × ' + rightNodes.length + ' peptide articles';
  }

  drawBipartite(leftLabel, rightLabel, leftNodes, rightNodes, edges);
}

function drawBipartite(leftLabel, rightLabel, leftNodes, rightNodes, edges) {
  const W = INIT.embed ? 920 : 1100;
  const row = INIT.embed ? 24 : 28;
  const padT = INIT.embed ? 32 : 40;
  const lx = 16, lw = INIT.embed ? 360 : 420;
  const rx = W - (INIT.embed ? 300 : 340), rw = INIT.embed ? 280 : 320;
  const H = Math.max(padT * 2 + Math.max(leftNodes.length, rightNodes.length) * row, 280);
  const lY = {}, rY = {};
  leftNodes.forEach((n, i) => { lY[n.id] = padT + i * row + row / 2; });
  rightNodes.forEach((n, i) => { rY[n.id] = padT + i * row + row / 2; });

  let svg = '';
  svg += '<text x="' + (lx + lw / 2) + '" y="22" font-size="11" font-weight="700" text-anchor="middle" fill="var(--svg-muted,#b0a99e)" letter-spacing="0.08em">' + esc(leftLabel) + '</text>';
  svg += '<text x="' + (rx + rw / 2) + '" y="22" font-size="11" font-weight="700" text-anchor="middle" fill="var(--svg-muted,#b0a99e)" letter-spacing="0.08em">' + esc(rightLabel) + '</text>';

  edges.forEach(e => {
    const y1 = lY[e.l], y2 = rY[e.r];
    if (y1 == null || y2 == null) return;
    const x1 = lx + lw, x2 = rx;
    const mx = (x1 + x2) / 2;
    svg += '<path class="edge" data-mode="' + esc(mode) + '" data-l="' + esc(e.l) + '" data-r="' + esc(e.r) + '" d="M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 + '" fill="none" stroke="#5a5668" stroke-width="1.3" opacity="0.42"/>';
  });

  function node(x, y, w, n, side) {
    const maxLen = INIT.embed ? 34 : 52;
    const label = n.label.length > maxLen ? n.label.slice(0, maxLen - 2) + '…' : n.label;
    const attr = side === 'l' ? 'data-l="' + esc(n.id) + '"' : 'data-r="' + esc(n.id) + '"';
    const cls = side === 'l' ? 'ln' : 'rn';
    const isHere = n.id === CURRENT_SLUG;
    const fill = isHere ? 'rgba(212,168,83,0.18)' : 'var(--node-fill,#1b1a24)';
    const stroke = isHere ? '#d4a853' : (n.color || '#8a8478');
    const sw = isHere ? 2.2 : 1.3;
    return '<g class="' + cls + (isHere ? ' here' : '') + '" ' + attr + ' style="cursor:pointer">' +
      '<rect x="' + x + '" y="' + (y - 11) + '" width="' + w + '" height="22" rx="6" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>' +
      '<text x="' + (x + 10) + '" y="' + (y + 4) + '" font-size="' + (INIT.embed ? '11' : '12') + '" font-weight="' + (isHere ? '600' : '500') + '" fill="var(--node-stroke-text,#faf8f5)" font-family="IBM Plex Sans, sans-serif">' + esc(label) + '</text></g>';
  }

  leftNodes.forEach(n => { svg += node(lx, lY[n.id], lw, n, 'l'); });
  rightNodes.forEach(n => { svg += node(rx, rY[n.id], rw, n, 'r'); });

  const el = document.getElementById('svg');
  el.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  el.innerHTML = svg;

  const tip = document.getElementById('tip');

  function focusPath(side, id) {
    const touchL = new Set(), touchR = new Set();
    edges.forEach(e => {
      if (side === 'l' && e.l === id) { touchL.add(e.l); touchR.add(e.r); }
      if (side === 'r' && e.r === id) { touchL.add(e.l); touchR.add(e.r); }
    });
    if (side === 'l') touchL.add(id);
    else touchR.add(id);

    el.querySelectorAll('.ln').forEach(n => {
      const nid = n.getAttribute('data-l');
      const on = touchL.has(nid);
      n.classList.toggle('dim', !on);
      n.classList.toggle('focus', nid === id);
    });
    el.querySelectorAll('.rn').forEach(n => {
      const nid = n.getAttribute('data-r');
      const on = touchR.has(nid);
      n.classList.toggle('dim', !on);
      n.classList.toggle('focus', nid === id);
    });
    el.querySelectorAll('.edge').forEach(ed => {
      const on = side === 'l'
        ? ed.getAttribute('data-l') === id
        : ed.getAttribute('data-r') === id;
      ed.classList.toggle('dim', !on);
      ed.classList.toggle('focus', on);
    });
  }

  function clearFocus() {
    el.querySelectorAll('.ln, .rn').forEach(n => {
      n.classList.remove('dim', 'focus');
    });
    el.querySelectorAll('.edge').forEach(ed => {
      ed.classList.remove('dim', 'focus');
    });
    tip.classList.remove('on');
  }

  el.querySelectorAll('.ln').forEach(n => {
    const id = n.getAttribute('data-l');
    const a = art(id);
    n.addEventListener('mouseenter', ev => {
      focusPath('l', id);
      tip.innerHTML = '<b>' + esc(a?.title || id) + '</b><br><span style="color:var(--muted);font-family:monospace;font-size:10px">' + esc(id) + '</span>';
      tip.style.left = ev.clientX + 'px'; tip.style.top = ev.clientY + 'px';
      tip.classList.add('on');
    });
    n.addEventListener('mousemove', ev => { tip.style.left = ev.clientX + 'px'; tip.style.top = ev.clientY + 'px'; });
    n.addEventListener('mouseleave', clearFocus);
    n.addEventListener('click', () => goArticle(id));
  });

  el.querySelectorAll('.rn').forEach(n => {
    const id = n.getAttribute('data-r');
    const a = art(id);
    n.addEventListener('mouseenter', ev => {
      focusPath('r', id);
      tip.innerHTML = '<b>' + esc(a?.title || id) + '</b>' +
        (a ? '<br><span style="color:var(--muted);font-family:monospace;font-size:10px">' + esc(id) + '</span>' : '');
      tip.style.left = ev.clientX + 'px'; tip.style.top = ev.clientY + 'px';
      tip.classList.add('on');
    });
    n.addEventListener('mousemove', ev => { tip.style.left = ev.clientX + 'px'; tip.style.top = ev.clientY + 'px'; });
    n.addEventListener('mouseleave', clearFocus);
    n.addEventListener('click', () => {
      if (a) goArticle(id);
      else {
        const pep = DATA.peptides.find(p => p.id === id);
        if (pep) { mode = 'peptide'; selected = id; render(); }
      }
    });
  });
}

function goArticle(slug) {
  const href = '/a/' + encodeURIComponent(slug);
  if (INIT.embed && window.parent && window.parent !== window) window.parent.location.href = href;
  else window.open(href, '_blank');
}

function renderEvidence() {
  document.getElementById('bipartiteWrap').style.display = 'none';
  document.getElementById('evidencePanel').classList.add('on');
  document.getElementById('stageTitle').textContent = 'Evidence tiers — whole library';
  document.getElementById('stageHint').textContent = DATA.stats.claims + ' claims · ' + DATA.stats.sources + ' sources';

  const tiers = DATA.evidence.tiers;
  const colors = DATA.tierMeta.color;
  const labels = DATA.tierMeta.label;
  const max = Math.max(...Object.values(tiers), 1);

  document.getElementById('tierChart').innerHTML = DATA.tierMeta.order.map(k => {
    const n = tiers[k] || 0;
    const h = Math.max(8, Math.round(n / max * 130));
    return '<div class="tier-col"><div class="num">' + n + '</div><div class="bar" style="height:' + h + 'px;background:' + colors[k] + '"></div><div class="tenant">' + esc(labels[k]) + '</div></div>';
  }).join('');

  let list = [...DATA.articles];
  if (nerveOnly) list = list.filter(a => a.nerve);
  if (filterQ) {
    const q = filterQ.toLowerCase();
    list = list.filter(a => a.slug.includes(q) || a.title.toLowerCase().includes(q));
  }
  const sort = selected || 'human';
  if (sort === 'human') list.sort((a, b) => b.tiers.human - a.tiers.human || b.score - a.score);
  else if (sort === 'score') list.sort((a, b) => b.score - a.score);
  else list.sort((a, b) => b.claims - a.claims);

  document.getElementById('evGrid').innerHTML = list.slice(0, 60).map(a =>
    '<a class="card" href="/a/' + encodeURIComponent(a.slug) + '" target="_blank">' +
    '<div class="t">' + esc(a.title) + '</div>' +
    '<div class="s">' + esc(a.slug) + ' · ' + a.claims + ' claims · ' + a.sources + ' sources · score ' + Math.round(a.score) + '</div>' +
    '<div class="peps">' + (a.peptides.map(p => DATA.peptides.find(x => x.id === p)?.label || p).join(' · ') || '—') + '</div>' +
    tierBar(a.tiers) + '</a>'
  ).join('');
}

function render() {
  renderMapTabs();
  renderRail();
  document.getElementById('mapHint').textContent = MAPS.find(m => m.id === mode).c;
  if (mode === 'evidence') renderEvidence();
  else renderBipartite();
}

document.getElementById('search').addEventListener('input', e => {
  filterQ = e.target.value.trim();
  render();
});
document.getElementById('nerveBtn').addEventListener('click', () => {
  nerveOnly = !nerveOnly;
  document.getElementById('nerveBtn').classList.toggle('on', nerveOnly);
  render();
});

if (INIT.nerve) document.getElementById('nerveBtn')?.classList.add('on');

fetch('/graph?data=1').then(r => {
  if (!r.ok) throw new Error('graph data ' + r.status);
  return r.json();
}).then(d => {
  DATA = d;
  if (!INIT.embed) renderStats();
  else document.getElementById('stat')?.remove();
  render();
}).catch(err => {
  console.error(err);
  document.getElementById('stageTitle').textContent = 'Failed to load map data';
  document.getElementById('stageHint').textContent = String(err.message || err);
});
</script>
</body>
</html>`;
