import { shellHtml } from '../_layout.js';
import { invalidateDirSnapshot } from '../../_lib/dir_snapshot.js';
import { deriveInvoke, renderInvokeText } from '../../_lib/invoke_spec.js';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function detectCompanyFromAuth(auth) {
  const a = String(auth).toLowerCase();
  if (a.includes('grok') || a.includes('xai')) return 'xai';
  if (a.includes('openai')) return 'openai';
  if (a.includes('anthropic') || a.includes('claude')) return 'anthropic';
  if (a.includes('gemini') || a.includes('google')) return 'google';
  if (a.includes('cloudflare')) return 'cloudflare';
  if (a.includes('kimi') || a.includes('moonshot')) return 'cloudflare'; // moonshot models are in cloudflare registry
  return null;
}

export async function onRequestGet(context) {
  const { params, env } = context;
  const key = String(params.key || '').trim();
  if (!key) return new Response('key required', { status: 400 });
  // article:<slug> projections open the article's own control surface, not a directory form.
  if (key.startsWith('article:')) {
    return Response.redirect(new URL('/admin/articles/' + encodeURIComponent(key.slice(8)), context.request.url), 302);
  }

  const row = await env.DB.prepare(
    'SELECT key, type, target, auth, content, updated_at, category, allowed_categories, seq, ' +
    'enabled, planner_visible, planner_rank, input_schema, examples ' +
    'FROM directory WHERE key = ?'
  ).bind(key).first();
  if (!row) return new Response('Not found: ' + key, { status: 404 });

  const isAgent = row.type === 'agent';
  const invokeText = isAgent ? '' : renderInvokeText(deriveInvoke(row), esc);

  // Load per-agent settings for agent rows
  let agentSettings = { model: '', reasoning: '', temperature: '', webSearch: '' };
  if (isAgent) {
    const s = await Promise.all([
      env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key + '_model').first().catch(() => null),
      env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key + '_reasoning_effort').first().catch(() => null),
      env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key + '_temperature').first().catch(() => null),
      env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key + '_web_search').first().catch(() => null),
    ]);
    agentSettings = {
      model: s[0]?.value ?? '',
      reasoning: s[1]?.value ?? '',
      temperature: s[2]?.value ?? '',
      webSearch: s[3]?.value ?? '',
    };
  }
  const company = isAgent ? detectCompanyFromAuth(row.auth) : null;
  const effectiveModel = agentSettings.model || row.target || '';

  const form = `
<style>
.main-edit{max-width:1100px}
.main-edit textarea{width:100%;min-height:${isAgent ? '420' : '180'}px;font-family:var(--mono);font-size:13px;line-height:1.5}
.main-edit .meta{font-size:12px;color:var(--muted);margin:4px 0 10px}
#save-status{margin-left:12px;font-size:13px;color:#178c45;font-weight:500}
.test-card{border:1px solid var(--line);border-radius:8px;padding:14px 16px;background:var(--panel);margin:18px 0;max-width:1100px}
.test-card h2{font-size:14px;margin:0 0 8px}
.test-card .hint{font-size:12.5px;color:var(--muted);margin-bottom:8px;line-height:1.5}
.test-card input{width:100%;font-family:var(--mono);font-size:13px}
.test-card pre{margin-top:10px;max-height:400px;overflow:auto;font-size:12.5px;background:#fff;border:1px solid var(--line)}
details.adv{margin:18px 0;max-width:1100px}
details.adv summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--ink-soft);padding:6px 0}
.adv-grid{display:grid;grid-template-columns:160px 1fr;gap:10px;align-items:center;margin-top:10px}
.adv-grid label{font-size:12.5px;color:var(--ink-soft);font-weight:600}
.adv-grid input,.adv-grid select{width:100%}
.adv-grid .hint{grid-column:2;font-size:11.5px;color:var(--muted);margin-top:-6px}
</style>
<h1>${esc(row.key)} <span class="type-chip">${esc(row.type)}</span></h1>
<p class="subtitle">${isAgent ? 'This agent IS its prompt — edit it below and Save; the change is live on the next message.' : 'Exactly what this tool is and exactly how to call it is spelled out below. Edit the template and Save.'}</p>

<div class="test-card" style="border-color:#0a52d0">
  <h2>Raw outbound payload — exactly what this fires (dry-run, not sent)</h2>
  <div class="hint">The real request this ${isAgent ? 'agent' : 'tool'} sends, built from its template + auth (secret VALUES redacted). Auto-loaded with empty args; type real args in "Shape &amp; invoke" below to re-render.</div>
  <pre id="raw-payload">loading…</pre>
</div>

${isAgent ? '' : `<div class="test-card" style="border-color:#178c45">
    <h2>How to invoke — exactly</h2>
    <div class="hint">Computed from this row's own definition (its template, target, and doc lines). The args below are the real args the dispatcher substitutes — not a placeholder.</div>
    <pre id="invoke-spec">${invokeText}</pre>
  </div>`}

<form id="edit-form" class="main-edit">
  <input type="hidden" name="key" value="${esc(row.key)}">
  <textarea name="content" spellcheck="false">${esc(row.content)}</textarea>
  <div class="meta">last updated ${esc(row.updated_at)} · ${(row.content || '').length} chars${isAgent ? ' · model: ' + esc(row.target) : ''}</div>
  <button type="button" onclick="save()">Save</button>
  <span id="save-status"></span>

  <div class="test-card">
    <h2>REST — manage this row (raw JSON, this works)</h2>
    <div class="hint">Read / create-update / patch / delete the row itself. To CALL the tool, use the green "How to invoke" block above.</div>
    <pre id="invoke-block">read    GET    https://miscsubjects.com/api/directory/${esc(row.key)}

update  PUT    https://miscsubjects.com/api/directory/${esc(row.key)}
  curl -X PUT https://miscsubjects.com/api/directory/${esc(row.key)} -H "content-type: application/json" \
    -d '${esc(JSON.stringify({ type: row.type, target: row.target || '', auth: row.auth || '', content: row.content || '', category: row.category || null }))}'

patch   PATCH  https://miscsubjects.com/api/directory/${esc(row.key)}
  curl -X PATCH https://miscsubjects.com/api/directory/${esc(row.key)} -H "content-type: application/json" -d '{"content":"..."}'

delete  DELETE https://miscsubjects.com/api/directory/${esc(row.key)}</pre>
  </div>

  <div class="test-card">
    <h2>Shape &amp; invoke</h2>
    <div class="hint">${isAgent
      ? 'Sends this text to the agent via the kernel (a real dispatch — tools it emits WILL run). The full chain lands in <a href="/admin/trace">Trace</a>.'
      : 'Args separated by | exactly as an agent would emit them. <b>Shape</b> = see the fully-built outbound payload WITHOUT sending. <b>Dispatch</b> = a LIVE call (see response).'}</div>
    <input id="test-body" placeholder="${isAgent ? 'message for the agent...' : 'arg1|arg2|...'}" onkeydown="if(event.key==='Enter'){event.preventDefault();runTest()}">
    <div style="margin-top:8px">
      <button type="button" onclick="shapeIt()">Shape (no send)</button>
      <button type="button" onclick="runTest()">Dispatch (live)</button>
      <span id="test-status" style="font-size:12.5px;color:var(--muted)"></span>
    </div>
    <pre id="test-out">(nothing yet)</pre>
  </div>

  ${isAgent ? `
  <div class="test-card" style="border-color:#d35400">
    <h2>Agent model &amp; runtime</h2>
    <div class="hint">Model, reasoning, temperature, and web search for this agent. Per-agent overrides are saved to settings; they beat the global defaults on the next dispatch.</div>
    <div class="adv-grid">
      <label>model</label>
      <select id="a-model" onchange="onModelChange()"></select>
      <div class="hint" id="a-model-hint">loading registry…</div>
      <label>reasoning</label>
      <select id="a-reasoning">
        <option value="">(default / none)</option>
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
        <option value="none">none</option>
      </select>
      <label>temperature</label>
      <input id="a-temp" type="number" step="0.05" min="0" max="2" value="${esc(agentSettings.temperature || '1')}">
      <label>web search</label>
      <select id="a-websearch">
        <option value="">(default / off)</option>
        <option value="1">on</option>
        <option value="0">off</option>
      </select>
    </div>
  </div>
  ` : ''}

  <details class="adv">
    <summary>Advanced fields (type / target / auth / category / planner)</summary>
    <div class="adv-grid">
      <label>type</label><select name="type">${['fn','http','agent','flow'].map(t => `<option value="${t}"${row.type === t ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <label>target</label><input type="text" name="target" id="adv-target" value="${esc(row.target)}">
      <div class="hint">fn → FN_MAP name · http → "METHOD url" · agent → model id · flow → blank (content is the DSL)</div>
      <label>auth</label><input type="text" name="auth" value="${esc(row.auth)}">
      <label>category</label><input type="text" name="category" value="${esc(row.category || '')}">
      <label>allowed_categories</label><input type="text" name="allowed_categories" value="${esc(row.allowed_categories || '')}">
      <div class="hint">agent rows only</div>
      <label>enabled</label><select name="enabled">${[1,0].map(v => `<option value="${v}"${Number(row.enabled ?? 1) === v ? ' selected' : ''}>${v}</option>`).join('')}</select>
      <label>planner_visible</label><select name="planner_visible">${[1,0].map(v => `<option value="${v}"${Number(row.planner_visible ?? 1) === v ? ' selected' : ''}>${v}</option>`).join('')}</select>
      <label>planner_rank</label><input type="number" name="planner_rank" value="${row.planner_rank == null ? 100 : row.planner_rank}">
      <label>input_schema</label><input type="text" name="input_schema" value="${esc(row.input_schema || '')}">
      <label>examples</label><input type="text" name="examples" value="${esc(row.examples || '')}">
      <label>seq</label><input type="number" name="seq" value="${row.seq == null ? '' : row.seq}">
    </div>
  </details>
</form>

<script>
const IS_AGENT = ${JSON.stringify(isAgent)};
const ROW_KEY = ${JSON.stringify(row.key)};
const ROW_AUTH = ${JSON.stringify(row.auth || '')};
const EFFECTIVE_MODEL = ${JSON.stringify(effectiveModel)};
const AGENT_REASONING = ${JSON.stringify(agentSettings.reasoning)};
const AGENT_WEBSEARCH = ${JSON.stringify(agentSettings.webSearch)};

function detectCompany(auth){
  const a = String(auth).toLowerCase();
  if (a.includes('grok') || a.includes('xai')) return 'xai';
  if (a.includes('openai')) return 'openai';
  if (a.includes('anthropic') || a.includes('claude')) return 'anthropic';
  if (a.includes('gemini') || a.includes('google')) return 'google';
  if (a.includes('cloudflare')) return 'cloudflare';
  if (a.includes('kimi') || a.includes('moonshot')) return 'cloudflare';
  return null;
}

async function loadAgentControls(){
  if (!IS_AGENT) return;
  const company = detectCompany(ROW_AUTH);
  const reg = await fetch('/api/providers').then(r => r.json());
  const prov = company ? reg.providers[company] : null;
  const sel = document.getElementById('a-model');
  const hint = document.getElementById('a-model-hint');
  if (!prov) {
    sel.innerHTML = '<option>' + EFFECTIVE_MODEL + '</option>';
    hint.textContent = 'unknown company from auth: ' + ROW_AUTH + ' — edit target manually in Advanced fields';
    return;
  }
  const models = prov.models.filter(m => m.modality === 'text').map(m => m.model_id);
  sel.innerHTML = models.map(m => '<option value="'+m+'"'+(m===EFFECTIVE_MODEL?' selected':'')+'>'+m+'</option>').join('');
  hint.textContent = 'company: ' + company + ' · key: ' + prov.api_key_name + ' · ' + models.length + ' text models';
  // pre-select reasoning
  document.getElementById('a-reasoning').value = AGENT_REASONING;
  // pre-select web search
  document.getElementById('a-websearch').value = AGENT_WEBSEARCH;
  onModelChange();
}

function onModelChange(){
  if (!IS_AGENT) return;
  const model = document.getElementById('a-model').value;
  document.getElementById('adv-target').value = model;
}

async function saveAgentSettings(){
  if (!IS_AGENT) return;
  const model = document.getElementById('a-model').value;
  const reasoning = document.getElementById('a-reasoning').value;
  const temp = document.getElementById('a-temp').value;
  const web = document.getElementById('a-websearch').value;
  const base = '/api/settings/';
  const ops = [];
  if (reasoning) ops.push(fetch(base + ROW_KEY + '_reasoning_effort', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({value:reasoning})}));
  else ops.push(fetch(base + ROW_KEY + '_reasoning_effort', {method:'DELETE'}));
  if (temp !== '' && temp != null) ops.push(fetch(base + ROW_KEY + '_temperature', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({value:String(temp)})}));
  else ops.push(fetch(base + ROW_KEY + '_temperature', {method:'DELETE'}));
  if (web) ops.push(fetch(base + ROW_KEY + '_web_search', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({value:web})}));
  else ops.push(fetch(base + ROW_KEY + '_web_search', {method:'DELETE'}));
  // If the model differs from the original target, also save as per-agent override
  if (model !== EFFECTIVE_MODEL) ops.push(fetch(base + ROW_KEY + '_model', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({value:model})}));
  else ops.push(fetch(base + ROW_KEY + '_model', {method:'DELETE'}));
  await Promise.all(ops);
}

async function save(){
  const f = document.getElementById('edit-form');
  const payload = {
    key: f.key.value, type: f.type.value, target: f.target.value, auth: f.auth.value,
    content: f.content.value, category: f.category.value, allowed_categories: f.allowed_categories.value,
    seq: f.seq.value ? parseInt(f.seq.value, 10) : null,
    enabled: parseInt(f.enabled.value, 10), planner_visible: parseInt(f.planner_visible.value, 10),
    planner_rank: f.planner_rank.value === '' ? 100 : parseInt(f.planner_rank.value, 10),
    input_schema: f.input_schema.value, examples: f.examples.value,
  };
  const s = document.getElementById('save-status');
  s.textContent = 'Saving...';
  const res = await fetch(location.pathname, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const j = await res.json();
  if (j.ok) {
    await saveAgentSettings();
    s.textContent = 'Saved at ' + j.updated_at + ' (row + agent settings)';
  } else {
    s.textContent = 'Error: ' + (j.error || res.status);
  }
}
async function shapeIt(){
  const body = document.getElementById('test-body').value;
  const st = document.getElementById('test-status');
  const out = document.getElementById('test-out');
  st.textContent = 'shaping (no send)...';
  out.textContent = '';
  try {
    const r = await fetch('/api/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: ROW_KEY, body, shape: true }) });
    const j = await r.json();
    st.textContent = 'shaped — not sent';
    let payload = j.result;
    try { payload = JSON.stringify(JSON.parse(String(j.result).replace(/^SHAPED:not_sent$/, '{}')), null, 2); } catch {}
    out.textContent = 'OUTBOUND PAYLOAD (would be sent):\\n' + String(j.result || '(none)');
  } catch (e) { st.textContent = 'error'; out.textContent = String(e); }
}
async function runTest(){
  const body = document.getElementById('test-body').value;
  const st = document.getElementById('test-status');
  const out = document.getElementById('test-out');
  st.textContent = 'dispatching... (live; agent turns can take a while)';
  out.textContent = '';
  try {
    const r = await fetch('/api/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: ROW_KEY, body }) });
    const j = await r.json();
    st.innerHTML = 'trace <a href="/admin/trace?trace=' + encodeURIComponent(j.trace) + '">' + j.trace + '</a> · cost $' + (j.cost || 0).toFixed(4);
    out.textContent = String(j.result || '');
  } catch (e) { st.textContent = 'error'; out.textContent = String(e); }
}
async function loadRaw(){
  const out = document.getElementById('raw-payload');
  if (!out) return;
  try {
    const r = await fetch('/api/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: ROW_KEY, body: '', shape: true }) });
    const j = await r.json();
    out.textContent = String(j.result || '(this type produces no outbound payload)');
  } catch (e) { out.textContent = 'error: ' + e; }
}
loadRaw();
loadAgentControls();
</script>
`;

  return new Response(shellHtml({ activeHref: '/admin/directory', title: row.key, body: form }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequestPost(context) {
  const { params, env, request } = context;
  const key = String(params.key || '').trim();
  if (!key) return new Response(JSON.stringify({ ok: false, error: 'key required' }), { status: 400, headers: { 'content-type': 'application/json' } });

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'invalid json' }), { status: 400, headers: { 'content-type': 'application/json' } }); }

  const type = String(body.type || '').trim();
  if (!['fn','http','agent','flow'].includes(type)) {
    return new Response(JSON.stringify({ ok: false, error: 'bad type' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const target  = String(body.target == null ? '' : body.target);
  const auth    = String(body.auth == null ? '' : body.auth);
  const content = String(body.content == null ? '' : body.content);
  const category = String(body.category == null ? '' : body.category);
  const allowed = String(body.allowed_categories == null ? '' : body.allowed_categories);
  const seq = body.seq == null || body.seq === '' ? null : parseInt(body.seq, 10);
  const enabled = body.enabled == null ? 1 : (parseInt(body.enabled, 10) ? 1 : 0);
  const plannerVisible = body.planner_visible == null ? 1 : (parseInt(body.planner_visible, 10) ? 1 : 0);
  const plannerRank = body.planner_rank == null || body.planner_rank === '' ? 100 : parseInt(body.planner_rank, 10);
  const inputSchema = body.input_schema == null ? null : (String(body.input_schema) || null);
  const examples = body.examples == null ? null : (String(body.examples) || null);
  const ts = new Date().toISOString();

  await env.DB.prepare(
    'INSERT INTO directory (key, type, target, auth, content, updated_at, category, allowed_categories, seq, enabled, planner_visible, planner_rank, input_schema, examples) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET type=excluded.type, target=excluded.target, auth=excluded.auth, content=excluded.content, updated_at=excluded.updated_at, category=excluded.category, allowed_categories=excluded.allowed_categories, seq=excluded.seq, enabled=excluded.enabled, planner_visible=excluded.planner_visible, planner_rank=excluded.planner_rank, input_schema=excluded.input_schema, examples=excluded.examples'
  ).bind(key, type, target, auth, content, ts, category || null, allowed || null, seq, enabled, plannerVisible, plannerRank, inputSchema, examples).run();

  if (env.KV) {
    await invalidateDirSnapshot(env);
  }

  return new Response(JSON.stringify({ ok: true, updated_at: ts }), {
    headers: { 'content-type': 'application/json' },
  });
}
