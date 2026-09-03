import { shellHtml } from './_layout.js';
import { renderRail, vaultStyles } from '../_lib/vault_widgets.js';
import { catalog } from '../api/vault/[[path]].js';

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadCatalog(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '18', 10) || 18, 100);
  return catalog(env, limit);
}

export async function onRequestGet(context) {
  const cat = await loadCatalog(context).catch((e) => ({ error: String(e && e.message || e), groups: {}, counts: {} }));
  const g = cat.groups || {};
  const c = cat.counts || {};
  const limits = cat.limits || {};
  // Guardian owner switch (owner order 2026-08-30): KV guardian_master; '0'/'off'/'false' = OFF.
  let guardianOn = true;
  try { const gm = await context.env.KV.get('guardian_master'); if (gm != null && ['0', 'off', 'false', 'OFF'].includes(String(gm).trim())) guardianOn = false; } catch {}
  const body = `
<style>${vaultStyles()}
.guard-switch{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:1px solid var(--line-strong,#c7c7c7);border-radius:10px;padding:12px 16px;margin:0 0 14px;background:${guardianOn ? '#eefaf1' : '#fdf3f3'}}
.guard-switch b{font-size:14px}
.guard-switch .gs-state{font-weight:800;letter-spacing:.06em;font-size:13px;color:${guardianOn ? '#178c45' : '#c0392b'}}
.guard-switch .gs-desc{font-size:12.5px;color:#5f6368;flex:1;min-width:220px}
.guard-switch button{padding:6px 16px;border:1px solid #c7c7c7;background:#fff;border-radius:6px;font-weight:700;cursor:pointer}
.guard-switch button.on{background:#178c45;border-color:#178c45;color:#fff}
.guard-switch button.off{background:#c0392b;border-color:#c0392b;color:#fff}
</style>
<div class="vault-shell">
  <div class="guard-switch">
    <b>Guardian</b>
    <span class="gs-state" id="guard-state">${guardianOn ? 'ON' : 'OFF'}</span>
    <span class="gs-desc">Drift watch on locked files — quarantine, model judge, text alerts. OFF: it checks nothing and sends nothing; the lock manifests and commit hooks still stand.</span>
    <button id="guard-on" class="${guardianOn ? 'on' : ''}" onclick="setGuardian(1)">On</button>
    <button id="guard-off" class="${guardianOn ? '' : 'off'}" onclick="setGuardian(0)">Off</button>
    <span id="guard-status" class="subtitle"></span>
  </div>
  <section class="vault-hero">
    <div>
      <h1>Vault</h1>
      <p>One protected catalogue for the build's work: tasks, events, cards, claims, locked files, and owner ideas. The point is simple: every important thought or feature gets a row, a JSON endpoint, a visual card, and a lock path.</p>
    </div>
    <div class="vault-actions">
      <a href="/api/vault/catalog">Catalog JSON</a>
      <a href="/api/vault/widgets">Widgets JSON</a>
      <a href="/api/vault/limits">Limits JSON</a>
      <a href="/admin/ledger">Ledger</a>
      <a href="/admin/tasks">Tasks</a>
      <button onclick="scanSessions()">Scan Sessions</button>
    </div>
  </section>

  <div class="vault-lock">
    Protected article widgets and the main ledger renderer are locked by <code>PROTECTED_WIDGETS.md</code>. This vault is partitioned into new files so it can improve the ledger without mutating the locked renderer.
  </div>

  <div class="vault-lock">
    Bounded cron/session scan: runs at <code>${esc(limits.session_scan_cron || 'manual')}</code>, reads at most <code>${esc(limits.max_sessions_per_scan || 50)}</code> Claude-code turns, writes one <code>LEDGER.events</code> row, and performs <code>0</code> code writes or auto-reverts.
    <p id="scan-status" class="subtitle"></p>
  </div>

  <section class="vault-grid">
    <div class="vault-stat"><b>${esc(c.tasks || 0)}</b><span>Task widgets</span></div>
    <div class="vault-stat"><b>${esc(c.events || 0)}</b><span>Event widgets</span></div>
    <div class="vault-stat"><b>${esc(c.cards || 0)}</b><span>Model/session cards</span></div>
    <div class="vault-stat"><b>${esc(c.protected || 0)}</b><span>Locked paths</span></div>
  </section>

  <section class="vault-form">
    <h2>Post An Idea To The Vault</h2>
    <p class="subtitle">Macro idea, micro prompt rule, widget note, API gap, protection law. It becomes an open task row with <code>source=vault-idea</code> and a ledger event.</p>
    <div class="vault-form-row">
      <input id="idea-title" placeholder="Idea title">
      <textarea id="idea-body" placeholder="Write the idea exactly."></textarea>
      <button onclick="postIdea()">Vault idea</button>
    </div>
    <p id="idea-status" class="subtitle"></p>
  </section>

  ${renderRail('Tasks ledger', g.tasks || [], '/api/vault/catalog')}
  ${renderRail('Events ledger', g.events || [], '/api/events')}
  ${renderRail('Model/session cards', g.cards || [], '/api/cards')}
  ${renderRail('Claims ledger', g.claims || [], '/api/claims')}
  ${renderRail('Protected feature locks', g.protected || [], '/api/vault/catalog')}
</div>

<script>
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
async function setGuardian(on){
  const st=document.getElementById('guard-status');
  st.textContent=on?'Arming...':'Disarming...';
  try{
    const r=await fetch('/api/kv?key=guardian_master',{method:'PUT',body:on?'1':'0'});
    const j=await r.json();
    if(!r.ok) throw new Error(j.error||('HTTP '+r.status));
    document.getElementById('guard-state').textContent=on?'ON':'OFF';
    document.getElementById('guard-on').className=on?'on':'';
    document.getElementById('guard-off').className=on?'':'off';
    st.textContent=on?'Guardian armed.':'Guardian off — drift checks and texts stopped.';
  }catch(e){st.textContent='Switch failed: '+e.message;}
}
async function postIdea(){
  const st=document.getElementById('idea-status');
  const title=document.getElementById('idea-title').value.trim();
  const body=document.getElementById('idea-body').value.trim();
  if(!body && !title){st.textContent='Write the idea first.';return;}
  st.textContent='Vaulting...';
  try{
    const r=await fetch('/api/vault/ideas',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:title||'Vault idea',body,scope:'owner-idea',lock:true})});
    const j=await r.json();
    if(!r.ok) throw new Error(j.error||('HTTP '+r.status));
    st.innerHTML='Vaulted as task #'+esc(j.id)+'.';
    document.getElementById('idea-title').value='';
    document.getElementById('idea-body').value='';
  }catch(e){st.textContent='Vault failed: '+e.message;}
}
async function scanSessions(){
  const st=document.getElementById('scan-status');
  st.textContent='Scanning sessions...';
  try{
    const r=await fetch('/api/vault/session-scan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({limit:25,source:'admin-vault'})});
    const j=await r.json();
    if(!r.ok) throw new Error(j.error||('HTTP '+r.status));
    st.textContent='Scanned '+j.scanned+' turns, alerts '+j.alerts+', event '+(j.event_id||'logged')+'.';
  }catch(e){st.textContent='Scan failed: '+e.message;}
}
</script>`;
  return new Response(shellHtml({ activeHref: '/admin/vault', title: 'Vault', body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}
