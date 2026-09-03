// Platform & publisher logos for inline evidence widgets.

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const LOGOS = {
  reddit: {
    url: 'https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png',
    alt: 'Reddit',
    label: 'Reddit',
    tagline: 'Community report',
    bg: 'linear-gradient(135deg,#ff5714 0%,#ff4500 55%,#d93a00 100%)',
    ring: '#ff4500',
  },
  x: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/X_logo_2023.svg',
    alt: 'X',
    label: 'X',
    tagline: 'Post',
    bg: 'linear-gradient(135deg,#1a1a1a 0%,#000 100%)',
    ring: '#1d9bf0',
  },
  twitter: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/X_logo_2023.svg',
    alt: 'X',
    label: 'X',
    tagline: 'Post',
    bg: 'linear-gradient(135deg,#1a1a1a 0%,#000 100%)',
    ring: '#1d9bf0',
  },
  instagram: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg',
    alt: 'Instagram',
    label: 'Instagram',
    tagline: 'Post',
    bg: 'linear-gradient(135deg,#f58529 0%,#dd2a7b 45%,#8134af 100%)',
    ring: '#e1306c',
  },
  youtube: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg',
    alt: 'YouTube',
    label: 'YouTube',
    tagline: 'Video',
    bg: 'linear-gradient(135deg,#ff3d3d 0%,#cc0000 100%)',
    ring: '#ff0000',
  },
  yt: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg',
    alt: 'YouTube',
    label: 'YouTube',
    tagline: 'Video',
    bg: 'linear-gradient(135deg,#ff3d3d 0%,#cc0000 100%)',
    ring: '#ff0000',
  },
  tiktok: {
    url: 'https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg',
    alt: 'TikTok',
    label: 'TikTok',
    tagline: 'Video',
    bg: 'linear-gradient(135deg,#25f4ee 0%,#000 50%,#fe2c55 100%)',
    ring: '#fe2c55',
  },
  facebook: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg',
    alt: 'Facebook',
    label: 'Facebook',
    tagline: 'Post',
    bg: 'linear-gradient(135deg,#1877f2 0%,#0d5bd8 100%)',
    ring: '#0866ff',
  },
  fb: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg',
    alt: 'Facebook',
    label: 'Facebook',
    tagline: 'Post',
    bg: 'linear-gradient(135deg,#1877f2 0%,#0d5bd8 100%)',
    ring: '#0866ff',
  },
  linkedin: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png',
    alt: 'LinkedIn',
    label: 'LinkedIn',
    tagline: 'Professional post',
    bg: 'linear-gradient(135deg,#0a66c2 0%,#004182 100%)',
    ring: '#0a66c2',
  },
  li: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png',
    alt: 'LinkedIn',
    label: 'LinkedIn',
    tagline: 'Professional post',
    bg: 'linear-gradient(135deg,#0a66c2 0%,#004182 100%)',
    ring: '#0a66c2',
  },
  pubmed: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/fb/US-NLM-PubMed-Logo.svg',
    alt: 'PubMed',
    label: 'PubMed',
    tagline: 'NIH · indexed research',
    bg: 'linear-gradient(135deg,#2b6cb0 0%,#1e4e8c 100%)',
    ring: '#2b6cb0',
  },
  clinical_trial: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/2a/ClinicalTrials.gov_logo.svg',
    alt: 'ClinicalTrials.gov',
    label: 'Clinical Trial',
    tagline: 'Registered trial',
    bg: 'linear-gradient(135deg,#0f766e 0%,#115e59 100%)',
    ring: '#0f766e',
  },
  review: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/f8/NIH_2012_logo.svg',
    alt: 'NIH',
    label: 'Review',
    tagline: 'Synthesized evidence',
    bg: 'linear-gradient(135deg,#20558a 0%,#143d66 100%)',
    ring: '#20558a',
  },
  medical: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Food_and_Drug_Administration_logo.svg',
    alt: 'Medical',
    label: 'Medical',
    tagline: 'Clinical source',
    bg: 'linear-gradient(135deg,#1d4ed8 0%,#1e3a8a 100%)',
    ring: '#1d4ed8',
  },
  nih: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/f8/NIH_2012_logo.svg',
    alt: 'NIH',
    label: 'NIH',
    tagline: 'National Institutes of Health',
    bg: 'linear-gradient(135deg,#20558a 0%,#143d66 100%)',
    ring: '#20558a',
  },
  nature: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Nature_logo.svg',
    alt: 'Nature',
    label: 'Nature',
    tagline: 'Journal',
    bg: 'linear-gradient(135deg,#c41e3a 0%,#8b1530 100%)',
    ring: '#c41e3a',
  },
  sciencedirect: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Elsevier_logo_2019.svg',
    alt: 'ScienceDirect',
    label: 'ScienceDirect',
    tagline: 'Elsevier',
    bg: 'linear-gradient(135deg,#ff6c00 0%,#e85d00 100%)',
    ring: '#ff6c00',
  },
  lancet: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/The_Lancet_logo.svg',
    alt: 'The Lancet',
    label: 'The Lancet',
    tagline: 'Journal',
    bg: 'linear-gradient(135deg,#b91c1c 0%,#7f1d1d 100%)',
    ring: '#b91c1c',
  },
  anecdotal: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Public-speaking.svg',
    alt: 'Anecdote',
    label: 'Anecdote',
    tagline: 'User report',
    bg: 'linear-gradient(135deg,#a16207 0%,#713f12 100%)',
    ring: '#8a6d3b',
  },
  other: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Earth_icon.svg',
    alt: 'Source',
    label: 'Source',
    tagline: 'Web source',
    bg: 'linear-gradient(135deg,#404040 0%,#0a0a0a 100%)',
    ring: '#0a0a0a',
  },
};

const HOST_LOGOS = {
  'pubmed.ncbi.nlm.nih.gov': 'pubmed',
  'ncbi.nlm.nih.gov': 'pubmed',
  'clinicaltrials.gov': 'clinical_trial',
  'sciencedirect.com': 'sciencedirect',
  'nature.com': 'nature',
  'thelancet.com': 'lancet',
  'fda.gov': 'medical',
};

export function logoMeta(type) {
  const key = String(type || 'other').toLowerCase();
  return LOGOS[key] || LOGOS.other;
}

export function logoMetaFromUrl(url, fallbackType) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const mapped = HOST_LOGOS[host];
    if (mapped) return LOGOS[mapped];
  } catch { /* ignore */ }
  return logoMeta(fallbackType);
}

export function platformLogoImg(type, opts = {}) {
  const meta = typeof type === 'object' && type.url ? type : logoMeta(type);
  const cls = opts.className || 'plat-logo';
  const size = Number(opts.size) || 28;
  const pad = opts.pad === true ? ' plat-logo-pad' : '';
  return (
    `<img class="${cls}${pad}" src="${esc(meta.url)}" alt="${esc(meta.alt)}" ` +
    `width="${size}" height="${size}" loading="lazy" decoding="async">`
  );
}

export function brandBar(type, sublabel, opts = {}) {
  const meta = opts.fromUrl ? logoMetaFromUrl(opts.fromUrl, type) : logoMeta(type);
  const label = opts.label || meta.label;
  const sub = sublabel || meta.tagline;
  const size = Number(opts.size) || 34;
  return (
    `<div class="plat-brand" style="--plat-ring:${esc(meta.ring)};--plat-bg:${esc(meta.bg)}">` +
    `<div class="plat-brand-logo">${platformLogoImg(meta, { size, pad: true })}</div>` +
    `<div class="plat-brand-meta">` +
    `<div class="plat-brand-name">${esc(label)}</div>` +
    (sub ? `<div class="plat-brand-sub">${esc(sub)}</div>` : '') +
    `</div>` +
    `</div>`
  );
}

export function platformLogoStyles() {
  return `
.plat-brand{display:flex;align-items:center;gap:12px;margin:-4px -4px 14px;padding:12px 14px;border-radius:12px;background:var(--plat-bg);color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.12)}
.plat-brand-logo{flex:none;width:44px;height:44px;border-radius:11px;background:rgba(255,255,255,.96);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.plat-brand-logo .plat-logo{width:28px;height:28px;object-fit:contain;display:block}
.plat-brand-logo .plat-logo-pad{padding:2px}
.plat-brand-meta{flex:1;min-width:0}
.plat-brand-name{font:800 15px/1.15 ui-sans-serif,system-ui,sans-serif;letter-spacing:-0.01em}
.plat-brand-sub{font:500 12px/1.35 ui-sans-serif,system-ui,sans-serif;opacity:.88;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.plat-logo{object-fit:contain;display:block}
`;
}