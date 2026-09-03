// RUNTIME DESIGN TABULATION — the master knobs, flippable by POST with no redeploy.
//
// core.js holds the built-in DEFAULT profile (a pure literal, the fallback). At runtime the site
// reads the ACTIVE profile from KV and merges it over the default, so a single POST to /api/design
// re-skins every page — colors, fonts, type scale, line-height, spacing, radius — instantly.
//
// A "profile" is the full quantified design of a site: paste one to clone another site's look.

import {
  COLORS,
  FONTS,
  TYPE_SCALE,
  LEADING,
  SPACES,
  MEASURES,
  RADIUS,
} from "./core.js";

// The default profile, assembled from the built-in tokens. Shape = the master tabulation.
export const DEFAULT_PROFILE = Object.freeze({
  name: "default",
  label: "Warm editorial (default)",
  colors: { ...COLORS },
  fonts: { ...FONTS },
  typeScale: { ...TYPE_SCALE },
  leading: { ...LEADING },
  spaces: { ...SPACES },
  measures: { ...MEASURES },
  radius: RADIUS,
  fontLinks: [
    "https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&family=JetBrains+Mono:wght@400;500;600&display=swap",
  ],
});

const ACTIVE_KEY = "design:active";
const PROFILE_PREFIX = "design:profile:";

function deepMerge(base, over) {
  if (!over || typeof over !== "object") return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over)) {
    const b = out[k];
    const o = over[k];
    if (o && typeof o === "object" && !Array.isArray(o) && b && typeof b === "object") {
      out[k] = deepMerge(b, o);
    } else if (o !== undefined) {
      out[k] = o;
    }
  }
  return out;
}

// Resolve the effective design profile: active KV profile merged over the default. Never throws;
// falls back to the default if KV is empty/unavailable so the site always renders.
export async function getActiveProfile(env) {
  try {
    if (!env || !env.KV) return DEFAULT_PROFILE;
    const active = await env.KV.get(ACTIVE_KEY);
    if (!active || active === "default") return DEFAULT_PROFILE;
    const raw = await env.KV.get(PROFILE_PREFIX + active);
    if (!raw) return DEFAULT_PROFILE;
    const prof = JSON.parse(raw);
    return deepMerge(DEFAULT_PROFILE, prof);
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function listProfiles(env) {
  const out = [{ name: "default", label: DEFAULT_PROFILE.label }];
  try {
    if (!env || !env.KV) return out;
    const list = await env.KV.list({ prefix: PROFILE_PREFIX });
    for (const k of list.keys || []) {
      const name = k.name.slice(PROFILE_PREFIX.length);
      let label = name;
      try { label = (JSON.parse(await env.KV.get(k.name)) || {}).label || name; } catch {}
      out.push({ name, label });
    }
  } catch {}
  return out;
}

export async function saveProfile(env, name, profile) {
  if (!env?.KV) throw new Error("KV unavailable");
  const clean = String(name).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  if (!clean || clean === "default") throw new Error("invalid profile name");
  const merged = deepMerge({ name: clean, label: clean }, profile || {});
  merged.name = clean;
  await env.KV.put(PROFILE_PREFIX + clean, JSON.stringify(merged));
  return clean;
}

export async function setActive(env, name) {
  if (!env?.KV) throw new Error("KV unavailable");
  const clean = String(name).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "default";
  if (clean !== "default") {
    const exists = await env.KV.get(PROFILE_PREFIX + clean);
    if (!exists) throw new Error("no such profile: " + clean);
  }
  await env.KV.put(ACTIVE_KEY, clean);
  return clean;
}

// A :root override that maps the profile onto the CSS variables the chrome + articles use.
// Injected into every page head so a flipped profile re-skins var-driven surfaces with no redeploy.
export function cssVarOverride(p) {
  const c = p.colors;
  return (
    `:root{` +
    `--ds-bg:${c.root};--ds-surface:${c.surface};--ds-raised:${c.raised};` +
    `--ds-ink:${c.ink};--ds-soft:${c.soft};--ds-dim:${c.dim};--ds-line:${c.line};` +
    `--ds-accent:${c.accent};--ds-accent-soft:${c.accentSoft};` +
    `--surface-root:${c.root};--surface-1:${c.surface};--surface-2:${c.raised};` +
    `--ink-primary:${c.ink};--ink-secondary:${c.soft};--ink-muted:${c.dim};` +
    `--line:${c.line};--accent:${c.accent};--accent-soft:${c.accentSoft};` +
    `--font-display:${p.fonts.display};--font-body:${p.fonts.body};--font:${p.fonts.body};--font-mono:${p.fonts.mono};` +
    `}`
  );
}

export const PROFILE_SCHEMA = {
  name: "string (slug)",
  label: "string (human name)",
  colors: { root: "#hex ground", surface: "#hex", raised: "#hex", ink: "#hex", soft: "#hex", muted: "#hex", dim: "#hex", line: "#hex", accent: "#hex", accentSoft: "rgba()", void: "#hex" },
  fonts: { display: "css font stack", body: "css font stack", mono: "css font stack" },
  typeScale: { display: "clamp()", h1: "", h2: "", h3: "", lead: "", body: "", small: "", eye: "" },
  leading: { display: "number", head: "number", body: "number" },
  spaces: { 1: "rem", 2: "", 3: "", 4: "", 5: "", 6: "" },
  measures: { copy: "rem", wide: "rem" },
  radius: "px",
  fontLinks: ["google fonts url(s) — added to <head> so the fonts load"],
};
