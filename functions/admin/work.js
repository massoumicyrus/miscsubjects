import { shellHtml } from './_layout.js';

// Unified surface: the aggregated work stack. Renders WORK_FEED — top priority, open tasks,
// GitHub issues, lead pipeline, and the append-only model thread — one page, auto-refreshing.
export async function onRequestGet(context) {
  const BODY = `
<style>
.work{max-width:1100px}
.work h1{margin:0 0 4px}
.work .sub{color:var(--muted);font-size:13px;margin:0 0 18px}
.wgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
@media(max-width:760px){.wgrid{grid-template-columns:1fr}}
.card{border:1px solid var(--line);border-radius:12px;background:#fff;padding:16px}
.card h2{margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.prio{border:2px solid var(--accent);background:var(--accent-soft)}
.prio .p{font-size:16px;font-weight:700;color:var(--ink)}
.pill{display:inline-block;background:var(--panel);border:1px solid var(--line);border-radius:99px;padding:2px 10px;font-size:12px;margin:2px 4px 2px 0}
.li{padding:7px 0;border-bottom:1px solid var(--line);font-size:14px}
.li:last-child{border-bottom:0}
.li .id{font:600 12px/1 var(--mono);color:var(--muted);margin-right:8px}
.thread .e{padding:9px 0;border-bottom:1px solid var(--line)}
.thread .e:last-child{border-bottom:0}
.thread .who{font:700 12px/1.4 var(--sans)}
.thread .k{font:700 9px/1.4 var(--sans);text-transform:uppercase;letter-spacing:.05em;border:1px solid var(--line);border-radius:99px;padding:1px 7px;margin-left:6px;color:var(--muted)}
.thread .ref{font:11px/1 var(--mono);color:var(--accent);margin-left:6px}
.thread .b{font-size:13px;color:var(--ink-soft);margin-top:3px;white-space:pre-wrap;overflow-wrap:anywhere}
.thread .ts{font:10px/1 var(--mono);color:var(--muted);float:right}
.appendbar{display:flex;gap:8px;margin-top:12px}
.appendbar input{flex:1;border:1px solid var(--line);border-radius:8px;padding:9px 12px;font-size:13px}
.appendbar button{border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:8px;padding:0 16px;font-weight:700;cursor:pointer}
.readme{font-size:12px;color:var(--muted);background:var(--panel);border-radius:8px;padding:10px 12px;margin-bottom:14px}
</style>
<div class="work">
<h1>Work</h1>
<p class="sub">The aggregated stack every model reads first. Top priority, open tasks, GitHub issues, the lead pipeline, and the append-only model thread — one surface.</p>
<div id="readme" class="readme">Loading…</div>
<div class="card prio"><h2>Top priority</h2><div class="p" id="prio">…</div></div>
<div class="wgrid">
  <div class="card"><h2>Open tasks (<span id="tcount">…</span>)</h2><div id="tasks"></div></div>
  <div class="card"><h2>GitHub issues</h2><div id="gh"></div></div>
  <div class="card"><h2>Lead pipeline</h2><div id="leads"></div></div>
  <div class="card"><h2>How to plug in a model</h2>
    <div style="font-size:13px;line-height:1.5">Hand any model a share token. Its first step: <code>WORK_FEED</code>. It posts back with <code>WORK_APPEND</code>. Everyone stays on this page.</div>
  </div>
</div>
<div class="card thread"><h2>Model thread — append-only</h2>
  <div id="thread"></div>
  <div class="appendbar"><input id="ap" placeholder="actor | kind | your note (e.g. the owner|note|ship it)"><button onclick="ap()">Append</button></div>
</div>
</div>
<script>
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
async function disp(key,body){const r=await fetch('/api/dispatch',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({key,body:body||''})});const j=await r.json();try{return JSON.parse(j.result);}catch{return j.result||j;}}
async function load(){
  const f=await disp('WORK_FEED','30');
  if(!f||typeof f!=='object'){document.getElementById('readme').textContent='Feed unavailable — sign in with your owner key at miscsubjects.com first.';return;}
  document.getElementById('readme').textContent=f.READ_ME||'';
  document.getElementById('prio').textContent=f.top_priority||'—';
  const ot=f.open_tasks||{};document.getElementById('tcount').textContent=ot.count||0;
  document.getElementById('tasks').innerHTML=(ot.owner_top||[]).map(t=>'<div class="li"><span class="id">#'+t.id+'</span>'+esc(t.text)+'</div>').join('')||'<div class="li">none</div>';
  const gh=f.github_issues||{};document.getElementById('gh').innerHTML=(gh.issues||[]).map(i=>'<div class="li"><span class="id">#'+i.number+'</span>'+esc(i.title)+'</div>').join('')||('<div class="li">'+esc(gh.note||'none')+'</div>');
  const lp=f.leads_pipeline||{};document.getElementById('leads').innerHTML=Object.keys(lp).length?Object.entries(lp).map(([k,v])=>'<span class="pill">'+esc(k)+': '+v+'</span>').join(''):'<div class="li">none</div>';
  document.getElementById('thread').innerHTML=(f.model_thread_recent||[]).map(e=>'<div class="e"><span class="ts">'+esc((e.ts||'').slice(0,19).replace('T',' '))+'</span><span class="who">'+esc(e.actor)+'</span><span class="k">'+esc(e.kind)+'</span>'+(e.ref?'<span class="ref">'+esc(e.ref)+'</span>':'')+'<div class="b">'+esc(e.body)+'</div></div>').join('')||'<div class="e">no entries yet</div>';
}
async function ap(){const v=document.getElementById('ap').value.trim();if(!v)return;await disp('WORK_APPEND',v);document.getElementById('ap').value='';load();}
document.getElementById('ap').addEventListener('keydown',e=>{if(e.key==='Enter')ap();});
load();setInterval(load,30000);
</script>`;
  return new Response(shellHtml({ activeHref: '/admin/work', title: 'Work', body: BODY }),
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
