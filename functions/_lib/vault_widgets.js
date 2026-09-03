function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function shortHash(input) {
  let h = 2166136261;
  const s = String(input == null ? '' : input);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function normalizeWidget(kind, item) {
  const x = item || {};
  const id = String(x.id || x.card_id || x.claim_id || x.short_id || kind + ':' + shortHash(JSON.stringify(x)));
  const title = x.title || x.article_title || x.key || x.role || x.source || id;
  const body = x.body || x.text || x.input || x.output || x.summary || x.detail || '';
  const ts = x.ts || x.created_at || x.updated_at || x.date || '';
  const href = x.href || x.link || (x.links && (x.links.full || x.links.trace)) || x.article_link || '';
  const hash = x.hash || shortHash(kind + '|' + id + '|' + title + '|' + body + '|' + ts);
  return {
    kind,
    id,
    title: String(title || '').slice(0, 180),
    body: String(body || '').slice(0, 900),
    ts,
    href,
    hash,
    status: x.status || x.source_status || x.quote_status || '',
    meta: x.meta || {},
    api: x.api || href || ''
  };
}

export function vaultStyles() {
  return `
.vault-shell{max-width:1480px}
.vault-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,380px);gap:24px;align-items:end;margin-bottom:22px;border-bottom:1px solid var(--line);padding-bottom:18px}
.vault-hero h1{font-size:30px;letter-spacing:0;margin:0}
.vault-hero p{font-size:15px;color:var(--ink-soft);line-height:1.55;max-width:860px}
.vault-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.vault-actions a,.vault-actions button{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line-strong);border-radius:6px;padding:9px 12px;background:#fff;color:var(--ink);font-weight:700;font-size:12px;text-decoration:none}
.vault-actions a:hover,.vault-actions button:hover{border-color:var(--accent);background:var(--accent-soft);text-decoration:none}
.vault-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0 24px}
.vault-stat{border:1px solid var(--line);border-radius:8px;background:#fff;padding:14px}
.vault-stat b{display:block;font:700 24px/1.1 var(--mono);color:var(--ink)}
.vault-stat span{display:block;margin-top:6px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.vault-band{margin:28px 0}
.vault-band-head{display:flex;align-items:baseline;gap:12px;margin-bottom:12px}
.vault-band-head h2{font-size:15px;margin:0;text-transform:uppercase;letter-spacing:.05em}
.vault-band-head a{font:12px var(--mono);margin-left:auto}
.vault-rail{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;padding:2px 2px 16px;scrollbar-width:none}
.vault-rail::-webkit-scrollbar{display:none}
.vault-card{flex:0 0 clamp(280px,78vw,340px);scroll-snap-align:start;display:flex;flex-direction:column;min-height:236px;border:1px solid var(--line);border-radius:8px;background:#fff;color:inherit;text-decoration:none;position:relative;overflow:hidden;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
.vault-card:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.10);border-color:var(--vc)}
.vault-card::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:var(--vc)}
.vault-card.task{--vc:#9a6a00}.vault-card.event{--vc:#0a52d0}.vault-card.card{--vc:#6a5acd}.vault-card.claim{--vc:#1a8f4a}.vault-card.protected{--vc:#b5453b}.vault-card.idea{--vc:#d32323}
.vc-top{display:flex;align-items:center;gap:8px;padding:14px 14px 10px 18px}
.vc-mark{width:30px;height:30px;border-radius:7px;background:var(--vc);color:#fff;display:flex;align-items:center;justify-content:center;font:800 11px/1 var(--mono)}
.vc-kind{font:800 10px/1 var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--vc)}
.vc-status{margin-left:auto;font:700 9px/1.4 var(--sans);letter-spacing:.05em;text-transform:uppercase;border:1px solid var(--line);border-radius:99px;padding:2px 7px;color:var(--muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vc-title{padding:0 14px 0 18px;font:800 16px/1.25 var(--sans);color:var(--ink)}
.vc-body{padding:9px 14px 12px 18px;font:13px/1.5 var(--sans);color:var(--ink-soft);white-space:pre-wrap;overflow-wrap:anywhere;max-height:104px;overflow:hidden}
.vc-foot{margin-top:auto;border-top:1px dashed var(--line);padding:10px 14px 12px 18px;display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}
.vc-id{font:700 10px/1.35 var(--mono);color:var(--vc);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vc-hash{font:10px/1.35 var(--mono);color:var(--muted)}
.vc-ts{grid-column:1/-1;font:10px/1.35 var(--mono);color:var(--muted)}
.vault-form{border:1px solid var(--line);border-radius:8px;background:#fff;padding:14px;margin-top:8px}
.vault-form textarea{width:100%;min-height:120px}
.vault-form-row{display:grid;grid-template-columns:220px 1fr auto;gap:10px;align-items:start}
.vault-lock{border:1px solid #e6c97a;background:#fff8e6;color:#5d4700;border-radius:8px;padding:12px 14px;margin:12px 0;font-size:13px;line-height:1.5}
@media(max-width:860px){.vault-hero{grid-template-columns:1fr}.vault-actions{justify-content:flex-start}.vault-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.vault-form-row{grid-template-columns:1fr}}
`;
}

export function renderVaultCard(widget) {
  const w = widget || {};
  const kind = String(w.kind || 'card');
  const mark = { task: 'TK', event: 'EV', card: 'CD', claim: 'CL', protected: 'LK', idea: 'ID' }[kind] || 'VA';
  const inner =
    `<div class="vc-top"><span class="vc-mark">${esc(mark)}</span><span class="vc-kind">${esc(kind)}</span>${w.status ? `<span class="vc-status">${esc(w.status)}</span>` : ''}</div>` +
    `<div class="vc-title">${esc(w.title || w.id || kind)}</div>` +
    `<div class="vc-body">${esc(w.body || '')}</div>` +
    `<div class="vc-foot"><span class="vc-id">${esc(w.id || '')}</span><span class="vc-hash">${esc(String(w.hash || '').slice(0, 12))}</span>${w.ts ? `<span class="vc-ts">${esc(String(w.ts).slice(0, 19).replace('T', ' '))}</span>` : ''}</div>`;
  if (w.href || w.api) {
    return `<a class="vault-card ${esc(kind)}" href="${esc(w.href || w.api)}">${inner}</a>`;
  }
  return `<div class="vault-card ${esc(kind)}">${inner}</div>`;
}

export function renderRail(title, widgets, href) {
  const cards = (widgets || []).map(renderVaultCard).join('');
  return `<section class="vault-band"><div class="vault-band-head"><h2>${esc(title)}</h2>${href ? `<a href="${esc(href)}">JSON</a>` : ''}</div><div class="vault-rail">${cards || '<div class="empty">No rows.</div>'}</div></section>`;
}
