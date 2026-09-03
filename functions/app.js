// Kernel OS — installable iPhone PWA cockpit for the build. Served at /app.
// Readability-first white interface. Five tabs: OS, Chat, Terminal, Prompts, Flows.
// Pure client-side SPA; every action is a POST to the existing /api/dispatch.
// Inner <script> intentionally avoids backticks and ${...} so the outer template literal stays static.

export async function onRequestGet() {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Kernel OS">
<meta name="theme-color" content="#ffffff">
<link rel="apple-touch-icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Crect width='180' height='180' rx='40' fill='black'/%3E%3Ctext x='90' y='124' font-family='-apple-system,Helvetica' font-size='110' font-weight='800' fill='white' text-anchor='middle'%3EK%3C/text%3E%3C/svg%3E">
<link rel="manifest" href="data:application/json,%7B%22name%22%3A%22Kernel%20OS%22%2C%22short_name%22%3A%22Kernel%20OS%22%2C%22display%22%3A%22standalone%22%2C%22background_color%22%3A%22%23000000%22%2C%22theme_color%22%3A%22%23000000%22%2C%22start_url%22%3A%22%2Fapp%22%7D">
<title>Kernel OS</title>
<style>
  :root{ --bg:#fff; --panel:#fafafa; --card:#fff; --line:#ddd; --ink:#000; --muted:#666;
         --in:#f1f1f1; --out:#000; --outink:#fff; --ok:#000; }
  *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body{ margin:0; height:100%; background:var(--bg); color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif;
    -webkit-font-smoothing:antialiased; overscroll-behavior:none; }
  #app{ display:flex; flex-direction:column; height:100dvh; }
  header{ position:sticky; top:0; z-index:5; padding:calc(env(safe-area-inset-top) + 12px) 18px 12px;
    background:rgba(255,255,255,.92); backdrop-filter:saturate(160%) blur(20px);
    border-bottom:.5px solid var(--line); display:flex; align-items:center; gap:9px; }
  header .dot{ width:8px; height:8px; border-radius:50%; background:var(--ok); box-shadow:0 0 8px var(--ok); }
  header h1{ font-size:17px; font-weight:800; letter-spacing:.04em; margin:0; }
  header .sub{ margin-left:auto; font-size:11px; color:var(--muted); font-variant-numeric:tabular-nums; }
  main{ flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; }
  .screen{ display:none; padding:16px 14px 30px; }
  .screen.on{ display:block; }
  nav{ display:flex; background:rgba(255,255,255,.94); backdrop-filter:blur(20px);
    border-top:.5px solid var(--line); padding:8px 6px calc(env(safe-area-inset-bottom) + 8px); }
  nav button{ flex:1; background:none; border:0; color:var(--muted); font:inherit; font-size:10px;
    display:flex; flex-direction:column; align-items:center; gap:4px; padding:4px 0; }
  nav button svg{ width:24px; height:24px; stroke:currentColor; fill:none; stroke-width:1.7; }
  nav button.on{ color:var(--ink); }
  /* chat */
  .agentbar{ display:flex; gap:8px; overflow-x:auto; padding:2px 2px 12px; }
  .agentbar::-webkit-scrollbar{ display:none; }
  .pill{ flex:0 0 auto; padding:7px 14px; border-radius:18px; background:var(--card);
    border:.5px solid var(--line); color:var(--muted); font-size:13px; font-weight:600; }
  .pill.on{ background:#fff; color:#000; border-color:#fff; }
  .msgs{ display:flex; flex-direction:column; gap:8px; padding-bottom:8px; }
  .b{ max-width:80%; padding:9px 14px; border-radius:20px; font-size:15px; line-height:1.35; white-space:pre-wrap; word-break:break-word; }
  .b.in{ align-self:flex-start; background:var(--in); border-bottom-left-radius:6px; }
  .b.out{ align-self:flex-end; background:var(--out); color:var(--outink); border-bottom-right-radius:6px; font-weight:500; }
  .b.sys{ align-self:center; background:none; color:var(--muted); font-size:12px; max-width:92%; text-align:center; }
  .composer{ position:sticky; bottom:0; display:flex; gap:8px; padding:10px 0 4px; background:linear-gradient(transparent,var(--bg) 24%); }
  .composer input,.composer textarea{ flex:1; background:var(--card); border:.5px solid var(--line); color:var(--ink);
    border-radius:20px; padding:11px 15px; font:inherit; font-size:15px; outline:none; resize:none; }
  .send{ flex:0 0 auto; width:40px; height:40px; border-radius:50%; border:0; background:#fff; color:#000; font-size:18px; font-weight:800; }
  .send:disabled{ opacity:.4; }
  /* generic */
  .grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
  .stat{ background:var(--card); border:.5px solid var(--line); border-radius:16px; padding:14px; }
  .stat .n{ font-size:26px; font-weight:800; font-variant-numeric:tabular-nums; }
  .stat .l{ font-size:11px; color:var(--muted); margin-top:3px; letter-spacing:.03em; text-transform:uppercase; }
  .secti{ font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin:18px 2px 8px; }
  .feed{ display:flex; flex-direction:column; gap:1px; border-radius:14px; overflow:hidden; border:.5px solid var(--line); }
  .row{ display:flex; gap:9px; align-items:center; background:var(--card); padding:10px 13px; font-size:13px; }
  .row .t{ color:var(--muted); font-variant-numeric:tabular-nums; font-size:11px; flex:0 0 auto; }
  .row .s{ font-weight:700; flex:0 0 auto; }
  .row .k{ color:var(--muted); margin-left:auto; font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .tap{ background:var(--card); border:.5px solid var(--line); }
  .list .item{ padding:13px; border-bottom:.5px solid var(--line); display:flex; align-items:center; gap:10px; }
  .list .item:last-child{ border-bottom:0; }
  .list .item .key{ font-weight:700; font-size:14px; }
  .list .item .meta{ margin-left:auto; color:var(--muted); font-size:11px; }
  .btn{ display:block; width:100%; background:#fff; color:#000; border:0; border-radius:14px; padding:14px; font:inherit; font-size:15px; font-weight:700; margin-top:12px; }
  .btn.ghost{ background:var(--card); color:var(--ink); border:.5px solid var(--line); }
  .ta{ width:100%; min-height:280px; background:var(--card); border:.5px solid var(--line); color:var(--ink); border-radius:14px; padding:13px; font:13px ui-monospace,SFMono-Regular,Menlo,monospace; line-height:1.5; outline:none; }
  .term{ font:13px ui-monospace,SFMono-Regular,Menlo,monospace; background:#fff; border:.5px solid var(--line); border-radius:14px; padding:12px; min-height:300px; white-space:pre-wrap; word-break:break-word; color:#222; }
  .term .cmd{ color:#000; font-weight:700; }
  .term .err{ color:#ff6b6b; }
  .shot{ width:100%; border-radius:14px; border:.5px solid var(--line); margin-top:10px; }
  .muted{ color:var(--muted); font-size:13px; }
  #flowcanvas{ width:100%; height:46vh; background:var(--card); border:.5px solid var(--line); border-radius:16px; touch-action:none; }
  .node{ position:absolute; padding:9px 12px; background:#fff; color:#000; border-radius:12px; font-size:12px; font-weight:700; box-shadow:0 4px 16px rgba(0,0,0,.5); }
  .node.sel{ outline:2px solid var(--ok); }
  .flowwrap{ position:relative; }
  .search{ width:100%; background:var(--card); border:.5px solid var(--line); color:var(--ink); border-radius:12px; padding:11px 14px; font:inherit; font-size:15px; outline:none; margin-bottom:10px; }
  .toast{ position:fixed; left:50%; bottom:calc(env(safe-area-inset-bottom) + 78px); transform:translateX(-50%);
    background:#fff; color:#000; padding:10px 16px; border-radius:20px; font-size:13px; font-weight:700; opacity:0; transition:opacity .2s; z-index:9; }
  .toast.on{ opacity:1; }
</style>
</head>
<body>
<div id="app">
  <header><span class="dot"></span><h1>KERNEL&nbsp;OS</h1><span class="sub" id="clock"></span></header>
  <main>
    <section class="screen on" id="s-os"></section>
    <section class="screen" id="s-chat">
      <div class="agentbar" id="agentbar"></div>
      <div class="msgs" id="msgs"></div>
      <div class="composer">
        <textarea id="chatin" rows="1" placeholder="Message your agent…"></textarea>
        <button class="send" id="chatsend">&#8593;</button>
      </div>
    </section>
    <section class="screen" id="s-term">
      <div class="term" id="termout">kernel-os terminal · runs LOCAL_EXEC on your Mac
</div>
      <div class="composer">
        <input id="termin" placeholder="shell command…" autocapitalize="off" autocorrect="off" spellcheck="false">
        <button class="send" id="termsend">&#8593;</button>
      </div>
    </section>
    <section class="screen" id="s-prompts"></section>
    <section class="screen" id="s-flows"></section>
  </main>
  <nav id="nav"></nav>
</div>
<div class="toast" id="toast"></div>
<script>
var TABS=[
 ['os','OS','M3 4h7v7H3zM14 4h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
 ['chat','Chat','M4 5h16v11H9l-4 4z'],
 ['term','Terminal','M4 5h16v14H4zM7 9l3 3-3 3M13 15h4'],
 ['prompts','Prompts','M5 19l2-1 9-9-1-1-9 9zM15 7l2 2'],
 ['flows','Flows','M6 6a2 2 0 100 0M18 6a2 2 0 100 0M12 18a2 2 0 100 0M7 7l4 9M17 7l-4 9']
];
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toast(t){ var e=$('toast'); e.textContent=t; e.classList.add('on'); setTimeout(function(){ e.classList.remove('on'); },1600); }
function tick(){ var d=new Date(); $('clock').textContent=d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }
setInterval(tick,1000); tick();

async function disp(key, body){
  try{
    var r=await fetch('/api/dispatch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:key,body:body==null?'':body})});
    var j=await r.json(); return j.result==null?'':String(j.result);
  }catch(e){ return 'ERR:net:'+e.message; }
}
function jparse(s){ try{ return JSON.parse(s); }catch(e){ return null; } }

// ---- tabs ----
var nav=$('nav');
TABS.forEach(function(t){
  var b=document.createElement('button'); b.dataset.t=t[0];
  b.innerHTML='<svg viewBox="0 0 24 24"><path d="'+t[2]+'" stroke-linecap="round" stroke-linejoin="round"/></svg>'+t[1];
  b.onclick=function(){ show(t[0]); };
  nav.appendChild(b);
});
var loaded={};
function show(t){
  TABS.forEach(function(x){ $('s-'+x[0]).classList.toggle('on', x[0]===t); });
  Array.prototype.forEach.call(nav.children,function(b){ b.classList.toggle('on', b.dataset.t===t); });
  if(t==='os') loadOS();
  if(t==='chat' && !loaded.chat){ loaded.chat=1; loadAgents(); }
  if(t==='prompts' && !loaded.prompts){ loaded.prompts=1; loadPrompts(); }
  if(t==='flows' && !loaded.flows){ loaded.flows=1; loadFlows(); }
}

// ---- OS ----
async function loadOS(){
  var el=$('s-os');
  if(!el.dataset.init){ el.dataset.init=1;
    el.innerHTML='<div class="grid" id="stats"></div>'+
      '<button class="btn ghost" id="snap">Snap my Mac screen</button>'+
      '<div id="shotwrap"></div>'+
      '<div class="secti">Live ledger</div><div class="feed" id="osfeed"></div>'+
      '<div class="muted" style="margin-top:14px;text-align:center" id="brag"></div>';
    $('snap').onclick=snap;
  }
  var rows=parseInt((jparse(await disp('D1_QUERY','SELECT COUNT(*) n FROM directory'))||[{}])[0].n||0,10);
  var today=parseInt((jparse(await disp('LEDGER_QUERY','SELECT COUNT(*) n FROM events WHERE ts > datetime("now","-1 day")'))||[{}])[0].n||0,10);
  var week=parseInt((jparse(await disp('LEDGER_QUERY','SELECT COUNT(*) n FROM events WHERE ts > datetime("now","-7 day")'))||[{}])[0].n||0,10);
  var sess=parseInt((jparse(await disp('D1_QUERY','SELECT COUNT(*) n FROM sessions'))||[{}])[0].n||0,10);
  $('stats').innerHTML=
    stat(today,'actions today')+stat(rows,'tools wired')+stat(week,'events this week')+stat(sess,'agent sessions');
  $('brag').textContent='Your Kernel OS ran '+today+' actions today. 0 terminals touched.';
  var feed=jparse(await disp('LEDGER_QUERY','SELECT ts,source,key,action FROM events ORDER BY ts DESC LIMIT 25'))||[];
  $('osfeed').innerHTML=feed.map(function(e){
    return '<div class="row"><span class="t">'+esc((e.ts||'').slice(11,19))+'</span><span class="s">'+esc(e.source||'')+'</span><span class="k">'+esc((e.key||'')+' '+(e.action||''))+'</span></div>';
  }).join('')||'<div class="row"><span class="muted">no events yet</span></div>';
}
function stat(n,l){ return '<div class="stat"><div class="n">'+n+'</div><div class="l">'+l+'</div></div>'; }
async function snap(){
  $('snap').textContent='Snapping…'; $('snap').disabled=true;
  var r=jparse(await disp('LOCAL_SCREENSHOT',''));
  $('snap').textContent='Snap my Mac screen'; $('snap').disabled=false;
  if(r && r.url){ $('shotwrap').innerHTML='<img class="shot" src="'+esc(r.url)+'?t='+Date.now()+'">'; }
  else toast('screenshot unavailable');
}

// ---- Chat ----
var agent='ROUTER', chats={};
try{ chats=JSON.parse(localStorage.getItem('kos_chats')||'{}'); }catch(e){ chats={}; }
async function loadAgents(){
  var rows=jparse(await disp('D1_QUERY','SELECT key FROM directory WHERE type="agent" ORDER BY (key="ROUTER") DESC, key'))||[{key:'ROUTER'}];
  var bar=$('agentbar'); bar.innerHTML='';
  rows.forEach(function(r){
    var p=document.createElement('div'); p.className='pill'+(r.key===agent?' on':''); p.textContent=r.key;
    p.onclick=function(){ agent=r.key; Array.prototype.forEach.call(bar.children,function(c){ c.classList.toggle('on',c.textContent===agent); }); renderMsgs(); };
    bar.appendChild(p);
  });
  renderMsgs();
}
function renderMsgs(){
  var m=chats[agent]||[]; var box=$('msgs');
  box.innerHTML=m.map(function(x){ return '<div class="b '+x.r+'">'+esc(x.t)+'</div>'; }).join('')||'<div class="b sys">Talking to '+esc(agent)+'. Say something.</div>';
  $('msgs').scrollTop=1e7; document.querySelector('main').scrollTop=1e7;
}
function cleanReply(s){
  var m=String(s||'').match(/\\[REPLY\\]([\\s\\S]*?)\\[\\/REPLY\\]/g);
  if(m&&m.length){ return m[m.length-1].replace(/\\[\\/?REPLY\\]/g,'').trim(); }
  return String(s||'').replace(/\\[REASONING\\][\\s\\S]*?\\[\\/REASONING\\]/g,'').replace(/\\[[A-Z_]+\\][\\s\\S]*?\\[\\/[A-Z_]+\\]/g,'').trim() || String(s||'').slice(0,1500);
}
function pushMsg(r,t){ if(!chats[agent]) chats[agent]=[]; chats[agent].push({r:r,t:t}); try{ localStorage.setItem('kos_chats',JSON.stringify(chats)); }catch(e){} renderMsgs(); }
async function sendChat(){
  var v=$('chatin').value.trim(); if(!v) return;
  $('chatin').value=''; pushMsg('out',v);
  if(!chats[agent]) chats[agent]=[];
  chats[agent].push({r:'in',t:'…'}); renderMsgs();
  var res=await disp(agent,v);
  chats[agent].pop();
  pushMsg('in', cleanReply(res));
}
$('chatsend').onclick=sendChat;
$('chatin').addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendChat(); } });

// ---- Terminal ----
async function runTerm(){
  var v=$('termin').value.trim(); if(!v) return; $('termin').value='';
  var out=$('termout'); out.innerHTML+='<span class="cmd">$ '+esc(v)+'</span>\\n';
  var res=await disp('LOCAL_EXEC',v); var j=null; var m=String(res).match(/^HTTP \\d+:([\\s\\S]*)$/); if(m) j=jparse(m[1]);
  var text = j ? (String(j.stdout||'').trim() || ('[exit '+j.exit+'] '+String(j.stderr||'').trim())) : String(res);
  out.innerHTML+=esc(text)+'\\n'; out.scrollTop=1e7; document.querySelector('main').scrollTop=1e7;
}
$('termsend').onclick=runTerm;
$('termin').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); runTerm(); } });

// ---- Prompts ----
async function loadPrompts(){
  var el=$('s-prompts');
  el.innerHTML='<input class="search" id="psearch" placeholder="search rows…"><div class="list" id="plist" style="background:var(--card);border:.5px solid var(--line);border-radius:14px;overflow:hidden"></div>';
  var rows=jparse(await disp('D1_QUERY','SELECT key,type,category FROM directory ORDER BY (type="agent") DESC, key'))||[];
  function draw(f){
    $('plist').innerHTML=rows.filter(function(r){ return !f || (r.key+' '+(r.category||'')).toLowerCase().indexOf(f)>=0; }).slice(0,120).map(function(r){
      return '<div class="item" data-k="'+esc(r.key)+'"><span class="key">'+esc(r.key)+'</span><span class="meta">'+esc(r.type+' · '+(r.category||''))+'</span></div>';
    }).join('');
    Array.prototype.forEach.call($('plist').querySelectorAll('.item'),function(it){ it.onclick=function(){ editPrompt(it.dataset.k); }; });
  }
  draw('');
  $('psearch').oninput=function(){ draw(this.value.toLowerCase()); };
}
async function editPrompt(key){
  var el=$('s-prompts');
  var rows=jparse(await disp('D1_QUERY','SELECT content FROM directory WHERE key="'+key.replace(/"/g,'')+'"'))||[{}];
  var content=rows[0]&&rows[0].content!=null?rows[0].content:'';
  el.innerHTML='<button class="btn ghost" id="pback">‹ rows</button>'+
    '<div class="secti">'+esc(key)+'</div>'+
    '<textarea class="ta" id="ptext"></textarea>'+
    '<button class="btn" id="psave">Save '+esc(key)+'</button>';
  $('ptext').value=content;
  $('pback').onclick=loadPrompts;
  $('psave').onclick=async function(){
    $('psave').textContent='Saving…'; $('psave').disabled=true;
    var res=jparse(await disp('SET_ROW_CONTENT', key+'|'+$('ptext').value));
    $('psave').disabled=false; $('psave').textContent='Save '+key;
    if(res&&res.ok){ toast('saved · '+res.bytes+' bytes'); } else toast('save failed');
  };
}

// ---- Flows (doodle chain) ----
var fnodes=[], fsel=null;
async function loadFlows(){
  var el=$('s-flows');
  el.innerHTML='<div class="muted">Tap rows to drop nodes. Tap one node then another to chain them. Drag to arrange.</div>'+
    '<div class="flowwrap" style="margin-top:10px"><svg id="flowedges" style="position:absolute;inset:0;width:100%;height:46vh;pointer-events:none"></svg><div id="flowcanvas"></div></div>'+
    '<input class="search" id="fsearch" placeholder="add a tool node… (type to search)" style="margin-top:12px">'+
    '<div class="list" id="fpick" style="background:var(--card);border:.5px solid var(--line);border-radius:14px;overflow:hidden;max-height:24vh;overflow-y:auto"></div>'+
    '<div class="ta" id="fdsl" style="min-height:auto;margin-top:12px">(chain preview)</div>'+
    '<button class="btn" id="fsave">Save as flow</button>';
  var rows=jparse(await disp('D1_QUERY','SELECT key FROM directory WHERE type IN ("fn","http","flow") ORDER BY key'))||[];
  function drawpick(f){
    $('fpick').innerHTML=rows.filter(function(r){ return f && r.key.toLowerCase().indexOf(f)>=0; }).slice(0,30).map(function(r){
      return '<div class="item" data-k="'+esc(r.key)+'"><span class="key">'+esc(r.key)+'</span><span class="meta">add</span></div>';
    }).join('');
    Array.prototype.forEach.call($('fpick').querySelectorAll('.item'),function(it){ it.onclick=function(){ addNode(it.dataset.k); $('fsearch').value=''; drawpick(''); }; });
  }
  $('fsearch').oninput=function(){ drawpick(this.value.toLowerCase()); };
  $('fsave').onclick=saveFlow;
  fnodes=[]; fsel=null; renderFlow();
}
function addNode(key){
  fnodes.push({key:key, x:30+ (fnodes.length*18)%200, y:30+(fnodes.length*40)%240, args:'$PREV', order:fnodes.length});
  renderFlow();
}
function renderFlow(){
  var cv=$('flowcanvas'); if(!cv) return; cv.innerHTML='';
  fnodes.forEach(function(n,i){
    var d=document.createElement('div'); d.className='node'+(fsel===i?' sel':''); d.textContent=(n.order+1)+'. '+n.key;
    d.style.left=n.x+'px'; d.style.top=n.y+'px';
    drag(d,n,i); cv.appendChild(d);
  });
  // edges by order
  var ordered=fnodes.slice().sort(function(a,b){ return a.order-b.order; });
  var svg=$('flowedges'); svg.innerHTML='';
  for(var i=0;i<ordered.length-1;i++){
    var a=ordered[i], b=ordered[i+1];
    var l=document.createElementNS('http://www.w3.org/2000/svg','line');
    l.setAttribute('x1',a.x+30); l.setAttribute('y1',a.y+16); l.setAttribute('x2',b.x+30); l.setAttribute('y2',b.y+16);
    l.setAttribute('stroke','#30d158'); l.setAttribute('stroke-width','2'); svg.appendChild(l);
  }
  $('fdsl').textContent = ordered.map(function(n){ return n.key+': '+(n.args||'$PREV'); }).join('  >  ') || '(chain preview)';
}
function drag(el,n,i){
  var sx,sy,ox,oy,moved;
  el.addEventListener('touchstart',function(e){ moved=false; var t=e.touches[0]; sx=t.clientX; sy=t.clientY; ox=n.x; oy=n.y; },{passive:true});
  el.addEventListener('touchmove',function(e){ moved=true; var t=e.touches[0]; n.x=ox+(t.clientX-sx); n.y=oy+(t.clientY-sy); renderFlow(); },{passive:true});
  el.addEventListener('touchend',function(e){ if(!moved){ tapNode(i); } });
  el.onclick=function(){ tapNode(i); };
}
function tapNode(i){
  if(fsel===null){ fsel=i; renderFlow(); return; }
  if(fsel===i){ fsel=null; renderFlow(); return; }
  // chain: selected -> i  => set i's order right after selected
  var sel=fnodes[fsel];
  fnodes[i].order = sel.order + 0.5;
  fnodes.sort(function(a,b){ return a.order-b.order; }).forEach(function(n,idx){ n.order=idx; });
  fsel=null; renderFlow();
}
async function saveFlow(){
  if(fnodes.length<1){ toast('add nodes first'); return; }
  var name=prompt('Flow name (KEY):','MY_FLOW'); if(!name) return;
  name=name.toUpperCase().replace(/[^A-Z0-9_]/g,'_');
  var ordered=fnodes.slice().sort(function(a,b){ return a.order-b.order; });
  var dsl=ordered.map(function(n){ return n.key+': '+(n.args||'$PREV'); }).join(' > ');
  var res=jparse(await disp('SAVE_FLOW', name+'|'+dsl));
  if(res&&res.ok){ toast('flow '+name+' saved'); } else toast('save failed');
}

show('os');
</script>
</body>
</html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
