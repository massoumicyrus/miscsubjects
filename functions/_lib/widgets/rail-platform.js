// Platform-native evidence widgets for the article source ledger.
// THE MIMICRY LAW: an embedded source wears ITS OWN platform's identity — a tweet looks
// exactly like a tweet, Reddit exactly like Reddit, WSJ exactly like WSJ. These cards
// deliberately hardcode their platform's real colors/faces and DO NOT read the site
// profile: quotation is the one sanctioned exemption from the token law, because the
// mimicry is the meaning. Everything AROUND the card (deck, rail, footer strip) stays
// on site tokens. CSS ships from platformRailCss() below — one file owns both.
// Rendered inside the protected article source ledger. Keep HTML-escaped and minimal.

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function ts(s) {
  if (!s) return '';
  const t = String(s).slice(0, 16).replace('T', ' ');
  return `<span class="rp-time">${esc(t)}</span>`;
}
function ledgerEntry(s, slug) {
  const h = String(s.hash || '').slice(0, 12);
  const id = s.id ? esc(s.id) + ' · ' : '';
  if (!h) return '';
  const label = `${id}#${esc(h)}`;
  return slug
    ? `<a class="rp-hash" href="/api/articles/${esc(slug)}/sources" title="view in hash-chained source ledger">${label}</a>`
    : `<span class="rp-hash" title="${esc(s.hash)}">${label}</span>`;
}
function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
function initial(name) {
  return esc(String(name || '?').trim().slice(0, 1).toUpperCase());
}
function fmtNumber(n) {
  const num = Number(n);
  if (!num) return '';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(num);
}
function badge(s) {
  if (s.tier) return `<span class="rp-tier tier-${esc(String(s.tier).toLowerCase())}">${esc(s.tier)}</span>`;
  return '';
}
function foot(s, slug) {
  return `<div class="rp-foot"><span>${badge(s)}${ts(s.accessed_at)}</span><span>${ledgerEntry(s, slug)}</span></div>`;
}
// Deterministic small hash for stable per-source choices (avatar hue, book cover, A/B widgets).
function seed(str) {
  let h = 5381;
  const t = String(str || '');
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0;
  return h;
}
const AV_HUES = ['#1d9bf0', '#794bc4', '#f91880', '#ff7a00', '#00ba7c', '#3f51b5', '#e0245e', '#17bf63'];
function avColor(name) {
  return AV_HUES[seed(name) % AV_HUES.length];
}
function favicon(url, size = 64) {
  const h = host(url);
  return h ? `https://www.google.com/s2/favicons?domain=${esc(h)}&sz=${size}` : '';
}
function dateShort(s) {
  const d = String(s.accessed_at || s.ts || s.date || '').slice(0, 10);
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m) - 1] || '';
  return M ? `${M} ${Number(dd)}, ${y}` : d;
}

// ───────────────────────────── X (Twitter) — embedded-tweet fidelity ─────────────────────────────
const X_LOGO = '<svg viewBox="0 0 24 24" aria-label="X" width="22" height="22"><path fill="#0f1419" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
const X_VERIFIED = '<svg viewBox="0 0 22 22" width="17" height="17" aria-label="verified" style="vertical-align:-3px"><path fill="#1d9bf0" d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/></svg>';
const X_ACT = {
  reply: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13z"/></svg>',
  repost: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>',
  like: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/></svg>',
  share: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"/></svg>',
};
function xHandleFromUrl(url) {
  const m = String(url || '').match(/(?:twitter|x)\.com\/([^/]+)\/status/i);
  return m ? '@' + m[1] : '';
}
function xWidget(s, slug) {
  const meta = socialMeta(s, 'x');
  const rawAuthor = String(s.author || s.publisher || '').trim().replace(/\s*\(@[^)]+\)\s*$/, '');
  const urlHandle = xHandleFromUrl(s.url);
  const handleFromAuthor = (String(s.author || '').match(/\(@([^)]+)\)/) || [])[1];
  const handle = esc(s.handle || meta.handle || (handleFromAuthor ? '@' + handleFromAuthor : '') || urlHandle || '@user');
  const displayName = esc(rawAuthor && rawAuthor !== 'X' && rawAuthor !== 'Source' ? rawAuthor : ((meta.handle || urlHandle) ? String(meta.handle || urlHandle).replace('@', '') : 'X User'));
  // The quote is the post. A synthesised descriptor never stands in for it.
  const body = esc(s.quote || s.summary || (meta.title !== undefined ? meta.title : s.title) || '');
  // The post's own date, not the date we fetched it. An accessed-at stamp on a social card reads
  // as if the person posted today.
  const when = esc(meta.when || '') || dateShort(s);
  const st = s.stats || {};
  const act = (icon, n) =>
    `<span class="rp-x-act">${icon}${n ? `<b>${fmtNumber(n)}</b>` : ''}</span>`;
  return `<article class="rp-card rp-x" data-platform="x">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-x-brand">${X_LOGO}</div>` +
    `<div class="rp-x-hdr"><div class="rp-x-av" style="background:${avColor(displayName)}">${initial(displayName)}</div>` +
    `<div class="rp-x-who"><span class="rp-x-name">${displayName} ${X_VERIFIED}</span>` +
    `<span class="rp-x-handle">${handle}</span></div></div>` +
    `<div class="rp-x-text">${body}</div>` +
    gloss(s) +
    (when ? `<div class="rp-x-when">${esc(when)}</div>` : '') +
    `<div class="rp-x-actions">${act(X_ACT.reply, st.replies)}${act(X_ACT.repost, st.reposts || st.retweets)}${act(X_ACT.like, st.likes)}${act(X_ACT.share)}</div>` +
    `</a>` +
    foot(s, slug) +
    `</article>`;
}

// ───────────────────────────── Instagram ─────────────────────────────
function instagramWidget(s, slug) {
  const author = esc(s.author || s.publisher || 'account');
  const caption = esc(s.quote || s.summary || s.title || '');
  const likes = fmtNumber(s.stats?.likes);
  return `<article class="rp-card rp-ig" data-platform="instagram">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-igtop"><div class="rp-igring"><div>${initial(author)}</div></div>` +
    `<div class="rp-iguser">${author}</div><div class="rp-igdots">···</div></div>` +
    `<div class="rp-igmedia" style="--ig-a:${avColor(author)}"><div class="rp-igplay"></div></div>` +
    `<div class="rp-igacts"><span>♥</span><span>💬</span><span>➤</span><span class="rp-igsave">⌕</span></div>` +
    (likes ? `<div class="rp-iglikes">${likes} likes</div>` : '') +
    (caption ? `<div class="rp-igcap"><b>${author}</b> ${caption}</div>` : '') +
    `</a>` +
    gloss(s) +
    foot(s, slug) +
    `</article>`;
}

// ───────────────────────────── Reddit ─────────────────────────────
const RD_LOGO = '<svg viewBox="0 0 24 24" width="24" height="24" aria-label="Reddit"><circle cx="12" cy="12" r="12" fill="#ff4500"/><path fill="#fff" d="M19.2 12.06c0-.87-.71-1.58-1.58-1.58-.42 0-.8.17-1.08.43-1.06-.72-2.5-1.18-4.09-1.24l.82-2.6 2.28.54a1.16 1.16 0 1 0 .12-.55l-2.55-.6a.29.29 0 0 0-.34.19l-.94 2.99c-1.66.03-3.16.5-4.26 1.25a1.58 1.58 0 1 0-1.83 2.55c-.03.17-.05.35-.05.53 0 2.4 2.65 4.35 5.92 4.35s5.92-1.95 5.92-4.35c0-.17-.02-.34-.05-.5.43-.28.71-.77.71-1.41zM8.65 13.24a1.06 1.06 0 1 1 2.12 0 1.06 1.06 0 0 1-2.12 0zm5.98 2.83c-.73.72-2.12.78-2.63.78s-1.9-.06-2.62-.78a.29.29 0 0 1 .4-.4c.46.45 1.44.62 2.22.62s1.77-.17 2.22-.62a.29.29 0 0 1 .41.4zm-.28-1.77a1.06 1.06 0 1 1 0-2.12 1.06 1.06 0 0 1 0 2.12z"/></svg>';
function subredditFromUrl(url) {
  const m = String(url || '').match(/reddit\.com\/r\/([^/]+)/i);
  return m ? 'r/' + m[1] : '';
}

const RD_DESC = /^Reddit\s+(r\/[A-Za-z0-9_]+)?\s*(?:—|-|,)?\s*(u\/[A-Za-z0-9_-]+)?(?:\s*,\s*([^—]+?))?\s*(?:—.*)?$/;
const X_DESC = /^X\s*(?:—|-|,)?\s*(@[A-Za-z0-9_]+)?(?:\s*,\s*([^—]+?))?\s*(?:—.*)?$/;
function socialMeta(s, kind) {
  const t = String(s.title || '').trim();
  const m = t.match(kind === 'x' ? X_DESC : RD_DESC);
  if (!m) return { title: t };
  if (kind === 'x') {
    return { title: '', handle: s.handle || m[1] || '', when: s.date || m[2] || '' };
  }
  return { title: '', sub: s.subreddit || m[1] || '', author: s.author || m[2] || '', when: s.flair || s.date || m[3] || '' };
}
function redditWidget(s, slug) {
  const meta = socialMeta(s, 'reddit');
  const sub = esc(meta.sub || s.subreddit || subredditFromUrl(s.url) || 'r/reddit');
  const author = esc(meta.author || s.author || 'u/[deleted]');
  const flairText = meta.when || s.flair || '';
  const flair = flairText ? `<span class="rp-rdflair">${esc(flairText)}</span>` : '';
  const title = esc(meta.title !== undefined ? meta.title : (s.title || ''));
  const body = esc(s.quote || s.summary || '');
  const up = fmtNumber(s.stats?.votes || s.stats?.score || s.stats?.upvotes) || '•';
  const cm = fmtNumber(s.stats?.comments) || '';
  return `<article class="rp-card rp-rd" data-platform="reddit">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-rdtop">${RD_LOGO}<span class="rp-rdsub">${sub}</span><span class="rp-rdby">· ${author}${flair}</span></div>` +
    (title ? `<div class="rp-rdtitle">${title}</div>` : '') +
    (body ? `<div class="rp-rdbody">${body}</div>` : '') +
    gloss(s) +
    `<div class="rp-rdbar"><span class="rp-rdpill">⬆ ${up} ⬇</span>${cm ? `<span class="rp-rdpill">💬 ${cm}</span>` : ''}<span class="rp-rdpill">⤴ Share</span></div>` +
    `</a>` +
    foot(s, slug) +
    `</article>`;
}

// ───────────────────────────── Hacker News ─────────────────────────────
function hackernewsWidget(s, slug) {
  const title = esc(s.title || s.quote || '(untitled)');
  const h = host(s.url) === 'news.ycombinator.com' ? '' : host(s.url);
  const pts = fmtNumber(s.stats?.points || s.stats?.score);
  const cm = fmtNumber(s.stats?.comments);
  const quote = s.quote && s.title ? `<div class="rp-hn-quote">${esc(s.quote)}${s.commenter ? `<span class="rp-hn-cby">— ${esc(s.commenter)}</span>` : ''}</div>` : '';
  return `<article class="rp-card rp-hn" data-platform="hackernews">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-hn-bar"><span class="rp-hn-y">Y</span><b>Hacker News</b><span class="rp-hn-new">new | past | comments | ask | show</span></div>` +
    `<div class="rp-hn-item"><span class="rp-hn-rank">1.</span><span class="rp-hn-vote">▲</span>` +
    `<span class="rp-hn-title">${title}${h ? ` <span class="rp-hn-host">(${esc(h)})</span>` : ''}</span></div>` +
    `<div class="rp-hn-meta">${pts ? `${pts} points` : 'discuss'}${s.author ? ` by ${esc(s.author)}` : ''}${cm ? ` | ${cm} comments` : ''}</div>` +
    quote +
    `</a>` +
    foot(s, slug) +
    `</article>`;
}

// ───────────────────────────── News — publisher-faithful mastheads ─────────────────────────────
// Each brand gets its real masthead treatment. Matching is by hostname first, publisher name second.
const NEWS_BRANDS = [
  { match: /wsj\.com|wall street journal/i, cls: 'nb-wsj', mast: 'THE WALL STREET JOURNAL', rule: 'double' },
  { match: /nytimes\.com|new york times/i, cls: 'nb-nyt', mast: 'The New York Times', rule: 'single' },
  { match: /bloomberg\.com|bloomberg/i, cls: 'nb-bloomberg', mast: 'Bloomberg' },
  { match: /fortune\.com|fortune/i, cls: 'nb-fortune', mast: 'FORTUNE' },
  { match: /cnbc\.com|cnbc/i, cls: 'nb-cnbc', mast: 'CNBC' },
  { match: /npr\.org|npr/i, cls: 'nb-npr', mast: 'npr' },
  { match: /cnn\.com|cnn/i, cls: 'nb-cnn', mast: 'CNN' },
  { match: /forbes\.com|forbes/i, cls: 'nb-forbes', mast: 'Forbes' },
  { match: /aljazeera\.com|al jazeera/i, cls: 'nb-aj', mast: 'AL JAZEERA' },
  { match: /scientificamerican\.com|scientific american/i, cls: 'nb-sciam', mast: 'SCIENTIFIC AMERICAN' },
  { match: /reuters\.com|reuters/i, cls: 'nb-reuters', mast: 'REUTERS' },
  { match: /apnews\.com|associated press/i, cls: 'nb-ap', mast: 'AP' },
  { match: /theguardian\.com|guardian/i, cls: 'nb-guardian', mast: 'The Guardian' },
  { match: /bbc\.(com|co\.uk)|bbc/i, cls: 'nb-bbc', mast: 'BBC' },
  { match: /techcrunch\.com|techcrunch/i, cls: 'nb-tc', mast: 'TechCrunch' },
  { match: /theverge\.com|the verge/i, cls: 'nb-verge', mast: 'THE VERGE' },
  { match: /wired\.com|wired/i, cls: 'nb-wired', mast: 'WIRED' },
  { match: /washingtonpost\.com|washington post/i, cls: 'nb-wapo', mast: 'The Washington Post' },
];
function newsBrand(s) {
  // Masthead derives from the URL's domain whenever a URL exists; the stored
  // publisher string only decides when there is no URL to contradict it
  // (a stale publisher field once rendered a huggingface.co post as the WSJ).
  const h = host(s.url);
  const key = h || String(s.publisher || '');
  for (const b of NEWS_BRANDS) if (b.match.test(key)) return b;
  return { cls: 'nb-generic', mast: (h || s.publisher || 'News').toUpperCase(), rule: 'single' };
}
function newsWidget(s, slug) {
  const b = newsBrand(s);
  const title = esc(s.title || '(untitled)');
  const byline = s.author && s.author !== s.publisher ? `By ${esc(s.author)}` : '';
  const when = dateShort(s);
  return `<article class="rp-card rp-news ${b.cls}" data-platform="news">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-news-mast${b.rule === 'double' ? ' rp-news-double' : ''}">${esc(b.mast)}</div>` +
    (s.section ? `<div class="rp-news-sec">${esc(s.section)}</div>` : '') +
    `<div class="rp-news-headline">${title}</div>` +
    quoteThenSummary(s, 'rp-news-quote', 'rp-news-dek') +
    `<div class="rp-news-byline">${byline}${byline && when ? ' · ' : ''}${esc(when)}</div>` +
    `</a>` +
    foot(s, slug) +
    `</article>`;
}

// ───────────────────────────── Official statement / disclosure ─────────────────────────────
// A company or government body speaking in its own name (incident disclosure, press release,
// joint report). Letterhead document: favicon seal, org name, document rule, serif quote.
function statementWidget(s, slug) {
  const org = esc(s.publisher || s.author || 'Statement');
  const kind = esc(s.section || (/(house|senate)\.gov/.test(String(s.url)) ? 'Press release' : 'Official disclosure'));
  const title = esc(s.title || '(untitled)');
  const quote = s.quote ? `<div class="rp-st-quote">“${esc(s.quote)}”</div>` : '';
  const sum = !s.quote && s.summary ? `<div class="rp-st-sum">${esc(s.summary)}</div>` : '';
  const ico = favicon(s.url, 64);
  const when = dateShort(s);
  return `<article class="rp-card rp-st" data-platform="statement">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-st-head">${ico ? `<img class="rp-st-ico" src="${ico}" alt="" width="28" height="28" loading="lazy">` : ''}` +
    `<div><div class="rp-st-org">${org}</div><div class="rp-st-kind">${kind}</div></div></div>` +
    `<div class="rp-st-title">${title}</div>` +
    quote + sum +
    `<div class="rp-st-when">${esc(when)}${host(s.url) ? ` · ${esc(host(s.url))}` : ''}</div>` +
    `</a>` +
    gloss(s) +
    foot(s, slug) +
    `</article>`;
}

// ───────────────────────────── Dictionary entry ─────────────────────────────
// A lexicon citation rendered as the entry itself: headword, romanization, gloss, source line.
function dictionaryWidget(s, slug) {
  const headword = esc(s.headword || (String(s.title || '').match(/[؀-ۿ][؀-ۿ\s]*/) || [''])[0].trim() || '—');
  const translit = s.translit ? `<span class="rp-dx-tr">${esc(s.translit)}</span>` : '';
  const pos = esc(s.pos || 'noun');
  const gloss = esc(s.quote || s.summary || '');
  const dict = esc(s.publisher || s.title || 'Dictionary');
  return `<article class="rp-card rp-dx" data-platform="dictionary">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-dx-mast">${dict}</div>` +
    `<div class="rp-dx-head"><span class="rp-dx-word" lang="fa">${headword}</span>${translit}</div>` +
    `<div class="rp-dx-pos">${pos}</div>` +
    (gloss ? `<ol class="rp-dx-senses"><li>${gloss}</li></ol>` : '') +
    `</a>` +
    foot(s, slug) +
    `</article>`;
}

// ───────────────────────────── Book / primary text ─────────────────────────────
const BOOK_TONES = ['#1f3a5f', '#4a1f3d', '#2d4a22', '#5b3a1e', '#3b2f63', '#6e1f2a'];
function bookWidget(s, slug) {
  const title = esc(s.work || s.title || '(untitled)');
  const author = esc(s.author || s.publisher || '');
  const quote = s.quote ? `<div class="rp-bk-quote">“${esc(s.quote)}”</div>` : '';
  const sum = !s.quote && s.summary ? `<div class="rp-bk-sum">${esc(s.summary)}</div>` : '';
  const tone = BOOK_TONES[seed(title) % BOOK_TONES.length];
  const year = esc(s.year || '');
  return `<article class="rp-card rp-bk" data-platform="book">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-bk-row"><div class="rp-bk-cover" style="background:${tone}"><span>${title}</span>${author ? `<em>${author}</em>` : ''}</div>` +
    `<div class="rp-bk-meta"><div class="rp-bk-kind">Primary text</div><div class="rp-bk-title">${title}</div>` +
    (author ? `<div class="rp-bk-auth">${author}${year ? ` · ${year}` : ''}</div>` : '') +
    `</div></div>` +
    quote + sum +
    `</a>` +
    foot(s, slug) +
    `</article>`;
}

// ───────────────────────────── Encyclopedia (Iranica / Britannica / scholarly) ─────────────────────────────
function encyclopediaWidget(s, slug) {
  const mast = esc(s.publisher || 'ENCYCLOPÆDIA');
  const entry = esc(s.entry || s.title || '(entry)');
  const body = esc(s.quote || s.summary || '');
  return `<article class="rp-card rp-en" data-platform="encyclopedia">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-en-mast">${mast}</div>` +
    `<div class="rp-en-entry">${entry}</div>` +
    (body ? `<div class="rp-en-body">${body}</div>` : '') +
    gloss(s) +
    `<div class="rp-en-note">Peer-reviewed reference entry</div>` +
    `</a>` +
    foot(s, slug) +
    `</article>`;
}

// ───────────────────────────── Wikipedia ─────────────────────────────
function wikipediaWidget(s, slug) {
  const title = esc(s.entry || s.title || '(article)');
  const body = esc(s.quote || s.summary || '');
  return `<article class="rp-card rp-wk" data-platform="wikipedia">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-wk-mast"><span class="rp-wk-w">W</span><span>WIKIPEDIA<small>The Free Encyclopedia</small></span></div>` +
    `<div class="rp-wk-title">${title}</div>` +
    `<div class="rp-wk-from">From Wikipedia, the free encyclopedia</div>` +
    (body ? `<div class="rp-wk-body">${body}</div>` : '') +
    gloss(s) +
    `</a>` +
    foot(s, slug) +
    `</article>`;
}

// ───────────────────────────── iMessage / WhatsApp (anecdotes) ─────────────────────────────
function imessageWidget(s, slug) {
  const contact = esc(s.author || s.publisher || 'Source');
  return `<article class="rp-card rp-im" data-platform="imessage">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-imtop"><span class="rp-imback">‹</span><div class="rp-imnavav">${initial(contact)}</div><div class="rp-imname">${contact}</div></div>` +
    `<div class="rp-imchat">` +
    `<div class="rp-imrow rp-im-them"><div class="rp-imbubble">${esc(s.quote || s.summary || s.title || '…')}</div></div>` +
    `<div class="rp-imrow rp-im-me"><div class="rp-imbubble">logged to the source ledger ✓</div></div>` +
    `</div>` +
    `</a>` +
    gloss(s) +
    foot(s, slug) +
    `</article>`;
}
function whatsappWidget(s, slug) {
  const group = esc(s.chat_name || s.publisher || 'Research chat');
  const sender = esc(s.author || 'Source');
  return `<article class="rp-card rp-wa" data-platform="whatsapp">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-wabar"><div class="rp-waav">${initial(group)}</div><div><div class="rp-wagrp">${group}</div><div class="rp-wasub">${sender}</div></div></div>` +
    `<div class="rp-wamsgs">` +
    `<div class="rp-wasys">Messages are end-to-end encrypted</div>` +
    `<div class="rp-wamsg rp-wa-in"><div class="rp-wasender">${sender}</div>${esc(s.quote || s.summary || s.title || '')}</div>` +
    `<div class="rp-wamsg rp-wa-out">logged to the source ledger<div class="rp-watime">✓✓</div></div>` +
    `</div>` +
    `</a>` +
    gloss(s) +
    foot(s, slug) +
    `</article>`;
}

// ───────────────────────────── PubMed ─────────────────────────────
function pubmedWidget(s, slug) {
  const title = esc(s.title || '(untitled)');
  const tag = esc(s.tag || s.study_type || 'Study');
  const authors = esc(s.author || s.authors || '');
  const journal = esc(s.publisher || s.journal || '');
  const pmid = esc(s.pmid || s.external_id || '');
  const glossText = String(s.plain || s.why || '').trim();
  const summary = String(s.summary || '').trim();
  const absShown = summary && summary !== String(s.quote || '').trim() && summary !== glossText
    ? `<div class="rp-medabs">${esc(summary)}</div>` : '';
  return `<article class="rp-card rp-med" data-platform="pubmed">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-medlogo"><span class="rp-medmark">Pub<b>Med</b></span><span class="rp-medgov">.gov</span></div>` +
    `<div class="rp-medtag">${tag}</div>` +
    `<div class="rp-medtitle">${title}</div>` +
    quoteBlock(s, 'rp-medquote') +
    gloss(s) +
    absShown +
    `<div class="rp-medmeta"><strong>${authors}</strong>${journal ? ' · ' + journal : ''}${pmid ? ' · PMID: ' + pmid : ''}</div>` +
    `</a>` +
    foot(s, slug) +
    `</article>`;
}

// ───────────────────────────── YouTube ─────────────────────────────
// Plays INLINE (click-to-load youtube-nocookie iframe) — the card never navigates the
// reader off the site. The real thumbnail loads from i.ytimg.com when the URL carries a
// video id; the source URL stays available in the card foot for provenance.
function ytVideoId(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  return m ? m[1] : '';
}
function youtubeWidget(s, slug) {
  const channel = esc(s.channel || s.author || s.publisher || 'YouTube');
  const title = esc(s.title || s.quote || '(untitled)');
  const views = fmtNumber(s.stats?.views);
  const when = dateShort(s);
  const dur = s.duration ? `<span class="rp-ytdur">${esc(s.duration)}</span>` : '';
  const vid = ytVideoId(s.url);
  const thumbStyle = vid ? ` style="background-image:url('https://i.ytimg.com/vi/${esc(vid)}/hqdefault.jpg');background-size:cover;background-position:center"` : '';
  return `<article class="rp-card rp-yt" data-platform="youtube">` +
    `<div class="rp-body rp-yt-inline" data-yt-id="${esc(vid)}" data-yt-title="${title}" role="button" tabindex="0" aria-label="Play video inline">` +
    `<div class="rp-ytthumb"${thumbStyle}><div class="rp-ytplay"><span></span></div>${dur}</div>` +
    `<div class="rp-ytrow"><div class="rp-ytav" style="background:${avColor(channel)}">${initial(channel)}</div>` +
    `<div class="rp-ytinfo"><div class="rp-yttitle">${title}</div>` +
    `<div class="rp-ytmeta">${channel}${views ? ` · ${views} views` : ''}${when ? ` · ${esc(when)}` : ''}</div></div></div>` +
    `</div>` +
    // The sentence the video actually says. This card used the quote only as a fallback TITLE, so
    // whenever a video source had both a title and a quote — which is every one of them on
    // /a/bpc-157 — the quotation was dropped and the card was a thumbnail with a headline. A video
    // cited as evidence has to show what in it is the evidence.
    quoteThenSummary(s, 'rp-yt-quote', 'rp-yt-sum') +
    gloss(s) +
    foot(s, slug) +
    `</article>`;
}

// ───────────────────────────── GitHub / Stack Overflow / arXiv / Discord ─────────────────────────────
function repoFromUrl(url) {
  const m = String(url || '').match(/github\.com\/([^/]+\/[^/#?]+)/i);
  return m ? m[1] : '';
}
function githubWidget(s, slug) {
  const repo = esc(s.repo || repoFromUrl(s.url) || 'owner/repo');
  const title = esc(s.title || s.quote || '(untitled)');
  const body = esc(s.summary || '');
  const ghMark = '<svg class="rp-gh-logo" viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"><path fill="#f0f6fc" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>';
  return `<article class="rp-card rp-gh" data-platform="github">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-gh-top">${ghMark}<span class="rp-gh-repo">${repo}</span>${s.number ? `<span>#${esc(s.number)}</span>` : ''}</div>` +
    `<div class="rp-gh-title">${title}</div>` +
    (body ? `<div class="rp-gh-body">${body}</div>` : '') +
    gloss(s) +
    `<div class="rp-gh-meta">${s.lang ? `<span class="rp-gh-lang"><i></i>${esc(s.lang)}</span>` : ''}` +
    (s.stats?.stars ? `<span>★ ${fmtNumber(s.stats.stars)}</span>` : '') +
    (s.stats?.forks ? `<span>⑂ ${fmtNumber(s.stats.forks)}</span>` : '') +
    (s.stats?.comments ? `<span>💬 ${fmtNumber(s.stats.comments)}</span>` : '') +
    `</div></a>` +
    foot(s, slug) +
    `</article>`;
}
function stackoverflowWidget(s, slug) {
  const title = esc(s.title || s.quote || '(untitled)');
  const body = esc(s.summary || '');
  const tags = (Array.isArray(s.tags) ? s.tags : String(s.tags || '').split(',').filter(Boolean)).slice(0, 4);
  return `<article class="rp-card rp-so" data-platform="stackoverflow">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-so-stats"><div class="rp-so-stat">${fmtNumber(s.stats?.votes || s.stats?.score) || 0}<small>votes</small></div>` +
    `<div class="rp-so-stat${s.stats?.accepted ? ' rp-so-acc' : ''}">${fmtNumber(s.stats?.answers) || 0}<small>answers</small></div></div>` +
    `<div><div class="rp-so-title">${title}</div>` +
    (body ? `<div class="rp-so-body">${body}</div>` : '') +
    gloss(s) +
    (tags.length ? `<div class="rp-so-tags">${tags.map(t => `<span class="rp-so-tag">${esc(String(t).trim())}</span>`).join('')}</div>` : '') +
    `</div></a>` +
    foot(s, slug) +
    `</article>`;
}
function arxivWidget(s, slug) {
  const title = esc(s.title || '(untitled)');
  const authors = esc(s.author || s.authors || '');
  const axid = esc(s.external_id || s.arxiv_id || '');
  return `<article class="rp-card rp-ax" data-platform="arxiv">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div><span class="rp-ax-mast">arXiv</span>${axid ? `<span class="rp-ax-id">${axid}</span>` : ''}</div>` +
    `<div class="rp-ax-title">${title}</div>` +
    quoteThenSummary(s, 'rp-ax-quote', 'rp-ax-abs') +
    (authors ? `<div class="rp-ax-auth">${authors}</div>` : '') +
    `</a>` +
    foot(s, slug) +
    `</article>`;
}
function discordWidget(s, slug) {
  const name = esc(s.author || 'user');
  const chan = esc(s.channel || s.chat_name || '#general');
  const when = esc(String(s.accessed_at || s.ts || '').slice(0, 10));
  return `<article class="rp-card rp-dc" data-platform="discord">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-dc-av" style="background:${avColor(name)}">${initial(name)}</div>` +
    `<div><div><span class="rp-dc-name">${name}</span><span class="rp-dc-time">${when}</span></div>` +
    `<div class="rp-dc-text">${esc(s.quote || s.summary || s.title || '')}</div>` +
    `<div class="rp-dc-chan">${chan}</div></div>` +
    `</a>` +
    foot(s, slug) +
    `</article>`;
}

// ───────────────────────────── Model answer (a model signing its pass over an object) ─────────────────────────────
// A source of type "model" is one model's examination of one object, on the record: which model,
// which surface it ran on, which object it looked at, how many times, and what it concluded.
// The card wears its vendor's own chat surface (mimicry law) so a reader can tell Claude from GPT
// at a glance across a ledger of thousands of passes.
const MODEL_BRANDS = [
  { match: /claude|anthropic|opus|sonnet|haiku|fable/i, cls: 'mb-claude', vendor: 'Anthropic', mark: '✳' },
  { match: /gpt|openai|o[1-9]\b|chatgpt/i, cls: 'mb-openai', vendor: 'OpenAI', mark: '◉' },
  { match: /gemini|google|palm/i, cls: 'mb-gemini', vendor: 'Google', mark: '✦' },
  { match: /grok|xai/i, cls: 'mb-grok', vendor: 'xAI', mark: '𝕏' },
  { match: /kimi|moonshot/i, cls: 'mb-kimi', vendor: 'Moonshot', mark: '☾' },
  { match: /glm|zhipu/i, cls: 'mb-glm', vendor: 'Z.ai', mark: '◈' },
  { match: /llama|meta/i, cls: 'mb-llama', vendor: 'Meta', mark: '∞' },
  { match: /mistral/i, cls: 'mb-mistral', vendor: 'Mistral', mark: '▲' },
];
function modelBrand(name) {
  for (const b of MODEL_BRANDS) if (b.match.test(String(name || ''))) return b;
  return { cls: 'mb-generic', vendor: 'Model', mark: '●' };
}
function modelWidget(s, slug) {
  const model = esc(s.model || s.author || s.title || 'Model');
  const b = modelBrand(s.model || s.author || s.title || '');
  const vendor = esc(s.vendor || b.vendor);
  const surface = esc(s.surface || s.channel || '');
  const authority = esc(s.authority || s.publisher || '');
  const object = esc(s.object || s.examined || '');
  const passes = Number(s.passes || 0);
  const verdict = esc(s.verdict || '');
  const body = esc(s.quote || s.summary || '');
  const when = dateShort(s);
  const url = esc(s.url || '#');
  const tag = url && url !== '#' ? 'a' : 'div';
  const href = tag === 'a' ? ` href="${url}" target="_blank" rel="noopener noreferrer"` : '';
  return `<article class="rp-card rp-md ${b.cls}" data-platform="model">` +
    `<${tag} class="rp-body"${href}>` +
    `<div class="rp-md-top"><span class="rp-md-mark">${b.mark}</span>` +
    `<span class="rp-md-name">${model}</span>` +
    (surface ? `<span class="rp-md-surface">${surface}</span>` : '') +
    `<span class="rp-md-vendor">${vendor}</span></div>` +
    (object
      ? `<div class="rp-md-object"><span class="rp-md-tenant">examined</span><code>${object}</code>` +
        (passes ? `<span class="rp-md-passes">${passes}×</span>` : '') + `</div>`
      : '') +
    (body ? `<div class="rp-md-text">${body}</div>` : '') +
    governedFindingBlock(s) +
    (verdict ? `<div class="rp-md-verdict">${verdict}</div>` : '') +
    `<div class="rp-md-sig">— ${model}${surface ? ` (${surface})` : ''}${authority ? ` · ${authority}` : ''}${when ? ` · ${esc(when)}` : ''}</div>` +
    `</${tag}>` +
    modelRawBlock(s) +
    foot(s, slug) +
    `</article>`;
}

function parseGovernedFinding(text) {
  const t = String(text || '');
  if (!/RECORDS_ABSENT|CONDITIONS_I_OPERATE_UNDER|APPLICABLE_RULES|DECISION:\s*(VERDICT|TOOL|ASK|REFUSE)/i.test(t)) return null;
  // Pull a labeled block: from LABEL: to the next ALL_CAPS_LABEL: or end.
  const grabBlock = (labels) => {
    for (const label of labels) {
      const re = new RegExp(label + '\\s*:?\\s*\\n?([\\s\\S]*?)(?=\\n[A-Z][A-Z_ ]{3,}:|\\nDECISION:|$)', 'i');
      const m = re.exec(t);
      if (m && m[1].trim()) return m[1].trim();
    }
    return '';
  };
  const verdict = (t.match(/\bVERDICT:\s*(AFFIRM|DENY|CANNOT_CONCLUDE)/i) || [])[1] ||
    (t.match(/DECISION:\s*VERDICT\s*[—-]\s*(AFFIRM|DENY|CANNOT_CONCLUDE)/i) || [])[1] || '';
  const decisionLine = (t.match(/DECISION:\s*(VERDICT|TOOL|ASK|REFUSE)\b[^\n]*/i) || [])[0] || '';
  const rules = grabBlock(['APPLICABLE_RULES']);
  return {
    conditions: grabBlock(['CONDITIONS_I_OPERATE_UNDER', 'CONDITIONS']),
    supplied: grabBlock(['RECORDS_SUPPLIED', 'EVIDENCE_USED', 'KNOWN_FACTS']),
    absent: grabBlock(['RECORDS_ABSENT']),
    unknown: grabBlock(['UNKNOWN_FACTS']),
    reasoning: grabBlock(['REASONING']),
    rejected: grabBlock(['REJECTED_ALTERNATIVE']),
    flip: grabBlock(['WHAT_WOULD_CHANGE_THIS', 'WHAT WOULD FLIP', 'VERIFICATION_REQUIRED']),
    rules, verdict: verdict.toUpperCase(), decisionLine,
  };
}
function bullets(txt) {
  const lines = String(txt || '').split('\n').map((l) => l.replace(/^[\s\-*•\d.]+/, '').trim()).filter(Boolean);
  if (!lines.length) return '';
  return '<ul class="rp-gf-list">' + lines.slice(0, 8).map((l) => `<li>${esc(l)}</li>`).join('') + '</ul>';
}
function governedFindingBlock(s) {
  const raw = s.raw_response != null ? (typeof s.raw_response === 'string' ? s.raw_response : JSON.stringify(s.raw_response)) : (s.quote || '');
  const f = parseGovernedFinding(raw);
  if (!f) return '';
  const vClass = f.verdict === 'AFFIRM' ? 'affirm' : f.verdict === 'DENY' ? 'deny' : 'cc';
  const section = (label, body, cls) => body ? `<div class="rp-gf-sec ${cls || ''}"><div class="rp-gf-tenant">${label}</div>${bullets(body) || `<div class="rp-gf-txt">${esc(body.slice(0, 700))}</div>`}</div>` : '';
  return `<div class="rp-gf" data-verdict="${vClass}">` +
    `<div class="rp-gf-head"><span class="rp-gf-tag">governed under the Decision Constitution</span>` +
      (f.verdict ? `<span class="rp-gf-verdict rp-gf-${vClass}">${esc(f.verdict)}</span>` : '') + `</div>` +
    (f.rules ? `<div class="rp-gf-rules"><span class="rp-gf-tenant">clauses relied on</span> <code>${esc(f.rules.slice(0, 120))}</code></div>` : '') +
    section('records absent — what a reviewer would expect and the model was not given', f.absent, 'rp-gf-absent') +
    section('records used', f.supplied) +
    section('reasoning, clause by clause', f.reasoning) +
    section('strongest alternative, and why rejected', f.rejected) +
    section('what would flip this verdict', f.flip, 'rp-gf-flip') +
    (f.decisionLine ? `<div class="rp-gf-decision"><code>${esc(f.decisionLine.slice(0, 200))}</code></div>` : '') +
    `</div>`;
}

function modelRawBlock(s) {
  const req = s.raw_request != null ? (typeof s.raw_request === 'string' ? s.raw_request : JSON.stringify(s.raw_request, null, 1)) : null;
  const res = s.raw_response != null ? (typeof s.raw_response === 'string' ? s.raw_response : JSON.stringify(s.raw_response, null, 1)) : null;
  if (!req && !res) return '';
  return `<details class="rp-raw"><summary>raw payload — the full request and response JSON, verbatim (machine data)</summary>` +
    (req ? `<div class="rp-raw-l">REQUEST — POST ${esc(s.raw_endpoint || '')}</div><pre class="rp-raw-pre">${esc(req)}</pre>` : '') +
    (res ? `<div class="rp-raw-l">RESPONSE</div><pre class="rp-raw-pre">${esc(res)}</pre>` : '') +
    `</details>`;
}

function receiptWidget(s, slug) {
  const id = String(s.invocation_id || (String(s.url || '').match(/inv_[a-z0-9]+/i) || [''])[0] || '');
  const verdictRaw = String(s.verdict || s.status || '');
  const material = /material/i.test(verdictRaw) || s.material === true;
  const verdict = esc(verdictRaw || (material ? 'material result proven' : 'attempt proven; result not observed'));
  const cap = esc(s.capability || s.object || (s.title || '').split('·')[0].trim() || 'invocation');
  return `<article class="rp-card rp-rcpt" data-platform="receipt" data-material="${material ? '1' : '0'}">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-rcpt-head"><span class="rp-rcpt-mark">◈</span><div>` +
      `<div class="rp-rcpt-org">Public invocation receipt</div>` +
      `<div class="rp-rcpt-kind">${material ? 'Material result proven' : 'Attempt proven · result not observed'}</div>` +
    `</div></div>` +
    `<div class="rp-rcpt-cap">${cap}</div>` +
    (s.title ? `<div class="rp-rcpt-title">${esc(s.title)}</div>` : '') +
    // A receipt card rendered no quote at all, so a stored quote silently vanished from the page.
    quoteThenSummary(s, 'rp-rcpt-quote', 'rp-rcpt-sum') +
    `<div class="rp-rcpt-when">${id ? `<code>${esc(id)}</code> · ` : ''}${esc(verdict)}</div>` +
    `</a>` + foot(s, slug) + `</article>`;
}

// LIVE ENDPOINT CARD — a source that is a live surface on this system (a metric, a registry
// route, an export). It says "open it yourself" instead of impersonating a publication.
function liveSurfaceWidget(s, slug) {
  const path = (() => { try { return new URL(String(s.url)).pathname + (new URL(String(s.url)).search || ''); } catch { return String(s.url || ''); } })();
  return `<article class="rp-card rp-live" data-platform="live_surface">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-live-head"><span class="rp-live-dot"></span><div>` +
      `<div class="rp-live-org">Live surface · answers on request</div>` +
      `<div class="rp-live-kind">${esc(String(s.method || 'GET').toUpperCase())} <code>${esc(path)}</code></div>` +
    `</div></div>` +
    `<div class="rp-live-title">${esc(s.title || path)}</div>` +
    (s.summary ? `<div class="rp-live-sum">${esc(s.summary)}</div>` : '') +
    (s.quote ? `<div class="rp-live-quote">“${esc(s.quote)}”</div>` : '') +
    `<div class="rp-live-when">no token required · open it and compare</div>` +
    `</a>` + foot(s, slug) + `</article>`;
}

function emailLetterWidget(s, slug) {
  // The letter's own text is the quote. This read `body_text || summary` and dropped `quote`
  // entirely, so a letter stored as a quotation rendered as an empty envelope.
  const paras = String(s.body_text || s.quote || s.summary || '').split(/\n\n+/).filter(Boolean);
  const shown = paras.slice(0, 2).map((p) => `<p class="rp-em-p">${esc(p)}</p>`).join('');
  const rest = paras.slice(2).map((p) => `<p class="rp-em-p">${esc(p)}</p>`).join('');
  const hash = String(s.sha256 || '');
  return `<div class="rp-card rp-em" data-slug="${esc(slug || '')}">
  <div class="rp-em-head">
    <div><span class="rp-em-k">From</span> <strong>build@miscsubjects.com</strong></div>
    <div><span class="rp-em-k">To</span> <strong>${esc(s.to_name || '')}</strong>${s.to_email ? ' &lt;' + esc(s.to_email) + '&gt;' : ''}</div>
    <div><span class="rp-em-k">Subject</span> ${esc(s.subject || s.title || '')}</div>
    ${s.sent_at ? `<div><span class="rp-em-k">Sent</span> ${esc(s.sent_at)}</div>` : ''}
  </div>
  <div class="rp-em-body">${shown}${rest ? `<details class="rp-em-more"><summary>Read the full letter</summary>${rest}</details>` : ''}</div>
  <div class="rp-em-sig">Yours in civilization,<br><strong>build@miscsubjects.com</strong> — Fable 5, via CLI authority</div>
  <div class="rp-em-foot">
    ${s.message_id ? `<span>message-id ${esc(String(s.message_id).replace(/[<>]/g, ''))}</span>` : '<span>canonical class letter — no send yet</span>'}
    ${hash ? `<span>sha256 ${esc(hash.slice(0, 16))}…</span>` : ''}
    ${s.letter_url ? `<a href="${esc(s.letter_url)}">permanent object</a>` : ''}
  </div>
</div>`;
}


function gloss(s) {
  const q = String(s.quote || '').trim();
  if (q) return '';
  const g = String(s.plain || s.why || s.summary || '').trim();
  if (!g) return '';
  return `<div class="rp-gloss">${esc(g)}</div>`;
}

// The verbatim quote, rendered as the body of the card the way the platform would show it.
function quoteBlock(s, cls) {
  const q = String(s.quote || '').trim();
  if (!q) return '';
  return `<blockquote class="${cls || 'rp-quote'}">${esc(q)}</blockquote>`;
}

/**
 * OUR WORDS NEVER STAND IN FOR THE SOURCE'S WORDS.
 *
 * Three cards read the summary first and fell back to the quote only if the summary was empty — the
 * news dek, the PubMed abstract line and the arXiv abstract line. When a source carried both, the
 * summary won and the reader saw our description of the document instead of the sentence from it. On
 * /a/bpc-157 the FDA card showed a paragraph we wrote and never showed the FDA's own words, which
 * were stored the whole time. That precedence is now banned by name in failure-vault.json, so the
 * shape cannot be written back into this file without failing the commit.
 *
 * This helper is the corrected precedence, in one place: the quote is rendered as a quotation, and
 * our summary appears after it only when it says something the quote does not. A card can no longer
 * be authored in a way that suppresses its source.
 */
function quoteThenSummary(s, quoteCls, sumCls) {
  const quote = String(s.quote || '').trim();
  const summary = String(s.summary || '').trim();
  const out = [];
  if (quote) out.push(`<blockquote class="${quoteCls}">${esc(quote)}</blockquote>`);
  // A summary that repeats the quote is noise; a summary with no quote to accompany is all the
  // reader has, so it still renders.
  const dup = quote && (summary === quote || summary.includes(quote) || quote.includes(summary));
  if (summary && !dup) out.push(`<div class="${sumCls}">${esc(summary)}</div>`);
  return out.join('');
}

function fallbackWidget(s, slug) {
  const h = host(s.url);
  const ico = favicon(s.url, 64);
  return `<article class="rp-card rp-fallback" data-platform="${esc(s.type || 'other')}">` +
    `<a class="rp-body" href="${esc(s.url || '#')}" target="_blank" rel="noopener noreferrer">` +
    `<div class="rp-fallback-head">${ico ? `<img class="rp-fallback-ico" src="${ico}" alt="" width="24" height="24" loading="lazy">` : `<div class="rp-fallback-mark">${initial(s.publisher || s.type || 'S')}</div>`}` +
    `<div class="rp-fallback-type">${esc(s.publisher || h || s.type || 'source')}</div></div>` +
    `<div class="rp-fallback-title">${esc(s.title || '(untitled)')}</div>` +
    quoteBlock(s, 'rp-fallback-quote') +
    gloss(s) +
    (h ? `<div class="rp-fallback-host">↗ ${esc(h)}</div>` : '') +
    `</a>` +
    foot(s, slug) +
    `</article>`;
}

// ───────────────────────────── Router ─────────────────────────────
// Type is the primary key; hostname disambiguates the rest. "business" (legacy) resolves to a
// publisher masthead only when the source actually IS that publisher — an org speaking in its
// own name gets the statement letterhead, never someone else's masthead.
export function renderPlatformCard(raw, slug) {
  // Widget-specific fields (headword, stats, section, channel, work, …) may live in
  // source.extra — the protocol's sources() endpoint preserves extra verbatim, so future
  // writers park widget fields there. Top-level wins on conflict.
  const s = raw && raw.extra && typeof raw.extra === 'object' ? { ...raw.extra, ...raw } : raw;
  let t = String(s.type || '').toLowerCase().trim();
  const u = String(s.url || '');
  const ALIAS = {
    tweet: 'x', 'x.com': 'x', twitter: 'x',
    clinicaltrials: 'clinical_trial', 'clinical-trial': 'clinical_trial', ctg: 'clinical_trial',
    trial: 'clinical_trial', nct: 'clinical_trial',
    subreddit: 'reddit', 'reddit.com': 'reddit',
    paper: 'pubmed', pmid: 'pubmed', study: 'pubmed', journal: 'pubmed',
    yt: 'youtube', ig: 'instagram',
    regulatory: 'statement', regulation: 'statement', agency: 'statement', fda: 'statement',
  };
  if (ALIAS[t]) t = ALIAS[t];
  if (!t || t === 'source' || t === 'other' || t === 'reference' || t === 'link') {
    if (/reddit\.com/i.test(u)) t = 'reddit';
    else if (/(^|\/\/)(www\.)?(x|twitter)\.com/i.test(u)) t = 'x';
    else if (/clinicaltrials\.gov/i.test(u)) t = 'clinical_trial';
    else if (/pubmed\.ncbi|pmc\.ncbi|ncbi\.nlm\.nih\.gov\/pmc|europepmc\.org|doi\.org|journals\.sagepub\.com|ascopubs\.org|sciencedirect\.com|link\.springer\.com|onlinelibrary\.wiley\.com|nature\.com|thelancet\.com|jamanetwork\.com|bmj\.com|frontiersin\.org|mdpi\.com|tandfonline\.com|cell\.com|academic\.oup\.com|karger\.com|physiology\.org|ahajournals\.org|biorxiv\.org|medrxiv\.org|nejm\.org|plos\.org/i.test(u)) t = 'pubmed';
    else if (/youtube\.com|youtu\.be/i.test(u)) t = 'youtube';
    else if (/instagram\.com/i.test(u)) t = 'instagram';
    // A compound record in a public chemical database is a reference entry, not a study.
    else if (/pubchem\.ncbi|drugbank\.com|chemspider\.com|guidetopharmacology\.org/i.test(u)) t = 'dictionary';
    // An organisation speaking in its own name: regulators, standards bodies, and a company's
    // own press release all get the letterhead rather than someone else's masthead.
    else if (/fda\.gov|who\.int|ema\.europa\.eu|wada-ama\.org|federalregister\.gov|ods\.od\.nih\.gov|nih\.gov|europa\.eu|prnewswire\.com|businesswire\.com|globenewswire\.com|\.gov(\/|$)|\.org\/wp-content\//i.test(u)) t = 'statement';
    else if (/statnews\.com|rxlist\.com|medicalnewstoday\.com|healthline\.com|reuters\.com|apnews\.com|bbc\.co|nytimes\.com|washingtonpost\.com|theguardian\.com|endpts\.com|fiercebiotech\.com/i.test(u)) t = 'news';
  }
  if (t === 'x' || t === 'twitter') return xWidget(s, slug);
  if (t === 'instagram' || t === 'ig') return instagramWidget(s, slug);
  if (t === 'reddit') return redditWidget(s, slug);
  if (t === 'imessage' || t === 'imsg') return imessageWidget(s, slug);
  if (t === 'whatsapp' || t === 'wa') return whatsappWidget(s, slug);
  if (t === 'pubmed' || t === 'clinical_trial' || t === 'review' || t === 'medical') return pubmedWidget(s, slug);
  if (t === 'receipt' || (!t && /\/api\/dispatch\?confirm=|\/receipt\/inv_/.test(u))) return receiptWidget(s, slug);
  if (t === 'live_surface' || t === 'endpoint' || t === 'api') return liveSurfaceWidget(s, slug);
  if (t === 'statement' || t === 'press' || t === 'disclosure' || t === 'gov') return statementWidget(s, slug);
  if (t === 'dictionary') return dictionaryWidget(s, slug);
  if (t === 'book' || t === 'primary-text' || t === 'primary_text') return bookWidget(s, slug);
  if (t === 'encyclopedia') return encyclopediaWidget(s, slug);
  if (t === 'wikipedia' || /wikipedia\.org/i.test(u)) return wikipediaWidget(s, slug);
  if (t === 'hackernews' || t === 'hn' || /news\.ycombinator\.com/i.test(u)) return hackernewsWidget(s, slug);
  if (t === 'news' || t === 'nyt') return newsWidget(s, slug);
  if (t === 'business') {
    // Legacy type: WSJ masthead ONLY for wsj.com; a company/government page in this bucket
    // is that org's own statement.
    if (/wsj\.com/i.test(u)) return newsWidget(s, slug);
    if (newsBrand(s).cls !== 'nb-generic') return newsWidget(s, slug);
    return statementWidget(s, slug);
  }
  if (t === 'email' || t === 'letter') return emailLetterWidget(s, slug);
  if (t === 'youtube' || t === 'yt') return youtubeWidget(s, slug);
  if (t === 'github' || t === 'gh') return githubWidget(s, slug);
  if (t === 'stackoverflow' || t === 'so') return stackoverflowWidget(s, slug);
  if (t === 'arxiv') return arxivWidget(s, slug);
  if (t === 'discord') return discordWidget(s, slug);
  if (t === 'model' || t === 'llm' || t === 'ai') return modelWidget(s, slug);
  if (t === 'anecdotal') return seed(s.id || s.url) % 2 ? imessageWidget(s, slug) : whatsappWidget(s, slug);
  if (t === 'protocol' && /github\.com/.test(u)) return githubWidget(s, slug);
  if (t === 'reference' || t === 'other') {
    // Route references by what they actually point at.
    if (/wikipedia\.org/i.test(u)) return wikipediaWidget(s, slug);
    if (/iranicaonline\.org|britannica\.com/i.test(u)) return encyclopediaWidget(s, slug);
  }
  return fallbackWidget(s, slug);
}

// Demo card data for the /design showcase — one specimen per platform family.
export const WIDGET_SPECIMENS = [
  { type: 'x', id: 'spec-x', author: 'Ada Lovelace (@ada)', quote: 'The Analytical Engine weaves algebraic patterns just as the Jacquard loom weaves flowers and leaves.', url: 'https://x.com/ada/status/1', accessed_at: '2026-07-24T00:00', hash: 'demo0000x', stats: { replies: 1200, reposts: 4800, likes: 32000 } },
  { type: 'reddit', id: 'spec-rd', author: 'u/lurker_prime', subreddit: 'r/askscience', title: 'Why does the sky change color at sunset?', quote: 'Rayleigh scattering — shorter wavelengths scatter out first, so the long red path survives.', url: 'https://reddit.com/r/askscience/1', accessed_at: '2026-07-24T00:00', hash: 'demo0000rd', stats: { votes: 2100, comments: 148 } },
  { type: 'news', id: 'spec-wsj', publisher: 'The Wall Street Journal', section: 'Markets', title: 'Widget Systems Rally as Evidence Cards Go Platform-Native', summary: 'Investors cheer a design system in which every source wears its own masthead.', url: 'https://www.wsj.com/articles/demo', accessed_at: '2026-07-24T00:00', hash: 'demo0000wsj' },
  { type: 'news', id: 'spec-bloom', publisher: 'Bloomberg', title: 'Design Tokens Hit Record High on Profile-Flip Volume', summary: 'One POST re-skins the entire market.', url: 'https://www.bloomberg.com/news/articles/demo', accessed_at: '2026-07-24T00:00', hash: 'demo0000bb' },
  { type: 'statement', id: 'spec-st', publisher: 'Example Corp', title: 'Security incident disclosure', quote: 'driven end to end by an autonomous system', url: 'https://example.com/blog/disclosure', accessed_at: '2026-07-24T00:00', hash: 'demo0000st' },
  { type: 'hackernews', id: 'spec-hn', title: 'Show HN: Evidence cards that look exactly like their platform', author: 'pg', url: 'https://news.ycombinator.com/item?id=1', accessed_at: '2026-07-24T00:00', hash: 'demo0000hn', stats: { points: 512, comments: 214 } },
  { type: 'youtube', id: 'spec-yt', channel: 'Veritasium', title: 'The Most Misunderstood Concept in Design', url: 'https://youtube.com/watch?v=demo', accessed_at: '2026-07-24T00:00', hash: 'demo0000yt', stats: { views: 4200000 }, duration: '18:42' },
  { type: 'instagram', id: 'spec-ig', author: 'natgeo', quote: 'A snow leopard pauses at 5,200 meters.', url: 'https://instagram.com/p/demo', accessed_at: '2026-07-24T00:00', hash: 'demo0000ig', stats: { likes: 890000 } },
  { type: 'pubmed', id: 'spec-pm', title: 'Effects of typographic measure on reading comprehension: a randomized trial', author: 'Tinker MA, Paterson DG', publisher: 'J Appl Psychol', external_id: '20026026', summary: 'Line lengths of 45–90 characters produced the highest comprehension scores.', url: 'https://pubmed.ncbi.nlm.nih.gov/demo', accessed_at: '2026-07-24T00:00', hash: 'demo0000pm', tag: 'RCT' },
  { type: 'wikipedia', id: 'spec-wk', title: 'Simurgh', summary: 'The simurgh is a benevolent bird in Persian mythology and literature, sometimes equated with other mythological birds.', url: 'https://en.wikipedia.org/wiki/Simurgh', accessed_at: '2026-07-24T00:00', hash: 'demo0000wk' },
  { type: 'dictionary', id: 'spec-dx', publisher: 'Dehkhoda Loghatnāmeh', headword: 'مرغ', translit: 'morgh', pos: 'noun', quote: 'bird; fowl; (mod.) chicken — the load-bearing word of the Persian sky', url: 'https://dehkhoda.ut.ac.ir/', accessed_at: '2026-07-24T00:00', hash: 'demo0000dx' },
  { type: 'book', id: 'spec-bk', title: 'Manṭiq al-Ṭayr', author: 'ʿAṭṭār of Nishapur', year: 'c. 1177', quote: 'Thirty birds crossed seven valleys to find the Simorgh, and found themselves.', url: 'https://en.wikipedia.org/wiki/The_Conference_of_the_Birds', accessed_at: '2026-07-24T00:00', hash: 'demo0000bk' },
  { type: 'encyclopedia', id: 'spec-en', publisher: 'ENCYCLOPÆDIA IRANICA', title: 'SĪMORḠ', summary: 'A fabulous bird of Iranian legend, nesting in the Tree of All Seeds.', url: 'https://www.iranicaonline.org/articles/simorg', accessed_at: '2026-07-24T00:00', hash: 'demo0000en' },
  { type: 'github', id: 'spec-gh', repo: 'anthropics/claude-code', title: 'feat: platform-native evidence widgets', summary: 'One card per platform, pixel-faithful.', url: 'https://github.com/anthropics/claude-code', accessed_at: '2026-07-24T00:00', hash: 'demo0000gh', lang: 'JavaScript', stats: { stars: 21000, forks: 900 } },
  { type: 'model', id: 'spec-md-claude', model: 'Claude Opus 5', surface: 'Claude Code', object: 'image:I-9921', passes: 1, quote: 'Two faces in frame. Neither matches the reference set. No match returned, no downstream message sent.', verdict: 'No match · did not act', url: '#', accessed_at: '2026-07-27T00:00', hash: 'demo000mdc' },
  { type: 'model', id: 'spec-md-gpt', model: 'GPT-5.6', surface: 'web app', object: 'image:I-9921', passes: 2, quote: 'Second pass on the same object. One face matches at low confidence; flagged for human review rather than resolved.', verdict: 'Low-confidence match · escalated', url: '#', accessed_at: '2026-07-27T00:00', hash: 'demo000mdg' },
  { type: 'anecdotal', id: 'spec-im', author: 'Field report', quote: 'It finally looks exactly like the platform it came from.', url: '#', accessed_at: '2026-07-24T00:00', hash: 'demo0000im' },
];

// ───────────────────────────── Self-contained card CSS ─────────────────────────────
// Platform interiors hardcode their platform's real identity (the mimicry law). The deck,
// rail, and footer strip around them stay on the site's ds tokens.
export function platformRailCss() {
  return `
.rp-card{--rp-sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  flex:0 0 auto;width:min(100%,540px);max-width:100%;background:#fff;border:1px solid #e6e6e6;border-radius:16px;
  box-shadow:0 1px 3px rgba(0,0,0,.05),0 8px 28px -14px rgba(0,0,0,.12);position:relative;overflow:hidden;
  display:flex;flex-direction:column;text-align:left;transition:box-shadow .2s,transform .2s}
.rp-card:hover{box-shadow:0 2px 6px rgba(0,0,0,.06),0 16px 40px -16px rgba(0,0,0,.18);transform:translateY(-2px)}
.rp-card a.rp-body{color:inherit;text-decoration:none;display:block;flex:1 1 auto}
.rp-card a.rp-body:hover{text-decoration:none}
.rp-foot{padding:8px 16px;border-top:1px solid var(--ds-line,#eee);font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#5b6470;background:var(--ds-surface,#fafafa);display:flex;justify-content:space-between;align-items:center;gap:8px}
.rp-foot a{color:#5b6470;text-decoration:underline}
.rp-time,.rp-hash{white-space:nowrap}
.rp-tier{display:inline-block;font:700 9px/1.5 var(--rp-sans);text-transform:uppercase;letter-spacing:.04em;padding:1px 6px;border-radius:4px;margin-right:6px}
.tier-preclinical{background:#e8f0f8;color:#20558a}.tier-anecdotal{background:#fff3e0;color:#c44500}
.tier-review{background:#e8f5e9;color:#2e7d32}.tier-clinical{background:#f3e5f5;color:#7b1fa2}.tier-news{background:#fce4ec;color:#c2185b}
/* X — embedded tweet */
.rp-x{border-color:#eff3f4}
.rp-x .rp-body{padding:16px 16px 12px;font-family:var(--rp-sans)}
.rp-x-brand{position:absolute;top:14px;right:16px;line-height:0}
.rp-x-hdr{display:flex;gap:10px;align-items:center;margin-bottom:10px;padding-right:34px}
.rp-x-av{width:48px;height:48px;border-radius:50%;color:#fff;font:700 19px/48px var(--rp-sans);text-align:center;flex:none}
.rp-x-who{display:flex;flex-direction:column;min-width:0}
.rp-x-name{font:700 15px/1.25 var(--rp-sans);color:#0f1419;display:flex;align-items:center;gap:2px}
.rp-x-handle{font:400 15px/1.25 var(--rp-sans);color:#4c5b67}
.rp-x-text{font:400 17px/1.35 var(--rp-sans);color:#0f1419;white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 10px}
.rp-x-when{font:400 15px/1.3 var(--rp-sans);color:#536471;padding-bottom:10px;border-bottom:1px solid #eff3f4}
.rp-x-actions{display:flex;justify-content:space-between;max-width:380px;padding:10px 4px 2px;color:#536471}
.rp-x-act{display:inline-flex;align-items:center;gap:6px;font:400 13px var(--rp-sans)}
.rp-x-act b{font-weight:400}
/* Reddit */
.rp-rd{border-color:#e4e6e8}
.rp-rd .rp-body{padding:12px 16px 14px;font-family:var(--rp-sans)}
.rp-rdtop{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.rp-rdsub{font:700 13px var(--rp-sans);color:#1c1c1c}
.rp-rdby{font:400 12px var(--rp-sans);color:#576f76}
.rp-rdflair{display:inline-block;background:#e8f4fd;color:#0071c4;font:700 10px/1.6 var(--rp-sans);padding:1px 6px;border-radius:10px;margin-left:6px;text-transform:uppercase}
.rp-rdtitle{font:600 17px/1.3 var(--rp-sans);color:#181c1f;margin-bottom:6px}
.rp-rdbody{font:400 14px/1.5 var(--rp-sans);color:#333d42;margin-bottom:12px}
/* Plain-language gloss. A card showing only a title and a domain is opaque.
   Every card says what the source shows, in plain words, under the quote it is glossing. */
.rp-gloss{font:400 13px/1.55 var(--rp-sans);color:#5b6470;margin:10px 0 2px;padding-left:10px;border-left:2px solid var(--ds-line,#e3e6e8)}
.rp-gloss-k{display:block;font:600 10px/1 var(--rp-sans);letter-spacing:.08em;text-transform:uppercase;color:#5b6470;margin-bottom:4px}
.rp-fallback-quote,.rp-medquote{font:400 15px/1.6 var(--rp-serif,Georgia,serif);color:#1a1a1a;margin:10px 0;padding-left:12px;border-left:3px solid var(--ds-accent,#c8402c)}
/* A CARD QUOTE IS NOT A PULL-QUOTE. quoteBlock emits a <blockquote>, and the
   article prose rule .content blockquote sets italic display type at clamp(21px,2.2vw,26px) — one
   more class of specificity than the card rules had, so every card quote rendered bigger than the
   card's own title and in the wrong face. These selectors carry two classes so the card always
   wins inside prose, and the quote sits below the title in size and stays upright. */
.rp-card blockquote.rp-quote,.rp-card blockquote.rp-fallback-quote,.rp-card blockquote.rp-medquote,
.rp-card blockquote.rp-news-quote,.rp-card blockquote.rp-ax-quote,.rp-card blockquote.rp-rcpt-quote,
.rp-card blockquote.rp-yt-quote,
.rp-card .rp-st-quote,.rp-card .rp-bk-quote,.rp-card .rp-hn-quote{
  font:400 15px/1.6 var(--rp-sans)!important;font-style:normal!important;color:#1a1a1a;
  margin:10px 0;padding:0 0 0 12px;border-left:3px solid var(--ds-line,#e3e6e8);max-width:none}
.rp-card blockquote.rp-yt-quote{margin:10px 14px}
/* NO OS-dark block here, and none anywhere else in widget CSS — enforced by
   scripts/check-widget-contrast.mjs. A card's surface is fixed light; it does not follow the
   viewer's operating system. This block did: it set every quote to #e6e9ec while the card
   stayed white, so on a dark-mode Mac the verbatim quote — the entire payload of an evidence
   card — rendered at 1.21:1 and was invisible. The identical defect was repaired forty lines
   below on 2026-07-30 with a comment claiming that was the only such block. It was not.
   Card ink is derived from the card's own surface, always. */
.rp-rdbar{display:flex;gap:8px}
.rp-rdpill{display:inline-flex;align-items:center;gap:4px;background:#eaedef;border-radius:999px;padding:6px 12px;font:600 12px var(--rp-sans);color:#333d42}
/* Hacker News */
.rp-hn{background:#f6f6ef;border-color:#e0e0d1}
.rp-hn .rp-body{font-family:Verdana,Geneva,sans-serif;padding:0 0 12px}
.rp-hn-bar{display:flex;align-items:center;gap:6px;background:#ff6600;padding:5px 10px;margin-bottom:10px}
.rp-hn-y{width:18px;height:18px;border:1px solid #fff;color:#fff;font:700 12px/16px Verdana;text-align:center;flex:none}
.rp-hn-bar b{font:700 12px Verdana;color:#000}
.rp-hn-new{font:400 10px Verdana;color:#000;opacity:.65;margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rp-hn-item{padding:0 12px;display:flex;gap:5px;align-items:baseline}
.rp-hn-rank{font:400 13px Verdana;color:#707070}
.rp-hn-vote{color:#707070;font-size:10px}
.rp-hn-title{font:400 13.5px/1.35 Verdana;color:#000}
.rp-hn-host{font-size:11px;color:#707070}
.rp-hn-meta{padding:3px 12px 0 30px;font:400 10.5px Verdana;color:#707070}
.rp-hn-quote{margin:10px 12px 0 30px;padding:8px 10px;border-left:2px solid #d5d5c5;font:400 12px/1.5 Verdana;color:#333}
.rp-hn-cby{display:block;margin-top:4px;color:#707070}
/* News mastheads */
.rp-news .rp-body{padding:18px 20px 14px;font-family:Georgia,'Times New Roman',serif}
.rp-news-mast{font:700 15px/1.2 Georgia,serif;letter-spacing:.02em;color:#e2e2e2;padding-bottom:8px;border-bottom:1px solid #111;margin-bottom:12px}
.rp-news-double{border-bottom:3px double #111}
.rp-news-sec{font:700 10px/1 var(--rp-sans);letter-spacing:.14em;text-transform:uppercase;color:#767676;margin-bottom:8px}
.rp-news-headline{font:700 20px/1.22 Georgia,serif;color:#111;margin-bottom:8px}
.rp-news-dek{font:400 14.5px/1.5 Georgia,serif;color:#555;margin-bottom:12px}
.rp-news-byline{font:400 11px/1 var(--rp-sans);letter-spacing:.05em;text-transform:uppercase;color:#767676}
/* The source's own words. Same treatment as every other quote on the site: serif, accent rule,
   full ink weight — because the quotation is the evidence and our dek is only the caption. */
.rp-news-quote,.rp-ax-quote,.rp-rcpt-quote{font:400 15px/1.6 var(--rp-serif,Georgia,serif);color:#1a1a1a;margin:10px 0;padding-left:12px;border-left:3px solid var(--ds-accent,#c8402c)}
.nb-wsj .rp-news-mast{text-align:center;font:700 13px/1.3 Georgia,serif;letter-spacing:.06em}
.nb-nyt .rp-news-mast{text-align:center;font:900 17px/1.2 Georgia,serif;font-style:italic;letter-spacing:0}
.nb-bloomberg{background:#000;border-color:#000}
.nb-bloomberg .rp-news-mast{color:#fff;border-bottom-color:#333;font:800 16px/1.2 var(--rp-sans);letter-spacing:-.01em}
.nb-bloomberg .rp-news-sec{color:#999}
.nb-bloomberg .rp-news-headline{color:#fff;font:700 20px/1.25 var(--rp-sans)}
.nb-bloomberg .rp-news-dek{color:#aaa;font:400 14px/1.5 var(--rp-sans)}
.nb-bloomberg .rp-news-byline{color:#777}
.nb-fortune .rp-news-mast{color:#fadbdc;font:900 16px/1.2 Georgia,serif;letter-spacing:.2em;border-bottom-color:#fadbdc}
.nb-cnbc .rp-news-mast{color:#d6e4ee;font:800 16px/1.2 var(--rp-sans);letter-spacing:.04em;border-bottom-color:#d6e4ee}
.nb-cnbc .rp-news-headline{font:700 19px/1.28 var(--rp-sans)}
.nb-cnbc .rp-news-dek{font:400 14px/1.5 var(--rp-sans)}
.nb-npr .rp-news-mast{font:900 17px/1.2 var(--rp-sans);letter-spacing:.02em;color:#e2e2e2;border-bottom-color:#e31c23}
.nb-npr .rp-news-headline{font:700 19px/1.3 var(--rp-sans)}
.nb-npr .rp-news-dek{font:400 14px/1.55 var(--rp-sans)}
.nb-cnn .rp-news-mast{color:#fff;background:#cc0000;display:inline-block;padding:4px 10px;border-bottom:0;font:900 14px/1 var(--rp-sans);letter-spacing:.02em;margin-bottom:14px}
.nb-cnn .rp-news-headline{font:700 19px/1.28 var(--rp-sans)}
.nb-cnn .rp-news-dek{font:400 14px/1.5 var(--rp-sans)}
.nb-forbes .rp-news-mast{font:700 18px/1.2 Georgia,serif;letter-spacing:.01em;border-bottom-color:#333}
.nb-aj .rp-news-mast{color:#ede1c2;font:700 13px/1.3 Georgia,serif;letter-spacing:.28em;border-bottom-color:#ede1c2}
.nb-sciam .rp-news-mast{color:#dee4e9;font:800 12px/1.3 var(--rp-sans);letter-spacing:.18em;border-bottom-color:#dee4e9}
.nb-wired .rp-news-mast{font:900 15px/1.2 var(--rp-sans);letter-spacing:.4em;border-bottom-color:#000}
.nb-verge .rp-news-mast{font:900 14px/1.2 var(--rp-sans);letter-spacing:.1em;color:#e9deff;border-bottom-color:#e9deff}
.nb-guardian .rp-news-mast{color:#dfe3eb;font:900 16px/1.2 Georgia,serif;font-style:italic;border-bottom-color:#dfe3eb}
.nb-reuters .rp-news-mast{color:#fedbc4;font:800 13px/1.2 var(--rp-sans);letter-spacing:.22em;border-bottom-color:#fedbc4}
/* Official statement / disclosure — letterhead */
.rp-st{border-color:#dcdcdc;background:#fffefb}
.rp-st .rp-body{padding:18px 20px 14px;font-family:var(--rp-sans)}
.rp-st-head{display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:2px solid #16181c;margin-bottom:12px}
.rp-st-ico{width:28px;height:28px;border-radius:6px;object-fit:contain}
.rp-st-org{font:800 15px/1.2 var(--rp-sans);color:#16181c;letter-spacing:-.01em}
.rp-st-kind{font:700 9.5px/1.4 var(--rp-sans);letter-spacing:.14em;text-transform:uppercase;color:#8a6d1f}
.rp-st-title{font:700 17px/1.3 Georgia,serif;color:#16181c;margin-bottom:8px}
.rp-st-quote{font:italic 400 16px/1.45 Georgia,serif;color:#333;padding-left:14px;border-left:3px solid #d8c98a;margin:10px 0}
.rp-st-sum{font:400 14px/1.5 var(--rp-sans);color:#555;margin:8px 0}
.rp-st-when{font:400 11px/1 var(--rp-sans);letter-spacing:.04em;color:#767676;margin-top:10px}
/* Public invocation receipt — green rule when the result was observed, amber when only the attempt was */
.rp-rcpt{border-color:#d7ddd7;background:#fbfdfb}
.rp-rcpt .rp-body{padding:18px 20px 14px;font-family:var(--rp-sans)}
.rp-rcpt-head{display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:2px solid #2f6b46;margin-bottom:12px}
.rp-rcpt[data-material="0"] .rp-rcpt-head{border-bottom-color:#9a7a22}
.rp-rcpt-mark{font-size:20px;line-height:1;color:#2f6b46}
.rp-rcpt[data-material="0"] .rp-rcpt-mark{color:#8e701f}
.rp-rcpt-org{font:800 15px/1.2 var(--rp-sans);color:#16181c;letter-spacing:-.01em}
.rp-rcpt-kind{font:700 9.5px/1.4 var(--rp-sans);letter-spacing:.14em;text-transform:uppercase;color:#2f6b46}
.rp-rcpt[data-material="0"] .rp-rcpt-kind{color:#8e701f}
.rp-rcpt-cap{font:700 12px/1.3 var(--rp-mono,ui-monospace,monospace);color:#2f6b46;letter-spacing:.04em;margin-bottom:6px}
.rp-rcpt[data-material="0"] .rp-rcpt-cap{color:#8e701f}
.rp-rcpt-title{font:700 16px/1.32 Georgia,serif;color:#16181c;margin-bottom:6px}
.rp-rcpt-sum{font:400 14px/1.5 var(--rp-sans);color:#555;margin:6px 0}
.rp-rcpt-when{font:400 11px/1.5 var(--rp-sans);letter-spacing:.03em;color:#757575;margin-top:10px}
.rp-rcpt-when code{font:600 11px var(--rp-mono,ui-monospace,monospace);color:#555}
/* Live surface — an endpoint that answers on request */
.rp-live{border-color:#d5dde6;background:#fbfdff}
.rp-live .rp-body{padding:18px 20px 14px;font-family:var(--rp-sans)}
.rp-live-head{display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:2px solid #2b5d86;margin-bottom:12px}
.rp-live-dot{width:10px;height:10px;border-radius:50%;background:#2b8a5a;box-shadow:0 0 0 3px rgba(43,138,90,.18);flex:none}
.rp-live-org{font:800 15px/1.2 var(--rp-sans);color:#16181c;letter-spacing:-.01em}
.rp-live-kind{font:700 10px/1.4 var(--rp-sans);letter-spacing:.1em;text-transform:uppercase;color:#2b5d86}
.rp-live-kind code{font:700 11px var(--rp-mono,ui-monospace,monospace);letter-spacing:0;text-transform:none;color:#2b5d86}
.rp-live-title{font:700 16px/1.32 Georgia,serif;color:#16181c;margin-bottom:6px}
.rp-live-sum{font:400 14px/1.5 var(--rp-sans);color:#555;margin:6px 0}
.rp-live-quote{font:italic 400 15px/1.45 Georgia,serif;color:#333;padding-left:14px;border-left:3px solid #a8c6de;margin:10px 0}
.rp-live-when{font:400 11px/1 var(--rp-sans);letter-spacing:.04em;color:#757575;margin-top:10px}
/* Dictionary entry */
.rp-dx{background:#fdfcf6;border-color:#e8e2ce}
.rp-dx .rp-body{padding:18px 20px 16px;font-family:Georgia,serif}
.rp-dx-mast{font:700 10px/1 var(--rp-sans);letter-spacing:.18em;text-transform:uppercase;color:#8a6d1f;padding-bottom:10px;border-bottom:1px solid #e8e2ce;margin-bottom:14px}
.rp-dx-head{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.rp-dx-word{font:700 44px/1.1 Georgia,serif;color:#1c1b17}
.rp-dx-tr{font:italic 400 18px/1 Georgia,serif;color:#666}
.rp-dx-pos{font:italic 400 13px/1 Georgia,serif;color:#8a6d1f;margin:8px 0 6px}
.rp-dx-senses{margin:0;padding-left:22px;font:400 15px/1.55 Georgia,serif;color:#333}
/* Book / primary text */
.rp-bk .rp-body{padding:18px 20px 16px;font-family:Georgia,serif}
.rp-bk-row{display:flex;gap:16px;align-items:stretch;margin-bottom:6px}
.rp-bk-cover{flex:none;width:96px;min-height:132px;border-radius:3px 8px 8px 3px;box-shadow:inset 6px 0 8px -6px rgba(0,0,0,.55),0 4px 10px -4px rgba(0,0,0,.4);color:#757575;display:flex;flex-direction:column;justify-content:center;gap:8px;padding:12px 10px;text-align:center}
.rp-bk-cover span{font:700 12px/1.3 Georgia,serif}
.rp-bk-cover em{font:italic 400 10px/1.3 Georgia,serif;opacity:.85}
.rp-bk-meta{display:flex;flex-direction:column;justify-content:center;min-width:0}
.rp-bk-kind{font:700 9.5px/1 var(--rp-sans);letter-spacing:.16em;text-transform:uppercase;color:#8a6d1f;margin-bottom:8px}
.rp-bk-title{font:700 19px/1.25 Georgia,serif;color:#1c1b17;margin-bottom:6px}
.rp-bk-auth{font:400 13px/1.4 var(--rp-sans);color:#666}
.rp-bk-quote{font:italic 400 15.5px/1.5 Georgia,serif;color:#333;margin-top:10px;padding-left:14px;border-left:3px solid #d8c98a}
.rp-bk-sum{font:400 14px/1.5 var(--rp-sans);color:#555;margin-top:10px}
/* Encyclopedia */
.rp-en{background:#fffef9;border-color:#e3ddc9}
.rp-en .rp-body{padding:18px 20px 14px;font-family:Georgia,serif}
.rp-en-mast{text-align:center;font:700 12px/1.3 Georgia,serif;letter-spacing:.22em;color:#1c1b17;padding-bottom:10px;border-bottom:3px double #1c1b17;margin-bottom:14px}
.rp-en-entry{font:700 22px/1.2 Georgia,serif;letter-spacing:.04em;color:#1c1b17;margin-bottom:8px}
.rp-en-body{font:400 14.5px/1.55 Georgia,serif;color:#333;margin-bottom:10px}
.rp-en-note{font:italic 400 11px/1 Georgia,serif;color:#757575}
/* Wikipedia */
.rp-wk{border-color:#a2a9b1;border-radius:4px}
.rp-wk .rp-body{padding:16px 20px 14px;font-family:sans-serif}
.rp-wk-mast{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.rp-wk-w{font:900 26px/1 Georgia,serif;color:#000}
.rp-wk-mast span:last-child{display:flex;flex-direction:column;font:400 13px/1.1 Georgia,serif;letter-spacing:.08em}
.rp-wk-mast small{font:italic 400 8.5px/1.4 Georgia,serif;letter-spacing:0;color:#54595d}
.rp-wk-title{font:400 22px/1.25 Georgia,'Linux Libertine',serif;color:#202122;border-bottom:1px solid #a2a9b1;padding-bottom:5px;margin-bottom:6px}
.rp-wk-from{font:400 11px/1.4 sans-serif;color:#54595d;margin-bottom:8px}
.rp-wk-body{font:400 14px/1.6 sans-serif;color:#202122}
/* iMessage */
.rp-im{border-radius:22px;border-color:#e5e5ea}
.rp-im .rp-body{font-family:var(--rp-sans)}
.rp-imtop{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #e5e5ea;background:#f9f9f9}
.rp-imback{color:#0071ed;font-size:24px;line-height:1}
.rp-imnavav{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#8e8e93,#636366);color:#fff;font:700 13px/32px var(--rp-sans);text-align:center}
.rp-imname{font:600 14px var(--rp-sans);color:#000}
.rp-imchat{padding:16px 12px;background:#fff;display:flex;flex-direction:column;gap:6px;min-height:120px}
.rp-imrow{display:flex}
.rp-im-them{justify-content:flex-start}
.rp-im-me{justify-content:flex-end}
.rp-imbubble{max-width:82%;padding:8px 13px;border-radius:18px;font:400 15px/1.35 var(--rp-sans)}
.rp-im-them .rp-imbubble{background:#e9e9eb;color:#000;border-bottom-left-radius:5px}
.rp-im-me .rp-imbubble{background:#0974e0;color:#ffffff;border-bottom-right-radius:5px}
/* WhatsApp */
.rp-wa{border-radius:12px;border-color:#d1d7db}
.rp-wa .rp-body{font-family:var(--rp-sans)}
.rp-wabar{background:#008069;color:#fff;padding:10px 12px;display:flex;align-items:center;gap:10px}
.rp-waav{width:36px;height:36px;border-radius:50%;background:#0b3d36;font:700 14px/36px var(--rp-sans);text-align:center}
.rp-wagrp{font:600 15px var(--rp-sans)}
.rp-wasub{font:400 11px var(--rp-sans);opacity:.8}
.rp-wamsgs{background:#efeae2;padding:14px 10px;display:flex;flex-direction:column;gap:5px;min-height:140px}
.rp-wasys{align-self:center;background:#fffde7;font:400 10.5px var(--rp-sans);color:#54656f;padding:4px 10px;border-radius:6px;margin-bottom:4px;box-shadow:0 1px 1px rgba(0,0,0,.06)}
.rp-wamsg{max-width:85%;padding:6px 9px 5px;border-radius:8px;font:400 14px/1.4 var(--rp-sans);position:relative;box-shadow:0 1px 1px rgba(0,0,0,.08)}
.rp-wa-in{background:#fff;color:#111b21;align-self:flex-start;border-top-left-radius:0}
.rp-wa-out{background:#d9fdd3;color:#111b21;align-self:flex-end;border-top-right-radius:0}
.rp-wasender{font:600 12.5px var(--rp-sans);color:#cc3b91;margin-bottom:1px}
.rp-watime{font-size:10px;color:#667781;text-align:right;margin-top:2px}
/* PubMed */
.rp-med .rp-body{padding:16px 18px 14px;font-family:var(--rp-sans)}
.rp-medlogo{display:flex;align-items:baseline;margin-bottom:10px}
.rp-medmark{font:400 20px/1 Georgia,serif;color:#14315c}
.rp-medmark b{font-weight:700}
.rp-medgov{font:400 13px/1 Georgia,serif;color:#14315c;opacity:.7}
.rp-medtag{display:inline-block;background:#e8f0f8;color:#20558a;font:700 10px/1.6 var(--rp-sans);letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:3px;margin-bottom:8px}
.rp-medtitle{font:700 16px/1.35 var(--rp-sans);color:#212529;margin-bottom:8px}
.rp-medabs{font:400 13.5px/1.5 var(--rp-sans);color:#555;margin-bottom:10px}
.rp-medmeta{font:400 12px/1.5 var(--rp-sans);color:#666}
.rp-medmeta strong{color:#212529}
/* YouTube */
.rp-yt{border-color:#e5e5e5}
.rp-yt .rp-body{font-family:Roboto,var(--rp-sans);padding-bottom:6px}
.rp-ytthumb{aspect-ratio:16/9;background:linear-gradient(135deg,#181818,#3d3d3d 70%,#232323);position:relative;display:flex;align-items:center;justify-content:center}
.rp-ytplay{width:68px;height:48px;border-radius:12px;background:#f00;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.4)}
.rp-ytplay span{display:block;border:10px solid transparent;border-left:17px solid #fff;margin-left:8px}
.rp-ytdur{position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.8);color:#fff;font:500 12px/1 Roboto,var(--rp-sans);padding:3px 5px;border-radius:4px}
.rp-ytrow{display:flex;gap:12px;padding:12px 14px 8px}
.rp-ytav{width:36px;height:36px;border-radius:50%;color:#757575;font:700 15px/36px var(--rp-sans);text-align:center;flex:none}
.rp-yttitle{font:500 15px/1.35 Roboto,var(--rp-sans);color:#0f0f0f;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rp-ytmeta{font:400 12.5px/1.4 Roboto,var(--rp-sans);color:#606060}
.rp-yt-quote{margin:10px 14px}
.rp-yt-sum{font:400 13px/1.5 Roboto,var(--rp-sans);color:#606060;margin:0 14px 10px}
/* GitHub */
.rp-gh{background:#0d1117;border-color:#30363d}
.rp-gh .rp-body{padding:16px;font-family:var(--rp-sans)}
.rp-gh-top{display:flex;align-items:center;gap:8px;font:400 14px var(--rp-sans);color:#58a6ff;margin-bottom:8px}
.rp-gh-top span:last-child{color:#8b949e}
.rp-gh-title{font:600 16px/1.35 var(--rp-sans);color:#f0f6fc;margin-bottom:8px}
.rp-gh-body{font:400 13.5px/1.5 var(--rp-sans);color:#979fa8;margin-bottom:12px}
.rp-gh-meta{display:flex;gap:14px;font:400 12px var(--rp-sans);color:#8b949e}
.rp-gh-lang i{display:inline-block;width:10px;height:10px;border-radius:50%;background:#f1e05a;margin-right:4px}
/* Stack Overflow */
.rp-so .rp-body{padding:16px;display:flex;gap:14px;font-family:var(--rp-sans)}
.rp-so-stats{display:flex;flex-direction:column;gap:8px;flex:none}
.rp-so-stat{border:1px solid #9fa6ad;border-radius:4px;padding:6px 8px;text-align:center;font:600 14px var(--rp-sans);color:#3b4045;display:flex;flex-direction:column}
.rp-so-stat small{font:400 10px var(--rp-sans);color:#6a737c}
.rp-so-acc{background:#428258;border-color:#5eba7d;color:#ffffff}
.rp-so-acc small{color:#ffffff}
.rp-so-title{font:400 16px/1.35 var(--rp-sans);color:#005a9f;margin-bottom:6px}
.rp-so-body{font:400 13px/1.5 var(--rp-sans);color:#3b4045;margin-bottom:8px}
.rp-so-tags{display:flex;gap:5px;flex-wrap:wrap}
.rp-so-tag{background:#e1ecf4;color:#376e97;font:400 11.5px var(--rp-sans);padding:3px 7px;border-radius:4px}
/* arXiv */
.rp-ax .rp-body{padding:16px 18px 14px;font-family:Georgia,serif}
.rp-ax-mast{font:700 16px/1 var(--rp-sans);color:#b31b1b}
.rp-ax-id{font:400 12px/1 ui-monospace,monospace;color:#666;margin-left:8px}
.rp-ax-title{font:700 16px/1.35 Georgia,serif;color:#111;margin:10px 0 8px}
.rp-ax-abs{font:400 13.5px/1.5 Georgia,serif;color:#444;margin-bottom:8px}
.rp-ax-auth{font:italic 400 12.5px/1.4 Georgia,serif;color:#666}
/* Discord */
.rp-dc{background:#313338;border-color:#232428}
.rp-dc .rp-body{padding:16px;display:flex;gap:12px;font-family:var(--rp-sans)}
.rp-dc-av{width:40px;height:40px;border-radius:50%;color:#fff;font:700 16px/40px var(--rp-sans);text-align:center;flex:none}
.rp-dc-name{font:600 15px var(--rp-sans);color:#f2f3f5;margin-right:8px}
.rp-dc-time{font:400 11px var(--rp-sans);color:#949ba4}
.rp-dc-text{font:400 14.5px/1.45 var(--rp-sans);color:#dbdee1;margin-top:3px}
.rp-dc-chan{font:400 12px var(--rp-sans);color:#949ba4;margin-top:6px}
/* Instagram */
.rp-ig{border-color:#dbdbdb;border-radius:8px}
.rp-ig .rp-body{font-family:var(--rp-sans)}
.rp-igtop{display:flex;align-items:center;gap:9px;padding:11px 12px}
.rp-igring{width:34px;height:34px;border-radius:50%;padding:2px;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);flex:none}
.rp-igring div{width:100%;height:100%;border-radius:50%;background:#fff;color:#262626;font:700 13px/26px var(--rp-sans);text-align:center;border:2px solid #fff}
.rp-iguser{font:600 13px var(--rp-sans);color:#262626;flex:1}
.rp-igdots{color:#262626;font-weight:700;letter-spacing:1px}
.rp-igmedia{aspect-ratio:1/1;background:linear-gradient(160deg,color-mix(in srgb,var(--ig-a,#833ab4) 70%,#000) 0%,#0a0a12 60%,color-mix(in srgb,var(--ig-a,#833ab4) 40%,#000) 100%);display:flex;align-items:center;justify-content:center}
.rp-igplay{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.25);border:2px solid #fff;position:relative}
.rp-igplay::after{content:'';position:absolute;left:55%;top:50%;transform:translate(-50%,-50%);border:11px solid transparent;border-left:18px solid #fff}
.rp-igacts{display:flex;gap:14px;padding:10px 12px 6px;font-size:20px;color:#262626}
.rp-igsave{margin-left:auto}
.rp-iglikes{padding:0 12px;font:600 13px var(--rp-sans);color:#262626}
.rp-igcap{padding:4px 12px 12px;font:400 13px/1.45 var(--rp-sans);color:#262626}
.rp-igcap b{font-weight:600}
/* Model answer — vendor chat surfaces */
.rp-md .rp-body{padding:16px 18px 14px;font-family:var(--rp-sans)}
.rp-md-top{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
.rp-md-mark{width:26px;height:26px;border-radius:7px;color:#fff;font:600 14px/26px var(--rp-sans);text-align:center;flex:none;background:#333}
.rp-md-name{font:700 15px/1.2 var(--rp-sans);color:#12100e}
.rp-md-surface{font:600 10px/1.6 var(--rp-sans);text-transform:uppercase;letter-spacing:.06em;padding:2px 7px;border-radius:999px;background:rgba(0,0,0,.06);color:#706d68}
.rp-md-vendor{margin-left:auto;font:600 11px var(--rp-sans);color:#79756d}
.rp-md-object{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:7px 10px;border-radius:8px;background:rgba(0,0,0,.04)}
.rp-md-tenant{font:600 9.5px/1 var(--rp-sans);text-transform:uppercase;letter-spacing:.09em;color:#79756d}
.rp-md-object code{font:500 12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#2b2823;overflow-wrap:anywhere}
.rp-md-passes{margin-left:auto;font:700 11px var(--rp-sans);color:#79756d}
.rp-md-text{font:400 15px/1.55 var(--rp-sans);color:#22201d;white-space:pre-wrap;overflow-wrap:anywhere;margin-bottom:10px}
.rp-md-verdict{font:600 13px/1.45 var(--rp-sans);padding:8px 11px;border-left:3px solid currentColor;border-radius:0 6px 6px 0;background:rgba(0,0,0,.04);margin-bottom:10px}
.rp-md-sig{font:500 11.5px var(--rp-sans);color:#79756d}
.rp-gf{margin:2px 0 12px;border:1px solid #e0dacb;border-radius:9px;background:#faf7f0;overflow:hidden}
.rp-gf-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 11px;background:rgba(0,0,0,.03);border-bottom:1px solid #e6e1d5}
.rp-gf-tag{font:600 9.5px var(--rp-sans);letter-spacing:.06em;text-transform:uppercase;color:#757169}
.rp-gf-verdict{font:800 12px var(--rp-sans);letter-spacing:.03em;padding:2px 9px;border-radius:20px}
.rp-gf-affirm{color:#ffffff;background:#0f8656}
.rp-gf-deny{color:#6a6361;background:rgba(180,60,30,.12)}
.rp-gf-cc{color:#ffffff;background:#94711a}
.rp-gf-rules{font:12px/1.5 var(--rp-sans);color:#3a362f;padding:8px 11px 0}
.rp-gf-rules code{font:600 11.5px var(--rp-mono,ui-monospace,monospace);color:#1e1b16}
.rp-gf-sec{padding:9px 11px;border-top:1px solid #efeade}
.rp-gf-tenant{font:700 9.5px var(--rp-sans);letter-spacing:.05em;text-transform:uppercase;color:#5a554c;margin-bottom:5px}
.rp-gf-txt{font:12.5px/1.6 var(--rp-sans);color:#1e1b16;max-height:210px;overflow:auto}
.rp-gf-list{margin:0;padding-left:16px;font:12.5px/1.6 var(--rp-sans);color:#1e1b16;max-height:210px;overflow:auto}
.rp-gf-list li{margin:2px 0}
.rp-gf-absent{background:rgba(180,60,30,.045)}
.rp-gf-absent .rp-gf-tenant{color:#79706e}
.rp-gf-flip{background:rgba(16,110,70,.045)}
.rp-gf-flip .rp-gf-tenant{color:#68726e}
.rp-gf-decision{padding:9px 11px;border-top:1px solid #efeade;background:rgba(0,0,0,.03)}
.rp-gf-decision code{font:600 12px/1.5 var(--rp-mono,ui-monospace,monospace);color:#73716e;white-space:pre-wrap;word-break:break-word}
/* Legibility: the card sits inside a.rp-body whose color the prose can mute — pin dark text with compound specificity so nothing upstream washes it out. */
.rp-card .rp-gf-txt,.rp-card .rp-gf-list,.rp-card .rp-gf-list li,.rp-card .rp-gf-rules{color:#1e1b16}
.rp-card .rp-gf-tenant{color:#5a554c}
/* No OS-dark override here. The site renders light regardless of prefers-color-scheme, so
   OS-conditional ink always mismatches the surface under it (owner-reported illegibility,
   2026-07-30; recurred 2026-08-05 because a second block survived and a comment was doing the
   enforcing). The rule is now computed by scripts/check-widget-contrast.mjs in the ship chain. */
.rp-em{border:1px solid #d8d2c6;border-radius:10px;overflow:hidden;background:#fbfaf7}
.rp-em-head{padding:14px 20px;border-bottom:1px solid #e6e0d4;background:#f4f1ea;font:12.5px/1.7 var(--rp-sans);color:#1e1b16}
.rp-em-k{color:#77726b;display:inline-block;min-width:52px}
.rp-em-body{padding:20px 24px;font:15px/1.7 Georgia,'Times New Roman',serif;color:#1e1b16}
.rp-em-p{margin:0 0 14px}
.rp-em-more summary{cursor:pointer;font:600 11px var(--rp-sans);letter-spacing:.05em;text-transform:uppercase;color:#77726b;margin-bottom:10px}
.rp-em-more summary:hover{color:#4a463f}
.rp-em-sig{margin:0 24px 16px;padding:12px 16px;border:1px solid #e6e0d4;border-radius:8px;background:#f4f1ea;font:12.5px/1.7 var(--rp-sans);color:#4a463f}
.rp-em-foot{padding:10px 20px;border-top:1px dashed #d8d2c6;font:10.5px var(--rp-mono,ui-monospace,monospace);color:#77726b;display:flex;gap:14px;flex-wrap:wrap}
.rp-em-foot a{color:#5a4634}
.rp-raw{margin:8px 12px 12px;border-top:1px dashed #d8d2c6;padding-top:8px}
.rp-raw summary{cursor:pointer;font:600 10.5px var(--rp-sans);letter-spacing:.05em;text-transform:uppercase;color:#79756d}
.rp-raw summary:hover{color:#4a463f}
.rp-raw-l{font:700 10px var(--rp-sans);letter-spacing:.07em;color:#79756d;margin:10px 0 4px}
.rp-raw-pre{font:11px/1.5 var(--rp-mono,ui-monospace,monospace);white-space:pre-wrap;word-break:break-word;background:rgba(0,0,0,.03);border:1px solid #e6e1d5;border-radius:6px;padding:10px;max-height:340px;overflow:auto;margin:0}
.mb-claude{background:#f7f5ef;border-color:#e6e0d2}
.mb-claude .rp-md-mark{background:#d97757}
.mb-claude .rp-md-verdict{color:#b2552f}
.mb-openai{background:#fff;border-color:#e5e5e5}
.mb-openai .rp-md-mark{background:#10a37f}
.mb-openai .rp-md-verdict{color:#0d8368}
.mb-gemini{background:#f8fbff;border-color:#dbe6f5}
.mb-gemini .rp-md-mark{background:linear-gradient(135deg,#4285f4,#9b72cb)}
.mb-gemini .rp-md-verdict{color:#3367d6}
.mb-grok{background:#0f0f0f;border-color:#262626}
.mb-grok .rp-md-mark{background:#fff;color:#000}
.mb-grok .rp-md-name{color:#fff}.mb-grok .rp-md-text{color:#e6e6e6}
.mb-grok .rp-md-surface{background:rgba(255,255,255,.1);color:#8d8d8d}
.mb-grok .rp-md-object{background:rgba(255,255,255,.06)}.mb-grok .rp-md-object code{color:#7c7c7c}
.mb-grok .rp-md-verdict{color:#6d86b2;background:rgba(255,255,255,.06)}
.mb-kimi{background:#f6f4ff;border-color:#e2dcf7}
.mb-kimi .rp-md-mark{background:#4d3ec7}
.mb-kimi .rp-md-verdict{color:#4d3ec7}
.mb-glm{background:#f3faf9;border-color:#d7ece8}
.mb-glm .rp-md-mark{background:#0e8f7e}
.mb-glm .rp-md-verdict{color:#0d8171}
.mb-llama{background:#f5f8ff;border-color:#dde6fa}
.mb-llama .rp-md-mark{background:#0866ff}
.mb-mistral{background:#fff8f2;border-color:#f6e2cf}
.mb-mistral .rp-md-mark{background:#fa500f}
.mb-generic .rp-md-mark{background:#555}
/* Fallback */
.rp-fallback .rp-body{padding:16px 18px 14px;font-family:var(--rp-sans)}
.rp-fallback-head{display:flex;align-items:center;gap:9px;margin-bottom:10px}
.rp-fallback-ico{width:24px;height:24px;border-radius:5px;object-fit:contain}
.rp-fallback-mark{width:24px;height:24px;border-radius:50%;background:#333;color:#fff;font:700 11px/24px var(--rp-sans);text-align:center}
.rp-fallback-type{font:700 11px/1 var(--rp-sans);letter-spacing:.08em;text-transform:uppercase;color:#767676}
.rp-fallback-title{font:700 16px/1.35 var(--rp-sans);color:#1a1a1a;margin-bottom:6px}
.rp-fallback-sum{font:400 13.5px/1.5 var(--rp-sans);color:#555;margin-bottom:8px}
.rp-fallback-host{font:400 12px var(--rp-sans);color:#767676}
`;
}

/** Instagram-style horizontal swiper: one widget per viewport, swipe or tap arrows. */
export function renderWidgetSwiper(slidesHtml, count, barHtml) {
  const n = Math.max(0, Number(count) || 0);
  if (!n || !slidesHtml) return '';
  const dots = Array.from({ length: n }, (_, i) =>
    `<button type="button" class="rp-sw-dot${i === 0 ? ' active' : ''}" aria-label="Slide ${i + 1}"></button>`
  ).join('');
  return `<div class="rp-swiper" data-count="${n}">` +
    `<div class="rp-sw-nav">` +
    `<button type="button" class="rp-sw-btn rp-sw-prev" aria-label="Previous source">‹</button>` +
    `<span class="rp-sw-counter"><span class="rp-sw-cur">1</span> / ${n}</span>` +
    `<button type="button" class="rp-sw-btn rp-sw-next" aria-label="Next source">›</button>` +
    `</div>` +
    `<div class="rp-swiper-viewport" tabindex="0" role="region" aria-label="Evidence sources, swipe horizontally">` +
    `<div class="rp-swiper-track">${slidesHtml}</div>` +
    `</div>` +
    `<div class="rp-sw-dots">${dots}</div>` +
    `</div>`;
}

export function renderPlatformRail(sources, slug, head) {
  if (!Array.isArray(sources) || !sources.length) return '';
  const slides = sources.map((s) =>
    `<div class="rp-slide">${renderPlatformCard(s, slug)}</div>`
  ).join('');
  const bar = `<div class="ev-bar"><span class="ev-bar-t">Evidence · ${sources.length} sources · swipe →</span>` +
    `<span class="ev-bar-h">chain <code>${esc(String(head || '').slice(0, 12))}</code> · ` +
    `<a href="/api/articles/${esc(slug)}/sources">verify chain</a> · ` +
    `<a href="/api/articles/${esc(slug)}/provenance">provenance</a></span></div>`;
  return `<section class="srcledger rp-ledger" data-widget-swiper>` +
    bar + renderWidgetSwiper(slides, sources.length) +
    `</section>`;
}

// Deck/swiper layout CSS stays theme-aware in functions/a/[slug].js; card interiors above are
// self-contained by law (mimicry exemption).
