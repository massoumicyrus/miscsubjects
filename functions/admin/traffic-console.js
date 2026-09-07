
import { shellHtml } from './_layout.js';

const BODY = `
<style>
.tc-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 18px}
.tc-tabs button{background:#fff;border:1px solid var(--line);border-radius:8px;padding:9px 14px;cursor:pointer;font-weight:600;font-size:13px}
.tc-tabs button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.tc-panel{display:none}.tc-panel.on{display:block}
.tc-card{border:1px solid var(--line);border-radius:10px;background:#fff;padding:16px;margin:0 0 14px}
.tc-card h3{margin:0 0 10px;font-size:14px}
.tc-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:0 0 10px}
.tc-row input,.tc-row select,.tc-full input,.tc-full select{width:100%;padding:8px;border:1px solid var(--line);border-radius:7px;font-size:13px}
.tc-full{margin:0 0 10px}
textarea{width:100%;min-height:64px;padding:10px;border:1px solid var(--line);border-radius:8px;font:13px var(--mono);resize:vertical}
button.go{background:var(--ink);color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:600;cursor:pointer}
button.ghost{background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px 12px;cursor:pointer;font-size:12px}
table.tc{width:100%;border-collapse:collapse;font-size:12px}
table.tc th,table.tc td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line);vertical-align:top}
table.tc th{position:sticky;top:0;background:#faf9f6;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.pill{display:inline-block;font:600 10px/1 var(--mono);text-transform:uppercase;letter-spacing:.05em;padding:4px 8px;border-radius:999px;border:1px solid var(--line)}
.pill.block{background:#fde8e8;border-color:#f5b5b5;color:#9b1c1c}.pill.allow{background:#e7f6ec;border-color:#a8ddba;color:#1c6b34}
.pill.challenge{background:#fdf2df;border-color:#eccd8a;color:#8a5a00}.pill.squeeze{background:#e9eefc;border-color:#b6c6f2;color:#26418f}
.split{display:grid;gap:8px}.split .lane{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:9px 12px;background:#fff}
.muted{color:var(--muted);font-size:12px}.big{font:700 26px/1 var(--mono)}.stat{border:1px solid var(--line);border-radius:8px;padding:12px;background:#fff}
.grid4{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:0 0 12px}
.res{background:#0e1116;color:#d7e0ea;border-radius:8px;padding:12px;font:12px/1.5 var(--mono);white-space:pre-wrap;word-break:break-word;max-height:340px;overflow:auto}
code{background:#f2f0ea;padding:1px 5px;border-radius:4px;font-size:12px}
</style>

<section class="traffic-head" style="display:flex;justify-content:space-between;align-items:end;gap:14px;flex-wrap:wrap">
  <div><h1>Traffic console</h1><p class="subtitle">The cloaker/splitter, in plain English. Pick a ruleset, see who goes where, test a visitor, declare rules, manage the whitelist &amp; blacklist, and version-test the pages.</p></div>
  <div><label class="muted">Ruleset </label><select id="rs" style="padding:8px;border:1px solid var(--line);border-radius:7px"></select></div>
</section>

<div class="tc-tabs">
  <button data-tab="split" class="on">Split</button>
  <button data-tab="test">Test a visitor</button>
  <button data-tab="rules">Rules (plain English)</button>
  <button data-tab="fields">Captured fields</button>
  <button data-tab="lists">Whitelist / Blacklist</button>
  <button data-tab="versions">Version testing</button>
</div>

<div id="p-split" class="tc-panel on">
  <div class="grid4" id="split-metrics"></div>
  <div class="tc-card"><h3>How visitors split (rules in priority order)</h3><div id="split-lanes" class="split"><p class="muted">Loading…</p></div></div>
</div>

<div id="p-test" class="tc-panel">
  <div class="tc-card"><h3>Send a hypothetical visitor through the live rules — nothing is written</h3>
    <div class="tc-row">
      <input id="t-country" placeholder="country (US, KP…)"><input id="t-region" placeholder="region (CA…)">
      <input id="t-bot" placeholder="bot score 0-100"><input id="t-asorg" placeholder="ISP / org (Amazon…)">
    </div>
    <div class="tc-row">
      <input id="t-tags" placeholder="profile tags (vip, reviewed…)"><input id="t-ua" placeholder="user agent">
      <input id="t-ref" placeholder="referrer host"><select id="t-known"><option value="">unknown visitor</option><option value="1">known profile</option></select>
    </div>
    <button class="go" id="t-run">Run through the splitter</button>
    <div id="t-out" style="margin-top:12px"></div>
  </div>
</div>

<div id="p-rules" class="tc-panel">
  <div class="tc-card"><h3>Declare a rule in plain English</h3>
    <p class="muted">Examples: <code>if country is KP then block</code> · <code>if bot score under 30 then challenge</code> · <code>if tag contains vip then send to dst_offer</code> · <code>if status is approved then allow</code> · <code>if any then squeeze</code></p>
    <div class="tc-full"><textarea id="r-text" placeholder="if &lt;condition&gt; then &lt;action&gt;"></textarea></div>
    <div class="tc-row"><input id="r-prio" placeholder="priority (lower runs first, e.g. 50)"><input id="r-name" placeholder="name (optional)"></div>
    <button class="go" id="r-add">Add rule</button> <button class="ghost" id="r-activate">Activate ruleset (make live)</button>
    <div id="r-out" class="muted" style="margin-top:8px"></div>
  </div>
  <div class="tc-card"><h3>Current rules</h3><div style="overflow:auto"><table class="tc"><thead><tr><th>#</th><th>Rule (plain English)</th><th>State</th></tr></thead><tbody id="r-list"></tbody></table></div></div>
</div>

<div id="p-fields" class="tc-panel">
  <div class="tc-card"><h3>Every field captured on each visitor</h3>
    <p class="muted">Use the <b>name</b> on the left when you write a rule. These are captured on every request and stored on the decision — the same set JustCloakIt returned, plus bot score, verified-bot, risk, ASN, TLS and consistency.</p>
    <input id="f-q" placeholder="filter fields…" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:7px;margin:0 0 10px">
    <div style="overflow:auto;max-height:600px"><table class="tc"><thead><tr><th>Name</th><th>Group</th><th>Type</th><th>What it is</th><th>Example values</th></tr></thead><tbody id="f-list"></tbody></table></div>
  </div>
</div>

<div id="p-lists" class="tc-panel">
  <div class="grid4" id="list-counts"></div>
  <div class="tc-card"><h3>Add a whitelist / blacklist entry</h3>
    <div class="tc-row">
      <select id="l-list"><option value="allow">Whitelist (allow)</option><option value="deny">Blacklist (deny)</option></select>
      <select id="l-kind"><option>country</option><option>visitor_hash</option><option>phone_hash</option><option>ip</option><option>cidr</option><option>asn</option><option>email_domain</option><option>tag</option><option>referrer</option><option>ua</option><option>region</option><option>device</option><option>profile</option></select>
      <input id="l-value" placeholder="value (e.g. KP)"><input id="l-reason" placeholder="reason (required)">
    </div>
    <div class="tc-row"><select id="l-effect"><option value="decide">decide (allow/deny outright)</option><option value="skip_challenge">skip the Turnstile challenge</option><option value="route">route to a destination</option><option value="score">adjust risk score</option></select><input id="l-eff-dest" placeholder="destination id (for route) or delta (for score)"></div>
    <button class="go" id="l-add">Add entry</button> <span id="l-out" class="muted"></span>
  </div>
  <div class="tc-card"><h3>Seed from JustCloakIt history</h3>
    <p class="muted">Every visitor JustCloakIt <b>approved</b> becomes whitelist history; every one it <b>blocked</b> becomes blacklist history. Runs in batches over the full 2026-07→08 corpus.</p>
    <button class="go" id="seed-run">Seed a batch</button> <button class="ghost" id="seed-auto">Run to completion</button>
    <div id="seed-out" class="muted" style="margin-top:8px"></div>
  </div>
  <div class="tc-card"><h3>Current list entries</h3><div style="overflow:auto"><table class="tc"><thead><tr><th>List</th><th>Kind</th><th>Value</th><th>Effect</th><th>Reason</th></tr></thead><tbody id="l-rows"></tbody></table></div></div>
</div>

<div id="p-versions" class="tc-panel">
  <div class="tc-card"><h3>Squeeze page versions (A/B by weight)</h3><div style="overflow:auto"><table class="tc"><thead><tr><th>ID</th><th>Name</th><th>Version</th><th>Weight</th><th>Status</th><th>Headline</th></tr></thead><tbody id="v-sqz"></tbody></table></div><p class="muted">A visitor is stuck to one variant by their profile/device, so a test is stable per person. Add a variant: it splits by weight automatically.</p></div>
  <div class="tc-card"><h3>Destination versions (weighted split / groups)</h3><div style="overflow:auto"><table class="tc"><thead><tr><th>ID</th><th>Name</th><th>Type</th><th>URL</th><th>Health</th></tr></thead><tbody id="v-dst"></tbody></table></div><p class="muted">A destination of type <code>group</code> splits weighted across members (sticky per visitor) — that is destination-page version testing.</p></div>
</div>

<script>
const API='/api/traffic';
const $=(s)=>document.querySelector(s);
async function api(path,opts){const r=await fetch(API+path,Object.assign({credentials:'same-origin',headers:{'content-type':'application/json'}},opts||{}));return r.json();}
let RS=null, SNAP={destinations:[],campaigns:[]};
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function actionPill(plain){const p=(plain||'').toLowerCase();let cls='';if(p.includes('block'))cls='block';else if(p.includes('allow'))cls='allow';else if(p.includes('challenge'))cls='challenge';else if(p.includes('squeeze'))cls='squeeze';return '<span class="pill '+cls+'">'+esc((plain.split(' then ')[1]||plain))+'</span>';}

document.querySelectorAll('.tc-tabs button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tc-tabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
  document.querySelectorAll('.tc-panel').forEach(x=>x.classList.remove('on'));$('#p-'+b.dataset.tab).classList.add('on');
});

async function boot(){
  const rl=await api('/rulesets');
  SNAP=rl;
  const sel=$('#rs');sel.innerHTML=(rl.rulesets||[]).map(r=>'<option value="'+r.id+'">'+esc(r.name||r.id)+' ('+r.state+')</option>').join('')||'<option value="">no rulesets</option>';
  RS=(rl.rulesets[0]||{}).id;sel.onchange=()=>{RS=sel.value;loadSplit();loadRules();loadVersions();};
  loadFields();loadSplit();loadRules();loadLists();loadVersions();
}
async function loadSplit(){
  const m=await api('/metrics');const mm=m.metrics||{};
  $('#split-metrics').innerHTML=[['requests',mm.requests],['approved',mm.approved],['blocked',mm.blocked],['challenged',mm.challenged],['squeeze impressions',(mm.funnel||{}).squeeze_impressions],['verified',(mm.funnel||{}).verified]].map(([k,v])=>'<div class="stat"><div class="big">'+(v||0)+'</div><div class="muted">'+k+'</div></div>').join('');
  const rp=await api('/rules/plain?ruleset_id='+encodeURIComponent(RS||''));
  const lanes=(rp.rules||[]).map(r=>'<div class="lane"><div><b>'+esc(r.name||r.id)+'</b> <span class="muted">#'+r.priority+(r.enabled?'':' · disabled')+(r.shadow?' · shadow':'')+'</span><br><span class="muted">'+esc(r.plain.split(' then ')[0])+'</span></div><div>'+actionPill(r.plain)+'</div></div>').join('');
  const dd=(mm.destination_distribution||[]).map(d=>'<div class="lane"><div>observed → <code>'+esc(d.k)+'</code></div><div><span class="pill">'+d.n+'</span></div></div>').join('');
  $('#split-lanes').innerHTML=(lanes||'<p class="muted">No rules yet — add one under Rules.</p>')+(dd?'<h3 style="margin:14px 0 6px;font-size:13px">Where live traffic actually went (24h)</h3>'+dd:'');
}
async function loadRules(){
  const rp=await api('/rules/plain?ruleset_id='+encodeURIComponent(RS||''));
  $('#r-list').innerHTML=(rp.rules||[]).map((r,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(r.plain)+'</b><br><span class="muted">'+esc(r.id)+'</span></td><td>'+(r.enabled?'on':'off')+(r.shadow?' · shadow':'')+'</td></tr>').join('')||'<tr><td colspan=3 class="muted">none</td></tr>';
}
async function loadFields(){
  const f=await api('/fields');window.__F=f.fields||[];renderFields();
  $('#f-q').oninput=renderFields;
}
function renderFields(){
  const q=($('#f-q').value||'').toLowerCase();
  $('#f-list').innerHTML=(window.__F||[]).filter(x=>!q||(x.field+x.path+x.description).toLowerCase().includes(q)).map(x=>'<tr><td><b>'+esc(x.field)+'</b><br><span class="muted">'+esc(x.path)+'</span></td><td>'+esc(x.group)+'</td><td>'+esc(x.type)+'</td><td>'+esc(x.description)+'</td><td>'+esc(x.values?(Array.isArray(x.values)?x.values.join(', '):x.values):'')+'</td></tr>').join('');
}
async function loadLists(){
  const seed=await api('/seed-history',{method:'POST',body:JSON.stringify({limit:1,seed_limit:1})}).catch(()=>({}));
  const rows=await api('/rulesets');// reuse for destinations only; list entries via a query below
  // counts come from the seed response (whitelist/blacklist history)
  $('#list-counts').innerHTML=[['whitelist (history)',seed.whitelist],['blacklist (history)',seed.blacklist]].map(([k,v])=>'<div class="stat"><div class="big">'+(v||0)+'</div><div class="muted">'+k+'</div></div>').join('');
}
async function loadVersions(){
  const rl=SNAP.rulesets?SNAP:await api('/rulesets');
  $('#v-dst').innerHTML=(rl.destinations||[]).map(d=>'<tr><td><code>'+esc(d.id)+'</code></td><td>'+esc(d.name||'')+'</td><td>'+esc(d.type)+'</td><td class="muted">'+esc(d.url||'')+'</td><td>'+esc(d.health||'')+'</td></tr>').join('')||'<tr><td colspan=5 class="muted">none</td></tr>';
  // squeeze pages: query via config table read is not exposed; show campaigns' squeeze note
  $('#v-sqz').innerHTML=(rl.campaigns||[]).map(c=>'<tr><td colspan=6 class="muted">Campaign '+esc(c.name||c.id)+' — SMS '+esc(c.sms_phone||'')+'</td></tr>').join('')||'<tr><td colspan=6 class="muted">no campaigns</td></tr>';
}

$('#t-run').onclick=async()=>{
  const sim={url:location.origin+'/go/'+((SNAP.rulesets.find(r=>r.id===RS)||{}).entry?.[0]?.entry||'acceptance'),entry:(SNAP.rulesets.find(r=>r.id===RS)||{}).entry?.[0]?.entry||'acceptance',
    country:$('#t-country').value||undefined,region:$('#t-region').value||undefined,bot_score:$('#t-bot').value?Number($('#t-bot').value):undefined,as_org:$('#t-asorg').value||undefined,
    user_agent:$('#t-ua').value||undefined,ruleset_id:RS,
    profile:{known:$('#t-known').value==='1',tags:($('#t-tags').value||'').split(',').map(s=>s.trim()).filter(Boolean)}};
  if($('#t-ref').value)sim.headers={referer:'https://'+$('#t-ref').value};
  const r=await api('/explain',{method:'POST',body:JSON.stringify({sim})});
  const d=r.decision||{};
  $('#t-out').innerHTML='<div class="tc-card"><b>This visitor is sent to:</b> '+actionPill('then '+(d.experience||('send to '+(d.destination_id||'—'))))+'<br><span class="muted">reason: '+esc(d.reason||'')+'</span><br><span class="muted">matched: '+esc((d.matched_rules||[]).join(', ')||'none')+'</span></div><div class="res">'+esc(JSON.stringify({experience:d.experience,destination:d.destination_id,outcome:d.outcome,risk:d.risk,reasons:(d.reasons||[]).slice(0,10)},null,1))+'</div>';
};

$('#r-add').onclick=async()=>{
  const r=await api('/rule/plain',{method:'POST',body:JSON.stringify({ruleset_id:RS,text:$('#r-text').value,priority:$('#r-prio').value||undefined,name:$('#r-name').value||undefined})});
  $('#r-out').textContent=r.ok?('Added: '+r.plain+' — click Activate to make it live.'):('Error: '+(r.message||r.error));
  if(r.ok){$('#r-text').value='';loadRules();}
};
$('#r-activate').onclick=async()=>{const r=await api('/rulesets/'+encodeURIComponent(RS)+'/activate',{method:'POST',body:JSON.stringify({note:'console'})});$('#r-out').textContent=r.ok?('Activated — revision '+r.revision+', now live.'):('Error: '+(r.errors?JSON.stringify(r.errors):r.error));loadSplit();};

$('#l-add').onclick=async()=>{
  const patch={__create:true,list:$('#l-list').value,kind:$('#l-kind').value,value:$('#l-value').value,reason:$('#l-reason').value,effect:$('#l-effect').value};
  if($('#l-effect').value==='route'&&$('#l-eff-dest').value)patch.effect_json=JSON.stringify({destination:$('#l-eff-dest').value});
  if($('#l-effect').value==='score'&&$('#l-eff-dest').value)patch.effect_json=JSON.stringify({delta:Number($('#l-eff-dest').value)});
  const r=await api('/config',{method:'POST',body:JSON.stringify({table:'traffic_list_entries',patch})});
  $('#l-out').textContent=r.ok?'Added.':('Error: '+JSON.stringify(r.errors||r.error));
};
$('#seed-run').onclick=async()=>{$('#seed-out').textContent='Seeding…';const r=await api('/seed-history',{method:'POST',body:JSON.stringify({})});$('#seed-out').textContent='Imported '+r.imported+' rows, seeded '+r.seeded+'. Whitelist history: '+r.whitelist+' · Blacklist history: '+r.blacklist+(r.import_done&&r.seed_done?' · DONE':' · more remain — click Run to completion');loadLists();};
$('#seed-auto').onclick=async()=>{let ic=null,sc=null,n=0;$('#seed-out').textContent='Running full seed…';while(n<40){const r=await api('/seed-history',{method:'POST',body:JSON.stringify({import_cursor:ic,seed_cursor:sc})});ic=r.import_cursor;sc=r.seed_cursor;n++;$('#seed-out').textContent='Batch '+n+': whitelist '+r.whitelist+' · blacklist '+r.blacklist+(r.import_done?' · import done':'');if(r.import_done&&r.seed_done)break;}$('#seed-out').textContent+=' — stopped after '+n+' batches';loadLists();};

boot();
</script>`;

export async function onRequestGet() {
  return new Response(shellHtml({ activeHref: '/admin/traffic', title: 'Traffic console', body: BODY }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
