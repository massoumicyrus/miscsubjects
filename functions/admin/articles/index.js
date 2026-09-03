// /admin/articles — the article studio. One list over GET /api/articles with the same
// filters every other client uses (curl, Sheets, models): q, tag, category, status, model.
// Every action on this page IS a REST call, and the call is printed before it runs.
import { shellHtml } from '../_layout.js';

const BODY = `
<style>
.studio{max-width:1200px}
.studio .bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px}
.studio .bar input,.studio .bar select{font-family:var(--mono);font-size:13px;padding:6px 8px}
.studio table{width:100%;font-size:13px;border-collapse:collapse}
.studio th,.studio td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.studio td a{text-decoration:none}
.studio .tag{display:inline-block;font-family:var(--mono);font-size:11px;border:1px solid var(--line);border-radius:6px;padding:1px 6px;margin:0 3px 3px 0;cursor:pointer}
.rest{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:12px 14px;margin:0 0 12px}
.rest pre{background:#fff;border:1px solid var(--line);font-size:12px;margin-top:6px;white-space:pre;overflow:auto;padding:8px}
.newrow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 14px}
.newrow input{font-family:var(--mono);font-size:13px;padding:6px 8px}
.muted{color:var(--muted);font-size:12px}
.audit{border:1px solid var(--line);border-left:4px solid var(--accent);padding:10px 12px;margin:0 0 14px;font-size:13px}
.audit .issue{margin-top:5px}.audit .bad{color:#a33}
</style>
<h1>Articles</h1>
<p class="subtitle">The full editorial library. Every button below is the REST call it prints — same API for you, curl, models, and Google Sheets.</p>
<div class="rest"><b style="font-size:13px">REST — this page's exact calls</b><pre id="rest"></pre></div>
<div class="newrow">
  <input id="new_slug" placeholder="new-article-slug" style="width:220px">
  <input id="new_title" placeholder="Title" style="width:320px">
  <button onclick="createArticle()">Create draft</button>
  <span class="muted">Creates an unpublished draft (PUT with draft:true), then opens the editor.</span>
</div>
<div id="audit" class="audit">Loading the continuous headline, heading, and hero audit…</div>
<div class="studio">
  <div class="bar">
    <input id="q" placeholder="filter — title or slug" style="flex:1;min-width:200px">
    <input id="tag" placeholder="tag" style="width:120px">
    <input id="cat" placeholder="category" style="width:130px">
    <select id="status"><option value="">any status</option><option>published</option><option>retracted</option><option>superseded</option></select>
    <select id="register"><option value="">articles</option><option value="all">all registers</option></select>
    <button onclick="load()">Filter</button>
    <span id="count" class="muted"></span>
    <a href="/api/articles/export?all=1" class="muted">↓ whole library (.md)</a>
  </div>
  <table><thead><tr><th>title</th><th>category</th><th>tags</th><th>status</th><th>model</th><th>updated</th><th>links</th></tr></thead><tbody id="rows"></tbody></table>
</div>
<script>
function e(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function qs(){
  var p=new URLSearchParams();
  var q=document.getElementById('q').value.trim(); if(q)p.set('q',q);
  var t=document.getElementById('tag').value.trim(); if(t)p.set('tag',t);
  var c=document.getElementById('cat').value.trim(); if(c)p.set('category',c);
  var s=document.getElementById('status').value; if(s)p.set('status',s);
  var r=document.getElementById('register').value; if(r)p.set('register',r);
  p.set('limit','250');
  return p.toString();
}
async function load(){
  var u='/api/articles?'+qs();
  document.getElementById('rest').textContent=
    'list    GET    '+location.origin+u+'\\n'+
    'create  PUT    '+location.origin+'/api/articles/<slug>   body: {"title":"...","body":"...","tags":[],"category":"...","draft":true}\\n'+
    'read    GET    '+location.origin+'/api/articles/<slug>        (?format=post = re-postable shape)\\n'+
    'edit    PATCH  '+location.origin+'/api/articles/<slug>   body: {"find":"...","replace":"..."} or {"body":"..."}\\n'+
    'delete  DELETE '+location.origin+'/api/articles/<slug>\\n'+
    'preflight POST '+location.origin+'/api/articles/editorial-preflight   body: {stage,title,hero_brief,editorial_review}\\n'+
    'audit   GET    '+location.origin+'/api/articles/editorial-audit\\n'+
    'export  GET    '+location.origin+'/api/articles/export?slug=|tag=|category=|all=1\\n'+
    'curl auth: -H "x-terminal-key: $TERMINAL_KEY"  (your browser session already carries it)';
  var both=await Promise.all([fetch(u).then(function(r){return r.json()}),fetch('/api/articles/editorial-audit').then(function(r){return r.json()})]);
  var d=both[0],audit=both[1];
  var failed=(audit.articles||[]).filter(function(a){return !a.ok});
  document.getElementById('audit').innerHTML='<b>Continuous editorial audit:</b> '+e(audit.passed||0)+' pass · <span class="bad">'+e(audit.failed||0)+' need repair</span> · <a href="/api/articles/editorial-audit">JSON</a>'+
    failed.slice(0,5).map(function(a){var first=(a.issues||[])[0]||{};return '<div class="issue"><a href="/admin/articles/'+encodeURIComponent(a.slug)+'">'+e(a.slug)+'</a>: '+e(first.message||'review required')+'</div>'}).join('');
  document.getElementById('count').textContent=(d.articles||[]).length+' of '+d.total;
  document.getElementById('rows').innerHTML=(d.articles||[]).map(function(a){
    return '<tr><td><a href="/admin/articles/'+encodeURIComponent(a.slug)+'"><b>'+e(a.title)+'</b></a><br><span class="muted">'+e(a.slug)+'</span></td>'+
      '<td>'+(a.category?'<span class="tag" onclick="setF(\\'cat\\',\\''+e(a.category)+'\\')">'+e(a.category)+'</span>':'')+'</td>'+
      '<td>'+(a.tags||[]).map(function(t){return '<span class="tag" onclick="setF(\\'tag\\',\\''+e(t)+'\\')">'+e(t)+'</span>'}).join('')+'</td>'+
      '<td>'+e(a.status||'')+'</td><td class="muted">'+e(a.model||'')+'</td><td class="muted">'+e((a.updated_at||'').slice(0,10))+'</td>'+
      '<td><a href="/a/'+encodeURIComponent(a.slug)+'">view</a> · <a href="/admin/articles/'+encodeURIComponent(a.slug)+'">edit</a> · <a href="/api/articles/export?slug='+encodeURIComponent(a.slug)+'">.md</a></td></tr>';
  }).join('')||'<tr><td colspan="7" class="muted">nothing matched</td></tr>';
}
function setF(id,v){document.getElementById(id).value=v;load();}
async function createArticle(){
  var slug=document.getElementById('new_slug').value.trim();
  var title=document.getElementById('new_title').value.trim();
  if(!slug||!title){alert('slug and title required');return;}
  var r=await fetch('/api/articles/'+encodeURIComponent(slug),{method:'PUT',headers:{'content-type':'application/json'},
    body:JSON.stringify({title:title,body:title+' — draft.',draft:true,prov:{model:'admin-studio',action:'create'}})});
  var d=await r.json();
  if(!r.ok){alert(d.error||('failed '+r.status));return;}
  location.href='/admin/articles/'+encodeURIComponent(d.slug||slug);
}
['q','tag','cat'].forEach(function(id){document.getElementById(id).addEventListener('keydown',function(ev){if(ev.key==='Enter')load();});});
load();
</script>
`;

export async function onRequestGet() {
  return new Response(shellHtml({ activeHref: '/admin/articles', title: 'Articles', body: BODY }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
