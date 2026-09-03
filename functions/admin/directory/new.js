// /admin/directory/new — company-aware NEW agent/model creation (T5/T6/T15).
// Pick company -> fields constrain from the provider registry. System prompt has its
// OWN field; the JSON payload renders live beside it. Every option (max output,
// temperature range, reasoning, web search, response format, endpoint) is a control.
// Cost in/out/cache + longest output shown per model. Save -> PUT /api/directory/<KEY>.
// (A static segment file beats [key].js for the exact path "/admin/directory/new".)
import { shellHtml } from '../_layout.js';

export async function onRequestGet() {
  const body = `
<style>
.nw{max-width:1200px}
.nw .grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.nw label{display:block;font-size:12.5px;font-weight:600;color:var(--ink-soft);margin:12px 0 4px}
.nw input,.nw select,.nw textarea{width:100%;font-family:var(--mono);font-size:13px}
.nw textarea{min-height:240px;line-height:1.5}
.nw .row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.nw .modelcard{border:1px solid var(--line);border-radius:8px;padding:12px 14px;background:var(--panel);font-size:12.5px;margin-top:10px;line-height:1.6}
.nw .modelcard b{color:var(--ink)}
.nw .must{color:#178c45;font-weight:700}
.nw .can{color:var(--muted)}
.nw pre{min-height:240px;max-height:480px;overflow:auto;font-size:12.5px;background:#fff;border:1px solid var(--line)}
.nw .actionsbar{display:flex;gap:8px;margin-bottom:14px}
.nw .actionsbar a{padding:6px 12px;border:1px solid var(--line-strong);border-radius:6px;font-size:13px;color:var(--ink-soft)}
.nw .actionsbar a.on{background:var(--accent-soft);border-color:var(--accent);color:var(--accent);font-weight:600}
#new-status{margin-left:12px;font-size:13px;font-weight:500}
.fieldnote{font-size:11px;color:var(--muted);margin-top:2px}
</style>
<div class="nw">
<h1>New — create from any company</h1>
<div class="actionsbar">
  <a class="on">NEW</a>
  <a href="/admin/directory">EDIT / DELETE (directory list)</a>
</div>
<p class="subtitle">Pick a company; the fields below constrain to that API. <span class="must">green = MUST</span>, <span class="can">grey = CAN</span>. The exact docs are one click away, and the on-hand registry answers via <code>[PROVIDERS]&lt;company&gt;[/PROVIDERS]</code>.</p>

<div class="row2">
  <div>
    <label>KEY (the directory row name, e.g. ROUTER2, GROK_VISION) <span class="must">MUST</span></label>
    <input id="f-key" placeholder="UPPER_SNAKE_CASE">
  </div>
  <div>
    <label>Company <span class="must">MUST</span></label>
    <select id="f-company" onchange="onCompany()"></select>
    <div class="fieldnote" id="company-note"></div>
  </div>
</div>

<div class="row2">
  <div>
    <label>Modality <span class="must">MUST</span></label>
    <select id="f-modality" onchange="onModality()"></select>
  </div>
  <div>
    <label>Model <span class="must">MUST</span></label>
    <select id="f-model" onchange="onModel()"></select>
  </div>
</div>

<div class="modelcard" id="modelcard">pick a model…</div>

<div class="row2">
  <div>
    <label>Route <span class="must">MUST</span></label>
    <select id="f-route" onchange="sync()">
      <option value="gateway">Through the Cloudflare AI Gateway (gw:provider/model) — recommended</option>
      <option value="direct">Direct to provider API</option>
    </select>
    <div class="fieldnote" id="route-note"></div>
  </div>
  <div>
    <label>Endpoint <span class="must">MUST</span></label>
    <select id="f-endpoint" onchange="sync()"></select>
  </div>
  <div>
    <label>API key name <span class="must">MUST</span> (secret name, never the key)</label>
    <input id="f-apikey" readonly>
  </div>
</div>

<div class="row2">
  <div>
    <label>max output tokens <span class="can">CAN</span> (≤ model max)</label>
    <input id="f-maxout" type="number" oninput="sync()">
  </div>
  <div>
    <label>temperature <span class="can">CAN</span></label>
    <input id="f-temp" type="number" step="0.05" oninput="sync()">
    <div class="fieldnote" id="temp-note"></div>
  </div>
</div>

<div class="row2">
  <div>
    <label>reasoning <span class="can">CAN</span></label>
    <select id="f-reasoning" onchange="sync()"></select>
    <div class="fieldnote" id="reasoning-note"></div>
  </div>
  <div>
    <label>response_format <span class="can">CAN</span></label>
    <select id="f-rformat" onchange="sync()">
      <option value="">(default text)</option>
      <option value="json_object">json_object</option>
      <option value="json_schema">json_schema</option>
    </select>
  </div>
</div>

<label><input id="f-websearch" type="checkbox" onchange="sync()" style="width:auto"> web search / grounding <span class="can">CAN</span></label>

<div class="grid" style="margin-top:16px">
  <div>
    <label>System prompt (its own field — plain text)</label>
    <textarea id="f-system" oninput="sync()" spellcheck="false" placeholder="You are …"></textarea>
  </div>
  <div>
    <label>Outbound JSON payload (live; what will be sent)</label>
    <pre id="payload"></pre>
  </div>
</div>

<div style="margin-top:14px">
  <button type="button" onclick="create()">Create row</button>
  <span id="new-status"></span>
</div>
</div>

<script>
let REG = null, COMPANY = null;

function el(id){ return document.getElementById(id); }
function opts(sel, arr, val){ sel.innerHTML = arr.map(function(o){ return '<option value="'+o+'"'+(o===val?' selected':'')+'>'+o+'</option>'; }).join(''); }

async function boot(){
  REG = await fetch('/api/providers').then(function(r){ return r.json(); });
  opts(el('f-company'), Object.keys(REG.providers), 'xai');
  onCompany();
}

function onCompany(){
  COMPANY = REG.providers[el('f-company').value];
  el('company-note').textContent = 'base ' + COMPANY.base_url + ' · key ' + COMPANY.api_key_name + ' · docs ' + COMPANY.docs_url;
  el('f-apikey').value = COMPANY.api_key_name;
  var mods = Array.from(new Set(COMPANY.models.map(function(m){ return m.modality; })));
  opts(el('f-modality'), mods, mods[0]);
  // reasoning options
  var rv = (COMPANY.reasoning && COMPANY.reasoning.values) || [];
  el('f-reasoning').innerHTML = '<option value="">(none)</option>' + rv.map(function(v){ return '<option value="'+v+'">'+v+'</option>'; }).join('');
  el('reasoning-note').textContent = (COMPANY.reasoning && COMPANY.reasoning.note) || '';
  // temperature
  if (COMPANY.temperature && COMPANY.temperature.supported){
    var t = COMPANY.temperature.range || {min:0,max:2,default:1};
    el('f-temp').min = t.min; el('f-temp').max = t.max; el('f-temp').value = t.default; el('f-temp').disabled = false;
    el('temp-note').textContent = 'range ' + t.min + '–' + t.max + ' (default ' + t.default + ')';
  } else {
    el('f-temp').value = ''; el('f-temp').disabled = true;
    el('temp-note').textContent = (COMPANY.temperature && COMPANY.temperature.note) || 'not supported';
  }
  // endpoints
  opts(el('f-endpoint'), Object.keys(COMPANY.endpoints), Object.keys(COMPANY.endpoints)[0]);
  onModality();
}

function modelsForModality(){
  return COMPANY.models.filter(function(m){ return m.modality === el('f-modality').value; });
}
function onModality(){
  var ms = modelsForModality();
  opts(el('f-model'), ms.map(function(m){ return m.model_id; }), ms.length ? ms[0].model_id : '');
  onModel();
}
function currentModel(){
  return COMPANY.models.find(function(m){ return m.model_id === el('f-model').value; }) || {};
}
function onModel(){
  var m = currentModel();
  var c = '';
  c += '<b>'+ (m.model_id||'?') +'</b> · modality '+ (m.modality||'?') +'<br>';
  c += 'context window: <b>'+ fmt(m.context_window) +'</b> · longest output: <b>'+ fmt(m.max_output) +'</b><br>';
  c += 'cost in/out per 1M: <b>$'+ fmt(m.input_ppm) +'</b> in / <b>$'+ fmt(m.output_ppm) +'</b> out';
  if (m.cached_input_ppm != null) c += ' · cached-in <b>$'+ fmt(m.cached_input_ppm) +'</b>';
  c += '<br>';
  if (COMPANY.cache) c += 'cache: '+ (COMPANY.cache.read ? ('read '+COMPANY.cache.read+' · write '+(COMPANY.cache.write_5m||COMPANY.cache.write||'?')) : (COMPANY.cache.note||'')) +'<br>';
  c += 'reasoning: '+ (m.reasoning ? 'yes' : (m.reasoning===false?'no':'—')) +' · endpoints: '+ ((m.endpoints||m.endpoint||Object.keys(COMPANY.endpoints)).toString());
  if (m.voices) c += '<br>voices: '+ m.voices.join(', ');
  if (m.note) c += '<br><i>'+ m.note +'</i>';
  el('modelcard').innerHTML = c;
  if (m.max_output) el('f-maxout').value = Math.min(Number(el('f-maxout').value)||m.max_output, m.max_output);
  // limit endpoint to the model's if specified
  if (m.endpoints) opts(el('f-endpoint'), m.endpoints, m.endpoints[0]);
  else if (m.endpoint) opts(el('f-endpoint'), [m.endpoint], m.endpoint);
  else opts(el('f-endpoint'), Object.keys(COMPANY.endpoints), el('f-endpoint').value);
  sync();
}
function fmt(v){ return v==null ? '—' : v; }

// company key -> gateway provider name (compat prefix). null = not on the gateway.
var GWNAME = { anthropic:'anthropic', openai:'openai', xai:'xai', google:'google-ai-studio', moonshot:null };
function gwProvider(){
  var ck = el('f-company').value, m = currentModel();
  if (ck==='cloudflare') return (m.run_via==='workers_ai_binding') ? null : (m.author||null);
  return GWNAME[ck] !== undefined ? GWNAME[ck] : ck;
}
function routeNote(){
  var G = REG.gateway, gp = gwProvider(), n = el('route-note');
  if (el('f-route').value !== 'gateway'){ n.textContent = 'Calls the provider API directly (provider bills you).'; return; }
  if (!gp){ n.textContent = 'This model is not on the gateway — it will be created as a direct call.'; return; }
  var uni = G.billing.unified_providers.indexOf(gp) >= 0;
  n.innerHTML = 'target <code>gw:'+gp+'/'+ (currentModel().model_id||'') +'</code> · billing: '
    + (uni ? '<b>Unified-eligible</b> (load CF credits → no provider key)' : '<b>BYOK</b> ('+el('f-apikey').value+')');
}

function buildPayload(){
  var company = el('f-company').value, m = currentModel(), sys = el('f-system').value;
  var temp = el('f-temp').value === '' ? null : parseFloat(el('f-temp').value);
  var maxout = el('f-maxout').value === '' ? null : parseInt(el('f-maxout').value,10);
  var reasoning = el('f-reasoning').value, rformat = el('f-rformat').value, web = el('f-websearch').checked;
  var gp = gwProvider();
  // Gateway route: one compat endpoint, model = "provider/model", gateway auth header.
  if (el('f-route').value === 'gateway' && gp && m.modality === 'text'){
    var G = REG.gateway;
    var pp = { url: G.compat_url, method:'POST',
      headers:{ 'cf-aig-authorization':'Bearer $AIG_TOKEN', 'content-type':'application/json' },
      body:{ model: gp+'/'+m.model_id, messages:[{role:'system',content:sys},{role:'user',content:'[incoming message]'}] } };
    // BYOK adds the provider key; Unified Billing omits it (Cloudflare bills the tokens).
    if (G.billing.unified_providers.indexOf(gp) < 0) pp.headers.Authorization = 'Bearer $'+COMPANY.api_key_name;
    if (temp!=null) pp.body.temperature=temp;
    if (maxout) pp.body.max_tokens=maxout;
    if (reasoning && reasoning!=='default') pp.body.reasoning_effort=reasoning;
    if (rformat) pp.body.response_format={type:rformat};
    return pp;
  }
  var p;
  if (company === 'anthropic'){
    p = { url: COMPANY.base_url + COMPANY.endpoints.messages, method:'POST',
      headers:{ 'x-api-key':'$'+COMPANY.api_key_name, 'anthropic-version':'2023-06-01', 'content-type':'application/json' },
      body:{ model:m.model_id, max_tokens: maxout||m.max_output||16000, system: sys, messages:[{role:'user', content:'[incoming message]'}] } };
    if (reasoning){ p.body.thinking={type:'adaptive'}; p.body.output_config={effort:reasoning}; }
    if (rformat) p.body.output_config = Object.assign(p.body.output_config||{}, {format:{type:rformat}});
  } else if (company === 'google'){
    p = { url: COMPANY.base_url + '/v1beta/models/'+m.model_id+':generateContent?key=$'+COMPANY.api_key_name, method:'POST',
      headers:{ 'content-type':'application/json' },
      body:{ system_instruction:{parts:[{text:sys}]}, contents:[{role:'user',parts:[{text:'[incoming message]'}]}] } };
    var gc = {}; if (temp!=null) gc.temperature=temp; if (maxout) gc.maxOutputTokens=maxout;
    if (Object.keys(gc).length) p.body.generationConfig=gc;
  } else { // xai + openai — OpenAI-shaped chat/responses
    var path = COMPANY.endpoints[el('f-endpoint').value] || COMPANY.endpoints.completions;
    p = { url: COMPANY.base_url + path, method:'POST',
      headers:{ Authorization:'Bearer $'+COMPANY.api_key_name, 'content-type':'application/json' },
      body:{ model:m.model_id, messages:[{role:'system',content:sys},{role:'user',content:'[incoming message]'}] } };
    if (temp!=null) p.body.temperature=temp;
    if (maxout) p.body.max_tokens=maxout;
    if (reasoning && reasoning!=='default' && reasoning!=='none') p.body.reasoning_effort=reasoning;
    if (reasoning==='none') p.body.reasoning_effort='none';
    if (rformat) p.body.response_format={type:rformat};
    if (web) p.body.search_parameters={mode:'auto'};
  }
  return p;
}
function sync(){ routeNote(); el('payload').textContent = JSON.stringify(buildPayload(), null, 2); }

async function create(){
  var key = el('f-key').value.trim();
  var st = el('new-status');
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)){ st.style.color='#c0392b'; st.textContent='KEY must be UPPER_SNAKE_CASE'; return; }
  var m = currentModel(), company = el('f-company').value, sys = el('f-system').value;
  var p = buildPayload();
  var rowType, target, auth, content;
  var gp = gwProvider();
  if (m.modality === 'text' && el('f-route').value === 'gateway' && gp){
    // gateway-routed agent: target = gw:provider/model. Dispatch adds the gateway auth
    // (AIG_TOKEN) + the provider key (BYOK) or nothing (Unified Billing) automatically.
    rowType='agent'; target='gw:'+gp+'/'+m.model_id; auth='bearer:'+COMPANY.api_key_name;
    content = sys || ('# '+key+' — gw:'+gp+'/'+m.model_id);
  } else if (m.modality === 'text'){
    // a conversational agent row: type=agent, target=model id, content=system prompt
    rowType='agent'; target=m.model_id; auth = company==='anthropic' ? ('x-api-key:'+COMPANY.api_key_name) : ('bearer:'+COMPANY.api_key_name);
    content = sys || ('# '+key+' — '+company+' '+m.model_id);
  } else {
    // image/video/tts/stt: an http row with the shaped payload as the body template
    rowType='http'; target = p.method+' '+p.url; auth = company==='anthropic' ? ('x-api-key:'+COMPANY.api_key_name) : ('bearer:'+COMPANY.api_key_name);
    content = '# '+key+' — '+company+' '+m.model_id+' ('+m.modality+'). '+(m.note||'')+'\\n'+JSON.stringify(p.body);
  }
  st.style.color='var(--muted)'; st.textContent='creating…';
  var res = await fetch('/api/directory/'+encodeURIComponent(key), { method:'PUT', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ type:rowType, target:target, auth:auth, content:content, category:'llm' }) });
  var j = await res.json();
  if (j.ok){ st.style.color='#178c45'; st.innerHTML='created — <a href="/admin/directory/'+encodeURIComponent(key)+'">open '+key+'</a>'; }
  else { st.style.color='#c0392b'; st.textContent='error: '+(j.error||res.status); }
}
boot();
</script>
`;
  return new Response(shellHtml({ activeHref: '/admin/directory', title: 'New', body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
