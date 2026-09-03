// Custom leaderboard widget — a ranked, sourced, bar-metered standings card.
//
// Why this exists as its own renderer rather than a markdown table: a leaderboard on this
// site has to carry four things a table cannot, and the article's whole argument depends on
// all four being visible at once —
//   1. the metric's definition, so a reader knows what is being ranked;
//   2. what the metric CANNOT tell you, stated on the card rather than in a footnote;
//   3. per-row evidence — source, read date, evidence class — because a rank with no
//      provenance is the thing this article exists to argue against;
//   4. a magnitude the eye can read, so "last by a factor of 93" is seen, not computed.
//
// Design law: every editorial widget is flattened to a white background with black text by
// the release gate in functions/a/[slug].js (platform .rp-card cards are the only exemption).
// So this is built as a black-on-white reading surface on purpose: hairline rules, tabular
// numerals, and a solid meter. It does not fight the gate and needs no exemption from it.
//
// Data shape (stored on the article's widgets[] — this renderer holds no business logic):
//   { type:"leaderboard", title, metric, better:"higher"|"lower", unit, note,
//     limitation, source, source_url, read_at, evidence_class, formula,
//     rows:[ { label, value, display, meta, highlight:true, rank } ] }

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const num = v => (typeof v === 'number' && isFinite(v)) ? v : Number(String(v ?? '').replace(/[^0-9.eE+-]/g, ''));

export const leaderboardStyles = `
.lb{border:1px solid #111;padding:0;margin:34px 0;overflow:hidden}
.lb-h{padding:14px 16px 12px;border-bottom:1px solid #111}
.lb-t{font-weight:700;font-size:1.02em;line-height:1.25;letter-spacing:-.01em}
.lb-m{font-size:.82em;line-height:1.5;margin-top:6px;opacity:.86}
.lb-f{font-size:.78em;margin-top:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:5px 7px;border:1px solid #ccc;display:inline-block}
.lb-rows{display:block}
.lb-r{display:grid;grid-template-columns:2.1em minmax(8.5em,1fr) minmax(0,2.4fr) 5.4em;gap:10px;align-items:center;padding:9px 16px;border-bottom:1px solid #e6e6e6}
.lb-r:last-child{border-bottom:0}
.lb-r.lb-hi{background:#f4f4f4}
.lb-rank{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86em;opacity:.7;font-variant-numeric:tabular-nums}
.lb-hi .lb-rank{opacity:1;font-weight:700}
.lb-lab{font-size:.9em;line-height:1.3}
.lb-hi .lb-lab{font-weight:700}
.lb-sub{display:block;font-size:.76em;opacity:.62;margin-top:2px}
.lb-bar{height:11px;border:1px solid #111;position:relative}
.lb-fill{position:absolute;left:0;top:0;bottom:0;background:#111}
.lb-hi .lb-fill{background:#111;background-image:repeating-linear-gradient(135deg,#111 0 4px,#555 4px 8px)}
.lb-v{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.lb-hi .lb-v{font-weight:700}
.lb-foot{padding:11px 16px;border-top:1px solid #111;font-size:.78em;line-height:1.55}
.lb-lim{margin-top:6px;padding-left:10px;border-left:2px solid #111}
.lb-ev{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.94em;text-transform:uppercase;letter-spacing:.04em}
@media(max-width:640px){
  /* Two rows per entry: rank | label | value, then the bar spanning label+value.
     Every cell is placed explicitly — leaving the bar to auto-placement pushes the
     value onto a line of its own, which is how this first shipped and read as broken. */
  .lb-r{grid-template-columns:1.8em 1fr auto;gap:3px 8px;padding:10px 14px}
  .lb-rank{grid-column:1;grid-row:1}
  .lb-lab{grid-column:2;grid-row:1}
  .lb-v{grid-column:3;grid-row:1}
  .lb-bar{grid-column:2 / -1;grid-row:2;height:8px}
}
`;

export function leaderboardWidget(w) {
  const rows = Array.isArray(w.rows) ? w.rows.slice() : [];
  if (!rows.length) return '';

  const better = String(w.better || 'higher').toLowerCase();
  const vals = rows.map(r => num(r.value)).filter(v => isFinite(v));
  const max = vals.length ? Math.max(...vals) : 0;
  const min = vals.length ? Math.min(...vals) : 0;

  // Bar length is share-of-leader for higher-is-better, and share-of-best (inverted) for
  // lower-is-better, so the longest bar always means "best" whichever way the metric runs.
  const width = v => {
    if (!isFinite(v)) return 0;
    if (better === 'lower') {
      if (!(v > 0) || !(min > 0)) return v === min ? 100 : 2;
      return Math.max(2, (min / v) * 100);
    }
    if (!(max > 0)) return 2;
    return Math.max(2, (v / max) * 100);
  };

  const body = rows.map((r, i) => {
    const v = num(r.value);
    const disp = r.display != null ? String(r.display) : (isFinite(v) ? String(r.value) : '—');
    return `<div class="lb-r${r.highlight ? ' lb-hi' : ''}">` +
      `<div class="lb-rank">${esc(r.rank != null ? r.rank : i + 1)}</div>` +
      `<div class="lb-lab">${esc(r.label || '')}${r.meta ? `<span class="lb-sub">${esc(r.meta)}</span>` : ''}</div>` +
      `<div class="lb-bar"><div class="lb-fill" style="width:${width(v).toFixed(1)}%"></div></div>` +
      `<div class="lb-v">${esc(disp)}</div>` +
      `</div>`;
  }).join('');

  const src = w.source_url
    ? `<a href="${esc(w.source_url)}" rel="noopener">${esc(w.source || w.source_url)}</a>`
    : esc(w.source || '');

  const foot = [
    src ? `Source: ${src}` : '',
    w.read_at ? `Read ${esc(w.read_at)}` : '',
    w.evidence_class ? `<span class="lb-ev">${esc(w.evidence_class)}</span>` : '',
  ].filter(Boolean).join(' · ');

  return `<style>${leaderboardStyles}</style>` +
    `<div class="widget lb">` +
      `<div class="lb-h">` +
        `<div class="lb-t">${esc(w.title || '')}</div>` +
        (w.metric ? `<div class="lb-m">${esc(w.metric)}</div>` : '') +
        (w.formula ? `<div class="lb-f">${esc(w.formula)}</div>` : '') +
      `</div>` +
      `<div class="lb-rows">${body}</div>` +
      (foot || w.limitation ? `<div class="lb-foot">${foot}` +
        (w.limitation ? `<div class="lb-lim"><strong>What this cannot tell you:</strong> ${esc(w.limitation)}</div>` : '') +
        `</div>` : '') +
    `</div>`;
}
