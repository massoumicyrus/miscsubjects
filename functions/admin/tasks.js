import { shellHtml } from './_layout.js';
import { renderRail, vaultStyles } from '../_lib/vault_widgets.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.searchParams.get('data') === '1') {
    const r = await env.DB.prepare(
      'SELECT id, created_at, status, body, source, google_task_id FROM tasks ORDER BY created_at DESC LIMIT 200'
    ).all();
    const rows = r.results || [];
    const openCount = rows.filter(t => t.status === 'open').length;
    const unsyncedOpenCount = rows.filter(t => t.status === 'open' && !t.google_task_id).length;
    return new Response(
      JSON.stringify({ results: rows, open_count: openCount, unsynced_open_count: unsyncedOpenCount }),
      { headers: { 'content-type': 'application/json' } }
    );
  }

  // Load vault task widgets for display alongside the DB task queue
  let vaultWidgets = [];
  try {
    const rows = await env.DB.prepare('SELECT id, created_at, status, body, source, google_task_id FROM tasks ORDER BY id DESC LIMIT 18').all();
    vaultWidgets = (rows.results || []).map((r) => {
      let job = {};
      try { job = JSON.parse(r.body); } catch {}
      const title = job.title || job.item || job.ask || job.role || r.source || 'Task #' + r.id;
      const body = job.detail || job.body || job.ask || job.item || r.body || '';
      return {
        kind: 'task',
        id: 'task:' + r.id,
        title,
        body,
        status: r.status,
        ts: r.created_at,
        href: url.origin + '/admin/tasks',
        hash: String(r.id).slice(0, 8),
        meta: { role: r.source, google_task_id: r.google_task_id || null },
        api: url.origin + '/api/tasks?status=' + encodeURIComponent(r.status || 'open')
      };
    });
  } catch (e) {
    vaultWidgets = [{title:'Vault load error: '+e.message,kind:'error'}];
  }

  const BODY = `
<style>
${vaultStyles()}
/* Dark-system overrides for the shared vault widgets (vault_widgets.js is light-themed). */
.vault-actions a,.vault-actions button{background:var(--panel)}
.vault-actions a:hover,.vault-actions button:hover{background:var(--accent-soft)}
.vault-stat{background:var(--panel)}
.vault-card{background:var(--panel)}
.vault-card:hover{box-shadow:0 10px 28px rgba(0,0,0,.4)}
.vault-card.task{--vc:var(--ds-accent)}.vault-card.event{--vc:var(--ds-dim)}.vault-card.card{--vc:var(--ds-soft)}.vault-card.claim{--vc:var(--ds-sage)}.vault-card.protected{--vc:#b86b5a}.vault-card.idea{--vc:var(--ds-ink)}
.vc-mark{color:#0c0e12}
.vault-form{background:var(--panel)}
.vault-lock{border-color:var(--warn-border);background:var(--warn-bg);color:var(--warn-ink)}

.tasks{max-width:1200px}
.task-header{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.task-header .count{font-size:13px;color:var(--muted);font-weight:600}
.task-header .actions{margin-left:auto;display:flex;gap:10px;align-items:center}
.task-header a.gt{font-size:13px;color:var(--accent);font-weight:500}
.st-chip{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;background:var(--ds-raised);color:var(--muted);border:1px solid var(--line)}
.st-chip.open,.wc-status.open{background:var(--warn-bg);color:var(--warn-ink);border-color:var(--warn-border)}
.st-chip.done,.wc-status.done{background:rgba(122,154,123,.15);color:#9fc5a1;border-color:rgba(122,154,123,.45)}
.st-chip.rejected,.wc-status.rejected{background:rgba(184,107,90,.15);color:#d89a8a;border-color:rgba(184,107,90,.45)}
.id{font-family:var(--mono);font-size:12px;color:var(--muted)}
.body-col{max-width:420px;word-break:break-word}
.source{font-size:12px;color:var(--muted)}
.gid{font-family:var(--mono);font-size:12px;color:var(--muted)}

.widget-section{margin-top:36px;border-top:1px solid var(--line);padding-top:18px}
.widget-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:12px}
.widget-section-head h2{margin:0;font-size:22px}
.widget-actions-head{display:flex;gap:10px;align-items:center}
.widget-controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.widget-tabs{display:flex;gap:6px}
.widget-tabs .tab{border:1px solid var(--line);background:var(--panel);border-radius:6px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer;color:var(--ink)}
.widget-tabs .tab.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.widget-tabs .tab:hover:not(.active){background:var(--hover)}
#widget-search{border:1px solid var(--line);border-radius:6px;padding:6px 12px;font-size:13px;min-width:220px}
.widget-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
.widget-card{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:14px;display:flex;flex-direction:column;gap:8px;cursor:pointer;transition:box-shadow .12s,border-color .12s;position:relative;overflow:hidden}
.widget-card:hover{border-color:var(--accent);box-shadow:0 8px 24px rgba(0,0,0,.4)}
.widget-card::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:var(--ds-accent)}
.wc-top{display:flex;align-items:center;gap:8px}
.wc-mark{width:26px;height:26px;border-radius:6px;background:var(--ds-accent);color:#0c0e12;display:flex;align-items:center;justify-content:center;font:800 10px/1 var(--mono)}
.wc-kind{font:800 9px/1 var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--ds-accent)}
.wc-status{margin-left:auto;font:700 9px/1.4 var(--sans);letter-spacing:.05em;text-transform:uppercase;border:1px solid var(--line);border-radius:99px;padding:2px 8px;color:var(--muted)}
.wc-title{font:800 15px/1.25 var(--sans);color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.widget-card.expanded .wc-title{-webkit-line-clamp:unset}
.wc-body{font:13px/1.5 var(--sans);color:var(--ink-soft);white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;max-height:96px}
.widget-card.expanded .wc-body{-webkit-line-clamp:unset;max-height:none}
.wc-foot{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:auto;padding-top:10px;border-top:1px dashed var(--line);font:10px/1.3 var(--mono);color:var(--muted)}
.wc-foot span{background:var(--ds-raised);padding:2px 6px;border-radius:4px}
.wc-actions{display:flex;gap:8px;margin-top:4px}
.wc-actions button,.wc-actions .button{border:1px solid var(--line);border-radius:6px;background:var(--panel);padding:5px 10px;font-size:12px;font-weight:600;color:var(--ink);text-decoration:none;cursor:pointer}
.wc-actions button:hover,.wc-actions .button:hover{border-color:var(--accent);background:var(--accent-soft)}
.copy-toast{position:fixed;bottom:18px;right:18px;background:var(--ds-ink);color:#0c0e12;padding:8px 14px;border-radius:6px;font-size:13px;z-index:1000}

.add-row{display:flex;gap:10px;margin:6px 0 18px}
.add-row input{flex:1;border:1px solid var(--line-strong);border-radius:8px;padding:10px 14px;font-size:14px;background:var(--panel);color:var(--ink)}
.add-row button{border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:8px;padding:0 18px;font-size:14px;font-weight:700;cursor:pointer}
.filter{display:flex;gap:6px}
.filter .fbtn{border:1px solid var(--line);background:var(--panel);border-radius:6px;padding:5px 12px;font-size:13px;font-weight:600;cursor:pointer;color:var(--ink)}
.filter .fbtn.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.trow{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:8px;background:var(--panel);margin-bottom:8px}
.trow.child{margin-left:34px;border-left:3px solid var(--accent-soft)}
.trow .tid{font:600 12px/1.6 var(--mono);color:var(--muted);min-width:52px}
.trow .tmain{flex:1;min-width:0}
.trow .ttext{font:14px/1.45 var(--sans);color:var(--ink);white-space:pre-wrap;overflow-wrap:anywhere}
.trow .tmeta{margin-top:5px;font:11px/1.4 var(--mono);color:var(--muted);display:flex;flex-wrap:wrap;gap:4px 10px}
.trow .tacts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.trow .tacts button{border:1px solid var(--line);background:var(--panel);border-radius:6px;padding:4px 9px;font-size:12px;font-weight:600;cursor:pointer;color:var(--ink)}
.trow .tacts button:hover{border-color:var(--accent);background:var(--accent-soft)}
.trow .tacts button.danger:hover{border-color:#b86b5a;background:rgba(184,107,90,.15);color:#d89a8a}
.trow textarea{width:100%;border:1px solid var(--accent);border-radius:6px;padding:8px;font:14px/1.45 var(--sans);box-sizing:border-box;background:var(--panel);color:var(--ink)}
@media(max-width:640px){.widget-grid{grid-template-columns:1fr}.widget-controls{flex-direction:column;align-items:stretch}}
</style>

<div class="tasks">
<h1>Tasks</h1>
<p class="subtitle">Build task queue — plain text, threaded, add / edit / complete / delete. Every action is a build capability (TASK_ADD / TASK_EDIT / TASK_COMPLETE / TASK_DELETE / TASK_THREAD) subject to the same rules and ledger as everything else.</p>

<div class="add-row">
  <input id="add-input" type="text" placeholder="Add a task in plain words, then Enter…" />
  <button id="add-btn" onclick="addTask()">Add task</button>
</div>

<div class="task-header">
  <span class="count" id="count">Loading…</span>
  <div class="filter" id="filter">
    <button class="fbtn active" data-status="open">Open</button>
    <button class="fbtn" data-status="done">Done</button>
    <button class="fbtn" data-status="cancelled">Cancelled</button>
    <button class="fbtn" data-status="all">All</button>
  </div>
  <div class="actions">
    <a class="gt" href="https://tasks.google.com/tasklist/MDMzMTMzNjQxODE3MjgzMzM1MTk6MDow" target="_blank" rel="noopener">Open Google Tasks →</a>
    <button id="sync-btn" onclick="syncGoogle()">Sync to Google Tasks</button>
  </div>
</div>

<div id="banner"></div>
<div id="task-list"><p class="empty">Loading…</p></div>
</div>

<section class="widget-section">
  <div class="widget-section-head">
    <div>
      <h2>Vault task widgets</h2>
      <p class="subtitle">${vaultWidgets.length} cards from the vault. Filter, search, and expand to read the full task.</p>
    </div>
    <div class="widget-actions-head">
      <a class="gt" href="/api/vault/catalog">Catalog JSON</a>
      <a class="gt" href="/api/tasks?format=widgets">Widget page</a>
    </div>
  </div>

  <div class="widget-controls">
    <div class="widget-tabs" id="widget-tabs">
      <button class="tab active" data-filter="all">All</button>
      <button class="tab" data-filter="open">Open</button>
      <button class="tab" data-filter="done">Done</button>
      <button class="tab" data-filter="rejected">Rejected</button>
    </div>
    <input id="widget-search" type="search" placeholder="Search tasks…" />
  </div>

  <div id="widget-grid" class="widget-grid"></div>
  <div id="widget-empty" class="empty" style="display:none">No tasks match.</div>
</section>

<script>
const WIDGETS = ${JSON.stringify(vaultWidgets)};

function esc(s){ return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

function renderWidgetCard(w){
  const title = esc(w.title || w.id || 'Untitled');
  const body = esc(w.body || '');
  const status = esc(w.status || 'open');
  const ts = w.ts ? String(w.ts).slice(0,19).replace('T',' ') : '';
  const source = (w.meta && w.meta.role) ? esc(w.meta.role) : '';
  const gtask = (w.meta && w.meta.google_task_id) ? esc(w.meta.google_task_id) : '';
  const parts = [
    '<article class="widget-card task" data-status="' + status + '" data-id="' + esc(w.id) + '">',
    '<div class="wc-top"><span class="wc-mark">TK</span><span class="wc-kind">task</span><span class="wc-status ' + status + '">' + status + '</span></div>',
    '<div class="wc-title">' + title + '</div>',
    '<div class="wc-body">' + body + '</div>',
    '<div class="wc-foot"><span class="wc-id">' + esc(w.id || '') + '</span>' +
      (source ? '<span class="wc-source">' + source + '</span>' : '') +
      (gtask ? '<span class="wc-gtask" title="Google Task ID">' + gtask + '</span>' : '') +
      (ts ? '<span class="wc-ts">' + ts + '</span>' : '') +
    '</div>',
    '<div class="wc-actions">' +
      (w.api ? '<button class="wc-copy" data-copy="' + esc(w.api) + '">Copy API URL</button>' : '') +
      (w.api ? '<a class="button" href="' + esc(w.api) + '" target="_blank">View JSON</a>' : '') +
      (w.href ? '<a class="button" href="' + esc(w.href) + '">Open</a>' : '') +
    '</div>',
    '</article>'
  ];
  return parts.join('');
}

function copyText(text){
  navigator.clipboard.writeText(text).then(() => {
    const n = document.createElement('div'); n.className = 'copy-toast'; n.textContent = 'Copied'; document.body.appendChild(n); setTimeout(() => n.remove(), 1200);
  });
}

function renderWidgets(){
  const filter = document.querySelector('#widget-tabs .tab.active').dataset.filter;
  const q = document.getElementById('widget-search').value.toLowerCase().trim();
  const grid = document.getElementById('widget-grid');
  const filtered = WIDGETS.filter(w => {
    const st = String(w.status || 'open').toLowerCase();
    if (filter !== 'all' && st !== filter) return false;
    if (q) {
      const hay = String(w.title + ' ' + w.body + ' ' + (w.meta && w.meta.role) + ' ' + w.id).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  grid.innerHTML = filtered.map(renderWidgetCard).join('') || '';
  document.getElementById('widget-empty').style.display = filtered.length ? 'none' : 'block';
}

document.getElementById('widget-tabs').addEventListener('click', e => {
  if (!e.target.matches('.tab')) return;
  document.querySelectorAll('#widget-tabs .tab').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
  renderWidgets();
});

document.getElementById('widget-search').addEventListener('input', renderWidgets);

document.getElementById('widget-grid').addEventListener('click', e => {
  const copyBtn = e.target.closest('.wc-copy');
  if (copyBtn) {
    e.preventDefault();
    copyText(copyBtn.dataset.copy);
    return;
  }
  const card = e.target.closest('.widget-card');
  if (!card || e.target.closest('button, a')) return;
  card.classList.toggle('expanded');
});

renderWidgets();
</script>

<script>
function fmtDate(s){ if(!s) return '—'; return s.replace('T',' ').replace('Z','').slice(0,19); }
let CUR_STATUS = 'open';
let LAST = [];

async function api(path, method, body){
  const r = await fetch(path, {
    method: method || 'GET',
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}

function rowHtml(t, isChild){
  const st = esc(t.status || 'open');
  const meta = [];
  meta.push('#' + esc(t.id));
  if (t.role || t.source) meta.push(esc(t.role || t.source));
  if (t.created_at) meta.push(fmtDate(t.created_at));
  if (t.google_task_id) meta.push('google-synced');
  if (t.parent_id) meta.push('child of #' + esc(t.parent_id));
  return '<div class="trow' + (isChild ? ' child' : '') + '" data-id="' + esc(t.id) + '">'
    + '<div class="tid"><span class="st-chip ' + st + '">' + st + '</span></div>'
    + '<div class="tmain">'
      + '<div class="ttext" data-role="text">' + esc(t.human || '') + '</div>'
      + '<div class="tmeta">' + meta.map(m => '<span>' + m + '</span>').join('') + '</div>'
    + '</div>'
    + '<div class="tacts">'
      + (st === 'open' ? '<button onclick="doneTask(' + t.id + ')">Complete</button>' : '<button onclick="reopenTask(' + t.id + ')">Reopen</button>')
      + '<button onclick="editTask(' + t.id + ')">Edit</button>'
      + '<button onclick="threadTask(' + t.id + ')">Thread</button>'
      + '<button class="danger" onclick="delTask(' + t.id + ')">Delete</button>'
    + '</div>'
  + '</div>';
}

function render(data){
  const rows = data.tasks || data.results || [];
  LAST = rows;
  document.getElementById('count').textContent = rows.length + ' ' + CUR_STATUS + ' task' + (rows.length===1?'':'s');

  const unsynced = rows.filter(t => t.status === 'open' && !t.google_task_id).length;
  const banner = document.getElementById('banner');
  banner.innerHTML = unsynced > 0
    ? '<div class="banner"><strong>' + unsynced + ' open task' + (unsynced>1?'s':'') + ' not synced to Google Tasks.</strong> Click "Sync to Google Tasks" to push them.</div>'
    : '';

  const list = document.getElementById('task-list');
  if(!rows.length){ list.innerHTML = '<p class="empty">No ' + CUR_STATUS + ' tasks.</p>'; return; }

  const byId = {}; rows.forEach(t => byId[t.id] = t);
  const tops = rows.filter(t => !t.parent_id || !byId[t.parent_id]);
  const kids = {}; rows.forEach(t => { if (t.parent_id && byId[t.parent_id]) (kids[t.parent_id] = kids[t.parent_id] || []).push(t); });
  let html = '';
  for (const t of tops){
    html += rowHtml(t, false);
    for (const c of (kids[t.id] || [])) html += rowHtml(c, true);
  }
  list.innerHTML = html;
}

async function load(){
  try {
    const q = CUR_STATUS === 'all' ? '?status=open' : '?status=' + encodeURIComponent(CUR_STATUS);
    const j = await api('/api/tasks' + q);
    render(j);
  } catch(e) {
    document.getElementById('count').textContent = 'Load failed';
    document.getElementById('task-list').innerHTML = '<p class="empty">Error loading tasks: ' + esc(e.message) + '</p>';
  }
}

async function addTask(){
  const input = document.getElementById('add-input');
  const text = input.value.trim();
  if(!text) return;
  input.disabled = true;
  try { await api('/api/tasks', 'POST', { role: 'owner', ask: text, text }); input.value=''; CUR_STATUS='open'; setFilter('open'); }
  catch(e){ alert('Add failed: ' + e.message); }
  finally { input.disabled = false; input.focus(); }
}
async function doneTask(id){ try { await api('/api/tasks/' + id + '/done', 'POST', {}); load(); } catch(e){ alert(e.message); } }
async function reopenTask(id){ try { await api('/api/tasks/' + id + '/reopen', 'POST', {}); load(); } catch(e){ alert(e.message); } }
async function delTask(id){ if(!confirm('Delete task #' + id + '? Children move to top level.')) return; try { await api('/api/tasks/' + id, 'DELETE'); load(); } catch(e){ alert(e.message); } }
async function threadTask(id){
  const parent = prompt('Thread task #' + id + ' under which parent task id? (blank = move to top level)');
  if (parent === null) return;
  try { await api('/api/tasks/' + id + '/thread', 'POST', { parent_id: parent.trim() === '' ? null : Number(parent.trim()) }); load(); }
  catch(e){ alert(e.message); }
}
function editTask(id){
  const t = LAST.find(x => x.id === id); if(!t) return;
  const rowEl = document.querySelector('.trow[data-id="' + id + '"] [data-role="text"]');
  if(!rowEl || rowEl.dataset.editing) return;
  rowEl.dataset.editing = '1';
  const cur = t.human || '';
  rowEl.innerHTML = '<textarea rows="2">' + esc(cur) + '</textarea>'
    + '<div style="margin-top:6px;display:flex;gap:6px"><button onclick="saveEdit(' + id + ')">Save</button><button onclick="load()">Cancel</button></div>';
  rowEl.querySelector('textarea').focus();
}
async function saveEdit(id){
  const ta = document.querySelector('.trow[data-id="' + id + '"] textarea'); if(!ta) return;
  try { await api('/api/tasks/' + id, 'PATCH', { text: ta.value }); load(); } catch(e){ alert(e.message); }
}

function setFilter(status){
  CUR_STATUS = status;
  document.querySelectorAll('#filter .fbtn').forEach(b => b.classList.toggle('active', b.dataset.status === status));
  load();
}
document.getElementById('filter').addEventListener('click', e => { if(e.target.matches('.fbtn')) setFilter(e.target.dataset.status); });
document.getElementById('add-input').addEventListener('keydown', e => { if(e.key === 'Enter') addTask(); });

async function syncGoogle(){
  const btn = document.getElementById('sync-btn');
  btn.disabled = true; btn.textContent = 'Syncing…';
  try {
    const r = await fetch('/api/dispatch', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'TASKS_SYNC_GOOGLE', body: '' }) });
    const j = await r.json();
    if(!r.ok){ document.getElementById('count').textContent = 'Sync failed: ' + esc(j.error || r.status); }
    else { load(); }
  } catch(e) { document.getElementById('count').textContent = 'Sync error: ' + esc(e.message); }
  finally { btn.disabled = false; btn.textContent = 'Sync to Google Tasks'; }
}

load();
setInterval(load, 30000);
</script>`;

  return new Response(
    shellHtml({ activeHref: '/admin/tasks', title: 'Tasks', body: BODY }),
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );
}
