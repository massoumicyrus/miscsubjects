import { designLawHeader, designLawFooter, designLawStyles } from "./_lib/design_law.js";
import { getActiveProfile, cssVarOverride } from "./_lib/design/tokens/runtime.js";
import { SKILL_REGISTRY, skillFamilies, SKILL_FAMILY_ORDER, SKILLS_PAGE_STYLE } from "./_lib/skill_pages.js";
import { DESIGN_LAW_OBJECT } from "./_lib/design_law_object.js";
import { WRITING_LAW_OBJECT } from "./_lib/writing_law_object.js";
import { SKILL_LAW_OBJECT } from "./_lib/skill_law_object.js";
import { OUTREACH_LAW_OBJECT } from "./_lib/outreach_law_object.js";
import { LOGIC_LAW_OBJECT } from "./_lib/logic_law_object.js";
import { TENANT_LAW_OBJECT } from "./_lib/tenant_law_object.js";

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function sourcePills(skill) {
  const src = skill && skill.source;
  if (!src || (!src.license && !src.repo)) {
    return `<span class="pill">written here</span>`;
  }
  return `${src.license ? `<span class="pill">${esc(src.license)}</span>` : ""}${src.repo ? `<span class="pill">${esc(src.repo)}</span>` : ""}`;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  // Folder law: the index link downloads the whole public skill set as one folder.
  if (url.searchParams.has("bundle")) {
    const mode = url.searchParams.get("bundle") === "manifest" ? "manifest" : "zip";
    return Response.redirect(url.origin + "/api/skills/bundle?format=" + mode, 302);
  }
  const prof = await getActiveProfile(context && context.env);
  const fontLinks = (prof.fontLinks || []).map((u) => `<link rel="stylesheet" href="${u}">`).join("");

  const laws = [
    { object: SKILL_LAW_OBJECT, note: "Governs this page: when a lesson becomes a skill, who may edit it, what proof binds it." },
    { object: DESIGN_LAW_OBJECT, note: "Governs every surface these skills render on." },
    { object: WRITING_LAW_OBJECT, note: "Governs every sentence these skills produce." },
    { object: OUTREACH_LAW_OBJECT, note: "Governs every message sent to someone who did not ask to hear from the operator." },
    { object: LOGIC_LAW_OBJECT, note: "Governs every decision: what change earns the right to happen." },
    { object: TENANT_LAW_OBJECT, note: "Governs the whole loop: how a model picks the next act from the live graph, in what form, and how a failure becomes an amendment instead of a repeat." },
  ]
    .map(
      ({ object, note }) => `<article class="sk-card">
        <div class="meta"><span class="pill">law</span><span class="pill">${esc(object.version.current)}</span></div>
        <h3><a href="/a/${esc(object.identity.slug)}">${esc(object.identity.title)}</a></h3>
        <p class="desc">${esc(object.content.summary)}</p>
        <p class="prevented"><b>Why it exists:</b> ${esc(note)}</p>
        <div class="links"><a href="/a/${esc(object.identity.slug)}">Read →</a><a href="/api/articles/${esc(object.identity.slug)}/skill">Model skill →</a><a href="/a/${esc(object.identity.slug)}?bundle=1">Download folder →</a></div>
      </article>`,
    )
    .join("");

  const families = skillFamilies();
  const familyBlocks = [];
  familyBlocks.push(`<section class="sk-family"><header><h2>laws</h2><span class="count">5 canonical objects</span></header><div class="sk-grid">${laws}</div></section>`);
  for (const family of SKILL_FAMILY_ORDER) {
    if (family === "laws") continue;
    const members = families.get(family);
    if (!members || !members.length) continue;
    const cards = members
      .map((s) => {
        const prevented = s.prevents && s.prevents[0]
          ? `<p class="prevented"><b>Failure it exists to stop${s.prevents[0].date && s.prevents[0].date !== "recurring" ? " · " + esc(s.prevents[0].date) : ""}:</b> ${esc(s.prevents[0].failure)}</p>`
          : "";
        return `<article class="sk-card">
          <div class="meta">${sourcePills(s)}</div>
          <h3><a href="/skills/${esc(s.name)}">${esc(s.name)}</a></h3>
          <p class="desc">${esc(s.description)}</p>
          ${prevented}
          <div class="links"><a href="/skills/${esc(s.name)}">Read →</a><a href="/api/skills/${esc(s.name)}/skill">Model skill →</a><a href="/skills/${esc(s.name)}?bundle=1">Download folder →</a></div>
        </article>`;
      })
      .join("");
    familyBlocks.push(
      `<section class="sk-family"><header><h2>${esc(family)}</h2><span class="count">${members.length} skills</span></header><div class="sk-grid">${cards}</div></section>`,
    );
  }

  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Skills — miscsubjects",
    description:
      "The build's operating skills: every public skill as one identity — human page, model skill, downloadable folder — each tied to the real failure it exists to stop.",
    url: "https://miscsubjects.com/skills",
  }).replace(/</g, "\\u003c");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Skills — miscsubjects</title><meta name="description" content="Every public operating skill of this build: one identity, many representations — human page, model skill, downloadable folder — each tied to the real failure it exists to stop.">
  <link rel="canonical" href="https://miscsubjects.com/skills"><link rel="alternate" type="application/json" href="https://miscsubjects.com/api/skills"><script type="application/ld+json">${structured}</script>${fontLinks}<style>${designLawStyles()}${cssVarOverride(prof)}${SKILLS_PAGE_STYLE}</style></head><body>
  ${designLawHeader("skills")}
  <main>
    <header class="sk-hero"><p class="eyebrow">The loop, front-facing · ${SKILL_REGISTRY.skills.length} public skills</p><h1>Skills are how the build stops repeating failures.</h1><p class="lead">A failure happens once, becomes a skill with its exhibit named, loads for every model that works here — Claude, Codex, Grok, Kimi — and is judged by whether that failure ever happens again. Each skill below is one identity: a human page, a model skill, and a downloadable folder.</p><p class="sk-loopline">failure → exhibit → skill → both trees → every model → judged by counts — governed by <a href="/a/skill-law">the Laws of Skills</a></p></header>
    ${familyBlocks.join("")}
    <p class="sk-private-note">${SKILL_REGISTRY.private_count} operational skills are private to the build and not listed. Machine index: <span class="machine-url"><code>/api/skills</code></span> · full set as one folder: <a href="/api/skills/bundle?format=zip">skills.zip</a></p>
  </main>${designLawFooter()}</body></html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
