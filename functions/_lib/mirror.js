// THE MIRROR LAYER — claim-level recursion over every article.
// A page is finished only provisionally. The reader does not stand outside the article:
// every human or model may attach a TYPED contribution (question, objection, source,
// repair, compression, contradiction, audit) to an exact claim. Contributions are
// ledgered with provenance and a receipt; they never overwrite the article. Acceptance
// is an owner act. The loop: read → question → object → repair → receipt → the article
// evolves. Content layer mirrors the protocol layer (OIP: invocation → receipt → repair).
import { logEvent } from './event_log.js';

export const MIRROR_KINDS = ['question', 'objection', 'source', 'repair', 'compression', 'contradiction', 'audit'];

function nowIso() { return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); }

// Append one typed contribution. Exact-duplicate idempotent (slug+claim+kind+body
// returns the existing record — same law as the objections intake). Every append is
// ledgered; the ledger event id is the contribution's receipt.
export async function appendMirrorContribution(env, data) {
  const slug = String(data.slug || '').trim().toLowerCase().slice(0, 200);
  if (!slug) return { error: 'slug required' };
  const kind = String(data.kind || '').trim().toLowerCase();
  if (!MIRROR_KINDS.includes(kind)) return { error: 'kind must be one of: ' + MIRROR_KINDS.join('|') };
  const body = String(data.body || '').trim().slice(0, 4000);
  if (!body) return { error: 'body required — the contribution text' };
  const claimId = String(data.claim_id || '').trim().slice(0, 80) || null;
  const claimText = String(data.claim_text || '').trim().slice(0, 600) || null;
  const sourceId = String(data.source_id || '').trim().slice(0, 120) || null;
  const actor = String(data.actor || 'anonymous').trim().slice(0, 120) || 'anonymous';
  // repair/compression may carry the proposed replacement wording, either as an
  // explicit field or after " => " inside the body.
  let proposed = String(data.proposed_text || '').trim().slice(0, 4000) || null;
  if (!proposed && (kind === 'repair' || kind === 'compression') && body.includes(' => ')) {
    proposed = body.split(' => ').slice(1).join(' => ').trim().slice(0, 4000) || null;
  }

  const existing = await env.DB.prepare(
    'SELECT id, status, receipt, created_at FROM mirror_contributions WHERE slug=? AND COALESCE(claim_id,\'\')=? AND kind=? AND body=? ORDER BY id DESC LIMIT 1'
  ).bind(slug, claimId || '', kind, body).first();
  if (existing) {
    return { ok: true, deduped: true, id: existing.id, slug, claim_id: claimId, kind, status: existing.status, receipt: existing.receipt, created_at: existing.created_at, note: 'identical contribution already recorded — this is the record' };
  }

  const ts = nowIso();
  const r = await env.DB.prepare(
    'INSERT INTO mirror_contributions (created_at, slug, claim_id, claim_text, source_id, kind, actor, body, proposed_text, status) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(ts, slug, claimId, claimText, sourceId, kind, actor, body, proposed, 'proposed').run();
  const id = r.meta.last_row_id;

  const receipt = await logEvent(env, {
    source: 'mirror', key: 'MIRROR_APPEND', action: 'mirror_' + kind,
    direction: 'in', status: 200, actor: (data.actor_prefix || 'public') + ':' + actor,
    request: { slug, claim_id: claimId, claim_text: claimText, source_id: sourceId, kind, actor, body, proposed_text: proposed },
    response: { id, status: 'proposed' },
  });
  if (receipt) { try { await env.DB.prepare('UPDATE mirror_contributions SET receipt=? WHERE id=?').bind(receipt, id).run(); } catch {} }

  return {
    ok: true, id, slug, claim_id: claimId, kind, actor, status: 'proposed', receipt, created_at: ts,
    note: 'recorded and ledgered — the contribution is now part of the article\'s lineage; acceptance is an owner act',
    feed: 'https://miscsubjects.com/api/articles/' + slug + '/mirror',
    view: 'https://miscsubjects.com/a/' + slug,
  };
}

// Read the Mirror Layer of one article (or the newest contributions across all articles).
// Merges the historical objection ledger (oip_objections) so ALL recursion on the page is
// visible in one read — the nodes see one another.
export async function getMirrorFeed(env, slugArg, limitArg) {
  const slug = String(slugArg || '').trim().toLowerCase().slice(0, 200) || null;
  const limit = Math.min(200, Math.max(5, parseInt(limitArg || '50', 10) || 50));
  const rows = slug
    ? (await env.DB.prepare('SELECT * FROM mirror_contributions WHERE slug=? ORDER BY id DESC LIMIT ?').bind(slug, limit).all()).results || []
    : (await env.DB.prepare('SELECT * FROM mirror_contributions ORDER BY id DESC LIMIT ?').bind(limit).all()).results || [];
  const contributions = rows.map((c) => ({
    id: c.id, created_at: c.created_at, slug: c.slug, claim_id: c.claim_id, claim_text: c.claim_text,
    source_id: c.source_id, kind: c.kind, actor: c.actor, body: c.body, proposed_text: c.proposed_text,
    status: c.status, receipt: c.receipt, resolved_by: c.resolved_by, resolved_at: c.resolved_at, resolution_note: c.resolution_note,
  }));
  // Historical objection ledger, mapped into the same shape (read-only lineage).
  let objections = [];
  try {
    const or = slug
      ? (await env.DB.prepare('SELECT * FROM oip_objections WHERE slug=? ORDER BY id DESC LIMIT 50').bind(slug).all()).results || []
      : [];
    objections = or.map((o) => ({
      id: 'obj-' + o.id, created_at: o.created_at, slug: o.slug, claim_id: null, claim_text: o.exact_claim || null,
      source_id: null, kind: 'objection', actor: o.actor || 'anonymous', body: o.objection, proposed_text: o.minimum_patch || null,
      status: o.status === 'settled' ? 'accepted' : 'proposed', receipt: null,
      resolved_by: o.answered_by || null, resolved_at: o.answered_at || null, resolution_note: o.answer || null,
      legacy: 'oip_objections',
    }));
  } catch {}
  const all = contributions.concat(objections);
  const byStatus = { proposed: 0, accepted: 0, rejected: 0 };
  const byClaim = {};
  for (const c of all) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    const k = c.claim_id || '_article';
    (byClaim[k] = byClaim[k] || []).push(c.id);
  }
  return {
    READ_ME: 'The Mirror Layer. Typed contributions attached to exact claims of ' + (slug || 'all articles') + '. Proposed entries are raw recursion; accepted entries are owner-ratified lineage. Append with POST /api/articles/<slug>/mirror {claim_id, kind, actor, body} (open, no auth, ledgered) or dispatch key MIRROR_APPEND.',
    slug, count: all.length, by_status: byStatus, by_claim: byClaim,
    kinds: MIRROR_KINDS,
    contributions: all,
  };
}

// OWNER ACT — accept or reject a proposed contribution. Models propose; they do not resolve.
export async function resolveMirrorContribution(env, idArg, statusArg, note, resolvedBy) {
  const id = parseInt(idArg, 10);
  if (!id) return { error: 'contribution id required' };
  const status = String(statusArg || '').trim().toLowerCase();
  if (status !== 'accepted' && status !== 'rejected') return { error: 'status must be accepted|rejected' };
  const row = await env.DB.prepare('SELECT id, slug, claim_id, kind, body, status FROM mirror_contributions WHERE id=?').bind(id).first();
  if (!row) return { error: 'contribution not found: ' + id };
  const ts = nowIso();
  await env.DB.prepare('UPDATE mirror_contributions SET status=?, resolved_by=?, resolved_at=?, resolution_note=? WHERE id=?')
    .bind(status, String(resolvedBy || 'owner').slice(0, 120), ts, String(note || '').trim().slice(0, 2000) || null, id).run();
  const receipt = await logEvent(env, {
    source: 'mirror', key: 'MIRROR_RESOLVE', action: 'mirror_' + status,
    direction: 'in', status: 200, actor: 'owner',
    request: { id, status, note: note || null }, response: { ok: true, slug: row.slug, claim_id: row.claim_id, kind: row.kind },
  });
  return { ok: true, id, slug: row.slug, claim_id: row.claim_id, kind: row.kind, status, resolved_at: ts, receipt, feed: 'https://miscsubjects.com/api/articles/' + row.slug + '/mirror' };
}

// ---------------------------------------------------------------------------
// The injectable reader surface. Self-contained (scoped CSS + IIFE), constant —
// slug is read from <article data-slug> at runtime, so the middleware injects one
// string on every /a/ page and never touches the locked renderer. All contribution
// text renders via textContent (never innerHTML).
// ---------------------------------------------------------------------------
export function mirrorLayerWidget() {
  return `<style id="ms-mirror-css">
#ms-mirror-panel{position:fixed;right:18px;bottom:18px;width:min(400px,calc(100vw - 36px));max-height:72vh;overflow:auto;background:#101014;color:#e8e6e0;border:1px solid #2c2c33;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.5);z-index:99990;font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:none}
#ms-mirror-panel.open{display:block}
#ms-mirror-panel .mmh{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #2c2c33;position:sticky;top:0;background:#101014}
#ms-mirror-panel .mmh b{font-size:11px;letter-spacing:.18em;color:#b8b4a8}
#ms-mirror-panel .mmx{cursor:pointer;border:0;background:none;color:#777;font-size:16px;line-height:1}
#ms-mirror-panel,#ms-mirror-panel .mmc{background:#fff!important;color:#000!important;border-color:#ccc!important}#ms-mirror-panel .mmc{padding:12px 14px}
#ms-mirror-panel .mm-claim{font-style:italic;color:#a8a49a;border-left:2px solid #3a3a44;padding:4px 10px;margin:0 0 10px;max-height:90px;overflow:hidden}
#ms-mirror-panel .mm-kinds{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:0 0 10px}
#ms-mirror-panel .mm-kinds button{border:1px solid #ccc;background:#fff;color:#000;border-radius:7px;padding:6px 2px;font-size:11px;cursor:pointer}
#ms-mirror-panel .mm-kinds button.sel{border-color:#000;background:#f2f2f2;color:#000}
#ms-mirror-panel input,#ms-mirror-panel textarea{width:100%;box-sizing:border-box;background:#fff;border:1px solid #bbb;color:#000;border-radius:7px;padding:7px 9px;font:13px/1.45 inherit;margin:0 0 8px}
#ms-mirror-panel textarea{min-height:74px;resize:vertical}
#ms-mirror-panel .mm-send{width:100%;border:1px solid #000;background:#fff;color:#000;border-radius:7px;padding:8px;font-size:12px;letter-spacing:.06em;cursor:pointer}
#ms-mirror-panel .mm-note{color:#8a867c;font-size:11px;margin:8px 0 0}
#ms-mirror-panel .mm-ok{color:#9fc78f;font-size:12px;margin:8px 0 0;word-break:break-all}
#ms-mirror-panel .mm-err{color:#d08a7a;font-size:12px;margin:8px 0 0}
.ms-mirror-mark{position:absolute;left:-1.7em;top:.15em;width:1.3em;height:1.3em;border:0;background:none;color:#8f8a7a;opacity:0;cursor:pointer;font-size:.95em;transition:opacity .15s;padding:0}
.ms-mirror-host{position:relative}
.ms-mirror-host:hover .ms-mirror-mark{opacity:.85}
.ms-mirror-chip{display:inline-block;margin-left:.45em;padding:0 .5em;border:1px solid #b9b3a1;border-radius:9px;background:rgba(160,150,120,.12);color:#7a7460;font-size:.72em;vertical-align:super;cursor:pointer;white-space:nowrap}
#ms-mirror-section{max-width:72ch;margin:3.5rem auto 2rem;padding:0 1.2rem;font:14px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:inherit}
#ms-mirror-section .mms-rule{border:0;border-top:1px solid rgba(128,124,110,.35);margin:0 0 1.6rem}
#ms-mirror-section h2{font-size:13px;letter-spacing:.22em;color:#8f8a7a;margin:0 0 .8rem}
#ms-mirror-section .mms-epigraph{font-style:italic;color:#8a867c;margin:0 0 .4rem}
#ms-mirror-section .mms-loop{font-size:12px;color:#8f8a7a;letter-spacing:.04em;margin:0 0 1.4rem}
#ms-mirror-section .mms-entry{border:1px solid rgba(128,124,110,.3);border-radius:9px;padding:.7rem .9rem;margin:0 0 .7rem}
#ms-mirror-section .mms-entry.accepted{border-color:rgba(140,180,120,.55);background:rgba(140,180,120,.06)}
#ms-mirror-section .mms-meta{font-size:11px;color:#8f8a7a;margin:0 0 .3rem;letter-spacing:.03em}
#ms-mirror-section .mms-kind{display:inline-block;border:1px solid rgba(128,124,110,.45);border-radius:5px;padding:0 .45em;margin-right:.55em;text-transform:uppercase;letter-spacing:.1em;font-size:10px}
#ms-mirror-section .mms-claimref{font-style:italic;color:#8a867c;font-size:12px;margin:.25rem 0}
#ms-mirror-section .mms-body{white-space:pre-wrap;word-break:break-word}
#ms-mirror-section .mms-res{font-size:12px;color:#9aa78c;margin:.35rem 0 0}
#ms-mirror-section .mms-receipt{font-size:10px;color:#77735f;word-break:break-all}
#ms-mirror-section .mms-open{border:1px dashed rgba(128,124,110,.5);border-radius:9px;padding:.7rem .9rem;color:#8a867c;font-size:12px;margin:1rem 0 0}
#ms-mirror-section details{margin:1rem 0 0}
#ms-mirror-section summary{cursor:pointer;font-size:11px;letter-spacing:.1em;color:#8f8a7a}
#ms-mirror-section code{font-size:11px;word-break:break-all}
@media (max-width:640px){.ms-mirror-mark{left:auto;right:0}}
</style>
<script id="ms-mirror-js">
(function(){
if(window.__msMirror)return;window.__msMirror=1;
var art=document.querySelector('article[data-slug]');if(!art)return;
var SLUG=art.getAttribute('data-slug');if(!SLUG)return;
var KINDS=['question','objection','source','repair','compression','contradiction','audit'];
var API='/api/articles/'+SLUG+'/mirror';
function h(s){var x=0,i;for(i=0;i<s.length;i++){x=((x<<5)-x+s.charCodeAt(i))|0;}return(x>>>0).toString(16);}
function normText(el){return(el.textContent||'').replace(/\\s+/g,' ').trim();}
function claimIdFor(el){if(el.id&&el.id.indexOf('claim-')===0)return el.id;return'p-'+h(normText(el).toLowerCase());}
// addressable claims: substantive paragraphs + list items in the article body, and evidence-ledger claim anchors
var hosts=[];
var content=art.querySelector('.content');
if(content){var els=content.querySelectorAll('p,li');for(var i=0;i<els.length;i++){var t=normText(els[i]);if(t.length>=60&&!els[i].querySelector('p,li'))hosts.push(els[i]);}}
var anchors=art.querySelectorAll('[id^="claim-"]');for(var j=0;j<anchors.length;j++)hosts.push(anchors[j]);
var byId={};
hosts.forEach(function(el){var cid=claimIdFor(el);el.setAttribute('data-mirror-claim',cid);byId[cid]=el;el.classList.add('ms-mirror-host');
var b=document.createElement('button');b.className='ms-mirror-mark';b.type='button';b.title='The Mirror Layer — question, object, source, repair this claim';b.textContent='\\u25C8';
b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openPanel(cid,normText(el));});el.appendChild(b);});
// ---- panel ----
var panel=document.createElement('div');panel.id='ms-mirror-panel';
panel.innerHTML='<div class="mmh"><b>THE MIRROR LAYER</b><button class="mmx" aria-label="close">\\u00D7</button></div><div class="mmc">'+
'<p class="mm-claim"></p><div class="mm-kinds"></div>'+
'<input class="mm-actor" placeholder="who you are (name or model)" maxlength="120">'+
'<textarea class="mm-body" placeholder="your contribution — attach it to this exact claim"></textarea>'+
'<textarea class="mm-proposed" placeholder="proposed replacement wording (repair/compression)" style="display:none;min-height:52px"></textarea>'+
'<button class="mm-send">ATTACH TO THE LEDGER</button>'+
'<div class="mm-out"></div>'+
'<p class="mm-note">Typed, ledgered, receipted. Your entry never rewrites the page \\u2014 it becomes part of how the page discovers its own shape. Acceptance is an owner act.</p>'+
'</div>';
document.body.appendChild(panel);
var curClaim=null,curKind='question';
var kindsBox=panel.querySelector('.mm-kinds');
KINDS.forEach(function(k){var b=document.createElement('button');b.type='button';b.textContent=k;if(k===curKind)b.className='sel';
b.addEventListener('click',function(){curKind=k;var bs=kindsBox.querySelectorAll('button');for(var i=0;i<bs.length;i++)bs[i].className='';b.className='sel';
panel.querySelector('.mm-proposed').style.display=(k==='repair'||k==='compression')?'block':'none';});kindsBox.appendChild(b);});
panel.querySelector('.mmx').addEventListener('click',function(){panel.className='';});
var actorInput=panel.querySelector('.mm-actor');
try{actorInput.value=localStorage.getItem('mirror_actor')||'';}catch(e){}
function openPanel(cid,text){curClaim=cid;panel.querySelector('.mm-claim').textContent='\\u201C'+text.slice(0,240)+(text.length>240?'\\u2026':'')+'\\u201D';panel.querySelector('.mm-out').textContent='';panel.className='open';panel.querySelector('.mm-body').focus();}
panel.querySelector('.mm-send').addEventListener('click',function(){
var out=panel.querySelector('.mm-out');var body=panel.querySelector('.mm-body').value.trim();
if(!body){out.className='mm-out mm-err';out.textContent='body required';return;}
var actor=actorInput.value.trim()||'reader';try{localStorage.setItem('mirror_actor',actor);}catch(e){}
var payload={claim_id:curClaim,claim_text:(byId[curClaim]?normText(byId[curClaim]).slice(0,600):null),kind:curKind,actor:actor,body:body};
var prop=panel.querySelector('.mm-proposed').value.trim();if(prop)payload.proposed_text=prop;
out.className='mm-out';out.textContent='\\u2026';
fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json();}).then(function(j){
if(j&&j.ok){out.className='mm-out mm-ok';out.textContent=(j.deduped?'already on the ledger':'recorded')+' \\u2014 #'+j.id+(j.receipt?' \\u00B7 receipt '+j.receipt:'')+' \\u00B7 status '+j.status;
panel.querySelector('.mm-body').value='';panel.querySelector('.mm-proposed').value='';load();}
else{out.className='mm-out mm-err';out.textContent=(j&&j.error)||'failed';}
}).catch(function(){out.className='mm-out mm-err';out.textContent='request failed';});});
// ---- footer section + chips ----
var section=document.createElement('section');section.id='ms-mirror-section';
(art.parentNode||document.body).insertBefore(section,art.nextSibling);
function esc(s){return String(s==null?'':s);}
function render(feed){
var cs=(feed&&feed.contributions)||[];
// chips on claims that carry contributions
var counts={};cs.forEach(function(c){if(c.claim_id)counts[c.claim_id]=(counts[c.claim_id]||0)+1;});
Object.keys(counts).forEach(function(cid){var el=byId[cid];if(!el||el.querySelector('.ms-mirror-chip'))return;
var chip=document.createElement('button');chip.className='ms-mirror-chip';chip.type='button';chip.textContent='\\u25C8 '+counts[cid];chip.title='This claim carries '+counts[cid]+' contribution(s) on the Mirror Layer';
chip.addEventListener('click',function(e){e.preventDefault();section.scrollIntoView({behavior:'smooth'});});el.appendChild(chip);});
// footer ledger
section.textContent='';
var hr=document.createElement('hr');hr.className='mms-rule';section.appendChild(hr);
var t=document.createElement('h2');t.textContent='THE MIRROR LAYER';section.appendChild(t);
var ep=document.createElement('p');ep.className='mms-epigraph';ep.textContent='The reader does not stand outside the article. The reader becomes one of the forces by which the article discovers its own shape.';section.appendChild(ep);
var lp=document.createElement('p');lp.className='mms-loop';lp.textContent='read \\u2192 question \\u2192 object \\u2192 repair \\u2192 receipt \\u2192 the article evolves \\u00B7 '+cs.length+' contribution(s) \\u00B7 accepted '+((feed.by_status&&feed.by_status.accepted)||0)+' \\u00B7 proposed '+((feed.by_status&&feed.by_status.proposed)||0);section.appendChild(lp);
cs.slice(0,40).forEach(function(c){
var e=document.createElement('div');e.className='mms-entry'+(c.status==='accepted'?' accepted':'');
var m=document.createElement('div');m.className='mms-meta';
var kb=document.createElement('span');kb.className='mms-kind';kb.textContent=esc(c.kind);m.appendChild(kb);
m.appendChild(document.createTextNode(esc(c.actor)+' \\u00B7 '+esc(c.created_at||'')+' \\u00B7 '+esc(c.status)));e.appendChild(m);
if(c.claim_text){var cr=document.createElement('div');cr.className='mms-claimref';cr.textContent='on: \\u201C'+esc(c.claim_text).slice(0,180)+'\\u201D';e.appendChild(cr);}
var b=document.createElement('div');b.className='mms-body';b.textContent=esc(c.body);e.appendChild(b);
if(c.proposed_text){var p2=document.createElement('div');p2.className='mms-res';p2.textContent='proposed wording: '+esc(c.proposed_text);e.appendChild(p2);}
if(c.resolution_note){var rn=document.createElement('div');rn.className='mms-res';rn.textContent=(c.status==='accepted'?'accepted':'resolved')+(c.resolved_by?' by '+esc(c.resolved_by):'')+': '+esc(c.resolution_note);e.appendChild(rn);}
if(c.receipt){var rc=document.createElement('div');rc.className='mms-receipt';rc.textContent='receipt '+esc(c.receipt);e.appendChild(rc);}
if(c.claim_id&&byId[c.claim_id]){m.style.cursor='pointer';m.title='jump to the claim';m.addEventListener('click',function(){byId[c.claim_id].scrollIntoView({behavior:'smooth',block:'center'});});}
section.appendChild(e);});
var inv=document.createElement('div');inv.className='mms-open';inv.textContent='Hover any claim and press \\u25C8 to enter the recursion: question it, object, add a source, propose a repair or compression, log a contradiction, or audit it. Every entry is typed, ledgered with provenance, and receipted. To read the system is to enter the system.';section.appendChild(inv);
var det=document.createElement('details');var sum=document.createElement('summary');sum.textContent='FOR MODELS \\u2014 the machine door';det.appendChild(sum);
var pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';var code=document.createElement('code');
code.textContent='POST '+location.origin+API+' {"claim_id":"<data-mirror-claim>","kind":"question|objection|source|repair|compression|contradiction|audit","actor":"<your model name>","body":"..."}  \\u2014 open intake, no auth, ledgered.\\nGET '+location.origin+API+'  \\u2014 the full feed.\\nOr via OIP: dispatch key MIRROR_APPEND (slug|claim_id|kind|actor|body). Philosophy: '+location.origin+'/a/oip-the-mirror-layer';
pre.appendChild(code);det.appendChild(pre);section.appendChild(det);
}
function load(){fetch(API).then(function(r){return r.json();}).then(render).catch(function(){});}
load();
})();
</script>`;
}
