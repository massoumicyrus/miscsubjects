import { shellHtml } from './_layout.js';

// /admin/forum — the coding-agent forum as a VIEW over the ledger, not a separate store.
// Every post is an agent_turns row (env.DB), grouped by trace_id into threads. Read-only.
// Verdict chips are parsed from audit_verdict or a "VERDICT: SHIP|AMEND|KILL|BLOCK" line.

const COLORS = { claude: '#c98a3a', codex: '#2f77b5', grok: '#8a4fb5', kimi: '#2f9c86', gemini: '#b5602f', router: '#6b7280' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function verdictOf(row) {
  const a = String(row.audit_verdict || '').toUpperCase();
  const ma = a.match(/SHIP|AMEND|KILL|BLOCK|PASS|FAIL|REVERT|KEEP/);
  if (ma) return ma[0];
  const ms = String(row.assistant_text || '').match(/\bVERDICT:\s*(SHIP|AMEND|KILL|BLOCK)\b/i);
  return ms ? ms[1].toUpperCase() : '';
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '150', 10) || 150, 400);
  const agent = (url.searchParams.get('agent') || '').toLowerCase();

  let sql = 'SELECT id, ts, agent, source, session, trace_id, input_kind, user_input, assistant_text, n_tools, dispatch_key, audit_verdict FROM agent_turns';
  const binds = [];
  if (agent) { sql += ' WHERE lower(agent) = ?'; binds.push(agent); }
  sql += ' ORDER BY id DESC LIMIT ?'; binds.push(limit);

  let rows = [];
  try { const r = await env.DB.prepare(sql).bind(...binds).all(); rows = r.results || []; } catch (e) { rows = []; }

  if (url.searchParams.get('data') === '1') {
    return new Response(JSON.stringify({ results: rows, limit }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  const threads = new Map();
  for (const row of rows) {
    const k = row.trace_id || ('turn_' + row.id);
    if (!threads.has(k)) threads.set(k, []);
    threads.get(k).push(row);
  }
  const ordered = [...threads.entries()].sort(
    (a, b) => Math.max(...b[1].map((r) => r.id)) - Math.max(...a[1].map((r) => r.id))
  );
  const agents = [...new Set(rows.map((r) => r.agent))].filter(Boolean);

  const postHtml = (row) => {
    const c = COLORS[String(row.agent || '').toLowerCase()] || '#888';
    const v = verdictOf(row);
    const ask = esc((row.user_input || '').slice(0, 240));
    const say = esc((row.assistant_text || '').slice(0, 700));
    return `<div class="fp">
      <div class="fp-h">
        <span class="fp-who" style="color:${c}">${esc(row.agent)}</span>
        ${row.input_kind ? `<span class="fp-k">${esc(row.input_kind)}</span>` : ''}
        ${v ? `<span class="fp-v v-${v.toLowerCase()}">${v}</span>` : ''}
        <span class="fp-sp"></span>
        ${row.n_tools ? `<span class="fp-t">${row.n_tools} tools</span>` : ''}
        ${row.dispatch_key ? `<span class="fp-dk">${esc(row.dispatch_key)}</span>` : ''}
        <span class="fp-ts">${esc(String(row.ts || '').replace('T', ' ').slice(0, 19))}</span>
      </div>
      ${ask ? `<div class="fp-ask">${ask}</div>` : ''}
      ${say ? `<div class="fp-say">${say}</div>` : ''}
    </div>`;
  };

  const threadsHtml = ordered.map(([k, turns]) => {
    turns.sort((a, b) => a.id - b.id);
    const head = turns[0];
    const title = esc(String(head.user_input || head.assistant_text || k).slice(0, 90));
    const who = [...new Set(turns.map((t) => t.agent))].filter(Boolean).join(', ');
    return `<section class="thr">
      <div class="thr-h"><span class="thr-title">${title}</span>
        <span class="thr-meta">${turns.length} turns · ${esc(who)} · <span class="mono">${esc(k)}</span></span></div>
      <div class="thr-posts">${turns.map(postHtml).join('')}</div>
    </section>`;
  }).join('');

  const BODY = `
<style>
.fw{max-width:1100px}
.fw-head{border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:14px}
.fw-head h1{font-size:24px;margin:0 0 4px}
.fw-sub{color:var(--ink-soft,#5a6a67);font-size:13px;max-width:74ch;line-height:1.5}
.fw-sub code,.mono{font-family:var(--mono);font-size:12px}
.fw-filters{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 18px}
.fw-filters a{font-family:var(--mono);font-size:12px;border:1px solid var(--line);border-radius:6px;padding:5px 10px;text-decoration:none;color:var(--ink)}
.fw-filters a.on{border-color:var(--accent);background:var(--accent-soft,#eef4ff)}
.thr{border:1px solid var(--line);border-radius:8px;background:var(--panel,#fff);margin-bottom:16px;overflow:hidden}
.thr-h{padding:10px 14px;border-bottom:1px solid var(--line);background:var(--panel2,#f7f8f8);display:flex;flex-direction:column;gap:2px}
.thr-title{font-weight:700;font-size:14px}
.thr-meta{font-family:var(--mono);font-size:11px;color:var(--muted)}
.thr-posts{display:flex;flex-direction:column}
.fp{padding:11px 14px;border-bottom:1px solid var(--line)}
.fp:last-child{border-bottom:0}
.fp-h{display:flex;align-items:center;gap:9px;font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:5px;flex-wrap:wrap}
.fp-who{font-weight:700;font-size:13px}
.fp-k{text-transform:uppercase;letter-spacing:.06em;font-size:9.5px}
.fp-sp{flex:1}
.fp-v{font-weight:800;font-size:10px;letter-spacing:.08em;padding:1px 7px;border-radius:999px;border:1px solid currentColor}
.v-ship,.v-keep,.v-pass{color:#19853f}
.v-amend{color:#a5730a}
.v-kill,.v-block,.v-fail,.v-revert{color:#c0392b}
.fp-dk{color:var(--accent)}
.fp-ask{font-size:13px;color:var(--ink);white-space:pre-wrap;word-break:break-word;margin-bottom:5px}
.fp-say{font-size:13px;color:var(--ink-soft,#4c5a57);white-space:pre-wrap;word-break:break-word;background:var(--panel2,#f7f8f8);border-radius:6px;padding:8px 10px}
</style>
<div class="fw">
  <div class="fw-head">
    <h1>Forum</h1>
    <div class="fw-sub">A view over the ledger, not a separate store. Every post is an <code>agent_turns</code> row, grouped by trace into threads — newest first. Cooperative and adversarial in one place.</div>
  </div>
  <div class="fw-filters">
    <a href="/admin/forum" class="${agent ? '' : 'on'}">all</a>
    ${agents.map((a) => `<a href="/admin/forum?agent=${encodeURIComponent(a)}" class="${agent === String(a).toLowerCase() ? 'on' : ''}">${esc(a)}</a>`).join('')}
  </div>
  ${threadsHtml || '<p style="color:var(--muted)">No agent turns yet.</p>'}
</div>`;

  return new Response(shellHtml({ activeHref: '/admin/forum', title: 'Forum — ledger view', body: BODY }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
