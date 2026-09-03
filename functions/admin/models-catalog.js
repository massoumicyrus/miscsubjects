import { shellHtml } from './_layout.js';

export async function onRequestGet(context) {
  let catalog = {};
  let loadError = '';
  try {
    const r = await fetch(new URL('/data/cf_ai_catalog.json', context.request.url));
    if (r.ok) catalog = await r.json();
    else loadError = `HTTP ${r.status}`;
  } catch (e) { loadError = e.message; }

  const e = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const webSearchSet = new Set(catalog.web_search_capable || []);

  const allModels = [
    ...(catalog.text_generation_models || []).map(m => ({ ...m, source: 'Cloudflare AI' })),
    ...(catalog.external_models || []).map(m => ({ ...m, source: 'External API' })),
  ];

  // Build comparison matrix rows
  const matrixRows = allModels.map((m, idx) => {
    const isWebSearch = webSearchSet.has(m.name);
    const f = m.features || {};
    const p = m.pricing || {};
    const ctx = m.context_window ? (m.context_window >= 1000 ? (m.context_window / 1000).toFixed(0) + 'k' : m.context_window) : '—';
    const inCost = p.input != null ? '$' + p.input : '—';
    const outCost = p.output != null ? '$' + p.output : '—';
    const check = (v) => v ? '<span class="check yes">✓</span>' : '<span class="check no">—</span>';
    
    return `
    <tr class="model-row${isWebSearch ? ' websearch' : ''}" data-idx="${idx}">
      <td class="model-name">${e(m.name)}${isWebSearch ? '<span class="ws-tag">🔍 search</span>' : ''}</td>
      <td class="prov">${e(m.provider)}</td>
      <td class="src">${e(m.source)}</td>
      <td class="num">${ctx}</td>
      <td class="num">${inCost}</td>
      <td class="num">${outCost}</td>
      <td class="cap">${check(f.function_calling)}</td>
      <td class="cap">${check(f.reasoning)}</td>
      <td class="cap">${check(f.vision)}</td>
      <td class="cap">${check(f.web_search)}</td>
    </tr>
    <tr class="detail-row" id="detail-${idx}" style="display:none">
      <td colspan="10">
        <div class="detail-panel">
          <div class="detail-head">
            <span class="mono">${e(m.name)}</span>
            <span class="sub">${e(m.provider)} · ${e(m.source)}</span>
          </div>
          ${m.endpoint ? `<div class="detail-line"><b>endpoint:</b> <span class="mono">${e(m.endpoint)}</span></div>` : ''}
          ${m.auth ? `<div class="detail-line"><b>auth:</b> ${e(m.auth)}</div>` : ''}
          <div class="detail-line"><b>context:</b> ${e(m.context_window?.toLocaleString() || '—')} tokens</div>
          <div class="detail-line"><b>pricing:</b> in ${inCost} / out ${outCost} per M tokens ${p.cached_input ? `(cached ${p.cached_input})` : ''}</div>
          <div class="detail-line"><b>capabilities:</b> ${Object.entries(f).filter(([,v])=>v).map(([k])=>k.replace(/_/g,' ')).join(', ') || 'none'}</div>
          <div class="detail-params">
            <div class="lbl" style="margin:8px 0 4px">Parameters</div>
            <table class="param-table">
              <thead><tr><th>parameter</th><th>type</th><th>min</th><th>max</th><th>default</th></tr></thead>
              <tbody>${Object.entries(m.parameters || {}).map(([k,v]) => {
                const min = v.min !== undefined ? v.min : '—';
                const max = v.max !== undefined ? v.max : '—';
                const def = v.default !== undefined ? (typeof v.default === 'object' ? JSON.stringify(v.default) : v.default) : '—';
                return `<tr><td class="mono">${e(k)}</td><td>${e(v.type)}</td><td class="num">${e(String(min))}</td><td class="num">${e(String(max))}</td><td class="num">${e(String(def))}</td></tr>`;
              }).join('')}</tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');

  const body = `
<style>
.mc{max-width:1400px}
.mc h1{margin:0 0 4px;font-size:20px;font-weight:700}
.mc .subtitle{color:var(--muted);font-size:13px;margin-bottom:12px}

/* Stats */
.mc .stats{display:flex;gap:0;margin-bottom:14px;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:#fff}
.mc .stats > div{flex:1;padding:10px 14px;text-align:center;border-right:1px solid var(--line);font-size:13px}
.mc .stats > div:last-child{border-right:0}
.mc .stats .num{font-size:22px;font-weight:700;color:var(--accent);display:block;line-height:1}
.mc .stats .lbl{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:2px}

/* Comparison matrix */
.mc .matrix-wrap{border:1px solid var(--line);border-radius:6px;overflow:hidden;background:#fff}
.mc .matrix{width:100%;border-collapse:collapse;font-size:12.5px}
.mc .matrix thead th{background:#f8f9fa;border-bottom:1px solid var(--line);padding:7px 10px;text-align:left;font-weight:700;font-size:11px;color:#546e7a;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
.mc .matrix thead th.cap{text-align:center}
.mc .matrix thead th.num{text-align:right}
.mc .matrix tbody td{border-bottom:1px solid #eee;padding:7px 10px;vertical-align:middle}
.mc .matrix tbody tr:nth-child(4n+1) td{background:#fff}
.mc .matrix tbody tr:nth-child(4n+3) td{background:#fafbfc}
.mc .matrix tbody tr.model-row:hover td{background:#e8f5e9;cursor:pointer}
.mc .matrix tbody tr.model-row.websearch td{border-left:3px solid #f59e0b}
.mc .matrix td.model-name{font-family:var(--mono);font-size:12px;font-weight:600;color:#263238}
.mc .matrix td.prov{color:#546e7a;font-size:12px}
.mc .matrix td.src{color:#78909c;font-size:11px}
.mc .matrix td.num{font-family:var(--mono);font-size:12px;color:#37474f;text-align:right}
.mc .matrix td.cap{text-align:center}
.mc .matrix .check{display:inline-block;width:20px;height:20px;line-height:20px;border-radius:99px;text-align:center;font-size:11px;font-weight:700}
.mc .matrix .check.yes{background:#e8f5e9;color:#2e7d32}
.mc .matrix .check.no{color:#bdbdbd}
.mc .matrix .ws-tag{font-size:10px;font-weight:700;background:#f59e0b;color:#fff;padding:1px 6px;border-radius:99px;margin-left:6px;vertical-align:middle}

/* Detail panel */
.mc .detail-row td{padding:0 !important;border-bottom:1px solid var(--line) !important}
.mc .detail-panel{padding:12px 14px;background:#f8f9fa}
.mc .detail-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.mc .detail-head .mono{font-size:13px;font-weight:700;color:#263238}
.mc .detail-head .sub{color:#78909c;font-size:12px}
.mc .detail-line{font-size:12px;color:#37474f;margin-bottom:4px}
.mc .detail-line b{color:#546e7a;font-weight:600}
.mc .detail-line .mono{font-family:var(--mono);font-size:11.5px}
.mc .detail-params{margin-top:8px}
.mc .param-table{width:100%;border-collapse:collapse;font-size:12px}
.mc .param-table th{background:#eceff1;border-bottom:1px solid var(--line);padding:4px 8px;text-align:left;font-weight:600;font-size:11px;color:#546e7a;text-transform:uppercase;letter-spacing:.03em}
.mc .param-table td{border-bottom:1px solid #e0e0e0;padding:3px 8px;color:#37474f;font-family:var(--sans)}
.mc .param-table td.mono{font-family:var(--mono);font-size:11px}
.mc .param-table td.num{font-family:var(--mono);font-size:11px;text-align:right}

/* Legend */
.mc .legend{display:flex;gap:12px;margin-top:10px;font-size:12px;color:#78909c;flex-wrap:wrap}
.mc .legend span{display:inline-flex;align-items:center;gap:5px}
.mc .legend .dot{width:10px;height:10px;border-radius:99px;display:inline-block}
</style>

<div class="mc">
  <h1>Model differences</h1>
  <p class="subtitle">Every model wired in the build — compare capabilities, cost, and context at a glance. Click any row to expand parameters. Fetched ${e(catalog.fetched_at || '—')}.</p>
  ${loadError ? `<p class="subtitle" style="color:#c14a4a">Failed to load catalog: ${e(loadError)}</p>` : ''}

  <div class="stats">
    <div><span class="num">${allModels.length}</span><span class="lbl">Total models</span></div>
    <div><span class="num">${(catalog.text_generation_models || []).length}</span><span class="lbl">Cloudflare AI</span></div>
    <div><span class="num">${(catalog.external_models || []).length}</span><span class="lbl">External APIs</span></div>
    <div><span class="num">${(catalog.web_search_capable || []).length}</span><span class="lbl">Web search</span></div>
  </div>

  <div class="matrix-wrap">
    <table class="matrix">
      <thead>
        <tr>
          <th>Model</th>
          <th>Provider</th>
          <th>Source</th>
          <th class="num">Context</th>
          <th class="num">In $/M</th>
          <th class="num">Out $/M</th>
          <th class="cap">Fn</th>
          <th class="cap">Reason</th>
          <th class="cap">Vision</th>
          <th class="cap">Search</th>
        </tr>
      </thead>
      <tbody>${matrixRows}</tbody>
    </table>
  </div>

  <div class="legend">
    <span><span class="dot" style="background:#f59e0b"></span> Web search capable</span>
    <span><span class="check yes" style="width:auto;height:auto;padding:1px 5px">✓</span> Yes</span>
    <span><span class="check no" style="width:auto;height:auto;padding:1px 5px">—</span> No</span>
    <span>Fn = function calling · Reason = reasoning · Search = web search</span>
  </div>
</div>

<script>
(function(){
  document.querySelectorAll('.model-row').forEach(function(row){
    row.addEventListener('click', function(){
      var idx = this.getAttribute('data-idx');
      var detail = document.getElementById('detail-' + idx);
      if (!detail) return;
      var showing = detail.style.display !== 'none';
      // close all others
      document.querySelectorAll('.detail-row').forEach(function(d){ d.style.display = 'none'; });
      document.querySelectorAll('.model-row').forEach(function(r){ r.classList.remove('open'); });
      if (!showing) {
        detail.style.display = '';
        this.classList.add('open');
      }
    });
  });
})();
</script>
`;

  return new Response(shellHtml({ activeHref: '/admin/models-catalog', title: 'Model differences', body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
