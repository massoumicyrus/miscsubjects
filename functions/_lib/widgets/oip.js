// OIP beauty widgets — code blocks, the voxel constellation, message-the-build.
// Design language: explicit readable spacing, shared body type, restrained accents.
// CSS lives in oipWidgetStyles() and is injected by functions/a/[slug].js.

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── JSON / shell syntax coloring (server-side, span-wrapped) ─────────────────
function colorJson(raw) {
  let out = '';
  let last = 0;
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    out += esc(raw.slice(last, m.index));
    if (m[1] !== undefined) {
      out += m[2] !== undefined
        ? `<span class="cj-k">${esc(m[1])}</span>${esc(m[2])}`
        : `<span class="cj-s">${esc(m[1])}</span>`;
    } else if (m[3] !== undefined) {
      out += `<span class="cj-b">${esc(m[3])}</span>`;
    } else if (m[4] !== undefined) {
      out += `<span class="cj-n">${esc(m[4])}</span>`;
    }
    last = m.index + m[0].length;
  }
  out += esc(raw.slice(last));
  return out;
}

function colorShell(raw) {
  return raw.split('\n').map((line) => {
    if (/^\s*#/.test(line)) return `<span class="cj-c">${esc(line)}</span>`;
    return esc(line)
      .replace(/^(\s*)(curl|POST|GET|PUT|PATCH|DELETE)(\s)/, '$1<span class="cj-v">$2</span>$3')
      .replace(/(&#39;https?:\/\/[^&]*&#39;|https?:\/\/\S+)/g, '<span class="cj-u">$1</span>');
  }).join('\n');
}

/**
 * A fenced code block as a jewel: mac-window bar, language chip, one-tap copy,
 * JSON keys/strings/numbers tinted. Long JSON folds shut (the JSON collapse).
 */
export function renderCodeBlock(code, lang) {
  const raw = String(code || '').replace(/\n+$/, '');
  const l = String(lang || '').toLowerCase();
  const looksJson = l === 'json' || /^\s*[{[]/.test(raw);
  const body = looksJson ? colorJson(raw) : colorShell(raw);
  const label = l || (looksJson ? 'json' : 'code');
  const lines = raw.split('\n').length;
  const inner =
    `<div class="cb-bar"><span class="cb-dots"><i></i><i></i><i></i></span>` +
    `<span class="cb-lang">${esc(label)}</span>` +
    `<button type="button" class="cb-copy" data-code="${esc(raw)}">copy</button></div>` +
    `<pre class="cb-pre"><code>${body}</code></pre>`;
  if (looksJson && lines > 14) {
    return `<details class="codeblock cb-fold"><summary class="cb-foldbar">` +
      `<span class="cb-dots"><i></i><i></i><i></i></span>` +
      `<span class="cb-lang">${esc(label)} · ${lines} lines</span>` +
      `<span class="cb-foldhint">tap to unfold</span></summary>${inner}</details>`;
  }
  return `<figure class="codeblock">${inner}</figure>`;
}

// ── Message the build: tap a phone widget → a real chat screen opens ─────────
// The reader types a question; it lands in user_entries (hash-chained) and queues
// tasks.source='article-question'; a cron agent from the answer forum replies;
// the answer streams back into this same thread and the append-only ledger.
const BUILD_NUMBER = '[BUILD_PHONE]';

export function renderMessageTheBuild(slug, title) {
  const q = `about /a/${slug}: `;
  const smsHref = `sms:${BUILD_NUMBER}?&body=${encodeURIComponent(q)}`;
  const waHref = `https://wa.me/${BUILD_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent(q)}`;
  const t = esc(title || slug);
  const sj = JSON.stringify(String(slug));
  return `<section class="msgbuild" data-slug="${esc(slug)}" id="ms-msgbuild">` +
    `<div class="mb-head">Talk to this article</div>` +
    `<div class="mb-sub">Tap a phone. Ask anything about <strong>${t}</strong>. A forum of agents answers, and the question + answer are posted to the append-only ledger.</div>` +
    `<div class="mb-cards">` +
    `<button type="button" class="mb-card mb-imsg" data-chat="imessage">` +
    `<div class="mb-chat"><div class="mb-row them"><span class="mb-bub">${t} — how do I use it?</span></div>` +
    `<div class="mb-row me"><span class="mb-bub">Here is the exact call + a receipt link…</span></div></div>` +
    `<div class="mb-cta"><span class="mb-glyph mb-glyph-imsg"></span>Ask via iMessage<span class="mb-num">agent forum</span></div>` +
    `</button>` +
    `<button type="button" class="mb-card mb-wa" data-chat="whatsapp">` +
    `<div class="mb-chat mb-chat-wa"><div class="mb-row them"><span class="mb-bub">ask: ${t}</span></div>` +
    `<div class="mb-row me"><span class="mb-bub">✓✓ answered, receipted, ledgered</span></div></div>` +
    `<div class="mb-cta"><span class="mb-glyph mb-glyph-wa">✆</span>Ask via WhatsApp<span class="mb-num">agent forum</span></div>` +
    `</button>` +
    `</div>` +
    `<div class="mb-foot">Questions queue for the coding-agent forum (one answer per cron tick). Real phone instead: <a href="${esc(smsHref)}">iMessage ${esc(BUILD_NUMBER)}</a> · <a href="${esc(waHref)}" target="_blank" rel="noopener">WhatsApp</a>. Thread + proof: <a href="/api/user-entry?subject=${esc(slug)}">JSON</a> · <a href="/api/articles/${esc(slug)}/ledger">ledger</a>.</div>` +
    `<script>(function(){
var SLUG=${sj};
var box=document.getElementById('ms-msgbuild'); if(!box||box.dataset.wired)return; box.dataset.wired='1';
var poll=null;
function el(t,c,txt){var e=document.createElement(t); if(c)e.className=c; if(txt!=null)e.textContent=txt; return e;}
function close(){var m=document.getElementById('ms-chatmodal'); if(m)m.remove(); if(poll){clearInterval(poll);poll=null;} document.body.style.overflow='';}
function bubble(side,text,label){var row=el('div','cm-row cm-'+side); var b=el('div','cm-bub',text); if(label){var l=el('div','cm-label',label); row.appendChild(l);} row.appendChild(b); return row;}
function loadThread(pane,skin){
  fetch('/api/user-entry?subject='+encodeURIComponent(SLUG)+'&limit=50').then(function(r){return r.json();}).then(function(j){
    var rows=(j.entries||[]).filter(function(e){return /^(question|answer)/i.test(e.context||'');});
    rows.sort(function(a,b){return String(a.ts).localeCompare(String(b.ts));});
    pane.innerHTML='';
    var hello=el('div','cm-sys',skin==='whatsapp'?'Messages are answered by the build\\u2019s agent forum and posted to the hash-chained ledger':'The build\\u2019s agent forum answers here \\u00b7 every message is ledgered');
    pane.appendChild(hello);
    rows.forEach(function(e){
      if(/^question/i.test(e.context)) pane.appendChild(bubble('me',e.text,e.author&&e.author!=='anonymous'?e.author:null));
      else pane.appendChild(bubble('them',e.text,(e.author||'').replace(/^forum:/,'')||'forum'));
    });
    if(!rows.length) pane.appendChild(el('div','cm-sys','No questions yet \\u2014 be the first.'));
    pane.scrollTop=pane.scrollHeight;
  }).catch(function(){});
}
function open(skin){
  close();
  document.body.style.overflow='hidden';
  var ov=el('div',null); ov.id='ms-chatmodal'; ov.className='cm-overlay cm-skin-'+skin;
  var phone=el('div','cm-phone');
  var top=el('div','cm-top');
  var back=el('button','cm-close'); back.type='button'; back.textContent='\\u2715'; back.onclick=close;
  var av=el('div','cm-av','MS');
  var who=el('div','cm-who'); who.appendChild(el('div','cm-name','miscsubjects build'));
  who.appendChild(el('div','cm-status',skin==='whatsapp'?'online \\u00b7 agent forum':'Agent Forum \\u00b7 '+SLUG));
  top.appendChild(back); top.appendChild(av); top.appendChild(who);
  var pane=el('div','cm-pane');
  var barwrap=el('div','cm-inputbar');
  var inp=el('textarea','cm-input'); inp.rows=1; inp.placeholder=skin==='whatsapp'?'Message':'Ask about this article\\u2026';
  var send=el('button','cm-send'); send.type='button'; send.innerHTML='\\u2191';
  function doSend(){
    var text=inp.value.trim(); if(!text)return;
    send.disabled=true;
    pane.appendChild(bubble('me',text,null));
    pane.scrollTop=pane.scrollHeight;
    inp.value='';
    fetch('/api/user-entry',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({subject:SLUG,context:'question:'+skin+'-widget',text:text,author:'reader',source_url:location.href})})
      .then(function(r){return r.json();}).then(function(j){
        var s=el('div','cm-sys',j.ok?('Queued for the agent forum (entry #'+j.id+', task #'+(j.forum_queued||'?')+') \\u2014 the answer appears here and in the ledger, usually within a minute.'):'Failed to send \\u2014 try again.');
        pane.appendChild(s); pane.scrollTop=pane.scrollHeight; send.disabled=false;
      }).catch(function(){send.disabled=false;});
  }
  send.onclick=doSend;
  inp.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend();}});
  barwrap.appendChild(inp); barwrap.appendChild(send);
  phone.appendChild(top); phone.appendChild(pane); phone.appendChild(barwrap);
  ov.appendChild(phone);
  ov.addEventListener('click',function(e){if(e.target===ov)close();});
  document.addEventListener('keydown',function esc(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',esc);}});
  document.body.appendChild(ov);
  loadThread(pane,skin);
  poll=setInterval(function(){loadThread(pane,skin);},15000);
  setTimeout(function(){inp.focus();},150);
}
box.querySelectorAll('.mb-card').forEach(function(c){c.addEventListener('click',function(){open(c.getAttribute('data-chat'));});});
})();</script>` +
    `</section>`;
}

// ── The voxel constellation: the protocol as a living star map ───────────────
const VOX_KIND = {
  actor:    { c: '#f59e0b', glow: '#fcd34d' },
  endpoint: { c: '#16324f', glow: '#60a5fa' },
  table:    { c: '#0e7490', glow: '#67e8f9' },
  runner:   { c: '#7c3aed', glow: '#c4b5fd' },
  verb:     { c: '#db2777', glow: '#f9a8d4' },
  layer:    { c: '#059669', glow: '#6ee7b7' },
  surface:  { c: '#d97706', glow: '#fde68a' },
  loop:     { c: '#dc2626', glow: '#fca5a5' },
};

// Hand-set positions in a 960×560 sky. Center sun = dispatch.
const VOX_POS = {
  caller:            [92, 280],
  dispatch:          [330, 280],
  directory:         [560, 190],
  runner_fn:         [800, 66],
  runner_http:       [856, 140],
  runner_mac:        [884, 220],
  runner_model:      [856, 300],
  runner_agent:      [800, 372],
  events:            [430, 470],
  invocations:       [590, 448],
  receipt:           [736, 480],
  confirm:           [850, 448],
  replay:            [700, 402],
  repair:            [812, 402],
  capability:        [220, 420],
  tenant:            [96, 458],
  ask:               [180, 128],
  orient:            [96, 196],
  conformance:       [330, 66],
  article_human:     [520, 66],
  article_machine:   [640, 118],
  review_loop:       [478, 128],
  oip_articles_table:[610, 20],
};

function voxLabel(label) {
  const t = String(label || '').split('—')[0].split('(')[0].trim();
  return t.length > 22 ? t.slice(0, 21) + '…' : t;
}

/** Render the OIP voxel graph as a glowing constellation SVG. Pure server-side. */
export function renderVoxelConstellation(graph) {
  if (!graph || !Array.isArray(graph.nodes)) return '';
  const nodes = graph.nodes;
  const edges = graph.edges || [];
  const pos = { ...VOX_POS };
  let spare = 0;
  for (const n of nodes) if (!pos[n.id]) { pos[n.id] = [120 + (spare % 6) * 140, 530]; spare++; }

  const edgePaths = edges.map((e, i) => {
    const a = pos[e.from], b = pos[e.to];
    if (!a || !b) return '';
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - 26;
    return `<path class="vx-edge" d="M${a[0]},${a[1]} Q${mx},${my} ${b[0]},${b[1]}"/>` +
      `<text class="vx-rel"><textPath href="#vxe${i}" startOffset="50%">${esc(e.rel.replace(/_/g, ' '))}</textPath></text>` +
      `<path id="vxe${i}" fill="none" stroke="none" d="M${a[0]},${a[1]} Q${mx},${my} ${b[0]},${b[1]}"/>`;
  }).join('');

  const nodeDots = nodes.map((n) => {
    const p = pos[n.id];
    const k = VOX_KIND[n.kind] || VOX_KIND.verb;
    const r = n.id === 'dispatch' ? 26 : (n.kind === 'endpoint' || n.kind === 'actor' ? 15 : 11);
    const label = esc(voxLabel(n.label));
    const kind = esc(n.kind);
    const halo = n.id === 'dispatch' ? `<circle class="vx-halo" cx="${p[0]}" cy="${p[1]}" r="40" fill="url(#vxsun)"/>` : '';
    const core = `<circle class="vx-node vx-${kind}" cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${k.c}" data-glow="${k.glow}">` +
      `<title>${esc(n.label)}${n.url ? ' — ' + esc(n.url) : ''}</title></circle>`;
    const ty = p[1] + r + 15;
    const txt = `<text class="vx-lab" x="${p[0]}" y="${ty}">${label}</text>`;
    const wrap = n.url ? `<a href="${esc(n.url)}" target="_blank" rel="noopener">${halo + core + txt}</a>` : halo + core + txt;
    return `<g class="vx-g">${wrap}</g>`;
  }).join('');

  const legend = Object.entries(VOX_KIND).map(([k, v]) =>
    `<span class="vx-leg"><i style="background:${v.c}"></i>${esc(k)}</span>`).join('');

  return `<section class="voxsky">` +
    `<div class="vx-head"><span class="vx-title">The protocol, as a constellation</span>` +
    `<span class="vx-meta">${nodes.length} voxels · ${edges.length} relations · <a href="/api/articles/oip/voxels">machine JSON</a></span></div>` +
    `<div class="vx-frame"><svg viewBox="0 0 960 560" role="img" aria-label="OIP voxel graph: every node is a live part of the protocol; every edge is the literal relation between parts">` +
    `<defs>` +
    `<radialGradient id="vxsun"><stop offset="0%" stop-color="#60a5fa" stop-opacity=".55"/><stop offset="100%" stop-color="#60a5fa" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="vxsky" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0b1220"/><stop offset="55%" stop-color="#101a30"/><stop offset="100%" stop-color="#1a1030"/></linearGradient>` +
    `</defs>` +
    `<rect width="960" height="560" rx="18" fill="url(#vxsky)"/>` +
    `<g class="vx-stars">${Array.from({ length: 70 }, (_, i) => {
      const x = (i * 137) % 960, y = (i * 89 + 31) % 560, o = 0.1 + ((i * 7) % 10) / 28;
      return `<circle cx="${x}" cy="${y}" r="${(i % 3) * 0.5 + 0.5}" fill="#e2e8f0" opacity="${o}"/>`;
    }).join('')}</g>` +
    edgePaths + nodeDots +
    `</svg></div>` +
    `<div class="vx-legend">${legend}</div>` +
    `<div class="vx-read">Machine reading order: ${esc((graph.machine_reading_order || []).join(' → '))}</div>` +
    `</section>`;
}

// ── CSS for everything above + the tech-site rail cards ─────────────────────
export function oipWidgetStyles(ink, line, accent) {
  return `
/* ── code jewels ─────────────────────────────────────────── */
.codeblock{margin:1.5rem 0;border-radius:12px;overflow:hidden;border:1px solid #d8d8d8;background:#fff}
.cb-bar,.cb-foldbar{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f5f5f5;border-bottom:1px solid #d8d8d8}
.cb-foldbar{cursor:pointer;list-style:none;border-bottom:0}
.cb-fold[open] .cb-foldbar{border-bottom:1px solid #1e293b}
.cb-foldbar::-webkit-details-marker{display:none}
.cb-foldhint{margin-left:auto;font:600 11px/1 ui-sans-serif,system-ui,sans-serif;color:#64748b;letter-spacing:.08em;text-transform:uppercase}
.cb-fold[open] .cb-foldhint{display:none}
.cb-dots{display:inline-flex;gap:6px}
.cb-dots i{width:10px;height:10px;border-radius:50%;display:block}
.cb-dots i:nth-child(1){background:#ff5f57}.cb-dots i:nth-child(2){background:#febc2e}.cb-dots i:nth-child(3){background:#28c840}
.cb-lang{font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#000;letter-spacing:.1em;text-transform:uppercase}
.cb-copy{margin-left:auto;border:1px solid #bbb;background:#fff;color:#000;font:600 11px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.06em;border-radius:8px;padding:6px 12px;cursor:pointer;transition:all .15s}
.cb-copy:hover{background:#000;color:#fff;border-color:#000}
.cb-copy.done{background:#059669;border-color:#059669;color:#fff}
.cb-pre{margin:0;padding:16px 18px;overflow-x:auto;font:13.5px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;color:#111;background:#fff}
.cb-pre code{background:none;padding:0;font:inherit;color:inherit}
.cj-k{color:#000;font-weight:600}.cj-s,.cj-n,.cj-b,.cj-v,.cj-u{color:#444}.cj-c{color:#767676;font-style:italic}
/* ── message the build ───────────────────────────────────── */
.msgbuild{margin:2.5rem 0;padding:26px 24px 20px;border-radius:16px;position:relative;background:#fff;border:1px solid ${line};overflow:hidden}
.msgbuild::before{content:"";position:absolute;inset:0 0 auto 0;height:4px;background:${accent};border-radius:20px 20px 0 0}
.mb-head{font:700 clamp(20px,3vw,26px)/1.12 var(--font-display);text-transform:uppercase;letter-spacing:.01em;color:${ink}}
.mb-sub{font:15px/1.6 ui-sans-serif,system-ui,sans-serif;color:#555;margin:8px 0 18px;max-width:56ch}
.mb-cards{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:660px){.mb-cards{grid-template-columns:1fr 1fr}}
.mb-card{display:block;text-decoration:none;border-radius:16px;padding:16px 16px 14px;border:1px solid ${line};background:#fff;transition:transform .18s ease,box-shadow .18s ease}
.mb-card:hover{transform:translateY(-3px);box-shadow:0 18px 44px -20px rgba(15,23,42,.35)}
.mb-chat{display:flex;flex-direction:column;gap:8px;padding:6px 2px 14px}
.mb-row{display:flex}
.mb-row.me{justify-content:flex-end}
.mb-bub{max-width:86%;padding:9px 14px;border-radius:18px;font:14.5px/1.45 -apple-system,BlinkMacSystemFont,ui-sans-serif,sans-serif}
.mb-imsg .mb-row.them .mb-bub{background:#e9e9eb;color:#111;border-bottom-left-radius:5px}
.mb-imsg .mb-row.me .mb-bub{background:linear-gradient(180deg,#3b9cff,#0a84ff);color:#fff;border-bottom-right-radius:5px}
.mb-wa .mb-chat-wa{background:#e5ddd5 url() ;border-radius:12px;padding:12px 10px}
.mb-wa .mb-row.them .mb-bub{background:#fff;color:#111;border-top-left-radius:4px;box-shadow:0 1px 1px rgba(0,0,0,.08)}
.mb-wa .mb-row.me .mb-bub{background:#d9fdd3;color:#111;border-top-right-radius:4px;box-shadow:0 1px 1px rgba(0,0,0,.08)}
.mb-cta{display:flex;align-items:center;gap:10px;font:700 15px/1 ui-sans-serif,system-ui,sans-serif;color:${ink};padding-top:12px;border-top:1px dashed ${line}}
.mb-glyph{width:30px;height:30px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:15px}
.mb-glyph-imsg{background:linear-gradient(180deg,#5ac8fa,#0a84ff)}
.mb-glyph-imsg::before{content:"💬"}
.mb-glyph-wa{background:linear-gradient(180deg,#3ddc68,#25d366)}
.mb-num{margin-left:auto;font:600 12px/1 ui-monospace,Menlo,monospace;color:#757579}
.mb-foot{font:12.5px/1.6 ui-sans-serif,system-ui,sans-serif;color:#757579;margin-top:14px}
.mb-foot a{color:${accent}}
/* ── the chat modal: a phone in the page ─────────────────── */
.mb-card{cursor:pointer;text-align:left;font:inherit;width:100%}
.cm-overlay{position:fixed;inset:0;z-index:9999;background:rgba(10,12,20,.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:18px;animation:cmfade .18s ease}
@keyframes cmfade{from{opacity:0}to{opacity:1}}
.cm-phone{width:min(420px,100%);height:min(720px,92vh);border-radius:34px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 40px 120px -30px rgba(0,0,0,.7),0 0 0 10px #0b0d12,0 0 0 12px #2a2d36;animation:cmpop .22s cubic-bezier(.2,.9,.3,1.2)}
@keyframes cmpop{from{transform:translateY(24px) scale(.96);opacity:0}to{transform:none;opacity:1}}
.cm-top{display:flex;align-items:center;gap:10px;padding:14px 14px 10px}
.cm-close{border:0;background:rgba(120,120,128,.16);color:inherit;width:30px;height:30px;border-radius:50%;font-size:13px;cursor:pointer;flex:none}
.cm-av{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 14px ui-sans-serif,system-ui,sans-serif;flex:none}
.cm-name{font:700 15px/1.2 -apple-system,BlinkMacSystemFont,ui-sans-serif,sans-serif}
.cm-status{font:12px/1.3 -apple-system,ui-sans-serif,sans-serif;opacity:.65}
.cm-pane{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:7px}
.cm-row{display:flex;flex-direction:column;align-items:flex-start;max-width:100%}
.cm-me{align-items:flex-end}
.cm-bub{max-width:82%;padding:9px 13px;border-radius:18px;font:15px/1.4 -apple-system,BlinkMacSystemFont,ui-sans-serif,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere}
.cm-label{font:600 10.5px ui-sans-serif,sans-serif;opacity:.55;margin:2px 6px}
.cm-sys{align-self:center;text-align:center;font:11.5px/1.5 ui-sans-serif,sans-serif;opacity:.6;max-width:86%;margin:6px 0}
.cm-inputbar{display:flex;align-items:flex-end;gap:8px;padding:10px 12px 14px}
.cm-input{flex:1;resize:none;border-radius:18px;padding:9px 14px;font:15px/1.4 -apple-system,ui-sans-serif,sans-serif;outline:none;max-height:96px}
.cm-send{width:34px;height:34px;border-radius:50%;border:0;color:#fff;font-size:17px;font-weight:700;cursor:pointer;flex:none}
.cm-send:disabled{opacity:.5}
/* iMessage skin */
.cm-skin-imessage .cm-phone{background:#fff}
.cm-skin-imessage .cm-top{background:rgba(249,249,249,.94);border-bottom:.5px solid #d1d1d6;color:#111}
.cm-skin-imessage .cm-av{background:linear-gradient(180deg,#9ca3af,#6b7280);color:#fff}
.cm-skin-imessage .cm-pane{background:#fff}
.cm-skin-imessage .cm-them .cm-bub{background:#e9e9eb;color:#111;border-bottom-left-radius:5px}
.cm-skin-imessage .cm-me .cm-bub{background:linear-gradient(180deg,#3b9cff,#0a84ff);color:#fff;border-bottom-right-radius:5px}
.cm-skin-imessage .cm-inputbar{background:rgba(249,249,249,.94);border-top:.5px solid #d1d1d6}
.cm-skin-imessage .cm-input{background:#fff;border:1px solid #d1d1d6;color:#111}
.cm-skin-imessage .cm-send{background:#0a84ff}
/* WhatsApp skin */
.cm-skin-whatsapp .cm-phone{background:#efeae2}
.cm-skin-whatsapp .cm-top{background:#075e54;color:#fff}
.cm-skin-whatsapp .cm-close{background:rgba(255,255,255,.18);color:#fff}
.cm-skin-whatsapp .cm-av{background:#25d366;color:#053d33}
.cm-skin-whatsapp .cm-pane{background:#efeae2;background-image:radial-gradient(rgba(0,0,0,.028) 1.5px,transparent 1.5px);background-size:22px 22px}
.cm-skin-whatsapp .cm-them .cm-bub{background:#fff;color:#111;border-top-left-radius:4px;box-shadow:0 1px 1px rgba(0,0,0,.08)}
.cm-skin-whatsapp .cm-me .cm-bub{background:#d9fdd3;color:#111;border-top-right-radius:4px;box-shadow:0 1px 1px rgba(0,0,0,.08)}
.cm-skin-whatsapp .cm-sys{background:#fdf3c7;border-radius:8px;padding:5px 10px;opacity:.9;color:#5b5344;box-shadow:0 1px 1px rgba(0,0,0,.06)}
.cm-skin-whatsapp .cm-inputbar{background:#f0f2f5}
.cm-skin-whatsapp .cm-input{background:#fff;border:1px solid #e2e2e2;color:#111}
.cm-skin-whatsapp .cm-send{background:#25d366}
/* ── voxel constellation ─────────────────────────────────── */
.voxsky{margin:calc(var(--u)*2.2) 0}
.vx-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;margin-bottom:12px}
.vx-title{font:700 clamp(20px,3vw,26px)/1.1 var(--font-display);text-transform:uppercase;letter-spacing:.01em;color:${accent}}
.vx-meta{font:600 12.5px/1 ui-sans-serif,system-ui,sans-serif;color:#757579;margin-left:auto}
.vx-meta a{color:${accent}}
.vx-frame{border-radius:20px;overflow:hidden;box-shadow:0 24px 70px -28px rgba(2,6,23,.65);border:1px solid #1e293b}
.vx-frame svg{display:block;width:100%;height:auto}
.vx-edge{fill:none;stroke:#475569;stroke-width:1.1;stroke-dasharray:5 5;opacity:.5;animation:vxflow 30s linear infinite}
@keyframes vxflow{to{stroke-dashoffset:-600}}
.vx-rel{font:italic 9.5px Georgia,serif;fill:#94a3b8;text-anchor:middle;opacity:.85}
.vx-node{stroke:#0b1220;stroke-width:2;cursor:pointer;transition:filter .2s}
.vx-g:hover .vx-node{filter:drop-shadow(0 0 8px currentColor) brightness(1.25)}
.vx-halo{animation:vxpulse 4.5s ease-in-out infinite}
@keyframes vxpulse{0%,100%{opacity:.65}50%{opacity:1}}
.vx-lab{font:600 10.5px ui-sans-serif,system-ui,sans-serif;fill:#e2e8f0;text-anchor:middle}
.vx-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px}
.vx-leg{display:inline-flex;align-items:center;gap:6px;font:600 11.5px/1 ui-sans-serif,system-ui,sans-serif;color:#666;text-transform:capitalize}
.vx-leg i{width:10px;height:10px;border-radius:50%;display:inline-block}
.vx-read{font:12.5px/1.6 ui-monospace,Menlo,monospace;color:#757579;margin-top:8px}
/* ── tech-site rail cards (GitHub / HN / SO / arXiv / Discord) ── */
.rp-gh{background:#fff;border:1px solid #d8d8d8}
.rp-gh .rp-body{display:block;padding:14px 16px;text-decoration:none;color:#000}
.rp-gh-top{display:flex;align-items:center;gap:8px;font:600 13px/1 ui-sans-serif,system-ui,sans-serif;color:#6f767e}
.rp-gh-logo{width:20px;height:20px;fill:#e6edf3}
.rp-gh-repo{color:#305a8a;font-weight:700}
.rp-gh-title{font:700 16px/1.35 ui-sans-serif,system-ui,sans-serif;color:#000;margin:10px 0 6px}
.rp-gh-body{font:13.5px/1.5 ui-sans-serif,system-ui,sans-serif;color:#53595f}
.rp-gh-meta{display:flex;gap:14px;font:12px/1 ui-sans-serif,system-ui,sans-serif;color:#6f767e;margin-top:12px}
.rp-gh-lang i{width:9px;height:9px;border-radius:50%;background:#f1e05a;display:inline-block;margin-right:5px}
.rp-hn{background:#f6f6ef;border:1px solid #e0e0d0}
.rp-hn .rp-body{display:block;padding:0;text-decoration:none;color:#000}
.rp-hn-bar{background:#ff6600;padding:8px 12px;display:flex;align-items:center;gap:8px}
.rp-hn-y{width:18px;height:18px;border:1.5px solid #fff;color:#fff;font:700 12px/16px ui-sans-serif,sans-serif;text-align:center}
.rp-hn-site{font:700 13px/1 Verdana,ui-sans-serif,sans-serif;color:#fff}
.rp-hn-title{font:600 15px/1.4 Verdana,ui-sans-serif,sans-serif;color:#000;padding:12px 14px 4px}
.rp-hn-meta{font:11.5px/1.5 Verdana,ui-sans-serif,sans-serif;color:#707070;padding:0 14px 12px}
.rp-so{background:#fff;border:1px solid #d6d9dc}
.rp-so .rp-body{display:flex;gap:12px;padding:14px;text-decoration:none;color:#232629}
.rp-so-stats{display:flex;flex-direction:column;gap:6px;min-width:58px}
.rp-so-stat{border:1px solid #d6d9dc;border-radius:6px;text-align:center;padding:5px 4px;font:700 13px/1.1 ui-sans-serif,sans-serif;color:#3b4045}
.rp-so-stat.rp-so-acc{background:#48a868;border-color:#48a868;color:#fff}
.rp-so-stat small{display:block;font:400 10px/1 ui-sans-serif,sans-serif;margin-top:3px}
.rp-so-title{font:600 15.5px/1.4 ui-sans-serif,sans-serif;color:#005a9f;margin-bottom:6px}
.rp-so-body{font:13px/1.5 ui-sans-serif,sans-serif;color:#3b4045}
.rp-so-tags{margin-top:8px;display:flex;gap:6px;flex-wrap:wrap}
.rp-so-tag{background:#e1ecf4;color:#376e97;border-radius:4px;padding:3px 8px;font:12px/1 ui-sans-serif,sans-serif}
.rp-ax{background:#fff;border:1px solid #e2e2e2;border-left:5px solid #b31b1b}
.rp-ax .rp-body{display:block;padding:14px 16px;text-decoration:none;color:#111}
.rp-ax-mast{font:700 15px/1 Georgia,serif;color:#b31b1b}
.rp-ax-id{font:12px/1 ui-monospace,Menlo,monospace;color:#767676;margin-left:8px}
.rp-ax-title{font:700 16.5px/1.35 Georgia,serif;color:#111;margin:10px 0 6px}
.rp-ax-abs{font:13.5px/1.55 Georgia,serif;color:#444}
.rp-ax-auth{font:italic 13px/1.4 Georgia,serif;color:#666;margin-top:8px}
.rp-dc{background:#fff;border:1px solid #d8d8d8}
.rp-dc .rp-body{display:flex;gap:12px;padding:14px 16px;text-decoration:none;color:#000}
.rp-dc-av{width:40px;height:40px;border-radius:50%;background:#5865f2;color:#fff;display:flex;align-items:center;justify-content:center;font:700 16px ui-sans-serif,sans-serif;flex:none}
.rp-dc-name{font:700 15px/1 ui-sans-serif,sans-serif;color:#000}
.rp-dc-time{font:11px/1 ui-sans-serif,sans-serif;color:#70767d;margin-left:8px}
.rp-dc-text{font:14px/1.5 ui-sans-serif,sans-serif;color:#333;margin-top:5px}
.rp-dc-chan{font:600 12px/1 ui-sans-serif,sans-serif;color:#70767d;margin-top:8px}
`;
}
