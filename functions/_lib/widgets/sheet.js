// A spreadsheet range, rendered inside an article.
//
// The build's own working surface is a grid; an article that describes it should be able to show
// it rather than describe it. The widget takes a snapshot of a range at publish time — values are
// embedded, so the page renders with no request and no token — and links the live sheet beside it.
// A cell keeps its address, so a reader can point at C4 and mean the same cell the agent wrote.
//
// Kept deliberately dumb: no fetch, no auth, no client state. A public article must never carry a
// credential, and a widget that needs one would either leak it or render empty.

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

const CSS = `
.shw{
  /* Literals, not design-profile tokens. The contrast gate refuses --ink-3 here because the
     profile can drift below the 4.5:1 floor without this file changing, which is exactly how a
     widget goes unreadable silently. Muted ink is 5.9:1 on the header fill and 6.8:1 on white. */
  --shw-line:#d9dde8; --shw-line-soft:#e7eaf2; --shw-fill:#eef0f6;
  --shw-ink:#141824; --shw-mut:#545b70; --shw-panel:#ffffff;
}
.shw{color:var(--shw-ink);margin:26px 0;border:1px solid var(--shw-line);border-radius:10px;overflow:hidden;
  background:var(--shw-panel);font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
.shw-hd{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px;padding:11px 14px;
  background:var(--shw-fill);border-bottom:1px solid var(--shw-line)}
.shw-ttl{font-size:.82rem;font-weight:600;letter-spacing:.02em}
.shw-rng{font-family:ui-monospace,Menlo,monospace;font-size:.72rem;color:var(--shw-mut)}
.shw-lnk{margin-left:auto;font-size:.72rem}
.shw-scroll{overflow-x:auto}
.shw table{border-collapse:collapse;width:100%;min-width:520px;font-size:.78rem;
  font-variant-numeric:tabular-nums}
.shw th,.shw td{border-bottom:1px solid var(--shw-line-soft);
  border-right:1px solid var(--shw-line-soft);padding:6px 9px;text-align:left;
  vertical-align:top;max-width:34ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.shw td.shw-wrap{white-space:normal}
.shw thead th{background:var(--shw-fill);font-size:.68rem;letter-spacing:.06em;
  text-transform:uppercase;color:var(--shw-mut);font-weight:600}
.shw tbody tr:nth-child(even){background:rgba(0,0,0,.015)}
.shw .shw-gut{background:var(--shw-fill);color:var(--shw-mut);
  font-family:ui-monospace,Menlo,monospace;font-size:.68rem;text-align:right;
  width:3.2em;position:sticky;left:0}
.shw-ft{padding:9px 14px;border-top:1px solid var(--shw-line);
  font-size:.72rem;color:var(--shw-mut);background:var(--shw-panel)}
.shw-mono{font-family:ui-monospace,Menlo,monospace;font-size:.72rem}
/* One fixed palette, no OS branch: the card surface does not follow the reader's theme, so ink
   that did would invert against a background that stayed put. */
`;

export function sheetWidget(w) {
  const rows = Array.isArray(w.values) ? w.values : [];
  if (!rows.length) return '';

  const startRow = Number(w.start_row) > 0 ? Number(w.start_row) : 1;
  const startCol = Number(w.start_col) > 0 ? Number(w.start_col) : 1;
  const headerRow = w.header === false ? null : rows[0];
  const bodyRows = w.header === false ? rows : rows.slice(1);
  const wrapCols = new Set((Array.isArray(w.wrap_columns) ? w.wrap_columns : []).map(Number));
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);

  const head = headerRow
    ? '<thead><tr><th class="shw-gut">' + (w.show_addresses === false ? '' : startRow) + '</th>' +
      Array.from({ length: width }, (_, i) =>
        `<th>${esc(headerRow[i] == null ? '' : headerRow[i])}` +
        (w.show_addresses === false ? '' : `<span class="shw-rng"> ${colLetter(startCol + i)}</span>`) +
        `</th>`).join('') + '</tr></thead>'
    : '';

  const body = '<tbody>' + bodyRows.map((r, ri) => {
    const addr = startRow + ri + (headerRow ? 1 : 0);
    return '<tr><td class="shw-gut">' + (w.show_addresses === false ? '' : addr) + '</td>' +
      Array.from({ length: width }, (_, ci) => {
        const v = r[ci] == null ? '' : String(r[ci]);
        const cls = wrapCols.has(ci) ? ' class="shw-wrap"' : '';
        return `<td${cls} title="${esc(v.slice(0, 400))}">${esc(v)}</td>`;
      }).join('') + '</tr>';
  }).join('') + '</tbody>';

  const link = w.sheet_url
    ? `<a class="shw-lnk" href="${esc(w.sheet_url)}">open the live sheet →</a>` : '';
  const note = w.note
    ? `<div class="shw-ft">${esc(w.note)}</div>` : '';

  return `<style>${CSS}</style><figure class="shw">` +
    `<div class="shw-hd">` +
      `<span class="shw-ttl">${esc(w.title || 'Sheet')}</span>` +
      (w.range ? `<span class="shw-rng">${esc(w.range)}</span>` : '') +
      link +
    `</div>` +
    `<div class="shw-scroll"><table>${head}${body}</table></div>` +
    note +
  `</figure>`;
}
