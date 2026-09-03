// Public claim-audit page — /audit

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function fmtDate(s) { return s ? s.slice(0,10).replace(/-/g,'.') : ''; }

async function recentAudits(env) {
  try {
    // One row per claim — the newest verdict. A re-audit supersedes its predecessor;
    // showing both made the page read as two contradictory rulings on one claim.
    const rows = (await env.DB.prepare(
      `SELECT public_id, claim, verdict, confidence, created_at FROM audit_jobs
        WHERE status='done' AND ts IN (SELECT MAX(ts) FROM audit_jobs WHERE status='done' GROUP BY claim)
        ORDER BY ts DESC LIMIT 10`
    ).all()).results || [];
    return rows;
  } catch { return []; }
}

// The corpus the audit engine prosecutes against. Real counts, read live — this is the
// scale a cold reader needs before the recent-verdict list means anything.
// RECONCILE, DON'T JUST TOTAL. Two different true counts of the same database read as a
// contradiction on a site whose whole pitch is auditability: /latest counts editorial
// articles, this page counted every published record. Both numbers now appear here with
// the arithmetic that ties them together, so the article figure matches /latest exactly.
async function corpusScale(env) {
  try {
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS records,
              SUM(CASE WHEN COALESCE(json_extract(meta,'$.register'),'standard')
                       IN ('source_ledger','source','audit') THEN 0 ELSE 1 END) AS articles,
              SUM(CASE WHEN COALESCE(json_extract(meta,'$.register'),'standard')='source_ledger'
                       THEN 1 ELSE 0 END) AS ledgers,
              SUM(CASE WHEN COALESCE(json_extract(meta,'$.register'),'standard')='source'
                       THEN 1 ELSE 0 END) AS source_records,
              SUM(CASE WHEN COALESCE(json_extract(meta,'$.register'),'standard')='audit'
                       THEN 1 ELSE 0 END) AS audit_records,
              SUM(COALESCE(json_array_length(json_extract(meta,'$.claims')),0)) AS claims,
              SUM(COALESCE(json_array_length(json_extract(meta,'$.sources')),0)) AS sources
       FROM articles WHERE published = 1`
    ).first();
    return r && Number(r.records) ? r : null;
  } catch { return null; }
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const prefilled = url.searchParams.get('claim') || '';
  const [recent, scale] = await Promise.all([recentAudits(env), corpusScale(env)]);

  const bg = '#ffffff';
  const ink = '#0a0a0a';
  const soft = '#444444';
  const dim = '#737373';
  const line = '#e5e5e5';
  const card = '#f4f4f4';
  const accent = '#000000';

  const n = (v) => Number(v || 0).toLocaleString('en-US');
  const scaleHtml = scale
    ? `<div class="scale">
  <div class="scale-h">The corpus every claim is prosecuted against</div>
  <div class="scale-row">
    <div class="scale-cell"><b>${n(scale.articles)}</b><span>published articles</span></div>
    <div class="scale-cell"><b>${n(scale.claims)}</b><span>extracted claims</span></div>
    <div class="scale-cell"><b>${n(scale.sources)}</b><span>attached sources</span></div>
  </div>
  <div class="scale-note">Counts read live from the article database. The database holds ${n(scale.records)} published records in total: ${n(scale.articles)} articles, ${n(scale.ledgers)} source ledgers, ${n(scale.source_records)} source records, and ${n(scale.audit_records)} audit records. The article figure is the same one <a href="/latest">/latest</a> reports. Grounding ratio: <a href="/api/metrics/grounding">/api/metrics/grounding</a></div>
</div>`
    : '';

  const recentHtml = recent.length
    ? `<div class="recent"><div class="recent-h">Recent audits</div>` +
      recent.map(r => `<a class="recent-row" href="/api/audit?id=${escapeHtml(r.public_id)}">` +
        `<span class="recent-v ${escapeHtml(r.verdict)}">${escapeHtml(r.verdict || '?')}</span>` +
        `<span class="recent-c">${escapeHtml(r.claim)}</span>` +
        `<span class="recent-meta">${fmtDate(r.created_at)} · ${r.confidence || 0}%</span>` +
      `</a>`).join('') +
      `</div>`
    : '';

  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Claim Audit — miscsubjects</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:${bg};color:${ink};font:18px/1.65 Inter,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:720px;margin:0 auto;padding:0 22px 90px}
header{padding:28px 0 10px;text-align:center}
.logo{display:inline-flex;align-items:center;gap:12px}
.mustache{width:46px;height:46px}
.brand{font:900 26px/1 Inter,system-ui,sans-serif;letter-spacing:-0.02em}
.tag{font:600 11px/1 Inter,system-ui,sans-serif;letter-spacing:0.18em;text-transform:uppercase;color:${dim};margin-top:6px}
.hero{text-align:center;padding:34px 0 28px}
.hero h1{font:800 clamp(32px,6vw,56px)/1.05 Inter,system-ui,sans-serif;letter-spacing:-0.03em}
.hero p{color:${soft};font-size:clamp(16px,2.4vw,20px);margin-top:12px;max-width:560px;margin-left:auto;margin-right:auto}
.box{border:1px solid ${line};border-radius:18px;background:${card};padding:22px}
label{display:block;font:700 12px/1 Inter,system-ui,sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:${soft};margin-bottom:10px}
textarea{width:100%;min-height:140px;border:1px solid ${line};border-radius:12px;padding:14px;font:17px/1.55 Inter,system-ui,sans-serif;color:${ink};background:#fff;resize:vertical}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
button{border:0;border-radius:10px;padding:12px 18px;font:700 14px/1 Inter,system-ui,sans-serif;cursor:pointer;transition:opacity .15s,transform .1s}
button:hover{opacity:.85}
button:active{transform:translateY(1px)}
.primary{background:${accent};color:#fff}
.secondary{background:#fff;color:${ink};border:1px solid ${line}}
.userkey{display:flex;align-items:center;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid ${line}}
.userkey code{font:12px ui-monospace,monospace;background:#fff;padding:6px 8px;border-radius:6px;border:1px solid ${line};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.status{margin-top:14px;font:13px ui-monospace,monospace;color:${dim}}
.result{display:none;margin-top:24px}
.result.on{display:block}
.verdict{display:inline-flex;align-items:center;gap:10px;font:900 42px/1 Inter,system-ui,sans-serif;text-transform:uppercase;letter-spacing:-0.02em}
.verdict.true{color:#1a8f4a}
.verdict.misleading{color:#b8860b}
.verdict.false{color:#b5453b}
.verdict.insufficient{color:${dim}}
.conf{margin:14px 0 18px}
.conf-bar{height:8px;background:${line};border-radius:99px;overflow:hidden}
.conf-fill{height:100%;background:${accent};border-radius:99px}
.conf-label{font:700 12px/1 Inter,system-ui,sans-serif;color:${soft};margin-top:6px;text-transform:uppercase;letter-spacing:0.06em}
.reasoning{font:18px/1.65 Inter,system-ui,sans-serif;color:${soft};margin-bottom:18px}
.evidence{margin-top:18px}
.ev-h{font:700 12px/1 Inter,system-ui,sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:${soft};margin-bottom:10px}
.ev-card{display:block;border:1px solid ${line};border-radius:12px;background:#fff;padding:14px;margin-bottom:10px;text-decoration:none;color:inherit}
.ev-card:hover{border-color:${accent}}
.ev-t{font:800 16px/1.25 Inter,system-ui,sans-serif;margin-bottom:6px}
.ev-s{font:13px/1.5 Inter,system-ui,sans-serif;color:${soft}}
.ev-meta{font:11px ui-monospace,monospace;color:${dim};margin-top:8px}
.hash{font:11px ui-monospace,monospace;color:${dim};margin-top:14px}
.scale{margin-top:34px;border-top:1px solid ${line};padding-top:22px}
.scale-h{font:700 12px/1 Inter,system-ui,sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:${soft};margin-bottom:14px}
.scale-row{display:flex;flex-wrap:wrap;gap:14px}
.scale-cell{flex:1 1 150px;background:${card};border-radius:10px;padding:16px 18px}
.scale-cell b{display:block;font:700 26px/1.1 Inter,system-ui,sans-serif;letter-spacing:-0.02em}
.scale-cell span{display:block;margin-top:4px;font:12px/1.3 Inter,system-ui,sans-serif;color:${dim}}
.scale-note{margin-top:12px;font:12px ui-monospace,monospace;color:${dim}}
.scale-note a{color:${dim}}
.recent{margin-top:34px}
.recent-h{font:700 12px/1 Inter,system-ui,sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:${soft};margin-bottom:10px}
.recent-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid ${line};text-decoration:none;color:inherit}
.recent-v{flex:none;font:700 11px/1 Inter,system-ui,sans-serif;text-transform:uppercase;padding:4px 8px;border-radius:6px;color:#fff}
.recent-v.true{background:#1a8f4a}
.recent-v.misleading{background:#b8860b}
.recent-v.false{background:#b5453b}
.recent-v.insufficient{background:${dim}}
.recent-c{flex:1;font:15px/1.35 Inter,system-ui,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.recent-meta{flex:none;font:11px ui-monospace,monospace;color:${dim}}
footer{margin-top:60px;padding-top:20px;border-top:1px solid ${line};font:11px/1.6 ui-monospace,monospace;letter-spacing:0.08em;text-transform:uppercase;color:${dim};text-align:center}
</style></head><body><div class="wrap">
<header><div class="logo">
  <svg class="mustache" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="50" cy="28" r="22" fill="none" stroke="${escapeHtml(ink)}" stroke-width="5"/>
    <path d="M50 12 L50 6 M32 20 L26 14 M68 20 L74 14" stroke="${escapeHtml(ink)}" stroke-width="4" stroke-linecap="round"/>
    <path d="M50 52 Q28 68 14 56 Q6 48 18 46 Q34 44 50 56 Q66 44 82 46 Q94 48 86 56 Q72 68 50 52" fill="${escapeHtml(ink)}"/>
  </svg>
  <div><div class="brand">Claim Audit</div><div class="tag">Adversarial verification against the source graph</div></div>
</div></header>

<div class="hero">
  <h1>Submit a claim for adversarial audit.</h1>
  <p>Enter a claim or question. The audit engine prosecutes it against the source graph and returns a hash-anchored verdict with the evidence attached.</p>
</div>

<div class="box">
  <label for="claim">Claim / question</label>
  <textarea id="claim" placeholder="e.g. BPC-157 heals leaky gut in humans">${escapeHtml(prefilled)}</textarea>
  <div class="actions">
    <button class="primary" id="btn-audit">Audit this claim</button>
    <button class="secondary" id="btn-dispute">Dispute this claim</button>
  </div>
  <div class="userkey">
    <label style="margin:0">Your access key</label>
    <code id="uk">…</code>
    <button class="secondary" id="btn-copykey" style="padding:8px 12px;font-size:12px">Copy</button>
  </div>
  <div class="status" id="status"></div>
</div>

<div class="result" id="result">
  <div class="verdict" id="v-verdict">…</div>
  <div class="conf"><div class="conf-bar"><div class="conf-fill" id="v-bar"></div></div><div class="conf-label" id="v-conf"></div></div>
  <div class="reasoning" id="v-reasoning"></div>
  <div class="evidence" id="v-evidence"></div>
  <div class="hash" id="v-hash"></div>
</div>

${scaleHtml}
${recentHtml}

<footer>Claim Audit · every verdict is hash-anchored · miscsubjects.com</footer>
</div>
<script>
(function(){
  var claim=document.getElementById('claim');
  var status=document.getElementById('status');
  var result=document.getElementById('result');
  var vVerdict=document.getElementById('v-verdict');
  var vBar=document.getElementById('v-bar');
  var vConf=document.getElementById('v-conf');
  var vReason=document.getElementById('v-reasoning');
  var vEvidence=document.getElementById('v-evidence');
  var vHash=document.getElementById('v-hash');
  var ukBox=document.getElementById('uk');
  var uk=localStorage.getItem('charlie_key');
  if(!uk){
    var a=new Uint8Array(16);
    crypto.getRandomValues(a);
    uk=Array.from(a).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
    localStorage.setItem('charlie_key',uk);
  }
  ukBox.textContent=uk.slice(0,8)+'…'+uk.slice(-4);
  document.getElementById('btn-copykey').onclick=function(){navigator.clipboard.writeText(uk).then(function(){var b=document.getElementById('btn-copykey');b.textContent='Copied';setTimeout(function(){b.textContent='Copy';},1200);});};
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function setStatus(t){status.textContent=t;}
  function renderEvidence(ev){
    if(!ev||!ev.length)return'';
    var out='<div class="ev-h">Evidence from the graph</div>';
    ev.forEach(function(a){
      if(a.sources&&a.sources.length){
        a.sources.forEach(function(s){
          out+='<a class="ev-card" href="'+esc(s.url||'#')+'" target="_blank" rel="noopener">'+
            '<div class="ev-t">'+esc(s.title||'(untitled)')+'</div>'+
            '<div class="ev-s">'+esc(s.quote||s.summary||'')+'</div>'+
            '<div class="ev-meta">'+esc(s.type||'source')+' · ledger #'+esc(s.id||'?')+' · '+esc(a.title)+'</div>'+
          '</a>';
        });
      }
    });
    return out;
  }
  function submit(mode){
    var c=claim.value.trim();
    if(!c){setStatus('Type a claim first.');return;}
    setStatus('Charlie is prosecuting the graph…');
    result.classList.remove('on');
    fetch('/api/audit',{method:'POST',headers:{'content-type':'application/json','x-user-key':uk},body:JSON.stringify({claim:c,mode:mode})})
    .then(function(r){return r.json();})
    .then(function(j){
      if(j.error){setStatus('Error: '+j.error);return;}
      setStatus('');
      vVerdict.textContent=j.verdict;
      vVerdict.className='verdict '+j.verdict;
      vBar.style.width=Math.max(0,Math.min(100,j.confidence||0))+'%';
      vConf.textContent='Confidence '+j.confidence+'%';
      vReason.textContent=j.reasoning;
      vEvidence.innerHTML=renderEvidence(j.evidence);
      vHash.innerHTML='Ledger hash <code>'+esc(j.ledger_hash)+'</code> · <a href="/api/audit?id='+esc(j.public_id)+'">view JSON</a>';
      result.classList.add('on');
    })
    .catch(function(e){setStatus('Network error: '+e.message);});
  }
  document.getElementById('btn-audit').onclick=function(){submit('audit');};
  document.getElementById('btn-dispute').onclick=function(){submit('report');};
})();
</script>
</body></html>`;

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
