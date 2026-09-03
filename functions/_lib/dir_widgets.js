// Directory widget renderer. Turns directory rows into clickable HTML cards.
// Style mirrors functions/_lib/vault_widgets.js but is directory-specific.

import { shortHash } from './vault_widgets.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeDirRow(row) {
  const id = String(row.key || '');
  const type = String(row.type || 'row');
  const body = row.content ? String(row.content).slice(0, 140) : String(row.target || '');
  return {
    kind: 'directory',
    id,
    type,
    title: id,
    category: row.category || '',
    body,
    ts: row.updated_at || '',
    href: '/api/directory/' + encodeURIComponent(id),
    api: '/api/directory/' + encodeURIComponent(id),
    row_num: row.row_num || null,
    hash: shortHash('directory|' + id + '|' + type + '|' + (row.updated_at || '')),
  };
}

export function dirStyles() {
  return `
.dir-shell{max-width:1480px}
.dir-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,380px);gap:24px;align-items:end;margin-bottom:22px;border-bottom:1px solid var(--line);padding-bottom:18px}
.dir-hero h1{font-size:30px;letter-spacing:0;margin:0}
.dir-hero p{font-size:15px;color:var(--ink-soft);line-height:1.55;max-width:860px}
.dir-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.dir-actions a{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line-strong);border-radius:6px;padding:9px 12px;background:#fff;color:var(--ink);font-weight:700;font-size:12px;text-decoration:none}
.dir-actions a:hover{border-color:var(--accent);background:var(--accent-soft);text-decoration:none}
.dir-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0 24px}
.dir-card{border:1px solid var(--line);border-radius:8px;background:#fff;overflow:hidden;position:relative;display:flex;flex-direction:column;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
.dir-card:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.10);border-color:var(--dc)}
.dir-card::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:var(--dc)}
.dir-card.fn{--dc:#0a52d0}.dir-card.http{--dc:#178c45}.dir-card.agent{--dc:#d35400}.dir-card.flow{--dc:#6a5acd}.dir-card.row{--dc:#9aa7ba}
.dir-main{color:inherit;text-decoration:none;padding:14px 14px 12px 18px;display:flex;flex-direction:column;flex:1 1 auto}
.dir-main:hover{text-decoration:none}
.dir-top{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.dir-num{width:30px;height:30px;border-radius:7px;background:var(--dc);color:#fff;display:flex;align-items:center;justify-content:center;font:800 11px/1 var(--mono)}
.dir-kind{font:800 10px/1 var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--dc)}
.dir-cat{margin-left:auto;font:700 9px/1.4 var(--sans);letter-spacing:.05em;text-transform:uppercase;border:1px solid var(--line);border-radius:99px;padding:2px 7px;color:var(--muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dir-title{padding:0 0 8px;font:800 16px/1.25 var(--sans);color:var(--ink);overflow-wrap:anywhere}
.dir-body{padding:0 0 12px;font:13px/1.5 var(--sans);color:var(--ink-soft);white-space:pre-wrap;overflow-wrap:anywhere;max-height:104px;overflow:hidden;flex:1 1 auto}
.dir-foot{border-top:1px dashed var(--line);padding:10px 14px 12px 18px;display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}
.dir-hash{font:10px/1.35 var(--mono);color:var(--muted)}
.dir-ts{grid-column:1/-1;font:10px/1.35 var(--mono);color:var(--muted)}
.dir-links{border-top:1px solid var(--line);padding:10px 14px 12px 18px;display:flex;gap:12px;font:12px/1 var(--sans)}
.dir-links a{color:var(--accent);text-decoration:none;font-weight:600}
.dir-links a:hover{text-decoration:underline}
.empty{grid-column:1/-1;color:var(--muted);font-size:14px;padding:18px 0}
@media(max-width:860px){.dir-hero{grid-template-columns:1fr}.dir-actions{justify-content:flex-start}.dir-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
}

export function renderDirCard(widget) {
  const w = normalizeDirRow(widget);
  const type = esc(w.type);
  const title = esc(w.title);
  const num = w.row_num ? esc(String(w.row_num)) : '';
  const cat = w.category ? `<span class="dir-cat">${esc(w.category)}</span>` : '';
  const body = esc(String(w.body || '').slice(0, 280));
  const hash = esc(String(w.hash || '').slice(0, 12));
  const ts = w.ts ? `<span class="dir-ts">${esc(String(w.ts).slice(0, 19).replace('T', ' '))}</span>` : '';
  const adminHref = '/admin/directory/' + encodeURIComponent(w.id);
  const ledgerHref = '/api/events?source=directory&key=' + encodeURIComponent(w.id);

  const main =
    `<a class="dir-main" href="${esc(w.href)}">` +
    `<div class="dir-top"><span class="dir-num">${num || '—'}</span><span class="dir-kind">${type}</span>${cat}</div>` +
    `<div class="dir-title">${title}</div>` +
    (body ? `<div class="dir-body">${body}</div>` : '') +
    `<div class="dir-foot"><span class="dir-hash">${hash}</span>${ts}</div>` +
    `</a>`;

  const links =
    `<div class="dir-links">` +
    `<a href="${esc(w.href)}">JSON</a>` +
    `<a href="${esc(adminHref)}">Edit</a>` +
    `<a href="${esc(ledgerHref)}">Ledger</a>` +
    `</div>`;

  return `<div class="dir-card ${type}">${main}${links}</div>`;
}

export function renderDirPage(title, rows, opts) {
  const options = opts || {};
  const cards = (rows || []).map(renderDirCard).join('');
  const jsonHref = options.jsonHref || '/api/directory?format=json';
  const hero =
    `<section class="dir-hero"><div><h1>${esc(title)}</h1><p>Queryable directory rows with stable row numbers, hashes, and ledger links.</p></div>` +
    `<div class="dir-actions"><a href="${esc(jsonHref)}">JSON</a><a href="/admin/directory">Admin</a></div></section>`;
  const grid = `<div class="dir-grid">${cards || '<div class="empty">No directory rows.</div>'}</div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>
:root{--bg:#f6f7f9;--ink:#111;--ink-soft:#445;--muted:#667;--line:#dde1e6;--line-strong:#c8cdd3;--accent:#0a52d0;--accent-soft:#e8f0fe;--sans:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 var(--sans);padding:24px}
${dirStyles()}
</style></head><body><div class="dir-shell">${hero}${grid}</div></body></html>`;
}

export function renderDirWidgetResponse(rows, opts) {
  const options = opts || {};
  const page = renderDirPage(options.title || 'Directory widgets', rows, options);
  return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
