import { shellHtml } from './_layout.js';

const BODY = `
<style>
.run{display:grid;gap:14px;max-width:900px}
.run label{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);display:block;margin-bottom:4px}
.run input[type=text],.run textarea,.run select{width:100%;font-family:var(--mono);font-size:13px}
.run textarea{min-height:90px}
.run .row{display:flex;gap:14px;flex-wrap:wrap}.run .row>div{flex:1;min-width:180px}
.models{display:flex;gap:14px;flex-wrap:wrap;font-family:var(--mono);font-size:12px}
.models label{display:flex;gap:6px;align-items:center;text-transform:none;letter-spacing:0;color:var(--ink)}
pre{background:#fff;color:#000;border:1px solid var(--line);border-radius:8px;padding:12px;white-space:pre-wrap;font-size:12px;max-height:520px;overflow:auto}
.hint{color:var(--muted);font-size:12px}
</style>
<h1>Run</h1>
<p class="subtitle">Write a small ask. Pick targets and models. Every model's answer is stored on the page as a contribution. Accept one to make it the canonical field — it then propagates to every page that peptide is on.</p>
<div class="run">
  <div>
    <label>Targets</label>
    <input id="targets" type="text" placeholder="topic-001, peptide-bpc-157   —or—   tag:BPC-157   —or—   type:peptide">
    <div class="hint">comma-separated slugs, or <code>tag:NAME</code> (every page that tag is on), or <code>type:peptide</code></div>
  </div>
  <div class="row">
    <div><label>Mode</label><select id="mode"><option value="confluence">confluence (audition + score)</option><option value="text">text (field)</option><option value="image">image</option></select></div>
    <div><label>Field key</label><input id="field" type="text" value="def_mechanism_25w"></div>
    <div><label>Words</label><input id="words" type="text" value="25"></div>
  </div>
  <div>
    <label>System prompt</label>
    <textarea id="prompt">Write a definition of how this peptide works, in plain words a normal person understands.</textarea>
  </div>
  <div>
    <label>Models</label>
    <div class="models">
      <label><input type="checkbox" class="m" value="@cf/meta/llama-3.3-70b-instruct-fp8-fast" checked> cloudflare-llama</label>
      <label><input type="checkbox" class="m" value="@cf/qwen/qwen2.5-coder-32b-instruct"> cloudflare-qwen</label>
      <label><input type="checkbox" class="m" value="openai:gpt-4o-mini"> gpt</label>
      <label><input type="checkbox" class="m" value="grok:grok-2-latest"> grok</label>
      <label><input type="checkbox" class="m" value="gemini:gemini-1.5-flash"> gemini</label>
      <label><input type="checkbox" class="m" value="kimi:moonshot-v1-8k"> kimi</label>
    </div>
    <div class="hint">models with no key configured return <code>[skip: no key]</code> — cloudflare models always run.</div>
  </div>
  <div class="row">
    <div><label>Accept (make canonical)</label><input id="accept" type="text" placeholder="@cf/meta/llama-3.3-70b-instruct-fp8-fast (optional)"></div>
  </div>
  <div><button onclick="fire()">Run</button> <span id="status" class="hint"></span></div>
  <pre id="out">—</pre>
</div>
<script>
function parseTargets(s){ s=s.trim(); if(s.startsWith('tag:'))return{tag:s.slice(4).trim()}; if(s.startsWith('type:'))return{type:s.slice(5).trim()}; return s.split(',').map(x=>x.trim()).filter(Boolean); }
async function fire(){
  const status=document.getElementById('status'); status.textContent='running…';
  const models=[...document.querySelectorAll('.m:checked')].map(x=>x.value);
  const payload={ targets:parseTargets(document.getElementById('targets').value), mode:document.getElementById('mode').value,
    field:document.getElementById('field').value||null, words:parseInt(document.getElementById('words').value)||null,
    prompt:document.getElementById('prompt').value, models, accept:document.getElementById('accept').value.trim()||undefined };
  try{ const r=await fetch('/api/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const j=await r.json(); document.getElementById('out').textContent=JSON.stringify(j,null,2); status.textContent='done'; }
  catch(e){ status.textContent='error: '+e.message; }
}
</script>`;

export async function onRequestGet() {
  return new Response(shellHtml('Run', BODY), { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
