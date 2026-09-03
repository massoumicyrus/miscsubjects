import { capabilityConsoleWidget } from "../_lib/unified_handoff.js";
import { designLawStyles } from "../_lib/design_law.js";

export const BRAND = "miscsubjects.com";
export const STATUS_PILLS = ["live", "D1+KV+R2", "access-gated"];

// Nav order is binding: Directory (#1) then Ledger (#2) — the chronological stream.
// Agents is not a primary tab; CLI/API turns live in the ledger Events + State cards views.
export const PRIMARY_TABS = [
  { href: "/admin/directory", label: "Directory" },
  { href: "/admin/prompts", label: "Prompts" },
  { href: "/admin/articles", label: "Articles" },
  { href: "/admin/ledger", label: "Ledger" },
  { href: "/admin/sheets", label: "Sheets" },
  { href: "/admin/directory/models", label: "Models" },
  { href: "/admin/map", label: "Map" },
  { href: "/admin/loop", label: "Loop" },
  { href: "/admin/content-map", label: "Content" },
  { href: "/admin/models-catalog", label: "Model Catalog" },
  { href: "/admin/vault", label: "Vault" },
  { href: "/admin/owner", label: "Owner" },
  { href: "/admin/dojo", label: "Dojo" },
  { href: "/admin/tasks", label: "Tasks" },
  { href: "/admin/assets", label: "Assets" },
  { href: "/admin/generate", label: "Generate" },
  { href: "/admin/cloaker", label: "Cloaker" },
  { href: "/admin/marketing", label: "Marketing" },
  { href: "/admin/traffic", label: "Traffic" },
  { href: "/admin/selftest", label: "Self-Test" },
  { href: "/admin/attention", label: "Attention" },
  { href: "/admin/outbox", label: "Outbox" },
];

export const SECONDARY_TABS = [];

export const TERTIARY_TABS = [];

export const SUB_ROW = [];

export const CATEGORY_COLOR = {
  router: "#74d7ff",
  llm: "#ff7bd1",
  stripe: "#a3ffb0",
  blooio: "#9dffb0",
  meta: "#ffd479",
  kv: "#ffae8a",
  r2: "#c0a8ff",
  d1: "#74c4ff",
  pages: "#79e0d6",
  settings: "#c8d8e8",
  directory: "#a3c2ff",
  log: "#9aa7ba",
  tasks: "#e9ffae",
  self_mod: "#ff9a9a",
  util: "#dedede",
  flow: "#e1c7ff",
  cloudflare: "#f48120",
};

export const COMMON_STYLE = `${designLawStyles()}
:root{
  --bg:#fff;
  --panel:#fafafa;
  --raised:#f3f3f3;
  --ink:#000;
  --ink-soft:#333;
  --muted:#666;
  --line:#e2e2e2;
  --line-strong:#c8c8c8;
  --accent:#000;
  --accent-soft:rgba(0,0,0,.06);
  --hover:#f5f5f5;
  --warn-bg:#fff8e6;
  --warn-border:#d8b34f;
  --warn-ink:#4a3900;
  --sans:'Inter','Helvetica Neue',Arial,system-ui,sans-serif;
  --mono:'JetBrains Mono','Menlo',monospace;
  --serif:'Source Sans 3','Helvetica Neue',Arial,system-ui,sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--bg);color:var(--ink)}
body{font-family:var(--sans);font-size:15px;line-height:1.6;min-height:100vh;-webkit-font-smoothing:antialiased}

header{position:sticky;top:0;background:rgba(255,255,255,.96);backdrop-filter:saturate(140%) blur(18px);border-bottom:1px solid var(--line);z-index:10}
.brand-row{display:flex;align-items:center;gap:16px;padding:14px 24px 8px;min-height:62px}
.brand{display:flex;align-items:center;gap:10px;font-family:var(--serif);font-size:21px;color:var(--ink);font-weight:600;letter-spacing:.01em}
.brand a{color:inherit;text-decoration:none}
.brand .dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#000;box-shadow:0 0 0 4px var(--accent-soft)}
.status{display:flex;align-items:center;gap:10px;font-size:10px;color:var(--muted);font-weight:600;font-family:var(--mono);letter-spacing:.1em;text-transform:uppercase}
.status .sep{color:var(--line-strong)}
.hdr-search{margin-left:auto;flex:0 1 360px;display:flex}
.hdr-search input{width:100%;font-size:13px;padding:8px 12px;border:1px solid var(--line-strong);border-radius:8px;background:var(--panel);color:var(--ink)}
.hdr-search input::placeholder{color:var(--muted)}
.hdr-search input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}

.tab-row{display:flex;align-items:center;flex-wrap:wrap;gap:4px;padding:5px 24px 10px;overflow:visible}
.tab-row a{flex:0 0 auto;padding:8px 10px;color:var(--ink-soft);text-decoration:none;font-size:12px;border-bottom:2px solid transparent;font-weight:600}
.tab-row a.primary{color:var(--ink);font-weight:600}
.tab-row a.secondary{color:var(--ink-soft);font-weight:500}
.tab-row a.tertiary{color:var(--muted);font-weight:400}
.tab-row a:hover{color:#000;border-bottom-color:#000;text-decoration:none;background:var(--hover)}
.tab-row a.active{color:#000;border-bottom-color:#000;background:var(--accent-soft)}
.tab-row .pipe{color:var(--line-strong);padding:0 10px;font-size:13px;align-self:center}

.sub-row{display:flex;gap:0;padding:4px 24px 10px;border-top:1px solid var(--line)}
.sub-row a{padding:6px 12px;color:var(--muted);text-decoration:none;font-size:13px}
.sub-row a:hover{color:var(--accent);text-decoration:none}
.sub-row a.active{color:var(--accent)}

main{padding:24px 28px 64px;max-width:var(--measure-wide);margin:0 auto}
h1{font-family:var(--serif);font-size:clamp(2.1rem,3vw,3.25rem);font-weight:700;line-height:1.15;color:var(--ink);margin:10px 0 12px;letter-spacing:-.02em;max-width:28ch}
h2{font-family:var(--serif);font-size:1.55rem;font-weight:700;color:var(--ink);margin:24px 0 8px;letter-spacing:-.01em}
h3{font-size:14px;font-weight:600;color:var(--ink);margin:16px 0 6px}
p{margin:6px 0}
.subtitle{font-size:14px;color:var(--ink-soft);margin-bottom:16px;line-height:1.6;max-width:1100px}

.banner{border:1px solid var(--warn-border);background:var(--warn-bg);color:var(--warn-ink);padding:12px 16px;border-radius:8px;font-size:13px;margin-bottom:18px;line-height:1.55}
.banner code{color:var(--warn-ink);background:rgba(0,0,0,.06);padding:1px 5px;border-radius:3px;font-size:13px}

table{width:100%;border-collapse:collapse;font-size:14px;background:var(--bg)}
th{background:var(--panel);border-bottom:2px solid var(--line-strong);border-top:1px solid var(--line);padding:10px 12px;text-align:left;color:var(--ink);font-weight:600;white-space:nowrap;position:sticky;top:120px;letter-spacing:.02em}
td{border-bottom:1px solid var(--line);padding:9px 12px;color:var(--ink-soft);vertical-align:top;word-break:break-word;max-width:560px;line-height:1.45}
tr:hover td{background:var(--hover)}

.cat-chip{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;color:#0c0e12;border:1px solid rgba(0,0,0,.18)}
.type-chip{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-family:var(--mono);background:var(--raised);color:var(--ink-soft);font-weight:600;white-space:nowrap}
.empty{padding:18px;color:var(--muted);font-size:14px}

a{color:#000;text-decoration:underline;text-underline-offset:3px}
a:hover{text-decoration-thickness:2px}

code{font-family:var(--mono);background:var(--raised);color:var(--ink);padding:1px 6px;border-radius:3px;font-size:13px}

button{padding:8px 16px;border-radius:6px;border:1px solid var(--line-strong);background:var(--panel);color:var(--ink);font-family:var(--sans);font-size:13px;font-weight:500;cursor:pointer}
button:hover{background:var(--hover);border-color:var(--accent);color:var(--accent)}

input[type=text],input[type=number],input:not([type]),select,textarea{
  background:var(--panel);border:1px solid var(--line-strong);color:var(--ink);
  font-family:var(--sans);font-size:14px;padding:7px 10px;border-radius:6px;outline:none
}
input::placeholder,textarea::placeholder{color:var(--muted)}
input:focus,select:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
textarea{resize:vertical;min-height:120px;line-height:1.5;font-family:var(--mono);font-size:13px}
pre{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 12px;font-family:var(--mono);font-size:12.5px;color:var(--ink);white-space:pre-wrap;word-break:break-word;line-height:1.55}

/* ── JSON viewer ── */
.json-viewer{background:#fff;border:1px solid var(--line);border-radius:8px;padding:0;overflow:hidden;color:var(--ink-soft);font-family:var(--mono);font-size:12px;line-height:1.6;position:relative}
.json-viewer .jv-bar{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--panel);border-bottom:1px solid var(--line);font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.08em}
.json-viewer .jv-bar .jv-type{margin-left:auto;font-size:10px;color:var(--muted);text-transform:none;letter-spacing:0}
.json-viewer pre{margin:0;padding:12px 14px;background:#fff;color:var(--ink-soft);font-size:12px;max-height:480px;overflow:auto;border:none;border-radius:0;white-space:pre-wrap;word-break:break-word;line-height:1.6}
.json-viewer .jv-key{color:#000;font-weight:600}
.json-viewer .jv-string,.json-viewer .jv-number,.json-viewer .jv-bool,.json-viewer .jv-null{color:#444}

/* ── copy button ── */
.copy-btn{position:absolute;top:6px;right:8px;padding:3px 10px;border-radius:5px;border:1px solid var(--line);background:var(--raised);color:var(--muted);font-size:10px;font-family:var(--mono);font-weight:600;cursor:pointer;opacity:0;transition:opacity .15s}
.copy-btn:hover{background:var(--hover);color:var(--ink);border-color:var(--line-strong)}
.json-viewer:hover .copy-btn,.term-block:hover .copy-btn,.curl-block:hover .copy-btn{opacity:1}
.copy-btn.ok{background:var(--accent);color:#fff;border-color:var(--accent)}

/* ── terminal block ── */
.term-block{background:#fff;border:1px solid var(--line);border-radius:8px;padding:0;overflow:hidden;position:relative;margin:8px 0}
.term-block .term-bar{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--panel);border-bottom:1px solid var(--line);font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.08em}
.term-block pre{margin:0;padding:10px 12px;background:#fff;color:var(--ink-soft);font-size:12px;border:none;border-radius:0;white-space:pre-wrap;word-break:break-word}
.term-block .term-prompt{color:var(--accent);margin-right:4px;font-weight:700}

/* ── cURL block ── */
.curl-block{background:#fff;border:1px solid var(--line);border-radius:8px;padding:0;overflow:hidden;position:relative;margin:8px 0}
.curl-block .curl-bar{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--panel);border-bottom:1px solid var(--line);font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.08em}
.curl-block pre{margin:0;padding:10px 12px;background:#fff;color:var(--ink-soft);font-size:12px;border:none;border-radius:0;white-space:pre-wrap;word-break:break-word}

/* ── query help panel ── */
.qhelp{border:1px solid var(--line);border-radius:10px;padding:14px 18px;background:var(--panel);margin-bottom:18px}
.qhelp h3{font-size:13px;font-weight:700;margin:0 0 10px;color:var(--ink)}
.qhelp .qrow{display:flex;align-items:center;gap:10px;margin:6px 0;font-size:12px;font-family:var(--mono);flex-wrap:wrap}
.qhelp .qrow .qmethod{padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;color:#0c0e12;text-transform:uppercase}
.qmethod.get{background:#7a9a7b}
.qmethod.post{background:#c9a961}
.qmethod.put{background:#b86b5a}
.qmethod.patch{background:#d8c08a}
.qmethod.delete{background:#96463a;color:#f0ede5}
.qhelp .qpath{color:var(--accent);font-weight:600}
.qhelp .qnote{color:var(--muted);font-size:11px}

/* ── ID pill ── */
.id-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border-radius:99px;font-size:12px;font-weight:700;font-family:var(--mono);color:var(--ink);background:var(--panel);border:1px solid var(--line)}
.id-pill .id-copy{padding:2px 6px;border-radius:4px;border:1px solid var(--line);background:var(--raised);font-size:10px;cursor:pointer;color:var(--muted)}
.id-pill .id-copy:hover{background:var(--accent);color:#fff;border-color:var(--accent)}

/* ── REST badge ── */
.rest-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;color:#0c0e12;text-transform:uppercase}
.rest-badge.get{background:#7a9a7b}
.rest-badge.post{background:#c9a961}
.rest-badge.put{background:#b86b5a}
.rest-badge.patch{background:#d8c08a}
.rest-badge.delete{background:#96463a;color:#f0ede5}

/* ── cheat sheet ── */
.cheatsheet{border:1px solid var(--line);border-radius:12px;padding:0;overflow:hidden;background:var(--panel);margin-bottom:18px}
.cheatsheet .cs-head{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--raised);border-bottom:1px solid var(--line);font-size:14px;font-weight:700;color:var(--ink)}
.cheatsheet .cs-body{padding:12px 16px}
.cheatsheet .cs-row{display:flex;align-items:flex-start;gap:12px;margin:8px 0;font-size:12px;font-family:var(--mono);flex-wrap:wrap}
.cheatsheet .cs-row .cs-label{min-width:140px;font-weight:700;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em;padding-top:2px}
.cheatsheet .cs-row .cs-code{flex:1;min-width:0;color:var(--ink);background:var(--bg);padding:6px 10px;border-radius:6px;border:1px solid var(--line);white-space:pre-wrap;word-break:break-word}

/* ── expand toggle ── */
.expando{cursor:pointer;font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;border:1px solid var(--line);background:var(--panel);transition:all .1s}
.expando:hover{background:var(--accent-soft);border-color:var(--accent)}
.expando .exp-icon{font-size:10px}

@media(max-width:760px){.brand-row{flex-wrap:wrap}.hdr-search{order:3;flex-basis:100%}.tab-row{flex-wrap:wrap;overflow:visible;padding-inline:14px}.tab-row a{padding:7px 9px}}
`;

function isActive(href, activeHref) {
  if (!activeHref) return false;
  const hrefPath = String(href).split("?")[0].split("#")[0];
  const activePath = String(activeHref).split("?")[0].split("#")[0];
  if (hrefPath === activePath) {
    const hrefQs = String(href).split("?")[1] || "";
    const activeQs = String(activeHref).split("?")[1] || "";
    if (hrefQs && activeQs) return hrefQs === activeQs;
    if (!hrefQs && !activeQs) return true;
    return false;
  }
  return activePath.startsWith(hrefPath + "/");
}

function renderTabs(group, cls, activeHref) {
  const activePath = String(activeHref).split("?")[0].split("#")[0];
  const exactIdx = group.findIndex((item) => {
    const hp = String(item.href).split("?")[0].split("#")[0];
    return hp === activePath;
  });
  return group
    .map((item, i) => {
      const a = (
        exactIdx === -1 ? isActive(item.href, activeHref) : i === exactIdx
      )
        ? " active"
        : "";
      return `<a href="${item.href}" class="${cls}${a}">${item.label}</a>`;
    })
    .join("");
}

export function topNavHtml(activeHref) {
  return renderTabs(PRIMARY_TABS, "admin-link", activeHref);
}

export function subRowHtml(activeHref) {
  return SUB_ROW.map((item) => {
    const a = isActive(item.href, activeHref) ? " active" : "";
    return `<a href="${item.href}" class="${a.trim()}">${item.label}</a>`;
  }).join("");
}

export function shellHtml({ activeHref, title, body }) {
  const pills = STATUS_PILLS.map(
    (p, i) => (i > 0 ? '<span class="sep">·</span>' : "") + `<span>${p}</span>`,
  ).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — ${BRAND}</title>
<style>${COMMON_STYLE}</style>
</head>
<body>
<header>
  <div class="brand-row">
    <div class="brand"><span class="dot"></span><a href="/admin">${BRAND}</a></div>
    <div class="status">${pills}</div>
    <form class="hdr-search" onsubmit="return adminSearch(event)"><input id="hdr-q" type="text" placeholder="Search the ledger — text or trace id"></form>
    <a href="/admin/attention" id="attn-comms" title="Unread comms — email, iMessage, WhatsApp" style="display:none;text-decoration:none;font-size:12px;padding:5px 10px;border-radius:12px;background:#b86b5a;color:#fff;font-weight:700">💬 <span>0</span></a>
    <a href="/admin/attention" id="attn-work" title="Outstanding work — open tasks + GitHub issues" style="display:none;text-decoration:none;font-size:12px;padding:5px 10px;border-radius:12px;background:#c9a961;color:#0c0e12;font-weight:700">⚒ <span>0</span></a>
    <a href="/" title="Back to the public site" style="font-size:12px;padding:5px 10px;text-decoration:none;border:1px solid var(--line,#2a2f3a);border-radius:6px">← View site</a>
    <button id="open-cap-console" title="Open scoped Owner Tap & Go controls" style="font-size:12px;padding:5px 10px">Owner Tap &amp; Go</button>
    <button id="copy-rest" title="Copy this page's REST invocations" style="font-size:12px;padding:5px 10px">⧉ Copy REST</button>
    <button id="logout" title="Sign out of admin on this device" style="font-size:12px;padding:5px 10px">Sign out</button>
  </div>
  <nav class="tab-row" aria-label="Admin navigation">${topNavHtml(activeHref)}</nav>
  <nav class="sub-row">${subRowHtml(activeHref)}</nav>
</header>
<main>${body}</main>
${capabilityConsoleWidget()}
<script>
(function(){
  window.adminSearch=function(e){e.preventDefault();var v=document.getElementById('hdr-q').value.trim();if(v){location.href='/admin/ledger?view=turns&q='+encodeURIComponent(v);}return false;};
  // Attention bubbles: unread comms + outstanding work, on every admin page (owner order
  // 2026-07-30). Poll once per load; badge hidden at zero.
  fetch('/api/attention').then(function(r){return r.json();}).then(function(d){
    var c=document.getElementById('attn-comms'),w=document.getElementById('attn-work');
    if(c&&d.counts&&d.counts.comms>0){c.style.display='inline-block';c.querySelector('span').textContent=d.counts.comms;}
    if(w&&d.counts&&d.counts.work>0){w.style.display='inline-block';w.querySelector('span').textContent=d.counts.work;}
  }).catch(function(){});
  var origFetch=window.fetch;
  window.fetch=function(url,opts){
    opts=opts||{};
    if(!opts.credentials) opts.credentials='same-origin';
    return origFetch(url,opts);
  };
  var logout=document.getElementById('logout');
  if(logout) logout.onclick=function(){
    fetch('/api/admin/logout',{method:'POST',credentials:'same-origin'}).finally(function(){ location.href='/admin/login'; });
  };
  var cap=document.getElementById('open-cap-console');
  if(cap) cap.onclick=function(){
    var c=document.getElementById('ms-cap-console');
    if(c) c.classList.add('open');
  };
  function restBlock(){
    var base=location.origin, p=location.pathname, A={"authorization":"Bearer [MISC]"}, H={"content-type":"application/json","authorization":"Bearer [MISC]"};
    var m=p.match(/^\\/admin\\/directory\\/([^\\/]+)$/);
    if(m && ['new','graph','models'].indexOf(m[1])<0){
      var k=decodeURIComponent(m[1]), u=base+'/api/directory/'+k;
      return JSON.stringify([
        {method:"GET",url:u,headers:A},
        {method:"PUT",url:u,headers:H,body:{type:"agent|http|fn|flow",target:"...",auth:"",content:"...",category:""}},
        {method:"PATCH",url:u,headers:H,body:{content:"..."}},
        {method:"DELETE",url:u,headers:A},
        {method:"POST",url:base+'/api/dispatch',headers:H,body:{key:k,body:"<args>"}}
      ],null,2);
    }
    if(p.indexOf('/admin/ledger')===0) return JSON.stringify({method:"GET",url:base+'/admin/ledger?data=1',headers:A},null,2);
    if(p==='/admin/directory') return JSON.stringify([{method:"GET",url:base+'/api/directory?type=agent',headers:A},{method:"POST",url:base+'/api/directory',headers:H,body:{key:"",type:"agent",content:"..."}}],null,2);
    if(p==='/admin/map') return JSON.stringify({method:"GET",url:base+'/api/map',headers:A},null,2);
    return JSON.stringify({method:"GET",url:base+p+'?data=1',headers:A},null,2);
  }
  var btn=document.getElementById('copy-rest');
  if(btn) btn.onclick=function(){
    var t=restBlock();
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(t).then(function(){btn.textContent='\\u2713 Copied';setTimeout(function(){btn.textContent='\\u29c9 Copy REST';},1200);},function(){window.prompt('REST',t);});
    } else { window.prompt('REST',t); }
  };
  var active=document.querySelector('.tab-row a.active');
  var h1=document.querySelector('main h1');
  if(active&&h1){
    var tab=active.textContent.trim().toLowerCase();
    var head=h1.textContent.trim().split(/\\s+/)[0].toLowerCase();
    if(tab===head) h1.style.display='none';
  }
})();
</script>
</body>
</html>`;
}
