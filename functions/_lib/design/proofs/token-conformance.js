// PROOF: token-conformance — the monochrome law must hold outside widgets.
// Chrome, primitives, compositions, surfaces, and exceptions must use only the
// grayscale token palette. Capabilities and widgets may use the semantic widget
// colors declared below.

import fs from "node:fs";
import path from "node:path";

const MONOCHROME = new Set([
  "#000", "#0000", "#000000", "#00000000",
  "#fff", "#ffff", "#ffffff", "#ffffff00",
  "#fafafa", "#f5f5f5",
  "#111", "#111111",
  "#333", "#333333",
  "#666", "#666666",
  "#999", "#999999",
  "#e5e5e5",
]);

const WIDGET = new Set([
  "#1d9bf0", "#ff4500", "#25d366", "#ff0000",
  "#0a66c2", "#181717", "#22c55e", "#3b82f6",
  "#2563eb", "#f59e0b", "#ef4444", "#a855f7",
  "#10b981", "#f97316", "#7c3aed", "#008069",
  "#0b84ff", "#e9e9eb", "#8e8e93", "#8696a0",
  "#667781", "#efeae2", "#d9fdd3", "#d1e8e3",
  "#536471", "#0f1419", "#15803d", "#1d4ed8",
  "#b45309", "#b91c1c", "#7e22ce",
]);

const ALLOWED = new Set([...MONOCHROME, ...WIDGET]);

function isAllowedColor(value) {
  const v = value.trim().toLowerCase();
  if (ALLOWED.has(v)) return true;

  // rgba/hsla with allowed rgb or pure grayscale
  const rgba = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (rgba) {
    const [r, g, b] = [parseInt(rgba[1]), parseInt(rgba[2]), parseInt(rgba[3])];
    // Grayscale: r === g === b
    if (r === g && g === b) return true;
    // Known widget RGB
    const hex = "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
    return WIDGET.has(hex);
  }

  // hsla with grayscale (s = 0%)
  const hsla = v.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (hsla && parseFloat(hsla[2]) === 0) return true;

  return false;
}

export function tokenConformance(cssPath = "public/assets/design-system.css") {
  const css = fs.readFileSync(path.resolve(cssPath), "utf8");
  const colorValues = css.match(/(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/g) || [];
  const stray = [];
  for (const c of colorValues) {
    if (!isAllowedColor(c)) stray.push(c);
  }
  if (stray.length) {
    throw new Error(
      `Stray color values outside tokens/widgets: ${[...new Set(stray)].join(", ")}`,
    );
  }
  return { ok: true };
}
