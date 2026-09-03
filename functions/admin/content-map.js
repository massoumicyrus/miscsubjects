import { shellHtml } from './_layout.js';
import { normalizeWidget, renderRail, shortHash, vaultStyles } from '../_lib/vault_widgets.js';

// YOUR EXACT LIST — individual peptides + combinatorial + comparisons
const PEPTIDES = [
  { id:'bpc-157', name:'BPC-157' },
  { id:'tb-500', name:'TB-500' },
  { id:'ara-290', name:'ARA-290' },
  { id:'semax', name:'Semax' },
  { id:'selank', name:'Selank' },
  { id:'pt-141', name:'PT-141' },
  { id:'dsip', name:'DSIP' },
  { id:'kpv', name:'KPV' },
  { id:'ghk-cu', name:'GHK-Cu' },
  { id:'thymosin-a1', name:'Thymosin Alpha-1' },
  { id:'mots-c', name:'MOTS-C' },
  { id:'ss-31', name:'SS-31' },
  { id:'retatutride', name:'Retatutride' },
  { id:'tirzepatide', name:'Tirzepatide' },
  { id:'tesamorelin', name:'Tesamorelin' },
];

const COMBINATORIAL = [
  { id:'wolverine', name:'Wolverine Stack (BPC + TB)' },
  { id:'recovery', name:'Recovery Stack (BPC + TB + ARA)' },
  { id:'aging', name:'Aging Stack (BPC + TB + GHK-Cu)' },
  { id:'adderall', name:'Adderall Stack (Semax + Selank + BPC)' },
  { id:'cognitive', name:'Cognitive Stack (Semax + DSIP + Selank)' },
  { id:'bpc-ara-disc', name:'BPC + ARA (disc)' },
  { id:'bpc-kpv-gut', name:'BPC + KPV (gut)' },
  { id:'semax-selank', name:'Semax + Selank' },
  { id:'pt-selank', name:'PT-141 + Selank' },
];

const COMPARISONS = [
  { id:'bpc-vs-nsaids', name:'BPC vs NSAIDs' },
  { id:'bpc-vs-ppis', name:'BPC vs PPIs' },
  { id:'ara-vs-gaba', name:'ARA vs Gabapentin' },
];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function apiUrl(request, path) {
  return new URL(path, request.url).toString();
}

async function fetchJson(request, path) {
  try {
    const r = await fetch(apiUrl(request, path), {
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
    });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch (e) {
    return null;
  }
}

function buildDirRail(rows) {
  const cards = (rows || []).slice(0, 12).map(r => {
    const ts = String(r.updated_at || '').slice(0, 19).replace('T', ' ');
    const hash = shortHash(String(r.row_num) + '|' + r.key + '|' + r.type);
    const href = '/admin/directory/' + encodeURIComponent(r.key);
    const inner =
      `<div class="vc-top"><span class="vc-mark dir-mark">${esc(String(r.row_num))}</span><span class="vc-kind">${esc(r.type)}</span></div>` +
      `<div class="vc-title">${esc(r.key)}</div>` +
      `<div class="vc-body">${esc(r.category || '—')}</div>` +
      `<div class="vc-foot"><span class="vc-id">row #${esc(String(r.row_num))}</span><span class="vc-hash">${esc(hash.slice(0, 12))}</span>${ts ? `<span class="vc-ts">${esc(ts)}</span>` : ''}</div>`;
    return `<a class="vault-card directory" href="${esc(href)}">${inner}</a>`;
  }).join('');
  return `<section class="vault-band"><div class="vault-band-head"><h2>Directory rows</h2><a href="/api/directory?format=json">JSON</a></div><div class="vault-rail">${cards || '<div class="empty">No directory rows.</div>'}</div></section>`;
}

function buildTaskRail(tasks) {
  const widgets = (tasks || []).slice(0, 12).map(t => normalizeWidget('task', {
    id: 'task:' + t.id,
    title: (t.role || 'task') + ' #' + t.id,
    body: (t.job && (t.job.ask || t.job.item || t.job.title || t.job.body)) || String(t.job || '').slice(0, 200),
    ts: t.created_at,
    status: t.status + (t.google_task_id ? ' · gtask' : ''),
    href: '/admin/tasks',
    api: '/api/tasks/' + t.id,
  }));
  return renderRail('Open tasks', widgets, '/api/tasks?format=json');
}

function buildLedgerRail(data) {
  const w = (data && data.widgets) || {};
  const all = [...(w.events || []), ...(w.cards || []), ...(w.claims || [])].slice(0, 16);
  return renderRail('Ledger widgets', all, '/api/ledger/widgets');
}

export async function onRequestGet(context) {
  const { request, env } = context;

  // Pull live status from D1
  let liveSlugs = new Set();
  let latestArticles = [];
  try {
    const rows = await env.DB.prepare("SELECT slug, title, subject, created_at, updated_at FROM articles WHERE published = 1 ORDER BY created_at DESC, slug ASC LIMIT 100").all();
    (rows.results || []).forEach(r => liveSlugs.add(r.slug));
    latestArticles = rows.results || [];
  } catch(e) {}

  const total = PEPTIDES.length + COMBINATORIAL.length + COMPARISONS.length;
  const liveCount = [...PEPTIDES, ...COMBINATORIAL, ...COMPARISONS].filter(x => liveSlugs.has(x.id)).length;
  const latestHtml = latestArticles.slice(0, 24).map(a => `<a class="latest-card" href="/a/${encodeURIComponent(a.slug)}"><strong>${esc(a.title || a.slug)}</strong><span>${esc(String(a.created_at || '').slice(0, 10))}</span><code>${esc(a.slug)}</code></a>`).join('');

  // Live widget data
  const [dirData, taskData, ledgerData] = await Promise.all([
    fetchJson(request, '/api/directory?format=json'),
    fetchJson(request, '/api/tasks?format=json'),
    fetchJson(request, '/api/ledger/widgets?format=json'),
  ]);

  function node(item) {
    const isLive = liveSlugs.has(item.id);
    return `<div class="node ${isLive ? 'live' : ''}">
      <span class="status-dot"></span>
      <span class="name">${esc(item.name)}</span>
      <span class="badge">${isLive ? 'LIVE' : 'DRAFT'}</span>
    </div>`;
  }

  const body = `
<style>
${vaultStyles()}
.cm{max-width:1200px}
.cm h1{margin:0 0 4px}
.cm .subtitle{color:var(--muted);font-size:13px;margin-bottom:var(--space-2,14px)}

/* Compact stats bar */
.cm .stats-bar{display:flex;gap:0;margin-bottom:var(--space-3,16px);border:1px solid var(--line);border-radius:var(--radius,10px);overflow:hidden;background:var(--panel)}
.cm .stats-bar > div{flex:1;padding:12px 14px;text-align:center;border-right:1px solid var(--line);font-size:13px}
.cm .stats-bar > div:last-child{border-right:0}
.cm .stats-bar .num{font-family:var(--font-display);font-size:30px;font-weight:600;color:var(--accent);display:block;line-height:1}
.cm .stats-bar .tenant{font:600 9px/1 var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.13em;margin-top:6px;display:block}
.cm .stats-bar .live .num{color:var(--ds-sage,#7a9a7b)}
.cm .stats-bar .notlive .num{color:#b86b5a}

/* Sections */
.cm .section{margin-bottom:var(--space-3,18px)}
.cm .section-h{font:600 10px/1 var(--mono);text-transform:uppercase;letter-spacing:.15em;color:var(--accent);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--line)}

/* Nodes */
.cm .nodes{display:flex;flex-wrap:wrap;gap:7px}
.cm .node{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:7px;padding:6px 11px;font-size:12.5px;background:var(--panel);cursor:default;transition:border-color .12s,transform .12s}
.cm .node:hover{border-color:var(--accent);transform:translateY(-1px)}
.cm .node .status-dot{width:7px;height:7px;border-radius:99px;display:inline-block;background:#4a4f58}
.cm .node.live .status-dot{background:var(--ds-sage,#7a9a7b);box-shadow:0 0 0 2px rgba(122,154,123,.16);animation:livePulse 2s ease-in-out infinite}
.cm .node.live{border-color:rgba(122,154,123,.42);background:rgba(122,154,123,.08)}
.cm .node .name{font-weight:600;color:var(--ink)}
.cm .node .badge{font:700 9px/1 var(--mono);padding:2px 6px;border-radius:99px;background:var(--raised,#1d2129);color:var(--muted);margin-left:2px;letter-spacing:.08em}
.cm .node.live .badge{background:rgba(122,154,123,.16);color:var(--ds-sage,#7a9a7b)}

/* Actions */
.cm .cm-actions{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:var(--space-3,16px)}
.cm .cm-actions a{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line-strong);border-radius:7px;padding:7px 13px;background:var(--panel);color:var(--accent);font-weight:600;font-size:12px;text-decoration:none}
.cm .cm-actions a:hover{border-color:var(--accent);background:var(--ds-accent-soft,rgba(201,169,97,.12));text-decoration:none}
.cm .latest-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:8px}
.cm .latest-card{display:grid;grid-template-columns:1fr auto;gap:3px 12px;border:1px solid var(--line);border-radius:7px;padding:10px 12px;background:var(--panel);color:var(--ink);text-decoration:none}
.cm .latest-card:hover{border-color:var(--accent);text-decoration:none}.cm .latest-card span,.cm .latest-card code{font:10px/1.4 var(--mono);color:var(--muted)}.cm .latest-card code{grid-column:1/-1}
.cm .audit-drop{border:2px solid #000;background:#fff;color:#000;padding:15px;margin:0 0 14px}.cm .audit-drop a{display:block;color:#000;text-decoration:underline;overflow-wrap:anywhere}

/* Widgets band */
.cm .widgets-band{margin-top:var(--space-3,20px)}
.cm .widgets-band .vault-band{margin:14px 0}
.cm .vault-card{background:var(--panel);box-shadow:none}
.cm .vault-card:hover{box-shadow:0 12px 32px rgba(0,0,0,.4)}
.cm .vault-card.task{--vc:#c9a961}.cm .vault-card.event{--vc:#8fa8c9}.cm .vault-card.card{--vc:#a99bd4}.cm .vault-card.claim{--vc:#7a9a7b}.cm .vault-card.protected{--vc:#b86b5a}.cm .vault-card.idea{--vc:#d08a6a}
.cm .vault-card.directory{--vc:#c9a961}
.cm .vc-mark{color:#0c0e12}
.cm .dir-mark{font-size:10px}

/* Prompt box */
.cm .prompt-box{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius,10px);margin-top:var(--space-3,18px);overflow:hidden}
.cm .prompt-box .ph{padding:11px 14px;background:var(--raised,#1d2129);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}
.cm .prompt-box .ph h3{font:600 10px/1 var(--mono);color:var(--accent);text-transform:uppercase;letter-spacing:.15em;margin:0}
.cm .prompt-box .ph a{font-size:12px;color:var(--accent);text-decoration:none;font-weight:600}
.cm .prompt-box .ph a:hover{text-decoration:underline}
.cm .prompt-box pre{margin:0;padding:14px;background:var(--panel);border:none;white-space:pre-wrap;font-family:var(--mono);font-size:12px;line-height:1.65;max-height:360px;overflow:auto;color:var(--ink-soft)}

@keyframes livePulse{
  0%,100%{box-shadow:0 0 0 2px rgba(122,154,123,.16)}
  50%{box-shadow:0 0 0 5px rgba(122,154,123,0)}
}
</style>

<div class="cm">
<h1>Content inventory</h1>
<p class="subtitle">Every article mapped. Green dot = live. Grey dot = not written yet.</p>

<div class="cm-actions">
  <a href="/opos">Audit Tap &amp; Go →</a>
  <a href="/api/dispatch?tap_go=1&amp;drop=audit">Mint bounded build-audit token DROP →</a>
  <a href="/widgets">Widget gallery →</a>
  <a href="/api/ledger/widgets">Ledger widgets →</a>
  <a href="/api/tasks?format=widgets">Task widgets →</a>
  <a href="/admin/directory">Directory rows →</a>
</div>

<div class="stats-bar">
  <div><span class="num">${total}</span><span class="tenant">Total mapped</span></div>
  <div class="live"><span class="num">${liveCount}</span><span class="tenant">Live</span></div>
  <div class="notlive"><span class="num">${total - liveCount}</span><span class="tenant">Not live</span></div>
  <div><span class="num">${PEPTIDES.length}</span><span class="tenant">Peptides</span></div>
</div>

<div class="audit-drop"><strong>Whole-build model audit Tap &amp; Go</strong><a href="/api/dispatch?tap_go=1&amp;drop=audit">${esc(new URL('/api/dispatch?tap_go=1&drop=audit', request.url).toString())}</a></div>

<div class="section">
  <div class="section-h">Newest added content</div>
  <div class="latest-grid">${latestHtml || '<div class="empty">No published content.</div>'}</div>
</div>

<div class="section">
  <div class="section-h">Individual peptides</div>
  <div class="nodes">${PEPTIDES.map(node).join('')}</div>
</div>

<div class="section">
  <div class="section-h">Combinatorial stacks</div>
  <div class="nodes">${COMBINATORIAL.map(node).join('')}</div>
</div>

<div class="section">
  <div class="section-h">Comparisons</div>
  <div class="nodes">${COMPARISONS.map(node).join('')}</div>
</div>

<div class="widgets-band" id="live-rails">
  <div class="section-h">Live widgets · directory rows · ledger · tasks</div>
  ${buildDirRail(dirData && dirData.rows)}
  ${buildLedgerRail(ledgerData)}
  ${buildTaskRail(taskData && taskData.tasks)}
</div>

<div class="prompt-box">
  <div class="ph">
    <h3>Writer prompt (WRITER_AGENT)</h3>
    <a href="/admin/directory/WRITER_AGENT" target="_blank">Edit →</a>
  </div>
  <div id="prompt-content"><pre>Loading…</pre></div>
</div>
</div>

<script>
fetch('/api/directory/WRITER_AGENT').then(function(r){return r.json();}).then(function(d){
  var el = document.getElementById('prompt-content');
  if(d && d.content){
    el.innerHTML = '<pre>' + d.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</pre>';
  } else {
    el.innerHTML = '<pre>Prompt not found.</pre>';
  }
}).catch(function(e){
  document.getElementById('prompt-content').innerHTML = '<pre>Error: ' + e.message + '</pre>';
});
</script>

<script type="module">
function shortHash(input) {
  let h = 2166136261;
  const s = String(input == null ? '' : input);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function renderVaultCard(widget) {
  const w = widget || {};
  const kind = String(w.kind || 'card');
  const mark = { task: 'TK', event: 'EV', card: 'CD', claim: 'CL', protected: 'LK', idea: 'ID' }[kind] || 'VA';
  const inner =
    '<div class="vc-top"><span class="vc-mark">' + esc(mark) + '</span><span class="vc-kind">' + esc(kind) + '</span>' + (w.status ? '<span class="vc-status">' + esc(w.status) + '</span>' : '') + '</div>' +
    '<div class="vc-title">' + esc(w.title || w.id || kind) + '</div>' +
    '<div class="vc-body">' + esc(w.body || '') + '</div>' +
    '<div class="vc-foot"><span class="vc-id">' + esc(w.id || '') + '</span><span class="vc-hash">' + esc(String(w.hash || '').slice(0, 12)) + '</span>' + (w.ts ? '<span class="vc-ts">' + esc(String(w.ts).slice(0, 19).replace('T', ' ')) + '</span>' : '') + '</div>';
  if (w.href || w.api) {
    return '<a class="vault-card ' + esc(kind) + '" href="' + esc(w.href || w.api) + '">' + inner + '</a>';
  }
  return '<div class="vault-card ' + esc(kind) + '">' + inner + '</div>';
}

function renderRail(title, widgets, href) {
  const cards = (widgets || []).map(renderVaultCard).join('');
  return '<section class="vault-band"><div class="vault-band-head"><h2>' + esc(title) + '</h2>' + (href ? '<a href="' + esc(href) + '">JSON</a>' : '') + '</div><div class="vault-rail">' + (cards || '<div class="empty">No rows.</div>') + '</div></section>';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function normTask(t) {
  const body = (t.job && (t.job.ask || t.job.item || t.job.title || t.job.body)) || String(t.job || '').slice(0, 200);
  return {
    kind: 'task',
    id: 'task:' + t.id,
    title: (t.role || 'task') + ' #' + t.id,
    body: body,
    ts: t.created_at,
    status: t.status + (t.google_task_id ? ' · gtask' : ''),
    href: '/admin/tasks',
    api: '/api/tasks/' + t.id,
    hash: shortHash('task|' + t.id + '|' + body + '|' + t.created_at)
  };
}

function buildDirRail(rows) {
  const cards = (rows || []).slice(0, 12).map(r => {
    const ts = String(r.updated_at || '').slice(0, 19).replace('T', ' ');
    const hash = shortHash(String(r.row_num) + '|' + r.key + '|' + r.type);
    const href = '/admin/directory/' + encodeURIComponent(r.key);
    const inner =
      '<div class="vc-top"><span class="vc-mark dir-mark">' + esc(String(r.row_num)) + '</span><span class="vc-kind">' + esc(r.type) + '</span></div>' +
      '<div class="vc-title">' + esc(r.key) + '</div>' +
      '<div class="vc-body">' + esc(r.category || '—') + '</div>' +
      '<div class="vc-foot"><span class="vc-id">row #' + esc(String(r.row_num)) + '</span><span class="vc-hash">' + esc(hash.slice(0, 12)) + '</span>' + (ts ? '<span class="vc-ts">' + esc(ts) + '</span>' : '') + '</div>';
    return '<a class="vault-card directory" href="' + esc(href) + '">' + inner + '</a>';
  }).join('');
  return '<section class="vault-band"><div class="vault-band-head"><h2>Directory rows</h2><a href="/api/directory?format=json">JSON</a></div><div class="vault-rail">' + (cards || '<div class="empty">No directory rows.</div>') + '</div></section>';
}

function buildTaskRail(tasks) {
  return renderRail('Open tasks', (tasks || []).slice(0, 12).map(normTask), '/api/tasks?format=json');
}

function buildLedgerRail(data) {
  const w = (data && data.widgets) || {};
  const all = [...(w.events || []), ...(w.cards || []), ...(w.claims || [])].slice(0, 16);
  return renderRail('Ledger widgets', all, '/api/ledger/widgets');
}

async function fetchJson(url) {
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

let SIG = '';
async function refresh() {
  const [dir, tasks, ledger] = await Promise.all([
    fetchJson('/api/directory?format=json'),
    fetchJson('/api/tasks?format=json'),
    fetchJson('/api/ledger/widgets?format=json'),
  ]);
  const html = buildDirRail(dir && dir.rows) + buildLedgerRail(ledger) + buildTaskRail(tasks && tasks.tasks);
  const sig = JSON.stringify({ dir: dir && dir.rows, tasks: tasks && tasks.tasks, ledger: ledger && ledger.widgets });
  const host = document.getElementById('live-rails');
  if (host && sig !== SIG) {
    SIG = sig;
    host.innerHTML = '<div class="section-h">Live widgets · directory rows · ledger · tasks</div>' + html;
  }
}

// First refresh after a short delay so the initial server-rendered rail is already visible.
setTimeout(refresh, 2000);
setInterval(refresh, 10000);
</script>
`;

  return new Response(shellHtml({ activeHref: '/admin/content-map', title: 'Content inventory', body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
