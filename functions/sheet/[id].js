import { getSheet, getValues } from '../_lib/sheets_store.js';
import { runView } from '../_lib/sheet_views.js';
import { sheetSelfPayload } from '../_lib/sheet_self.js';
import { designLawStyles } from '../_lib/design_law.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(title, body, status = 200, extraHeaders = {}) {
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
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-object-id': title, ...extraHeaders } });
}

const enc = new TextEncoder();
const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64url = (text) => btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const unb64url = (text) => atob(String(text).replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - String(text).length % 4) % 4));
const same = (a, b) => {
  const x = String(a || ''), y = String(b || '');
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
};

export async function hashSheetPassword(password) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(String(password || ''))));
}

export async function sheetPasswordMatches(sheet, password) {
  const expected = String(sheet?.col_meta?.access?.password_sha256 || '');
  return expected.length === 64 && same(await hashSheetPassword(password), expected);
}

async function signAccess(secret, payload) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(secret || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload)))));
}

export async function issueSheetAccessCookie(sheet, secret, now = Date.now()) {
  const exp = Math.floor(now / 1000) + 86400;
  const payload = b64url(JSON.stringify({ id: sheet.id, exp, password_sha256: sheet?.col_meta?.access?.password_sha256 || '' }));
  const token = payload + '.' + await signAccess(secret, payload);
  return `ms_sheet=${token}; Path=/sheet/${encodeURIComponent(sheet.id)}; Max-Age=86400; SameSite=Lax; Secure; HttpOnly`;
}

export async function hasSheetAccess(request, sheet, secret, now = Date.now()) {
  const raw = String(request.headers.get('cookie') || '').split(/;\s*/).find((x) => x.startsWith('ms_sheet='))?.slice(9) || '';
  const [payload, signature] = raw.split('.');
  if (!payload || !signature || !same(signature, await signAccess(secret, payload))) return false;
  let claim;
  try { claim = JSON.parse(unb64url(payload)); } catch { return false; }
  return claim.id === sheet.id
    && claim.password_sha256 === String(sheet?.col_meta?.access?.password_sha256 || '')
    && Number(claim.exp || 0) > Math.floor(now / 1000);
}

function passwordForm(sheet, error = '') {
  return `<h1>${esc(sheet.title)}</h1><p class="meta"><code>sheet://${esc(sheet.id)}</code> · private native sheet</p>
  <form method="post"><label for="password">Password</label><input id="password" name="password" type="password" required autofocus>
  <button type="submit">View sheet</button>${error ? `<p role="alert">${esc(error)}</p>` : ''}</form>`;
}

function linksHtml(self) {
  return '<nav class="links" aria-label="This sheet as an object">' + [
    ['self (JSON)', self.links.self], ['self (Markdown)', self.links.self_markdown], ['values', self.links.values],
    ['webhook address', self.links.webhook], ['CSV', self.links.csv], ['environment object', self.links.environment_object], ['manual', self.links.manual],
  ].map(([label, href]) => `<a href="${esc(href)}">${esc(label)}</a>`).join('') + '</nav>';
}

function colLetter(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

const boundedInt = (value, fallback, min, max) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

export function sheetWindow(url, sheet) {
  const rowLimit = boundedInt(url.searchParams.get('row_limit'), 200, 1, 500);
  const colLimit = boundedInt(url.searchParams.get('column_limit'), 100, 1, 200);
  const rowStart = boundedInt(url.searchParams.get('row_start'), 2, 2, Math.max(2, Number(sheet.used_rows || 2)));
  const colStart = boundedInt(url.searchParams.get('column_start'), 1, 1, Math.max(1, Number(sheet.used_cols || 1)));
  return {
    rowStart,
    rowEnd: Math.min(Number(sheet.used_rows || 1), rowStart + rowLimit - 1),
    colStart,
    colEnd: Math.min(Number(sheet.used_cols || 1), colStart + colLimit - 1),
    rowLimit,
    colLimit,
  };
}

function pageHref(url, values) {
  const next = new URL(url);
  for (const [key, value] of Object.entries(values)) next.searchParams.set(key, String(value));
  return next.pathname + '?' + next.searchParams.toString();
}

export async function onRequestGet({ request, env, params }) {
  const id = String(params.id || '');
  const url = new URL(request.url);
  const origin = url.origin;
  const sheet = await getSheet(env, id);
  if (!sheet) return page('no such sheet', `<h1>No sheet <code>${esc(id)}</code></h1><p class="meta">Sheets are listed for their owner at <a href="/api/sheets">/api/sheets</a>. The environment manual is at <a href="/api/environment?format=markdown">/api/environment?format=markdown</a>.</p>`, 404);
  const passwordProtected = !!sheet?.col_meta?.access?.password_sha256;
  const passwordGranted = passwordProtected && await hasSheetAccess(request, sheet, env.SHEET_ACCESS_SECRET || env.SESSION_SECRET || env.TERMINAL_KEY);
  const self = sheetSelfPayload(sheet, { origin, authority: sheet.visibility === 'public' ? 'public read' : (passwordGranted ? 'password read' : 'none on this page') });
  const head = `<h1>${esc(sheet.title)}</h1><p class="meta"><code>${esc(self.ref)}</code> · ${esc(self.visibility)} · ${esc(self.kind === 'view_sheet' ? 'view over ' + self.view.source : 'stored grid')} · updated ${esc(sheet.updated_at)}</p>` + linksHtml(self);
  if (sheet.visibility !== 'public' && !passwordGranted && passwordProtected) {
    return page(sheet.title, passwordForm(sheet), 200);
  }
  if (sheet.visibility !== 'public' && !passwordGranted) {
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
    const w = sheetWindow(url, sheet);
    const range = colLetter(w.colStart) + w.rowStart + ':' + colLetter(w.colEnd) + w.rowEnd;
    const headerRange = colLetter(w.colStart) + '1:' + colLetter(w.colEnd) + '1';
    const [got, headerGot] = await Promise.all([getValues(env, sheet, range), getValues(env, sheet, headerRange)]);
    const values = (got && got.values) || [];
    const headers = (headerGot && headerGot.values && headerGot.values[0]) || [];
    const pager = '<nav class="links" aria-label="Sheet pages">'
      + (w.rowStart > 2 ? `<a href="${esc(pageHref(url, { row_start: Math.max(2, w.rowStart - w.rowLimit) }))}">← earlier rows</a>` : '')
      + (w.rowEnd < sheet.used_rows ? `<a href="${esc(pageHref(url, { row_start: w.rowEnd + 1 }))}">later rows →</a>` : '')
      + (w.colStart > 1 ? `<a href="${esc(pageHref(url, { column_start: Math.max(1, w.colStart - w.colLimit) }))}">← earlier columns</a>` : '')
      + (w.colEnd < sheet.used_cols ? `<a href="${esc(pageHref(url, { column_start: w.colEnd + 1 }))}">later columns →</a>` : '')
      + '</nav>';
    table = pager + '<div class="grid"><table><thead><tr><th class="n">#</th>'
      + Array.from({ length: w.colEnd - w.colStart + 1 }, (_, c) => `<th>${esc(headers[c] || colLetter(w.colStart + c))}</th>`).join('')
      + '</tr></thead><tbody>'
      + values.map((row, r) => `<tr><td class="n">${w.rowStart + r}</td>` + Array.from({ length: w.colEnd - w.colStart + 1 }, (_, c) => `<td>${esc(row[c])}</td>`).join('') + '</tr>').join('')
      + '</tbody></table></div>' + `<p class="meta">${sheet.cell_count} populated cells · ${sheet.used_rows} rows × ${sheet.used_cols} columns · showing ${esc(range)}.</p>` + pager;
  }
  const how = `<h2>Operate it</h2><pre>${esc(self.operations.map((o) => o.method + ' ' + o.href + '   ' + o.summary).join('\n'))}</pre><p class="meta">${esc(self.authority.how)} Receipts: <a href="${esc(self.receipts.read)}">${esc(self.receipts.read)}</a></p>`;
  return page(sheet.title, passwordProtected ? `<h1>${esc(sheet.title)}</h1><p class="meta"><code>sheet://${esc(sheet.id)}</code> · password protected native sheet</p>` + table : head + table + how);
}

export async function onRequestPost({ request, env, params }) {
  const id = String(params.id || '');
  const sheet = await getSheet(env, id);
  if (!sheet || !sheet?.col_meta?.access?.password_sha256) return page('no such protected sheet', '<h1>No protected sheet</h1>', 404);
  const form = await request.formData();
  if (!await sheetPasswordMatches(sheet, form.get('password'))) return page(sheet.title, passwordForm(sheet, 'Wrong password.'), 401);
  const cookie = await issueSheetAccessCookie(sheet, env.SHEET_ACCESS_SECRET || env.SESSION_SECRET || env.TERMINAL_KEY);
  return new Response(null, { status: 303, headers: { location: `/sheet/${encodeURIComponent(id)}`, 'set-cookie': cookie, 'cache-control': 'no-store' } });
}
