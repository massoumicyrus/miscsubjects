// REPRESENTATION: css — renders the global CSS layer from tokens.
// This is the canonical CSS string used by public/assets/design-system.css.

import {
  COLORS,
  FONTS,
  TYPE_SCALE,
  LEADING,
  SPACES,
  MEASURES,
  RADIUS,
  UNIT,
} from "../tokens/core.js";

export function renderCssLayers() {
  return `@import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&family=JetBrains+Mono:wght@400;500;600&display=swap');

@layer law, tokens, primitives, compositions, capabilities, surfaces, exceptions, widgets;

@layer law {
  :root {
    --u: ${UNIT};

    --surface-root: ${COLORS.root};
    --surface-1: ${COLORS.surface};
    --surface-2: ${COLORS.raised};
    --ink-primary: ${COLORS.ink};
    --ink-secondary: ${COLORS.soft};
    --ink-muted: ${COLORS.muted};
    --ink-dim: ${COLORS.dim};
    --line: ${COLORS.line};
    --accent: ${COLORS.accent};
    --accent-soft: ${COLORS.accentSoft};
    /* --ds-* aliases: referenced across content/* and admin/* but were never defined,
       leaving those surfaces unstyled. Alias them to the real design tokens. */
    --ds-surface: var(--surface-root);
    --ds-bg: var(--surface-root);
    --ds-raised: var(--surface-2);
    --ds-ink: var(--ink-primary);
    --ds-soft: var(--ink-secondary);
    --ds-dim: var(--ink-muted);
    --ds-line: var(--line);
    --ds-accent: var(--accent);
    --ds-accent-soft: var(--accent-soft);
    --ds-sage: var(--ink-secondary);
    --ds-void: ${COLORS.void};

    --color-x: #1d9bf0;
    --color-reddit: #ff4500;
    --color-whatsapp: #25d366;
    --color-youtube: #ff0000;
    --color-linkedin: #0a66c2;
    --color-github: #181717;
    --color-get: #22c55e;
    --color-post: #3b82f6;
    --color-patch: #f59e0b;
    --color-delete: #ef4444;
    --color-put: #a855f7;
    --color-model: #10b981;
    --color-api: #2563eb;
    --color-company: #f97316;
    --color-skill: #7c3aed;

    --font-display: ${FONTS.display};
    --font-body: ${FONTS.body};
    --font-mono: ${FONTS.mono};

    --fs-display: ${TYPE_SCALE.display};
    --fs-h1: ${TYPE_SCALE.h1};
    --fs-h2: ${TYPE_SCALE.h2};
    --fs-h3: ${TYPE_SCALE.h3};
    --fs-lead: ${TYPE_SCALE.lead};
    --fs-body: ${TYPE_SCALE.body};
    --fs-small: ${TYPE_SCALE.small};
    --fs-eye: ${TYPE_SCALE.eye};

    --lh-display: ${LEADING.display};
    --lh-head: ${LEADING.head};
    --lh-body: ${LEADING.body};

    --space-1: ${SPACES[1]};
    --space-2: ${SPACES[2]};
    --space-3: ${SPACES[3]};
    --space-4: ${SPACES[4]};
    --space-5: ${SPACES[5]};
    --space-6: ${SPACES[6]};

    --radius: ${RADIUS};
    --measure-copy: ${MEASURES.copy};
    --measure-wide: ${MEASURES.wide};

    color-scheme: light;
  }

  html {
    background: var(--surface-root);
    color: var(--ink-primary);
    font-family: var(--font-body);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    scroll-behavior: smooth;
  }

  body {
    margin: 0;
    background: var(--surface-root);
    color: var(--ink-primary);
  }

  ::selection { background: #e5e5e5; color: #000000; }

  * { box-sizing: border-box; }

  h1, h2, h3, h4, .display {
    font-family: var(--font-display);
    font-weight: 700;
    text-transform: none;
    letter-spacing: -0.015em;
    line-height: var(--lh-head);
    margin: 0 0 var(--space-3);
    color: var(--ink-primary);
  }

  h1 { font-size: var(--fs-h1); letter-spacing: -0.025em; max-width: 24ch; }
  h2 { font-size: var(--fs-h2); letter-spacing: -0.015em; }
  h3 { font-size: var(--fs-h3); letter-spacing: -0.01em; }

  p, li { font-family: var(--font-body); }
  code, pre, kbd { font-family: var(--font-mono); }

  a {
    color: var(--ink-primary);
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-color: var(--ink-dim);
  }
  a:hover { text-decoration-color: var(--ink-primary); }

  img { max-width: 100%; height: auto; display: block; }
}

@layer primitives {
  .ds-mark { display: inline-flex; color: var(--ink-primary); }
  .ds-btn {
    display: inline-flex; align-items: center; gap: 8px;
    background: transparent; color: var(--ink-primary);
    border: 1px solid var(--ink-primary); border-radius: var(--radius);
    padding: 10px 16px; font: 600 13px var(--font-body);
    letter-spacing: 0.02em; text-transform: uppercase;
    cursor: pointer; text-decoration: none;
    transition: background .12s ease, color .12s ease;
  }
  .ds-btn:hover { text-decoration: none; background: var(--ink-primary); color: var(--surface-root); }
  .ds-btn.ghost { border-color: var(--line); color: var(--ink-muted); }
  .ds-btn.ghost:hover { border-color: var(--ink-primary); color: var(--ink-primary); background: transparent; }

  .ds-pill {
    display: inline-flex; align-items: center; gap: 6px;
    border: 1px solid var(--line); border-radius: var(--radius);
    padding: 4px 10px; font: 700 10px var(--font-body);
    letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--ink-muted); white-space: nowrap;
  }

  .ds-kicker {
    font: 700 11px/1 var(--font-body); letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--ink-muted);
  }

  .ds-card { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface-root); padding: var(--space-3); }
  .ds-rule { flex: 1; height: 1px; background: var(--line); min-width: 40px; }

  details > summary { cursor: pointer; list-style: none; }
  details > summary::-webkit-details-marker { display: none; }
}

@layer compositions {
  .wrap { width: min(var(--measure-wide), calc(100% - 40px)); margin: 0 auto; }
  .copy { max-width: var(--measure-copy); margin-left: auto; margin-right: auto; }

  .ds-topbar {
    position: sticky; top: 0; z-index: 1000;
    background: var(--surface-root); border-bottom: 1px solid var(--line);
    color: var(--ink-primary); font: 600 15px/1 var(--font-body);
  }
  .ds-topbar-inner {
    width: min(var(--measure-wide), calc(100% - 32px)); min-height: 64px; margin: auto;
    display: flex; align-items: center; gap: var(--space-4);
  }
  .ds-brand {
    display: flex; align-items: center; gap: 10px;
    color: var(--ink-primary); text-decoration: none;
    font-family: var(--font-body); font-size: 1.15rem; font-weight: 700;
    letter-spacing: -0.01em; text-transform: none; white-space: nowrap;
  }
  .ds-brand small { font: 700 9px/1 var(--font-body); letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-muted); }
  .ds-nav { display: flex; align-items: center; justify-content: flex-end; gap: 4px; flex: 1; }
  .ds-nav-link { color: var(--ink-secondary); padding: 10px 12px; border-radius: var(--radius); white-space: nowrap; font-weight: 600; font-size: 15px; text-decoration: none; }
  .ds-nav-link:hover, .ds-nav-link.active { color: var(--ink-primary); background: var(--surface-1); text-decoration: none; }
  .ds-nav-hub { position: relative; }
  .ds-nav-hub > summary {
    list-style: none; cursor: pointer; color: var(--ink-secondary);
    padding: 10px 12px; border-radius: var(--radius); white-space: nowrap;
    font-weight: 600; text-transform: none; font-size: 15px; letter-spacing: 0;
  }
  .ds-nav-hub > summary::after { content: '⌄'; font-size: 10px; margin-left: 6px; color: var(--ink-dim); }
  .ds-nav-hub:hover > summary, .ds-nav-hub[open] > summary, .ds-nav-hub.active > summary { color: var(--ink-primary); }
  .ds-menu {
    position: absolute; top: calc(100% + 10px); left: 0;
    width: min(360px, calc(100vw - 32px)); padding: 14px;
    border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--surface-root); box-shadow: 0 16px 48px rgba(0,0,0,.08);
  }
  .ds-menu-k { display: block; padding: 2px 6px 10px; font: 700 10px/1 var(--font-body); letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); }
  .ds-menu-item { display: grid; gap: 3px; padding: 10px; border-radius: var(--radius); color: var(--ink-primary); text-decoration: none; }
  .ds-menu-item:hover { background: var(--surface-1); text-decoration: none; }
  .ds-menu-item b { font-size: 13px; font-weight: 700; }
  .ds-menu-item span { font-size: 12px; line-height: 1.4; color: var(--ink-muted); }
  .ds-menu-item.machine-link { border: 1px dashed var(--line); margin-top: 6px; }
  .machine-link::after { content: 'machine data'; font: 700 9px/1 var(--font-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-muted); margin-left: 6px; }
  .ds-proof {
    display: inline-flex; align-items: center; gap: 6px;
    color: var(--ink-primary); text-decoration: none; font-weight: 700;
    font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap;
  }
  .ds-proof:hover { text-decoration: underline; text-decoration-color: var(--ink-primary); }
  .ds-proof span { font-size: 14px; }

  .ds-foot { border-top: 1px solid var(--line); background: var(--surface-root); color: var(--ink-muted); padding: var(--space-5) 0; font: 14px/1.65 var(--font-body); }
  .ds-foot-inner { width: min(72rem, calc(100% - 40px)); margin: auto; display: grid; grid-template-columns: 1.7fr 1fr 1fr 1fr; gap: var(--space-4); }
  .ds-foot a { display: block; padding: 4px 0; color: var(--ink-secondary); text-decoration: none; }
  .ds-foot a:hover { color: var(--ink-primary); text-decoration: underline; }
  .ds-foot-h, .ds-machine summary { display: block; margin-bottom: 10px; font: 700 10px/1 var(--font-body); letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); }
  .ds-foot-principle { display: grid; grid-template-columns: auto 1fr; gap: 7px 10px; }
  .ds-foot-principle b { color: var(--ink-primary); }
  .ds-foot-principle > span:last-child { grid-column: 2; max-width: 35ch; }
  .ds-foot-mark { width: 10px; height: 10px; background: var(--ink-primary); }
  .ds-machine summary { cursor: pointer; }
  .ds-machine .machine-link { margin-top: 7px; }
  .machine-url { display: inline-flex; align-items: center; gap: 6px; color: var(--ink-muted); font: 12px/1.5 var(--font-body); user-select: text; }
  .machine-url code, code.machine-url { font: 600 12px/1.5 var(--font-mono); color: var(--ink-secondary); background: var(--surface-1); border: 1px dashed var(--line); border-radius: var(--radius); padding: 1px 6px; }
  .ds-machine .machine-url { display: block; margin-top: 7px; }

  section.chapter { padding: var(--space-5) 0; border-top: 1px solid var(--line); }
  .chapter-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap; }
  .chapter-head h2 { margin: 0; display: flex; align-items: center; gap: var(--space-3); flex: 1; }
  .chapter-head h2::after { content: ''; flex: 1; height: 1px; background: var(--line); min-width: 40px; }
  .chapter-count { font: 700 11px/1 var(--font-body); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-muted); }
  .chapter-body { display: grid; gap: var(--space-3); }

  .featured {
    display: grid; grid-template-columns: auto 1fr; gap: var(--space-4); align-items: end;
    padding: var(--space-4) 0; border-bottom: 1px solid var(--line);
    text-decoration: none; margin-bottom: var(--space-3); transition: background .15s;
  }
  .featured:hover { background: var(--surface-1); text-decoration: none; }
  .featured .fnum {
    font-family: var(--font-display); font-size: clamp(3.5rem, 7vw, 5.5rem); line-height: .85;
    font-weight: 700; color: var(--ink-dim); min-width: 90px;
  }
  .featured .fk { font: 700 10px/1 var(--font-body); letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); display: block; margin-bottom: 10px; }
  .featured .ft {
    font-family: var(--font-display); font-weight: 700; font-size: clamp(1.5rem, 2.6vw, 2.2rem);
    line-height: 1.05; text-transform: uppercase; letter-spacing: 0.01em;
    color: var(--ink-primary); margin-bottom: 10px; display: block;
  }
  .featured .fm, .idx .im { font: 700 10px/1.6 var(--font-body); letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-muted); }
  .featured .ftags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .featured .read { display: inline-block; margin-top: 12px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-primary); }
  .idx { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line); border: 1px solid var(--line); }
  .idx li { background: var(--surface-root); }
  .idx a { display: grid; grid-template-columns: auto 1fr auto; gap: var(--space-2); align-items: baseline; padding: var(--space-3); color: var(--ink-primary); text-decoration: none; height: 100%; transition: background .15s; }
  .idx a:hover { background: var(--surface-1); text-decoration: none; }
  .idx .in { font: 700 10px/1.9 var(--font-body); letter-spacing: 0.1em; color: var(--ink-muted); }
  .idx .it { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; line-height: 1.15; text-transform: uppercase; letter-spacing: 0.01em; color: var(--ink-primary); }
  .idx .im { grid-column: 2; }
  .idx .arrow { color: var(--ink-dim); font-size: 13px; transition: color .15s, transform .15s; }
  .idx a:hover .arrow { color: var(--ink-primary); transform: translateX(3px); }
  .feed-note { color: var(--ink-muted); font-size: 14px; }

  .cap-card {
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface-root);
    padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); transition: background .15s;
  }
  .cap-card:hover { background: var(--surface-1); }
  .cap-card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .cap-card-key { font: 700 10px var(--font-body); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-muted); }
  .cap-card-title { font-family: var(--font-display); font-weight: 700; font-size: 1.35rem; line-height: 1.1; text-transform: uppercase; letter-spacing: 0.01em; color: var(--ink-primary); margin: 0; }
  .cap-card-sum { color: var(--ink-secondary); margin: 0; font-size: .98rem; line-height: 1.55; }
  .cap-card-actions { display: flex; gap: 14px; margin-top: auto; padding-top: var(--space-2); }
  .cap-card-link { font: 700 11px var(--font-body); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-primary); text-decoration: none; }
  .cap-card-link:hover { text-decoration: underline; }

  .dir-widget { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface-root); padding: var(--space-3); display: grid; gap: 10px; }
  .dir-widget-key { font: 700 11px var(--font-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-muted); }
  .dir-widget-what { color: var(--ink-secondary); font-size: .98rem; line-height: 1.55; }
  .dir-widget-actions { display: flex; gap: 14px; }
  .dir-widget-actions a { font: 700 10px var(--font-body); letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; }
  .dir-widget-contract { color: var(--ink-muted); }
  .dir-widget-invoke { color: var(--ink-primary); }

  .insp-panel { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface-root); overflow: hidden; }
  .insp-panel summary { display: flex; align-items: center; gap: 12px; padding: var(--space-3); font: 700 14px var(--font-body); color: var(--ink-primary); text-transform: uppercase; letter-spacing: 0.02em; }
  .insp-panel summary::after { content: '+'; margin-left: auto; font: 400 18px var(--font-mono); color: var(--ink-muted); }
  .insp-panel[open] summary::after { content: '−'; }
  .insp-k { font: 700 9px var(--font-body); letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); }
  .insp-meta { margin-left: auto; font: 700 11px var(--font-mono); color: var(--ink-dim); }
  .insp-body { border-top: 1px solid var(--line); padding: var(--space-3); color: var(--ink-secondary); font-size: .98rem; line-height: 1.65; }
  .insp-row { display: grid; grid-template-columns: 8rem 1fr; gap: var(--space-2); padding: 10px 0; border-bottom: 1px solid var(--line); }
  .insp-row:last-child { border-bottom: 0; }
  .insp-label { font: 700 10px var(--font-body); letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-muted); }
  .insp-value { color: var(--ink-primary); }
  .insp-value a { color: var(--ink-primary); }
}

@layer capabilities {
  .evidence-rail { display: flex; gap: var(--space-2); overflow-x: auto; padding-bottom: var(--space-2); scrollbar-width: thin; scrollbar-color: var(--ink-dim) var(--surface-1); }
  .evidence-rail::-webkit-scrollbar { height: 5px; }
  .evidence-rail::-webkit-scrollbar-track { background: var(--surface-1); }
  .evidence-rail::-webkit-scrollbar-thumb { background: var(--ink-dim); }

  .platform-card { flex: 0 0 280px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface-root); padding: var(--space-3); display: grid; gap: 12px; }
  .platform-card:hover { background: var(--surface-1); }
  .platform-head { display: flex; align-items: center; gap: 10px; }
  .platform-icon { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }
  .platform-name { font: 700 14px var(--font-body); color: var(--ink-primary); }
  .platform-snippet { color: var(--ink-secondary); font-size: .95rem; line-height: 1.55; }
  .platform-meta { font: 700 10px var(--font-body); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-muted); }
  .platform-link { font: 700 12px var(--font-body); color: var(--ink-primary); text-decoration: none; }

  .platform-card.x { border-color: rgba(29,155,240,.35); }
  .platform-card.x .platform-icon { color: var(--color-x); }
  .platform-card.reddit { border-color: rgba(255,69,0,.35); }
  .platform-card.reddit .platform-icon { color: var(--color-reddit); }
  .platform-card.whatsapp { border-color: rgba(37,211,102,.35); }
  .platform-card.whatsapp .platform-icon { color: var(--color-whatsapp); }
  .platform-card.youtube { border-color: rgba(255,0,0,.35); }
  .platform-card.youtube .platform-icon { color: var(--color-youtube); }
  .platform-card.linkedin { border-color: rgba(10,102,194,.35); }
  .platform-card.linkedin .platform-icon { color: var(--color-linkedin); }

  .model-card { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface-root); padding: var(--space-3); display: grid; gap: 12px; }
  .model-card:hover { background: var(--surface-1); }
  .model-head { display: flex; align-items: center; gap: 10px; }
  .model-badge { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font: 700 10px var(--font-mono); border: 1px solid var(--line); color: var(--ink-primary); }
  .model-name { font: 700 15px var(--font-body); color: var(--ink-primary); }
  .model-provider { font: 700 11px var(--font-mono); color: var(--ink-muted); }
  .model-sum { color: var(--ink-secondary); font-size: .95rem; line-height: 1.55; margin: 0; }
  .model-meta { display: flex; gap: 8px; flex-wrap: wrap; }

  .method { font: 700 9px var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 7px; border-radius: var(--radius); }
  .method.get { background: rgba(34,197,94,.1); color: #15803d; }
  .method.post { background: rgba(59,130,246,.1); color: #1d4ed8; }
  .method.patch { background: rgba(245,158,11,.1); color: #b45309; }
  .method.delete { background: rgba(239,68,68,.1); color: #b91c1c; }
  .method.put { background: rgba(168,85,247,.1); color: #7e22ce; }

  .dir-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-3); }
}

@layer surfaces {
  .hero {
    display: block; padding: var(--space-6) 0 var(--space-5); border-bottom: 1px solid var(--line);
  }
  .hero-kicker { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); }
  .hero h1 { font-size: var(--fs-display); line-height: var(--lh-display); margin: 0 0 var(--space-3); color: var(--ink-primary); }
  .hero .sub {
    font-family: var(--font-body); font-size: var(--fs-lead); font-weight: 400; font-style: normal;
    text-transform: none; letter-spacing: 0; color: var(--ink-secondary); margin-bottom: var(--space-3); line-height: 1.55;
  }
  .hero .lede { font-size: var(--fs-lead); line-height: 1.55; color: var(--ink-secondary); max-width: var(--measure-copy); margin: 0 0 var(--space-4); }
  .hero-ctas { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center; }

  .badges { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); margin-top: var(--space-5); padding-top: var(--space-3); border-top: 1px solid var(--line); }
  .badge { display: flex; flex-direction: column; gap: 6px; }
  .badge .n { font: 700 10px/1 var(--font-body); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-muted); }
  .badge b { font-family: var(--font-display); font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; color: var(--ink-primary); }
  .badge span { font-size: 14px; line-height: 1.5; color: var(--ink-muted); }

  .hero-visual { display: none; }

  .dispatch { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
  .door {
    position: relative; border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--surface-root); padding: var(--space-4); display: flex;
    flex-direction: column; gap: var(--space-2);
  }
  .door .ds-kicker { display: block; }
  .door h3 {
    font-family: var(--font-display); font-weight: 700; font-size: clamp(1.35rem, 2.2vw, 1.85rem);
    line-height: 1.1; text-transform: uppercase; letter-spacing: 0.01em;
    color: var(--ink-primary); margin: 0;
  }
  .door p { color: var(--ink-secondary); font-size: 15px; line-height: 1.6; margin: 0; max-width: 52ch; }
  .door .micro { color: var(--ink-muted); font-size: 12px; line-height: 1.5; margin: 0; }
  .door .ds-btn { align-self: flex-start; margin-top: auto; }

  .article-shell { padding: var(--space-5) 0; }
  .article-head { max-width: var(--measure-copy); margin: 0 auto var(--space-5); }
  .article-head .ds-kicker { margin-bottom: var(--space-2); }
  .article-head h1 { margin-bottom: var(--space-3); text-align: left; }
  .article-meta {
    display: flex; gap: var(--space-3); flex-wrap: wrap;
    color: var(--ink-muted); font: 700 11px var(--font-body); letter-spacing: 0.08em; text-transform: uppercase;
  }
  .article-body { max-width: var(--measure-copy); margin: 0 auto; }
  .article-body h2 {
    margin-top: var(--space-5); padding-top: var(--space-4); border-top: 1px solid var(--line);
    text-transform: uppercase; letter-spacing: 0.03em;
  }
  .article-body p { color: var(--ink-secondary); margin: 0 0 1.4em; font-size: 1.0625rem; line-height: 1.75; }
  .article-body p + p { margin-top: 0; }
  .article-body strong { color: var(--ink-primary); font-weight: 700; }
  .article-body blockquote {
    margin: var(--space-4) 0; padding: var(--space-3) var(--space-4);
    border-left: 3px solid var(--ink-primary); background: var(--surface-1);
    font-family: var(--font-body); font-size: var(--fs-h3); font-weight: 400; font-style: italic; color: var(--ink-primary);
  }
  .article-body ul, .article-body ol { margin: 0 0 var(--space-4) var(--space-3); padding-left: var(--space-3); color: var(--ink-secondary); }
  .article-body li { margin-bottom: var(--space-1); line-height: 1.7; }
  .article-body code { background: var(--surface-1); padding: 2px 5px; border-radius: var(--radius); font-size: .9em; color: var(--ink-primary); }
  .article-body pre { background: var(--surface-1); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3); overflow-x: auto; font-size: .92rem; line-height: 1.55; }
  .article-body pre code { background: transparent; padding: 0; }

  .reader-opening, .reader-chapter { position: relative; margin: 0; }
  .reader-opening { font-size: var(--fs-body); line-height: var(--lh-body); color: var(--ink-secondary); }
  .reader-chapter > h2 { margin: 2.25rem 0 .75rem; }
  .chapter-number { display: none; }
  .reader-chapter > ul, .reader-chapter > ol { margin: var(--space-3) 0 var(--space-4); padding-left: 1.4em; }
  .reader-chapter > ul { list-style: disc; }
  .reader-chapter > ol { list-style: decimal; }
  .reader-chapter > ul > li, .reader-chapter > ol > li { margin: 0 0 .65em; line-height: 1.7; color: var(--ink-secondary); }
  .reader-chapter > ul > li::marker, .reader-chapter > ol > li::marker { color: var(--ink-muted); }

  .governance-shell { padding: var(--space-5) 0; }
  .governance-hero { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-5); align-items: center; padding-bottom: var(--space-5); border-bottom: 1px solid var(--line); }
  .governance-hero h1 { margin-bottom: var(--space-3); }
  .governance-hero p { color: var(--ink-secondary); font-size: var(--fs-lead); line-height: 1.55; max-width: var(--measure-copy); }
  .registry-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-3); }
  .registry-card { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface-root); padding: var(--space-3); }
  .registry-card:hover { background: var(--surface-1); }
  .registry-key { font: 700 10px var(--font-body); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-muted); margin-bottom: 8px; }
  .registry-title { font-family: var(--font-display); font-weight: 700; font-size: 1.25rem; line-height: 1.1; text-transform: uppercase; letter-spacing: 0.01em; margin: 0 0 8px; }
  .registry-sum { color: var(--ink-secondary); font-size: .95rem; margin: 0; line-height: 1.55; }

  .legal { border-top: 1px solid var(--line); padding: var(--space-2) 0 var(--space-4); display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font: 700 11px/1.6 var(--font-body); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-muted); }
  .legal a { color: var(--ink-secondary); text-decoration: none; }
  .legal a:hover { color: var(--ink-primary); text-decoration: underline; }
}

@layer exceptions {
  @media (max-width: 900px) {
    .ds-topbar-inner { min-height: 56px; gap: 10px; }
    .ds-nav { gap: 0; }
    .ds-nav-hub > summary { padding: 9px 8px; }
    .ds-proof { display: none; }
    .ds-foot-inner { grid-template-columns: 1fr 1fr; }
    .reader-chapter > ul, .reader-chapter > ol { grid-template-columns: 1fr; }
    .hero, .governance-hero, .dispatch { grid-template-columns: 1fr; }
    .hero { padding: var(--space-5) 0 var(--space-4); }
    .featured { grid-template-columns: 1fr; gap: var(--space-2); }
    .featured .fnum { font-size: 3.2rem; min-width: 60px; }
    .idx { grid-template-columns: 1fr; }
    .badges { grid-template-columns: 1fr; gap: var(--space-2); }
  }
  @media (max-width: 680px) {
    .ds-topbar { position: relative; }
    .ds-topbar-inner { align-items: flex-start; padding: 12px 0; flex-wrap: wrap; }
    .ds-brand { margin-right: auto; }
    .ds-nav { order: 3; width: 100%; display: grid; grid-template-columns: 1fr 1fr; }
    .ds-menu { position: fixed; left: 16px; right: 16px; top: 110px; width: auto; }
    .ds-foot-inner { grid-template-columns: 1fr; }
    .dir-grid, .registry-grid { grid-template-columns: 1fr; }
  }
}

@layer widgets {
  .widget { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface-root); }
}
`;
}
