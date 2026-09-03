// /design — the LIVING design system. Every visual variable on the site is defined once in
// functions/_lib/design/tokens/core.js and disclosed here, rendered directly FROM those tokens so
// this page can never drift from what the site actually uses. This is the master control surface:
// see every color, font, size, line-height, spacing step, radius, and the live components built on them.
import {
  governanceHeader,
  governanceFooter,
  governanceChromeStyles,
} from "./_lib/governance_chrome.js";
import { getActiveProfile, listProfiles, cssVarOverride } from "./_lib/design/tokens/runtime.js";
import { renderPlatformCard, WIDGET_SPECIMENS, platformRailCss } from "./_lib/widgets/rail-platform.js";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function onRequestGet(context) {
  const env = context && context.env;
  const prof = await getActiveProfile(env);
  const COLORS = prof.colors;
  const FONTS = prof.fonts;
  const TYPE_SCALE = prof.typeScale;
  const LEADING = prof.leading;
  const swatch = (name, value) =>
    `<figure class="sw"><div class="sw-chip" style="background:${value}"></div><figcaption><b>${esc(name)}</b><code>${esc(value)}</code></figcaption></figure>`;
  const typeRow = (name, size) =>
    `<div class="ty-row"><div class="ty-meta"><b>${esc(name)}</b><code>${esc(size)}</code></div><div class="ty-sample" style="font-size:${size};font-family:${FONTS.display};line-height:${LEADING.head}">Body protection compound</div></div>`;
  const leadRow = (name, val) =>
    `<div class="ld-row"><div class="ty-meta"><b>${esc(name)}</b><code>${val}</code></div><p class="ld-sample" style="line-height:${val}">Glucagon receptor agonism raises energy expenditure and drives hepatic fat oxidation. Stacking an appetite-suppressing signal with an energy-burning one is the mechanistic bet — reduce intake and increase output.</p></div>`;
  const spaceRow = (step, val) =>
    `<div class="sp-row"><div class="sp-bar" style="width:${val}"></div><div class="ty-meta"><b>space-${step}</b><code>${val}</code></div></div>`;
  const SPACES = prof.spaces;
  const MEASURES = prof.measures;
  const RADIUS = prof.radius;
  const profiles = await listProfiles(env);
  const activeName = prof.name || "default";
  const profileRow = profiles
    .map(
      (p) =>
        `<div class="pf-row${p.name === activeName ? " on" : ""}"><b>${esc(p.label || p.name)}</b><code>${esc(p.name)}</code>${p.name === activeName ? '<span class="pf-live">● live</span>' : `<code class="pf-cmd">POST /api/design {activate:"${esc(p.name)}"}</code>`}</div>`,
    )
    .join("");
  const colorItems = [
    ["root — page ground", COLORS.root],
    ["surface — raised card", COLORS.surface],
    ["raised — deeper card", COLORS.raised],
    ["line — hairline", COLORS.line],
    ["ink — primary text", COLORS.ink],
    ["soft — body text", COLORS.soft],
    ["muted — secondary", COLORS.muted],
    ["dim — captions", COLORS.dim],
    ["accent — links, rules, emphasis", COLORS.accent],
    ["accentSoft — accent wash", COLORS.accentSoft],
    ["void — deep surface", COLORS.void],
  ].map((c) => swatch(c[0], c[1])).join("");

  const typeItems = [
    ["display", TYPE_SCALE.display],
    ["h1", TYPE_SCALE.h1],
    ["h2", TYPE_SCALE.h2],
    ["h3", TYPE_SCALE.h3],
    ["lead", TYPE_SCALE.lead],
    ["body", TYPE_SCALE.body],
    ["small", TYPE_SCALE.small],
    ["eyebrow", TYPE_SCALE.eye],
  ].map((t) => typeRow(t[0], t[1])).join("");

  const leadItems = Object.entries(LEADING).map((e) => leadRow(e[0], e[1])).join("");
  const spaceItems = Object.entries(SPACES).map((e) => spaceRow(e[0], e[1])).join("");

  const familyName = (stack) => String(stack).split(",")[0].replace(/['"]/g, "").trim();
  const fontItems = [
    ["display", FONTS.display, `${familyName(FONTS.display)} — headings, drop-cap, captions`],
    ["body", FONTS.body, `${familyName(FONTS.body)} — running text, UI`],
    ["mono", FONTS.mono, `${familyName(FONTS.mono)} — code, labels, metadata`],
  ]
    .map(
      (f) => `<div class="fn-row">
      <div class="ty-meta"><b>${esc(f[0])}</b><code>${esc(f[2])}</code></div>
      <div class="fn-sample" style="font-family:${f[1]}">Aa Bb Cc — Retatrutide 24% · مرغ · 0123456789</div>
    </div>`,
    )
    .join("");

  const styles = `
  <style>
  ${governanceChromeStyles()}
  ${cssVarOverride(prof)}
  ${platformRailCss()}
  .wd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:24px;align-items:start}
  .wd-grid .rp-card{width:100%}
  .pf-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid ${COLORS.line}}
  .pf-row b{font:600 15px/1.3 ${FONTS.body};color:${COLORS.ink}}
  .pf-row code{font:12px/1.4 ${FONTS.mono};color:${COLORS.muted}}
  .pf-row .pf-cmd{color:${COLORS.dim}}
  .pf-row.on b{color:${COLORS.accent}}
  .pf-live{font:700 11px/1 ${FONTS.body};letter-spacing:.06em;text-transform:uppercase;color:${COLORS.accent}}
  .ds-wrap{max-width:${MEASURES.wide};margin:0 auto;padding:${SPACES[4]} ${SPACES[3]} ${SPACES[6]};color:${COLORS.ink};background:${COLORS.root};font-family:${FONTS.body}}
  .ds-hero{border-bottom:1px solid ${COLORS.line};padding-bottom:${SPACES[3]};margin-bottom:${SPACES[5]}}
  .ds-hero .eyebrow{font:700 ${TYPE_SCALE.eye}/1 ${FONTS.body};letter-spacing:.14em;text-transform:uppercase;color:${COLORS.accent};margin-bottom:${SPACES[1]}}
  .ds-hero h1{font:700 ${TYPE_SCALE.h1}/${LEADING.head} ${FONTS.display};letter-spacing:-.02em;margin:0 0 ${SPACES[1]}}
  .ds-hero p{font-size:${TYPE_SCALE.lead};line-height:${LEADING.body};color:${COLORS.soft};max-width:${MEASURES.copy}}
  .ds-sec{margin:${SPACES[5]} 0}
  .ds-sec > h2{font:700 ${TYPE_SCALE.h3}/${LEADING.head} ${FONTS.display};letter-spacing:-.01em;margin:0 0 ${SPACES[1]};padding-top:${SPACES[3]};border-top:1px solid ${COLORS.line}}
  .ds-sec > .ds-note{color:${COLORS.muted};font-size:${TYPE_SCALE.small};margin:0 0 ${SPACES[3]};max-width:${MEASURES.copy}}
  .sw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:${SPACES[2]}}
  .sw{margin:0}
  .sw-chip{height:76px;border-radius:${RADIUS};border:1px solid ${COLORS.line}}
  .sw figcaption{display:flex;flex-direction:column;gap:2px;padding-top:8px}
  .sw figcaption b{font:600 13px/1.3 ${FONTS.body};color:${COLORS.ink}}
  .sw figcaption code,.ty-meta code{font:12px/1.4 ${FONTS.mono};color:${COLORS.muted}}
  .ty-row,.ld-row,.fn-row{display:grid;grid-template-columns:200px 1fr;gap:${SPACES[3]};align-items:baseline;padding:${SPACES[2]} 0;border-bottom:1px solid ${COLORS.line}}
  .ty-meta{display:flex;flex-direction:column;gap:2px}
  .ty-meta b{font:600 14px/1.3 ${FONTS.body};color:${COLORS.ink}}
  .ty-sample{color:${COLORS.ink}}
  .ld-sample{margin:0;color:${COLORS.soft};font-size:${TYPE_SCALE.body};max-width:${MEASURES.copy}}
  .fn-sample{font-size:1.4rem;color:${COLORS.ink}}
  .sp-row{display:flex;align-items:center;gap:${SPACES[2]};padding:6px 0}
  .sp-bar{height:16px;background:${COLORS.accent};border-radius:2px}
  .cmp{display:grid;gap:${SPACES[3]}}
  .cmp-card{border:1px solid ${COLORS.line};border-radius:${RADIUS};background:${COLORS.surface};padding:${SPACES[3]}}
  .cmp-kicker{font:700 ${TYPE_SCALE.eye}/1 ${FONTS.body};letter-spacing:.12em;text-transform:uppercase;color:${COLORS.accent};margin-bottom:10px}
  .cmp-h{font:700 ${TYPE_SCALE.h3}/${LEADING.head} ${FONTS.display};color:${COLORS.ink};margin:0 0 8px}
  .cmp-p{font-size:${TYPE_SCALE.body};line-height:${LEADING.body};color:${COLORS.soft};margin:0 0 12px;max-width:${MEASURES.copy}}
  .cmp-quote{border-left:3px solid ${COLORS.accent};padding-left:20px;font:italic 400 1.4rem/1.42 ${FONTS.display};color:${COLORS.ink};margin:0}
  .cmp-badges{display:flex;gap:8px;flex-wrap:wrap}
  .tierb{font:700 10px/1.6 ${FONTS.body};letter-spacing:.06em;text-transform:uppercase;color:#fff;border-radius:6px;padding:3px 9px}
  @media(max-width:640px){.ty-row,.ld-row,.fn-row{grid-template-columns:1fr;gap:8px}}
  </style>`;

  const body = `
  <div class="ds-wrap">
    <header class="ds-hero">
      <p class="eyebrow">Design system · live tokens</p>
      <h1>The control panel</h1>
      <p>The principles are immutable law: one accent, three type roles, one spacing ladder, one radius, tokens-only. The values filling them are the active profile, rendered here live — flip the profile and this page and all 2,149 articles change together. Nothing on the site invents its own color, size, or spacing.</p>
    </header>

    <section class="ds-sec">
      <h2>Profiles — flip the whole site</h2>
      <p class="ds-note">The active profile skins every page. POST a new one (or activate an existing) at <code>/api/design</code> and the site re-renders in it — no redeploy. Point at any site, extract its values into a profile, POST, and this site clones its look.</p>
      ${profileRow}
    </section>

    <section class="ds-sec">
      <h2>Color</h2>
      <p class="ds-note">The active profile's palette. The roles are law — one ground, layered surfaces, an ink ramp, one hairline, ONE accent; the hex values below belong to the active profile and flip with it.</p>
      <div class="sw-grid">${colorItems}</div>
    </section>

    <section class="ds-sec">
      <h2>Typefaces</h2>
      <p class="ds-note">Three roles. A serif display face carries headings; a humanist sans carries running text; a mono face carries code and metadata.</p>
      ${fontItems}
    </section>

    <section class="ds-sec">
      <h2>Type scale</h2>
      <p class="ds-note">Fluid clamp() sizes, shown in the display face at the heading line-height.</p>
      ${typeItems}
    </section>

    <section class="ds-sec">
      <h2>Line height</h2>
      ${leadItems}
    </section>

    <section class="ds-sec">
      <h2>Spacing scale</h2>
      <p class="ds-note">Every margin and gap on the site steps through this scale.</p>
      ${spaceItems}
    </section>

    <section class="ds-sec">
      <h2>Radius</h2>
      <p class="ds-note">One corner radius, <code>${RADIUS}</code>, on cards, figures, and the hero frame.</p>
      <div class="cmp-card" style="width:220px;height:80px"></div>
    </section>

    <section class="ds-sec">
      <h2>Components</h2>
      <p class="ds-note">The building blocks every article renders, built only from the tokens above.</p>
      <div class="cmp">
        <div class="cmp-card">
          <div class="cmp-kicker">Evidence review · standard</div>
          <div class="cmp-h">Section heading in the display serif</div>
          <p class="cmp-p">Body text in the humanist sans at the reading line-height, held to the copy measure so a line never runs too wide to track.</p>
          <blockquote class="cmp-quote">A pull-quote lifts one line into the display face with an accent rule.</blockquote>
        </div>
        <div class="cmp-card">
          <div class="cmp-kicker">Claim tiers</div>
          <div class="cmp-badges">
            <span class="tierb" style="background:#20558a">human</span>
            <span class="tierb" style="background:#3a7d5c">preclinical</span>
            <span class="tierb" style="background:#b7791f">anecdotal</span>
            <span class="tierb" style="background:${COLORS.accent}">mechanistic</span>
            <span class="tierb" style="background:${COLORS.muted}">system</span>
          </div>
        </div>
      </div>
    </section>

    <section class="ds-sec">
      <h2>Evidence widgets — sources in their native form</h2>
      <p class="ds-note">First-class citizens of the system. Every cited source renders as its platform: a tweet looks exactly like a tweet, Reddit exactly like Reddit, a WSJ story wears the WSJ masthead — and an organization speaking in its own name gets a letterhead, never someone else's masthead. Card interiors are the one sanctioned exemption from the profile tokens (the mimicry law): the platform identity IS the content. Renderer: <code>functions/_lib/widgets/rail-platform.js</code>; each card carries its ledger hash.</p>
      <div class="wd-grid">${WIDGET_SPECIMENS.map((s) => renderPlatformCard(s, "")).join("")}</div>
    </section>

    <section class="ds-sec">
      <h2>Where this lives</h2>
      <p class="ds-note">Default profile: <code>functions/_lib/design/tokens/core.js</code>. Runtime override: the active KV profile, resolved by <code>functions/_lib/design/tokens/runtime.js</code> and addressable at <code>/api/design</code> — no redeploy. The chrome and the article renderer both read the resolved profile, so every surface updates at once. The law itself lives at <a href="/a/design-law">/a/design-law</a>; it fixes roles and counts, never hex codes.</p>
    </section>
  </div>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Design system — miscsubjects</title><meta name="robots" content="noindex">${styles}</head><body>${governanceHeader("")}${body}${governanceFooter()}</body></html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" },
  });
}
