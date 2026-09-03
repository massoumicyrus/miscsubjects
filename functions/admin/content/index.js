import { shellHtml } from '../_layout.js';

const BODY = `
<style>
.cf{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.cf input,.cf select{font-family:var(--mono);font-size:13px;padding:7px 10px}
.cf input[type=text]{min-width:220px}
.ctable{width:100%;font-size:13px}
.ctable td a{color:var(--accent);font-weight:500}
.ctable .mono{font-family:var(--mono);color:var(--muted)}
.badge{font-family:var(--mono);font-size:11px;padding:1px 7px;border-radius:99px;border:1px solid var(--line)}
.status{font-size:13px;color:var(--muted)}
</style>
<h1>Content</h1>
<p class="subtitle">Every <code>content_items</code> row. Filter, search, create, click to edit. Public reader at <code>/content</code>; one-page directory at <code>/</code>.</p>
<div class="cf">
  <input id="q" type="text" placeholder="search title / body / tags" oninput="load()">
  <select id="type" onchange="load()"><option value="">all types</option></select>
  <select id="status" onchange="load()"><option value="">all status</option><option>active</option><option>draft</option><option>archived</option></select>
  <input id="newslug" type="text" placeholder="new slug (optional)">
  <input id="newtitle" type="text" placeholder="new title">
  <select id="newtype"><option value="topic">topic</option><option value="peptide">peptide</option></select>
  <button onclick="create()">Create</button>
  <span id="st" class="status"></span>
</div>
<table class="ctable"><thead><tr><th>slug</th><th>E</th><th>type</th><th>title</th><th>status</th></tr></thead><tbody id="rows"></tbody></table>
<script>
function e(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
async function types(){const d=await (await fetch('/api/content/types')).json();const sel=document.getElementById('type');(d.types||[]).forEach(t=>{const o=document.createElement('option');o.value=t.type;o.textContent=t.type+' ('+t.n+')';sel.appendChild(o);});}
async function load(){
  const q=document.getElementById('q').value,ty=document.getElementById('type').value,st=document.getElementById('status').value;
  const u=new URL('/api/content',location.origin);if(q)u.searchParams.set('q',q);if(ty)u.searchParams.set('type',ty);if(st)u.searchParams.set('status',st);
  const d=await (await fetch(u)).json();
  document.getElementById('rows').innerHTML=(d.items||[]).map(i=>'<tr><td class="mono">'+e(i.slug)+'</td><td class="mono"></td><td class="mono">'+e(i.type)+'</td><td><a href="/admin/content/'+encodeURIComponent(i.slug)+'">'+e(i.title)+'</a></td><td><span class="badge">'+e(i.status)+'</span></td></tr>').join('');
}
async function create(){
  const title=document.getElementById('newtitle').value.trim();if(!title){document.getElementById('st').textContent='title required';return;}
  const body={title,type:document.getElementById('newtype').value,status:'draft'};const sl=document.getElementById('newslug').value.trim();if(sl)body.slug=sl;
  const r=await (await fetch('/api/content',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})).json();
  if(r.item){location.href='/admin/content/'+encodeURIComponent(r.item.slug);}else{document.getElementById('st').textContent=r.error||'failed';}
}
types();load();
</script>`;

export async function onRequestGet() {
  return new Response(shellHtml({ activeHref: '/admin/content', title: 'Content', body: BODY }), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
