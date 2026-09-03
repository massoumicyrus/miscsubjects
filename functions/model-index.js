// /model-index — the human projection of the living leaderboard.
//
// Every cell states where it came from and how strong that is. A figure with no source URL
// cannot be rendered, because the store cannot hold one. Sorting and filtering happen against
// the same observations the API returns, so a reader and a machine see the identical object.

import { designSystemHeader, designSystemFooter, designSystemStyles } from './_lib/design_system.js';

const CLASS_LABEL = {
  measured: 'measured', reported: 'reported', vendor_stated: 'vendor', derived: 'derived',
  promotional: 'promo', unresolved: 'unresolved',
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const FAMILIES = [
  { key: 'capability', title: 'Capability', note: 'What the model can do, graded by running it.' },
  { key: 'obedience', title: 'Obedience', note: 'Whether it does what it was told. Machine-checkable output constraints, no judge model.' },
  { key: 'writing', title: 'Writing', note: 'Judged, not executed. The softest column here.' },
  { key: 'popularity', title: 'Popularity', note: 'What developers actually pick on one open marketplace.' },
  { key: 'price', title: 'Price', note: 'List price per million tokens, by venue. The same weights sell for very different money.' },
];

function fmt(row) {
  const v = row.value_num;
  if (v == null) return esc(row.value_text || '');
  if (row.unit === 'usd_per_mtok') return '$' + v.toFixed(3);
  if (row.unit === 'usd') return '$' + v.toFixed(2);
  if (row.unit === 'percent') return v.toFixed(1) + '%';
  if (row.unit === 'fraction') return v.toFixed(3);
  if (row.unit === 'tokens_per_week') return v >= 1e12 ? (v / 1e12).toFixed(2) + 'T' : (v / 1e9).toFixed(0) + 'B';
  return String(v);
}

function cell(row) {
  const cls = CLASS_LABEL[row.evidence_class] || row.evidence_class;
  return `<tr>
    <td class="mi-model"><b>${esc(row.model_label)}</b>${row.maker ? `<span>${esc(row.maker)}</span>` : ''}</td>
    <td class="mi-val">${fmt(row)}</td>
    ${row.venue ? `<td class="mi-venue">${esc(row.venue)}${row.precision_note && row.precision_note !== 'unstated' ? `<span class="mi-q">${esc(row.precision_note)}</span>` : ''}</td>` : '<td class="mi-venue">—</td>'}
    <td><span class="mi-cls mi-cls-${esc(row.evidence_class)}">${esc(cls)}</span></td>
    <td class="mi-src"><a href="${esc(row.source_url)}" target="_blank" rel="noopener">${esc(row.source_publisher || 'source')}</a><span>${esc(String(row.observed_at || '').slice(0, 10))}</span></td>
  </tr>`;
}

const LANES = [
  { key: 'capability', title: 'Capability', what: 'What models can do, graded by running them.' },
  { key: 'price', title: 'Price', what: 'What they cost, machine-readable where it exists.' },
  { key: 'usage', title: 'Usage', what: 'What developers actually pick, in tokens.' },
  { key: 'practice', title: 'Practice', what: 'How the labs themselves say to run agents.' },
  { key: 'trends', title: 'Trends', what: 'Where new work appears first.' },
];

function sourceRow(s) {
  const dead = s.verified_status && s.verified_status >= 400;
  return `<tr>
    <td class="mi-model"><b><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a></b><span>${esc(s.what_it_answers)}</span></td>
    <td class="mi-venue">${s.machine_endpoint ? `<code class="mi-ep">${esc(s.machine_endpoint)}</code>` : '<span class="mi-q">human-read</span>'}</td>
    <td class="mi-venue">${esc(s.cadence || '')}</td>
    <td><span class="mi-cls${dead ? ' mi-cls-promotional' : ''}">${s.verified_status ? esc(String(s.verified_status)) : '—'}</span><span class="mi-q">${esc(String(s.verified_at || '').slice(0, 10))}</span></td>
  </tr>`;
}

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  let rows = [];
  let queryError = null;
  let lastRun = null;
  let registry = [];
  try {
    const r = await env.DB.prepare(
      `SELECT * FROM model_index_observations WHERE superseded_by IS NULL
       ORDER BY metric_family, metric, value_num DESC LIMIT 4000`).all();
    rows = r.results || [];
    lastRun = await env.DB.prepare('SELECT * FROM model_index_runs ORDER BY started_at DESC LIMIT 1').first();
    const g = await env.DB.prepare(
      'SELECT * FROM model_index_sources WHERE retired_at IS NULL ORDER BY lane, name').all();
    registry = g.results || [];
  } catch (e) {
    queryError = String(e && e.message ? e.message : e);
  }

  const byMetric = {};
  for (const r of rows) (byMetric[r.metric] ||= []).push(r);

  const total = rows.length;
  const models = new Set(rows.map((r) => r.model_key)).size;
  const venues = new Set(rows.map((r) => r.venue).filter(Boolean)).size;
  const sourced = rows.filter((r) => r.source_url).length;

  const section = (fam) => {
    const metrics = Object.keys(byMetric).filter((m) => (byMetric[m][0] || {}).metric_family === fam.key);
    if (!metrics.length) return '';
    return `<section class="mi-sec"><h2>${esc(fam.title)}</h2><p class="mi-note">${esc(fam.note)}</p>
      ${metrics.map((m) => {
        const list = byMetric[m].slice(0, fam.key === 'price' ? 40 : 25);
        return `<h3 class="mi-metric">${esc(m)}</h3>
        <div class="mi-scroll"><table class="mi-table"><thead><tr><th>Model</th><th>Value</th><th>Venue</th><th>Evidence</th><th>Source · read</th></tr></thead>
        <tbody>${list.map(cell).join('')}</tbody></table></div>`;
      }).join('')}
    </section>`;
  };

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The living model index — every figure with its source and evidence class — miscsubjects</title>
<meta name="description" content="A living leaderboard of language models held as observations. Every number carries its source URL, read date and evidence class.">
<style>${designSystemStyles()}
.mi-wrap{max-width:1180px;margin:0 auto;padding:0 var(--ds-s4,20px) 90px}
.mi-lede{max-width:74ch;margin:26px 0 6px}
.mi-stats{display:flex;gap:28px;flex-wrap:wrap;margin:18px 0 10px;padding:14px 0;border-top:1px solid var(--ds-line);border-bottom:1px solid var(--ds-line)}
.mi-stats div{display:flex;flex-direction:column}
.mi-stats b{font-size:1.45rem;line-height:1.1}
.mi-stats span{font-size:.74rem;text-transform:uppercase;letter-spacing:.06em;color:var(--ds-dim)}
.mi-sec{margin-top:46px}
.mi-note{color:var(--ds-dim);max-width:70ch;margin:.2rem 0 1rem}
.mi-metric{font-family:var(--ds-mono,monospace);font-size:.82rem;letter-spacing:.02em;color:var(--ds-dim);text-transform:none;margin:22px 0 6px}
.mi-scroll{overflow-x:auto}
.mi-table{width:100%;border-collapse:collapse;font-size:.88rem}
.mi-table th{text-align:left;font-size:.7rem;text-transform:uppercase;letter-spacing:.07em;color:var(--ds-dim);padding:6px 10px 6px 0;border-bottom:1px solid var(--ds-line);white-space:nowrap}
.mi-table td{padding:7px 10px 7px 0;border-bottom:1px solid var(--ds-line);vertical-align:top}
.mi-model b{display:block}
.mi-model span{font-size:.74rem;color:var(--ds-dim)}
.mi-val{font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}
.mi-venue{white-space:nowrap}
.mi-q{display:block;font-size:.7rem;color:var(--ds-dim)}
.mi-cls{font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;padding:2px 6px;border-radius:3px;border:1px solid var(--ds-line);white-space:nowrap}
.mi-cls-measured{border-color:var(--ds-sage);color:var(--ds-sage)}
.mi-cls-promotional{border-color:var(--ds-accent);color:var(--ds-accent)}
.mi-cls-reported,.mi-cls-vendor_stated{color:var(--ds-dim)}
.mi-src a{display:block;font-size:.82rem}
.mi-src span{font-size:.72rem;color:var(--ds-dim);font-variant-numeric:tabular-nums}
.mi-err{padding:14px;border:1px solid var(--ds-accent);border-radius:6px;color:var(--ds-accent)}
.mi-ep{font-size:.74rem;word-break:break-all}
.mi-machine{margin-top:40px;padding-top:18px;border-top:1px solid var(--ds-line);font-size:.86rem}
.mi-machine code{font-size:.8rem}
</style></head><body>
${designSystemHeader()}
<main class="mi-wrap">
  <h1>The living model index</h1>
  <p class="mi-lede">Every figure below is one observation: what was measured, of which model, at which venue, by whom, on what date, with the URL it came from and the class of evidence it is. Nothing is stored as a bare number, so nothing here has to be taken on trust. A changed price becomes a new observation and the previous one is kept, marked superseded.</p>
  ${queryError ? `<p class="mi-err">The index could not be read: ${esc(queryError)}. This message exists because an empty page would look like an empty market.</p>` : ''}
  <div class="mi-stats">
    <div><b>${total}</b><span>live observations</span></div>
    <div><b>${models}</b><span>models</span></div>
    <div><b>${venues}</b><span>venues priced</span></div>
    <div><b>${sourced}</b><span>carrying a source URL</span></div>
    <div><b>${esc(lastRun ? String(lastRun.started_at).slice(0, 16).replace('T', ' ') : 'never')}</b><span>last refresh</span></div>
  </div>
  ${FAMILIES.map(section).join('')}
  ${registry.length ? `<section class="mi-sec"><h2>Where this index reads from</h2>
    <p class="mi-note">The registry of definitive sources, itself held as rows: what each surface answers, its machine endpoint where one exists, and the HTTP status this build got the last time it checked. A dead source shows its failure instead of disappearing. Machine copy: <code>/api/model-index/sources</code>.</p>
    ${LANES.map((l) => {
      const list = registry.filter((s) => s.lane === l.key);
      if (!list.length) return '';
      return `<h3 class="mi-metric">${esc(l.title)} — ${esc(l.what)}</h3>
      <div class="mi-scroll"><table class="mi-table"><thead><tr><th>Source</th><th>Machine endpoint</th><th>Cadence</th><th>Last check</th></tr></thead>
      <tbody>${list.map(sourceRow).join('')}</tbody></table></div>`;
    }).join('')}
  </section>` : ''}
  <div class="mi-machine">
    <b>The same object, for machines.</b>
    <p>Current view <code>/api/model-index</code> · one metric <code>/api/model-index?metric=aa_ifbench</code> · one model <code>/api/model-index?model=z-ai/glm-5.2</code> · the raw append-only log including superseded rows <code>/api/model-index/observations</code> · every refresh and what failed <code>/api/model-index/runs</code> · the definitive sources registry <code>/api/model-index/sources</code>.</p>
    <p>Each record returns the metric definition, what it can and cannot tell you, the evidence class and what that class means, the verbatim quote where the source is prose, and the URL. Disagree by opening the source, not by trusting the row.</p>
  </div>
</main>
${designSystemFooter()}
</body></html>`;

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
