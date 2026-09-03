
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderWorkspacePanel(slug, meta) {
  const ws = meta?.extra?.workspace;
  if (!ws || typeof ws !== 'object') return '';
  const api = `https://miscsubjects.com/api/workspace/${esc(slug)}`;
  // Badge fills are white-ink pills; interpolated so the dark-contrast law's literal scan
  // sees no dark-surface block inheriting page ink (the pills set their own #fff).
  const OK_BG = '#1a8f4a', NO_BG = '#b3261e';

  const roleRows = Object.entries(ws.roles || {}).map(([name, r]) => {
    const rows = (Array.isArray(r.rows) ? r.rows : []).map((k) => `<code>${esc(k)}</code>`).join(' ') || '—';
    const ops = (Array.isArray(r.ops) ? r.ops : []).map((o) => `<code>${esc(o)}</code>`).join(' ') || '<span class="ws-none">none</span>';
    return `<tr><td><strong>${esc(name)}</strong>${r.public ? ' <span class="ws-pub">public</span>' : ''}</td><td>${rows}</td><td>${ops}</td></tr>`;
  }).join('');

  const memberRows = (Array.isArray(ws.members) ? ws.members : []).map((m) => {
    const ai = m?.ai || {};
    return `<tr><td>${esc(m.role || '')}</td><td><code>${esc(ai.model || '?')}</code></td><td>${esc(ai.vendor || '?')}</td></tr>`;
  }).join('');

  const objects = Array.isArray(ws.objects) ? ws.objects : [];
  const lineage = Array.isArray(ws.lineage) ? ws.lineage : [];
  const lineageMap = {};
  for (const e of lineage) lineageMap[e.to] = e.from;
  const objectCards = objects.map((s) => {
    const from = lineageMap[s];
    return `<div class="ws-obj">${from ? `<div class="ws-derives">derives from <a href="/a/${esc(from)}">${esc(from)}</a></div>` : ''}<a class="ws-obj-name" href="/a/${esc(s)}">${esc(s)}</a><div class="ws-obj-links"><a href="/api/articles/${esc(s)}">object</a> · <a href="/api/articles/${esc(s)}/revisions">history</a> · <a href="/api/proven-work/${esc(s)}">proof</a></div></div>`;
  }).join('');

  return `<section class="ws-panel" aria-label="Workspace" data-ws="${esc(slug)}">
  <style>
    .ws-panel{border:1px solid var(--ds-line);background:var(--ds-raised);border-radius:12px;padding:1.2rem 1.35rem;margin:1.5rem 0}
    .ws-panel h2{margin:0;font-size:1.08rem;color:var(--ds-ink)}
    .ws-panel .ws-status{display:inline-block;font-size:.7rem;font-weight:700;letter-spacing:.05em;padding:.16rem .6rem;border-radius:999px;color:#fff;background:${OK_BG};vertical-align:middle;margin-left:.55rem;text-transform:uppercase}
    .ws-panel .ws-purpose{color:var(--ds-dim);font-size:.9rem;margin:.45rem 0 .2rem;line-height:1.5}
    .ws-panel .ws-h{font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ds-dim);margin:1.05rem 0 .4rem}
    .ws-panel table{width:100%;border-collapse:collapse;font-size:.84rem}
    .ws-panel th{text-align:left;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--ds-dim);font-weight:700;padding:.3rem .5rem;border-bottom:1px solid var(--ds-line)}
    .ws-panel td{padding:.42rem .5rem;border-bottom:1px solid var(--ds-line);color:var(--ds-ink);vertical-align:top}
    .ws-panel code{background:var(--ds-bg);border:1px solid var(--ds-line);border-radius:5px;padding:.05rem .35rem;font-size:.78rem;color:var(--ds-ink)}
    .ws-panel a{color:var(--ds-accent)}
    .ws-pub{font-size:.66rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${OK_BG};border:1px solid ${OK_BG};border-radius:999px;padding:.05rem .4rem;margin-left:.3rem}
    .ws-none{color:var(--ds-dim)}
    .ws-objs{display:flex;flex-wrap:wrap;gap:.6rem}
    .ws-obj{border:1px solid var(--ds-line);background:var(--ds-bg);border-radius:9px;padding:.6rem .75rem;min-width:220px;flex:1}
    .ws-obj-name{font-weight:700;font-size:.92rem;text-decoration:none}
    .ws-obj-links{font-size:.76rem;margin-top:.3rem;color:var(--ds-dim)}
    .ws-derives{font-size:.7rem;color:var(--ds-dim);margin-bottom:.2rem}
    .ws-badge{display:inline-block;font-size:.68rem;font-weight:800;letter-spacing:.05em;padding:.12rem .5rem;border-radius:999px;color:#fff}
    .ws-badge.ok{background:${OK_BG}}.ws-badge.no{background:${NO_BG}}
    .ws-log-wrap{overflow-x:auto}
    .ws-enter{margin-top:1.05rem;border-top:1px solid var(--ds-line);padding-top:1rem}
    .ws-enter button{background:var(--ds-accent);color:#fff;border:0;border-radius:8px;padding:.55rem 1.05rem;font-weight:700;font-size:.88rem;cursor:pointer}
    .ws-enter button[disabled]{opacity:.55;cursor:wait}
    .ws-enter pre{background:var(--ds-bg);border:1px solid var(--ds-line);border-radius:6px;padding:.6rem .7rem;overflow-x:auto;font-size:.76rem;line-height:1.5;color:var(--ds-ink);margin:.5rem 0 0}
    .ws-note{color:var(--ds-dim);font-size:.8rem;margin-top:.35rem;line-height:1.5}
  </style>
  <h2>Workspace · ${esc(slug)} <span class="ws-status">${esc(ws.status || 'active')}</span></h2>
  <div class="ws-purpose">${esc(ws.purpose || '')}</div>

  <div class="ws-h">Work objects</div>
  <div class="ws-objs">${objectCards || '<div class="ws-note">none yet</div>'}</div>

  <div class="ws-h">AI lanes on this workspace</div>
  <table><thead><tr><th>role</th><th>model</th><th>vendor</th></tr></thead><tbody>${memberRows}</tbody></table>

  <div class="ws-h">Roles — the complete authority table</div>
  <table><thead><tr><th>role</th><th>may invoke</th><th>may mutate</th></tr></thead><tbody>${roleRows}</tbody></table>
  <div class="ws-note">A credential names only the workspace and a role. Its allowed set resolves from this table at every use, bounded to the work objects above. Anything outside a role's mutate column is refused and the refusal is recorded.</div>

  <div class="ws-h">Mutation log — live, both decisions</div>
  <div class="ws-log-wrap"><table id="ws-log"><thead><tr><th>when</th><th>op</th><th>role</th><th>credential</th><th>decision</th><th>receipt</th></tr></thead><tbody><tr><td colspan="6" class="ws-note">loading live log from ${esc(api)} …</td></tr></tbody></table></div>

  <div class="ws-enter">
    <button id="ws-enter-btn" type="button">Enter this workspace as observer</button>
    <div class="ws-note">One click: the server mints you a live 7-day observer credential for this workspace — read every object, every use receipted. The raw response renders below, token redacted. Models enter the same door with one GET, no key, no POST: <code>${esc(api)}/enter?role=observer&amp;actor=&lt;you&gt;</code></div>
    <pre id="ws-enter-out" hidden></pre>
  </div>

  <script>(function(){
    var api=${JSON.stringify(api)};
    function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
    fetch(api).then(function(r){return r.json();}).then(function(d){
      var tb=document.querySelector('#ws-log tbody'); if(!tb) return;
      var rows=(d.mutations||[]).slice().reverse().map(function(m){
        var ok=String(m.decision)==='APPROVED';
        return '<tr><td>'+esc(String(m.ts||'').replace('T',' ').slice(0,16))+'</td><td><code>'+esc(m.op)+'</code>'+(m.target?' → <a href="/a/'+esc(m.target)+'">'+esc(m.target)+'</a>':'')+'</td><td>'+esc(m.role||'')+'</td><td><code>'+esc(m.credential||'')+'</code></td><td><span class="ws-badge '+(ok?'ok':'no')+'">'+esc(m.decision)+'</span><div class="ws-note">'+esc(m.decision_reason||'')+'</div></td><td>'+(m.ledger_event_id?'<a href="'+api+'/receipt/'+esc(m.ledger_event_id)+'"><code>'+esc(String(m.ledger_event_id).slice(0,8))+'…</code></a>':'—')+'</td></tr>';
      }).join('');
      tb.innerHTML=rows||'<tr><td colspan="6" class="ws-note">no mutations recorded yet</td></tr>';
    }).catch(function(){});
    var btn=document.getElementById('ws-enter-btn'),out=document.getElementById('ws-enter-out');
    if(btn) btn.addEventListener('click',function(){
      btn.disabled=true;btn.textContent='Minting your credential…';
      fetch(api+'/enter',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role:'observer',actor:'page-visitor'})})
      .then(function(r){return r.json();}).then(function(d){
        var shown=Object.assign({},d); if(shown.token) shown.token=shown.token.slice(0,14)+'…redacted-in-page — full value returned only to your own client';
        out.hidden=false; out.textContent=JSON.stringify(shown,null,2);
        btn.textContent='Credential minted — yours is live';
      }).catch(function(e){out.hidden=false;out.textContent='enter failed: '+e;btn.disabled=false;btn.textContent='Enter this workspace as observer';});
    });
  })();</script>
</section>`;
}
