import { shellHtml } from './_layout.js';

const BODY = `
<style>
.pages-edit{display:grid;gap:14px;max-width:1100px}
.pages-edit .row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.pages-edit label{font-size:13px;color:var(--ink-soft);font-weight:500}
.pages-edit input[type=text],.pages-edit select{min-width:240px}
.pages-edit textarea{width:100%;font-family:var(--mono);font-size:13px;min-height:380px}
.pages-edit .meta{font-size:12.5px;color:var(--muted)}
.pages-edit button.danger{border-color:#c14a4a;color:#c14a4a;background:#fff}
.pages-edit button.danger:hover{background:#fdecec;border-color:#a02828;color:#a02828}
.status{font-size:13px}
.status.ok{color:#178c45}
.status.err{color:#c14a4a}
.versions{margin-top:18px}
.versions table{width:100%}
.versions a{color:var(--accent);font-weight:500}
</style>

<h1>Pages</h1>
<p class="subtitle">Runtime-editable HTML stored in D1 <code>pages</code>. Served at <code>/&lt;slug&gt;</code> via <code>functions/[slug].js</code>. Save writes a new <code>pages_versions</code> row — every prior version is preserved and revertable.</p>

<div class="pages-edit">
  <div class="row">
    <label>Slug</label>
    <select id="slug-select" onchange="loadSlug()"></select>
    <span class="meta" id="page-meta"></span>
  </div>

  <div class="row">
    <label>New slug</label>
    <input id="new-slug" type="text" placeholder="new-slug">
    <button onclick="createSlug()">Create</button>
    <span id="new-status" class="status"></span>
  </div>

  <div>
    <h2>Title</h2>
    <div class="row"><input id="page-title" type="text" placeholder="Page title" style="flex:1;max-width:620px"></div>
  </div>

  <div>
    <h2>Body HTML</h2>
    <textarea id="page-body" spellcheck="false"></textarea>
  </div>

  <div class="row">
    <button onclick="save()">Save</button>
    <button class="danger" onclick="del()">Delete</button>
    <span id="save-status" class="status"></span>
  </div>

  <div class="versions" id="versions"></div>
</div>

<script>
const params = new URLSearchParams(location.search);
let currentSlug = params.get('slug') || '';

function e(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

async function refreshList() {
  const r = await fetch('/api/pages');
  const d = await r.json();
  const sel = document.getElementById('slug-select');
  sel.innerHTML = '';
  (d.data || []).forEach(row => {
    const opt = document.createElement('option');
    opt.value = row.slug;
    opt.textContent = row.slug;
    if (row.slug === currentSlug) opt.selected = true;
    sel.appendChild(opt);
  });
  if (!currentSlug && d.data && d.data.length) {
    currentSlug = d.data[0].slug;
    sel.value = currentSlug;
  }
}

async function loadSlug() {
  currentSlug = document.getElementById('slug-select').value;
  history.replaceState(null, '', '/admin/pages?slug=' + encodeURIComponent(currentSlug));
  const r = await fetch('/api/pages/' + encodeURIComponent(currentSlug));
  if (!r.ok) {
    document.getElementById('page-title').value = '';
    document.getElementById('page-body').value = '';
    document.getElementById('page-meta').textContent = 'not found';
    return;
  }
  const d = await r.json();
  document.getElementById('page-title').value = d.title || '';
  document.getElementById('page-body').value = d.body_html || '';
  document.getElementById('page-meta').textContent = 'v' + d.version + ' · updated ' + (d.updated_at || '');
  loadVersions();
}

async function loadVersions() {
  const r = await fetch('/api/pages/' + encodeURIComponent(currentSlug) + '?versions=1');
  const d = await r.json();
  const c = document.getElementById('versions');
  const rows = d.data || [];
  if (!rows.length) { c.innerHTML = ''; return; }
  c.innerHTML = '<h2>Versions</h2><table><thead><tr><th>Version</th><th>Created at</th><th>Actor</th><th>Size</th><th></th></tr></thead><tbody>' +
    rows.map(v => '<tr><td>' + v.version + '</td><td>' + e(v.created_at) + '</td><td>' + e(v.actor || '') + '</td><td>' + (v.body_html ? v.body_html.length : 0) + '</td><td><a href="#" onclick="revertTo(' + v.version + ');return false">Revert</a></td></tr>').join('') +
    '</tbody></table>';
}

async function revertTo(version) {
  const r = await fetch('/api/pages/' + encodeURIComponent(currentSlug) + '?versions=1');
  const d = await r.json();
  const v = (d.data || []).find(x => x.version === version);
  if (!v) return;
  document.getElementById('page-title').value = v.title || '';
  document.getElementById('page-body').value = v.body_html || '';
  setStatus('save-status', 'Loaded v' + version + ' — click Save to commit as new version.', 'ok');
}

async function save() {
  const title = document.getElementById('page-title').value;
  const body_html = document.getElementById('page-body').value;
  const r = await fetch('/api/pages/' + encodeURIComponent(currentSlug), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body_html, actor: 'admin' }),
  });
  if (!r.ok) { setStatus('save-status', 'Save failed (' + r.status + ').', 'err'); return; }
  const d = await r.json();
  document.getElementById('page-meta').textContent = 'v' + d.version + ' · updated ' + d.updated_at;
  setStatus('save-status', 'Saved as v' + d.version + '.', 'ok');
  loadVersions();
}

async function del() {
  if (!confirm('Delete ' + currentSlug + ' permanently? Versions remain in pages_versions.')) return;
  const r = await fetch('/api/pages/' + encodeURIComponent(currentSlug), { method: 'DELETE' });
  if (!r.ok) { setStatus('save-status', 'Delete failed (' + r.status + ').', 'err'); return; }
  setStatus('save-status', 'Deleted.', 'ok');
  currentSlug = '';
  await refreshList();
  loadSlug();
}

async function createSlug() {
  const slug = document.getElementById('new-slug').value.trim();
  if (!slug) { setStatus('new-status', 'slug required.', 'err'); return; }
  const r = await fetch('/api/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, title: slug, body_html: '<!doctype html><html><body><h1>' + slug + '</h1></body></html>' }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    setStatus('new-status', err.error || 'create failed', 'err');
    return;
  }
  setStatus('new-status', 'Created.', 'ok');
  currentSlug = slug;
  await refreshList();
  loadSlug();
}

function setStatus(id, text, cls) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'status ' + (cls || '');
  setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 4000);
}

(async function init() {
  await refreshList();
  if (currentSlug) loadSlug();
})();
</script>
`;

export async function onRequestGet() {
  return new Response(shellHtml({ activeHref: '/admin/pages', title: 'Pages', body: BODY }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
