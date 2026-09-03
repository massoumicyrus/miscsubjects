import { shellHtml } from '../_layout.js';
import { readEventFull } from '../../_lib/event_log.js';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pretty(s) {
  if (s == null) return '';
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return String(s); }
}

export async function onRequestGet(context) {
  const { params, request, env } = context;
  const id = decodeURIComponent(params.id || '');
  const row = await readEventFull(env, id);
  const dataMode = new URL(request.url).searchParams.get('data');

  if (dataMode) {
    return new Response(JSON.stringify(row || { error: 'not_found', id }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  if (!row) {
    const body404 = `<h1>Ledger event</h1><p class="subtitle">No event with id <code>${esc(id)}</code>.</p>`;
    return new Response(shellHtml({ activeHref: '/admin/ledger', title: 'Ledger event', body: body404 }), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const meta = [
    ['id', row.id], ['ts', row.ts], ['build', row.build], ['source', row.source],
    ['key', row.key], ['route', row.route], ['actor', row.actor], ['action', row.action],
    ['direction', row.direction], ['status', row.status], ['trace_id', row.trace_id],
    ['step', row.step], ['parent', row.parent],
    ['request_size', row.request_size], ['response_size', row.response_size],
    ['r2_request_key', row.r2_request_key], ['r2_response_key', row.r2_response_key],
    ['legacy_table', row.legacy_table], ['legacy_id', row.legacy_id],
  ];

  const origin = new URL(request.url).origin;
  const eventCmd = 'curl -s "' + origin + '/admin/ledger/' + encodeURIComponent(id) + '?data=1" -H "x-terminal-key: $TERMINAL_KEY"';
  const traceCmd = row.trace_id
    ? 'curl -s "' + origin + '/admin/ledger?data=1&trace_id=' + encodeURIComponent(row.trace_id) + '" -H "x-terminal-key: $TERMINAL_KEY"'
    : '';

  const body = `
<style>
.kv{display:grid;grid-template-columns:160px 1fr;gap:4px 14px;font-size:11px;margin:12px 0 18px}
.kv .k{color:var(--muted)}
.kv .v{color:var(--ink);word-break:break-all}
.payload{background:rgba(3,5,10,.9);border:1px solid var(--line);border-radius:5px;padding:12px;font-family:var(--mono);font-size:11px;white-space:pre-wrap;word-break:break-all;color:#c8d8e8;line-height:1.55;max-height:560px;overflow:auto}
.payload-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--blue);margin:14px 0 4px}
.term-cmd{font-family:var(--mono);font-size:11px;white-space:pre-wrap;word-break:break-all}
</style>
<h1>Ledger event</h1>
<p class="subtitle"><a href="/admin/ledger">← ledger</a></p>
<div class="curl-block" style="margin-bottom:14px">
<div class="curl-bar"><span>terminal — this event</span></div>
<pre class="term-cmd">${esc(eventCmd)}</pre>
</div>
${traceCmd ? '<div class="curl-block" style="margin-bottom:14px"><div class="curl-bar"><span>terminal — whole trace</span></div><pre class="term-cmd">' + esc(traceCmd) + '</pre></div>' : ''}
<div class="kv">
${meta.map(([k, v]) => `<div class="k">${esc(k)}</div><div class="v">${v == null || v === '' ? '<span style="color:rgba(154,167,186,.4)">—</span>' : esc(v)}</div>`).join('\n')}
</div>
<div class="payload-label">request_json (full)</div>
<pre class="payload">${esc(pretty(row.request_json))}</pre>
<div class="payload-label">response_json (full)</div>
<pre class="payload">${esc(pretty(row.response_json))}</pre>
`;

  return new Response(shellHtml({ activeHref: '/admin/ledger', title: 'Ledger event', body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
