import { shellHtml } from './_layout.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const BODY = `
<style>
.gen-page{max-width:1200px}
.gen-page h3{font:600 10px/1 var(--mono);text-transform:uppercase;letter-spacing:.15em;color:var(--accent);margin:var(--space-3,22px) 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.gen-page .ref-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:var(--space-3,18px)}
.gen-page .ref-card{border:1px solid var(--line);border-radius:var(--radius,10px);overflow:hidden;cursor:pointer;background:var(--panel);transition:border-color .12s,transform .12s}
.gen-page .ref-card:hover{border-color:var(--line-strong);transform:translateY(-1px)}
.gen-page .ref-card.selected{border-color:var(--accent);box-shadow:0 0 0 3px var(--ds-accent-soft,rgba(201,169,97,.12))}
.gen-page .ref-card img{width:100%;height:150px;object-fit:cover;display:block;background:var(--raised,#1d2129)}
.gen-page .ref-card .meta{padding:7px 9px;font-size:12px;color:var(--ink-soft)}
.gen-page .prompt-row{display:flex;gap:10px;align-items:flex-end;margin-bottom:12px;flex-wrap:wrap}
.gen-page textarea{flex:1;min-width:300px;min-height:80px;font-family:var(--mono);font-size:13px}
.gen-page select{padding:7px 10px;font-size:13px}
.gen-page button{padding:8px 18px;font-size:13px;border-radius:999px;border-color:var(--accent);color:var(--accent)}
.gen-page button:hover{background:var(--ds-accent-soft,rgba(201,169,97,.12));color:var(--accent)}
.gen-page .status{font-size:13px;margin-top:8px;color:var(--muted)}
.gen-page .status.ok{color:var(--ds-sage,#7a9a7b)}
.gen-page .status.err{color:#b86b5a}
.gen-page .output-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-top:14px}
.gen-page .output-card{border:1px solid var(--line);border-radius:var(--radius,10px);overflow:hidden;background:var(--panel)}
.gen-page .output-card img{width:100%;height:200px;object-fit:cover;display:block;background:var(--raised,#1d2129)}
.gen-page .output-card .meta{padding:7px 9px;font-size:11px;color:var(--muted)}
</style>

<div class="gen-page">

<h1>Generate Ads</h1>
<p class="subtitle">Pick a reference image, type a prompt, generate new ad images. Results are saved to R2 and Assets.</p>

<h3>Reference Images</h3>
<div class="ref-grid" id="refs"></div>

<div class="prompt-row">
  <textarea id="prompt" placeholder="e.g., the tenant peptide vial on a marble surface with dramatic lighting, luxury wellness ad style"></textarea>
  <select id="size">
    <option value="1024x1024">Square (1:1)</option>
    <option value="1024x1536">Portrait (2:3)</option>
    <option value="1536x1024">Landscape (3:2)</option>
  </select>
  <button onclick="generate()">Generate</button>
</div>
<div id="status" class="status"></div>

<h3>Generated</h3>
<div class="output-grid" id="output"></div>

</div>

<script>
let refs = [];
let selectedRef = null;

async function loadRefs() {
  const r = await fetch('/admin/assets?data=1&category=reference');
  const d = await r.json();
  refs = d.results || [];
  const el = document.getElementById('refs');
  el.innerHTML = refs.map(a =>
    '<div class="ref-card" data-id="'+a.id+'" onclick="pick(this)">' +
    '<img src="'+a.url+'">' +
    '<div class="meta">'+(a.label||a.id)+'</div></div>'
  ).join('');
}

function pick(card) {
  document.querySelectorAll('.ref-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  selectedRef = refs.find(r => r.id === card.dataset.id);
}

async function generate() {
  const prompt = document.getElementById('prompt').value.trim();
  const size = document.getElementById('size').value;
  const st = document.getElementById('status');
  if (!prompt) { st.textContent = 'Enter a prompt'; st.className = 'status err'; return; }
  if (!selectedRef) { st.textContent = 'Select a reference image'; st.className = 'status err'; return; }
  st.textContent = 'Generating...'; st.className = 'status';
  const r = await fetch('/admin/generate', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({prompt, size, refUrl: selectedRef.url, refId: selectedRef.id}),
  });
  const d = await r.json();
  if (!r.ok) { st.textContent = 'Failed: ' + (d.error||r.status); st.className = 'status err'; return; }
  st.textContent = 'Done. Saved to Assets.'; st.className = 'status ok';
  loadOutput();
  setTimeout(() => { st.textContent = ''; st.className = 'status'; }, 3000);
}

async function loadOutput() {
  const r = await fetch('/admin/assets?data=1&category=generated');
  const d = await r.json();
  const g = document.getElementById('output');
  if (!d.results.length) { g.innerHTML = '<p style="color:var(--muted)">none yet</p>'; return; }
  g.innerHTML = d.results.map(a =>
    '<div class="output-card"><a href="'+a.url+'" target="_blank"><img src="'+a.url+'"></a>' +
    '<div class="meta">'+(a.label||'')+' · '+(a.created_at||'').slice(0,16)+'</div></div>'
  ).join('');
}

loadRefs();
loadOutput();
</script>
`;

export async function onRequestGet() {
  return new Response(shellHtml({ activeHref: '/admin/generate', title: 'Generate Ads', body: BODY }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function storeB64Png(env, b64, source) {
  const key = `img/${source}/${crypto.randomUUID()}.png`;
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  await env.R2.put(key, buf, { httpMetadata: { contentType: 'image/png' } });
  return 'https://miscsubjects.com/' + key;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const prompt = String(body.prompt || '');
  const size = String(body.size || '1024x1024');
  const refUrl = body.refUrl || '';
  const refId = body.refId || '';
  if (!prompt) return json({ error: 'prompt required' }, 400);
  if (!env.OPENAI_API_KEY) return json({ error: 'no_openai_key' }, 500);

  const apiBody = refUrl
    ? { model: 'gpt-image-1', prompt, images: [{ image_url: refUrl }], n: 1, size }
    : { model: 'gpt-image-1', prompt, n: 1, size };
  const apiUrl = refUrl ? 'https://api.openai.com/v1/images/edits' : 'https://api.openai.com/v1/images/generations';

  const r = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(apiBody),
  });
  const j = await r.json();
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) return json({ error: 'openai_failed', detail: JSON.stringify(j).slice(0, 300) }, 500);

  const url = await storeB64Png(env, b64, 'openai');
  const id = crypto.randomUUID();
  const r2Key = url.replace('https://miscsubjects.com/', '');
  await env.DB.prepare(
    'INSERT INTO assets (id, created_at, category, label, r2_key, url, engine, prompt, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, new Date().toISOString(), 'generated', prompt.slice(0, 80), r2Key, url, 'openai', prompt, refId || null).run();

  return json({ id, url, prompt });
}
