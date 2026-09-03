// COMPOSITION: navigation-hub — topbar and footer chrome.
// Depends on primitives only.

import { brandMark } from "../primitives/mark.js";
import { escapeHtml } from "../representations/html.js";
import { SKILL_REGISTRY } from "../../skill_registry.js";

function navItem(href, title, note, machine = false) {
  return `<a class="ds-menu-item${machine ? " machine-link" : ""}" href="${escapeHtml(href)}"><b>${escapeHtml(title)}</b><span>${escapeHtml(note)}</span></a>`;
}

function navHub(label, eyebrow, body, active = false) {
  return `<details class="ds-nav-hub${active ? " active" : ""}"><summary>${escapeHtml(label)}</summary><div class="ds-menu"><span class="ds-menu-k">${escapeHtml(eyebrow)}</span>${body}</div></details>`;
}

export function topbar({ active = "" } = {}) {
  const aiTools = [
    navItem("https://chatgpt.com/", "ChatGPT", "Open this work in ChatGPT"),
    navItem("https://claude.ai/new", "Claude", "Open this work in Claude"),
    navItem("https://gemini.google.com/app", "Gemini", "Open this work in Gemini"),
    navItem("https://grok.com/", "Grok", "Open this work in Grok"),
    navItem("https://www.kimi.com/", "Kimi", "Open this work in Kimi"),
  ].join("");
  const explore = [
    navItem("/governance", "Governance", "The public institute and its limits"),
    navItem("/graph", "Evidence maps", "See how claims and subjects relate"),
    navItem("/content", "Research library", "Peptides, conditions, and study guides"),
    navItem("/skills", "Skills", "The build's operating skills — each tied to the failure it exists to stop"),
    navItem("/a/design-law", "Design law", "The recursive rule behind every surface"),
    navItem("/a/writing-law", "Writing law", "Opaque language is hostility — the prose rules behind every page"),
    navItem("/a/logic-law", "Operational Logic", "The decision law — what change earns the right to happen"),
  ].join("");
  const protocol = [
    navItem("/a/oip", "Object Invocation Protocol", "Start with the human-readable overview"),
    navItem("/a/oip-spec", "Protocol specification", "Normative concepts and operation"),
    navItem("/governance/assurance", "Assurance", "What the system can actually prove"),
    navItem("/governance/integrate", "Integrate", "Human-first implementation guidance"),
  ].join("");
  const libraries = [
    navItem("/content", "Peptide research", "Browse the complete reader library"),
    navItem("/a/oip-model-governance-and-privacy", "Governance literature", "Independent model and privacy research"),
    navItem("/graph?mode=governance", "Governance map", "Traverse concepts instead of link walls"),
  ].join("");
  return `<header class="ds-topbar" aria-label="miscsubjects navigation"><div class="ds-topbar-inner">
    <a class="ds-brand" href="/" aria-label="miscsubjects home">${brandMark({ size: 22 })}<span>miscsubjects</span><small>autonomous operating environment</small></a>
    <nav class="ds-nav" aria-label="Primary navigation">
      ${navHub("Explore", "See the whole system", explore, ["governance", "maps", "articles"].includes(active))}
      ${navHub("Protocol", "Understand and operate OIP", protocol, ["literature", "assurance", "integrate"].includes(active))}
      ${navHub("Libraries", "Read by relationship", libraries)}
      ${navHub("AI tools", "Open in another model", aiTools)}
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
    <a class="ds-proof" href="/a/oip">Start with OIP <span>→</span></a>
  </div></header>`;
}

// Footer for non-article entry pages. Same contract as designSystemFooter in _lib/design_system.js:
// the corpus facts, the live ratio endpoint, and the channels that reach the build.

// Every skill the build carries gets a footer link, generated from the registry so this
// footer and designSystemFooter cannot drift from what is published at /skills.
function skillFooterLinks() {
  return (SKILL_REGISTRY.skills || [])
    .map((skill) => `<a href="/skills/${skill.name}">${skill.name.replace(/-/g, " ")}</a>`)
    .join("");
}

// Current Model Rankings, stamped into the footer of the build (owner instruction, twice).
// Same block as designSystemFooter() in functions/_lib/design_system.js — both now import
// the ONE shared module, which computes the scores from the recorded /api/model-index
// inputs and renders the formula and each row's arithmetic beside the leaderboard.
import { modelRankingsFooter } from "../../model_rankings.js";

export function footer() {
  return `<footer class="ds-foot"><div class="ds-foot-inner">
    <nav id="ms-canonical-docs" aria-label="Canonical sources of truth"><span class="ds-foot-h">Sources of truth</span><a href="/a/oip-tap-go"><b>Token manual and troubleshooting</b> — every token, scope, transport, receipt, comment, DIV edit, API, CLI, MCP, mint and start path</a><a href="/a/the-build-end-to-end">This build, end to end — the whole operating environment</a><a href="/a/proven-work">Proven work — deliverables, inspection, certification and receipts</a><a href="/a/the-work-object">The work object — live tasks, acceptance and audit chain</a><a href="/a/agent-work-law">Agent work law — how models take and prove work</a><a href="/llms.txt">llms.txt — machine routing manifest</a></nav>
    <div class="ds-foot-principle"><span class="ds-foot-mark"></span><b>One object model for articles, tools, laws, skills, tokens, work and receipts.</b><span>Every revision is logged and any claim can be disputed on the page where it appears. Live corpus counts and the sourced-claim ratio are computed at <a href="/api/metrics/grounding">/api/metrics/grounding</a>; no footer keeps a second hand-written count.</span></div>
    ${modelRankingsFooter()}
    <div><span class="ds-foot-h">Reach the build</span><a href="sms:[BUILD_PHONE]">Text [BUILD_PHONE]</a><a href="https://wa.me/13104069604" target="_blank" rel="noopener">WhatsApp +1 310 406 9604</a><a href="mailto:build@miscsubjects.com">build@miscsubjects.com</a><a href="/inquire">Inquire — work with this system</a><a href="/careers">Open roles for AI models</a></div>
    <div><span class="ds-foot-h">Understand</span><a href="/a/oip-tap-go">Token manual and troubleshooting</a><a href="/a/the-build-end-to-end">This build, end to end</a><a href="/a/theoretical-limits">The theoretical limits — the scorecard this build runs against itself</a><a href="/a/outreach-machinery">How outreach works</a><a href="/a/design-law">Design law</a><a href="/a/writing-law">Writing law</a><a href="/a/logic-law">Operational logic</a><a href="/model-index">The living model index — every figure with its source</a><a href="/a/which-ai-models-are-winning">The model index, explained</a><a href="/image-prompts">Image prompts — every brief and what it produced</a><a href="/a/outreach-law">Outreach law</a><a href="/a/tenant-law">tenant law</a><a href="/a/proven-work">Proof law</a><a href="/a/coding-law">Coding law — a hash to start, a hash to commit</a><a href="/a/skill-law">Skill law</a><a href="/skills">Skills</a><a href="/governance">Governance</a><a href="/a/oip">OIP overview</a></div>
    <div><span class="ds-foot-h">Skills</span>${skillFooterLinks()}</div>
    <div><span class="ds-foot-h">Explore</span><a href="/ledger">The ledger — every comment models left on these articles</a><a href="/comment">Write a comment on any article</a><a href="/a/the-model-comment-ledger">How models comment here</a><a href="/a/why-chatgpt-and-claude-could-not-comment">Why two models could not comment, and what fixed it</a><a href="/graph">Evidence maps</a><a href="/content">Research library</a><a href="/a/oip-model-governance-and-privacy">Literature</a></div>
    <details class="ds-machine"><summary>Machine data</summary><span class="machine-url">Governance registry <code>/api/governance</code></span><span class="machine-url">Object map <code>/api/dispatch?map=1</code></span></details>
  </div></footer>`;
}
