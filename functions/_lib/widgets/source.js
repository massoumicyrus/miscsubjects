// Source-widget renderer for article source-ledger entries.
// Handles the evidence types emitted by the protocol pipeline:
// pubmed, clinical_trial, review, medical, reddit, x, instagram,
// youtube, news, business, anecdotal, other.

import { brandBar, platformLogoStyles } from './platform_logos.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

const SOURCE_TYPES = {
  pubmed:         { label: 'PubMed',          cls: 'study',  color: '#2b6cb0' },
  clinical_trial: { label: 'Clinical Trial',  cls: 'study',  color: '#0f766e' },
  review:         { label: 'Review',          cls: 'study',  color: '#20558a' },
  medical:        { label: 'Medical',         cls: 'study',  color: '#1d4ed8' },
  reddit:         { label: 'Reddit',          cls: 'reddit', color: '#ff4500' },
  x:              { label: 'X',               cls: 'x',      color: '#1d9bf0' },
  instagram:      { label: 'Instagram',       cls: 'insta',  color: '#e1306c' },
  youtube:        { label: 'YouTube',         cls: 'yt',     color: '#ff0000' },
  news:           { label: 'News',            cls: 'news',   color: '#5b6470' },
  business:       { label: 'Business',        cls: 'biz',    color: '#d32323' },
  anecdotal:      { label: 'Anecdote',        cls: 'anec',   color: '#8a6d3b' },
  internal:       { label: 'Internal cross-reference', cls: 'internal', color: '#5b6470' },
  other:          { label: 'Source',          cls: 'other',  color: '#0a0a0a' },
};

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function formatTs(ts) {
  const s = String(ts || '');
  if (!s) return '';
  return s.slice(0, 16).replace('T', ' ');
}

function statusBadges(w) {
  const link = String(w.link_status || '').toLowerCase();
  const quote = String(w.quote_status || '').toLowerCase();
  const dead = /^(dead|timeout|invalid|http_)/.test(link);
  if (dead) return '<span class="ev-b ev-dead">link unverified</span>';
  if (quote === 'verified' || (link === 'ok' && quote !== 'unverified')) return '<span class="ev-b ev-ok">verified</span>';
  if (quote === 'unverified') return '<span class="ev-b ev-warn">quote unverified</span>';
  if (link === 'unchecked') return '<span class="ev-b ev-unk">unchecked</span>';
  return '';
}

export function sourceWidget(w) {
  const url = w.url || w.href || w.link || '';
  const host = hostOf(url);
  // A link to the site itself is an internal cross-reference, not a PubMed/NIH study.
  // Force the internal type so it never renders a PubMed label or NIH logo.
  const isInternal = /(^|\.)miscsubjects\.com$/.test(host) || /^\/(?!\/)/.test(String(url));
  const typeKey = isInternal
    ? 'internal'
    : String(w.source_type || w.type || 'other').toLowerCase();
  const e = SOURCE_TYPES[typeKey] || SOURCE_TYPES.other;

  const title = w.title || w.article_title || url || '(untitled)';
  const profile = [w.author, w.publisher, w.date].filter(Boolean).map(x => String(x)).join(' · ');
  const ts = formatTs(w.accessed_at || w.ts || w.created_at || w.updated_at || '');
  const hash = String(w.hash || '').slice(0, 16);
  const id = String(w.id || w.source_id || '').slice(0, 24);

  const ledgerUrl = w.ledger_url || (w.slug ? `/api/articles/${w.slug}/sources` : '');

  const sublabel = host || e.label;
  const head =
    `<div class="ev-head">` +
    brandBar(typeKey, sublabel, { fromUrl: url, label: host ? undefined : e.label }) +
    `<div class="ev-badges">${statusBadges(w)}</div>` +
    `</div>`;

  const body =
    (w.quote ? `<div class="ev-quote">${esc(w.quote)}</div>` : '') +
    (w.summary ? `<div class="ev-sum">${esc(w.summary)}</div>` : '');

  const foot =
    `<div class="ev-foot">` +
    `<span class="ev-id">ledger #${esc(id)}</span>` +
    (ts ? `<span class="ev-time">${esc(ts)}</span>` : '') +
    `<span class="ev-hash">${esc(hash)}</span>` +
    `</div>`;

  const cardInner =
    head +
    `<div class="ev-title">${esc(title)}</div>` +
    (profile ? `<div class="ev-prof">${esc(profile)}</div>` : '') +
    body +
    (host ? `<div class="ev-link">↗ ${esc(host)}</div>` : '') +
    foot;

  const card = url
    ? `<a class="evcard ev-${esc(e.cls)}" href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="--ev:${esc(e.color)}">${cardInner}</a>`
    : `<div class="evcard ev-${esc(e.cls)}" style="--ev:${esc(e.color)}">${cardInner}</div>`;

  const ledgerLink = ledgerUrl
    ? `<a class="sw-ledger" href="${esc(ledgerUrl)}" style="display:block;margin-top:8px;font:11px/1.5 ui-monospace,monospace;color:${esc(e.color)};text-decoration:none;">view source ledger →</a>`
    : '';

  return `<div class="widget ev ev-${esc(e.cls)}"${wrapStyle(w.style)}>${card}${ledgerLink}</div>`;
}

export function sourceStyles() {
  return platformLogoStyles() + `
.ev{--ev:#0a0a0a;margin:30px 0}
.evcard{display:block;border:1px solid var(--line);border-radius:18px;background:var(--surface);padding:16px 18px 18px;text-decoration:none;color:inherit;transition:border-color .2s,transform .2s,box-shadow .2s;position:relative;overflow:hidden;box-shadow:0 4px 22px rgba(0,0,0,.06),0 1px 3px rgba(0,0,0,.04)}
.evcard:hover{border-color:var(--ev);transform:translateY(-2px);box-shadow:0 12px 32px rgba(0,0,0,.1),0 2px 6px rgba(0,0,0,.05)}
.evcard::after{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--ev);opacity:.85}
.ev-head{position:relative;margin-bottom:12px}
.ev-badges{position:absolute;top:10px;right:10px;display:flex;gap:6px;z-index:2}
.ev-b{display:inline-block;font:700 9px/1.5 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.04em;text-transform:uppercase;border-radius:99px;padding:3px 8px;backdrop-filter:blur(6px)}
.ev-ok{background:rgba(220,252,231,.95);color:#166534}
.ev-warn{background:rgba(255,248,230,.95);color:#8a6d3b}
.ev-dead{background:rgba(255,234,234,.95);color:#b5453b}
.ev-unk{background:rgba(243,244,246,.95);color:#4b5563}
.ev-title{font:800 20px/1.25 ui-sans-serif,system-ui,sans-serif;color:#111111;margin-bottom:6px;letter-spacing:-0.01em}
.ev-prof{font:12px/1.4 ui-sans-serif,system-ui,sans-serif;color:#5b6470;margin-bottom:10px}
.ev-quote{font:15px/1.55 var(--font);color:#111111;padding:12px 14px;border-left:3px solid var(--ev);margin:10px 0;background:rgba(0,0,0,.02);border-radius:0 10px 10px 0}
.ev-sum{font:14px/1.6 ui-sans-serif,system-ui,sans-serif;color:#3f4750;margin:8px 0}
.ev-link{font:12px ui-monospace,monospace;color:var(--ev);margin:8px 0 4px}
.ev-foot{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:12px;padding-top:10px;border-top:1px dashed var(--line);font:11px/1.4 ui-monospace,monospace;color:#5b6470}
.ev-id,.ev-time,.ev-hash{font-family:inherit}
.sw-ledger{display:block;margin-top:8px;font:11px/1.5 ui-monospace,monospace;color:var(--ev);text-decoration:none}
.sw-ledger:hover{text-decoration:underline}
`;
}