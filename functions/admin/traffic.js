import { shellHtml } from './_layout.js';

export function renderJciTrafficBody({ ledgerTab = false } = {}) {
  return `
<style>
.traffic-head{display:flex;align-items:end;justify-content:space-between;gap:18px;flex-wrap:wrap}.traffic-head h1{margin-bottom:4px}
.traffic-actions{display:flex;gap:8px}.traffic-metrics{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:10px;margin:20px 0}
.traffic-stat{border:1px solid var(--line);border-radius:8px;padding:13px;background:#fff}.traffic-stat b{display:block;font:700 24px/1 var(--mono)}.traffic-stat span{display:block;margin-top:7px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.traffic-filters{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:8px;margin:0 0 14px}.traffic-filters input,.traffic-filters select{width:100%}
.traffic-table{overflow:auto;border:1px solid var(--line);border-radius:8px;background:#fff}.traffic-table table{min-width:1450px}.traffic-table th{top:0}.traffic-table td{font-size:12px}.traffic-table .ua{max-width:360px}.traffic-table .desc{max-width:480px;font-family:var(--mono)}.page-sequence{display:grid;gap:5px}.page-hit{display:grid;grid-template-columns:140px minmax(260px,1fr);gap:8px}.page-hit time{color:var(--muted);font-family:var(--mono);font-size:10px}.page-hit code{background:#fff;padding:0}
.traffic-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px}.traffic-pager .buttons{display:flex;gap:8px}.visitor{font-family:var(--mono);font-size:11px}.class{font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:.04em}
@media(max-width:900px){.traffic-metrics{grid-template-columns:repeat(2,1fr)}.traffic-filters{grid-template-columns:1fr 1fr}.traffic-head{align-items:start}}
</style>
${ledgerTab ? '<div class="view-switch" style="position:static;margin-bottom:18px"><a href="/admin/ledger?view=chronology" class="vbig" style="text-decoration:none"><span class="vt">CHRONOLOGY</span><span class="vsub">every raw payload</span></a><a href="/admin/ledger?view=turns" class="vbig" style="text-decoration:none"><span class="vt">TURNS</span><span class="vsub">coding-agent conversations</span></a><a href="/admin/ledger?view=jci" class="vbig on" style="text-decoration:none"><span class="vt">JCI</span><span class="vsub">people · pages · traffic</span></a></div>' : ''}
<section class="traffic-head"><div><h1>JCI traffic</h1><p class="subtitle">One row per visitor session, with the exact miscsubjects pages opened in order. Every request is retained; switch the traffic type to inspect APIs, admin, and assets. Root redirect remains root-only.</p></div><div class="traffic-actions"><button id="refresh">Refresh</button><a id="csv" href="#">Download CSV</a></div></section>
<section id="metrics" class="traffic-metrics"></section>
<section class="traffic-filters">
  <input id="q" placeholder="Search path, visitor, ISP, location, browser">
  <select id="classification"><option value="">All visitors</option><option value="human">Human</option><option value="bot">Bot</option><option value="unclassified">Unclassified</option></select>
  <select id="segment"><option value="">All audience segments</option><option value="likely_human">Likely humans</option><option value="ai_company">AI companies</option><option value="search_crawler">Search crawlers</option><option value="automation">Bots / automation</option><option value="unclassified">Unclassified</option></select>
  <select id="visitor_status"><option value="">New + returning</option><option value="new">New visitors</option><option value="returning">Returning visitors</option></select>
  <select id="kind"><option value="" selected>All traffic</option><option value="page">Pages</option><option value="admin">Admin</option><option value="api">APIs</option><option value="asset">Assets</option><option value="request">Other methods</option></select>
  <input id="type" placeholder="Method, e.g. GET">
  <input id="country" placeholder="Country">
  <input id="isp" placeholder="ISP">
  <input id="min_pages" type="number" min="0" placeholder="Minimum pages">
  <input id="min_visits" type="number" min="0" placeholder="Minimum visits">
  <button id="apply">Apply</button>
</section>
<div id="table" class="traffic-table"><div class="empty">Loading traffic…</div></div>
<div class="traffic-pager"><span id="page-note"></span><div class="buttons"><button id="prev">Previous</button><button id="next">Next</button></div></div>
<script>
const state={page:1,pages:1};
function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
const incoming=new URLSearchParams(location.search);['q','classification','segment','visitor_status','kind','type','country','isp','min_pages','min_visits'].forEach(k=>{const el=document.getElementById(k);if(el&&incoming.has(k))el.value=incoming.get(k);});
function apiUrl(format){const u=new URL('/api/jci/traffic',location.origin);const here=new URLSearchParams(location.search);['share','terminal_key','tk'].forEach(k=>{if(here.get(k))u.searchParams.set(k,here.get(k));});['q','classification','segment','visitor_status','kind','type','country','isp','min_pages','min_visits'].forEach(k=>{const el=document.getElementById(k);if(el&&String(el.value).trim())u.searchParams.set(k,String(el.value).trim());});u.searchParams.set('page',String(state.page));u.searchParams.set('per_page','25');if(format)u.searchParams.set('format',format);return u.pathname+u.search;}
function stat(label,value){return '<div class="traffic-stat"><b>'+esc(value)+'</b><span>'+esc(label)+'</span></div>';}
function sequence(items){return '<div class="page-sequence">'+(items||[]).map(p=>'<div class="page-hit"><time>'+esc(p.date)+'</time><code>'+esc(p.path)+'</code></div>').join('')+'</div>';}
function sessionRow(r){return '<tr><td>'+esc(r.last_seen)+'</td><td class="visitor">'+esc(r.visitor)+'</td><td><span class="class">'+esc(r.segment)+'</span><br>'+esc(r.classification)+'</td><td>'+esc(r.visitor_status)+'</td><td>'+esc(r.page_count)+'</td><td>'+esc(r.lifetime_visits)+'</td><td class="desc">'+sequence(r.pages)+'</td><td>'+esc(r.requests)+'</td><td>'+esc(r.first_ever_seen)+'</td><td>'+esc((r.referers||[]).join('\\n'))+'</td><td>'+esc(r.isp)+'</td><td>'+esc(r.org)+'</td><td>'+esc(r.connection)+'</td><td>'+esc(r.browser)+'</td><td>'+esc(r.os)+'</td><td>'+esc(r.country)+'</td><td>'+esc(r.region)+'</td><td>'+esc(r.city)+'</td><td>'+esc(r.device)+'</td></tr>';}
async function load(){const table=document.getElementById('table');table.innerHTML='<div class="empty">Loading traffic…</div>';try{const res=await fetch(apiUrl());const contentType=res.headers.get('content-type')||'';const d=contentType.includes('application/json')?await res.json():{error:'Traffic service returned '+res.status};if(!res.ok){throw new Error(d.error||'Load failed');}state.pages=d.pages||1;const s=d.summary||{};document.getElementById('metrics').innerHTML=stat('Requests',s.total_requests||0)+stat('Visitors',s.unique_visitors||0)+stat('Visits',s.visits||0)+stat('Page views',s.page_views||0)+stat('Pages / visit',s.pages_per_visit||0)+stat('New visitors',s.new_visitors||0)+stat('Returning visitors',s.returning_visitors||0)+stat('Likely-human requests',s.likely_human_requests||0)+stat('AI-company requests',s.ai_company_requests||0);const head='<table><thead><tr><th>Last seen</th><th>Visitor</th><th>Audience</th><th>New / returning</th><th>Pages this visit</th><th>Total visits</th><th>Pages visited, in order</th><th>Requests</th><th>First seen</th><th>Referrer</th><th>ISP</th><th>Org</th><th>Connection</th><th>Browser</th><th>OS</th><th>Country</th><th>Region</th><th>City</th><th>Device</th></tr></thead><tbody>';const sessions=d.visitor_sessions||[];table.innerHTML=sessions.length?head+sessions.map(sessionRow).join('')+'</tbody></table>':'<div class="empty">No traffic matches these filters.</div>';document.getElementById('page-note').textContent='Page '+state.page+' of '+state.pages+' · '+d.total_sessions+' visits · '+d.total+' requests';document.getElementById('prev').disabled=state.page<=1;document.getElementById('next').disabled=state.page>=state.pages;document.getElementById('csv').href=apiUrl('csv');}catch(error){table.innerHTML='<div class="empty"><b>Traffic failed to load.</b><br>'+esc(error&&error.message?error.message:'Unknown error')+'<br><button id="retry-traffic" type="button">Retry</button></div>';document.getElementById('retry-traffic').onclick=load;}}
document.getElementById('apply').onclick=()=>{state.page=1;load();};document.getElementById('refresh').onclick=load;document.getElementById('prev').onclick=()=>{if(state.page>1){state.page--;load();}};document.getElementById('next').onclick=()=>{if(state.page<state.pages){state.page++;load();}};document.getElementById('q').addEventListener('keydown',e=>{if(e.key==='Enter'){state.page=1;load();}});load();
</script>`;
}

export async function onRequestGet() {
  const BODY = renderJciTrafficBody();
  return new Response(shellHtml({ activeHref: '/admin/traffic', title: 'JCI traffic', body: BODY }), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
