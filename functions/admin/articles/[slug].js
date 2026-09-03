// /admin/articles/<slug> — the article editor. Human hands on the same REST verbs every
// model and terminal uses: PUT replaces, PATCH find/replace edits, webhook appends sources,
// /rewrite proposes a model rewrite, DELETE deletes. Each button prints its exact call + curl.
import { shellHtml } from '../_layout.js';

export async function onRequestGet(context) {
  const slug = String(context.params.slug || '');
  const BODY = `
<style>
.ed{display:grid;gap:12px;max-width:1100px}
.ed label{font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);display:block;margin-bottom:3px}
.ed input[type=text],.ed select,.ed textarea{width:100%;font-family:var(--mono);font-size:13px;padding:6px 8px}
.ed textarea{min-height:420px}.ed textarea.sm{min-height:80px}
.ed .row{display:flex;gap:12px;flex-wrap:wrap}.ed .row>div{flex:1;min-width:150px}
.status{font-size:13px;color:var(--muted)}
.rest{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:12px 14px}
.rest pre{background:#fff;border:1px solid var(--line);font-size:12px;margin-top:6px;white-space:pre-wrap;overflow:auto;padding:8px}
.panel{border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.panel h2{font-size:14px;margin:0 0 8px}
button.danger{border-color:#c14a4a;color:#c14a4a}
.srcrow{border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:6px;font-size:12.5px}
.srcrow .m{font-family:var(--mono);font-size:11px;color:var(--accent)}
.toolbtns{display:flex;gap:6px;flex-wrap:wrap}
.toolbtns button{font-size:12px;padding:4px 8px}
.auditbox{border-left:4px solid var(--accent)}
.auditbox .bad{color:#a33}.auditbox .ok{color:#287642}
</style>
<h1>Edit article</h1>
<p class="subtitle">slug <code>${slug.replace(/</g, '&lt;')}</code> · <a href="/a/${encodeURIComponent(slug)}">live page</a> · <a href="/api/articles/${encodeURIComponent(slug)}">JSON</a> · <a href="/api/articles/export?slug=${encodeURIComponent(slug)}">download .md</a> · <a href="/api/articles/${encodeURIComponent(slug)}/bundle?format=zip">object folder .zip</a> · <a href="/skills/article-editing">the skill</a></p>
<div class="rest"><b style="font-size:13px">REST — every action on this page, copyable</b><pre id="rest"></pre></div>
<div class="ed">
  <div class="row">
    <div style="flex:2"><label>Title</label><input id="title" type="text"></div>
    <div><label>Status</label><select id="status"><option>published</option><option>retracted</option><option>superseded</option></select></div>
    <div><label>Register</label><input id="register" type="text" placeholder="standard"></div>
  </div>
  <div class="row">
    <div><label>Category</label><input id="category" type="text"></div>
    <div style="flex:2"><label>Tags (comma)</label><input id="tags" type="text"></div>
    <div style="flex:2"><label>Hero image URL</label><input id="hero" type="text" placeholder="https://miscsubjects.com/img/gen/… — generate via ARCADS_TO_R2, paste the R2 URL"></div>
  </div>
  <div class="panel auditbox"><h2>Mandatory headline + hero preflight</h2>
    <div class="row"><div><label>Headline subject</label><input id="headline_subject" type="text" placeholder="what a cold reader must know"></div>
    <div><label>Hero subject</label><input id="hero_subject" type="text" placeholder="the actual evidence or object in the story"></div></div>
    <div><label>Hero brief</label><textarea id="hero_brief" class="sm" placeholder="One tangible story-specific editorial scene; no readable text, table, dashboard, terminal, UI collage, or generic AI art."></textarea></div>
    <div class="row"><div><label>Visible action or composition</label><input id="visual_action" type="text" placeholder="what is visibly happening in the literal scene"></div>
    <div><label>Why this belongs to this story</label><textarea id="hero_rationale" class="sm"></textarea></div></div>
    <div class="row"><div><label><input id="hero_inspected" type="checkbox"> I opened and inspected the actual render</label></div>
    <div style="flex:3"><label>What is visibly present</label><input id="inspection_note" type="text" placeholder="concrete inspection finding"></div></div>
    <button onclick="runPreflight('proposal')">Check concept before generation</button>
    <button onclick="runPreflight('publish')">Check actual asset before publication</button>
    <span id="preflight_st" class="status"></span>
  </div>
  <div>
    <label>Body (markdown; the page renders it)</label>
    <div class="toolbtns" style="margin-bottom:6px">
      <button onclick="ins('\\n## Heading\\n')">H2</button>
      <button onclick="ins('\\n### Heading\\n')">H3</button>
      <button onclick="insSource()">Insert source widget</button>
      <button onclick="ins('\\n[[embed:SLUG]]\\n')">Embed article</button>
      <button onclick="ins('\\n> quote\\n')">Quote</button>
    </div>
    <textarea id="body"></textarea>
  </div>
  <div class="row" style="align-items:center">
    <button onclick="save()">Save (PUT, full replace)</button>
    <button class="danger" onclick="del()">Delete (DELETE)</button>
    <span id="st" class="status"></span>
  </div>

  <div class="panel"><h2>Surgical edit — PATCH find/replace (safe under concurrent edits)</h2>
    <div class="row"><div><label>Find (exact)</label><textarea id="p_find" class="sm"></textarea></div>
    <div><label>Replace with</label><textarea id="p_repl" class="sm"></textarea></div></div>
    <button onclick="patchFR()">PATCH</button> <span id="p_st" class="status"></span>
  </div>

  <div class="panel"><h2>Rewrite a passage with a model (Cloudflare Gateway)</h2>
    <div class="row"><div style="flex:2"><label>Passage (exact text from the body)</label><textarea id="rw_find" class="sm"></textarea></div>
    <div style="flex:2"><label>Instruction</label><textarea id="rw_inst" class="sm" placeholder="tighten this; keep the citations"></textarea></div>
    <div><label>Model</label><input id="rw_model" type="text" value="workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast"></div></div>
    <button onclick="rewrite()">Propose rewrite (POST /rewrite)</button> <span id="rw_st" class="status"></span>
    <div id="rw_out" style="display:none;margin-top:8px"><label>Proposed replacement — review, then apply</label>
      <textarea id="rw_proposed" class="sm"></textarea>
      <button onclick="applyRewrite()">Apply (PATCH with expected_hash)</button></div>
  </div>

  <div class="panel"><h2>Sources (hash-chained ledger)</h2><div id="sources"></div>
    <div class="row">
      <input id="s_url" type="text" placeholder="url" style="flex:2">
      <input id="s_title" type="text" placeholder="title" style="flex:2">
      <input id="s_quote" type="text" placeholder="supporting quote (optional)" style="flex:2">
      <button onclick="addSource()">Add source (POST /webhook)</button>
    </div>
    <p class="status">Embed any source inline: click “embed” on a row — it inserts <code>[[embed:source:sN]]</code> at the cursor.</p>
  </div>

  <div class="panel"><h2>Revisions (append-only)</h2><div id="revs" class="status"></div></div>
</div>
<script>
const SLUG=${JSON.stringify(slug)};
const API='/api/articles/'+encodeURIComponent(SLUG);
let CUR=null;
function e(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function rest(lines){document.getElementById('rest').textContent=lines.join('\\n');}
function baseRest(){rest([
 'read      GET    '+location.origin+API+'          (?format=post = re-postable shape, ?rev=N = old revision)',
 'save      PUT    '+location.origin+API+'   body: {"title","body","tags","category","register","status","hero","replace":true,"prov":{"model":"you","action":"edit"}}',
 'edit      PATCH  '+location.origin+API+'   body: {"find":"...","replace":"...","expected_hash":"<sha256 of body you read>"}',
 'source    POST   '+location.origin+API+'/webhook   body: {"kind":"source","data":{"url","title","quote","claim_ids":[]}}',
 'preflight POST   '+location.origin+'/api/articles/editorial-preflight   body: {"stage","title","hero_brief","editorial_review"}',
 'audit     GET    '+location.origin+'/api/articles/editorial-audit',
 'rewrite   POST   '+location.origin+API+'/rewrite   body: {"find":"...","instruction":"...","model":"workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast"} — returns proposal + apply recipe',
 'delete    DELETE '+location.origin+API,
 'download  GET    '+location.origin+'/api/articles/export?slug='+SLUG,
 'curl auth: -H "x-terminal-key: $TERMINAL_KEY" — or a write token from GET /api/write-gate/challenge (models)',
 'sheets    operator-console/Articles.js polls this same API into Google Sheets (open task: two-way sync)',
]);}
async function load(){
  baseRest();
  const d=await (await fetch(API)).json(); CUR=d;
  if(d.error){document.getElementById('st').textContent=d.error;return;}
  title.value=d.title||''; status.value=d.status||'published'; register.value=d.register||'';
  category.value=(d.machine&&d.machine.category)||d.category||''; tags.value=(d.tags||[]).join(', ');
  hero.value=d.hero||''; body.value=d.body||'';
  var er=d.editorial_review||{};
  headline_subject.value=er.headline_subject||'';hero_subject.value=er.hero_subject||'';
  hero_brief.value=er.hero_brief||'';visual_action.value=er.visual_action||'';
  hero_rationale.value=er.rationale||'';hero_inspected.checked=er.inspected===true;inspection_note.value=er.inspection_note||'';
  var issues=(d.editorial_audit&&d.editorial_audit.issues)||[];
  preflight_st.textContent=issues.length?issues.map(function(x){return x.message}).join(' · '):'current title and recorded hero review pass the mechanical audit';
  preflight_st.className='status '+(issues.length?'bad':'ok');
  renderSources(d.sources||[]); loadRevs();
}
function editorialReview(){return {
  headline_subject:headline_subject.value.trim(),hero_subject:hero_subject.value.trim(),
  visual_action:visual_action.value.trim(),rationale:hero_rationale.value.trim(),
  inspected:hero_inspected.checked,inspection_note:inspection_note.value.trim()
}}
async function runPreflight(stage){
  var r=await fetch('/api/articles/editorial-preflight',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({stage:stage,title:title.value.trim(),hero_brief:hero_brief.value.trim(),editorial_review:editorialReview()})});
  var d=await r.json();
  preflight_st.textContent=d.ok?'passes '+stage+' preflight':(d.issues||[]).map(function(x){return x.message}).join(' · ');
  preflight_st.className='status '+(d.ok?'ok':'bad');
  return d.ok;
}
function ins(t){const b=document.getElementById('body');const s=b.selectionStart||0;b.value=b.value.slice(0,s)+t+b.value.slice(b.selectionEnd||s);b.focus();}
function insSource(){const id=prompt('source id (e.g. s3 — see the Sources panel)');if(id)ins('\\n[[embed:source:'+id+']]\\n');}
async function save(){
  if(hero.value.trim()&&!(await runPreflight('publish')))return;
  const payload={title:title.value,body:body.value,replace:true,
    tags:tags.value.split(',').map(function(s){return s.trim()}).filter(Boolean),
    category:category.value.trim(),register:register.value.trim()||'standard',status:status.value,
    hero:hero.value.trim(),hero_brief:hero_brief.value.trim(),editorial_review:editorialReview(),
    prov:{model:'admin-studio (owner)',action:'edit'}};
  const r=await fetch(API,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json();
  document.getElementById('st').textContent=r.ok?('saved · revision '+(d.revisions||0)+' preserved'):(d.error||('failed '+r.status));
  if(r.ok)CUR=d;
}
async function patchFR(){
  const r=await fetch(API,{method:'PATCH',headers:{'content-type':'application/json'},
    body:JSON.stringify({find:document.getElementById('p_find').value,replace:document.getElementById('p_repl').value,prov:{model:'admin-studio (owner)',action:'patch'}})});
  const d=await r.json();
  document.getElementById('p_st').textContent=r.ok?('patched, matched '+d.matched):(d.error||('failed '+r.status));
  if(r.ok){body.value=d.body||body.value;CUR=d;}
}
let RW=null;
async function rewrite(){
  document.getElementById('rw_st').textContent='asking the gateway…';
  const r=await fetch(API+'/rewrite',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({find:document.getElementById('rw_find').value,instruction:document.getElementById('rw_inst').value,model:document.getElementById('rw_model').value})});
  const d=await r.json(); RW=d;
  if(!r.ok){document.getElementById('rw_st').textContent=d.error||('failed '+r.status);return;}
  document.getElementById('rw_st').textContent='proposal ready ('+d.model+') — review below';
  document.getElementById('rw_out').style.display='block';
  document.getElementById('rw_proposed').value=d.proposed;
  rest(['rewrite proposal — apply with:','PATCH '+location.origin+API,JSON.stringify(d.apply.body,null,2),d.apply.curl]);
}
async function applyRewrite(){
  if(!RW)return;
  const bodyP={find:RW.find,replace:document.getElementById('rw_proposed').value,expected_hash:RW.apply.body.expected_hash,prov:{model:RW.model,action:'rewrite'}};
  const r=await fetch(API,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(bodyP)});
  const d=await r.json();
  document.getElementById('rw_st').textContent=r.ok?'applied':(d.error==='hash_mismatch'?'body changed since the proposal — re-propose':(d.error||'failed'));
  if(r.ok){body.value=d.body||body.value;CUR=d;}
}
function renderSources(list){
  document.getElementById('sources').innerHTML=list.map(function(s){
    return '<div class="srcrow"><span class="m">'+e(s.id)+'</span> '+e(s.title||'')+' '+(s.url?'<a href="'+e(s.url)+'">'+e(s.url)+'</a>':'')+
      ' <button style="font-size:11px" onclick="ins(\\'\\\\n[[embed:source:'+e(s.id)+']]\\\\n\\')">embed</button></div>';
  }).join('')||'<span class="status">no sources yet</span>';
}
async function addSource(){
  const data={url:document.getElementById('s_url').value.trim(),title:document.getElementById('s_title').value.trim(),quote:document.getElementById('s_quote').value.trim()};
  if(!data.url&&!data.title){alert('url or title required');return;}
  const r=await fetch(API+'/webhook',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'source',data:data})});
  const d=await r.json();
  if(!r.ok){alert(d.error||'failed');return;}
  const s=await (await fetch(API+'/sources')).json(); renderSources(s.sources||[]);
}
async function loadRevs(){
  const d=await (await fetch(API+'/revisions')).json();
  document.getElementById('revs').innerHTML='head is revision '+d.head_index+'. '+
    (d.revisions||[]).slice(-10).reverse().map(function(r){
      return '<div>rev '+r.n+' · '+e((r.ts||'').slice(0,16))+' · '+e(r.title||'')+' · <a href="'+API+'?rev='+r.n+'">view JSON</a> · <button style="font-size:11px" onclick="restore('+r.n+')">restore</button></div>';
    }).join('')||'no prior revisions';
}
async function restore(n){
  if(!confirm('Restore revision '+n+' as the new head? (current head is preserved as a revision)'))return;
  const rev=await (await fetch(API+'?rev='+n)).json();
  const r=await fetch(API,{method:'PUT',headers:{'content-type':'application/json'},
    body:JSON.stringify({title:rev.title,body:rev.body,claims:rev.claims,sources:rev.sources,replace:true,prov:{model:'admin-studio (owner)',action:'restore rev '+n}})});
  const d=await r.json();
  document.getElementById('st').textContent=r.ok?('restored revision '+n):(d.error||'failed');
  if(r.ok)load();
}
async function del(){
  if(!confirm('DELETE '+SLUG+' permanently? Revisions go with it.'))return;
  const r=await fetch(API,{method:'DELETE'});const d=await r.json();
  if(r.ok)location.href='/admin/articles';else alert(d.error||'failed');
}
load();
</script>
`;
  return new Response(shellHtml({ activeHref: '/admin/articles', title: 'Edit ' + slug, body: BODY }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
