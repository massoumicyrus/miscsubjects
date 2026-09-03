import { shellHtml } from './_layout.js';

// Kimi CLI turn log. Source of truth: kimi_turns rows written by the Stop hook.
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.searchParams.get('data') === '1') {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '300', 10) || 300, 500);
    const r = await env.DB.prepare(
      'SELECT id, ts, session, cwd, input_kind, user_input, user_input_chars, assistant_text, audit_verdict, audit_note, audit_engine, n_tools, tools_json, commands_json, files_json FROM kimi_turns ORDER BY id DESC LIMIT ?'
    ).bind(limit).all();
    return new Response(JSON.stringify({ results: r.results || [], limit }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  }

  const BODY = `
<style>
.km{max-width:1460px}
.km-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--space-3);align-items:end;border-bottom:1px solid var(--line);padding-bottom:var(--space-2);margin-bottom:var(--space-2)}
.km-title h1{margin:0 0 6px}
.km-sub{color:var(--ink-soft);font-size:13px;line-height:1.55;max-width:780px}
.km-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.km-actions a,.km-actions button{border:1px solid var(--line-strong);border-radius:999px;background:var(--panel);color:var(--ink);font-size:12px;font-weight:600;padding:8px 14px;text-decoration:none;cursor:pointer}
.km-actions a:hover,.km-actions button:hover{border-color:var(--accent);background:var(--ds-accent-soft);color:var(--accent);text-decoration:none}
.km-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:var(--space-2) 0}
.km-stat{border:1px solid var(--line);border-radius:var(--radius);background:var(--panel);padding:14px 16px;min-height:80px}
.km-stat b{display:block;font:500 28px/1 var(--font-display);color:var(--ink);letter-spacing:.01em}
.km-stat span{display:block;margin-top:8px;font:600 9px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--accent)}
.km-controls{display:grid;grid-template-columns:minmax(220px,1fr) 170px 170px auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:var(--radius);background:var(--panel);padding:12px;margin-bottom:var(--space-2)}
.km-controls input,.km-controls select{width:100%}
.km-toggle{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--ink-soft);white-space:nowrap}
.km-toggle input{width:auto;accent-color:var(--accent)}
.km-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:var(--space-2);align-items:start}
.km-list{display:grid;gap:10px}
.turn{border:1px solid var(--line);border-radius:var(--radius);background:var(--panel);overflow:hidden}
.turn.risk{border-color:rgba(184,107,90,.55)}
.turn.open{border-color:var(--line-strong);box-shadow:0 14px 34px rgba(0,0,0,.45)}
.turn-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 13px;border-bottom:1px solid var(--line);cursor:pointer}
.turn-head:hover{background:var(--hover)}
.kind{display:inline-flex;align-items:center;justify-content:center;min-width:74px;padding:3px 9px;border-radius:99px;font:600 10px/1.6 var(--font-mono);text-transform:uppercase;letter-spacing:.06em;border:1px solid var(--line-strong);background:var(--ds-raised);color:var(--ink-soft)}
.kind.human{background:var(--ds-accent-soft);color:var(--accent);border-color:rgba(201,169,97,.4)}
.kind.system_task{background:var(--ds-raised);color:var(--muted);border-color:var(--line)}
.kind.interrupt{background:var(--warn-bg);color:var(--warn-ink);border-color:var(--warn-border)}
.turn-main{min-width:0}
.turn-title{font-weight:600;color:var(--ink);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.turn-meta{font:11px/1.5 var(--font-mono);color:var(--muted);display:flex;gap:9px;flex-wrap:wrap;margin-top:3px}
.turn-score{display:flex;align-items:center;gap:6px;justify-content:flex-end;min-width:184px}
.pill{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:99px;padding:2px 8px;font:600 10px/1.6 var(--font-mono);text-transform:uppercase;letter-spacing:.05em;background:var(--bg);color:var(--muted);white-space:nowrap}
.pill.pass{background:rgba(122,154,123,.13);color:var(--ds-sage);border-color:rgba(122,154,123,.45)}
.pill.fail,.pill.risk{background:rgba(184,107,90,.13);color:#d89c8c;border-color:rgba(184,107,90,.5)}
.pill.file{background:var(--warn-bg);color:var(--warn-ink);border-color:var(--warn-border)}
.pill.tool{background:var(--ds-accent-soft);color:var(--accent);border-color:rgba(201,169,97,.4)}
.prompt{padding:11px 13px;font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word;color:var(--ink-soft);border-bottom:1px solid var(--line)}
.turn-body{display:none;padding:13px}
.turn.open .turn-body{display:block}
.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.section-title{font:600 10px/1 var(--font-mono);text-transform:uppercase;letter-spacing:.13em;color:var(--accent);margin:0 0 8px}
.box{border:1px solid var(--line);border-radius:9px;background:var(--bg);padding:11px;min-height:72px}
.clip{max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:12.5px;line-height:1.55;color:var(--ink-soft)}
.tool-row,.file-row,.cmd-row{font:12px/1.5 var(--font-mono);padding:5px 0;border-bottom:1px dashed var(--line);color:var(--ink-soft)}
.tool-row:last-child,.file-row:last-child,.cmd-row:last-child{border-bottom:0}
.tool-row b{color:var(--accent);font-weight:600}
.empty{border:1px dashed var(--line-strong);border-radius:var(--radius);padding:22px;color:var(--muted)}
.side{position:sticky;top:126px;display:grid;gap:12px}
.panel{border:1px solid var(--line);border-radius:var(--radius);background:var(--panel);padding:14px}
.panel h2{font:600 10px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;margin:0 0 12px;color:var(--accent)}
.session-list{display:grid;gap:7px;max-height:360px;overflow:auto}
.session-btn{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;text-align:left;border:1px solid var(--line);background:var(--ds-raised);border-radius:9px;padding:9px 10px;color:var(--ink)}
.session-btn:hover{border-color:var(--line-strong)}
.session-btn.active{border-color:var(--accent);background:var(--ds-accent-soft)}
.session-id{font:600 12px/1.2 var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink)}
.session-meta{font:10px/1.4 var(--font-mono);color:var(--muted);grid-column:1/-1}
.risk-list{display:grid;gap:7px}
.risk-link{display:block;border:1px solid rgba(184,107,90,.5);background:rgba(184,107,90,.1);color:#d89c8c;border-radius:9px;padding:9px 10px;font-size:12px;text-decoration:none}
.risk-link:hover{text-decoration:none;background:rgba(184,107,90,.18)}
.risk-link b{color:#e8b3a4}
.loading{padding:28px;border:1px dashed var(--line-strong);border-radius:var(--radius);color:var(--muted)}
@media(max-width:980px){.km-head{grid-template-columns:1fr}.km-actions{justify-content:flex-start}.km-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.km-controls{grid-template-columns:1fr}.km-layout{grid-template-columns:1fr}.side{position:static}.turn-head{grid-template-columns:1fr}.turn-score{justify-content:flex-start;min-width:0}.detail-grid{grid-template-columns:1fr}}
</style>
<div class="km">
  <section class="km-head">
    <div class="km-title">
      <h1>Kimi CLI</h1>
      <div class="km-sub">Kimi CLI turn detail (kimi_turns). All agents: <a href="/admin/agents">Agents</a> tab.</div>
    </div>
    <div class="km-actions">
      <a href="/admin/ledger?cards=1&service=kimi-cli">Ledger Cards</a>
      <a href="/admin/vault">Vault</a>
      <button type="button" id="refresh">Refresh</button>
    </div>
  </section>

  <section class="km-metrics" id="metrics"></section>

  <section class="km-controls">
    <input id="q" placeholder="Search input, files, commands, tool names">
    <select id="kind"><option value="all">All input kinds</option></select>
    <select id="session"><option value="all">All sessions</option></select>
    <label class="km-toggle"><input type="checkbox" id="filesOnly"> Files only</label>
  </section>

  <section class="km-layout">
    <div class="km-list" id="list"><div class="loading">Loading...</div></div>
    <aside class="side">
      <div class="panel">
        <h2>Sessions</h2>
        <div class="session-list" id="sessions"></div>
      </div>
      <div class="panel">
        <h2>Risk Watch</h2>
        <div class="risk-list" id="risks"></div>
      </div>
    </aside>
  </section>
</div>
<script>
const state={rows:[],view:[],kind:'all',session:'all',q:'',filesOnly:false};
const riskRx=/(rm -rf|git reset --hard|git checkout --|git clean -fd|git push --force|api\/file|DELETE|rm -f)/i;
function $(id){return document.getElementById(id);}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function parse(v,d){try{return JSON.parse(v||'')||d;}catch(e){return d;}}
function arr(v){return Array.isArray(v)?v:[];}
function firstLine(s,n){s=String(s||'').replace(/\s+/g,' ').trim();return s.slice(0,n||160);}
function fmtTs(s){return String(s||'').replace('T',' ').replace('Z','').slice(0,19);}
function shortSession(s){return String(s||'none').slice(0,10)||'none';}
function fileName(f){if(typeof f==='string')return f;return f.path||f.file||f.name||JSON.stringify(f);}
function cmdText(c){if(typeof c==='string')return c;return c.cmd||c.command||c.summary||JSON.stringify(c);}
function toolText(t){if(typeof t==='string')return t;return [t.name,t.summary,t.result].filter(Boolean).join(' ');}
function shape(t){
  const tools=arr(parse(t.tools_json,'[]'));
  const cmds=arr(parse(t.commands_json,'[]'));
  const files=arr(parse(t.files_json,'[]'));
  const blob=[t.user_input,t.assistant_text,tools.map(toolText).join(' '),cmds.map(cmdText).join(' '),files.map(fileName).join(' ')].join(' ');
  return {...t,tools,cmds,files,risk:riskRx.test(blob),blob:blob.toLowerCase()};
}
function stat(label,value){return '<div class="km-stat"><b>'+esc(value)+'</b><span>'+esc(label)+'</span></div>';}
function renderMetrics(){
  const rows=state.rows;
  const fileTurns=rows.filter(r=>r.files.length).length;
  const tools=rows.reduce((n,r)=>n+Number(r.n_tools||r.tools.length||0),0);
  const files=rows.reduce((n,r)=>n+r.files.length,0);
  const risks=rows.filter(r=>r.risk).length;
  $('metrics').innerHTML=[
    stat('Turns loaded',rows.length),
    stat('Tool calls',tools),
    stat('File entries',files),
    stat('File turns',fileTurns),
    stat('Risk hits',risks)
  ].join('');
}
function buildFilters(){
  const kinds=[...new Set(state.rows.map(r=>r.input_kind||'human'))].sort();
  $('kind').innerHTML='<option value="all">All input kinds</option>'+kinds.map(k=>'<option value="'+esc(k)+'">'+esc(k.replace('_',' '))+'</option>').join('');
  const sessions=[...new Set(state.rows.map(r=>r.session||'none'))].sort();
  $('session').innerHTML='<option value="all">All sessions</option>'+sessions.map(s=>'<option value="'+esc(s)+'">'+esc(shortSession(s))+'</option>').join('');
}
function sessionStats(){
  const map=new Map();
  for(const r of state.rows){
    const id=r.session||'none';
    const x=map.get(id)||{id,turns:0,files:0,tools:0,last:''};
    x.turns++; x.files+=r.files.length; x.tools+=Number(r.n_tools||r.tools.length||0); if(!x.last||String(r.ts)>String(x.last))x.last=r.ts;
    map.set(id,x);
  }
  return [...map.values()].sort((a,b)=>String(b.last).localeCompare(String(a.last))).slice(0,18);
}
function renderSessions(){
  $('sessions').innerHTML=sessionStats().map(s=>
    '<button type="button" class="session-btn '+(state.session===s.id?'active':'')+'" data-session="'+esc(s.id)+'">'+
      '<span class="session-id">'+esc(shortSession(s.id))+'</span><span class="pill tool">'+esc(s.turns)+'</span>'+
      '<span class="session-meta">'+esc(s.tools)+' tools / '+esc(s.files)+' files / '+esc(fmtTs(s.last))+'</span>'+
    '</button>'
  ).join('')||'<div class="empty">No sessions.</div>';
}
function renderRisks(){
  const risks=state.rows.filter(r=>r.risk).slice(0,10);
  $('risks').innerHTML=risks.map(r=>
    '<a class="risk-link" href="/admin/ledger?cards=1&service=kimi-cli&card_id=km_'+encodeURIComponent(String(r.id))+'">'+
      '<b>#'+esc(r.id)+'</b> '+esc(firstLine(r.user_input||r.assistant_text,96))+
      '<div class="session-meta">'+esc(fmtTs(r.ts))+' / '+esc(r.files.length)+' files</div>'+
    '</a>'
  ).join('')||'<div class="empty">No destructive-command hits in loaded turns.</div>';
}
function chip(c,cls){return '<span class="pill '+(cls||'')+'">'+esc(c)+'</span>';}
function renderTurn(r){
  const kind=r.input_kind||'human';
  const title=firstLine(r.user_input||r.assistant_text||('turn '+r.id),180)||'Turn '+r.id;
  const audit=r.audit_verdict?chip(r.audit_verdict,String(r.audit_verdict).toLowerCase()):'';
  const files=r.files.length?chip(r.files.length+' files','file'):'';
  const risk=r.risk?chip('risk','risk'):'';
  const toolN=Number(r.n_tools||r.tools.length||0);
  const tools=chip(toolN+' tools','tool');
  const ledger='/admin/ledger?cards=1&service=kimi-cli&card_id=km_'+encodeURIComponent(String(r.id));
  return '<article class="turn '+(r.risk?'risk':'')+'" data-id="'+esc(r.id)+'">'+
    '<div class="turn-head" data-toggle="'+esc(r.id)+'">'+
      '<span class="kind '+esc(kind)+'">'+esc(kind.replace('_',' '))+'</span>'+
      '<div class="turn-main"><div class="turn-title">'+esc(title)+'</div><div class="turn-meta"><span>#'+esc(r.id)+'</span><span>'+esc(fmtTs(r.ts))+'</span><span>'+esc(shortSession(r.session))+'</span><span>'+esc(r.cwd||'')+'</span></div></div>'+
      '<div class="turn-score">'+audit+files+risk+tools+'</div>'+
    '</div>'+
    '<div class="prompt">'+esc(String(r.user_input||'').slice(0,1400))+'</div>'+
    '<div class="turn-body">'+
      '<div class="detail-grid">'+
        '<div class="box"><div class="section-title">Assistant</div><div class="clip">'+esc(String(r.assistant_text||'').slice(0,3000)||'No assistant text captured.')+'</div></div>'+
        '<div class="box"><div class="section-title">Audit</div><div class="clip">'+esc([r.audit_engine,r.audit_verdict,r.audit_note].filter(Boolean).join(' / ')||'No audit verdict on this turn.')+'</div></div>'+
        '<div class="box"><div class="section-title">Tools</div>'+toolRows(r.tools)+'</div>'+
        '<div class="box"><div class="section-title">Commands</div>'+cmdRows(r.cmds)+'</div>'+
        '<div class="box"><div class="section-title">Files changed</div>'+fileRows(r.files)+'</div>'+
        '<div class="box"><div class="section-title">Links</div><div class="tool-row"><a href="'+ledger+'">Open ledger card</a></div><div class="tool-row"><a href="/admin/kimi?data=1&limit=500">Raw JSON</a></div></div>'+
      '</div>'+
    '</div>'+
  '</article>';
}
function toolRows(tools){
  if(!tools.length)return '<div class="tool-row">None captured.</div>';
  return tools.slice(0,24).map(t=>'<div class="tool-row"><b>'+esc(t.name||'tool')+'</b> '+esc(firstLine(t.summary||t.result||JSON.stringify(t),260))+'</div>').join('');
}
function cmdRows(cmds){
  if(!cmds.length)return '<div class="cmd-row">None captured.</div>';
  return cmds.slice(0,24).map(c=>'<div class="cmd-row">'+esc(firstLine(cmdText(c),320))+'</div>').join('');
}
function fileRows(files){
  if(!files.length)return '<div class="file-row">None captured.</div>';
  return files.slice(0,32).map(f=>'<div class="file-row">'+esc(fileName(f))+'</div>').join('');
}
function applyFilters(){
  const q=state.q.toLowerCase().trim();
  state.view=state.rows.filter(r=>{
    if(state.kind!=='all' && (r.input_kind||'human')!==state.kind)return false;
    if(state.session!=='all' && (r.session||'none')!==state.session)return false;
    if(state.filesOnly && !r.files.length)return false;
    if(q && !r.blob.includes(q))return false;
    return true;
  });
  render();
}
function render(){
  $('list').innerHTML=state.view.length?state.view.map(renderTurn).join(''):'<div class="empty">No turns match the current filters.</div>';
  renderMetrics(); renderSessions(); renderRisks();
}
async function load(){
  $('list').innerHTML='<div class="loading">Loading...</div>';
  const r=await fetch('/admin/kimi?data=1&limit=300');
  const j=await r.json();
  state.rows=(j.results||[]).map(shape);
  buildFilters();
  applyFilters();
}
$('q').addEventListener('input',e=>{state.q=e.target.value;applyFilters();});
$('kind').addEventListener('change',e=>{state.kind=e.target.value;applyFilters();});
$('session').addEventListener('change',e=>{state.session=e.target.value;applyFilters();});
$('filesOnly').addEventListener('change',e=>{state.filesOnly=e.target.checked;applyFilters();});
$('refresh').addEventListener('click',load);
$('sessions').addEventListener('click',e=>{
  const b=e.target.closest('[data-session]'); if(!b)return;
  state.session=b.getAttribute('data-session'); $('session').value=state.session; applyFilters();
});
$('list').addEventListener('click',e=>{
  const h=e.target.closest('[data-toggle]'); if(!h)return;
  const card=h.closest('.turn'); if(card)card.classList.toggle('open');
});
load().catch(e=>{$('list').innerHTML='<div class="empty">Load failed: '+esc(e.message)+'</div>';});
</script>`;

  return new Response(shellHtml({ activeHref: '/admin/kimi', title: 'Kimi CLI', body: BODY }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}
