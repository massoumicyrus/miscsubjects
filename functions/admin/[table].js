import { shellHtml } from './_layout.js';

const TABLES = {
  'settings':       { sql: 'SELECT key, value, description, updated_at FROM settings ORDER BY key ASC', label: 'Settings', description: 'App-wide configuration. system_prompt mirrors directory.ROUTER.content.' },
  'blooio-logs':    { sql: 'SELECT id, timestamp, direction, payload, response FROM blooio_logs ORDER BY id DESC LIMIT 500', label: 'Blooio Logs', description: 'Inbound webhooks + outbound sends. Full HTTP request and response per row.' },
  'blooio-dedup':   { sql: 'SELECT message_id, created_at FROM blooio_dedup ORDER BY rowid DESC LIMIT 500', label: 'Blooio Dedup', description: 'Once a message_id appears here, all duplicate webhooks for that message are dropped.' },
  'grok-ledger':    { sql: 'SELECT id, ts AS timestamp, source, action, status, request_json AS request, response_json AS response FROM events ORDER BY ts DESC LIMIT 500', label: 'Grok Ledger', description: 'Every Grok / xAI / LLM call. Full request and response per row.' },
  'pages-versions': { sql: 'SELECT id, slug, version, actor, created_at, length(body_html) AS size_bytes FROM pages_versions ORDER BY id DESC LIMIT 500', label: 'Pages Versions', description: 'Append-only history for every PUT/PATCH against pages.' },
  'log':            { sql: 'SELECT id, ts, trace, step, parent, key, type, length(input) AS in_bytes, length(output) AS out_bytes FROM log ORDER BY id DESC LIMIT 500', label: 'Log', description: 'One row per dispatch. trace + step form a tree per inbound request.' },
  'tasks':          { sql: 'SELECT id, created_at, status, body, source, trace FROM tasks ORDER BY id DESC LIMIT 500', label: 'Tasks', description: 'Tasks queued by [ADDTASK]…[/ADDTASK] regex pattern in model replies, or any other caller.' },
  'docs':           { sql: 'SELECT slug, title, body, updated_at FROM docs ORDER BY slug ASC', label: 'Docs', description: 'The stored raw API references the agents read via [DOCS_GET]slug[/DOCS_GET]: arcads, blooio, 2chat, build-intent. Full body per row.' },
  'capability-tests': { sql: 'SELECT seq, feature, prompt, expect, last_status, last_verdict, last_reply, last_run FROM capability_tests ORDER BY seq ASC', label: 'Capability Tests', description: 'The self-test queue. One row per claimed feature: prompt sent, expected behavior, GRADER verdict. Also synced to the master sheet (CapabilityTests tab).' },
};

export async function onRequestGet(context) {
  const { params, env } = context;
  const slug = params.table;
  const def = TABLES[slug];

  if (!def) return new Response('Not found', { status: 404 });

  const result = await env.DB.prepare(def.sql).all();
  const rows = result.results || [];

  let tableHtml;
  if (!rows.length) {
    tableHtml = '<p class="empty">No rows.</p>';
  } else {
    const cols = Object.keys(rows[0]);
    const head = '<thead><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead>';
    const escSafe = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const tbody = '<tbody>' + rows.map(row => {
      return '<tr>' + cols.map(c => {
        const v = row[c];
        if (v === null) return '<td style="color:rgba(154,167,186,.35)">null</td>';
        const s = String(v);
        return `<td title="${s.replace(/"/g, '&quot;')}">${escSafe(s)}</td>`;
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
    tableHtml = `<table>${head}${tbody}</table>`;
  }

  const body = `
<h1>${def.label}</h1>
<p class="subtitle">${def.description}</p>
${tableHtml}
`;

  return new Response(shellHtml({ activeHref: '/admin/' + slug, title: def.label, body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
