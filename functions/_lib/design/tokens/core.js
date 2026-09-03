// TOKENS — the DEFAULT design profile ("Warm editorial"): the built-in fallback every runtime
// profile merges over (see ./runtime.js — the active profile in KV can override any value here
// via /api/design, no redeploy). These are mutable profile VALUES, not law; the law
// (functions/_lib/design_law_object.js) fixes the roles and counts, this file fills them.
// No other module may invent colors, spacing, type scales, or radii.

// Compatibility export only. Spacing and layout are explicit and do not derive
// from an aesthetic ratio.
export const RATIO = 1;
export const UNIT = "1rem";

// Warm editorial palette: a chosen paper ground (not pure white), warm ink, and ONE restrained
// deep-teal accent. Neutrals carry a faint warm bias so they read as considered, not default.
export const COLORS = Object.freeze({
  root: "#faf8f3",
  surface: "#f3efe6",
  raised: "#ece7db",
  ink: "#1c1b17",
  soft: "#46443c",
  muted: "#6b6759",
  dim: "#928d7e",
  line: "#e4dfd3",
  accent: "#0e6e60",
  accentSoft: "rgba(14,110,96,0.08)",
  void: "#0e1512",
});

export const FONTS = Object.freeze({
  display: "'Source Serif 4', Georgia, 'Times New Roman', serif",
  body: "'Source Sans 3', 'Source Sans Pro', ui-sans-serif, system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
});

export const TYPE_SCALE = Object.freeze({
  display: "clamp(2.75rem, 5vw, 4.75rem)",
  h1: "clamp(2.25rem, 4vw, 3.75rem)",
  h2: "clamp(1.75rem, 2.6vw, 2.35rem)",
  h3: "clamp(1.25rem, 1.8vw, 1.55rem)",
  lead: "clamp(1.2rem, 1.6vw, 1.4rem)",
  body: "clamp(1.0625rem, 1vw, 1.1875rem)",
  small: "0.9375rem",
  eye: "0.8125rem",
});

export const LEADING = Object.freeze({
  display: 1.08,
  head: 1.18,
  body: 1.7,
});

export const SPACES = Object.freeze({
  1: "0.5rem",
  2: "1rem",
  3: "1.5rem",
  4: "2rem",
  5: "3rem",
  6: "4.5rem",
});

export const MEASURES = Object.freeze({
  copy: "48rem",
  wide: "80rem",
});

export const RADIUS = "6px";
