// /admin/traffic-console — the operator interface for the traffic engine.
//
// The DATA tab is the point: one row per visitor/decision, a column for every captured field,
// populated from the ledger (traffic_decisions.signals_json) — the JCI-style populated grid. The
// other tabs act on that data: the split, a visitor tester, plain-English rules, the field catalog,
// the whitelist/blacklist (seeded from JustCloakIt history), and version testing.

import { shellHtml } from './_layout.js';

const BODY = `
<style>
.tc-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px}
.tc-tabs button{background:#fff;border:1px solid var(--line);border-radius:8px;padding:9px 14px;cursor:pointer;font-weight:600;font-size:13px}
.tc-tabs button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.tc-panel{display:none}.tc-panel.on{display:block}
.tc-card{border:1px solid var(--line);border-radius:10px;background:#fff;padding:16px;margin:0 0 14px}
.tc-card h3{margin:0 0 10px;font-size:14px}
.tc-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:0 0 10px}
.tc-row input,.tc-row select,.tc-full input{width:100%;padding:8px;border:1px solid var(--line);border-radius:7px;font-size:13px}
.tc-full{margin:0 0 10px}
textarea{width:100%;min-height:60px;padding:10px;border:1px solid var(--line);border-radius:8px;font:13px var(--mono);resize:vertical}
button.go{background:var(--ink);color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:600;cursor:pointer}
button.ghost{background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px 12px;cursor:pointer;font-size:12px}
.grid-wrap{overflow:auto;border:1px solid var(--line);border-radius:8px;background:#fff;max-height:74vh}
table.grid{border-collapse:collapse;font-size:11px;white-space:nowrap}
table.grid th,table.grid td{text-align:left;padding:5px 8px;border-bottom:1px solid var(--line);border-right:1px solid #f0eee8}
table.grid thead th{position:sticky;top:0;background:#faf9f6;z-index:2;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted)}
table.grid thead th.g-decision{background:#eef2fb;color:#26418f}
table.grid td:first-child,table.grid th:first-child{position:sticky;left:0;background:#fff;z-index:1;border-right:2px solid var(--line)}
table.grid thead th:first-child{z-index:3;background:#eef2fb}
table.grid tbody tr:hover td{background:#fafaf7}
table.tc{width:100%;border-collapse:collapse;font-size:12px}table.tc th,table.tc td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line);vertical-align:top}table.tc th{background:#faf9f6;font-size:11px;text-transform:uppercase;color:var(--muted)}
.pill{display:inline-block;font:600 10px/1 var(--mono);text-transform:uppercase;padding:4px 8px;border-radius:999px;border:1px solid var(--line)}
.pill.block{background:#fde8e8;border-color:#f5b5b5;color:#9b1c1c}.pill.allow{background:#e7f6ec;border-color:#a8ddba;color:#1c6b34}.pill.challenge{background:#fdf2df;border-color:#eccd8a;color:#8a5a00}.pill.squeeze{background:#e9eefc;border-color:#b6c6f2;color:#26418f}
.muted{color:var(--muted);font-size:12px}.big{font:700 24px/1 var(--mono)}.stat{border:1px solid var(--line);border-radius:8px;padding:12px;background:#fff}
.grid4{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:0 0 12px}
.res{background:#0e1116;color:#d7e0ea;border-radius:8px;padding:12px;font:12px/1.5 var(--mono);white-space:pre-wrap;max-height:340px;overflow:auto}
code{background:#f2f0ea;padding:1px 5px;border-radius:4px;font-size:12px}
.split .lane{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:9px 12px;background:#fff;margin-bottom:6px}
</style>

<section class="traffic-head" style="display:flex;justify-content:space-between;align-items:end;gap:14px;flex-wrap:wrap">
  <div><h1>Traffic console</h1><p class="subtitle">Every visitor as a row, every captured field as a column — straight from the ledger. Then act on it: rules, whitelist/blacklist, version tests.</p></div>
  <div><label class="muted">Ruleset </label><select id="rs" style="padding:8px;border:1px solid var(--line);border-radius:7px"></select></div>
</section>

<div class="tc-tabs">
  <button data-tab="data" class="on">Data (every field)</button>
  <button data-tab="split">Split</button>
  <button data-tab="test">Test a visitor</button>
  <button data-tab="rules">Rules (plain English)</button>
  <button data-tab="fields">Field reference</button>
  <button data-tab="lists">Whitelist / Blacklist</button>
  <button data-tab="versions">Version testing</button>
</div>

<div id="p-data" class="tc-panel on">
  <div style="display:flex;gap:8px;align-items:center;margin:0 0 10px;flex-wrap:wrap">
    <input id="d-q" placeholder="filter rows (country, ISP, browser, reason…)" style="flex:1;min-width:220px;padding:8px;border:1px solid var(--line);border-radius:7px">
    <button class="ghost" id="d-prev">◀ prev</button><span id="d-note" class="muted"></span><button class="ghost" id="d-next">next ▶</button>
    <button class="ghost" id="d-cols">Columns…</button>
  </div>
  <div id="d-colpick" class="tc-card" style="display:none"></div>
  <div class="grid-wrap"><table class="grid"><thead id="d-head"></thead><tbody id="d-body"></tbody></table></div>
  <p class="muted" id="d-count" style="margin-top:8px"></p>
</div>

<div id="p-split" class="tc-panel">
  <div class="grid4" id="split-metrics"></div>
  <div class="tc-card"><h3>How visitors split (rules in priority order)</h3><div id="split-lanes" class="split"><p class="muted">Loading…</p></div></div>
</div>

<div id="p-test" class="tc-panel">
  <div class="tc-card"><h3>Send a hypothetical visitor through the live rules — nothing is written</h3>
    <div class="tc-row"><input id="t-country" placeholder="country (US, KP…)"><input id="t-region" placeholder="region (CA…)"><input id="t-bot" placeholder="bot score 0-100"><input id="t-asorg" placeholder="ISP / org"></div>
    <div class="tc-row"><input id="t-tags" placeholder="profile tags (vip…)"><input id="t-ua" placeholder="user agent"><input id="t-ref" placeholder="referrer host"><select id="t-known"><option value="">unknown visitor</option><option value="1">known profile</option></select></div>
    <button class="go" id="t-run">Run through the splitter</button><div id="t-out" style="margin-top:12px"></div>
  </div>
</div>

<div id="p-rules" class="tc-panel">
  <div class="tc-card"><h3>Declare a rule in plain English</h3>
    <p class="muted">e.g. <code>if country is KP then block</code> · <code>if bot score under 30 then challenge</code> · <code>if tag contains vip then send to dst_offer</code> · <code>if status is approved then allow</code></p>
    <div class="tc-full"><textarea id="r-text" placeholder="if &lt;condition&gt; then &lt;action&gt;"></textarea></div>
    <div class="tc-row"><input id="r-prio" placeholder="priority (lower first, e.g. 50)"><input id="r-name" placeholder="name (optional)"></div>
    <button class="go" id="r-add">Add rule</button> <button class="ghost" id="r-activate">Activate ruleset (make live)</button>
    <div id="r-out" class="muted" style="margin-top:8px"></div>
  </div>
  <div class="tc-card"><h3>Current rules</h3><div style="overflow:auto"><table class="tc"><thead><tr><th>#</th><th>Rule</th><th>State</th></tr></thead><tbody id="r-list"></tbody></table></div></div>
</div>

<div id="p-fields" class="tc-panel">
  <div class="tc-card"><h3>Every field captured on each visitor — the columns in the Data tab</h3>
    <input id="f-q" placeholder="filter fields…" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:7px;margin:0 0 10px">
    <div style="overflow:auto;max-height:600px"><table class="tc"><thead><tr><th>Name</th><th>Group</th><th>Type</th><th>What it is</th><th>Example values</th></tr></thead><tbody id="f-list"></tbody></table></div>
  </div>
</div>

<div id="p-lists" class="tc-panel">
  <div class="grid4" id="list-counts"></div>
  <div class="tc-card"><h3>Add a whitelist / blacklist entry</h3>
    <div class="tc-row"><select id="l-list"><option value="allow">Whitelist (allow)</option><option value="deny">Blacklist (deny)</option></select><select id="l-kind"><option>country</option><option>visitor_hash</option><option>phone_hash</option><option>ip</option><option>cidr</option><option>asn</option><option>email_domain</option><option>tag</option><option>referrer</option><option>ua</option><option>region</option><option>device</option></select><input id="l-value" placeholder="value (e.g. KP)"><input id="l-reason" placeholder="reason (required)"></div>
    <div class="tc-row"><select id="l-effect"><option value="decide">decide (allow/deny outright)</option><option value="skip_challenge">skip Turnstile</option><option value="route">route to destination</option><option value="score">adjust risk</option></select><input id="l-eff" placeholder="destination id (route) / delta (score)"></div>
    <button class="go" id="l-add">Add entry</button> <span id="l-out" class="muted"></span>
  </div>
  <div class="tc-card"><h3>Seed from JustCloakIt history</h3><p class="muted">Approved → whitelist, blocked → blacklist, over the full 2026-07→08 corpus.</p>
    <button class="go" id="seed-run">Seed a batch</button> <button class="ghost" id="seed-auto">Run to completion</button><div id="seed-out" class="muted" style="margin-top:8px"></div>
  </div>
</div>

<div id="p-versions" class="tc-panel">
  <div class="tc-card"><h3>Squeeze page versions (A/B by weight, sticky per visitor)</h3>
    <div style="overflow:auto"><table class="tc"><thead><tr><th>ID</th><th>Name</th><th>Ver</th><th>Weight</th><th>Status</th><th>Headline</th></tr></thead><tbody id="v-sqz"></tbody></table></div>
    <div class="tc-row" style="margin-top:10px"><input id="sq-name" placeholder="variant name"><input id="sq-head" placeholder="headline"><input id="sq-cta" placeholder="CTA text"><input id="sq-weight" placeholder="weight (e.g. 1)"></div>
    <button class="go" id="sq-add">Add squeeze variant</button> <span id="sq-out" class="muted"></span>
  </div>
  <div class="tc-card"><h3>Destination versions</h3>
    <div style="overflow:auto"><table class="tc"><thead><tr><th>ID</th><th>Name</th><th>Type</th><th>URL / members</th><th>Health</th></tr></thead><tbody id="v-dst"></tbody></table></div>
    <div class="tc-row" style="margin-top:10px"><input id="dn-name" placeholder="name"><select id="dn-type"><option>redirect</option><option>inline</option><option>group</option></select><input id="dn-url" placeholder="url (redirect) — https://…"><input id="dn-hosts" placeholder="allowed hosts (example.com)"></div>
    <button class="go" id="dn-add">Add destination</button> <span id="dn-out" class="muted"></span>
    <p class="muted" style="margin-top:12px"><b>Destination-page A/B:</b> make a <code>group</code> destination whose members are two destinations with weights — the engine splits weighted and sticks each visitor to one arm.</p>
    <div class="tc-row"><input id="gp-name" placeholder="group name"><input id="gp-a" placeholder="member A dest id"><input id="gp-aw" placeholder="A weight"><input id="gp-b" placeholder="member B dest id"></div>
    <div class="tc-row"><input id="gp-bw" placeholder="B weight" style="max-width:160px"></div>
    <button class="go" id="gp-add">Add A/B group</button> <span id="gp-out" class="muted"></span>
  </div>
</div>

<script>
const API='/api/traffic',$=(s)=>document.querySelector(s);
async function api(p,o){const r=await fetch(API+p,Object.assign({credentials:'same-origin',headers:{'content-type':'application/json'}},o||{}));return r.json();}
let RS=null,SNAP={rulesets:[],destinations:[],campaigns:[]},GRID={columns:[],rows:[],page:1,pages:1},HIDDEN=new Set();
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function pill(txt){const p=(txt||'').toLowerCase();let c='';if(p.includes('deny')||p.includes('block'))c='block';else if(p.includes('allow')||p==='approved')c='allow';else if(p.includes('verify')||p.includes('challenge'))c='challenge';else if(p.includes('squeeze'))c='squeeze';return '<span class="pill '+c+'">'+esc(txt||'')+'</span>';}

document.querySelectorAll('.tc-tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tc-tabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on');document.querySelectorAll('.tc-panel').forEach(x=>x.classList.remove('on'));$('#p-'+b.dataset.tab).classList.add('on');});

async function boot(){
  const rl=await api('/rulesets');SNAP=rl;
  const sel=$('#rs');sel.innerHTML=(rl.rulesets||[]).map(r=>'<option value="'+r.id+'">'+esc(r.name||r.id)+' ('+r.state+')</option>').join('')||'<option value="">none</option>';
  RS=(rl.rulesets[0]||{}).id;sel.onchange=()=>{RS=sel.value;loadSplit();loadRules();};
  loadGrid();loadFields();loadSplit();loadRules();loadLists();loadVersions();
}

async function loadGrid(){
  const g=await api('/grid?per_page=50&page='+GRID.page);GRID.columns=g.columns||[];GRID.rows=g.rows||[];GRID.pages=g.pages||1;GRID.total=g.total||0;
  renderGrid();$('#d-note').textContent='page '+g.page+' / '+g.pages;$('#d-count').textContent=(g.total||0)+' decisions captured · '+GRID.columns.length+' columns';
}
function renderGrid(){
  const q=($('#d-q').value||'').toLowerCase();
  const cols=GRID.columns.filter(c=>!HIDDEN.has(c.key));
  $('#d-head').innerHTML='<tr>'+cols.map(c=>'<th class="'+(c.group==='decision'?'g-decision':'')+'" title="'+esc(c.key)+'">'+esc(c.label)+'</th>').join('')+'</tr>';
  const rows=GRID.rows.filter(r=>!q||Object.values(r).join(' ').toLowerCase().includes(q));
  $('#d-body').innerHTML=rows.map(r=>'<tr>'+cols.map(c=>{let v=r[c.key];if(c.key==='experience'||c.key==='outcome')v=v?pill(v):'';return '<td>'+(typeof v==='string'&&v.startsWith('<span')?v:esc(v))+'</td>';}).join('')+'</tr>').join('')||'<tr><td>No decisions yet — hit /go/&lt;entry&gt; to generate rows.</td></tr>';
}
$('#d-q').oninput=renderGrid;
$('#d-prev').onclick=()=>{if(GRID.page>1){GRID.page--;loadGrid();}};
$('#d-next').onclick=()=>{if(GRID.page<GRID.pages){GRID.page++;loadGrid();}};
$('#d-cols').onclick=()=>{const el=$('#d-colpick');if(el.style.display==='none'){el.style.display='block';el.innerHTML='<b>Show columns</b><br>'+GRID.columns.map(c=>'<label style="display:inline-block;margin:4px 10px 4px 0;font-size:12px"><input type=checkbox data-c="'+c.key+'" '+(HIDDEN.has(c.key)?'':'checked')+'> '+esc(c.label)+'</label>').join('');el.querySelectorAll('input').forEach(i=>i.onchange=()=>{if(i.checked)HIDDEN.delete(i.dataset.c);else HIDDEN.add(i.dataset.c);renderGrid();});}else el.style.display='none';};

async function loadSplit(){
  const m=await api('/metrics');const mm=m.metrics||{};
  $('#split-metrics').innerHTML=[['requests',mm.requests],['approved',mm.approved],['blocked',mm.blocked],['challenged',mm.challenged],['squeeze',(mm.funnel||{}).squeeze_impressions],['verified',(mm.funnel||{}).verified]].map(([k,v])=>'<div class="stat"><div class="big">'+(v||0)+'</div><div class="muted">'+k+'</div></div>').join('');
  const rp=await api('/rules/plain?ruleset_id='+encodeURIComponent(RS||''));
  const lanes=(rp.rules||[]).map(r=>'<div class="lane"><div><b>'+esc(r.name||r.id)+'</b> <span class="muted">#'+r.priority+(r.enabled?'':' · off')+'</span><br><span class="muted">'+esc(r.plain.split(' then ')[0])+'</span></div><div>'+pill((r.plain.split(' then ')[1]||''))+'</div></div>').join('');
  const dd=(mm.destination_distribution||[]).map(d=>'<div class="lane"><div>went to <code>'+esc(d.k)+'</code></div><div><span class="pill">'+d.n+'</span></div></div>').join('');
  $('#split-lanes').innerHTML=(lanes||'<p class="muted">No rules yet.</p>')+(dd?'<h3 style="margin:14px 0 6px;font-size:13px">Where live traffic went (24h)</h3>'+dd:'');
}
async function loadRules(){const rp=await api('/rules/plain?ruleset_id='+encodeURIComponent(RS||''));$('#r-list').innerHTML=(rp.rules||[]).map((r,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(r.plain)+'</b><br><span class="muted">'+esc(r.id)+'</span></td><td>'+(r.enabled?'on':'off')+'</td></tr>').join('')||'<tr><td colspan=3 class="muted">none</td></tr>';}
async function loadFields(){const f=await api('/fields');window.__F=f.fields||[];renderFields();$('#f-q').oninput=renderFields;}
function renderFields(){const q=($('#f-q').value||'').toLowerCase();$('#f-list').innerHTML=(window.__F||[]).filter(x=>!q||(x.field+x.path+x.description).toLowerCase().includes(q)).map(x=>'<tr><td><b>'+esc(x.field)+'</b><br><span class="muted">'+esc(x.path)+'</span></td><td>'+esc(x.group)+'</td><td>'+esc(x.type)+'</td><td>'+esc(x.description)+'</td><td>'+esc(x.values?(Array.isArray(x.values)?x.values.join(', '):x.values):'')+'</td></tr>').join('');}
async function loadLists(){const s=await api('/seed-history',{method:'POST',body:JSON.stringify({limit:1,seed_limit:1})}).catch(()=>({}));$('#list-counts').innerHTML=[['whitelist (from history)',s.whitelist],['blacklist (from history)',s.blacklist]].map(([k,v])=>'<div class="stat"><div class="big">'+(v||0)+'</div><div class="muted">'+k+'</div></div>').join('');}
async function loadVersions(){
  const rl=await api('/rulesets');SNAP=rl;
  $('#v-dst').innerHTML=(rl.destinations||[]).map(d=>'<tr><td><code>'+esc(d.id)+'</code></td><td>'+esc(d.name||'')+'</td><td>'+esc(d.type)+'</td><td class="muted">'+esc(d.url||(d.type==='group'?'(weighted members)':''))+'</td><td>'+esc(d.health||'')+'</td></tr>').join('')||'<tr><td colspan=5 class="muted">none</td></tr>';
  const sq=await api('/squeeze');
  $('#v-sqz').innerHTML=(sq.squeeze_pages||[]).map(s=>'<tr><td><code>'+esc(s.id)+'</code></td><td>'+esc(s.name||'')+'</td><td>'+esc(s.version)+'</td><td>'+esc(s.weight)+'</td><td>'+esc(s.status)+(s.enabled?'':' (off)')+'</td><td>'+esc(s.headline||'')+'</td></tr>').join('')||'<tr><td colspan=6 class="muted">no squeeze variants yet</td></tr>';
}
function campaignId(){return (SNAP.campaigns&&SNAP.campaigns[0]||{}).id;}
$('#sq-add').onclick=async()=>{const cid=campaignId();if(!cid){$('#sq-out').textContent='no campaign found';return;}const r=await api('/config',{method:'POST',body:JSON.stringify({table:'traffic_squeeze_pages',patch:{__create:true,campaign_id:cid,name:$('#sq-name').value,headline:$('#sq-head').value,cta_text:$('#sq-cta').value,message_template:'JOIN {code}',weight:Number($('#sq-weight').value)||1,status:'active',enabled:1}})});$('#sq-out').textContent=r.ok?'Added variant '+r.id:('Error: '+JSON.stringify(r.errors||r.error));loadVersions();};
$('#dn-add').onclick=async()=>{const patch={__create:true,name:$('#dn-name').value,type:$('#dn-type').value,enabled:1};if($('#dn-url').value)patch.url=$('#dn-url').value;if($('#dn-hosts').value)patch.allowed_hosts_json=JSON.stringify($('#dn-hosts').value.split(',').map(s=>s.trim()).filter(Boolean));const r=await api('/config',{method:'POST',body:JSON.stringify({table:'traffic_destinations',patch})});$('#dn-out').textContent=r.ok?'Added '+r.id:('Error: '+JSON.stringify(r.errors||r.error));loadVersions();};
$('#gp-add').onclick=async()=>{const members=[{id:$('#gp-a').value,weight:Number($('#gp-aw').value)||1},{id:$('#gp-b').value,weight:Number($('#gp-bw').value)||1}];const r=await api('/config',{method:'POST',body:JSON.stringify({table:'traffic_destinations',patch:{__create:true,name:$('#gp-name').value||'A/B group',type:'group',enabled:1,sticky:1,members_json:JSON.stringify(members)}})});$('#gp-out').textContent=r.ok?'Added group '+r.id+' — set a rule/destination to it, then Activate.':('Error: '+JSON.stringify(r.errors||r.error));loadVersions();};

$('#t-run').onclick=async()=>{const entry=(SNAP.rulesets.find(r=>r.id===RS)||{}).entry?.[0]?.entry||'acceptance';const sim={url:location.origin+'/go/'+entry,entry,ruleset_id:RS,country:$('#t-country').value||undefined,region:$('#t-region').value||undefined,bot_score:$('#t-bot').value?Number($('#t-bot').value):undefined,as_org:$('#t-asorg').value||undefined,user_agent:$('#t-ua').value||undefined,profile:{known:$('#t-known').value==='1',tags:($('#t-tags').value||'').split(',').map(s=>s.trim()).filter(Boolean)}};if($('#t-ref').value)sim.headers={referer:'https://'+$('#t-ref').value};const r=await api('/explain',{method:'POST',body:JSON.stringify({sim})});const d=r.decision||{};$('#t-out').innerHTML='<div class="tc-card"><b>Sent to:</b> '+pill(d.experience||('send to '+(d.destination_id||'—')))+'<br><span class="muted">reason: '+esc(d.reason||'')+'</span><br><span class="muted">matched: '+esc((d.matched_rules||[]).join(', ')||'none')+'</span></div><div class="res">'+esc(JSON.stringify({experience:d.experience,destination:d.destination_id,outcome:d.outcome,risk:d.risk,reasons:(d.reasons||[]).slice(0,10)},null,1))+'</div>';};
$('#r-add').onclick=async()=>{const r=await api('/rule/plain',{method:'POST',body:JSON.stringify({ruleset_id:RS,text:$('#r-text').value,priority:$('#r-prio').value||undefined,name:$('#r-name').value||undefined})});$('#r-out').textContent=r.ok?('Added: '+r.plain+' — Activate to make live.'):('Error: '+(r.message||r.error));if(r.ok){$('#r-text').value='';loadRules();}};
$('#r-activate').onclick=async()=>{const r=await api('/rulesets/'+encodeURIComponent(RS)+'/activate',{method:'POST',body:JSON.stringify({note:'console'})});$('#r-out').textContent=r.ok?('Activated — revision '+r.revision+', live.'):('Error: '+(r.errors?JSON.stringify(r.errors):r.error));loadSplit();};
$('#l-add').onclick=async()=>{const patch={__create:true,list:$('#l-list').value,kind:$('#l-kind').value,value:$('#l-value').value,reason:$('#l-reason').value,effect:$('#l-effect').value};if($('#l-effect').value==='route'&&$('#l-eff').value)patch.effect_json=JSON.stringify({destination:$('#l-eff').value});if($('#l-effect').value==='score'&&$('#l-eff').value)patch.effect_json=JSON.stringify({delta:Number($('#l-eff').value)});const r=await api('/config',{method:'POST',body:JSON.stringify({table:'traffic_list_entries',patch})});$('#l-out').textContent=r.ok?'Added.':('Error: '+JSON.stringify(r.errors||r.error));};
$('#seed-run').onclick=async()=>{$('#seed-out').textContent='Seeding…';const r=await api('/seed-history',{method:'POST',body:JSON.stringify({seed_limit:30000})});$('#seed-out').textContent='Imported '+r.imported+' · whitelist '+r.whitelist+' · blacklist '+r.blacklist+(r.import_done&&r.seed_done?' · DONE':' · more remain');loadLists();};
$('#seed-auto').onclick=async()=>{let ic=null,sc=null,n=0;$('#seed-out').textContent='Running…';while(n<60){const r=await api('/seed-history',{method:'POST',body:JSON.stringify({import_cursor:ic,seed_cursor:sc,limit:400,seed_limit:30000})});ic=r.import_cursor;sc=r.seed_cursor;n++;$('#seed-out').textContent='Batch '+n+': whitelist '+r.whitelist+' · blacklist '+r.blacklist;if(r.import_done&&r.seed_done)break;}loadLists();};

boot();
</script>`;

export async function onRequestGet() {
  return new Response(shellHtml({ activeHref: '/admin/traffic', title: 'Traffic console', body: BODY }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
