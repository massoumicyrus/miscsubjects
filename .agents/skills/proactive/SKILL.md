---
name: proactive
description: When something on the build looks or works wrong (especially design), do NOT patch reactively. Find the best-in-class reference, quantify the variance against it, work backwards, and drive the fix through the master tabulation. Covers the design-profile clone system (flip the whole site to another site's look with one POST).
---

# Proactive — quantify against excellence, then flip the knob

The recurring failure is reactive patching: the owner screenshots one ugly thing, I fix that one thing, he finds the next. That loses every time. The fix is to stop patching pixels and start measuring against excellence.

## The method (every time something looks/works wrong)

1. **Name the excellent reference.** What is the best-in-class version of this thing in the world? For an AI-protocol/docs site: modelcontextprotocol.io, Stripe docs, Linear, Vercel. For article pages: the site the owner names ("make it like NickiSwift / BuzzFeed / <tech site>"). Open it in the browser and look.
2. **Quantify the variance.** Turn the difference into numbers, not adjectives. Measure both sides: ground color, ink color, accent, hairline; body font, heading font, number of fonts; body size, h1/h2/h3 sizes, line-height; paragraph measure; spacing scale; corner radius; density. "It looks amateur" is not actionable; "their body is 18px/1.7 in a 65ch measure on #fff, mine is 17px/1.7 on warm paper with an uppercase serif h2" is.
3. **Work backwards from the reference** into the master tabulation — change the tokens, never a one-off literal in one component.
4. **Verify in the browser** against the reference, side by side. The test the owner set: if the reference looks like a product and mine doesn't, a specific element is still off-token — find it and route it through a token.

## The master tabulation (the knobs)

Every quantifiable design value lives in ONE place and is flippable at runtime:

- **Default (fallback):** `functions/_lib/design/tokens/core.js` — colors, fonts, typeScale, leading, spaces, measures, radius.
- **Runtime resolver:** `functions/_lib/design/tokens/runtime.js` — reads the ACTIVE profile from KV (`design:active` → `design:profile:<name>`), merges it over the default, and emits a `cssVarOverride` injected on every page.
- **See every knob:** `/design` (live, rendered from the active profile) — swatches, type specimens, leading, spacing, radius, components, and the profile list.
- **Machine surface:** `GET /api/design` returns `{active, profiles[], default, schema}`. The schema is the full shape of a profile.

## Flip the whole site to another site's look (the clone move)

When the owner says "make it look like <site>":

1. **Open the target in the browser** (`mcp__Claude_Browser__navigate` to their article/page).
2. **Extract their computed design** — run JS in the page to read real values:
   ```
   const b=getComputedStyle(document.body);
   const h1=document.querySelector('h1'); const p=document.querySelector('p');
   // read: b.backgroundColor, b.color, b.fontFamily; h1 fontFamily/fontSize/fontWeight/lineHeight;
   //       p fontSize/lineHeight; link color; heading color; border/hairline colors; radius on cards
   ```
   Sample several elements. Convert to the profile shape (colors, fonts, typeScale, leading, radius). Add their Google-Fonts `fontLinks` if they use webfonts so the faces load.
3. **POST the profile and activate it** (owner token required — the owner pastes this, or use his key):
   ```
   POST https://miscsubjects.com/api/design
   {"profile":{"name":"nickiswift","label":"NickiSwift clone","colors":{…},"fonts":{…},"typeScale":{…},"leading":{…},"radius":"…","fontLinks":["…"]},"activate":true}
   ```
   The site re-skins immediately, no redeploy. Reload any page.
4. **Band-check before activation.** A clone profile must land inside the quantified reading bands (design-law v1.4.0): body 15–25px, line spacing 120–145% of size, measure 45–90 characters. If the target site violates a band, correct the profile toward the band — clone the identity, not the defect.
5. **Revert** anytime: `POST {"activate":"default"}`.
6. **Verify** the flipped site against the target in the browser; tune the profile values and re-POST until it matches.
7. **Describe by role, never by hue.** When a profile is active, docs/UI copy must not name its values ("deep teal", "Source Serif") as fixed facts — /design derives every name from the live token. Principles are law; values are profile (design-law v1.4.0).

Proven 2026-07-23: a "midnight" dark profile written to KV re-skinned every page (dark ground, light ink, blue accent) in one write; reverting to `default` restored the warm theme.

## Known residual (route through tokens when touched)

A few components still hold literal colors that don't flip (e.g. the peptide safety banner `#fff5f5`, hero images are fixed art). When you touch one, convert its literal to the token/`var(--ds-*)` so the next profile flip carries it too. The goal state: zero literals — every surface flips.

## HARD GATE: open the page in the browser after every deploy, before naming the URL

Never hand the owner a URL you have not loaded in a real browser AFTER the last deploy. A refactor that passed `node --check` still shipped `/design` as a blank "render error" once (module-scope helpers referenced tokens moved into the handler). `node --check` catches syntax, not runtime ReferenceErrors in the render path. The rule:

1. Deploy.
2. Navigate the exact URL in the browser (`mcp__Claude_Browser__navigate`, force reload / cache-bust `?v=<n>`).
3. Assert `document.body.innerText` is not "render error" / empty, and the expected elements exist.
4. Only then report the URL to the owner.

A green ship log is NOT proof the page renders. The rendered screenshot is. Runtime code that reads request-scoped values (env, KV, active profile) must be exercised against a live request, never assumed.

## This applies beyond design

Same loop for any capability: name the best-in-class version, quantify the gap, encode the controls once, flip. Never hand the owner a reactive one-off when the real fix is a knob.
