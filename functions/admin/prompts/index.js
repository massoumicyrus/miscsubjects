// /admin/prompts — the prompt directory. Every system prompt on the build, in one list,
// each one clickable. A prompt is a directory row; there is nothing to read in the source
// tree to find out what a model was told.
import { shellHtml } from '../_layout.js';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function onRequestGet(context) {
  const { env } = context;
  const r = await env.DB.prepare(
    "SELECT key, type, target, content, includes, category, enabled, updated_at " +
    "FROM directory WHERE type = 'agent' OR target = 'prompt_block' OR category LIKE 'block_%' OR category = 'prompt' " +
    "ORDER BY (type = 'agent') DESC, key ASC"
  ).all().catch(() => ({ results: [] }));
  const rows = r.results || [];
  const agents = rows.filter((x) => x.type === 'agent');
  const blocks = rows.filter((x) => x.type !== 'agent');

  const card = (x) => {
    const chars = String(x.content || '').length;
    const first = String(x.content || '').replace(/^@includes[^\n]*\n?/i, '').trim().split('\n')[0] || '(empty)';
    return `<a class="pcard${Number(x.enabled ?? 1) ? '' : ' off'}" href="/admin/prompts/${encodeURIComponent(x.key)}">
      <div class="pk">${esc(x.key)}</div>
      <div class="pm">${esc(x.target || '—')} · ${chars.toLocaleString()} chars${x.includes ? ' · includes ' + esc(x.includes) : ''}</div>
      <div class="pp">${esc(first.slice(0, 160))}</div>
    </a>`;
  };

  const body = `
<style>
.pw{max-width:1200px}
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin:12px 0 26px}
.pcard{display:block;border:1px solid var(--line);border-radius:9px;padding:12px 14px;background:var(--panel);text-decoration:none;color:inherit}
.pcard:hover{border-color:var(--accent)}
.pcard.off{opacity:.5}
.pcard .pk{font-family:var(--mono);font-size:13px;font-weight:700}
.pcard .pm{font-size:11.5px;color:var(--muted);margin:3px 0 6px}
.pcard .pp{font-size:12px;color:var(--ink-soft);line-height:1.45;max-height:54px;overflow:hidden}
.pw .lead{border:1px solid var(--line-strong);border-radius:10px;padding:14px 16px;background:var(--panel);margin:10px 0 18px}
.pw .lead code{font-family:var(--mono);font-size:12px;background:var(--bg);padding:1px 5px;border-radius:4px}
.pw .lead pre{background:var(--bg);border:1px solid var(--line);padding:10px 12px;border-radius:7px;font-size:12px;overflow:auto;margin:8px 0 0}
</style>
<div class="pw">
<h1>Prompts</h1>
<p class="subtitle">Every system prompt is a directory row. Click one to read it, change its model, append memory, and generate — one call, about a second.</p>

<div class="lead">
  <b>The law:</b> a system prompt never lives in JavaScript. It lives here, and any of them is invocable
  as one JSON object through <code>POST /api/invoke</code> — <a href="/api/invoke">the contract</a>.
  <pre>curl -X POST https://miscsubjects.com/api/invoke \\
  -H "authorization: Bearer $TERMINAL_KEY" -H "content-type: application/json" \\
  -d '{"key":"ROUTER","inputs":["row 1","row 2","row 3"]}'</pre>
  <div style="font-size:12px;color:var(--muted);margin-top:8px">Up to 200 calls per request, all in flight at once. One round trip, not a queue.</div>
</div>

<h2>Agents — ${agents.length}</h2>
<div class="pgrid">${agents.map(card).join('') || '<p class="empty">none</p>'}</div>

<h2>Prompt blocks — ${blocks.length}</h2>
<div class="pgrid">${blocks.map(card).join('') || '<p class="empty">none</p>'}</div>
</div>`;

  return new Response(shellHtml({ activeHref: '/admin/prompts', title: 'Prompts', body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
