import { shellHtml } from '../_layout.js';

export async function onRequestGet(context) {
  const slug = String(context.params.slug || '');
  const BODY = `
<style>
.ed{display:grid;gap:12px;max-width:1000px}
.ed label{font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);display:block;margin-bottom:3px}
.ed input[type=text],.ed select,.ed textarea{width:100%;font-family:var(--mono);font-size:13px}
.ed textarea{min-height:300px}.ed textarea.sm{min-height:90px}
.ed .row{display:flex;gap:12px;flex-wrap:wrap}.ed .row>div{flex:1;min-width:160px}
.status{font-size:13px;color:var(--muted)}
.vc{margin-top:18px}.vc h2{font-size:14px}.vc table{width:100%;font-size:12.5px}
.contrib{border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:8px}
.contrib .m{font-family:var(--mono);font-size:11px;color:var(--accent)}
button.danger{border-color:#c14a4a;color:#c14a4a}
</style>
<h1>Edit content</h1>
<p class="subtitle">slug <code id="slug">${slug.replace(/</g,'&lt;')}</code> · public at <code>/content/${slug.replace(/</g,'&lt;')}</code> · one-page at <code>/?slug=${slug.replace(/</g,'&lt;')}</code></p>
<div style="border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:12px 14px;margin:0 0 12px"><b style="font-size:13px">REST — copy &amp; paste (raw JSON, this works)</b><pre id="rest-block" style="background:#fff;border:1px solid var(--line);font-size:12px;margin-top:6px;white-space:pre;overflow:auto"></pre></div>
<div class="ed">
  <div class="row">
    <div><label>Title</label><input id="title" type="text"></div>
    <div><label>Status</label><select id="status"><option>active</option><option>draft</option><option>archived</option></select></div>
    <div><label>Type</label><input id="type" type="text"></div>
  </div>
  <div><label>Body (markdown)</label><textarea id="body_md"></textarea></div>
  <div><label>body_json (structured fields — merged on save)</label><textarea id="body_json" class="sm"></textarea></div>
  <div><label>Tags (comma)</label><input id="tags" type="text"></div>
  <div class="row" style="align-items:center"><button onclick="save()">Save</button><button class="danger" onclick="del()">Delete</button><span id="st" class="status"></span></div>
  <div class="vc" id="versions"></div>
  <div class="vc"><h2>Model contributions</h2><div id="comments"></div>
    <div class="row"><input id="cm_model" type="text" placeholder="model name" style="max-width:160px"><input id="cm_text" type="text" placeholder="comment"><button onclick="addComment()">Add</button></div>
  </div>
</div>
<script>
const SLUG=${JSON.stringify(slug)};
function e(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
async function load(){
  document.getElementById('rest-block').textContent=
    'read     GET    '+location.origin+'/api/content/'+SLUG+'\\n'+
    'patch    PATCH  '+location.origin+'/api/content/'+SLUG+'   body: {"title":"...","body_md":"...","body_json":{},"status":"active"}\\n'+
    'delete   DELETE '+location.origin+'/api/content/'+SLUG+'\\n'+
    'versions GET    '+location.origin+'/api/content/'+SLUG+'/versions';
  const d=(await (await fetch('/api/content/'+SLUG)).json()).item;if(!d){document.getElementById('st').textContent='not found';return;}
  title.value=d.title||'';status.value=d.status||'active';type.value=d.type||'';body_md.value=d.body_md||'';
  body_json.value=d.body_json?JSON.stringify(d.body_json,null,2):'';tags.value=(d.tags||[]).join(', ');
  loadVersions();loadComments();
}
async function save(){
  let bj=undefined;const t=body_json.value.trim();if(t){try{bj=JSON.parse(t);}catch(e){document.getElementById('st').textContent='body_json invalid JSON';return;}}
  const payload={title:title.value,status:status.value,type:type.value,body_md:body_md.value,tags:tags.value.split(',').map(s=>s.trim()).filter(Boolean),change_note:'admin edit',created_by:'admin'};
  if(bj!==undefined)payload.body_json=bj;
  const r=await (await fetch('/api/content/'+SLUG,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})).json();
  document.getElementById('st').textContent=r.item?('saved v'+r.version):(r.error||'failed');loadVersions();
}
async function del(){if(!confirm('Delete '+SLUG+'?'))return;await fetch('/api/content/'+SLUG,{method:'DELETE'});location.href='/admin/content';}
async function loadVersions(){const d=await (await fetch('/api/content/'+SLUG+'/versions')).json();const v=document.getElementById('versions');const rows=(d.versions||[]);v.innerHTML='<h2>Versions ('+rows.length+')</h2><table><thead><tr><th>v</th><th>note</th><th>by</th><th>at</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+x.version+'</td><td>'+e(x.change_note||'')+'</td><td>'+e(x.created_by||'')+'</td><td>'+e((x.created_at||'').slice(0,16))+'</td></tr>').join('')+'</tbody></table>';}
async function loadComments(){const d=await (await fetch('/api/content/'+SLUG+'/comments')).json();document.getElementById('comments').innerHTML=(d.comments||[]).map(c=>'<div class="contrib"><div class="m">'+e(c.model_name)+' · '+e(c.comment_type||'')+'</div>'+e(c.comment_md||'')+'</div>').join('')||'<span class="status">none</span>';}
async function addComment(){const m=cm_model.value.trim()||'operator',t=cm_text.value.trim();if(!t)return;await fetch('/api/content/'+SLUG+'/comments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model_name:m,comment_md:t})});cm_text.value='';loadComments();}
load();
</script>`;
  return new Response(shellHtml({ activeHref: '/admin/content', title: 'Edit content', body: BODY }), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
