import { shellHtml } from '../_layout.js';

export async function onRequestGet(context) {
  const slug = String(context.params.slug || '');
  const isHome = slug === 'home';
  const body = `
<style>
.pg{max-width:1000px;display:grid;gap:12px}
.pg label{font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);display:block;margin-bottom:3px}
.pg input,.pg textarea{width:100%;font-family:var(--mono);font-size:13px}
.pg textarea{min-height:320px}
.rest{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:12px 14px;margin:8px 0}
.rest b{font-size:13px}
.rest pre{background:#fff;border:1px solid var(--line);font-size:12px;margin-top:6px;white-space:pre;overflow:auto}
.status{font-size:13px;color:var(--muted)}
button.danger{border-color:#c14a4a;color:#c14a4a}
.note{border:1px solid var(--warn-border);background:var(--warn-bg);color:var(--warn-ink);padding:10px 12px;border-radius:8px;font-size:13px}
</style>
<h1>Edit page <code>${slug.replace(/</g,'&lt;')}</code></h1>
<p class="subtitle">${isHome ? 'The homepage.' : 'Live at <code>/'+slug.replace(/</g,'&lt;')+'</code>.'} Edit here, or via REST below.</p>

${isHome ? `<div class="note">The homepage (<code>https://miscsubjects.com/</code>) is the static file <code>public/index.html</code> — it is NOT a D1 page. Edit it by changing <code>public/index.html</code> and running <code>wrangler pages deploy public</code>. There is no REST mutation for the homepage.</div>` : `
<div class="pg">
  <div><label>Title</label><input id="title" type="text"></div>
  <div><label>body_html</label><textarea id="body_html"></textarea></div>
  <div style="display:flex;gap:10px;align-items:center"><button onclick="save()">Save (PUT)</button><button class="danger" onclick="del()">Delete</button><span id="st" class="status"></span></div>
</div>

<div class="rest">
  <b>REST — copy &amp; paste (raw JSON)</b>
  <pre id="rest-block"></pre>
</div>`}

<script>
const SLUG=${JSON.stringify(slug)}, ORIGIN=location.origin, IS_HOME=${isHome ? 'true' : 'false'};
function restBlock(){
  var u=ORIGIN+'/api/pages/'+SLUG;
  return 'GET    '+u+'\\n'+
    'PUT    '+u+'\\n  curl -X PUT '+u+' -H "content-type: application/json" \\\\\\n    -d \\'{"title":"...","body_html":"<h1>...</h1>"}\\'\\n'+
    'PATCH  '+u+'\\n  curl -X PATCH '+u+' -H "content-type: application/json" -d \\'{"body_html":"<...>"}\\'\\n'+
    'DELETE '+u+'\\n  curl -X DELETE '+u+'\\n'+
    'history GET '+u+'?versions=1';
}
async function load(){
  if(IS_HOME) return;
  document.getElementById('rest-block').textContent=restBlock();
  var r=await fetch('/api/pages/'+SLUG);
  if(!r.ok){ document.getElementById('st').textContent='not found — PUT creates it'; return; }
  var d=await r.json(); document.getElementById('title').value=d.title||''; document.getElementById('body_html').value=d.body_html||'';
}
async function save(){
  var st=document.getElementById('st'); st.textContent='saving...';
  var r=await fetch('/api/pages/'+SLUG,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({title:document.getElementById('title').value,body_html:document.getElementById('body_html').value})});
  var d=await r.json(); st.textContent=d.version?('saved v'+d.version):(d.error||'failed');
}
async function del(){ if(!confirm('Delete '+SLUG+'?'))return; await fetch('/api/pages/'+SLUG,{method:'DELETE'}); location.href='/admin/directory'; }
load();
</script>`;
  return new Response(shellHtml({ activeHref: '/admin/directory', title: 'Edit page', body }), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
