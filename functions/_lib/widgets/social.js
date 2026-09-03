// Social-platform widget renderers.
// Each card is linkable, timestamped, and hash-stamped so it can be cited from the ledger.

import { brandBar, platformLogoStyles } from './platform_logos.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function fmtTs(ts) {
  if (!ts) return '';
  const t = String(ts);
  return t.length > 16 ? t.slice(0, 16).replace('T', ' ') : t;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function socFoot(w) {
  const ts = fmtTs(w.ts || w.timestamp || w.date || w.posted_at);
  const hash = esc(String(w.hash || '').slice(0, 16));
  const ledger = w.ledger_url || w.ledger_href;
  const hashLine = hash
    ? `<span class="soc-hash">${hash}</span>${ledger ? ` · <a class="soc-ledger" href="${esc(ledger)}">ledger</a>` : ''}`
    : '';
  return `<div class="soc-foot">${ts ? `<span class="soc-ts">${ts}</span>` : ''}${hashLine}</div>`;
}

function statBar(stats) {
  if (!stats || typeof stats !== 'object') return '';
  const parts = [];
  if (stats.replies != null) parts.push(`<span>${esc(String(stats.replies))} replies</span>`);
  if (stats.retweets != null) parts.push(`<span>${esc(String(stats.retweets))} reposts</span>`);
  if (stats.likes != null) parts.push(`<span>${esc(String(stats.likes))} likes</span>`);
  if (stats.views != null) parts.push(`<span>${esc(String(stats.views))} views</span>`);
  if (stats.shares != null) parts.push(`<span>${esc(String(stats.shares))} shares</span>`);
  if (stats.upvotes != null) parts.push(`<span>▲ ${esc(String(stats.upvotes))}</span>`);
  if (stats.comments != null) parts.push(`<span>${esc(String(stats.comments))} comments</span>`);
  if (stats.reactions != null) parts.push(`<span>${esc(String(stats.reactions))} reactions</span>`);
  return parts.length ? `<div class="soc-stats">${parts.join('')}</div>` : '';
}

function xWidget(w) {
  const handle = esc(w.handle || w.author_handle || '@user');
  const text = esc(w.text || w.body || w.content || '');
  const host = hostOf(w.url);
  const author = esc(w.author || 'X User');
  return `<a class="widget soc soc-x" href="${esc(w.url)}" target="_blank" rel="noopener noreferrer">` +
    brandBar('x', handle) +
    `<div class="soc-author">${author}${w.verified ? ' <span class="soc-verified" aria-label="verified">✓</span>' : ''}</div>` +
    `<div class="soc-text">${text}</div>` +
    statBar(w.stats) +
    (host ? `<div class="soc-host">↗ ${esc(host)}</div>` : '') +
    socFoot(w) +
    `</a>`;
}

function instagramWidget(w) {
  const images = (Array.isArray(w.images) ? w.images : (w.image ? [w.image] : [])).map(u => `<img src="${esc(u)}" alt="" loading="lazy">`).join('');
  const caption = esc(w.caption || w.text || w.body || '');
  const host = hostOf(w.url);
  const handle = esc(w.handle || '@instagram');
  return `<a class="widget soc soc-insta" href="${esc(w.url)}" target="_blank" rel="noopener noreferrer">` +
    brandBar('instagram', handle) +
    (w.location ? `<div class="soc-location">📍 ${esc(w.location)}</div>` : '') +
    (images ? `<div class="soc-media soc-gallery">${images}</div>` : '') +
    (caption ? `<div class="soc-text">${caption}</div>` : '') +
    statBar(w.stats) +
    (host ? `<div class="soc-host">↗ ${esc(host)}</div>` : '') +
    socFoot(w) +
    `</a>`;
}

function tiktokWidget(w) {
  const thumb = w.thumbnail ? `<div class="soc-media"><img src="${esc(w.thumbnail)}" alt="" loading="lazy"><span class="soc-play">▶</span>${w.duration ? `<span class="soc-duration">${esc(w.duration)}</span>` : ''}</div>` : '';
  const text = esc(w.text || w.body || w.description || '');
  const host = hostOf(w.url);
  const handle = esc(w.handle || '@tiktok');
  return `<a class="widget soc soc-tiktok" href="${esc(w.url)}" target="_blank" rel="noopener noreferrer">` +
    brandBar('tiktok', handle) +
    (w.sound ? `<div class="soc-sound">🎵 ${esc(w.sound)}</div>` : '') +
    (thumb || `<div class="soc-text">${text}</div>`) +
    (thumb && text ? `<div class="soc-text">${text}</div>` : '') +
    statBar(w.stats) +
    (host ? `<div class="soc-host">↗ ${esc(host)}</div>` : '') +
    socFoot(w) +
    `</a>`;
}

function facebookWidget(w) {
  const text = esc(w.text || w.body || w.content || '');
  const host = hostOf(w.url);
  const page = esc(w.handle || w.page || 'Page');
  return `<a class="widget soc soc-fb" href="${esc(w.url)}" target="_blank" rel="noopener noreferrer">` +
    brandBar('facebook', page) +
    `<div class="soc-text">${text}</div>` +
    statBar(w.stats) +
    (host ? `<div class="soc-host">↗ ${esc(host)}</div>` : '') +
    socFoot(w) +
    `</a>`;
}

function linkedinWidget(w) {
  const text = esc(w.text || w.body || w.content || '');
  const host = hostOf(w.url);
  const meta = [w.author_title, w.company].filter(Boolean).join(' · ');
  return `<a class="widget soc soc-li" href="${esc(w.url)}" target="_blank" rel="noopener noreferrer">` +
    brandBar('linkedin', meta || esc(w.author || 'Professional post')) +
    `<div class="soc-text">${text}</div>` +
    statBar(w.stats) +
    (host ? `<div class="soc-host">↗ ${esc(host)}</div>` : '') +
    socFoot(w) +
    `</a>`;
}

function redditWidget(w) {
  const sub = esc(w.subreddit || 'r/unknown');
  const title = esc(w.title || '');
  const body = esc(w.text || w.body || w.content || '');
  const host = hostOf(w.url);
  const author = esc(w.author || 'u/redditor');
  return `<a class="widget soc soc-reddit" href="${esc(w.url)}" target="_blank" rel="noopener noreferrer">` +
    brandBar('reddit', sub) +
    `<div class="soc-author">${author}</div>` +
    (title ? `<div class="soc-title">${title}</div>` : '') +
    (body ? `<div class="soc-text">${body}</div>` : '') +
    statBar(w.stats) +
    (host ? `<div class="soc-host">↗ ${esc(host)}</div>` : '') +
    socFoot(w) +
    `</a>`;
}

function youtubeWidget(w) {
  const thumb = w.thumbnail ? `<div class="soc-media"><img src="${esc(w.thumbnail)}" alt="" loading="lazy"><span class="soc-play">▶</span>${w.duration ? `<span class="soc-duration">${esc(w.duration)}</span>` : ''}</div>` : '';
  const title = esc(w.title || '');
  const text = esc(w.description || w.text || w.body || '');
  const host = hostOf(w.url);
  const channel = esc(w.channel || w.author || 'YouTube');
  return `<a class="widget soc soc-yt" href="${esc(w.url)}" target="_blank" rel="noopener noreferrer">` +
    brandBar('youtube', channel) +
    (title ? `<div class="soc-title">${title}</div>` : '') +
    thumb +
    (text ? `<div class="soc-text">${text}</div>` : '') +
    statBar(w.stats) +
    (host ? `<div class="soc-host">↗ ${esc(host)}</div>` : '') +
    socFoot(w) +
    `</a>`;
}

export function renderSocialWidget(w) {
  const t = String(w.type || '').toLowerCase();
  if (t === 'x' || t === 'twitter') return xWidget(w);
  if (t === 'instagram' || t === 'insta') return instagramWidget(w);
  if (t === 'tiktok' || t === 'tt') return tiktokWidget(w);
  if (t === 'facebook' || t === 'fb') return facebookWidget(w);
  if (t === 'linkedin' || t === 'li') return linkedinWidget(w);
  if (t === 'reddit') return redditWidget(w);
  if (t === 'youtube' || t === 'yt') return youtubeWidget(w);
  return '';
}

export function socialStyles() {
  return platformLogoStyles() + `
.soc{display:block;text-decoration:none;color:inherit;border:1px solid var(--line);border-radius:18px;background:#fff;padding:16px 18px 18px;transition:border-color .2s,transform .2s,box-shadow .2s;position:relative;overflow:hidden;box-shadow:0 4px 22px rgba(0,0,0,.06),0 1px 3px rgba(0,0,0,.04)}
.soc:hover{border-color:var(--soc);transform:translateY(-2px);box-shadow:0 12px 32px rgba(0,0,0,.1),0 2px 6px rgba(0,0,0,.05)}
.soc::after{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--soc);opacity:.85}
.soc-x{--soc:#1d9bf0}.soc-insta{--soc:#e1306c}.soc-tiktok{--soc:#fe2c55}.soc-fb{--soc:#0866ff}.soc-li{--soc:#0a66c2}.soc-reddit{--soc:#ff4500}.soc-yt{--soc:#ff0000}
.soc-author{font:600 13px/1.3 ui-sans-serif,system-ui,sans-serif;color:#595959;margin:-4px 0 10px}
.soc-verified{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#177abe;color:#ffffff;font-size:10px;margin-left:4px}
.soc-title{font:800 19px/1.25 ui-sans-serif,system-ui,sans-serif;color:#0a0a0a;margin:0 0 10px;letter-spacing:-0.01em}
.soc-text{font:16px/1.55 ui-sans-serif,system-ui,sans-serif;color:#2a2a2a;white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}
.soc-media{position:relative;margin:10px 0 12px;border-radius:12px;overflow:hidden;background:#000}
.soc-media img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}
.soc-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px}
.soc-gallery img{aspect-ratio:1/1}
.soc-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:48px;height:48px;border-radius:50%;background:rgba(0,0,0,.75);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;padding-left:4px}
.soc-duration{position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.75);color:#fff;font:700 11px/1 ui-sans-serif,system-ui,sans-serif;padding:3px 6px;border-radius:4px}
.soc-location,.soc-sound{font:500 13px/1.3 ui-sans-serif,system-ui,sans-serif;color:#737373;margin:-2px 0 8px}
.soc-stats{display:flex;flex-wrap:wrap;gap:12px;margin:10px 0;font:600 13px/1 ui-sans-serif,system-ui,sans-serif;color:#737373}
.soc-host{font:12px/1.4 ui-monospace,monospace;color:var(--soc);margin:8px 0 4px}
.soc-foot{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:12px;padding-top:10px;border-top:1px dashed var(--line);font:11px/1.4 ui-monospace,monospace;color:#767676}
.soc-hash{font-family:inherit;color:var(--soc)}
.soc-ledger{color:var(--soc);text-decoration:underline}
.soc-ledger:hover{text-decoration:none}
`;
}