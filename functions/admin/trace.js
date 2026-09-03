import { shellHtml } from './_layout.js';

async function fullField(env, jsonField, previewField, r2key) {
  if (jsonField != null && jsonField !== '') return jsonField;
  if (r2key && env.R2) {
    try { const o = await env.R2.get(r2key); if (o) return await o.text(); } catch {}
  }
  return previewField != null && previewField !== '' ? previewField : null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const data = url.searchParams.get('data');

  if (data === 'turns') {
    const r = await env.LEDGER.prepare(
      "SELECT ts, request_json, request_preview FROM events WHERE source='blooio' AND action='send' ORDER BY ts DESC LIMIT 120"
    ).all();
    const turns = [];
    for (const row of (r.results || [])) {
      let p; try { p = JSON.parse(row.request_json || row.request_preview); } catch { continue; }
      if (!p || !p.router) continue;
      turns.push({ ts: row.ts, phase: p.phase, chat: p.chat, from: p.from, jobId: p.jobId || null,
        trace: p.trace, routed: p.routed || p.agent || null, reply: (p.reply || '').slice(0, 140),
        sent_images: p.sent_images, pending_renders: p.pending_renders });
    }
    return new Response(JSON.stringify({ turns }), { headers: { 'content-type': 'application/json' } });
  }

  if (data === 'chain') {
    const job = url.searchParams.get('job');
    const trace = url.searchParams.get('trace');
    const traces = new Set();
    let chat = null, firstTs = null, lastTs = null;
    if (job) {
      const r = await env.LEDGER.prepare(
        "SELECT ts, request_json, request_preview FROM events WHERE source='blooio' AND action='send' AND (request_preview LIKE ? OR request_json LIKE ?) ORDER BY ts LIMIT 10"
      ).bind('%"jobId":' + job + '%', '%"jobId":' + job + '%').all();
      for (const row of (r.results || [])) {
        let p; try { p = JSON.parse(row.request_json || row.request_preview); } catch { continue; }
        if (p && p.trace) { traces.add(p.trace); chat = chat || p.chat; }
        firstTs = firstTs || row.ts; lastTs = row.ts;
      }
    }
    if (trace) traces.add(trace);
    if (!traces.size) return new Response(JSON.stringify({ error: 'no traces found' }), { headers: { 'content-type': 'application/json' } });

    const steps = [];
    for (const t of traces) {
      const r = await env.LEDGER.prepare(
        'SELECT id, ts, source, key, action, direction, step, parent, status, request_json, request_preview, response_json, response_preview, r2_request_key, r2_response_key ' +
        'FROM events WHERE trace_id = ? ORDER BY ts, step'
      ).bind(t).all();
      for (const row of (r.results || [])) {
        const req = await fullField(env, row.request_json, row.request_preview, row.r2_request_key);
        const res = await fullField(env, row.response_json, row.response_preview, row.r2_response_key);
        steps.push({ id: row.id, trace: t, ts: row.ts, source: row.source, key: row.key, action: row.action, direction: row.direction, step: row.step, parent: row.parent, status: row.status, request: req, response: res });
        firstTs = firstTs && firstTs < row.ts ? firstTs : row.ts;
        lastTs = lastTs && lastTs > row.ts ? lastTs : row.ts;
      }
    }
    steps.sort((a, b) => a.ts < b.ts ? -1 : (a.ts > b.ts ? 1 : (a.step || 0) - (b.step || 0)));

    let inbound = null;
    if (chat && firstTs) {
      const r = await env.LEDGER.prepare(
        "SELECT ts, request_json, request_preview FROM events WHERE action='webhook_in' AND ts <= ? AND (request_json LIKE ? OR request_preview LIKE ?) ORDER BY ts DESC LIMIT 1"
      ).bind(firstTs, '%' + chat + '%', '%' + chat + '%').all();
      const row = (r.results || [])[0];
      if (row) inbound = { ts: row.ts, raw: row.request_json || row.request_preview };
    }

    let providerHttp = [];
    if (firstTs && lastTs) {
      const r = await env.LEDGER.prepare(
        "SELECT ts, source, key, request_json, request_preview, response_json, response_preview, r2_request_key, r2_response_key, status FROM events WHERE action='http_out' AND ts >= ? AND ts <= ? ORDER BY ts LIMIT 40"
      ).bind(firstTs, new Date(Date.parse(lastTs) + 120000).toISOString()).all();
      for (const row of (r.results || [])) {
        const rq = await fullField(env, row.request_json, row.request_preview, row.r2_request_key);
        const rs = await fullField(env, row.response_json, row.response_preview, row.r2_response_key);
        providerHttp.push({ ts: row.ts, source: row.source, key: row.key, status: row.status, request: rq, response: rs });
      }
    }

    let blooioOut = [];
    if (chat && firstTs) {
      const r = await env.LEDGER.prepare(
        "SELECT ts, action, request_json, request_preview, response_json, response_preview, r2_request_key, r2_response_key, status FROM events WHERE source='blooio' AND ts >= ? AND ts <= ? AND (request_preview LIKE ? OR request_json LIKE ?) ORDER BY ts LIMIT 20"
      ).bind(firstTs, new Date(Date.parse(lastTs || firstTs) + 180000).toISOString(), '%' + chat + '%', '%' + chat + '%').all();
      for (const row of (r.results || [])) {
        const rq = await fullField(env, row.request_json, row.request_preview, row.r2_request_key);
        const rs = await fullField(env, row.response_json, row.response_preview, row.r2_response_key);
        blooioOut.push({ ts: row.ts, action: row.action, status: row.status, request: rq, response: rs });
      }
    }

    return new Response(JSON.stringify({ chat, traces: [...traces], inbound, steps, providerHttp, blooioOut }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = `
<style>
.trace-wrap{display:grid;grid-template-columns:380px 1fr;gap:18px;align-items:start}
.turn-list{border:1px solid var(--line);border-radius:8px;background:var(--panel);max-height:78vh;overflow:auto}
.turn-item{padding:10px 12px;border-bottom:1px solid var(--line);cursor:pointer;font-size:12.5px;line-height:1.5}
.turn-item:hover{background:var(--accent-soft)}
.turn-item .t-ts{color:var(--muted);font-size:11px}
.turn-item .t-reply{color:var(--ink)}
.turn-item .t-meta{color:var(--ink-soft);font-family:var(--mono);font-size:11px}
.card{border:1px solid var(--line);border-radius:8px;background:var(--panel);margin-bottom:14px}
.card h3{font-size:13px;padding:10px 14px;margin:0;border-bottom:1px solid var(--line);background:#f2f5fa;font-family:var(--mono)}
.card .sec{padding:10px 14px}
.card .tenant{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft);margin:8px 0 4px}
.card pre{margin:0;font-size:12px;max-height:520px;overflow:auto;background:#fff;border:1px solid var(--line);white-space:pre-wrap;word-break:break-word;padding:8px 10px;border-radius:4px}
.card details{margin-top:6px}
.card details summary{cursor:pointer;font-size:12px;color:var(--accent);font-weight:600;padding:4px 0}
.arrow{text-align:center;color:var(--muted);font-size:18px;margin:2px 0 12px}
.tag{display:inline-block;padding:1px 7px;border-radius:3px;background:#eef0f3;font-family:var(--mono);font-size:11px;font-weight:600;color:var(--ink-soft);margin-right:6px}
.tag.in{background:#e8f4ea;color:#0e6b21}
.tag.out{background:#fef3e6;color:#7a4c00}
.tag.err{background:#fde8e8;color:#8a1a1a}
.kard{border-left:3px solid var(--accent);}
.kard-tool{border-left:3px solid #6e6e6e}
.kard-http{border-left:3px solid #c47a00}
.kard-blooio{border-left:3px solid #0e6b21}
.emit-block{margin:6px 0;padding:6px 10px;background:#fff;border:1px solid var(--line);border-radius:4px;font-family:var(--mono);font-size:12px;white-space:pre-wrap;word-break:break-word}
.emit-label{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#0a52d0;margin-right:6px}
</style>
<h1>Trace</h1>
<p class="subtitle">Complete ledger per turn. Inbound → model API calls (full system prompt + user input + raw request + raw response + extracted tags) → tool dispatches → downstream HTTP → outbound Blooio.</p>
<div class="trace-wrap">
  <div class="turn-list" id="turns">loading…</div>
  <div id="chain"><p style="color:var(--muted);font-size:13px">Pick a turn on the left.</p></div>
</div>
<script>
function e(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function pretty(s){ if(s==null||s==='') return '(empty)'; try { return JSON.stringify(JSON.parse(s),null,2) } catch { return String(s) } }
function redact(s){ return String(s).replace(/(Bearer |Basic |"Authorization"\\s*:\\s*")[A-Za-z0-9+\\/=._-]{12,}/g, '$1<REDACTED>').replace(/("(?:api_key|apiKey|x-api-key|key)"\\s*:\\s*")[^"]{8,}/gi, '$1<REDACTED>') }

function parseReq(s) { try { return JSON.parse(s) } catch { return null } }

// Pull system prompt + user input from any provider's body shape.
function extractSysAndInput(reqObj) {
  if (!reqObj) return { system: '', input: '' };
  const b = reqObj.body || reqObj;
  // xAI Responses API
  if (typeof b.instructions === 'string') return { system: b.instructions, input: String(b.input || '') };
  // Anthropic
  if (typeof b.system === 'string' && Array.isArray(b.messages)) {
    const userMsg = b.messages.find(m => m.role === 'user');
    return { system: b.system, input: typeof userMsg?.content === 'string' ? userMsg.content : JSON.stringify(userMsg?.content || '') };
  }
  // Gemini
  if (b.systemInstruction?.parts) {
    const sys = b.systemInstruction.parts.map(p => p.text || '').join('');
    const userParts = (b.contents || []).find(c => c.role === 'user')?.parts || [];
    return { system: sys, input: userParts.map(p => p.text || '').join('') };
  }
  // OpenAI-compat / Workers AI / Kimi
  if (Array.isArray(b.messages)) {
    const sys = b.messages.filter(m => m.role === 'system').map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\\n');
    const usr = b.messages.filter(m => m.role === 'user').map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\\n');
    return { system: sys, input: usr };
  }
  // Workers AI binding (env.AI.run)
  if (b.prompt) return { system: '', input: String(b.prompt) };
  return { system: '', input: '' };
}

// Extract model output text from any provider's response shape.
function extractOutText(resStr) {
  if (!resStr) return '';
  let j; try { j = JSON.parse(resStr); } catch { return String(resStr).slice(0, 4000); }
  // xAI Responses
  if (Array.isArray(j.output)) {
    const m = j.output.find(o => o.type === 'message');
    if (m) return (m.content || []).map(c => c.text || '').join('');
    if (j.output_text) return j.output_text;
  }
  // OpenAI / Kimi / Workers-AI-via-AIG
  if (j.choices && j.choices[0]) {
    return j.choices[0].message?.content || j.choices[0].message?.reasoning_content || '';
  }
  // Anthropic
  if (Array.isArray(j.content)) return j.content.map(c => c.text || '').join('');
  // Gemini
  if (Array.isArray(j.candidates)) return j.candidates[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  // Workers AI binding
  if (typeof j.response === 'string') return j.response;
  return '';
}

// Pull every [REASONING], [REPLY], [DONE], [SELF] block and every [TOOL_KEY]...[/TOOL_KEY] dispatch.
function extractTags(text) {
  if (!text) return { reasoning: [], reply: [], done: [], self: [], tools: [] };
  const out = { reasoning: [], reply: [], done: [], self: [], tools: [] };
  const re = /\\[([A-Z_][A-Z0-9_]*)\\]([\\s\\S]*?)\\[\\/\\1\\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const k = m[1], body = m[2];
    if (k === 'REASONING') out.reasoning.push(body);
    else if (k === 'REPLY') out.reply.push(body);
    else if (k === 'DONE') out.done.push(body);
    else if (k === 'SELF') out.self.push(body);
    else out.tools.push({ key: k, body });
  }
  return out;
}

async function loadTurns(){
  const r = await fetch('/admin/trace?data=turns').then(r=>r.json());
  const seen = new Set();
  document.getElementById('turns').innerHTML = (r.turns||[]).filter(t=>{
    const k = t.jobId ? 'j'+t.jobId : t.trace;
    if (seen.has(k)) return false; seen.add(k); return true;
  }).map(t =>
    '<div class="turn-item" onclick="loadChain('+(t.jobId?('\\'job\\','+t.jobId):('\\'trace\\',\\''+t.trace+'\\''))+')">' +
    '<div class="t-ts">'+e(t.ts)+'</div>' +
    '<div class="t-meta">'+e(t.chat)+' · '+e(t.phase)+(t.routed?' → '+e(t.routed):'')+(t.jobId?' · job '+t.jobId:'')+'</div>' +
    (t.reply?'<div class="t-reply">'+e(t.reply)+'</div>':'<div class="t-reply" style="color:var(--muted)">(silent / routed)</div>') +
    '</div>'
  ).join('');
}

function modelCard(s){
  const req = parseReq(s.request);
  const { system, input } = extractSysAndInput(req);
  const outText = extractOutText(s.response);
  const tags = extractTags(outText);
  const url = req?.url || (req?.body?.model ? 'binding:AI' : '?');
  const model = req?.body?.model || req?.model || '';

  let emitHtml = '';
  if (tags.reasoning.length) emitHtml += tags.reasoning.map(r => '<div class="emit-block"><span class="emit-label">REASONING</span>'+e(r.trim())+'</div>').join('');
  if (tags.tools.length) emitHtml += tags.tools.map(t => '<div class="emit-block"><span class="emit-label">['+e(t.key)+']</span>'+e(t.body.trim())+'</div>').join('');
  if (tags.reply.length) emitHtml += tags.reply.map(r => '<div class="emit-block"><span class="emit-label">REPLY</span>'+e(r.trim())+'</div>').join('');
  if (tags.done.length) emitHtml += tags.done.map(r => '<div class="emit-block" style="opacity:0.7"><span class="emit-label">DONE</span>'+e(r.trim())+'</div>').join('');
  if (!emitHtml) emitHtml = '<div class="emit-block" style="color:var(--muted)">(no [TAG] blocks parsed — raw model output below)</div>';

  return '<div class="card kard"><h3><span class="tag out">MODEL</span>'+e(s.key)+' · '+e(model)+' <span style="color:var(--muted);float:right">'+e(s.ts)+'</span></h3><div class="sec">' +
    '<div class="tenant">system prompt ('+system.length+' chars)</div><pre>'+e(system)+'</pre>' +
    '<div class="tenant">user input ('+input.length+' chars)</div><pre>'+e(input)+'</pre>' +
    '<div class="tenant">model emitted (parsed)</div>'+emitHtml +
    '<details><summary>raw model output text</summary><pre>'+e(outText)+'</pre></details>' +
    '<details><summary>raw HTTP request body</summary><pre>'+e(redact(pretty(s.request)))+'</pre></details>' +
    '<details><summary>raw HTTP response body</summary><pre>'+e(pretty(s.response))+'</pre></details>' +
    '</div></div>';
}
function toolCard(s){
  const cls = s.action === 'http_out' ? 'kard-http' : 'kard-tool';
  const dir = s.direction === 'IN' ? '<span class="tag in">IN</span>' : '<span class="tag out">OUT</span>';
  return '<div class="card '+cls+'"><h3>'+dir+e(s.action||'tool')+' · ['+e(s.key||'?')+'] <span style="color:var(--muted);float:right">'+e(s.ts)+(s.status?' · '+s.status:'')+'</span></h3><div class="sec">' +
    '<div class="tenant">request</div><pre>'+e(redact(pretty(s.request)))+'</pre>' +
    '<div class="tenant">response</div><pre>'+e(pretty(s.response))+'</pre>' +
    '</div></div>';
}
function httpCard(h){
  return '<div class="card kard-http"><h3><span class="tag out">HTTP</span>'+e(h.source||'')+' · '+e(h.key||'')+' <span style="color:var(--muted);float:right">'+e(h.ts)+(h.status?' · '+h.status:'')+'</span></h3><div class="sec">' +
    '<div class="tenant">raw request</div><pre>'+e(redact(pretty(h.request)))+'</pre>' +
    '<div class="tenant">raw response</div><pre>'+e(pretty(h.response))+'</pre>' +
    '</div></div>';
}
function blooioCard(b){
  return '<div class="card kard-blooio"><h3><span class="tag out">BLOOIO</span>'+e(b.action)+(b.status?' · '+b.status:'')+' <span style="color:var(--muted);float:right">'+e(b.ts)+'</span></h3><div class="sec">' +
    '<div class="tenant">payload</div><pre>'+e(redact(pretty(b.request)))+'</pre>' +
    (b.response?'<div class="tenant">response</div><pre>'+e(pretty(b.response))+'</pre>':'') +
    '</div></div>';
}

async function loadChain(kind, val){
  const el = document.getElementById('chain');
  el.innerHTML = '<p style="color:var(--muted)">loading chain…</p>';
  const r = await fetch('/admin/trace?data=chain&'+kind+'='+encodeURIComponent(val)).then(r=>r.json());
  if (r.error) { el.innerHTML = '<p>'+e(r.error)+'</p>'; return; }
  let html = '';
  if (r.inbound) html += '<div class="card kard-blooio"><h3><span class="tag in">INBOUND</span> webhook <span style="color:var(--muted);float:right">'+e(r.inbound.ts)+'</span></h3><div class="sec"><pre>'+e(pretty(r.inbound.raw))+'</pre></div></div><div class="arrow">↓</div>';
  for (const s of (r.steps||[])) {
    if (s.action === 'chat_completion') html += modelCard(s) + '<div class="arrow">↓</div>';
    else if (s.action === 'agent') continue;
    else html += toolCard(s) + '<div class="arrow">↓</div>';
  }
  for (const h of (r.providerHttp||[])) {
    html += httpCard(h) + '<div class="arrow">↓</div>';
  }
  for (const b of (r.blooioOut||[])) {
    if (b.action === 'send' || b.action === 'callback' || (b.action || '').toLowerCase().includes('deliver')) html += blooioCard(b) + '<div class="arrow">↓</div>';
  }
  el.innerHTML = html || '<p>no steps recorded for this turn.</p>';
}
loadTurns();
const q = new URLSearchParams(location.search);
if (q.get('trace')) loadChain('trace', q.get('trace'));
if (q.get('job')) loadChain('job', q.get('job'));
</script>
`;
  return new Response(shellHtml({ activeHref: '/admin/trace', title: 'Trace', body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
