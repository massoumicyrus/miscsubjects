import { shellHtml } from './_layout.js';

const BODY = `
<style>
.dojo{max-width:1400px}
.dojo h2{font-size:13px;font-weight:700;margin:20px 0 8px;color:#546e7a;text-transform:uppercase;letter-spacing:.06em}
.dojo .hint{font-size:12px;color:var(--muted);margin-top:3px}

/* Model selection */
.models-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;margin-top:6px}
.models-grid label{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--line);border-radius:5px;background:#fff;cursor:pointer;font-size:12.5px;font-family:var(--mono);transition:all .12s}
.models-grid label:hover{border-color:var(--accent);background:var(--accent-soft)}
.models-grid input[type=checkbox]{margin:0;width:15px;height:15px;accent-color:var(--accent)}
.models-grid .prov{font-size:11px;color:var(--muted);margin-left:auto;font-family:var(--sans);font-weight:500}

/* Prompts */
.prompts{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px}
.prompts label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#546e7a;display:block;margin-bottom:4px}
.prompts textarea{width:100%;min-height:200px;font-family:var(--mono);font-size:13px;line-height:1.5;border:1px solid var(--line);border-radius:5px;padding:10px;resize:vertical}
.prompts textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgba(10,82,208,.1)}

/* Actions */
.actions{display:flex;gap:10px;align-items:center;margin-top:16px;flex-wrap:wrap}
.actions button{font-size:14px;font-weight:700;padding:11px 24px;border-radius:6px;border:2px solid transparent;cursor:pointer;transition:all .1s;font-family:var(--sans)}
.actions button.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
.actions button.primary:hover{background:#0840a8;transform:translateY(-1px)}
.actions button.primary:active{transform:translateY(0)}
.actions button.secondary{background:var(--accent-soft);color:var(--accent);border-color:var(--accent)}
.actions button.secondary:hover{background:#d6e3f8}
.actions button.danger{border-color:#c62828;color:#c62828;background:#fff}
.actions button.danger:hover{background:#ffebee;border-color:#b71c1c;color:#b71c1c}
.actions button:disabled{opacity:.5;cursor:not-allowed;transform:none !important}
#status{font-size:13px;color:var(--muted);font-weight:600}
#status.err{color:#c62828}
#status.ok{color:#2e7d32}

/* Results */
.results-header{display:flex;align-items:center;gap:10px;margin-top:20px;margin-bottom:8px}
.results-header h2{margin:0}
.results-count{font-size:12px;color:var(--muted);font-weight:600;background:#eceff1;padding:2px 8px;border-radius:99px}
.results-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:12px}
.result-card{border:1px solid var(--line);border-radius:6px;background:#fff;overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .12s}
.result-card:hover{box-shadow:0 2px 8px rgba(0,0,0,.06)}
.result-card .card-header{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--line);background:#f8f9fa}
.result-card .card-header .name{font-weight:700;font-size:13px;font-family:var(--mono);color:#263238}
.result-card .card-header .prov{font-size:11px;color:#78909c;font-weight:600}
.result-card .card-body{padding:10px 12px;flex:1;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word;min-height:60px;color:#37474f}
.result-card .card-meta{display:flex;gap:14px;padding:6px 12px;border-top:1px solid #eee;font-size:11.5px;color:#78909c;background:#fafbfc;font-family:var(--mono);font-weight:500}
.result-card .card-actions{display:flex;gap:6px;padding:8px 12px;border-top:1px solid #eee}
.result-card .card-actions button{flex:1;padding:8px 10px;font-size:12.5px;font-weight:700;border-radius:5px;border:2px solid transparent;cursor:pointer;font-family:var(--sans);transition:all .1s}
.result-card .card-actions button.approve-btn{background:#e8f5e9;color:#2e7d32;border-color:#a5d6a7}
.result-card .card-actions button.approve-btn:hover{background:#c8e6c9;border-color:#2e7d32}
.result-card .card-actions button.reject-btn{background:#fff;border-color:#e57373;color:#c62828}
.result-card .card-actions button.reject-btn:hover{background:#ffebee;border-color:#c62828}
.result-card .card-actions button:disabled{opacity:.4;cursor:not-allowed}
.result-card.approved{border-color:#2e7d32;box-shadow:0 0 0 2px rgba(46,125,50,.15)}
.result-card.rejected{opacity:.45}
.result-card .status-badge{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:99px;letter-spacing:.02em}
.result-card .status-badge.approved{color:#1b5e20;background:#c8e6c9}
.result-card .status-badge.rejected{color:#b71c1c;background:#ffcdd2}

/* Approved outputs */
.approved-section{margin-top:20px;padding-top:16px;border-top:2px solid var(--line)}
.approved-list{display:grid;gap:8px;margin-top:8px}
.approved-item{border:1px solid var(--line);border-radius:5px;padding:8px 10px;background:#f8f9fa;display:flex;gap:10px;align-items:flex-start}
.approved-item .ai{font-family:var(--mono);font-size:11px;color:#78909c;white-space:nowrap;font-weight:600;padding-top:2px}
.approved-item .txt{flex:1;font-size:12.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:#37474f}
.approved-item .del{color:#bdbdbd;cursor:pointer;font-size:18px;line-height:1;padding:0 4px;font-weight:700}
.approved-item .del:hover{color:#c62828}

/* Save form */
.save-form{background:#fff;border:1px solid var(--line);border-radius:6px;padding:14px;max-width:540px;margin-top:10px}
.save-form .row{display:flex;gap:10px;align-items:center;margin-bottom:10px}
.save-form .row:last-child{margin-bottom:0}
.save-form label{font-size:12px;font-weight:600;color:#546e7a;width:60px;flex-shrink:0;text-transform:uppercase;letter-spacing:.03em}
.save-form input[type=text]{flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:5px;font-size:13px;font-family:var(--sans)}
.save-form input[type=text]:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgba(10,82,208,.1)}
.save-form .actions{margin-top:4px}

.empty{padding:12px;color:var(--muted);font-size:13px}
.spinner{display:inline-block;width:14px;height:14px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;vertical-align:middle;margin-right:6px}
@keyframes spin{to{transform:rotate(360deg)}}
</style>

<div class="dojo">
<h1>Dojo</h1>
<p class="subtitle">Multi-model prompt testing. Pick models, write prompts, run side-by-side, approve winners, save to articles.</p>

<h2>1. Select Models</h2>
<div class="models-grid" id="models-grid">
  <div class="empty">Loading models…</div>
</div>
<div class="hint">
  <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin-right:14px">
    <input type="checkbox" id="check-all" onchange="toggleAll()"> Select / deselect all
  </label>
  <span id="model-count"></span>
</div>

<h2>2. Prompts</h2>
<div class="prompts">
  <div>
    <label>System Prompt</label>
    <textarea id="system-prompt" spellcheck="false" placeholder="You are a helpful assistant…"></textarea>
  </div>
  <div>
    <label>User Prompt</label>
    <textarea id="user-prompt" spellcheck="false" placeholder="Write a short poem about recursion…"></textarea>
  </div>
</div>

<div class="actions">
  <button class="primary" onclick="runAll()" id="run-btn">▶ Run All Selected</button>
  <button class="danger" onclick="clearResults()">✕ Clear</button>
  <span id="status"></span>
</div>

<div class="results-header">
  <h2>3. Results</h2>
  <span class="results-count" id="results-count" style="display:none"></span>
</div>
<div id="results" class="results-grid">
  <div class="empty">No runs yet. Select models and click Run.</div>
</div>

<div class="approved-section" id="approved-section" style="display:none">
  <h2>Approved Outputs</h2>
  <div id="approved-list" class="approved-list"></div>

  <h2 style="margin-top:20px">Save to Article</h2>
  <div class="save-form">
    <div class="row">
      <label>Slug</label>
      <input type="text" id="article-slug" placeholder="dojo-output-001">
    </div>
    <div class="row">
      <label>Title</label>
      <input type="text" id="article-title" placeholder="Dojo Output">
    </div>
    <div class="actions">
      <button class="secondary" onclick="saveToArticle()">Save to Article</button>
      <span id="save-status" class="status"></span>
    </div>
  </div>
</div>
</div>

<script>
const PRICING = {
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': 0,
  '@cf/meta/llama-3.1-8b-instruct-fast': 0,
  '@cf/meta/llama-3.1-70b-instruct': 0,
  '@cf/meta/llama-4-scout-17b-16e-instruct': 0,
  '@cf/qwen/qwen2.5-coder-32b-instruct': 0,
  '@cf/qwen/qwq-32b': 0,
  '@cf/meta/llama-3.2-3b-instruct': 0,
  '@cf/mistralai/mistral-small-3.1-24b-instruct': 0,
  '@cf/qwen/qwen3-30b-a3b-fp8': 0,
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b': 0,
  '@cf/meta/llama-3.2-1b-instruct': 0,
  'grok:grok-4': {in:1.25e-6,out:2.50e-6},
  'grok:grok-3': {in:1.25e-6,out:2.50e-6},
  'openai:gpt-4o-mini': {in:1.50e-7,out:6.00e-7},
  'openai:gpt-4o': {in:2.50e-6,out:1.00e-5},
  'gemini:gemini-1.5-flash': {in:3.50e-8,out:7.00e-8},
  'gemini:gemini-1.5-pro': {in:1.75e-6,out:7.00e-6},
  'kimi:moonshot-v1-8k': {in:1.00e-6,out:2.00e-6},
};

let models = [];
let results = [];
let approved = [];

function setStatus(id, text, cls) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'status ' + (cls || '');
  if (text) setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 6000);
}

function fmtCost(model, tokensIn, tokensOut) {
  const p = PRICING[model];
  if (!p) return '$0.00';
  if (typeof p === 'number') return '$0.00';
  const inCost = (tokensIn || 0) * p.in;
  const outCost = (tokensOut || 0) * p.out;
  return '$' + (inCost + outCost).toFixed(4);
}

function fmtTokens(n) { return n == null ? '—' : n.toLocaleString(); }

async function loadModels() {
  const grid = document.getElementById('models-grid');
  try {
    const r = await fetch('/api/models', { headers: { 'accept': 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) throw new Error('Unexpected ' + ct);
    const d = await r.json();
    models = (d.text || []).filter(m => m.ready);
    if (!models.length) { grid.innerHTML = '<div class="empty">No models available.</div>'; return; }
    grid.innerHTML = models.map(m => 
      '<label>' +
        '<input type="checkbox" class="m-check" value="' + m.id + '" checked>' +
        '<span>' + m.label + '</span>' +
        '<span class="prov">' + m.provider + '</span>' +
      '</label>'
    ).join('');
    document.getElementById('model-count').textContent = models.length + ' models ready';
  } catch (e) {
    grid.innerHTML = '<div class="empty">Failed to load models: ' + e.message + '. <a href="/api/models" target="_blank">Try API</a></div>';
  }
}

function toggleAll() {
  const checked = document.getElementById('check-all').checked;
  document.querySelectorAll('.m-check').forEach(cb => cb.checked = checked);
}

function getSelectedModels() {
  return [...document.querySelectorAll('.m-check:checked')].map(cb => cb.value);
}

function renderResults() {
  const c = document.getElementById('results');
  const count = document.getElementById('results-count');
  if (!results.length) { 
    c.innerHTML = '<div class="empty">No runs yet. Select models and click Run.</div>'; 
    count.style.display = 'none';
    return; 
  }
  count.style.display = '';
  count.textContent = results.length + ' result' + (results.length > 1 ? 's' : '');
  c.innerHTML = results.map((res, i) => {
    const isApp = approved.some(a => a.index === i);
    const isRej = res.rejected && !isApp;
    const badge = isApp ? '<span class="status-badge approved">✓ APPROVED</span>' : isRej ? '<span class="status-badge rejected">✕ REJECTED</span>' : '';
    return (
      '<div class="result-card ' + (isApp ? 'approved' : '') + (isRej ? 'rejected' : '') + '">' +
        '<div class="card-header">' +
          '<span class="name">' + res.model + '</span>' +
          '<span class="prov">' + badge + '</span>' +
        '</div>' +
        '<div class="card-body">' + (res.output || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
        '<div class="card-meta">' +
          '<span>Tokens: ' + fmtTokens(res.tokens) + '</span>' +
          '<span>Cost: ' + fmtCost(res.model, res.tokensIn, res.tokensOut) + '</span>' +
          '<span>' + (res.elapsedMs ? (res.elapsedMs + 'ms') : '') + '</span>' +
        '</div>' +
        '<div class="card-actions">' +
          '<button class="approve-btn" onclick="approveResult(' + i + ')" ' + (isApp ? 'disabled' : '') + '>✓ Approve</button>' +
          '<button class="reject-btn" onclick="rejectResult(' + i + ')" ' + (isRej ? 'disabled' : '') + '>✕ Reject</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function renderApproved() {
  const sec = document.getElementById('approved-section');
  const list = document.getElementById('approved-list');
  if (!approved.length) { sec.style.display = 'none'; list.innerHTML = ''; return; }
  sec.style.display = '';
  list.innerHTML = approved.map((a, i) =>
    '<div class="approved-item">' +
      '<span class="ai">' + a.model + '</span>' +
      '<span class="txt">' + (a.output || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</span>' +
      '<span class="del" onclick="unapprove(' + i + ')" title="Remove">&times;</span>' +
    '</div>'
  ).join('');
}

function approveResult(i) {
  const r = results[i];
  if (!r || approved.some(a => a.index === i)) return;
  approved.push({ index: i, model: r.model, output: r.output, tokens: r.tokens, tokensIn: r.tokensIn, tokensOut: r.tokensOut });
  renderResults();
  renderApproved();
}

function rejectResult(i) {
  if (!results[i]) return;
  results[i].rejected = true;
  renderResults();
}

function unapprove(i) {
  approved.splice(i, 1);
  renderResults();
  renderApproved();
}

function clearResults() {
  results = [];
  approved = [];
  renderResults();
  renderApproved();
  document.getElementById('status').textContent = '';
}

async function runAll() {
  const selected = getSelectedModels();
  if (!selected.length) { setStatus('status', 'Select at least one model.', 'err'); return; }
  const system = document.getElementById('system-prompt').value;
  const user = document.getElementById('user-prompt').value;
  if (!user.trim()) { setStatus('status', 'User prompt is required.', 'err'); return; }

  const btn = document.getElementById('run-btn');
  btn.disabled = true;
  results = [];
  approved = [];
  renderResults();
  renderApproved();
  setStatus('status', 'Running…', '');

  const payload = { models: selected, system, user };
  const start = performance.now();
  try {
    const r = await fetch('/api/dojo/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok) { setStatus('status', 'Error: ' + (j.error || r.status), 'err'); btn.disabled = false; return; }
    const elapsed = Math.round(performance.now() - start);
    results = (j.results || []).map(res => ({
      model: res.model || res.modelId || '',
      output: res.output || res.text || res.content || '',
      tokens: res.tokens || res.tokensTotal || (res.tokensIn && res.tokensOut ? res.tokensIn + res.tokensOut : null),
      tokensIn: res.tokensIn || null,
      tokensOut: res.tokensOut || null,
      elapsedMs: res.elapsedMs || elapsed,
      rejected: false,
    }));
    renderResults();
    setStatus('status', 'Done — ' + results.length + ' results in ' + elapsed + 'ms', 'ok');
  } catch (e) {
    setStatus('status', 'Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

async function saveToArticle() {
  if (!approved.length) { setStatus('save-status', 'Approve at least one output first.', 'err'); return; }
  const slug = document.getElementById('article-slug').value.trim();
  const title = document.getElementById('article-title').value.trim();
  if (!slug) { setStatus('save-status', 'Slug required.', 'err'); return; }
  if (!title) { setStatus('save-status', 'Title required.', 'err'); return; }

  const body = approved.map(a => '## ' + a.model + '\n\n' + a.output).join('\n\n---\n\n');
  const meta = { model: approved.map(a => a.model).join(' + '), ledger: approved.map(a => ({ model: a.model, tokens: a.tokens })) };

  try {
    const r = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, title, body, meta }),
    });
    const j = await r.json();
    if (!r.ok) { setStatus('save-status', 'Save failed: ' + (j.error || r.status), 'err'); return; }
    setStatus('save-status', 'Saved to article "' + j.slug + '".', 'ok');
  } catch (e) {
    setStatus('save-status', 'Save error: ' + e.message, 'err');
  }
}

loadModels();
</script>
`;

export async function onRequestGet() {
  return new Response(
    shellHtml({ activeHref: '/admin/dojo', title: 'Dojo', body: BODY }),
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );
}
