// Pipeline prompt inspector — read-only view of per-article writer/editor prompts.
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const slug = (url.searchParams.get("slug") || "bpc-157").toLowerCase();
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pipeline prompts — ${slug}</title>
<style>
:root { --bg:#fff; --panel:#fafafa; --ink:#000; --muted:#666; --line:#ddd; --accent:#000; }
* { box-sizing:border-box; margin:0; padding:0; }
body { font:14px/1.5 system-ui,sans-serif; background:var(--bg); color:var(--ink); padding:20px; }
h1 { font-size:20px; margin-bottom:6px; }
.sub { color:var(--muted); font-size:12px; margin-bottom:16px; max-width:720px; }
.toolbar { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; align-items:center; }
input { padding:8px 12px; border-radius:8px; border:1px solid var(--line); background:var(--panel); color:var(--ink); min-width:220px; }
button, a.btn { padding:8px 12px; border-radius:8px; border:1px solid var(--line); background:var(--panel); color:var(--ink); text-decoration:none; cursor:pointer; font-size:13px; }
button:hover, a.btn:hover { border-color:var(--accent); }
.warn { background:#fff8e6; border:1px solid #d8b34f; color:#4a3900; padding:10px 12px; border-radius:8px; font-size:12px; margin-bottom:14px; max-width:900px; }
.steps { display:flex; flex-direction:column; gap:12px; max-width:1100px; }
.card { background:var(--panel); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.card-h { padding:10px 14px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:8px; align-items:baseline; flex-wrap:wrap; }
.card-h h2 { font-size:14px; }
.card-h .meta { font-size:11px; color:var(--muted); font-family:ui-monospace,monospace; }
.card pre { padding:12px 14px; white-space:pre-wrap; word-break:break-word; font:12px/1.45 ui-monospace,monospace; max-height:420px; overflow:auto; }
.legacy { opacity:0.85; border-color:#4a3040; }
#status { font-size:12px; color:var(--muted); }
</style>
</head>
<body>
<h1>Pipeline prompt pack</h1>
<p class="sub">Read-only mirror of what the writer-queue cron actually sends per step. Legacy WRITER_AGENT / EDITOR_AGENT directory rows shown for comparison — they are <em>not</em> loaded by default on <code>/api/protocol/write</code>.</p>
<div class="warn">Provenance on articles often has <code>prompt:""</code> on write passes. This page shows the effective runtime prompts from <code>article_prose.js</code> + per-slug enrichment brief + queued task <code>ask</code>.</div>
<div class="toolbar">
  <input id="slug" value="${slug.replace(/"/g, "&quot;")}" placeholder="slug">
  <button type="button" id="go">Load</button>
  <a class="btn" id="json" href="/api/protocol/prompt-pack?slug=${encodeURIComponent(slug)}" target="_blank">JSON</a>
  <a class="btn" href="/admin/content-map">Content map</a>
  <span id="status"></span>
</div>
<div id="root"></div>
<script>
const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function card(title, meta, sys, user, cls) {
  return '<div class="card' + (cls ? ' ' + cls : '') + '">' +
    '<div class="card-h"><h2>' + esc(title) + '</h2><span class="meta">' + esc(meta) + '</span></div>' +
    '<pre><b>SYSTEM</b>\\n' + esc(sys || '(empty)') + '\\n\\n<b>USER</b>\\n' + esc(user || '(empty)') + '</pre></div>';
}

function render(d) {
  if (d.error) {
    $('root').innerHTML = '<p style="color:#e07a6a">' + esc(d.error) + '</p>';
    return;
  }
  let html = '';
  const ap = d.active_pipeline || {};
  if (ap.write) {
    html += card('1 · Write', ap.write.endpoint + ' · mode=' + ap.write.mode + ' · ' + (ap.write.model_default || ''), ap.write.system_prompt, ap.write.user_prompt);
  }
  (ap.populate || []).forEach((p, i) => {
    html += card('2.' + (i+1) + ' · Populate (' + p.focus + ')', p.endpoint + ' · ' + p.model_default, p.system_prompt, p.user_prompt);
  });
  if (ap.synthesize_body) {
    html += card('3 · Synthesize body (editor)', ap.synthesize_body.endpoint + ' · role=' + ap.synthesize_body.role, ap.synthesize_body.system_prompt, ap.synthesize_body.user_prompt);
  }
  if (ap.poll) {
    html += card('4 · Poll (editor)', ap.poll.endpoint + ' · role=' + ap.poll.role, ap.poll.system_prompt, ap.poll.user_prompt);
  }
  if (ap.critique) {
    html += card('5 · Critique', ap.critique.endpoint + ' · role=' + ap.critique.role, ap.critique.system_prompt, ap.critique.user_prompt);
  }
  const leg = d.legacy_directory_agents || {};
  if (leg.writer_agent && leg.writer_agent.found) {
    html += card('LEGACY · WRITER_AGENT (directory)', 'NOT used by cron write unless task passes system_prompt · ' + leg.writer_agent.chars + ' chars', leg.writer_agent.system_prompt, leg.writer_agent.note || '', 'legacy');
  }
  if (leg.editor_agent && leg.editor_agent.found) {
    html += card('LEGACY · EDITOR_AGENT (directory)', 'NOT used by poll/synthesize unless explicitly dispatched · ' + leg.editor_agent.chars + ' chars', leg.editor_agent.system_prompt, leg.editor_agent.note || '', 'legacy');
  }
  if (d.queued_write_task && d.queued_write_task.job) {
    html += '<div class="card"><div class="card-h"><h2>Queued task ask (from tasks table)</h2><span class="meta">#' + d.queued_write_task.task_id + ' · ' + esc(d.queued_write_task.status) + '</span></div><pre>' + esc(JSON.stringify(d.queued_write_task.job, null, 2)) + '</pre></div>';
  }
  $('root').innerHTML = '<div class="steps">' + html + '</div>';
  $('status').textContent = d.title ? (d.title + ' · ' + d.url) : '';
}

async function load() {
  const slug = $('slug').value.trim().toLowerCase();
  $('json').href = '/api/protocol/prompt-pack?slug=' + encodeURIComponent(slug);
  $('status').textContent = 'Loading…';
  const r = await fetch('/api/protocol/prompt-pack?slug=' + encodeURIComponent(slug));
  const d = await r.json();
  render(d);
}

$('go').addEventListener('click', () => { history.replaceState(null, '', '?slug=' + encodeURIComponent($('slug').value.trim())); load(); });
load();
</script>
</body>
</html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
