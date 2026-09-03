import { shellHtml } from './_layout.js';

function safeJson(v, d) {
  try { return JSON.parse(v || ''); } catch { return d; }
}
function toolLine(t) {
  if (typeof t === 'string') return t;
  return [t.name, t.summary, t.result].filter(Boolean).join(' · ');
}
function cmdLine(c) {
  if (typeof c === 'string') return c;
  return c.cmd || c.command || c.summary || JSON.stringify(c);
}
function fileLine(f) {
  if (typeof f === 'string') return f;
  return f.path || f.file || f.name || JSON.stringify(f);
}

// Universal agent turn log — agent_turns (all CLI agents). Claude detail also at /admin/cc.
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.searchParams.get('data') === '1' || url.searchParams.get('export') === '1') {
    const exporting = url.searchParams.get('export') === '1';
    const cap = exporting ? 5000 : 500;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || (exporting ? '5000' : '300'), 10) || 300, cap);
    const agent = url.searchParams.get('agent');
    const session = url.searchParams.get('session');
    const trace = url.searchParams.get('trace_id');
    const tag = url.searchParams.get('tag');
    const source = url.searchParams.get('source');
    let sql = 'SELECT id, ts, agent, source, session, trace_id, cwd, input_kind, user_input, user_input_chars, assistant_text, audit_verdict, audit_note, audit_engine, n_tools, tools_json, commands_json, files_json, r2_stdout_key, dispatch_key, tags_json, turn_key, user_input_sha256, assistant_sha256, prompt_path, assistant_path FROM agent_turns';
    const binds = [];
    const where = [];
    if (agent && agent !== 'all') { where.push('agent = ?'); binds.push(agent); }
    if (session && session !== 'all') { where.push('session = ?'); binds.push(session); }
    if (trace) { where.push('trace_id = ?'); binds.push(trace); }
    if (source && source !== 'all') { where.push('source = ?'); binds.push(source); }
    if (tag && tag !== 'all') { where.push('tags_json LIKE ?'); binds.push('%"' + tag + '"%'); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY id ASC LIMIT ?';
    binds.push(limit);
    const r = await env.DB.prepare(sql).bind(...binds).all();
    const rows = r.results || [];

    if (exporting) {
      const format = (url.searchParams.get('format') || 'md').toLowerCase();
      const stamp = new Date().toISOString().slice(0, 10);
      const slug = [agent || 'all', session ? String(session).slice(0, 8) : 'all'].filter(Boolean).join('_');
      if (format === 'jsonl') {
        const body = rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '');
        return new Response(body, {
          headers: {
            'content-type': 'application/x-ndjson; charset=utf-8',
            'content-disposition': 'attachment; filename="agent_turns_' + slug + '_' + stamp + '.jsonl"',
            'cache-control': 'no-store',
          },
        });
      }
      if (format === 'json') {
        const body = JSON.stringify({ agent: agent || 'all', session: session || 'all', count: rows.length, results: rows }, null, 2);
        return new Response(body, {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'content-disposition': 'attachment; filename="agent_turns_' + slug + '_' + stamp + '.json"',
            'cache-control': 'no-store',
          },
        });
      }
      const lines = [
        '# Agent turn export',
        '',
        'agent: ' + (agent || 'all'),
        'session: ' + (session || 'all'),
        'turns: ' + rows.length,
        'exported: ' + new Date().toISOString(),
        '',
      ];
      for (const row of rows) {
        lines.push('---');
        lines.push('');
        lines.push('## Turn ' + row.id + ' · ' + (row.ts || '') + ' · ' + (row.agent || '') + ' · ' + (row.source || ''));
        lines.push('');
        lines.push('### User');
        lines.push(String(row.user_input || '').trim() || '(empty)');
        lines.push('');
        lines.push('### Assistant');
        lines.push(String(row.assistant_text || '').trim() || '(empty)');
        if (row.prompt_path || row.assistant_path || row.user_input_sha256 || row.assistant_sha256) {
          lines.push('');
          lines.push('### Evidence');
          if (row.prompt_path) lines.push('- prompt_path: ' + row.prompt_path);
          if (row.user_input_sha256) lines.push('- prompt_sha256: ' + row.user_input_sha256);
          if (row.assistant_path) lines.push('- assistant_path: ' + row.assistant_path);
          if (row.assistant_sha256) lines.push('- assistant_sha256: ' + row.assistant_sha256);
        }
        const tools = safeJson(row.tools_json, []);
        const cmds = safeJson(row.commands_json, []);
        const files = safeJson(row.files_json, []);
        if (tools.length) {
          lines.push('');
          lines.push('### Tools');
          for (const t of tools) lines.push('- ' + toolLine(t));
        }
        if (cmds.length) {
          lines.push('');
          lines.push('### Commands');
          for (const c of cmds) lines.push('- ' + cmdLine(c));
        }
        if (files.length) {
          lines.push('');
          lines.push('### Files');
          for (const f of files) lines.push('- ' + fileLine(f));
        }
        lines.push('');
      }
      const body = lines.join('\n');
      return new Response(body, {
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'content-disposition': 'attachment; filename="agent_turns_' + slug + '_' + stamp + '.md"',
          'cache-control': 'no-store',
        },
      });
    }

    return new Response(JSON.stringify({ results: rows, limit }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  }

  const BODY = `
<style>
.ag{max-width:1460px}
.ag-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--space-3);align-items:end;border-bottom:1px solid var(--line);padding-bottom:var(--space-2);margin-bottom:var(--space-2)}
.ag-title h1{margin:0 0 6px}
.ag-sub{color:var(--ink-soft);font-size:13px;line-height:1.55;max-width:820px}
.ag-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.ag-actions a,.ag-actions button{border:1px solid var(--line-strong);border-radius:999px;background:var(--panel);color:var(--ink);font-size:12px;font-weight:600;padding:8px 14px;text-decoration:none;cursor:pointer}
.ag-actions a:hover,.ag-actions button:hover{border-color:var(--accent);background:var(--ds-accent-soft);color:var(--accent);text-decoration:none}
.ag-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(124px,1fr));gap:10px;margin:var(--space-2) 0}
.ag-stat{border:1px solid var(--line);border-radius:var(--radius);background:var(--panel);padding:14px 16px;min-height:80px}
.ag-stat b{display:block;font:500 28px/1 var(--font-display);color:var(--ink);letter-spacing:.01em}
.ag-stat span{display:block;margin-top:8px;font:600 9px/1 var(--font-mono);letter-spacing:.13em;text-transform:uppercase;color:var(--accent)}
.ag-controls{display:grid;grid-template-columns:minmax(180px,1fr) 130px 130px 130px 130px 130px auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:var(--radius);background:var(--panel);padding:12px;margin-bottom:var(--space-2)}
.ag-controls input,.ag-controls select{width:100%}
.ag-toggle{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--ink-soft);white-space:nowrap}
.ag-toggle input{width:auto;accent-color:var(--accent)}
.ag-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:var(--space-2);align-items:start}
.ag-list{display:grid;gap:10px}
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
.turn{border:1px solid var(--line);border-radius:var(--radius);background:var(--panel);overflow:hidden}
.turn.risk{border-color:rgba(184,107,90,.55)}
.turn.open{border-color:var(--line-strong);box-shadow:0 14px 34px rgba(0,0,0,.45)}
.turn-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 13px;border-bottom:1px solid var(--line);cursor:pointer}
.turn-head:hover{background:var(--hover)}
.agent-pill{display:inline-flex;align-items:center;justify-content:center;min-width:74px;padding:3px 9px;border-radius:99px;font:600 10px/1.6 var(--font-mono);text-transform:uppercase;letter-spacing:.06em;border:1px solid var(--line-strong);background:var(--ds-raised);color:var(--ink-soft)}
.agent-pill.claude{background:var(--ds-accent-soft);color:var(--accent);border-color:rgba(201,169,97,.4)}
.agent-pill.codex{background:rgba(122,154,123,.12);color:var(--ds-sage);border-color:rgba(122,154,123,.45)}
.agent-pill.grok,.agent-pill.grok-sa{background:rgba(192,168,255,.1);color:#c0a8ff;border-color:rgba(192,168,255,.35)}
.kind{display:inline-flex;align-items:center;padding:3px 8px;border-radius:99px;font:600 10px/1.6 var(--font-mono);text-transform:uppercase;letter-spacing:.06em;border:1px solid var(--line);background:var(--ds-raised);color:var(--muted);margin-left:6px}
.turn-main{min-width:0}
.turn-title{font-weight:600;color:var(--ink);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.turn-meta{font:11px/1.5 var(--font-mono);color:var(--muted);display:flex;gap:9px;flex-wrap:wrap;margin-top:3px}
.turn-score{display:flex;align-items:center;gap:6px;justify-content:flex-end;min-width:184px;flex-wrap:wrap}
.pill{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:99px;padding:2px 8px;font:600 10px/1.6 var(--font-mono);text-transform:uppercase;letter-spacing:.05em;background:var(--bg);color:var(--muted);white-space:nowrap}
.pill.pass{background:rgba(122,154,123,.13);color:var(--ds-sage);border-color:rgba(122,154,123,.45)}
.pill.fail,.pill.risk{background:rgba(184,107,90,.13);color:#d89c8c;border-color:rgba(184,107,90,.5)}
.pill.file{background:var(--warn-bg);color:var(--warn-ink);border-color:var(--warn-border)}
.pill.tool{background:var(--ds-accent-soft);color:var(--accent);border-color:rgba(201,169,97,.4)}
.pill.trace{background:var(--ds-raised);color:var(--ink-soft)}
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
.loading{padding:28px;border:1px dashed var(--line-strong);border-radius:var(--radius);color:var(--muted)}
@media(max-width:980px){.ag-head{grid-template-columns:1fr}.ag-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.ag-controls{grid-template-columns:1fr}.ag-layout{grid-template-columns:1fr}.side{position:static}.detail-grid{grid-template-columns:1fr}}
</style>
<div class="ag">
  <section class="ag-head">
    <div class="ag-title">
      <h1>Agents</h1>
      <div class="ag-sub">Universal turn ledger for every CLI coding agent — hooks + dispatch capture, linked to ledger <code>trace_id</code>. Per-agent detail: <a href="/admin/cc">Claude Code</a> · <a href="/admin/grok">Grok CLI</a> · <a href="/admin/kimi">Kimi CLI</a>.</div>
    </div>
    <div class="ag-actions">
      <a href="/admin/ledger?cards=1&source=bridge">Ledger</a>
      <a href="/admin/cc">Claude Code</a>
      <a href="/admin/grok" id="grokTab">Grok CLI</a>
      <a href="/admin/kimi" id="kimiTab">Kimi CLI</a>
      <a href="#" id="downloadMd" title="Download filtered turns as Markdown for ChatGPT upload">Download .md</a>
      <a href="#" id="downloadJsonl" title="Download filtered turns as JSONL">Download .jsonl</a>
      <button type="button" id="refresh">Refresh</button>
    </div>
  </section>
  <section class="ag-metrics" id="metrics"></section>
  <section class="ag-controls">
    <input id="q" placeholder="Search input, output, files, trace_id">
    <select id="agent"><option value="all">All agents</option></select>
    <select id="source"><option value="all">All sources</option><option value="hook">hook</option><option value="dispatch">dispatch</option><option value="backfill">backfill</option><option value="import">import</option></select>
    <select id="tag"><option value="all">All issues</option><option value="risk">risk</option><option value="protected">protected</option><option value="file_edit">file_edit</option><option value="unaudited">unaudited</option><option value="audit_fail">audit_fail</option><option value="shell">shell</option><option value="backfill">backfill</option></select>
    <select id="session"><option value="all">All sessions</option></select>
    <label class="ag-toggle"><input type="checkbox" id="filesOnly"> Files only</label>
  </section>
  <section class="ag-layout">
    <div class="ag-list" id="list"><div class="loading">Loading...</div></div>
    <aside class="side">
      <div class="panel">
        <h2>Sessions</h2>
        <div class="session-list" id="sessions"></div>
      </div>
      <div class="panel">
        <h2>Issue Watch</h2>
        <div class="risk-list" id="risks"></div>
      </div>
      <div class="panel">
        <h2>Quick filters</h2>
        <div class="session-list" id="issueFilters"></div>
      </div>
    </aside>
  </section>
</div>
<script>
const state={rows:[],view:[],agent:'all',source:'all',tag:'all',session:'all',q:'',filesOnly:false};
const ISSUE_TAGS=['risk','protected','file_edit','unaudited','audit_fail','shell','backfill'];
const riskRx=/(rm -rf|git reset --hard|git checkout --|git clean -fd|git push --force|api\\/file|DELETE|rm -f)/i;
function $(id){return document.getElementById(id);}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function parse(v,d){try{return JSON.parse(v||'')||d;}catch(e){return d;}}
function arr(v){return Array.isArray(v)?v:[];}
function firstLine(s,n){s=String(s||'').replace(/\\s+/g,' ').trim();return s.slice(0,n||160);}
function fmtTs(s){return String(s||'').replace('T',' ').replace('Z','').slice(0,19);}
function shortSession(s){return String(s||'none').slice(0,10)||'none';}
function fileName(f){if(typeof f==='string')return f;return f.path||f.file||f.name||JSON.stringify(f);}
function cmdText(c){if(typeof c==='string')return c;return c.cmd||c.command||c.summary||JSON.stringify(c);}
function toolText(t){if(typeof t==='string')return t;return [t.name,t.summary,t.result].filter(Boolean).join(' ');}
function shape(t){
  const tools=arr(parse(t.tools_json,'[]'));
  const cmds=arr(parse(t.commands_json,'[]'));
  const files=arr(parse(t.files_json,'[]'));
  const tags=arr(parse(t.tags_json,'[]'));
  const blob=[t.user_input,t.assistant_text,t.trace_id,t.agent,t.dispatch_key,tools.map(toolText).join(' '),cmds.map(cmdText).join(' '),files.map(fileName).join(' '),tags.join(' ')].join(' ');
  const risk=tags.includes('risk')||riskRx.test(blob);
  return {...t,tools,cmds,files,tags,risk,blob:blob.toLowerCase()};
}
function stat(label,value){return '<div class="ag-stat"><b>'+esc(value)+'</b><span>'+esc(label)+'</span></div>';}
function renderMetrics(){
  const rows=state.rows;
  const agents=[...new Set(rows.map(r=>r.agent))].length;
  const traces=rows.filter(r=>r.trace_id).length;
  const tools=rows.reduce((n,r)=>n+Number(r.n_tools||r.tools.length||0),0);
  const files=rows.reduce((n,r)=>n+r.files.length,0);
  const risks=rows.filter(r=>r.risk||r.tags.includes('protected')).length;
  const unaudited=rows.filter(r=>r.tags.includes('unaudited')).length;
  $('metrics').innerHTML=[
    stat('Turns',rows.length),
    stat('Agents',agents),
    stat('With trace',traces),
    stat('Tool calls',tools),
    stat('File entries',files),
    stat('Risk hits',risks),
    stat('Unaudited',unaudited)
  ].join('');
}
function renderIssueFilters(){
  const counts=new Map(ISSUE_TAGS.map(t=>[t,0]));
  for(const r of state.rows)for(const t of r.tags)if(counts.has(t))counts.set(t,counts.get(t)+1);
  $('issueFilters').innerHTML=ISSUE_TAGS.map(t=>'<button type="button" class="session-btn '+(state.tag===t?'active':'')+'" data-tag="'+esc(t)+'"><span class="session-id">'+esc(t)+'</span><span class="pill tool">'+esc(counts.get(t)||0)+'</span></button>').join('');
}
function buildFilters(){
  const agents=[...new Set(state.rows.map(r=>r.agent||'unknown'))].sort();
  $('agent').innerHTML='<option value="all">All agents</option>'+agents.map(a=>'<option value="'+esc(a)+'">'+esc(a)+'</option>').join('');
  const sessions=[...new Set(state.rows.map(r=>r.session||'none'))].sort();
  $('session').innerHTML='<option value="all">All sessions</option>'+sessions.map(s=>'<option value="'+esc(s)+'">'+esc(shortSession(s))+'</option>').join('');
}
function sessionStats(){
  const map=new Map();
  for(const r of state.rows){
    const id=(r.session||'none')+' · '+(r.agent||'?');
    const x=map.get(id)||{id,session:r.session||'none',agent:r.agent||'?',turns:0,files:0,tools:0,last:''};
    x.turns++; x.files+=r.files.length; x.tools+=Number(r.n_tools||r.tools.length||0);
    if(!x.last||String(r.ts)>String(x.last))x.last=r.ts;
    map.set(id,x);
  }
  return [...map.values()].sort((a,b)=>String(b.last).localeCompare(String(a.last))).slice(0,18);
}
function renderSessions(){
  $('sessions').innerHTML=sessionStats().map(s=>
    '<button type="button" class="session-btn '+(state.session===s.session?'active':'')+'" data-session="'+esc(s.session)+'">'+
      '<span class="session-id">'+esc(shortSession(s.session))+' · '+esc(s.agent)+'</span><span class="pill tool">'+esc(s.turns)+'</span>'+
      '<span class="session-meta">'+esc(s.tools)+' tools / '+esc(s.files)+' files / '+esc(fmtTs(s.last))+'</span>'+
    '</button>'
  ).join('')||'<div class="empty">No sessions.</div>';
}
function renderRisks(){
  const risks=state.rows.filter(r=>r.risk||r.tags.includes('protected')||r.tags.includes('audit_fail')).slice(0,10);
  $('risks').innerHTML=risks.map(r=>
    '<a class="risk-link" href="/admin/ledger?cards=1&q='+encodeURIComponent(String(r.id))+'">'+
      '<b>#'+esc(r.id)+'</b> '+esc(firstLine(r.user_input||r.assistant_text,96))+
      '<div class="session-meta">'+esc(r.agent)+' · '+esc(fmtTs(r.ts))+'</div>'+
    '</a>'
  ).join('')||'<div class="empty">No destructive-command hits.</div>';
}
function chip(c,cls){return '<span class="pill '+(cls||'')+'">'+esc(c)+'</span>';}
function renderTurn(r){
  const agent=r.agent||'unknown';
  const title=firstLine(r.user_input||r.assistant_text||('turn '+r.id),180)||'Turn '+r.id;
  const audit=r.audit_verdict?chip(r.audit_verdict,String(r.audit_verdict).toLowerCase()):'';
  const files=r.files.length?chip(r.files.length+' files','file'):'';
  const risk=r.risk?chip('risk','risk'):'';
  const tagChips=(r.tags||[]).slice(0,4).map(t=>chip(t,t==='audit_fail'||t==='risk'?'risk':t==='unaudited'?'':'')).join('');
  const toolN=Number(r.n_tools||r.tools.length||0);
  const tools=toolN?chip(toolN+' tools','tool'):'';
  const trace=r.trace_id?chip(shortSession(r.trace_id),'trace'):'';
  const src=r.source?chip(r.source,''):'';
  const ledger=r.trace_id?'/admin/ledger?cards=1&q='+encodeURIComponent(r.trace_id):'/admin/ledger?cards=1';
  return '<article class="turn '+(r.risk?'risk':'')+'" data-id="'+esc(r.id)+'">'+
    '<div class="turn-head" data-toggle="'+esc(r.id)+'">'+
      '<span class="agent-pill '+esc(agent)+'">'+esc(agent)+'</span>'+
      '<div class="turn-main"><div class="turn-title">'+esc(title)+'</div><div class="turn-meta"><span>#'+esc(r.id)+'</span><span>'+esc(fmtTs(r.ts))+'</span><span>'+esc(r.dispatch_key||'')+'</span><span>'+esc(r.cwd||'')+'</span></div></div>'+
      '<div class="turn-score">'+src+trace+audit+tagChips+files+risk+tools+'</div>'+
    '</div>'+
    '<div class="prompt">'+esc(String(r.user_input||'').slice(0,1400))+'</div>'+
    '<div class="turn-body"><div class="detail-grid">'+
      '<div class="box"><div class="section-title">Assistant</div><div class="clip">'+esc(String(r.assistant_text||'').slice(0,3000)||'No output captured.')+(r.r2_stdout_key?'<div class="tool-row">Full stdout: R2 '+esc(r.r2_stdout_key)+'</div>':'')+'</div></div>'+
      '<div class="box"><div class="section-title">Meta</div><div class="clip">agent: '+esc(agent)+'\\nsource: '+esc(r.source||'')+'\\nsession: '+esc(r.session||'')+'\\ntrace: '+esc(r.trace_id||'')+'\\nkind: '+esc(r.input_kind||'')+'</div></div>'+
      '<div class="box"><div class="section-title">Tools</div>'+toolRows(r.tools)+'</div>'+
      '<div class="box"><div class="section-title">Commands</div>'+cmdRows(r.cmds)+'</div>'+
      '<div class="box"><div class="section-title">Files</div>'+fileRows(r.files)+'</div>'+
      '<div class="box"><div class="section-title">Links</div><div class="tool-row"><a href="'+ledger+'">Ledger card</a></div><div class="tool-row"><a href="/admin/agents?export=1&format=md&agent='+encodeURIComponent(agent)+'&session='+encodeURIComponent(r.session||'')+'&limit=5000">Download session .md</a></div></div>'+
    '</div></div></article>';
}
function toolRows(tools){if(!tools.length)return '<div class="tool-row">None.</div>';return tools.slice(0,24).map(t=>'<div class="tool-row"><b>'+esc(t.name||'tool')+'</b> '+esc(firstLine(t.summary||t.result||JSON.stringify(t),260))+'</div>').join('');}
function cmdRows(cmds){if(!cmds.length)return '<div class="cmd-row">None.</div>';return cmds.slice(0,24).map(c=>'<div class="cmd-row">'+esc(firstLine(cmdText(c),320))+'</div>').join('');}
function fileRows(files){if(!files.length)return '<div class="file-row">None.</div>';return files.slice(0,32).map(f=>'<div class="file-row">'+esc(fileName(f))+'</div>').join('');}
function exportUrl(format){
  const p=new URLSearchParams();
  p.set('export','1');
  p.set('format',format||'md');
  p.set('limit','5000');
  if(state.agent!=='all')p.set('agent',state.agent);
  if(state.session!=='all')p.set('session',state.session);
  if(state.source!=='all')p.set('source',state.source);
  if(state.tag!=='all')p.set('tag',state.tag);
  if(state.trace)p.set('trace_id',state.trace);
  return '/admin/agents?'+p.toString();
}
function syncExportLinks(){
  $('downloadMd').href=exportUrl('md');
  $('downloadJsonl').href=exportUrl('jsonl');
}
function applyFilters(){
  const q=state.q.toLowerCase().trim();
  state.view=state.rows.filter(r=>{
    if(state.agent!=='all'&&(r.agent||'unknown')!==state.agent)return false;
    if(state.source!=='all'&&(r.source||'')!==state.source)return false;
    if(state.tag!=='all'&&!(r.tags||[]).includes(state.tag))return false;
    if(state.session!=='all'&&(r.session||'none')!==state.session)return false;
    if(state.filesOnly&&!r.files.length)return false;
    if(q&&!r.blob.includes(q))return false;
    return true;
  });
  render();
}
function render(){
  $('list').innerHTML=state.view.length?state.view.map(renderTurn).join(''):'<div class="empty">No turns match filters.</div>';
  renderMetrics(); buildFilters(); renderSessions(); renderRisks(); renderIssueFilters(); syncExportLinks();
}
async function load(){
  $('list').innerHTML='<div class="loading">Loading...</div>';
  const boot=new URLSearchParams(location.search);
  if(boot.get('agent'))state.agent=boot.get('agent');
  if(boot.get('session'))state.session=boot.get('session');
  const q=new URLSearchParams({data:'1',limit:'500'});
  if(state.agent!=='all')q.set('agent',state.agent);
  if(state.session!=='all')q.set('session',state.session);
  const r=await fetch('/admin/agents?'+q.toString());
  const j=await r.json();
  state.rows=(j.results||[]).map(shape);
  applyFilters();
  if(state.agent!=='all')$('agent').value=state.agent;
  if(state.session!=='all')$('session').value=state.session;
}
$('q').addEventListener('input',e=>{state.q=e.target.value;applyFilters();});
$('agent').addEventListener('change',e=>{state.agent=e.target.value;applyFilters();});
$('source').addEventListener('change',e=>{state.source=e.target.value;applyFilters();});
$('tag').addEventListener('change',e=>{state.tag=e.target.value;applyFilters();});
$('session').addEventListener('change',e=>{state.session=e.target.value;applyFilters();});
$('filesOnly').addEventListener('change',e=>{state.filesOnly=e.target.checked;applyFilters();});
$('refresh').addEventListener('click',load);
$('sessions').addEventListener('click',e=>{
  const b=e.target.closest('[data-session]'); if(!b)return;
  state.session=b.getAttribute('data-session'); $('session').value=state.session; applyFilters();
});
$('issueFilters').addEventListener('click',e=>{
  const b=e.target.closest('[data-tag]'); if(!b)return;
  state.tag=b.getAttribute('data-tag'); $('tag').value=state.tag; applyFilters();
});
$('list').addEventListener('click',e=>{const h=e.target.closest('[data-toggle]');if(!h)return;const card=h.closest('.turn');if(card)card.classList.toggle('open');});
load().catch(e=>{$('list').innerHTML='<div class="empty">Load failed: '+esc(e.message)+'</div>';});
</script>`;

  return new Response(shellHtml({ activeHref: '/admin/agents', title: 'Agents', body: BODY }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}
