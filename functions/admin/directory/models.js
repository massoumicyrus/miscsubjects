// /admin/directory/models — ONE view of every model, organised around the single
// Cloudflare AI Gateway. Answers, in the surface: what models run through the gateway,
// how billing is centralised (Unified vs BYOK vs Workers-AI Neurons), and which models
// have web search. Registry-driven from /api/providers (functions/_lib/providers.js).
import { shellHtml } from '../_layout.js';

export async function onRequestGet() {
  const body = `
<style>
.mdl{max-width:1320px}
.mdl h2{margin-top:26px;display:flex;align-items:baseline;gap:10px}
.mdl h2 .k{font-size:12px;color:var(--muted);font-weight:500}
.gw{border:1px solid var(--line-strong);border-radius:12px;padding:18px 20px;margin:14px 0 8px;background:var(--panel)}
.gw h3{margin:0 0 4px;font-size:16px}
.gw .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:12px}
.gw .box{border:1px solid var(--line);border-radius:8px;padding:12px 14px;background:var(--bg)}
.gw .box b{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:6px}
.gw code{font-family:var(--mono);font-size:11.5px;background:var(--bg);padding:1px 5px;border-radius:4px}
.pill{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;margin:2px 3px 2px 0}
.pill.uni{background:#123d2a;color:#7ff0b0;border:1px solid #1f6b48}
.pill.byok{background:#2b2410;color:#f0d47f;border:1px solid #6b5a1f}
.pill.neu{background:#101c3d;color:#7fb0f0;border:1px solid #1f406b}
.pill.web{background:#3d1030;color:#f07fd4;border:1px solid #6b1f56}
.pill.no{background:#232a34;color:#8a94a3;border:1px solid #333c48}
.mdl .modchips{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 6px}
.mdl .mc{padding:3px 11px;border-radius:99px;font-size:11px;font-weight:600;border:1px solid var(--line-strong);cursor:pointer;color:var(--ink-soft);background:var(--panel)}
.mdl .mc.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.mdl table{font-size:12.5px}
.mdl td,.mdl th{padding:7px 9px}
.mdl .num{font-family:var(--mono);white-space:nowrap}
.mdl .note{color:var(--muted);font-size:11.5px}
</style>
<div class="mdl">
<h1>Models — one gateway, every provider</h1>
<div class="gw" id="gwcard">loading gateway…</div>

<div class="modchips" id="modchips"></div>
<input id="q" type="text" placeholder="search model / provider / capability…" style="width:100%;max-width:560px;margin:4px 0 10px" oninput="setQ(this.value)">
<label class="note" style="margin-left:8px"><input id="gwonly" type="checkbox" onchange="render()" style="width:auto"> only models routable through the gateway</label>
<div id="catalog">loading…</div>
</div>
<script>
let REG=null, MOD='all', Q='';
function e(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(v){ return v==null?'—':v; }

// company key -> the gateway provider name (compat prefix). null = not on the gateway.
var GWNAME = { anthropic:'anthropic', openai:'openai', xai:'xai', google:'google-ai-studio', moonshot:null };
function gwProvider(ck, m){
  if (ck==='cloudflare') return m.run_via==='workers_ai_binding' ? 'workers-ai' : (m.author||'workers-ai');
  return GWNAME[ck] !== undefined ? GWNAME[ck] : ck;
}
function billingFor(ck, gp){
  var G=REG.gateway;
  if (ck==='cloudflare') return {cls:'neu', txt:'Neurons (CF)'};
  if (gp && G.billing.unified_providers.indexOf(gp)>=0) return {cls:'uni', txt:'Unified-eligible'};
  return {cls:'byok', txt:'BYOK'};
}
function webFor(ck, gp, m){
  var G=REG.gateway, w = gp && G.web_search.providers[gp];
  if (w && w.supported) return {cls:'web', txt:'web search'};
  return {cls:'no', txt:'—'};
}

async function boot(){
  REG = await fetch('/api/providers').then(function(r){return r.json();});
  var G=REG.gateway;
  document.getElementById('gwcard').innerHTML =
    '<h3>The Cloudflare AI Gateway — <code>'+e(G.id)+'</code></h3>'
    +'<div class="note">One authenticated endpoint proxies every provider. Dispatch a model as <code>'+e(G.dispatch_prefix)+'</code>.</div>'
    +'<div class="grid">'
      +'<div class="box"><b>What models</b>'+G.compat_providers.map(function(p){return '<span class="pill no">'+e(p)+'</span>';}).join('')
        +'<div class="note" style="margin-top:6px">Any model these providers publish, plus every <code>@cf/*</code> Workers-AI model.</div></div>'
      +'<div class="box"><b>Centralised billing</b>'
        +'<div><span class="pill uni">Unified</span> Cloudflare bills you — one bill, no provider keys:</div>'
        +'<div style="margin:4px 0">'+G.billing.unified_providers.map(function(p){return '<span class="pill uni">'+e(p)+'</span>';}).join('')+'</div>'
        +'<div class="note">'+e(G.billing.unified_fee)+'. ZDR: '+G.billing.zdr_available.join(', ')+'.</div>'
        +'<div class="note" style="margin-top:5px"><span class="pill byok">BYOK</span> provider bills you · <span class="pill neu">Neurons</span> Workers-AI, CF-billed.</div>'
        +'<div class="note" style="margin-top:5px">Enable: '+e(G.billing.enable)+'</div></div>'
      +'<div class="box"><b>Web search</b>'
        +'<div class="note">Cloudflare adds none — it is provider-native and passes through:</div>'
        +'<div style="margin-top:5px">'+Object.keys(G.web_search.providers).filter(function(p){return G.web_search.providers[p].supported;}).map(function(p){return '<span class="pill web">'+e(p)+'</span>';}).join('')+'</div>'
        +'<div class="note" style="margin-top:6px">CF "AI Search"/AutoRAG searches YOUR documents, not the web.</div></div>'
    +'</div>';
  var mods = ['all'].concat(Array.from(new Set(Object.values(REG.providers).flatMap(function(p){return p.models.map(function(m){return m.modality;});}))));
  document.getElementById('modchips').innerHTML = mods.map(function(m){ return '<span class="mc'+(m==='all'?' on':'')+'" data-m="'+m+'" onclick="setMod(\\''+m+'\\')">'+m+'</span>'; }).join('');
  render();
}
function setMod(m){ MOD=m; document.querySelectorAll('.mc').forEach(function(c){ c.classList.toggle('on', c.dataset.m===m); }); render(); }
function setQ(v){ Q=String(v||'').toLowerCase().trim(); render(); }
function matchQ(m){
  if(!Q) return true;
  var hay=[m.model_id,m.note,m.author,m.task,m.hosting].concat(m.capabilities||[]).concat(m.flags||[]).join(' ').toLowerCase();
  return hay.indexOf(Q)>=0;
}
function render(){
  var html='', shown=0, gwonly=document.getElementById('gwonly').checked;
  Object.keys(REG.providers).forEach(function(ck){
    var p = REG.providers[ck];
    var ms = p.models.filter(function(m){
      if (!((MOD==='all'||m.modality===MOD) && matchQ(m))) return false;
      if (gwonly){ var gp=gwProvider(ck,m); if(!gp) return false; }
      return true;
    });
    if (!ms.length) return;
    shown += ms.length;
    html += '<h2>'+e(p.label)+' <span class="k">key '+e(p.api_key_name)+' · <a href="'+e(p.docs_url)+'" target="_blank">docs</a> · <a href="/api/providers/'+ck+'" target="_blank">JSON</a></span></h2>';
    html += '<table><thead><tr><th>model</th><th>modality</th><th>route</th><th>billing</th><th>web</th><th>context</th><th>longest out</th><th>$ in /1M</th><th>$ out /1M</th><th>notes</th></tr></thead><tbody>';
    ms.forEach(function(m){
      var gp = gwProvider(ck,m);
      var route = gp==='workers-ai' ? 'Workers AI' : (gp ? 'gw:'+gp : 'direct only');
      var bill = billingFor(ck,gp), web = webFor(ck,gp,m);
      html += '<tr>'
        +'<td class="num"><b>'+e(m.model_id)+'</b></td>'
        +'<td>'+e(m.modality)+'</td>'
        +'<td class="num note">'+e(route)+'</td>'
        +'<td><span class="pill '+bill.cls+'">'+bill.txt+'</span></td>'
        +'<td><span class="pill '+web.cls+'">'+web.txt+'</span></td>'
        +'<td class="num">'+fmt(m.context_window)+'</td>'
        +'<td class="num">'+fmt(m.max_output)+'</td>'
        +'<td class="num">'+ (m.input_ppm==null?'—':'$'+m.input_ppm) +'</td>'
        +'<td class="num">'+ (m.output_ppm==null?'—':'$'+m.output_ppm) +'</td>'
        +'<td class="note">'+ e(m.note||(m.voices?('voices: '+m.voices.join(', ')):'')).slice(0,140) +'</td>'
        +'</tr>';
    });
    html += '</tbody></table>';
  });
  document.getElementById('catalog').innerHTML = html || '<p class="empty">No models match.</p>';
}
boot();
</script>
`;
  return new Response(shellHtml({ activeHref: '/admin/directory/models', title: 'Models', body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
