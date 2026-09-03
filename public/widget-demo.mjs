// Standalone widget renderer for the public widgets demo page.
// Mirrors the style and behaviour of functions/_lib/widgets.js and
// functions/_lib/vault_widgets.js so the demo stays faithful to production.

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function wrapStyle(style) {
  if (!style) return '';
  const parts = [];
  const transforms = [];
  if (style.rotate) transforms.push(`rotate(${Number(style.rotate)}deg)`);
  if (style.offset_x || style.offset_y) transforms.push(`translate(${Number(style.offset_x || 0)}px, ${Number(style.offset_y || 0)}px)`);
  if (transforms.length) parts.push(`transform:${transforms.join(' ')}`);
  if (style.pulse) parts.push('animation:widgetPulse 2.6s ease-in-out infinite');
  return parts.length ? ` style="${parts.join(';')}"` : '';
}

function typingBubble(kind) {
  return `<div class="${kind}-row ${kind}-them"><div class="${kind}-bubble ${kind}-typing"><span class="${kind}-dots"><span></span><span></span><span></span></span><span class="${kind}-cursor"></span></div></div>`;
}

function imessageWidget(w) {
  const id = esc(w.id || w.contact || 'Messages');
  const initial = esc(String(w.id || w.contact || '?').trim().slice(0, 1).toUpperCase());
  const sub = w.subtitle ? `<div class="im-sub">${esc(w.subtitle)}</div>` : '';
  const bubbles = (Array.isArray(w.messages) ? w.messages : []).map(msg => {
    const me = (msg.from === 'me' || msg.side === 'right' || msg.me === true);
    return `<div class="im-row ${me ? 'im-me' : 'im-them'}"><div class="im-bubble">${esc(msg.text || msg.content || '')}</div></div>`;
  }).join('');
  const typing = w.typing_indicator ? typingBubble('im') : '';
  const suggest = w.suggested_question
    ? `<div class="im-row im-them"><div class="im-bubble">${esc(w.suggested_question)}</div></div>`
    : '';
  return `<div class="widget im"${wrapStyle(w.style)}><div class="im-phone">` +
    `<div class="im-bar"><div class="im-avatar">${initial}</div><div class="im-name">${id}${sub}</div></div>` +
    `<div class="im-thread">${bubbles}${typing}${suggest}</div>` +
    `<div class="im-input"><span>iMessage</span></div>` +
    `</div></div>`;
}

function whatsappWidget(w) {
  const name = esc(w.chat_name || w.chat || 'WhatsApp');
  const sub = w.subtitle ? `<div class="wa-sub">${esc(w.subtitle)}</div>` : '';
  const bubbles = (Array.isArray(w.messages) ? w.messages : []).map(msg => {
    const me = (msg.from === 'me' || msg.side === 'right' || msg.me === true);
    const time = msg.time ? `<span class="wa-time">${esc(msg.time)}</span>` : '';
    return `<div class="wa-row ${me ? 'wa-me' : 'wa-them'}"><div class="wa-bubble">${esc(msg.text || msg.content || '')}${time}</div></div>`;
  }).join('');
  const typing = w.typing_indicator ? typingBubble('wa') : '';
  const suggest = w.suggested_question
    ? `<div class="wa-row wa-them"><div class="wa-bubble">${esc(w.suggested_question)}</div></div>`
    : '';
  return `<div class="widget wa"${wrapStyle(w.style)}><div class="wa-phone">` +
    `<div class="wa-bar"><div class="wa-name">${name}${sub}</div></div>` +
    `<div class="wa-thread">${bubbles}${typing}${suggest}</div>` +
    `<div class="wa-input"><span>Message</span></div>` +
    `</div></div>`;
}

function siteLogo(site) {
  const logos = {
    wikipedia: 'https://upload.wikimedia.org/wikipedia/commons/8/80/Wikipedia-logo-v2.svg',
    harvard: 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Harvard_University_coat_of_arms.svg',
    stanford: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Seal_of_Leland_Stanford_Junior_University.svg',
    mayo: 'https://assets.mayoclinic.org/content/dam/mayoclinic/images/logo.png',
    nih: 'https://upload.wikimedia.org/wikipedia/commons/f/f8/NIH_2012_logo.svg',
    pubmed: 'https://upload.wikimedia.org/wikipedia/commons/f/fb/US-NLM-PubMed-Logo.svg',
    fda: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Food_and_Drug_Administration_logo.svg',
    ema: 'https://www.ema.europa.eu/themes/custom/ema_theme/images/logo/ema-logo.png',
    who: 'https://upload.wikimedia.org/wikipedia/commons/c/c2/World_Health_Organization_logo.svg',
    cdc: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/US_CDC_logo.svg',
  };
  return logos[site] || '';
}

function formatBody(text, maxParagraphs = 6) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const paras = raw.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const kept = paras.slice(0, maxParagraphs);
  const more = paras.length > maxParagraphs;
  return kept.map(p => `<p>${esc(p)}</p>`).join('') + (more ? '<p class="se-more">…</p>' : '');
}

function copyButton(text) {
  return `<button class="se-copy" type="button" aria-label="Copy text" data-text="${esc(text)}" onclick="copyWidgetText(this)">Copy</button>`;
}

function askButton(text, source) {
  const q = esc(text || '');
  const s = esc(source || '');
  return `<button class="se-ask" type="button" data-question="${q}" data-source="${s}" onclick="askWidget(this)">Ask about this</button>`;
}

function sourceFoot(w) {
  const hash = esc(String(w.hash || '').slice(0, 12));
  const ts = w.timestamp || w.ts || w.date || '';
  const ledger = w.ledger_url || w.verify_url || w.url || '';
  const chips = [];
  if (hash) chips.push(`<span class="se-hash" title="${esc(w.hash || '')}">#${hash}</span>`);
  if (ts) chips.push(`<span class="se-ts">${esc(String(ts).slice(0, 19).replace('T', ' '))}</span>`);
  if (ledger) chips.push(`<a class="se-ledger" href="${esc(ledger)}" target="_blank" rel="noopener">ledger ↗</a>`);
  return chips.length ? `<div class="se-foot">${chips.join('')}</div>` : '';
}

function wikipediaWidget(w) {
  const body = formatBody(w.body || w.excerpt, 6);
  const img = w.image ? `<img src="${esc(w.image)}" alt="" loading="lazy">` : '';
  const infobox = w.infobox ? `<pre class="se-infobox">${esc(JSON.stringify(w.infobox, null, 2)).slice(0, 600)}</pre>` : '';
  const fullText = String(w.body || w.excerpt || '');
  return `<div class="widget se se-wikipedia"${wrapStyle(w.style)}>` +
    `<a class="se-card" href="${esc(w.url)}" target="_blank" rel="noopener">` +
    `<div class="se-head"><img class="se-logo" src="${esc(siteLogo('wikipedia'))}" alt="Wikipedia"><span class="se-site">Wikipedia</span>${copyButton(fullText)}</div>` +
    `<div class="se-title">${esc(w.title)}</div>` +
    (img ? `<div class="se-img">${img}</div>` : '') +
    `<div class="se-text">${body}</div>` +
    infobox +
    sourceFoot(w) +
    `</a>` +
    askButton(`What does Wikipedia say about ${w.title}?`, w.url) +
    `</div>`;
}

function siteEmbedWidget(w) {
  const logo = siteLogo(w.site);
  const body = formatBody(w.body || w.excerpt, 6);
  const fullText = String(w.body || w.excerpt || '');
  return `<div class="widget se se-${esc(w.site || 'site')}"${wrapStyle(w.style)}>` +
    `<a class="se-card" href="${esc(w.url)}" target="_blank" rel="noopener">` +
    `<div class="se-head">${logo ? `<img class="se-logo" src="${esc(logo)}" alt="${esc(w.site)}">` : `<span class="se-fallback">${esc((w.site || '').slice(0,2).toUpperCase())}</span>`}<span class="se-site">${esc(w.institution || w.site || 'Source')}</span>${copyButton(fullText)}</div>` +
    `<div class="se-title">${esc(w.title)}</div>` +
    `<div class="se-text">${body}</div>` +
    (w.date ? `<div class="se-date">${esc(w.date)}</div>` : '') +
    sourceFoot(w) +
    `</a>` +
    askButton(`What does ${w.institution || w.site || 'this source'} say about ${w.title}?`, w.url) +
    `</div>`;
}

function quoteWidget(w) {
  const hash = w.hash ? `<span class="wq-hash">#${esc(String(w.hash).slice(0, 12))}</span>` : '';
  return `<blockquote class="widget wq"${wrapStyle(w.style)}>${esc(w.text || '')}${w.cite ? `<cite>— ${esc(w.cite)}</cite>` : ''}${hash}</blockquote>`;
}

function noteWidget(w, renderMd) {
  const body = w.text || w.body || '';
  const rendered = renderMd ? renderMd(body) : esc(body);
  const hash = w.hash ? `<span class="wn-hash">#${esc(String(w.hash).slice(0, 12))}</span>` : '';
  return `<aside class="widget wn"${wrapStyle(w.style)}>${w.title ? `<div class="wn-t">${esc(w.title)}</div>` : ''}<div>${rendered}</div>${hash}</aside>`;
}

function statWidget(w) {
  const hash = w.hash ? `<span class="ws-hash">#${esc(String(w.hash).slice(0, 12))}</span>` : '';
  return `<div class="widget ws"${wrapStyle(w.style)}><div class="ws-n">${esc(String(w.value != null ? w.value : (w.number != null ? w.number : '')))}</div><div class="ws-l">${esc(w.label || '')}</div>${hash}</div>`;
}

function galleryWidget(w) {
  const images = (Array.isArray(w.images) ? w.images : []).map(im => {
    const url = typeof im === 'string' ? im : (im.url || '');
    const alt = typeof im === 'object' ? (im.alt || '') : '';
    const caption = typeof im === 'object' ? (im.caption || '') : '';
    return `<figure><img src="${esc(url)}" alt="${esc(alt)}" loading="lazy">${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
  }).join('');
  const hash = w.hash ? `<span class="wg-hash">#${esc(String(w.hash).slice(0, 12))}</span>` : '';
  return `<div class="widget wg"${wrapStyle(w.style)}>${images}${hash}</div>`;
}

function avatar(url, name) {
  if (url) return `<img class="sm-avatar" src="${esc(url)}" alt="${esc(name || '')}" loading="lazy">`;
  const initial = esc(String(name || '?').trim().slice(0, 1).toUpperCase());
  return `<span class="sm-avatar sm-fallback">${initial}</span>`;
}

function socialFoot(w) {
  const ts = w.timestamp || w.ts || '';
  const hash = esc(String(w.hash || '').slice(0, 12));
  const chips = [];
  if (ts) chips.push(`<span class="sm-ts">${esc(String(ts).slice(0, 19).replace('T', ' '))}</span>`);
  if (hash) chips.push(`<span class="sm-hash" title="${esc(w.hash || '')}">#${hash}</span>`);
  if (w.ledger_url || w.verify_url) chips.push(`<a class="sm-ledger" href="${esc(w.ledger_url || w.verify_url)}" target="_blank" rel="noopener">ledger ↗</a>`);
  return chips.length ? `<div class="sm-foot">${chips.join('')}</div>` : '';
}

function instagramWidget(w) {
  const p = w.profile || {};
  const media = (Array.isArray(w.media) ? w.media : []).slice(0, 4);
  const grid = media.length ? `<div class="sm-grid sm-grid-${Math.min(media.length, 4)}">${media.map(im => {
    const url = typeof im === 'string' ? im : (im.url || '');
    return `<img src="${esc(url)}" alt="" loading="lazy">`;
  }).join('')}</div>` : '';
  const metrics = [];
  if (w.likes != null) metrics.push(`<span class="sm-metric">${esc(String(w.likes))} likes</span>`);
  if (w.comments != null) metrics.push(`<span class="sm-metric">${esc(String(w.comments))} comments</span>`);
  return `<div class="widget sm sm-instagram"${wrapStyle(w.style)}>` +
    `<div class="sm-bar">${avatar(p.avatar, p.name)}<div class="sm-name"><b>${esc(p.name || 'Instagram')}</b>${p.verified ? '<span class="sm-verified">✓</span>' : ''}</div></div>` +
    `${grid}<div class="sm-caption">${esc(w.caption || '')}</div>` +
    (metrics.length ? `<div class="sm-metrics">${metrics.join('')}</div>` : '') +
    socialFoot(w) +
    `</div>`;
}

function xWidget(w) {
  const p = w.profile || {};
  const media = (Array.isArray(w.media) ? w.media : []).slice(0, 4);
  const grid = media.length ? `<div class="sm-grid sm-grid-${Math.min(media.length, 4)}">${media.map(im => {
    const url = typeof im === 'string' ? im : (im.url || '');
    return `<img src="${esc(url)}" alt="" loading="lazy">`;
  }).join('')}</div>` : '';
  const m = w.metrics || {};
  const metrics = [];
  if (m.replies != null) metrics.push(`<span class="sm-metric">↩ ${esc(String(m.replies))}</span>`);
  if (m.reposts != null) metrics.push(`<span class="sm-metric">↻ ${esc(String(m.reposts))}</span>`);
  if (m.likes != null) metrics.push(`<span class="sm-metric">♥ ${esc(String(m.likes))}</span>`);
  if (m.bookmarks != null) metrics.push(`<span class="sm-metric">🔖 ${esc(String(m.bookmarks))}</span>`);
  return `<div class="widget sm sm-x"${wrapStyle(w.style)}>` +
    `<div class="sm-bar">${avatar(p.avatar, p.name)}<div class="sm-name"><b>${esc(p.name || 'X')}</b><span class="sm-handle">@${esc(p.handle || '')}</span>${p.verified ? '<span class="sm-verified">✓</span>' : ''}</div></div>` +
    `<div class="sm-text">${esc(w.text || '')}</div>` +
    grid +
    (metrics.length ? `<div class="sm-metrics">${metrics.join('')}</div>` : '') +
    socialFoot(w) +
    `</div>`;
}

function tiktokWidget(w) {
  const p = w.profile || {};
  const v = w.video || {};
  const poster = v.poster ? `<div class="tt-video"><img src="${esc(v.poster)}" alt="" loading="lazy"><span class="tt-play">▶</span>${v.views != null ? `<span class="tt-views">${esc(String(v.views))} views</span>` : ''}</div>` : '';
  return `<div class="widget sm sm-tiktok"${wrapStyle(w.style)}>` +
    `<div class="sm-bar">${avatar(p.avatar, p.name)}<div class="sm-name"><b>${esc(p.name || 'TikTok')}</b><span class="sm-handle">@${esc(p.handle || '')}</span></div></div>` +
    `${poster}<div class="sm-caption">${esc(w.caption || '')}</div>` +
    (w.music ? `<div class="tt-music">♫ ${esc(w.music)}</div>` : '') +
    socialFoot(w) +
    `</div>`;
}

function llmAgentWidget(w) {
  const model = esc(w.model || w.agent || 'unknown');
  const hash = esc(String(w.hash || '').slice(0, 12));
  return `<div class="widget ag"${wrapStyle(w.style)}>` +
    `<div class="ag-bar"><span class="ag-badge ${esc(w.agent || 'unknown')}">${esc((w.agent || 'AI').toUpperCase())}</span><span class="ag-model">${model}</span>${hash ? `<a class="ag-hash" href="${esc(w.ledger_url || '#')}" target="_blank" rel="noopener">#${hash}</a>` : ''}</div>` +
    `<details class="ag-ins"><summary>inspect prompt &amp; response</summary>` +
    `<div class="ag-tenant">prompt</div><pre class="ag-pre">${esc(w.prompt || '')}</pre>` +
    `<div class="ag-tenant">response</div><pre class="ag-pre">${esc(w.response || '')}</pre>` +
    `</details>` +
    (Array.isArray(w.suggested_followups) && w.suggested_followups.length
      ? `<div class="ag-followups">${w.suggested_followups.map(f => `<button type="button" class="ag-follow" data-question="${esc(f)}" onclick="askWidget(this)">${esc(f)}</button>`).join('')}</div>`
      : '') +
    `</div>`;
}

function userEntryWidget(w) {
  const hash = esc(String(w.hash || '').slice(0, 12));
  return `<div class="widget ue-card"${wrapStyle(w.style)}>` +
    `<div class="uec-meta"><span class="uec-author">${esc(w.author || 'anonymous')}</span>${w.subject ? `<span class="uec-subject">on ${esc(w.subject)}</span>` : ''}${hash ? `<a class="uec-hash" href="${esc(w.ledger_url || '#')}" target="_blank" rel="noopener">#${hash}</a>` : ''}</div>` +
    `<div class="uec-text">${esc(w.text || '')}</div>` +
    (w.context ? `<div class="uec-ctx">${esc(w.context)}</div>` : '') +
    `</div>`;
}

function auditTrailWidget(w) {
  const entries = (Array.isArray(w.entries) ? w.entries : []);
  const head = esc(String(w.head || '').slice(0, 16));
  const rows = entries.map(e => {
    const h = esc(String(e.hash || '').slice(0, 12));
    return `<div class="at-row">` +
      `<span class="at-act">${esc(e.action || '')}</span>` +
      `<span class="at-model">${esc(e.model || '')}</span>` +
      `<span class="at-ts">${esc(String(e.ts || '').slice(0, 19).replace('T', ' '))}</span>` +
      `<a class="at-hash" href="${esc(w.verify_url || '#')}" target="_blank" rel="noopener">#${h}</a>` +
      `</div>`;
  }).join('');
  return `<div class="widget at"${wrapStyle(w.style)}>` +
    `<div class="at-bar">Audit trail · ${entries.length} entries${head ? ` · head <code>${head}</code>` : ''}${w.verify_url ? ` · <a href="${esc(w.verify_url)}" target="_blank" rel="noopener">verify ↗</a>` : ''}</div>` +
    `<div class="at-rows">${rows || '<div class="at-empty">No entries.</div>'}</div>` +
    `</div>`;
}

export function renderWidget(w, renderMd) {
  const t = String(w.type || '').toLowerCase();
  if (t === 'imessage' || t === 'imsg' || t === 'imessages') return imessageWidget(w);
  if (t === 'whatsapp' || t === 'wa') return whatsappWidget(w);
  if (t === 'wikipedia') return wikipediaWidget(w);
  if (t === 'site_embed') return siteEmbedWidget(w);
  if (t === 'quote') return quoteWidget(w);
  if (t === 'note' || t === 'callout') return noteWidget(w, renderMd);
  if (t === 'stat') return statWidget(w);
  if (t === 'gallery') return galleryWidget(w);
  if (t === 'instagram') return instagramWidget(w);
  if (t === 'x' || t === 'twitter') return xWidget(w);
  if (t === 'tiktok') return tiktokWidget(w);
  if (t === 'llm_agent') return llmAgentWidget(w);
  if (t === 'user_entry') return userEntryWidget(w);
  if (t === 'audit_trail') return auditTrailWidget(w);
  return w.text ? `<div class="widget"${wrapStyle(w.style)}>${esc(w.text)}</div>` : '';
}

export function renderWidgets(widgets, renderMd) {
  if (!Array.isArray(widgets) || !widgets.length) return '';
  return `<div class="widgets">${widgets.map(w => renderWidget(w, renderMd)).join('\n')}</div>`;
}

// Vault / ledger helpers (mirrors functions/_lib/vault_widgets.js)
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

// Example catalog used by the demo page.
export const EXAMPLES = [
  {
    type: 'imessage',
    title: 'iMessage thread',
    summary: 'Blue/grey message thread with optional typing indicator and suggested question.',
    payload: {
      type: 'imessage',
      id: 'Dr. Chen',
      subtitle: 'Peptide researcher',
      messages: [
        { from: 'them', text: 'The half-life is about 4 hours.' },
        { from: 'me', text: 'So dosing twice daily makes sense?' },
        { from: 'them', text: 'Yes — and it stays stable in gastric juice.' }
      ],
      typing_indicator: false,
      suggested_question: 'What about subcutaneous vs oral?'
    }
  },
  {
    type: 'whatsapp',
    title: 'WhatsApp thread',
    summary: 'Green-header thread with time stamps.',
    payload: {
      type: 'whatsapp',
      chat_name: 'Peptide group',
      messages: [
        { from: 'them', text: 'Have you seen the mouse study?', time: '09:14' },
        { from: 'me', text: 'Yes — 23% faster wound closure.', time: '09:15' },
        { from: 'them', text: 'Any human follow-up?', time: '09:16' }
      ]
    }
  },
  {
    type: 'wikipedia',
    title: 'Wikipedia excerpt',
    summary: 'Source card with logo, excerpt, image, infobox and ledger link.',
    payload: {
      type: 'wikipedia',
      title: 'BPC-157',
      url: 'https://en.wikipedia.org/wiki/BPC-157',
      excerpt: 'BPC-157 is a synthetic peptide derived from a protective protein found in human gastric juice.\n\nIt has been studied primarily in rodents for wound healing and gastrointestinal damage, although robust human clinical trials are lacking.',
      image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Bpc157.svg/440px-Bpc157.svg.png',
      infobox: { 'Molar mass': '1419.5 g/mol', 'IUPAC name': 'Gly-Glu-Pro-Pro-Pro-Gly-Lys...' },
      hash: 'a1b2c3d4',
      timestamp: '2026-06-21T14:32:00Z',
      ledger_url: '/api/ledger/widgets'
    }
  },
  {
    type: 'site_embed',
    title: 'Institution embed',
    summary: 'Generic source card for Harvard, Stanford, Mayo, NIH, PubMed, FDA, EMA, WHO, CDC.',
    payload: {
      type: 'site_embed',
      site: 'pubmed',
      institution: 'PubMed',
      title: 'Gastric pentadecapeptide BPC-157 as a treatment for mucosal injury',
      url: 'https://pubmed.ncbi.nlm.nih.gov/',
      excerpt: 'We investigated the effect of BPC-157 on various models of mucosal injury. The peptide significantly accelerated healing in rat models.',
      date: '2023-05-12',
      hash: 'e5f6a7b8',
      timestamp: '2026-06-21T14:33:00Z',
      ledger_url: '/api/ledger/widgets'
    }
  },
  {
    type: 'quote',
    title: 'Blockquote',
    summary: 'Styled pull quote with optional citation and hash.',
    payload: {
      type: 'quote',
      text: 'The dose makes the poison.',
      cite: 'Paracelsus',
      hash: 'c9d0e1f2'
    }
  },
  {
    type: 'note',
    title: 'Callout note',
    summary: 'Boxed aside with optional title and hash.',
    payload: {
      type: 'note',
      title: 'Caution',
      text: 'This section is mechanistic; no human outcome data is cited.',
      hash: '11223344'
    }
  },
  {
    type: 'stat',
    title: 'Statistic',
    summary: 'Big number + label, hash-stamped.',
    payload: {
      type: 'stat',
      value: 23,
      label: 'faster wound closure vs control',
      hash: '55667788'
    }
  },
  {
    type: 'gallery',
    title: 'Image gallery',
    summary: 'Two-column grid of images with captions.',
    payload: {
      type: 'gallery',
      hash: '99aabbcc',
      images: [
        { url: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400', alt: 'Slide 1', caption: 'Before' },
        { url: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400', alt: 'Slide 2', caption: 'After' }
      ]
    }
  },
  {
    type: 'instagram',
    title: 'Instagram post',
    summary: 'Profile header, media grid, caption, metrics, hash and ledger link.',
    payload: {
      type: 'instagram',
      profile: { name: 'biohacker.daily', avatar: 'https://i.pravatar.cc/150?u=insta', verified: true },
      media: [
        { url: 'https://images.unsplash.com/photo-1584362917165-526a968579e8?w=400' },
        { url: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400' }
      ],
      caption: 'Day 14 of BPC-157 — skin texture is noticeably smoother. #peptides #n=1',
      likes: 1247,
      comments: 89,
      hash: 'ddeeff00',
      timestamp: '2026-06-20T09:15:00Z',
      ledger_url: '/api/ledger/widgets'
    }
  },
  {
    type: 'x',
    title: 'X post',
    summary: 'Tweet-style card with metrics and inspectable hash.',
    payload: {
      type: 'x',
      profile: { name: 'Dr. Glucose', handle: 'drglucose', avatar: 'https://i.pravatar.cc/150?u=x', verified: true },
      text: 'Metformin + BPC-157 showed synergistic wound healing in the latest preprint. Cautiously optimistic — still rodent data.',
      metrics: { replies: 34, reposts: 156, likes: 892, bookmarks: 41 },
      hash: 'aabbccdd',
      timestamp: '2026-06-19T16:42:00Z',
      ledger_url: '/api/ledger/widgets'
    }
  },
  {
    type: 'tiktok',
    title: 'TikTok clip',
    summary: 'Short-form video card with poster, caption, music and ledger link.',
    payload: {
      type: 'tiktok',
      profile: { name: 'PeptideTok', handle: 'peptidetok', avatar: 'https://i.pravatar.cc/150?u=tt' },
      video: { poster: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400', views: '1.2M' },
      caption: 'What nobody tells you about oral BPC-157 dosing.',
      music: 'original sound - PeptideTok',
      hash: '1122aabb',
      timestamp: '2026-06-18T21:05:00Z',
      ledger_url: '/api/ledger/widgets'
    }
  },
  {
    type: 'llm_agent',
    title: 'LLM agent contribution',
    summary: 'Inspectable model card: prompt, response, model, hash, ledger link.',
    payload: {
      type: 'llm_agent',
      agent: 'kimi',
      model: 'kimi-k2-0711',
      prompt: 'Summarize the mechanism of BPC-157 in 2 sentences.',
      response: 'BPC-157 is thought to promote angiogenesis and modulate nitric oxide signalling, which may accelerate tendon and gut healing. Human trials remain limited.',
      hash: 'feedface',
      ledger_url: '/api/ledger/widgets',
      suggested_followups: ['Show me the source', 'What are the risks?', 'Compare to TB-500']
    }
  },
  {
    type: 'user_entry',
    title: 'User entry',
    summary: 'Reader-submitted experience or correction, hash-linked to the ledger.',
    payload: {
      type: 'user_entry',
      subject: 'bpc-157',
      author: 'recovery_runner',
      text: 'I ran a 6-week oral cycle. Achilles tendinopathy improved from 7/10 to 2/10 pain. No side effects.',
      context: 'article:bpc-157',
      hash: 'cafebabe',
      ledger_url: '/api/ledger/widgets'
    }
  },
  {
    type: 'audit_trail',
    title: 'Audit trail',
    summary: 'Hash-chained action log with verify link.',
    payload: {
      type: 'audit_trail',
      head: 'deadbeef12345678',
      verify_url: '/api/ledger/widgets',
      entries: [
        { action: 'write', model: 'kimi-k2', ts: '2026-06-21T12:00:00Z', hash: 'aaa111bbb222' },
        { action: 'review', model: 'grok-3', ts: '2026-06-21T12:30:00Z', hash: 'ccc333ddd444' },
        { action: 'publish', model: 'gemini-2.5', ts: '2026-06-21T13:00:00Z', hash: 'eee555fff666' }
      ]
    }
  }
];

export const VAULT_EXAMPLES = [
  { kind: 'task', title: 'Refresh PubMed citations', body: 'Re-fetch DOIs and quote status for all BPC-157 sources.', status: 'open', ts: '2026-06-21T14:00:00Z', href: '/admin/tasks', hash: 'taskhash01' },
  { kind: 'event', title: 'Model run completed', body: 'kimi-k2 finished the accessible register pass.', status: 'done', ts: '2026-06-21T13:45:00Z', href: '/admin/ledger', hash: 'eventhash02' },
  { kind: 'card', title: 'BPC-157 safety note', body: 'No human RCTs cited; downgrade clinical claims.', status: 'review', ts: '2026-06-21T12:20:00Z', href: '/admin/ledger', hash: 'cardhash03' },
  { kind: 'claim', title: '23% faster wound closure', body: 'Mouse excisional wound model, n=20.', status: 'verified', ts: '2026-06-21T11:10:00Z', href: '/admin/ledger', hash: 'claimhash04' },
  { kind: 'protected', title: 'Widget renderer lock', body: 'Owner-locked feature; changes require approval token.', status: 'locked', ts: '2026-06-21T10:00:00Z', href: '/admin/vault', hash: 'protecth05' },
  { kind: 'idea', title: 'Add Reddit comment widget', body: 'Render r/Peptides top comments as evidence cards.', status: 'backlog', ts: '2026-06-21T09:30:00Z', href: '/admin/ledger', hash: 'ideahash06' }
];
