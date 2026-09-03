#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const WIDGET_DIR = join(ROOT, 'functions/_lib/widgets');
const PAYLOAD = /(quote|title|body|headline|summary|text|name|repo|org|author|handle|caption|desc)/i;
const FLOOR_PAYLOAD = 7;
const FLOOR_META = 4.5;
// Decorative ink that is never read as prose: separators, icon glyphs, disabled state.
const EXEMPT = /(rp-sep|rp-dot|rp-icon|rp-logo|rp-mark|::(before|after))/i;
// Surfaces painted at render time from a brand colour the CSS never names — avatars, brand
// bars, platform chips, send buttons. Their ink cannot be checked statically because their
// background arrives as an inline style or an unresolvable custom property. Each entry is a
// selector whose surface is supplied by the renderer, not by this stylesheet. Adding one is a
// claim that the renderer paints it; it is not a way to silence a real failure.
const RUNTIME_SURFACE = new Set([
  '.uew-badge',        // background: var(--accent), set per model card
  '.plat-brand',       // background: var(--plat-bg), the platform's own brand colour
  '.rp-x-av',          // avatar circle, background painted inline from the handle
  '.rp-hn-y',          // the orange Y square, background from the platform logo set
  '.rp-hn-site',       // same bar
  '.mb-glyph',         // message-builder glyph over a tinted bubble
  '.cm-skin-whatsapp .cm-close',   // translucent white over the brand header
  '.cm-skin-imessage .cm-av',      // avatar over the brand header
  '.cm-send',          // send button, brand fill
  '.rp-so-stat.rp-so-acc',         // accepted-answer chip, brand fill
  '.cb-copy.done',     // transient success state on a green fill
]);

function srgb(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function lum([r, g, b]) { return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b); }
function ratio(a, b) { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

/** #abc | #aabbcc | rgb(a,b,c) | rgba(a,b,c,α) → [r,g,b], or null when not a flat colour. */
function parseColor(raw) {
  const s = String(raw || '').trim();
  let m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
  m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  // var(--token,#fallback) resolves to the fallback, which is what ships when the token is absent.
  m = s.match(/var\([^,]+,\s*(#[0-9a-f]{3,6})\s*\)/i);
  if (m) return parseColor(m[1]);
  return null;
}

/** First colour-like token in a shorthand value (`400 15px/1.6 Georgia` has none). */
function inkOf(decl) {
  const m = decl.match(/(?:^|[;{]|\s)color\s*:\s*([^;}]+)/i);
  return m ? parseColor(m[1]) : null;
}
/** Alpha of an rgba() value, 1 for anything opaque. */
function alphaOf(raw) {
  const m = String(raw).match(/^rgba\(\s*[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+[\s,/]+([\d.]+)/i);
  return m ? Number(m[1]) : 1;
}
/** Returns [r,g,b] for an opaque background, or {over,alpha} for a translucent one. */
function surfaceOf(decl) {
  const m = decl.match(/(?:^|[;{]|\s)background(?:-color)?\s*:\s*([^;}]+)/i);
  if (!m) return null;
  const v = m[1].trim();
  if (/gradient|url\(|transparent|none/i.test(v)) return null;
  const a = alphaOf(v);
  // A translucent wash — rgba(0,0,0,.02) behind a quote — is not a black surface. Reading it
  // as one turned the darkest possible ink into a 1.11:1 failure against a card that is, in
  // fact, white. Composite it over whatever it sits on instead.
  if (a < 1) {
    const c = parseColor(v);
    return c ? { over: c, alpha: a } : null;
  }
  for (const tok of v.split(/\s+/)) { const c = parseColor(tok); if (c) return c; }
  return parseColor(v);
}
function composite(surface, base) {
  if (!surface) return base;
  if (Array.isArray(surface)) return surface;
  return surface.over.map((v, i) => Math.round(v * surface.alpha + base[i] * (1 - surface.alpha)));
}

function widgetFiles() {
  const out = [];
  for (const entry of readdirSync(WIDGET_DIR)) {
    const p = join(WIDGET_DIR, entry);
    if (statSync(p).isFile() && entry.endsWith('.js')) out.push(p);
  }
  return out;
}

const failures = [];
const audited = [];
const runtime = [];
const unresolved = [];

for (const path of widgetFiles()) {
  const rel = path.replace(ROOT + '/', '');
  const text = readFileSync(path, 'utf8');

  // Rule 1 — no OS-conditional ink on a fixed-light surface. Comments discuss the rule and are
  // not the rule; strip them first so explaining the law cannot violate it.
  const code = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
                   .replace(/(^|[^:])\/\/[^\n]*/g, (m0, p1) => p1 + ' '.repeat(m0.length - p1.length));
  for (const m of code.matchAll(/prefers-color-scheme/gi)) {
    const line = code.slice(0, m.index).split('\n').length;
    failures.push({
      rule: 'os_theme_ink',
      where: `${rel}:${line}`,
      detail: 'widget CSS may not branch on prefers-color-scheme; the card surface does not follow the OS, so the ink must not either',
    });
  }

  // Rule 1b — a widget's ink may not be delegated to a token defined outside the widget
  // system. --ds-dim carried the fallback #5b6470 in this stylesheet and shipped as #a1a1aa
  // from the active design profile: 2.39:1 on the card footer, and invisible to a static
  // check that reads the fallback. The fallback is not what renders. Widget ink is a literal.
  // A token the widget stylesheet DEFINES is the widget's own value and is checked like a
  // literal. A token it only READS belongs to the design profile, which can change under it.
  const localTokens = new Set([...code.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1].toLowerCase()));
  for (const m of code.matchAll(/color\s*:\s*var\(\s*(--[a-z0-9-]+)/gi)) {
    if (localTokens.has(m[1].toLowerCase())) continue;
    const line = code.slice(0, m.index).split('\n').length;
    failures.push({
      rule: 'ink_delegated_to_token',
      where: `${rel}:${line}`,
      token: m[1],
      detail: 'widget ink must be a literal, or a token this stylesheet defines. ' + m[1] + ' is set by the design profile and can drift below the floor without this file changing — which is exactly how --ds-dim shipped at #a1a1aa (2.39:1) while the fallback here read #5b6470.',
    });
  }

  // Rule 2 — computed contrast, selector by selector.
  // Pass one: every selector that declares a surface, so children can resolve against it.
  const rules = [...text.matchAll(/([.#][a-zA-Z0-9_\-.,#:\s>()[\]="']*?)\{([^{}]*)\}/g)]
    .map((m) => ({ sel: m[1].trim(), decl: m[2], index: m.index }));
  const surfaces = new Map();
  for (const r of rules) {
    const bg = surfaceOf(r.decl);
    if (!bg || !Array.isArray(bg)) continue;
    for (const one of r.sel.split(',')) {
      const cls = (one.trim().match(/\.[a-z0-9_-]+/gi) || []).pop();
      if (cls) surfaces.set(cls, bg);
    }
  }
  const CARD_DEFAULT = surfaces.get('.rp-card') || [255, 255, 255];

  // The surface under a run of text is painted by the nearest ancestor that declares one.
  // Resolution order, and the order matters: the element's own class, then each ancestor in
  // the compound selector from nearest to furthest (`.nb-fortune .rp-news-mast` is painted by
  // .nb-fortune, not by whatever the last .rp-news-mast rule happened to set), then the
  // element's own name-prefix chain, then the card default.
  function resolveSurface(sel) {
    const chain = sel.split(/\s+|>/).filter(Boolean)
      .map((part) => (part.match(/\.[a-z0-9_-]+/gi) || []).pop())
      .filter(Boolean);
    const own = chain[chain.length - 1];
    if (own && surfaces.has(own)) return surfaces.get(own);
    for (let i = chain.length - 2; i >= 0; i--) {
      if (surfaces.has(chain[i])) return surfaces.get(chain[i]);
    }
    if (own) {
      const parts = own.replace(/^\./, '').split('-');
      for (let n = parts.length - 1; n >= 2; n--) {
        const parent = '.' + parts.slice(0, n).join('-');
        if (surfaces.has(parent)) return surfaces.get(parent);
      }
    }
    return CARD_DEFAULT;
  }

  for (const r of rules) {
    const fg = inkOf(r.decl);
    if (!fg) continue;
    for (const one of r.sel.split(',')) {
      const sel = one.trim();
      if (!sel || EXEMPT.test(sel)) continue;
      const cls = (sel.match(/\.[a-z0-9_-]+/gi) || []).pop();
      if (!cls) continue;
      if (RUNTIME_SURFACE.has(sel) || RUNTIME_SURFACE.has(cls)) { runtime.push(sel); continue; }
      // A background the stylesheet cannot resolve (gradient, alpha, tokenless var) means the
      // surface is supplied elsewhere. Guessing white there invents failures; say so instead.
      const own = surfaceOf(r.decl);
      if (/background(?:-color)?\s*:/i.test(r.decl) && !own) { unresolved.push(sel); continue; }
      const bg = composite(own, resolveSurface(sel));
      const cr = ratio(fg, bg);
      const floor = PAYLOAD.test(cls) ? FLOOR_PAYLOAD : FLOOR_META;
      audited.push(cls);
      if (cr + 1e-9 < floor) {
        const line = text.slice(0, r.index).split('\n').length;
        failures.push({
          rule: 'contrast_floor',
          where: `${rel}:${line}`,
          selector: sel,
          ratio: Number(cr.toFixed(2)),
          floor,
          detail: `ink ${fg.join(',')} on surface ${bg.join(',')}`,
        });
      }
    }
  }
}

// A gate that measured nothing must say so rather than pass.
if (audited.length < 100) {
  console.log(JSON.stringify({ ok: false, law: 'WIDGET_CONTRAST_LAW', error: 'gate examined too few declarations to be meaningful', examined: audited.length }));
  process.exit(1);
}

if (failures.length) {
  console.log(JSON.stringify({ ok: false, law: 'WIDGET_CONTRAST_LAW', examined: audited.length, runtime_surface: runtime.length, unresolved_surface: unresolved.length, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, law: 'WIDGET_CONTRAST_LAW', examined: audited.length, runtime_surface: runtime.length, unresolved_surface: unresolved.length, floors: { payload: FLOOR_PAYLOAD, meta: FLOOR_META } }));
