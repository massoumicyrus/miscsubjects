#!/usr/bin/env node
// One-shot repair for WIDGET_CONTRAST_LAW: darken (or lighten, on a dark surface) each failing
// ink along its own hue until it clears the floor against the surface it actually sits on.
// Hue and saturation are preserved; only lightness moves, and only as far as the floor requires.
// Run, then run check-widget-contrast.mjs. The checker is the authority; this is a convenience.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

function srgb(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function lum([r, g, b]) { return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b); }
function ratio(a, b) { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const parse = (s) => {
  const m = String(s).match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const t = String(s).match(/^#([0-9a-f]{3})$/i);
  if (t) return [...t[1]].map((c) => parseInt(c + c, 16));
  const r = String(s).match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  return r ? [Number(r[1]), Number(r[2]), Number(r[3])] : null;
};

/** Move ink away from the surface in 1% steps until the floor is met. */
function correct(ink, surface, floor) {
  const towardBlack = lum(surface) > 0.5;
  for (let step = 1; step <= 100; step++) {
    const t = step / 100;
    const c = ink.map((v) => (towardBlack ? v * (1 - t) : v + (255 - v) * t));
    if (ratio(c, surface) >= floor) return c.map(Math.round);
  }
  return towardBlack ? [0, 0, 0] : [255, 255, 255];
}

// The checker exits non-zero when it finds failures, which is the case we are here to repair.
let raw;
try {
  raw = execFileSync('node', [`${ROOT}/scripts/check-widget-contrast.mjs`], { encoding: 'utf8', maxBuffer: 1 << 24 });
} catch (err) {
  raw = String(err.stdout || '');
}
const report = JSON.parse(raw.trim());
if (report.ok) { console.log('nothing to repair'); process.exit(0); }

const edits = new Map();   // file → [{line, from, to}]
for (const f of report.failures) {
  if (f.rule !== 'contrast_floor') continue;
  const [rel, lineNo] = f.where.split(':');
  const [ink, surface] = f.detail.match(/ink ([\d,]+) on surface ([\d,]+)/).slice(1, 3).map((s) => s.split(',').map(Number));
  if (!edits.has(rel)) edits.set(rel, []);
  // Ink already at the light end of its range: move the surface instead of the ink.
  if (lum(ink) > 0.75 && lum(surface) < 0.75) {
    edits.get(rel).push({ line: Number(lineNo), moveSurface: true, surfaceFrom: hex(surface), surfaceTo: hex(correct(surface, ink, f.floor)) });
  } else {
    edits.get(rel).push({ line: Number(lineNo), from: hex(ink), to: hex(correct(ink, surface, f.floor)) });
  }
}

let changed = 0;
for (const [rel, list] of edits) {
  const path = `${ROOT}/${rel}`;
  const lines = readFileSync(path, 'utf8').split('\n');
  for (const e of list) {
    const i = e.line - 1;
    if (!lines[i]) continue;
    if (e.moveSurface) {
      // White ink cannot get whiter. When the ink is already at the light end, the fill is the
      // thing that has to move: darken the brand colour until the label on it is legible.
      lines[i] = lines[i].replace(/(background(?:-color)?\s*:\s*)(#[0-9a-f]{3,6}|rgba?\([^)]*\))/gi, (all, key, val) => {
        const cur = parse(val.trim());
        if (!cur || hex(cur).toLowerCase() !== e.surfaceFrom.toLowerCase()) return all;
        changed++;
        return key + e.surfaceTo;
      });
      continue;
    }
    // Replace only inside a `color:` declaration, never a background or a border.
    const next = lines[i].replace(/(color\s*:\s*)([^;}\n]+)/gi, (all, key, val) => {
      const cur = parse(val.trim());
      if (!cur || hex(cur).toLowerCase() !== e.from.toLowerCase()) return all;
      changed++;
      return key + e.to;
    });
    lines[i] = next;
  }
  writeFileSync(path, lines.join('\n'));
}
console.log(JSON.stringify({ files: [...edits.keys()], declarations_corrected: changed }));
