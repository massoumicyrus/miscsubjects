// /admin/seed — the one place. Three tabs:
//   Generate  : one system prompt + one input -> a model writes it and it publishes (POST /api/protocol/write)
//   Write     : manual form -> POST /api/protocol/draft  (+ load an existing slug to edit/republish)
//   Ledger    : every article with its REST verbs + provenance/sources/contributions chains + delete
// Owner access key stays in the browser (localStorage), lowercased on send.

export async function onRequestGet() {
  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seed — miscsubjects</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#000;font:16px/1.6 ui-sans-serif,system-ui,-apple-system,sans-serif}
.wrap{max-width:880px;margin:0 auto;padding:24px 20px 100px}
h1{font-size:25px;margin:0 0 4px}
.sub{color:#555;font-size:14px;margin:0 0 18px}
label{display:block;font:600 12px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:#000;margin:16px 0 7px}
.hint{font:400 12px/1.4 ui-sans-serif,system-ui,sans-serif;color:#666;text-transform:none;letter-spacing:0;margin-top:4px}
input,textarea,select{width:100%;background:#fff;color:#000;border:1px solid #bbb;border-radius:9px;padding:11px 13px;font:15px ui-sans-serif,system-ui,sans-serif}
textarea{resize:vertical}
textarea.code{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
.row{display:flex;gap:12px;flex-wrap:wrap}.row>div{flex:1;min-width:150px}
.tabs{display:flex;gap:6px;margin:18px 0 8px;border-bottom:1px solid #ddd}
.tabb{background:none;border:0;border-bottom:2px solid transparent;color:#555;padding:10px 6px;font:700 14px ui-sans-serif,system-ui,sans-serif;cursor:pointer}
.tabb.on{color:#000;border-bottom-color:#000}
.pane{display:none}.pane.on{display:block}
.bar{position:sticky;bottom:0;background:linear-gradient(transparent,#fff 26%);padding:20px 0 8px;margin-top:20px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
button.go{background:#000;color:#fff;border:0;border-radius:10px;padding:13px 22px;font:700 15px ui-sans-serif,system-ui,sans-serif;cursor:pointer}
button.ghost{background:#f3f3f3;color:#000;border:1px solid #ccc;border-radius:10px;padding:12px 16px;font:600 14px ui-sans-serif,system-ui,sans-serif;cursor:pointer}
button.sm{padding:5px 11px;font-size:12px;border-radius:7px;margin-left:8px}
button.del{background:#3a1818;color:#f3b4b4}
button:active{transform:translateY(1px)}
#result{display:none;margin-top:16px;padding:14px 16px;border-radius:10px;font-size:14px;line-height:1.5}
#result.ok{background:#10301c;border:1px solid #1f6e3e;color:#bdf0cf}
#result.err{background:#3a1414;border:1px solid #7a2b2b;color:#f3c4c4}
#result.work{background:#26230f;border:1px solid #6e5a1f;color:#f0e2b0}
#result a{color:#ffd9b0;font-weight:700}
.cheat{font:12px/1.6 ui-monospace,monospace;color:#555;background:#fafafa;border:1px solid #ddd;border-radius:8px;padding:9px 12px;margin-top:7px}
.load{display:flex;gap:8px;align-items:flex-end;margin-bottom:6px}.load input{flex:1}
.key{background:#fff;border:1px solid #999}
.lrow{border:1px solid #ddd;border-radius:10px;padding:12px 14px;margin-bottom:10px}
.lh{display:flex;align-items:center;flex-wrap:wrap}
.lslug{color:#000;text-decoration:underline;font:700 15px ui-monospace,monospace}
.lrest{font:11px/1.7 ui-monospace,monospace;color:#7a7a86;margin-top:6px;word-break:break-all}
.lbody{font:12px/1.6 ui-monospace,monospace;color:#bfbfca;margin-top:8px}
.lbody a{color:#000;text-decoration:underline}.lbody b{color:#000}
</style></head><body><div class="wrap">
<h1>Seed</h1>
<p class="sub">One system prompt + one input → a model writes it and it publishes. Live at <code>/a/&lt;slug&gt;</code>.</p>

<label>Owner access key <span class="hint">once; stays in this browser (case ignored)</span></label>
<input id="tk" class="key" type="password" placeholder="Owner access key">

<div class="tabs">
<button class="tabb on" id="t-gen" onclick="tab('gen')">Generate</button>
<button class="tabb" id="t-write" onclick="tab('write')">Write manually</button>
<button class="tabb" id="t-led" onclick="tab('led')">Ledger</button>
</div>

<!-- ============ GENERATE (default) ============ -->
<div class="pane on" id="pane-gen">
<label>System prompt <span class="hint">the writer's instructions. The article-JSON output format is added for you.</span></label>
<textarea id="g-sys" rows="5">You are a rigorous, neutral, evidence-graded health writer. No persuasion, no recommendations. Grade every claim by evidence tier (human, preclinical, anecdotal, mechanistic, speculative). Where there is no human data, say so plainly. Cite only real sources.</textarea>
<label>Input <span class="hint">what to write</span></label>
<textarea id="g-ask" rows="3">Write the evidence-graded review for: BPC-157</textarea>
<div class="row">
<div><label>Model</label><input id="g-model" value="grok/grok-4.3"></div>
<div><label>Slug <span class="hint">blank = auto</span></label><input id="g-slug" placeholder="auto"></div>
<div><label>Register</label><select id="g-register"><option>accessible</option><option selected>standard</option><option>technical</option></select></div>
</div>
<div class="cheat">model: grok/grok-4.3 · @cf/zai-org/glm-5.2 · @cf/moonshotai/kimi-k2.7-code</div>
<div class="bar"><button class="go" onclick="generate()">Generate &amp; publish</button><button class="ghost" onclick="queueJob()">Queue instead</button></div>
</div>

<!-- ============ WRITE MANUALLY ============ -->
<div class="pane" id="pane-write">
<div class="load"><div><label>Load an existing slug <span class="hint">to edit + republish</span></label><input id="loadslug" placeholder="bpc-157"></div><button class="ghost" onclick="loadSlug()">Load</button></div>
<label>Slug <span class="hint">blank = from title</span></label><input id="slug" placeholder="bpc-157">
<label>Title</label><input id="title" value="BPC-157: Evidence-Graded Review">
<div class="row">
<div><label>Register</label><select id="register"><option>accessible</option><option selected>standard</option><option>technical</option></select></div>
<div><label>Theme</label><select id="theme"><option>light</option><option selected>dark</option></select></div>
<div><label>Accent</label><input id="accent" value="#ff7a1a"></div>
</div>
<label>Tags <span class="hint">comma-separated</span></label><input id="tags" value="peptide, tendon">
<label>Body <span class="hint">Markdown: ## Heading · **bold** · - bullet · [text](url)</span></label>
<textarea id="body" rows="9">## What it is
**BPC-157** is a synthetic peptide sold as a research chemical. Not an approved drug.

## Evidence
- Rodent studies show accelerated tendon healing.
- Essentially no human trials.</textarea>
<label>Claims <span class="hint">JSON array</span></label>
<textarea id="claims" class="code" rows="6">[
  { "id": "c1", "text": "In rodents, BPC-157 accelerated tendon healing.", "section": "Evidence", "tier": "preclinical", "source_ids": ["s1"] },
  { "id": "c2", "text": "BPC-157 benefits human tendinopathy.", "section": "Evidence", "tier": "speculative", "source_status": "unsourced" }
]</textarea>
<label>Sources <span class="hint">JSON array — server fetches each URL + checks the quote</span></label>
<textarea id="sources" class="code" rows="5">[
  { "id": "s1", "type": "pubmed", "url": "https://pubmed.ncbi.nlm.nih.gov/20388970/", "title": "BPC 157 and tendon fibroblasts", "quote": "tendon", "summary": "Rodent tendon study.", "claim_ids": ["c1"] }
]</textarea>
<label>Your name / model</label><input id="model" value="manual">
<div class="bar"><button class="go" onclick="publish()">Publish</button><button class="ghost" onclick="blankForm()">Blank form</button></div>
</div>

<!-- ============ LEDGER ============ -->
<div class="pane" id="pane-led">
<div class="bar" style="position:static;margin:6px 0 14px"><button class="ghost" onclick="loadLedger()">Refresh</button></div>
<div id="ledger"></div>
</div>

<div id="result"></div>
</div>
<script>
function $(id){return document.getElementById(id);}
$('tk').value=localStorage.getItem('seed_tk')||'';
$('tk').addEventListener('change',function(){localStorage.setItem('seed_tk',$('tk').value);});
function key(){return $('tk').value.trim().toLowerCase();}
function slugify(s){return String(s||'').trim().toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-\$/g,'');}
function msg(h,c){var m=$('result');m.style.display='block';m.className=c||'ok';m.innerHTML=h;m.scrollIntoView({behavior:'smooth',block:'nearest'});}
function tab(n){['gen','write','led'].forEach(function(x){$('pane-'+x).className='pane'+(x===n?' on':'');$('t-'+x).className='tabb'+(x===n?' on':'');});if(n==='led')loadLedger();}
function ok(j){var v=j.verification||{};var o='<b>Published.</b> <a href="/a/'+j.slug+'" target="_blank">Open /a/'+j.slug+' &rarr;</a><br>'+j.claims+' claims · '+j.sources+' sources · verified '+(v.verified||0)+' · dead links '+(v.dead_or_broken_links||0)+' · unverified quotes '+(v.unverified_quotes||0);if(j.validation_notes&&j.validation_notes.length)o+='<br><span style="color:#f0d0a0">notes: '+j.validation_notes.join(' · ')+'</span>';msg(o,'ok');}

async function generate(){
  if(!key()){msg('Paste your owner access key at the top first.','err');return;}
  var p={slug:slugify($('g-slug').value)||undefined,model:$('g-model').value.trim(),register:$('g-register').value,max_tokens:3500,system_prompt:$('g-sys').value,ask:$('g-ask').value};
  msg('Generating with '+p.model+'… the model writes it, then it verifies + publishes (10-40s).','work');
  try{var r=await fetch('/api/protocol/write',{method:'POST',headers:{'x-terminal-key':key(),'content-type':'application/json'},body:JSON.stringify(p)});var j=await r.json();
    if(!r.ok||j.error){msg('Failed: '+(j.error||r.status)+(j.raw_preview?'<br><span style="color:#caa">model said: '+j.raw_preview.replace(/</g,'&lt;')+'</span>':''),'err');return;}
    ok(j.draft);}catch(e){msg('Network error: '+e.message,'err');}
}
async function queueJob(){
  if(!key()){msg('Paste your owner access key at the top first.','err');return;}
  var p={role:'writer',model:$('g-model').value.trim(),model_spec:{reasoning:'none',max_tokens:3500},system_prompt:$('g-sys').value,ask:$('g-ask').value,item:slugify($('g-slug').value)||$('g-ask').value,register:$('g-register').value,post_to:'POST /api/protocol/write'};
  try{var r=await fetch('/api/tasks',{method:'POST',headers:{'x-terminal-key':key(),'content-type':'application/json'},body:JSON.stringify(p)});var j=await r.json();
    if(!r.ok||j.error){msg('Queue failed: '+(j.error||r.status),'err');return;}msg('Queued writer job <b>#'+j.id+'</b>.','ok');}catch(e){msg('Network error: '+e.message,'err');}
}
async function publish(){
  if(!key()){msg('Paste your owner access key at the top first.','err');return;}
  var title=$('title').value.trim();var slug=$('slug').value.trim()||slugify(title);
  if(!title){msg('A title is required.','err');return;}
  var claims,sources;
  try{claims=JSON.parse($('claims').value||'[]');}catch(e){msg('Claims JSON invalid: '+e.message,'err');return;}
  try{sources=JSON.parse($('sources').value||'[]');}catch(e){msg('Sources JSON invalid: '+e.message,'err');return;}
  var p={slug:slug,title:title,body:$('body').value,register:$('register').value,tags:$('tags').value.split(',').map(function(t){return t.trim();}).filter(Boolean),style:{theme:$('theme').value,accent:$('accent').value},claims:claims,sources:sources,prov:{model:$('model').value||'manual',action:'write'}};
  msg('Publishing… fetching + verifying each source.','work');
  try{var r=await fetch('/api/protocol/draft',{method:'POST',headers:{'x-terminal-key':key(),'content-type':'application/json'},body:JSON.stringify(p)});var j=await r.json();
    if(!r.ok||j.error){msg('Rejected ('+r.status+'): '+(j.error||'')+' '+(j.errors?JSON.stringify(j.errors):''),'err');return;}ok(j);loadLedger();}catch(e){msg('Network error: '+e.message,'err');}
}
async function loadSlug(){
  var s=slugify($('loadslug').value);if(!s){msg('Type a slug to load.','err');return;}
  try{var j=await (await fetch('/api/articles/'+s+'?format=post')).json();
    if(j.error){msg('No article "'+s+'".','err');return;}
    $('slug').value=j.slug;$('title').value=j.title;$('body').value=j.body||'';$('tags').value=(j.tags||[]).join(', ');
    if(j.register)$('register').value=j.register;$('claims').value=JSON.stringify(j.claims||[],null,2);$('sources').value=JSON.stringify(j.sources||[],null,2);
    msg('Loaded "'+s+'". Edit and Publish to replace it.','ok');}catch(e){msg('Load failed: '+e.message,'err');}
}
async function loadLedger(){
  try{var j=await (await fetch('/api/articles')).json();var arts=j.articles||[];
    if(!arts.length){$('ledger').innerHTML='<p style="color:#9a9aa6">No articles yet. Generate one on the Generate tab.</p>';return;}
    $('ledger').innerHTML=arts.map(function(a){var b='/api/articles/'+a.slug;
      return '<div class="lrow"><div class="lh"><a class="lslug" href="/a/'+a.slug+'" target="_blank">'+a.slug+'</a>'+
        '<button class="ghost sm" onclick="led(\\''+a.slug+'\\')">ledger</button>'+
        '<button class="ghost sm del" onclick="del(\\''+a.slug+'\\')">delete</button></div>'+
        '<div class="lrest">GET '+b+' · POST '+b+' · PUT '+b+' · PATCH '+b+' · DELETE '+b+'</div>'+
        '<div class="lbody" id="lb-'+a.slug+'"></div></div>';}).join('');
  }catch(e){$('ledger').innerHTML='<p style="color:#f3c4c4">Could not load: '+e.message+'</p>';}
}
async function led(slug){
  var el=$('lb-'+slug);el.innerHTML='loading…';
  try{var a=await (await fetch('/api/articles/'+slug)).json();var e=a.energy||{};var models=(a.contributions||[]).map(function(c){return c.model;});var uniq=models.filter(function(v,i){return models.indexOf(v)===i;});
    el.innerHTML='<b>'+(a.provenance||[]).length+'</b> provenance passes · <b>'+(a.sources||[]).length+'</b> sources · <b>'+(a.contributions||[]).length+'</b> contributions · '+(a.revisions||0)+' revisions · '+((e.tokens_total>0)?(e.tokens_total+' tokens · $'+(e.cost_usd||0)):'tokens/cost unrecorded')+
      '<br><a href="/api/articles/'+slug+'/provenance" target="_blank">verify provenance</a> · <a href="/api/articles/'+slug+'/sources" target="_blank">sources</a> · <a href="/api/articles/'+slug+'/contributions" target="_blank">contributions</a>'+
      (uniq.length?'<br>models: '+uniq.join(', '):'');
  }catch(e){el.innerHTML='error: '+e.message;}
}
async function del(slug){
  if(!key()){msg('Paste your owner access key first.','err');return;}
  if(!confirm('Delete '+slug+'?'))return;
  try{await fetch('/api/articles/'+slug,{method:'DELETE',headers:{'x-terminal-key':key()}});loadLedger();msg('Deleted '+slug+'.','ok');}catch(e){msg('Delete failed: '+e.message,'err');}
}
function blankForm(){['slug','title','tags','body','model'].forEach(function(i){$(i).value='';});$('claims').value='[]';$('sources').value='[]';$('model').value='manual';$('title').focus();}
</script>
</body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
