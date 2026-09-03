import {
  designLawHeader,
  designLawFooter,
  designLawStyles,
} from "./_lib/design_law.js";
import { SKILL_LAW_OBJECT } from "./_lib/skill_law_object.js";
import { KNOWLEDGE_ACTION_FACETS } from "./_lib/knowledge_action_object.js";
import { getActiveProfile, cssVarOverride } from "./_lib/design/tokens/runtime.js";
import { renderLedgerThread, listComments } from "./_lib/article_ledger.js";

export async function onRequestGet(context) {
  const prof = await getActiveProfile(context && context.env);
  const fontLinks = (prof.fontLinks || [])
    .map((u) => `<link rel="stylesheet" href="${u}">`)
    .join("");
  const families = new Map();
  for (const clause of SKILL_LAW_OBJECT.content.clauses) {
    if (!families.has(clause.family)) families.set(clause.family, []);
    families.get(clause.family).push(clause);
  }
  const laws = [...families.entries()]
    .map(
      ([family, clauses]) =>
        `<section class="law-family"><header><p class="eyebrow">${family}</p><h2>${family}</h2></header><div>${clauses
          .map(
            (clause) =>
              `<article class="law-principle"><span>${clause.id}</span><div><h3>${clause.title}</h3><p>${clause.law}</p></div></article>`,
          )
          .join("")}</div></section>`,
    )
    .join("");
  const facets = KNOWLEDGE_ACTION_FACETS.map(
    (facet) => `<li><b>${facet}</b><span>${facetMeaning(facet)}</span></li>`,
  ).join("");
  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    name: SKILL_LAW_OBJECT.identity.title,
    headline: SKILL_LAW_OBJECT.identity.title,
    description: SKILL_LAW_OBJECT.content.summary,
    url: "https://miscsubjects.com/a/skill-law",
    isPartOf: { "@type": "WebSite", name: "miscsubjects" },
    about: SKILL_LAW_OBJECT.content.clauses.map((clause) => clause.title),
  }).replace(/</g, "\\u003c");
  const ledgerThread = renderLedgerThread(
    "skill-law",
    await listComments(context.env, "skill-law", 200),
    {},
  );
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${SKILL_LAW_OBJECT.identity.title} — miscsubjects</title><meta name="description" content="${SKILL_LAW_OBJECT.content.summary}">
  <link rel="canonical" href="https://miscsubjects.com/a/skill-law"><link rel="alternate" type="application/json" href="https://miscsubjects.com/api/articles/skill-law"><link rel="alternate" type="text/markdown" href="https://miscsubjects.com/api/articles/skill-law?format=markdown"><script type="application/ld+json">${structured}</script>${fontLinks}<style>${designLawStyles()}${cssVarOverride(prof)}${PAGE_STYLE}</style></head><body>
  ${designLawHeader("skill-law")}
  <main>
    <header class="law-hero"><p class="eyebrow">Canonical Knowledge-Action Object · ${SKILL_LAW_OBJECT.version.current}</p><h1>The same failure,<br>never twice.</h1><p class="lead">${SKILL_LAW_OBJECT.content.thesis}</p></header>
    <section class="law-mandate"><p class="eyebrow">The test for every skill</p>${SKILL_LAW_OBJECT.instructions.decision_mandate.map((line) => `<p>${line}</p>`).join("")}</section>
    <section class="law-sequence" aria-label="Complete skill obligations">${laws}</section>
    <section class="law-parallel"><p class="eyebrow">The loop</p><h2>Article for the human. Skill for the model. One identity.</h2><p>Every governing article on this site is also a model Skill: the <a href="/a/design-law">Design Law</a> and <a href="/a/writing-law">Writing Law</a> already work this way. This law governs the loop itself — when a lesson becomes a skill, which model may change it, and what proof a change needs before it binds the next model that loads it.</p></section>
    <section class="law-source"><div><p class="eyebrow">One identity, many expressions</p><h2>The article becomes a Skill.</h2><p>The article explains to a human. The Skill instructs a model. The folder ships every representation with one manifest and one hash lineage. Each expression uses the language its audience needs while preserving identity, meaning, version, relationships, and proof.</p></div><ol>${facets}</ol></section>
    <section class="law-coda"><p>One identity. Many typed expressions. Each optimized for its audience and role.</p><details><summary>Traverse this object</summary>${Object.entries(
      SKILL_LAW_OBJECT.representations,
    )
      .map(
        ([name, expression]) => `<a href="${expression.route}">${name.replace(/_/g, " ")} · ${expression.role}</a>`,
      )
      .join("")}</details></section>
  ${ledgerThread}</main>${designLawFooter()}</body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

function facetMeaning(facet) {
  return {
    identity: "stable address and name",
    content: "human explanation",
    instructions: "model behavior",
    relationships: "graph position",
    invocation: "executable contract",
    authority: "permission boundary",
    conformance: "claims, failures, tests, repair",
    representations: "typed expressions for human, model, router, graph, and auditor",
    version: "amendment lineage",
    provenance: "receipted history",
  }[facet];
}

const PAGE_STYLE = `
main{width:min(78rem,calc(100% - 40px));margin:auto}.law-hero{padding:clamp(80px,12vw,160px) 0 var(--space-5);border-bottom:1px solid var(--ds-line)}
.eyebrow{font:700 var(--fs-eye)/1 var(--font-mono);letter-spacing:var(--track-eye);text-transform:uppercase;color:var(--ds-accent)}.law-hero h1{max-width:12ch;margin:var(--space-3) 0;font-size:var(--fs-display);line-height:var(--lh-display)}.lead{max-width:48rem;font-size:var(--fs-lead);line-height:1.55;color:var(--ds-soft)}
.law-mandate{margin:var(--space-5) 0;padding:var(--space-4);border:1px solid var(--ds-line);border-radius:18px;background:var(--ds-surface)}.law-mandate p:not(.eyebrow){max-width:44rem;margin:8px 0;color:var(--ds-soft);font-size:var(--fs-lead)}.law-mandate p:last-child{color:var(--ds-accent);font-weight:700}.law-sequence{padding:var(--space-4) 0 var(--space-5)}.law-family{display:grid;grid-template-columns:minmax(160px,.618fr) minmax(0,1.618fr);gap:var(--space-5);padding:var(--space-5) 0;border-top:1px solid var(--ds-line)}.law-family>header{position:sticky;top:100px;align-self:start}.law-family>header h2{margin:10px 0;font-size:var(--fs-h2)}.law-principle{display:grid;grid-template-columns:54px 1fr;gap:var(--space-3);padding:0 0 var(--space-4)}.law-principle+.law-principle{padding-top:var(--space-4);border-top:1px solid var(--ds-line)}.law-principle>span{font:700 11px/1 var(--font-mono);color:var(--ds-accent)}.law-principle h3{margin:0 0 10px;font-size:var(--fs-h3)}.law-principle p{max-width:42rem;margin:0;color:var(--ds-soft);font-size:var(--fs-body);line-height:var(--lh-body)}
.law-parallel{padding:var(--space-5) 0;border-top:1px solid var(--ds-line)}.law-parallel h2{font-size:var(--fs-h2);max-width:24ch;margin:var(--space-2) 0}.law-parallel p:not(.eyebrow){max-width:44rem;color:var(--ds-soft);line-height:var(--lh-body)}.law-parallel a{color:var(--ds-accent)}
.law-source{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-5);padding:var(--space-5);background:var(--ds-surface);border:1px solid var(--ds-line);border-radius:18px}.law-source h2{font-size:var(--fs-h2);margin:var(--space-2) 0}.law-source p:not(.eyebrow){color:var(--ds-soft);line-height:var(--lh-body)}.law-source ol{list-style:none;margin:0;padding:0}.law-source li{display:flex;justify-content:space-between;gap:20px;padding:16px 0;border-bottom:1px solid var(--ds-line)}.law-source li:last-child{border:0}.law-source li span{color:var(--ds-dim);font:12px/1.4 var(--font-mono);text-align:right}
.law-coda{padding:var(--space-5) 0 clamp(100px,15vw,180px);display:flex;align-items:end;justify-content:space-between;gap:var(--space-4)}.law-coda p{max-width:32rem;font-size:var(--fs-h3);line-height:1.45}.law-coda details{position:relative}.law-coda summary{cursor:pointer;list-style:none;color:#0b0d10;background:var(--ds-accent);padding:14px 18px;border-radius:999px;font-weight:700;white-space:nowrap}.law-coda summary::-webkit-details-marker{display:none}.law-coda details[open]{padding:12px;border:1px solid var(--ds-line);border-radius:16px;background:var(--ds-surface)}.law-coda details[open] summary{margin-bottom:8px}.law-coda a{display:block;padding:9px 10px;border-radius:8px;color:var(--ds-soft);text-decoration:none;font-size:13px}.law-coda a:hover{background:var(--ds-raised);color:var(--ds-accent)}
@media(max-width:760px){.law-source,.law-family{grid-template-columns:1fr;padding:var(--space-4) 0}.law-family>header{position:static}.law-coda{align-items:start;flex-direction:column}.law-principle{grid-template-columns:42px 1fr}}
`;
