// Shared widget renderer. The debate/graph engine emits pure JSON descriptors;
// this module turns them into HTML. No business logic lives here.

import { renderSocialWidget } from './widgets/social.js';
import { llmAgentWidget, auditTrailWidget, userEntryWidget } from './widgets/llm.js';
import { sourceWidget } from './widgets/source.js';
import { leaderboardWidget } from './widgets/leaderboard.js';
import { sheetWidget } from './widgets/sheet.js';

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
  // SVGs scale cleanly so the logo can be displayed larger without blurring.
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
    `</a>` +
    askButton(`What does Wikipedia say about ${w.title}?`, w.url) +
    `</div>`;
}

function graphMapWidget(w) {
  const slug = String(w.slug || '').toLowerCase();
  if (!slug) return '';
  const mode = w.mode ? `&mode=${encodeURIComponent(w.mode)}` : '';
  const focus = w.focus ? `&focus=${encodeURIComponent(w.focus)}` : '';
  const embedUrl = `/graph?embed=1&theme=light&slug=${encodeURIComponent(slug)}${mode}${focus}`;
  const fullUrl = `/graph?slug=${encodeURIComponent(slug)}${mode}`;
  return (
    `<section class="graph-map-widget" aria-label="Evidence map explorer">` +
    `<div class="gmw-head">` +
    `<h2>Evidence map</h2>` +
    `<span>Peptides · conditions · drugs · tiers</span>` +
    `<a href="${esc(fullUrl)}" target="_blank" rel="noopener">Open full map →</a>` +
    `</div>` +
    `<iframe class="gmw-frame" src="${esc(embedUrl)}" title="Evidence map for ${esc(slug)}" loading="lazy"></iframe>` +
    `</section>`
  );
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
    `</a>` +
    askButton(`What does ${w.institution || w.site || 'this source'} say about ${w.title}?`, w.url) +
    `</div>`;
}

function quoteWidget(w) {
  return `<blockquote class="widget wq"${wrapStyle(w.style)}>${esc(w.text || '')}${w.cite ? `<cite>— ${esc(w.cite)}</cite>` : ''}</blockquote>`;
}
function noteWidget(w, renderMd) {
  const body = w.text || w.body || '';
  const rendered = renderMd ? renderMd(body) : esc(body);
  return `<aside class="widget wn"${wrapStyle(w.style)}>${w.title ? `<div class="wn-t">${esc(w.title)}</div>` : ''}<div>${rendered}</div></aside>`;
}
function statWidget(w) {
  return `<div class="widget ws"${wrapStyle(w.style)}><div class="ws-n">${esc(String(w.value != null ? w.value : (w.number != null ? w.number : '')))}</div><div class="ws-l">${esc(w.label || '')}</div></div>`;
}
function galleryWidget(w) {
  const images = (Array.isArray(w.images) ? w.images : []).map(im => {
    const url = typeof im === 'string' ? im : (im.url || '');
    const alt = typeof im === 'object' ? (im.alt || '') : '';
    const caption = typeof im === 'object' ? (im.caption || '') : '';
    return `<figure><img src="${esc(url)}" alt="${esc(alt)}" loading="lazy">${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
  }).join('');
  return `<div class="widget wg"${wrapStyle(w.style)}>${images}</div>`;
}

export function renderWidget(w, renderMd) {
  const t = String(w.type || '').toLowerCase();
  if (t === 'imessage' || t === 'imsg' || t === 'imessages') return imessageWidget(w);
  if (t === 'whatsapp' || t === 'wa') return whatsappWidget(w);
  if (t === 'wikipedia') return wikipediaWidget(w);
  if (t === 'site_embed') return siteEmbedWidget(w);
  if (t === 'graph_map' || t === 'graph' || t === 'evidence_map') return graphMapWidget(w);
  if (t === 'quote') return quoteWidget(w);
  if (t === 'note' || t === 'callout') return noteWidget(w, renderMd);
  if (t === 'stat') return statWidget(w);
  if (t === 'gallery') return galleryWidget(w);
  if (t === 'llm_agent') return llmAgentWidget(w);
  if (t === 'audit_trail') return auditTrailWidget(w);
  if (t === 'user_entry') return userEntryWidget(w);
  if (t === 'source') return sourceWidget(w);
  if (t === 'leaderboard' || t === 'standings' || t === 'ranking') return leaderboardWidget(w);
  if (t === 'sheet' || t === 'grid' || t === 'range') return sheetWidget(w);
  const social = renderSocialWidget(w);
  if (social) return social;
  return w.text ? `<div class="widget"${wrapStyle(w.style)}>${esc(w.text)}</div>` : '';
}

export function renderWidgets(widgets, renderMd) {
  if (!Array.isArray(widgets) || !widgets.length) return '';
  return `<div class="widgets">${widgets.map(w => renderWidget(w, renderMd)).join('\n')}</div>`;
}
