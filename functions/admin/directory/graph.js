// /admin/directory/graph — the declarative dashboard + linter (T14/T15).
// Read-only over the directory. For each agent it scans its prompt for [TOOL] tags and
// the WHEN→[TOOL] condition, drawing agent→tool edges (a Figma-like bipartite view per
// agent). It FLAGS:
//   • phantom tag   — a [TOOL] an agent references that has no directory row (the
//                     original "READ" bug, now caught for every agent automatically).
//   • orphan tool   — a tool row no agent references (can't be chosen).
//   • undeclared    — an agent prompt with none of the declared blocks
//                     [REASONING] [TOOL] [TOOL_CHOICE] [RULES] [STYLE].
// (Static segment beats [key].js for the exact path "/admin/directory/graph".)
import { shellHtml } from '../_layout.js';

export async function onRequestGet() {
  const body = `
<style>
.gr{max-width:1300px}
.gr .flags{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:14px 0}
.gr .flag{border:1px solid var(--line);border-radius:8px;padding:12px 14px;background:var(--panel)}
.gr .flag h3{font-size:13px;margin:0 0 6px}
.gr .flag .n{font-size:26px;font-weight:700}
.gr .flag.bad .n{color:#c0392b}
.gr .flag.ok .n{color:#178c45}
.gr .flag ul{margin:8px 0 0 16px;font-size:12px;max-height:160px;overflow:auto}
.gr .pick{margin:16px 0 8px}
.gr svg{border:1px solid var(--line);border-radius:8px;background:#fff;width:100%}
.gr .legend{font-size:11.5px;color:var(--muted);margin-top:6px}
.gr table{font-size:12.5px;margin-top:10px}
.gr .chip{display:inline-block;padding:1px 6px;border-radius:4px;font-size:10.5px;font-weight:700}
.gr .chip.dec{background:#dff5e6;color:#178c45}
.gr .chip.leg{background:#fde9e0;color:#c0392b}
</style>
<div class="gr">
<h1>Relationship graph + declarative linter</h1>
<p class="subtitle">Every agent and tool. Edges = an agent's prompt names a tool, and under what condition. Picturing the build like a Figma.</p>
<div class="flags" id="flags"></div>
<div class="pick"><label style="font-weight:600;font-size:13px">Agent: </label>
  <select id="agentpick" onchange="draw()"></select>
  <span class="legend"> — green node = real tool · red = phantom (no row)</span>
</div>
<svg id="svg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMin meet"></svg>
<div id="tables"></div>
</div>
<script>
let ROWS=[], AGENTS=[], TOOLS=[], TOOLSET=new Set(), refs={}, conds={};
const DECLARED=['REASONING','TOOL','TOOL_CHOICE','RULES','STYLE'];
function e(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function tagsIn(content){
  var re=/\\[([A-Z_][A-Z0-9_]*)\\]/g, m, set=new Set();
  while((m=re.exec(content))!==null){ set.add(m[1]); }
  return set;
}
function condFor(content, key){
  var lines=String(content).split('\\n');
  for(var i=0;i<lines.length;i++){ if(lines[i].indexOf('['+key+']')>=0){ return lines[i].replace(/\\s+/g,' ').trim().slice(0,140); } }
  return '';
}
function isDeclared(content){ return DECLARED.some(function(d){ return content.indexOf('['+d+']')>=0; }); }

async function boot(){
  var r = await fetch('/admin/directory?data=agents').then(function(x){return x.json();});
  AGENTS = r.agents||[];
  TOOLS = r.tools||[];
  TOOLSET = new Set(AGENTS.map(function(x){return x.key;}).concat(TOOLS.map(function(x){return x.key;})));
  // structural words that are control grammar, not tools
  var GRAMMAR = new Set(['REASONING','REPLY','DONE','RULES','STYLE','TOOL','TOOL_CHOICE','DECISION','ERROR','LOOP']);
  var referenced = new Set();
  AGENTS.forEach(function(a){
    var tg = tagsIn(a.content||'');
    refs[a.key]=[]; conds[a.key]={};
    tg.forEach(function(k){
      if (GRAMMAR.has(k)) return;
      if (k===a.key) return;
      refs[a.key].push(k);
      conds[a.key][k]=condFor(a.content||'', k);
      referenced.add(k);
    });
  });
  // flags
  var phantoms=[]; // (agent,key) referencing a non-existent row
  AGENTS.forEach(function(a){ refs[a.key].forEach(function(k){ if(!TOOLSET.has(k)) phantoms.push(a.key+' → '+k); }); });
  var orphans = TOOLS.filter(function(t){ return !referenced.has(t.key); }).map(function(t){return t.key;});
  var undeclared = AGENTS.filter(function(a){ return !isDeclared(a.content||''); }).map(function(a){return a.key;});
  document.getElementById('flags').innerHTML =
    flag('Phantom tags', phantoms, 'agent references a [TAG] with no row — like the old READ bug') +
    flag('Orphan tools', orphans, 'no agent references it — cannot be chosen') +
    flag('Undeclared prompts', undeclared, 'no [REASONING]/[TOOL]/[TOOL_CHOICE]/[RULES]/[STYLE] block');
  // agent picker
  document.getElementById('agentpick').innerHTML = AGENTS.map(function(a){return '<option>'+e(a.key)+'</option>';}).join('');
  // tables
  var t = '<h2>Agents</h2><table><thead><tr><th>agent</th><th>declarative</th><th># tools</th><th>tools</th></tr></thead><tbody>';
  AGENTS.forEach(function(a){
    var dec = isDeclared(a.content||'');
    t += '<tr><td><b>'+e(a.key)+'</b></td><td><span class="chip '+(dec?'dec':'leg')+'">'+(dec?'declared':'legacy')+'</span></td><td>'+refs[a.key].length+'</td><td style="font-family:var(--mono);font-size:11px">'+refs[a.key].map(function(k){return TOOLSET.has(k)?e(k):('<span style="color:#c0392b">'+e(k)+'?</span>');}).join(' ')+'</td></tr>';
  });
  t += '</tbody></table>';
  document.getElementById('tables').innerHTML = t;
  draw();
}
function flag(title, arr, hint){
  var cls = arr.length ? 'bad' : 'ok';
  return '<div class="flag '+cls+'"><h3>'+title+'</h3><div class="n">'+arr.length+'</div><div style="font-size:11px;color:var(--muted)">'+hint+'</div>'+
    (arr.length?('<ul>'+arr.slice(0,40).map(function(x){return '<li>'+e(x)+'</li>';}).join('')+'</ul>'):'')+'</div>';
}
function draw(){
  var a = document.getElementById('agentpick').value;
  var ks = refs[a]||[];
  var H = Math.max(600, 60+ks.length*34);
  var svg = '<svg id="svg" viewBox="0 0 1000 '+H+'" preserveAspectRatio="xMidYMin meet" xmlns="http://www.w3.org/2000/svg">';
  // agent node (left)
  svg += '<rect x="30" y="'+(H/2-22)+'" width="180" height="44" rx="8" fill="#0a52d0"/>';
  svg += '<text x="120" y="'+(H/2+5)+'" fill="#fff" font-size="14" font-weight="700" text-anchor="middle" font-family="monospace">'+e(a)+'</text>';
  ks.forEach(function(k,i){
    var y = 40+i*34, real = TOOLSET.has(k);
    svg += '<line x1="210" y1="'+(H/2)+'" x2="540" y2="'+(y+14)+'" stroke="'+(real?'#9aa7ba':'#c0392b')+'" stroke-width="1.4"/>';
    svg += '<rect x="540" y="'+y+'" width="300" height="28" rx="6" fill="'+(real?'#eef7f0':'#fde9e0')+'" stroke="'+(real?'#178c45':'#c0392b')+'"/>';
    svg += '<text x="552" y="'+(y+18)+'" font-size="12" font-family="monospace" fill="#0a0a0a">'+e(k)+(real?'':' (phantom)')+'</text>';
    var c = (conds[a]&&conds[a][k])||'';
    if (c) svg += '<text x="850" y="'+(y+18)+'" font-size="9.5" fill="#6b6b6b">'+e(c.slice(0,30))+'</text>';
  });
  if (!ks.length) svg += '<text x="540" y="'+(H/2)+'" font-size="13" fill="#6b6b6b">no tool references found in this prompt</text>';
  svg += '</svg>';
  document.getElementById('svg').outerHTML = svg;
}
boot();
</script>
`;
  return new Response(shellHtml({ activeHref: '/admin/directory', title: 'Graph', body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
