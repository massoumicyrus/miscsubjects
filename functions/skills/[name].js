import { designLawHeader, designLawFooter, designLawStyles } from "../_lib/design_law.js";
import { getActiveProfile, cssVarOverride } from "../_lib/design/tokens/runtime.js";
import { skillByName, skillMarkdownToHtml, SKILLS_PAGE_STYLE } from "../_lib/skill_pages.js";

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const url = new URL(context.request.url);
  const skill = skillByName(params.name);
  if (!skill) {
    return Response.redirect(new URL("/skills", url).toString(), 302);
  }
  // Folder law: this link IS the object — ?bundle=1 downloads it as one folder.
  if (url.searchParams.has("bundle")) {
    const mode = url.searchParams.get("bundle") === "manifest" ? "manifest" : "zip";
    return Response.redirect(
      url.origin + "/api/skills/" + encodeURIComponent(skill.name) + "/bundle?format=" + mode,
      302,
    );
  }
  const prof = await getActiveProfile(env);
  const fontLinks = (prof.fontLinks || []).map((u) => `<link rel="stylesheet" href="${u}">`).join("");
  const body = skillMarkdownToHtml(skill.body);

  const prevents = (skill.prevents || [])
    .map(
      (p) =>
        `<p><b>${p.date && p.date !== "recurring" ? esc(p.date) : "Recurring"}:</b> ${esc(p.failure)}</p>`,
    )
    .join("");

  const src = skill.source || {};
  const sourceLink = src.url && /^https?:/.test(src.url)
    ? `<a href="${esc(src.url)}" rel="noopener">${esc(src.repo || src.url)} ↗</a>`
    : src.repo
      ? `<span>${esc(src.repo)}</span>`
      : `<span>Written for this build — not imported from anywhere. Canonical file below.</span>`;
  const licenseLabel = src.license || "no external license — written here";

  const files = (skill.files || [])
    .map((f) => `<li>${esc(f.path)} · ${f.bytes.toLocaleString("en-US")} bytes</li>`)
    .join("");

  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    name: `${skill.name} — skill`,
    headline: skill.name,
    description: skill.description,
    url: `https://miscsubjects.com/skills/${skill.name}`,
    isPartOf: { "@type": "CollectionPage", name: "Skills — miscsubjects", url: "https://miscsubjects.com/skills" },
    license: src.license || undefined,
  }).replace(/</g, "\\u003c");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(skill.name)} — skill — miscsubjects</title><meta name="description" content="${esc(skill.description).slice(0, 300)}">
  <link rel="canonical" href="https://miscsubjects.com/skills/${esc(skill.name)}"><link rel="alternate" type="application/json" href="https://miscsubjects.com/api/skills/${esc(skill.name)}"><link rel="alternate" type="text/markdown" href="https://miscsubjects.com/api/skills/${esc(skill.name)}/skill"><script type="application/ld+json">${structured}</script>${fontLinks}<style>${designLawStyles()}${cssVarOverride(prof)}${SKILLS_PAGE_STYLE}</style></head><body>
  ${designLawHeader("skills")}
  <main>
    <header class="sk-hero"><p class="eyebrow">Skill · ${esc(skill.family)} · ${esc(licenseLabel)}</p><h1>${esc(skill.name)}</h1><p class="lead">${esc(skill.description)}</p></header>
    ${prevents ? `<section class="sk-prevented-panel"><span class="eyebrow">The failure this skill exists to stop</span>${prevents}</section>` : ""}
    <dl class="sk-provenance">
      <div><dt>Source</dt><dd>${sourceLink}</dd></div>
      <div><dt>License</dt><dd>${esc(licenseLabel)}${skill.has_license_file ? " — license file travels with the folder" : ""}</dd></div>
      <div><dt>Canonical file</dt><dd><span class="machine-url"><code>${esc(skill.canonical_source)}</code></span> synced to <span class="machine-url"><code>${esc(skill.sibling)}</code></span></dd></div>
      <div><dt>Governed by</dt><dd><a href="/a/skill-law">The Laws of Skills</a> — edits need an exhibit; judgment is a fresh-agent pair</dd></div>
    </dl>
    <article class="sk-body">${body}</article>
    ${files ? `<details class="sk-files"><summary>Folder contents · ${skill.files.length} files</summary><ul>${files}</ul></details>` : ""}
    <nav class="sk-traverse" aria-label="Representations of this skill">
      <a href="/api/skills/${esc(skill.name)}/skill">Raw SKILL.md — for models</a>
      <a href="/api/skills/${esc(skill.name)}">JSON object</a>
      <a href="/skills/${esc(skill.name)}?bundle=1">Download this skill as a folder</a>
      <a href="/skills">All skills</a>
    </nav>
  </main>${designLawFooter()}</body></html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
