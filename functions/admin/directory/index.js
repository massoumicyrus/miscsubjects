import { shellHtml, CATEGORY_COLOR } from '../_layout.js';
import { workbookResponse } from '../sheets/index.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  {
    const passthrough = ['view', 'share', 'terminal_key', 'tk', 'tab', 'kind', 'sort', 'cell', 'id', 'field'];
    const paramKeys = [...url.searchParams.keys()].filter(
      (k) => !passthrough.includes(k) && !k.startsWith('f.') && !k.startsWith('v.'),
    );
    if (!paramKeys.length && url.searchParams.get('view') !== 'classic') {
      return workbookResponse('directory', '/admin/directory');
    }
  }

  // Agents WITH their full prompt content — the relationship graph scans these for the
  // [TOOL] tags each agent references. (The 'directory' feed omits content for weight.)
  if (url.searchParams.get('data') === 'agents') {
    const a = await env.DB.prepare(
      "SELECT key, type, target, category, content FROM directory WHERE type = 'agent' ORDER BY (key='ROUTER') DESC, key ASC"
    ).all();
    const t = await env.DB.prepare(
      "SELECT key, type, category FROM directory WHERE type != 'agent' ORDER BY key ASC"
    ).all();
    return new Response(JSON.stringify({ agents: a.results || [], tools: t.results || [] }), { headers: { 'content-type': 'application/json' } });
  }

  if (url.searchParams.get('data') === 'directory') {
    const r = await env.DB.prepare(
      `SELECT key, type, target, category, created_at, length(content) AS size
       FROM directory
       ORDER BY (type = 'agent') DESC, (key = 'ROUTER') DESC, category ASC, key ASC`
    ).all();
    // Usage per capability: how many times each directory key has actually been invoked
    // (from the shared event ledger). Powers the "# of times used" sort/filter.
    const usage = {};
    try {
      const u = await env.LEDGER.prepare('SELECT key, COUNT(*) n FROM events WHERE key IS NOT NULL GROUP BY key').all();
      for (const row of (u.results || [])) usage[row.key] = row.n;
    } catch { /* usage optional */ }
    const dirRows = (r.results || []).map(row => ({ ...row, used: usage[row.key] || 0 }));
    // CONTENT = the live article corpus. Every published /a/<slug> is a content node
    // (projection of the ledger, not a copy) — displayed by its real title, addressable
    // by slug. content_items is a legacy staging table (empty); the articles table is the
    // source of truth, so the directory reads it directly and the Content count is real.
    const c = await env.DB.prepare(
      `SELECT slug AS key, 'content' AS type, COALESCE(title, slug) AS target,
              'content' AS category, created_at, updated_at,
              '/a/' || slug AS href, length(body) AS size
       FROM articles WHERE published = 1
       ORDER BY created_at DESC, slug ASC`
    ).all();
    // Site pages (privacy, m, a1, esh-*, reta, success, …) — every link, on the directory.
    const pg = await env.DB.prepare(
      `SELECT slug AS key, 'page' AS type, COALESCE(title, slug) AS target, 'page' AS category,
              COALESCE((SELECT MIN(created_at) FROM pages_versions pv WHERE pv.slug = pages.slug), updated_at) AS created_at,
              updated_at
       FROM pages ORDER BY slug ASC`
    ).all();
    const auditDrop = {
      key: 'OPOS_AUDIT_TAP_GO', type: 'content',
      target: 'Tap & Go — complete whole-build model audit DROP with root articles',
      category: 'audit', created_at: '2026-07-22T00:00:00Z', updated_at: '2026-07-22T00:00:00Z',
      href: '/api/dispatch?tap_go=1&drop=audit', featured: 1, used: 0,
    };
    const extra = [
      { key: 'HOMEPAGE', type: 'page', target: 'miscsubjects.com — static public/index.html (edit file + deploy)', category: 'page' },
      { key: 'CATEGORIES', type: 'meta', target: 'GET /api/directory/categories', category: 'meta' },
    ];
    // Every code file that belongs to the build, live from the GitHub tree — each addressable
    // via /api/file/<path> (GET read · PUT edit+commit · DELETE). AGENTS.md, STATE.md included.
    let files = [];
    try {
      if (env.GITHUB_TOKEN) {
        const gr = await fetch('https://api.github.com/repos/[OWNER_HANDLE]/miscsubjects-pages/git/trees/main?recursive=1',
          { headers: { Authorization: 'Bearer ' + env.GITHUB_TOKEN, 'User-Agent': 'miscsubjects-build', Accept: 'application/vnd.github+json' } });
        const ARTIFACT_PREFIXES = ['ledger-mirror/', '.protected/'];
        if (gr.ok) { const gj = await gr.json(); files = (gj.tree || []).filter(t => t.type === 'blob' && !ARTIFACT_PREFIXES.some(p => t.path.startsWith(p))).map(t => ({ key: t.path, type: 'file', target: '/api/file/' + t.path, category: 'file', size: t.size || null, href: '/api/file/' + t.path })); }
      }
    } catch (e) { /* tree optional */ }
    return new Response(JSON.stringify({ rows: dirRows.concat([auditDrop]).concat(c.results || []).concat(pg.results || []).concat(files).concat(extra) }), { headers: { 'content-type': 'application/json' } });
  }

  const palette = JSON.stringify(CATEGORY_COLOR);
  const body = `
<style>
.topbar{display:flex;align-items:center;gap:8px;margin:0 0 16px;flex-wrap:wrap}
.topbar a.new,.topbar button{padding:7px 14px;border:1px solid var(--line-strong);border-radius:6px;background:#fff;font-size:13px;font-weight:600;cursor:pointer;color:var(--ink);text-decoration:none}
.topbar a.new{background:var(--accent);color:#fff;border-color:var(--accent)}
.topbar input{font-family:var(--mono);font-size:12.5px;width:200px}
.topbar .grp{display:flex;align-items:center;gap:5px}
#tb-status{font-size:12.5px;color:var(--muted);margin-left:6px}
.filter-row{display:flex;gap:10px;margin:0 0 12px;align-items:center;flex-wrap:wrap}
.page-controls{display:inline-flex;align-items:center;gap:6px}
.page-controls button{padding:4px 9px;border:1px solid var(--line-strong);border-radius:5px;background:#fff;cursor:pointer}
.page-controls button:disabled{opacity:.35;cursor:default}
.section-head td{background:#f2f5fa;font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}
.section-more td{background:#fafbfd;font-size:11px;font-style:italic;color:var(--muted);text-align:center}
tr.router-row td{background:var(--accent-soft)}
.key-link{color:var(--accent);text-decoration:none;font-weight:600;font-size:13.5px}
.key-link:hover{text-decoration:underline}
.slug-cell{font-family:var(--mono);font-size:11px;color:var(--muted)}
.target-cell{font-family:var(--mono);font-size:12.5px;color:var(--ink-soft);max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cat-cell .cf{padding:2px 8px;border-radius:99px;font-size:10.5px;font-weight:600;color:#0a0a0a}
.loc{font-family:var(--mono);font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;letter-spacing:.04em}
.loc-d1{background:#e3ecff;color:#13315c}
.loc-js{background:#fff0d6;color:#5c4413}
.loc-http{background:#e0f7e6;color:#12502a}
.loc-r2{background:#efe3ff;color:#3c1c6b}
table td{padding-top:5px;padding-bottom:5px}
.bigtabs{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 14px}
.bigtab{cursor:pointer;border:1px solid var(--line-strong);background:#fff;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;color:var(--ink);display:inline-flex;align-items:center;gap:8px}
.bigtab .sw{width:11px;height:11px;border-radius:3px;display:inline-block}
.bigtab .ct{font-size:11px;font-family:var(--mono);color:var(--muted)}
.bigtab.on{background:#000;color:#fff;border-color:#000}
.bigtab.on .ct{color:#bbb}
/* Sheet ⇄ Classic: two views of the same objects, top right */
.topbar .vtwrap{margin-left:auto;display:inline-flex}
.topbar .vt{padding:7px 12px;border:1px solid var(--line-strong);background:#fff;font-size:13px;font-weight:600;color:var(--ink);text-decoration:none}
.topbar .vt:first-child{border-radius:6px 0 0 6px;border-right-width:0}
.topbar .vt:last-child{border-radius:0 6px 6px 0}
.topbar .vt.on{background:#000;color:#fff;border-color:#000}
tr.rowsel td{background:#e8f0fe !important}
</style>

<h1>Directory</h1>

<div class="topbar">
  <a class="new" href="/admin/directory/new">NEW</a>
  <span class="grp">EDIT <input id="ed-key" list="dkeys" placeholder="KEY" onkeydown="if(event.key==='Enter')goEdit()"><button onclick="goEdit()">Open</button></span>
  <span class="grp">DELETE <input id="del-key" list="dkeys" placeholder="KEY"><button onclick="doDelete()" style="border-color:#c0392b;color:#c0392b">Delete</button></span>
  <datalist id="dkeys"></datalist>
  <span id="tb-status"></span>
  <span class="vtwrap"><a class="vt" id="vt-sheet" href="/admin/directory" title="Sheets workbook — same objects, editable grid">Sheet</a><a class="vt on" id="vt-classic" href="/admin/directory?view=classic" title="You are here">Classic</a></span>
</div>

<div class="bigtabs" id="bigtabs"></div>

<div class="filter-row">
  <input id="dir-filter" placeholder="search name / target / category..." oninput="filterChanged()" style="flex:1;max-width:320px">
  <span id="dir-cat-wrap"><select id="dir-cat" onchange="filterChanged(1)"><option value="">Category: all</option></select></span>
  <select id="dir-sort" onchange="filterChanged(1)">
    <option value="" selected>Grouped by kind</option>
    <option value="new">Newest added</option>
    <option value="old">Oldest added</option>
    <option value="used">Most used</option>
    <option value="unused">Least used</option>
    <option value="key">Name A–Z</option>
  </select>
  <select id="dir-use" onchange="filterChanged(1)">
    <option value="">Used: any</option>
    <option value="used">Used ≥ 1</option>
    <option value="never">Never used</option>
  </select>
  <span id="dir-summary" style="font-size:12px;color:var(--muted)"></span>
  <span class="page-controls"><button id="dir-prev" type="button" onclick="changePage(-1)">Prev</button><span id="dir-page" style="font-size:12px;color:var(--muted)"></span><button id="dir-next" type="button" onclick="changePage(1)">Next</button></span>
</div>

<table>
  <thead><tr><th>name</th><th>type</th><th>location</th><th>category</th><th>added</th><th>used</th><th>target</th></tr></thead>
  <tbody id="dir-body"><tr><td colspan="7" class="empty">loading...</td></tr></tbody>
</table>

<script>
const PALETTE = ${palette};
let DIR_ROWS = [];
let DIR_PAGE = 0;
const DIR_PAGE_SIZE = 200;
function e(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function catColor(c){ return PALETTE[c] || '#9aa7ba'; }
function elv(id){ return document.getElementById(id); }

// Every tap is a link: tab, search, category, sort, use, page and
// the clicked row's object id all live in the URL; a pasted link restores the exact view.
// A page reached via ?share= / ?terminal_key= / ?tk= carries that token on its own data
// fetch and on every state URL it writes — the cookie is absent on those visits.
const TOKP = (function(){ try { var p = new URLSearchParams(location.search), ks = ['share','terminal_key','tk'];
  for (var i = 0; i < ks.length; i++){ var v = p.get(ks[i]); if (v) return [ks[i], v]; } } catch(err){} return null; })();
let SELROW = '';
let PENDING_CAT = '';
let LASTURL = '';
let SELSCROLLED = false;
const CLASSIC_TAB2KIND = { agent:'agent', content:'content', code:'code', files:'file', other:'other' };
function classicUrl(push){
  var p = new URLSearchParams(); p.set('view','classic');
  if (TOKP) p.set(TOKP[0], TOKP[1]);
  if (TYPEFILTER) p.set('tab', TYPEFILTER);
  var q = elv('dir-filter').value.trim(); if (q) p.set('q', q);
  var cat = elv('dir-cat').value; if (cat) p.set('cat', cat);
  var sort = elv('dir-sort').value; if (sort) p.set('sort', sort);
  var use = elv('dir-use').value; if (use) p.set('use', use);
  if (DIR_PAGE) p.set('page', String(DIR_PAGE+1));
  if (SELROW) p.set('id', SELROW);
  var u = '/admin/directory?' + p.toString();
  if (u === LASTURL) return; LASTURL = u;
  try { history[push?'pushState':'replaceState']({c:1},'',u); } catch(err){}
  syncSheetLink();
}
function syncSheetLink(){
  var a = elv('vt-sheet'); if (!a) return;
  var kind = CLASSIC_TAB2KIND[TYPEFILTER] || '';
  var p = new URLSearchParams();
  if (kind) p.set('kind', kind);
  if (TOKP) p.set(TOKP[0], TOKP[1]);
  var q = p.toString();
  a.href = '/admin/directory' + (q ? '?'+q : '');
}
function selectRow(key, tr){
  SELROW = key;
  document.querySelectorAll('#dir-body tr.rowsel').forEach(function(x){ x.classList.remove('rowsel'); });
  if (tr) tr.classList.add('rowsel');
  var st = elv('tb-status'); if (st){ st.style.color='var(--muted)'; st.textContent='id: '+key; }
  classicUrl(false);
}
function applySelHighlight(tb){
  if (!SELROW) return;
  var el = null;
  try { el = tb.querySelector('tr[data-key="'+(window.CSS&&CSS.escape?CSS.escape(SELROW):SELROW)+'"]'); } catch(err){}
  if (el){ el.classList.add('rowsel'); if (!SELSCROLLED){ SELSCROLLED = true; try{ el.scrollIntoView({block:'center'}); }catch(err){} } }
}
document.addEventListener('click', function(ev){
  var tr = ev.target.closest ? ev.target.closest('#dir-body tr[data-key]') : null;
  if (!tr || ev.target.closest('a')) return;
  selectRow(tr.getAttribute('data-key'), tr);
});
window.addEventListener('popstate', function(){
  var p = new URLSearchParams(location.search);
  TYPEFILTER = p.get('tab') || '';
  elv('dir-filter').value = p.get('q') || '';
  elv('dir-sort').value = p.get('sort') || '';
  elv('dir-use').value = p.get('use') || '';
  refreshCategories(); elv('dir-cat').value = p.get('cat') || '';
  DIR_PAGE = Math.max(0, (parseInt(p.get('page')||'1',10)||1)-1);
  SELROW = p.get('id') || '';
  LASTURL = location.pathname + location.search;
  renderBigTabs(); renderDir();
});

function goEdit(){ var k=elv('ed-key').value.trim(); if(k) location.href='/admin/directory/'+encodeURIComponent(k); }
async function doDelete(){
  var k=elv('del-key').value.trim(); if(!k) return;
  var st=elv('tb-status'); st.style.color='var(--muted)'; st.textContent='deleting '+k+'...';
  var res=await fetch('/api/directory/'+encodeURIComponent(k),{method:'DELETE'});
  var j=await res.json();
  if(j.ok){ st.style.color='#178c45'; st.textContent='deleted '+k; loadDir(true); } else { st.style.color='#c0392b'; st.textContent='error: '+(j.error||res.status); }
}

// Big filter tabs the it was asked for: agent · content · code · files · other.
// 'code' = the executable rows (fn/http/flow); 'other' = pages, meta, everything else.
const BIGTABS = [
  { id:'',        label:'Everything', sw:'#9aa7ba' },
  { id:'agent',   label:'Agents',     sw:'#74d7ff' },
  { id:'content', label:'Content',    sw:'#9dffb0' },
  { id:'code',    label:'Code',       sw:'#a3c2ff' },
  { id:'files',   label:'Files',      sw:'#c0a8ff' },
  { id:'other',   label:'Other',      sw:'#ffd479' },
];
let TYPEFILTER = '';
function bigTabCount(id){ return DIR_ROWS.filter(function(r){ return matchesType(r, id); }).length; }
function renderBigTabs(){
  var host = elv('bigtabs'); if(!host) return;
  host.innerHTML = BIGTABS.map(function(t){
    var on = TYPEFILTER===t.id ? ' on' : '';
    return '<span class="bigtab'+on+'" onclick="setType(\\''+t.id+'\\')">'+
      '<span class="sw" style="background:'+t.sw+'"></span>'+e(t.label)+
      '<span class="ct">'+bigTabCount(t.id)+'</span></span>';
  }).join('');
}
function setType(t){
  TYPEFILTER = t;
  DIR_PAGE = 0;
  elv('dir-filter').value = '';
  elv('dir-use').value = '';
  elv('dir-cat').value = '';
  refreshCategories();
  renderBigTabs();
  renderDir();
  classicUrl(true); // a tab tap is its own link
}
function filterChanged(push){ DIR_PAGE = 0; renderDir(); classicUrl(!!push); }
function changePage(delta){ DIR_PAGE += delta; renderDir(); classicUrl(true); }

function refreshCategories(){
  var catCount = {};
  DIR_ROWS.filter(function(r){ return matchesType(r, TYPEFILTER); }).forEach(function(r){
    var c=r.category; if(c) catCount[c]=(catCount[c]||0)+1;
  });
  var cats = Object.keys(catCount).sort(function(a,b){ return a.localeCompare(b); });
  var sel = elv('dir-cat');
  var wrap = elv('dir-cat-wrap');
  if (!sel) return;
  var keep = PENDING_CAT || sel.value; PENDING_CAT = '';
  sel.innerHTML = '<option value="">Category: all</option>' + cats.map(function(c){ return '<option value="'+e(c)+'">'+e(c)+' ('+catCount[c]+')</option>'; }).join('');
  if (keep && cats.indexOf(keep) >= 0) sel.value = keep;
  if (wrap) wrap.style.display = cats.length > 1 ? '' : 'none';
}

// Cached corpus: the last good copy paints the table instantly,
// the live fetch replaces it in place — the loading row only ever shows on a cold first visit.
async function loadDir(fresh){
  var KEY = '/admin/directory?data=directory' + (TOKP ? '&'+TOKP[0]+'='+encodeURIComponent(TOKP[1]) : '');
  var painted = false;
  try {
    if (window.caches && !fresh){
      var c = await caches.open('dir-classic-v1');
      var m = await c.match(KEY);
      if (m){ var j = await m.json(); if (j && j.rows && j.rows.length){ DIR_ROWS = j.rows; painted = true; applyLoaded(); } }
    }
  } catch(err){}
  var st = elv('tb-status');
  if (painted && st && !st.textContent){ st.style.color='var(--muted)'; st.textContent='refreshing…'; }
  // The feed occasionally answers a transient non-JSON body ("render error"); one quiet
  // retry, and a failure paints a retry row instead of an eternal "loading...".
  let r = null;
  for (var attempt = 0; attempt < 2 && !r; attempt++){
    try { var resp = await fetch(KEY); r = JSON.parse(await resp.text()); }
    catch(err){ r = null; if (!attempt) await new Promise(function(res){ setTimeout(res, 900); }); }
  }
  if (!r || !r.rows){
    if (!painted) elv('dir-body').innerHTML = '<tr><td colspan="7" class="empty">feed failed — <a href="#" onclick="loadDir(true);return false">retry</a></td></tr>';
    if (st && st.textContent === 'refreshing…') st.textContent = 'refresh failed — showing last copy';
    return;
  }
  try {
    if (window.caches && r && r.rows){
      var c2 = await caches.open('dir-classic-v1');
      await c2.put(KEY, new Response(JSON.stringify(r), { headers: { 'content-type':'application/json' } }));
    }
  } catch(err){}
  DIR_ROWS = r.rows || [];
  applyLoaded();
  if (painted && st && st.textContent === 'refreshing…') st.textContent = '';
}
function applyLoaded(){
  elv('dkeys').innerHTML = DIR_ROWS.filter(function(r){return r.type!=='content';}).map(function(r){ return '<option value="'+e(r.key)+'">'; }).join('');
  refreshCategories();
  renderBigTabs();
  renderDir();
}
function locBadge(r){
  var m = { http:['HTTP','loc-http'], fn:['JS','loc-js'], agent:['D1','loc-d1'], flow:['D1','loc-d1'], content:['D1','loc-d1'], page:['D1','loc-d1'], file:['GH','loc-r2'], meta:['—','loc-d1'] };
  var v = m[r.type] || ['D1','loc-d1'];
  return '<span class="loc '+v[1]+'">'+v[0]+'</span>';
}
function rowTime(r){
  var raw = String((r && r.created_at) || '').trim();
  if (!raw) return null;
  if (/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}/.test(raw)) raw = raw.replace(' ','T') + (/[zZ]|[+-]\\d{2}:?\\d{2}$/.test(raw) ? '' : 'Z');
  var ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}
function displayTime(r){
  var ms = rowTime(r);
  return ms == null ? '' : new Date(ms).toISOString().slice(0,16).replace('T',' ');
}
function rowHtml(r){
  // every row names its object: data-key is the object id, shown on click, addressable as ?id=
  var rowClass = (r.key==='ROUTER' ? ' class="router-row"' : '') + ' data-key="'+e(r.key)+'" title="id: '+e(r.key)+'"';
  var href, name;
  if (r.type==='content'){ href=r.href ? e(r.href) : '/admin/content/'+e(r.key); name=e(r.target||r.key); }
  else if (r.type==='page'){ href = r.key==='HOMEPAGE' ? '/admin/pages/home' : '/admin/pages/'+e(r.key); name=e(r.key); }
  else if (r.type==='meta'){ href='/api/directory/categories'; name=e(r.key); }
  else if (r.type==='file'){ href='/api/file/'+e(r.key); name=e(r.key); }
  else { href='/admin/directory/'+e(r.key); name=e(r.key); }
  var cat = r.type==='page' ? 'page' : (r.category||'');
  var added = displayTime(r);
  var used = (r.used != null) ? r.used : '';
  return '<tr'+rowClass+'>'
    +'<td><a class="key-link" href="'+href+'">'+name+'</a></td>'
    +'<td><span class="type-chip">'+e(r.type)+'</span></td>'
    +'<td>'+locBadge(r)+'</td>'
    +'<td class="cat-cell">'+(cat?'<span class="cf" style="background:'+catColor(cat)+'">'+e(cat)+'</span>':'')+'</td>'
    +'<td class="slug-cell">'+e(added)+'</td>'
    +'<td class="slug-cell" style="text-align:right">'+e(String(used))+'</td>'
    +'<td class="target-cell" title="'+e(r.target)+'">'+e(r.target||'')+'</td></tr>';
}
function matchesType(r, t){
  if (!t) return true;
  if (t==='code')  return r.type==='http' || r.type==='fn' || r.type==='flow';
  if (t==='files') return r.type==='file';
  if (t==='other') return ['agent','content','http','fn','flow','file'].indexOf(r.type)<0; // pages, meta, anything else
  if (t==='tool')  return r.type==='http' || r.type==='fn';
  return r.type===t;
}
function renderDir(){
  const filter = (elv('dir-filter').value || '').toLowerCase();
  const cat = (elv('dir-cat') && elv('dir-cat').value) || '';
  const sort = (elv('dir-sort') && elv('dir-sort').value) || '';
  const useF = (elv('dir-use') && elv('dir-use').value) || '';
  const t = TYPEFILTER;
  const rows = DIR_ROWS.filter(function(r){
    if (!matchesType(r, t)) return false;
    if (cat && (r.category||'') !== cat) return false;
    if (useF==='used' && !(r.used>0)) return false;
    if (useF==='never' && (r.used>0)) return false;
    if (filter){ var hay=(r.key||'')+' '+(r.target||'')+' '+(r.category||'')+' '+(r.type||'')+' '+(r.href||''); if(!hay.toLowerCase().includes(filter)) return false; }
    return true;
  });
  const tb = elv('dir-body');
  const summary = elv('dir-summary');
  if (!rows.length){ tb.innerHTML = '<tr><td colspan="7" class="empty">no rows match.</td></tr>'; if(summary) summary.textContent='0 matches'; elv('dir-page').textContent=''; elv('dir-prev').disabled=true; elv('dir-next').disabled=true; return; }

  // Any active sort/category/used filter flattens to one sorted list; otherwise grouped-by-type.
  if (sort || cat || useF){
    const s = rows.slice();
    if (sort==='new')    s.sort(function(a,b){ var at=rowTime(a),bt=rowTime(b); return (b.featured||0)-(a.featured||0) || (bt==null?-Infinity:bt)-(at==null?-Infinity:at) || String(a.key||'').localeCompare(String(b.key||'')); });
    if (sort==='old')    s.sort(function(a,b){ var at=rowTime(a),bt=rowTime(b); return (at==null?Infinity:at)-(bt==null?Infinity:bt) || String(a.key||'').localeCompare(String(b.key||'')); });
    if (sort==='used')   s.sort(function(a,b){ return (b.used||0)-(a.used||0); });
    if (sort==='unused') s.sort(function(a,b){ return (a.used||0)-(b.used||0); });
    if (sort==='key')    s.sort(function(a,b){ return String(a.key||'').localeCompare(String(b.key||'')); });
    const pages = Math.max(1, Math.ceil(s.length / DIR_PAGE_SIZE));
    DIR_PAGE = Math.max(0, Math.min(DIR_PAGE, pages - 1));
    const start = DIR_PAGE * DIR_PAGE_SIZE;
    const visible = s.slice(start, start + DIR_PAGE_SIZE);
    tb.innerHTML = visible.map(rowHtml).join('');
    applySelHighlight(tb);
    elv('dir-page').textContent = 'page '+(DIR_PAGE+1)+' / '+pages;
    elv('dir-prev').disabled = DIR_PAGE === 0;
    elv('dir-next').disabled = DIR_PAGE >= pages - 1;
    if (summary){
      var byCat = {}; rows.forEach(function(r){ var c=r.category||r.type||'—'; byCat[c]=(byCat[c]||0)+1; });
      var top = Object.keys(byCat).sort(function(a,b){return byCat[b]-byCat[a];}).slice(0,6).map(function(c){return c+' '+byCat[c];}).join(' · ');
      summary.textContent = rows.length+' matches · showing '+(start+1)+'–'+(start+visible.length)+' · '+top;
    }
    return;
  }

  // Grouped by KIND (the real directory ordering: capabilities first, corpus last). Each section
  // is capped so the huge Content/Files sets cannot freeze the page — the 200-row law still holds.
  // To page through a full section, pick a sort or a category (that path stays flat + paginated).
  const SECTION_CAP = 200;
  const agents = rows.filter(function(r){return r.type==='agent';});
  const tools = rows.filter(function(r){return r.type==='http'||r.type==='fn';});
  const flows = rows.filter(function(r){return r.type==='flow';});
  const content = rows.filter(function(r){return r.type==='content';});
  const pages = rows.filter(function(r){return r.type==='page';});
  const meta = rows.filter(function(r){return r.type==='meta';});
  const files = rows.filter(function(r){return r.type==='file';});
  function section(title, arr){
    if (!arr.length) return '';
    var head = '<tr class="section-head"><td colspan="7">'+title+' ('+arr.length+')</td></tr>';
    var shown = arr.slice(0, SECTION_CAP).map(rowHtml).join('');
    var more = arr.length > SECTION_CAP
      ? '<tr class="section-more"><td colspan="7">+'+(arr.length-SECTION_CAP)+' more — pick a sort or category above to page through all</td></tr>'
      : '';
    return head + shown + more;
  }
  let html='';
  html += section('Agents', agents);
  html += section('Tools — HTTP / FN', tools);
  html += section('Flows', flows);
  html += section('Pages', pages);
  html += section('Meta', meta);
  html += section('Content — article corpus', content);
  html += section('Files — code, GET/PUT/DELETE /api/file/&lt;path&gt;', files);
  tb.innerHTML = html;
  applySelHighlight(tb);
  if (summary) summary.textContent = rows.length+' shown · grouped by kind (agents · tools · flows · pages · meta · content · files)';
}
// Restore the exact view a pasted link names, then load (cache paints first).
(function(){
  var p = new URLSearchParams(location.search);
  TYPEFILTER = p.get('tab') || '';
  if (p.get('q')) elv('dir-filter').value = p.get('q');
  if (p.get('sort')) elv('dir-sort').value = p.get('sort');
  if (p.get('use')) elv('dir-use').value = p.get('use');
  PENDING_CAT = p.get('cat') || '';
  DIR_PAGE = Math.max(0, (parseInt(p.get('page')||'1',10)||1)-1);
  SELROW = p.get('id') || '';
  LASTURL = location.pathname + location.search;
  syncSheetLink();
})();
loadDir();
</script>
`;

  return new Response(shellHtml({ activeHref: '/admin/directory', title: 'Directory', body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
