import { getSheet, getValues } from '../_lib/sheets_store.js';
import { runView } from '../_lib/sheet_views.js';
import { sheetSelfPayload } from '../_lib/sheet_self.js';
import { designLawStyles } from '../_lib/design_law.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(title, body, status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — miscsubjects.com</title>
<style>${designLawStyles()}
body{margin:0;background:var(--ds-bg,#fff);color:var(--ds-ink,#111);font-family:var(--ds-sans,system-ui,sans-serif);font-size:14px;line-height:1.5}
main{max-width:1200px;margin:0 auto;padding:24px}
h1{font-size:1.6rem;margin:0 0 4px}
.meta{color:var(--ds-dim,#666);font-size:12px;margin-bottom:16px}
.links{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;margin:0 0 20px}
.links a{color:var(--ds-ink,#111)}
code{font-family:var(--ds-mono,Menlo,monospace);font-size:12px;background:var(--ds-raised,#f3f3f3);padding:1px 5px;border-radius:3px}
.grid{overflow:auto;border:1px solid var(--ds-line,#e2e2e2);border-radius:6px}
table{border-collapse:collapse;font-size:13px;min-width:100%}
th,td{border-bottom:1px solid var(--ds-line,#e2e2e2);border-right:1px solid var(--ds-line,#e2e2e2);padding:6px 10px;text-align:left;vertical-align:top;max-width:480px;word-break:break-word;white-space:pre-wrap}
th{background:var(--ds-raised,#f3f3f3);position:sticky;top:0;font-weight:600}
td.n,th.n{color:var(--ds-dim,#666);text-align:right;background:var(--ds-raised,#f3f3f3)}
pre{background:var(--ds-raised,#f3f3f3);border:1px solid var(--ds-line,#e2e2e2);border-radius:6px;padding:10px 12px;font-size:12px;white-space:pre-wrap;word-break:break-word}
</style></head><body><main>${body}</main></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-object-id': title } });
}

function linksHtml(self) {
  return '<nav class="links" aria-label="This sheet as an object">' + [
    ['self (JSON)', self.links.self], ['self (Markdown)', self.links.self_markdown], ['values', self.links.values],
    ['webhook address', self.links.webhook], ['CSV', self.links.csv], ['environment object', self.links.environment_object], ['manual', self.links.manual],
  ].map(([label, href]) => `<a href="${esc(href)}">${esc(label)}</a>`).join('') + '</nav>';
}

function colLetter(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

export async function onRequestGet({ request, env, params }) {
  const id = String(params.id || '');
  const origin = new URL(request.url).origin;
  const sheet = await getSheet(env, id);
  if (!sheet) return page('no such sheet', `<h1>No sheet <code>${esc(id)}</code></h1><p class="meta">Sheets are listed for their owner at <a href="/api/sheets">/api/sheets</a>. The environment manual is at <a href="/api/environment?format=markdown">/api/environment?format=markdown</a>.</p>`, 404);
  const self = sheetSelfPayload(sheet, { origin, authority: sheet.visibility === 'public' ? 'public read' : 'none on this page' });
  const head = `<h1>${esc(sheet.title)}</h1><p class="meta"><code>${esc(self.ref)}</code> · ${esc(self.visibility)} · ${esc(self.kind === 'view_sheet' ? 'view over ' + self.view.source : 'stored grid')} · updated ${esc(sheet.updated_at)}</p>` + linksHtml(self);
  if (sheet.visibility !== 'public') {
    return page(sheet.title, head + `<h2>Private</h2><p>This sheet exists and is private: its cells are not shown here. ${esc(self.authority.how)}</p><p>Token for this sheet only: <code>${esc(self.authority.token_for_this_sheet)}</code></p><p>Make it public: <code>${esc(self.authority.make_public)}</code></p>`, 403);
  }
  let table = '';
  if (self.view) {
    const out = await runView(env, sheet.col_meta.view, { limit: 300 });
    if (out.error) table = `<pre>${esc(out.error + ' ' + (out.detail || ''))}</pre>`;
    else {
      table = '<div class="grid"><table><thead><tr><th class="n">#</th>' + out.columns.map((c) => `<th>${esc(c.header || c.path)}</th>`).join('') + '<th>object</th></tr></thead><tbody>'
        + out.rows.map((r, i) => `<tr><td class="n">${i + 1}</td>` + r.map((v) => `<td>${esc(v)}</td>`).join('') + `<td>${out.meta[i] && out.meta[i].href ? `<a href="${esc(out.meta[i].href)}">${esc(out.meta[i].id)}</a>` : esc(out.meta[i] ? out.meta[i].id : '')}</td></tr>`).join('')
        + '</tbody></table></div>' + `<p class="meta">${out.rows.length} rows, re-read from <code>${esc(self.view.source)}</code> on this open.</p>`;
    }
  } else {
    const rows = Math.min(Math.max(1, sheet.used_rows || 1), 500);
    const cols = Math.min(Math.max(1, sheet.used_cols || 1), 60);
    const got = await getValues(env, sheet, 'A1:' + colLetter(cols) + rows);
    const values = (got && got.values) || [];
    table = '<div class="grid"><table><thead><tr><th class="n"></th>' + Array.from({ length: cols }, (_, c) => `<th>${colLetter(c + 1)}</th>`).join('') + '</tr></thead><tbody>'
      + values.map((row, r) => `<tr><td class="n">${r + 1}</td>` + Array.from({ length: cols }, (_, c) => `<td>${esc(row[c])}</td>`).join('') + '</tr>').join('')
      + '</tbody></table></div>' + `<p class="meta">${sheet.cell_count} cells; showing the used range A1:${colLetter(cols)}${rows}.</p>`;
  }
  const how = `<h2>Operate it</h2><pre>${esc(self.operations.map((o) => o.method + ' ' + o.href + '   ' + o.summary).join('\n'))}</pre><p class="meta">${esc(self.authority.how)} Receipts: <a href="${esc(self.receipts.read)}">${esc(self.receipts.read)}</a></p>`;
  return page(sheet.title, head + table + how);
}
