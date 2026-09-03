// MASTER DESIGN SYSTEM — canonical chrome and token surface.
// All public, governance, article, and admin surfaces compose these primitives.
//
// Tokens live in functions/_lib/design/tokens/core.js.
// Compositions live in functions/_lib/design/compositions/.
// Proofs live in functions/_lib/design/proofs/.

export {
  RATIO,
  UNIT,
  COLORS,
  FONTS,
  TYPE_SCALE,
  LEADING,
  SPACES,
  MEASURES,
  RADIUS,
} from "./design/tokens/core.js";

import {
  RATIO,
  COLORS,
  FONTS,
  TYPE_SCALE,
  LEADING,
  SPACES,
  MEASURES,
  RADIUS,
} from "./design/tokens/core.js";
import { renderCssLayers } from "./design/representations/css.js";
export { footer as designSystemFooter } from "./design/compositions/navigation-hub.js";

// Static release guards read these destinations here while the rendered links
// remain owned by the single shared navigation-hub footer composition.
export const REQUIRED_FOOTER_DESTINATIONS = Object.freeze([
  "/a/tenant-law",
  "/a/the-build-end-to-end",
  "/a/which-ai-models-are-winning",
]);

// Legacy export shape for existing consumers.
export const DESIGN_SYSTEM = Object.freeze({
  ratio: RATIO,
  base: 18,
  fonts: FONTS,
  colors: COLORS,
});

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

function navItem(href, title, note, machine = false) {
  return `<a class="ds-menu-item${machine ? " machine-link" : ""}" href="${esc(href)}"><b>${esc(title)}</b><span>${esc(note)}</span></a>`;
}

function navHub(label, eyebrow, body, active = false) {
  return `<details class="ds-nav-hub${active ? " active" : ""}"><summary>${esc(label)}</summary><div class="ds-menu"><span class="ds-menu-k">${esc(eyebrow)}</span>${body}</div></details>`;
}

export function designSystemHeader(active = "") {
  const aiTools = [
    navItem("https://chatgpt.com/", "ChatGPT", "Open this work in ChatGPT"),
    navItem("https://claude.ai/new", "Claude", "Open this work in Claude"),
    navItem("https://gemini.google.com/app", "Gemini", "Open this work in Gemini"),
    navItem("https://grok.com/", "Grok", "Open this work in Grok"),
    navItem("https://www.kimi.com/", "Kimi", "Open this work in Kimi"),
  ].join("");
  const more = [
    navItem("/graph", "Evidence maps", "See how claims and subjects relate"),
    navItem("/a/oip-spec", "Protocol specification", "Normative concepts and operation"),
    navItem("/governance/assurance", "Assurance", "What the system can actually prove"),
    navItem("/governance/integrate", "Integrate", "Human-first implementation guidance"),
    navItem("/a/oip-model-governance-and-privacy", "Governance literature", "Independent model and privacy research"),
    navItem("/a/design-law", "Design standards", "The readability rules behind every surface"),
    navItem("/a/writing-law", "Writing standards", "Opaque language is hostility — the prose rules behind every page"),
    navItem("/a/logic-law", "Operational Logic", "The decision law — what change earns the right to happen"),
    navItem("/a/outreach-law", "Outreach Law", "First contact — what a stranger is owed, and the register that never begs"),
    navItem("/a/skill-law", "Skill standards", "When a lesson becomes a skill, who may edit it, and what proof binds it"),
    navItem("/skills", "Skills", "The build's operating skills — each tied to the failure it exists to stop"),
  ].join("");
  return `<header class="ds-topbar" aria-label="miscsubjects navigation"><div class="ds-topbar-inner">
    <a class="ds-brand" href="/" aria-label="miscsubjects home"><span class="ds-mark" aria-hidden="true"><svg viewBox="0 0 100 100" width="22" height="22"><path d="M50 50 m0 -45 a45 45 0 0 1 45 45 a45 45 0 0 1 -45 45 a28 28 0 0 1 -28 -28 a17 17 0 0 1 17 -17 a10 10 0 0 1 10 10" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg></span><span>miscsubjects</span><small>autonomous operating environment</small></a>
    <nav class="ds-nav" aria-label="Primary navigation">
      <a class="ds-nav-link${active === "governance" ? " active" : ""}" href="/governance">Governance</a>
      <a class="ds-nav-link${active === "articles" ? " active" : ""}" href="/content">Research</a>
      <a class="ds-nav-link${["literature", "assurance", "integrate"].includes(active) ? " active" : ""}" href="/a/oip">OIP</a>
      ${navHub("AI tools", "Open in another model", aiTools)}
      ${navHub("More", "More destinations", more, active === "maps")}
      <a class="ds-nav-link" href="/inquire">Inquire</a>
      <a class="ds-nav-link" data-ms-auth href="/admin/login">Sign in</a>
    </nav>
    <script>(function(){if(window.__msAuthNav)return;window.__msAuthNav=1;
      fetch('/api/session',{credentials:'include'}).then(function(r){return r.ok?r.json():null;}).then(function(j){
        if(!j||!j.authed)return;
        document.querySelectorAll('[data-ms-auth]').forEach(function(ab){
          var admin=document.createElement('a');admin.className=ab.className;admin.removeAttribute&&admin.removeAttribute('data-ms-auth');admin.href='/admin';admin.textContent='Admin';
          ab.parentNode.insertBefore(admin,ab);ab.textContent='Sign out';ab.href='/admin/logout';});
      }).catch(function(){});})();</script>
  </div></header>`;
}

export function structureReaderHtml(html) {
  const parts = String(html || "")
    .split(/(?=<h2>)/g)
    .filter(Boolean);
  return parts
    .map((part, i) => {
      const heading = part.match(/^<h2>([\s\S]*?)<\/h2>/i);
      if (!heading) return `<section class="reader-opening">${part}</section>`;
      const n = String(i).padStart(2, "0");
      return `<section class="reader-chapter" data-chapter="${n}">${part}</section>`;
    })
    .join("");
}

export function designSystemStyles() {
  return renderCssLayers();
}
