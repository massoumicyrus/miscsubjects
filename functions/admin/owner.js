import { shellHtml } from './_layout.js';

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const KINDS = ['boolean', 'rule', 'preference', 'thought', 'ban'];

export async function onRequestGet() {
  const body = `
<style>
.owner-shell{max-width:960px;margin:0 auto;padding:24px}
.owner-hero{margin-bottom:24px}
.owner-hero h1{font-size:clamp(2rem,3.4vw,3rem);margin-bottom:8px}
.owner-hero p{color:var(--muted);max-width:72ch}
.owner-lock{background:var(--warn-bg);border:1px solid var(--warn-border);color:var(--warn-ink);padding:12px 14px;border-radius:8px;margin-bottom:20px;font-size:13px}
.owner-form{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:24px}
.owner-form h2{font-size:15px;margin-bottom:10px}
.owner-form-row{display:grid;gap:10px}
.owner-form select,.owner-form textarea,.owner-form input{width:100%;font:inherit;padding:10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--ink)}
.owner-form textarea{min-height:120px;font-family:var(--mono);font-size:13px}
.owner-form button{justify-self:start;padding:9px 16px;background:var(--accent);color:#fff;border:0;border-radius:6px;font-weight:600;cursor:pointer}
.owner-form button:hover{filter:brightness(1.08)}
.owner-meta{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;font-size:13px;color:var(--muted)}
.owner-list{display:grid;gap:12px}
.owner-card{border:1px solid var(--line);border-radius:10px;padding:14px;background:var(--panel)}
.owner-card .top{display:flex;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap}
.owner-card .kind{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:3px 8px;border-radius:999px;background:var(--accent-soft);color:var(--accent)}
.owner-card .seq{font-family:var(--mono);font-size:12px;color:var(--muted)}
.owner-card .content{white-space:pre-wrap;line-height:1.55;color:var(--ink)}
.owner-card .hash{font-family:var(--mono);font-size:11px;color:var(--muted);margin-top:8px;word-break:break-all}
.subtitle{font-size:13px;color:var(--muted);margin-top:8px}
</style>
<div class="owner-shell">
  <section class="owner-hero">
    <h1>Owner Rules</h1>
    <p>Append-only boolean rules, preferences, and personal thoughts. Models read these on every kernel call; they cannot edit or delete them. Each entry is hash-chained — same integrity model as the article source ledger.</p>
  </section>

  <div class="owner-lock">
    Append only. No update. No delete. Agents cite rule <code>seq</code> + <code>hash</code> when a rule governs their action.
    Public read: <code>GET /api/rules</code> · Append: <code>POST /api/rules</code> (owner access key).
  </div>

  <div class="owner-meta" id="meta">Loading chain…</div>

  <section class="owner-form">
    <h2>Post a rule</h2>
    <div class="owner-form-row">
      <select id="kind">
        ${KINDS.map(k => `<option value="${k}">${k}</option>`).join('')}
      </select>
      <textarea id="content" placeholder="MUST NOT send outbound texts without explicit owner phrase.&#10;PREFER cf_main execute over individual CF_* rows.&#10;I want one OS surface, not twenty CLIs."></textarea>
      <button onclick="postRule()">Append rule</button>
    </div>
    <p id="status" class="subtitle"></p>
  </section>

  <section class="owner-list" id="list"></section>
</div>

<script>
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
async function loadRules(){
  const list=document.getElementById('list');
  const meta=document.getElementById('meta');
  try{
    const [r,v]=await Promise.all([fetch('/api/rules'),fetch('/api/rules/verify')]);
    const j=await r.json(),c=await v.json();
    meta.innerHTML='Entries: <b>'+esc(j.count)+'</b> · Chain: <b>'+(c.chain&&c.chain.valid?'valid':'BROKEN')+'</b> · Head: <code>'+esc((c.chain&&c.chain.head)||'genesis')+'</code>';
    const rules=j.rules||[];
    if(!rules.length){list.innerHTML='<p class="subtitle">No rules yet. Post your first boolean preference above.</p>';return;}
    list.innerHTML=rules.slice().reverse().map(x=>'<article class="owner-card"><div class="top"><span class="kind">'+esc(x.kind)+'</span><span class="seq">#'+esc(x.seq)+' · '+esc(x.ts)+'</span></div><div class="content">'+esc(x.content)+'</div><div class="hash">'+esc(x.hash)+'</div></article>').join('');
  }catch(e){meta.textContent='Load failed: '+e.message;}
}
async function postRule(){
  const st=document.getElementById('status');
  const kind=document.getElementById('kind').value;
  const content=document.getElementById('content').value.trim();
  if(!content){st.textContent='Write the rule first.';return;}
  st.textContent='Appending…';
  try{
    const r=await fetch('/api/rules',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind,content,added_by:'owner-ui'})});
    const j=await r.json();
    if(!r.ok) throw new Error(j.error||('HTTP '+r.status));
    st.textContent='Appended #'+j.seq+' · hash '+j.hash.slice(0,16)+'…';
    document.getElementById('content').value='';
    loadRules();
  }catch(e){st.textContent='Append failed: '+e.message;}
}
loadRules();
</script>`;

  return new Response(shellHtml({ activeHref: '/admin/owner', title: 'Owner Rules', body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}
