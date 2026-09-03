// /admin/prompts/<key> — the prompt lab. Read the prompt, pick the model, append memory,
// type the input, tap Generate. The call is one request to /api/invoke and comes back in
// about a second; `n` runs that many in parallel so prompt versions are compared side by
// side instead of one 30-minute turn at a time.
//
// /admin/prompts/_new opens the same lab with no row behind it — a literal prompt you can
// run without saving anything.
import { shellHtml } from '../_layout.js';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function onRequestGet(context) {
  const { params, env } = context;
  const key = String(params.key || '').trim();
  if (!key) return new Response('key required', { status: 400 });

  const isNew = key === '_new';
  let row = null;
  if (!isNew) {
    row = await env.DB.prepare(
      'SELECT key, type, target, content, includes, category, enabled, updated_at FROM directory WHERE key = ?'
    ).bind(key).first();
    if (!row) return new Response('Not found: ' + key, { status: 404 });
  }

  // A prompt_block has no model of its own — its `target` is the marker that makes it a
  // block. Run it against a real model here, and never write the model back over the marker.
  const isBlock = !!(row && row.target === 'prompt_block');
  const model = (!isBlock && row && row.target) || 'kimi';
  const content = (row && row.content) || '';
  const includes = (row && row.includes) || '';

  const body = `
<style>
.lab{max-width:1280px}
.lab .row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:900px){.lab .row{grid-template-columns:1fr}}
.lab .fld{margin:0 0 12px}
.lab label{display:block;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:0 0 4px}
.lab textarea,.lab input,.lab select{width:100%;font-family:var(--mono);font-size:13px;line-height:1.5}
.lab textarea{min-height:120px;resize:vertical}
#sys{min-height:340px}
.lab .bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:6px 0 14px}
.lab .bar .grow{flex:1}
.lab .small{width:90px}
.lab .go{font-weight:700}
.lab .note{font-size:11.5px;color:var(--muted)}
.out{margin-top:14px;display:grid;gap:10px}
.res{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:10px 12px}
.res.bad{border-color:#b3392f}
.res h4{margin:0 0 6px;font-size:12px;font-family:var(--mono);color:var(--muted);display:flex;justify-content:space-between;gap:10px}
.res pre{margin:0;white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.5;max-height:460px;overflow:auto}
.card{border:1px solid var(--line);border-radius:9px;background:var(--panel);padding:14px 16px;margin:0 0 14px}
.card h2{font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.card pre{background:var(--bg);border:1px solid var(--line);padding:10px 12px;border-radius:7px;font-size:12px;overflow:auto;margin:0}
#status{font-size:12.5px;color:var(--muted)}
</style>
<div class="lab">
<h1>${esc(isNew ? 'New prompt (unsaved)' : row.key)} <span class="type-chip">${esc(isNew ? 'scratch' : row.type)}</span></h1>
<p class="subtitle">${isNew
    ? 'A literal prompt with no row behind it. Run it here; give it a key and Save to put it in the directory.'
    : 'Edit and Save writes the row. Generate does not save — run first, keep what wins.'}
  ${isNew ? '' : `<a href="/admin/directory/${encodeURIComponent(key)}" class="note">· full directory row</a>`}</p>

<div class="row">
  <div>
    <div class="fld">
      <label for="sys">system prompt${isNew ? '' : ' · directory row <code>' + esc(key) + '</code>'}</label>
      <textarea id="sys" spellcheck="false">${esc(content)}</textarea>
      <div class="note"><span id="syslen">${content.length}</span> chars</div>
    </div>
    <div class="fld">
      <label for="mem">append memory (this call only — not saved to the row)</label>
      <textarea id="mem" style="min-height:90px" spellcheck="false" placeholder="facts, prior turns, owner corrections — appended under a MEMORY header"></textarea>
    </div>
    <div class="fld">
      <label for="inc">includes (csv of prompt_block keys, composed ahead of the prompt)</label>
      <input id="inc" value="${esc(includes)}" spellcheck="false">
    </div>
  </div>

  <div>
    <div class="fld">
      <label for="input">input</label>
      <textarea id="input" style="min-height:150px" spellcheck="false" placeholder="the user message"></textarea>
    </div>
    <div class="fld">
      <label for="inputs">or one input per line — each line is its own parallel call</label>
      <textarea id="inputs" style="min-height:90px" spellcheck="false" placeholder="row 1&#10;row 2&#10;row 3"></textarea>
    </div>
    <div class="bar">
      <div class="grow">
        <label for="model">model</label>
        <input id="model" list="models" value="${esc(model)}" spellcheck="false">
        <datalist id="models"></datalist>
      </div>
      <div><label for="temp">temp</label><input class="small" id="temp" type="number" step="0.05" min="0" max="2" value="1"></div>
      <div><label for="n">n</label><input class="small" id="n" type="number" min="1" max="20" value="1"></div>
      <div><label for="maxtok">max tok</label><input class="small" id="maxtok" type="number" min="1" max="32000" value="2048"></div>
    </div>
    <div class="bar">
      <button type="button" class="go" onclick="gen()">Generate</button>
      <button type="button" onclick="shape()">Shape (no send)</button>
      ${isNew
        ? '<input id="newkey" placeholder="new key to save as…" style="width:220px">'
        : '<button type="button" onclick="save()">Save prompt</button>'}
      <button type="button" onclick="saveAs()">Save as…</button>
      <span id="status"></span>
    </div>
    <div class="note">Generate fires one request; every call in it is in flight at once. n &gt; 1 or multiple input lines means side-by-side answers, same wall clock.</div>
  </div>
</div>

<div class="out" id="out"></div>

<div class="card" style="margin-top:20px">
  <h2>The same call, anywhere</h2>
  <pre id="curl">…</pre>
  <div class="note" style="margin-top:8px">Paste into a terminal, a Worker, or Google Sheets (<code>UrlFetchApp.fetch</code>). <code>?format=csv</code> returns label,ok,ms,model,text.</div>
</div>
</div>

<script>
var KEY = ${JSON.stringify(isNew ? '' : key)};
var IS_NEW = ${JSON.stringify(isNew)};
var IS_BLOCK = ${JSON.stringify(isBlock)};
var ROW_CATEGORY = ${JSON.stringify((row && row.category) || 'prompt')};
var $ = function(id){ return document.getElementById(id); };

function specFromForm(){
  var s = { model: $('model').value.trim() || undefined,
            system: $('sys').value,
            temperature: parseFloat($('temp').value),
            max_tokens: parseInt($('maxtok').value, 10) || 2048 };
  if (KEY) s.key = KEY;
  var mem = $('mem').value.trim(); if (mem) s.memory = mem;
  var inc = $('inc').value.trim(); if (inc) s.includes = inc;
  var many = $('inputs').value.split('\\n').map(function(x){return x.trim();}).filter(Boolean);
  if (many.length) s.inputs = many; else s.input = $('input').value;
  var n = parseInt($('n').value, 10) || 1; if (n > 1) s.n = n;
  return s;
}

function renderCurl(){
  var s = specFromForm();
  // The published call names the row and leaves the prompt in the directory where it lives.
  if (s.key) { delete s.system; }
  $('curl').textContent =
    'curl -X POST https://miscsubjects.com/api/invoke \\\\\\n' +
    '  -H "authorization: Bearer $TERMINAL_KEY" -H "content-type: application/json" \\\\\\n' +
    "  -d '" + JSON.stringify(s).replace(/'/g, "'\\\\''") + "'";
}

function card(r){
  var head = '<h4><span>' + (r.label || '') + '</span><span>' + (r.model || '') + ' · ' + r.ms + 'ms' +
    (r.usage && r.usage.total_tokens ? ' · ' + r.usage.total_tokens + ' tok' : '') + '</span></h4>';
  var txt = r.ok ? r.text : ('ERROR: ' + r.error);
  var d = document.createElement('div');
  d.className = 'res' + (r.ok ? '' : ' bad');
  d.innerHTML = head + '<pre></pre>';
  d.querySelector('pre').textContent = txt || '(empty)';
  return d;
}

async function post(url, payload){
  var r = await fetch(url, { method:'POST', credentials:'same-origin',
    headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
  return r.json();
}

async function gen(){
  var out = $('out'); out.innerHTML = '';
  $('status').textContent = 'generating…';
  var t0 = Date.now();
  try {
    var j = await post('/api/invoke', specFromForm());
    if (j.error && !j.results) { $('status').textContent = 'error: ' + j.error; return; }
    $('status').textContent = j.ok_count + '/' + j.count + ' answered · ' + j.ms + 'ms server · ' + (Date.now()-t0) + 'ms wall';
    j.results.forEach(function(r){ out.appendChild(card(r)); });
  } catch(e){ $('status').textContent = 'error: ' + e; }
}

async function shape(){
  var out = $('out'); out.innerHTML = '';
  $('status').textContent = 'shaping (not sent)…';
  var j = await post('/api/invoke?shape=1', specFromForm());
  $('status').textContent = 'shaped — nothing sent';
  var d = document.createElement('div'); d.className = 'res';
  d.innerHTML = '<h4><span>outbound payload</span><span>' + j.count + ' call(s)</span></h4><pre></pre>';
  d.querySelector('pre').textContent = JSON.stringify(j.requests, null, 2);
  out.appendChild(d);
}

async function writeRow(k){
  return post('/admin/directory/' + encodeURIComponent(k), {
    key: k, type: 'agent', auth: '',
    target: IS_BLOCK ? 'prompt_block' : $('model').value.trim(),
    content: $('sys').value, category: ROW_CATEGORY,
  });
}

async function save(){
  $('status').textContent = 'saving…';
  var j = await writeRow(KEY);
  $('status').textContent = j.ok ? ('saved ' + j.updated_at) : ('error: ' + (j.error || '?'));
}

async function saveAs(){
  var k = IS_NEW ? ($('newkey') && $('newkey').value.trim()) : prompt('Save this prompt as a new directory key:', KEY + '_v2');
  if (!k) return;
  $('status').textContent = 'saving ' + k + '…';
  var j = await writeRow(k);
  if (j.ok) location.href = '/admin/prompts/' + encodeURIComponent(k);
  else $('status').textContent = 'error: ' + (j.error || '?');
}

(async function boot(){
  $('sys').addEventListener('input', function(){ $('syslen').textContent = $('sys').value.length; renderCurl(); });
  ['model','mem','inc','input','inputs','temp','n','maxtok'].forEach(function(id){
    $(id).addEventListener('input', renderCurl);
  });
  renderCurl();
  try {
    var m = await fetch('/api/models').then(function(r){ return r.json(); });
    var ids = (m.text || []).map(function(x){ return x.id; });
    ['kimi','glm','fast','grok','gpt','opus5','sonnet5'].forEach(function(a){ ids.unshift(a); });
    $('models').innerHTML = ids.map(function(i){ return '<option value="' + i + '">'; }).join('');
  } catch(e){}
})();
</script>`;

  return new Response(shellHtml({ activeHref: '/admin/prompts', title: isNew ? 'New prompt' : key, body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
