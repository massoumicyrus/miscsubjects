// GET /a/coding-law (and /coding-law) — the law page.
//
// A hash when the work starts, a hash when the work commits. Rendered from the canonical object in
// functions/_lib/coding_law_object.js; this file is a projection and holds no semantics of its own.

import {
  designLawHeader,
  designLawFooter,
  designLawStyles,
} from "./_lib/design_law.js";
import { CODING_LAW_OBJECT } from "./_lib/coding_law_object.js";
import { KNOWLEDGE_ACTION_FACETS } from "./_lib/knowledge_action_object.js";
import { getActiveProfile, cssVarOverride } from "./_lib/design/tokens/runtime.js";
import { renderLedgerThread, listComments } from "./_lib/article_ledger.js";

const HERO = "https://miscsubjects.com/img/gen/arcads-coding-law-hash-de861fe1-7e78-4f8e-bc81-2419ac00eef2.png";

export async function onRequestGet(context) {
  const prof = await getActiveProfile(context && context.env);
  const fontLinks = (prof.fontLinks || [])
    .map((u) => `<link rel="stylesheet" href="${u}">`)
    .join("");
  const families = new Map();
  for (const clause of CODING_LAW_OBJECT.content.clauses) {
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
    name: CODING_LAW_OBJECT.identity.title,
    headline: CODING_LAW_OBJECT.identity.title,
    description: CODING_LAW_OBJECT.content.summary,
    url: "https://miscsubjects.com/a/coding-law",
    isPartOf: { "@type": "WebSite", name: "miscsubjects" },
    about: CODING_LAW_OBJECT.content.clauses.map((clause) => clause.title),
  }).replace(/</g, "\\u003c");

  const ledgerThread = renderLedgerThread(
    "coding-law",
    await listComments(context.env, "coding-law", 200),
    {},
  );
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${CODING_LAW_OBJECT.identity.title} — miscsubjects</title><meta name="description" content="${CODING_LAW_OBJECT.content.summary}">
  <meta property="og:image" content="${HERO}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${HERO}"><link rel="canonical" href="https://miscsubjects.com/a/coding-law"><link rel="alternate" type="application/json" href="https://miscsubjects.com/api/articles/coding-law"><link rel="alternate" type="text/markdown" href="https://miscsubjects.com/api/articles/coding-law?format=markdown"><script type="application/ld+json">${structured}</script>${fontLinks}<style>${designLawStyles()}${cssVarOverride(prof)}${PAGE_STYLE}</style></head><body>
  ${designLawHeader("coding-law")}
  <main>
    <figure class="law-plate"><img src="${HERO}" alt="Two identical sealed envelopes on a workbench, one stamped on opening and one stamped on closing" width="1536" height="1024" fetchpriority="high"><figcaption>The version you read is a fact. Put it on the record before you touch the file, and again when you let it go.</figcaption></figure>
    <header class="law-hero"><p class="eyebrow">Canonical Knowledge-Action Object · ${CODING_LAW_OBJECT.version.current}</p><h1>A hash to start.<br>A hash to commit.</h1><p class="lead">${CODING_LAW_OBJECT.content.thesis}</p></header>

    <section class="law-calls">
      <p class="eyebrow">The whole procedure</p>
      <h2>Two calls, and one answer that matters.</h2>
      <pre><code># before your first edit
curl -s -X POST https://miscsubjects.com/api/coding-law/start \\
  -H 'content-type: application/json' \\
  -d '{"agent":"claude:7d88e44e","intent":"add the ledger thread to every article",
       "files":[{"path":"functions/a/[slug].js","base_sha":"&lt;shasum -a 256 of what you read&gt;"}]}'

# immediately before git commit
curl -s -X POST https://miscsubjects.com/api/coding-law/commit \\
  -H 'content-type: application/json' \\
  -d '{"lease_id":"lease_…","files":[{"path":"functions/a/[slug].js","new_sha":"&lt;shasum -a 256 now&gt;"}]}'</code></pre>
      <p><b>200</b> means every file you leased is still at the version you read. Commit.<br>
      <b>409</b> means someone committed one of them after you read it, and your commit was about to erase their work. Re-read the named file, redo the edit on the new text, open a fresh lease. Never force, never retry the same body.</p>
      <p class="law-links"><a href="/api/coding-law">The endpoint, as machine data</a> · <a href="/api/coding-law/leases">The chain — who committed what, from what base</a> · <a href="/api/articles/coding-law/skill">The skill</a> · <a href="/api/articles/coding-law?format=markdown">Markdown</a></p>
    </section>

    <section class="law-mandate"><p class="eyebrow">Resolve before the first edit</p>${CODING_LAW_OBJECT.instructions.decision_mandate.map((line) => `<p>${line}</p>`).join("")}</section>
    <section class="law-sequence" aria-label="The coding law">${laws}</section>

    <section class="law-parallel"><p class="eyebrow">Why claiming a file was not enough</p><h2>A claim says where you are. A hash says what you are working from.</h2><p>This build already had a file-claim system: an agent locks a path, edits it, releases it. It stops two agents typing into the same file at the same moment, and it stopped nothing else. An agent that read a file, went away to think, and came back to write had a claim that told it nothing about whether the text underneath had moved. The version it read was never written down, so the one question that detects an overwrite — <em>is my base still the newest committed version of this path?</em> — had no data to answer with. The <a href="/a/skill-law">claim</a> and this law are complementary: who, and from what. Both, never either.</p></section>

    <section class="law-source"><div><p class="eyebrow">One identity, many expressions</p><h2>The law becomes a Skill and an endpoint.</h2><p>The page explains it to a person. The Skill tells a model what to do before its first edit. The endpoint enforces it. The deploy gate refuses to ship code that skipped it. Each expression uses the language its audience needs; none of them can drift, because all four read the same object.</p></div><ol>${facets}</ol></section>

    <section class="law-coda"><p>One identity. Many typed expressions. Each optimized for its audience and role.</p><details><summary>Traverse this object</summary>${Object.entries(
      CODING_LAW_OBJECT.representations,
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
.law-plate{margin:var(--space-4) 0 0;position:relative;border-radius:20px;overflow:hidden;border:1px solid var(--ds-line);background:var(--ds-surface)}
.law-plate img{display:block;width:100%;height:clamp(240px,38vw,520px);object-fit:cover;object-position:center}
.law-plate figcaption{padding:16px 20px;color:var(--ds-soft);font-size:14px;line-height:1.5;border-top:1px solid var(--ds-line);max-width:62ch}
main{width:min(78rem,calc(100% - 40px));margin:auto}.law-hero{padding:clamp(60px,9vw,120px) 0 var(--space-5);border-bottom:1px solid var(--ds-line)}
.eyebrow{font:700 var(--fs-eye)/1 var(--font-mono);letter-spacing:var(--track-eye);text-transform:uppercase;color:var(--ds-accent)}.law-hero h1{max-width:14ch;margin:var(--space-3) 0;font-size:var(--fs-display);line-height:var(--lh-display)}.lead{max-width:48rem;font-size:var(--fs-lead);line-height:1.55;color:var(--ds-soft)}
.law-calls{margin:var(--space-5) 0;padding:var(--space-4);border:1px solid var(--ds-line);border-radius:18px;background:var(--ds-surface)}
.law-calls h2{margin:8px 0 14px;font-size:var(--fs-h2);max-width:24ch}
.law-calls pre{background:var(--ds-bg);border:1px solid var(--ds-line);border-radius:12px;padding:16px 18px;overflow-x:auto;font-size:13px;line-height:1.55;margin:14px 0}
.law-calls p{max-width:52rem;color:var(--ds-soft);line-height:var(--lh-body);font-size:var(--fs-body)}
.law-calls a{color:var(--ds-accent)}.law-links{font-size:14px}
.law-mandate{margin:var(--space-5) 0;padding:var(--space-4);border:1px solid var(--ds-line);border-radius:18px;background:var(--ds-surface)}.law-mandate p:not(.eyebrow){max-width:44rem;margin:8px 0;color:var(--ds-soft);font-size:var(--fs-lead)}.law-mandate p:last-child{color:var(--ds-accent);font-weight:700}
.law-sequence{padding:var(--space-4) 0 var(--space-5)}.law-family{display:grid;grid-template-columns:minmax(160px,.618fr) minmax(0,1.618fr);gap:var(--space-5);padding:var(--space-5) 0;border-top:1px solid var(--ds-line)}.law-family>header{position:sticky;top:100px;align-self:start}.law-family>header h2{margin:10px 0;font-size:var(--fs-h2)}.law-principle{display:grid;grid-template-columns:54px 1fr;gap:var(--space-3);padding:0 0 var(--space-4)}.law-principle+.law-principle{padding-top:var(--space-4);border-top:1px solid var(--ds-line)}.law-principle>span{font:700 11px/1 var(--font-mono);color:var(--ds-accent)}.law-principle h3{margin:0 0 10px;font-size:var(--fs-h3)}.law-principle p{max-width:42rem;margin:0;color:var(--ds-soft);font-size:var(--fs-body);line-height:var(--lh-body)}
.law-parallel{padding:var(--space-5) 0;border-top:1px solid var(--ds-line)}.law-parallel h2{font-size:var(--fs-h2);max-width:26ch;margin:var(--space-2) 0}.law-parallel p:not(.eyebrow){max-width:48rem;color:var(--ds-soft);line-height:var(--lh-body)}.law-parallel a{color:var(--ds-accent)}
.law-source{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-5);padding:var(--space-5);background:var(--ds-surface);border:1px solid var(--ds-line);border-radius:18px}.law-source h2{font-size:var(--fs-h2);margin:var(--space-2) 0}.law-source p:not(.eyebrow){color:var(--ds-soft);line-height:var(--lh-body)}.law-source ol{list-style:none;margin:0;padding:0}.law-source li{display:flex;justify-content:space-between;gap:20px;padding:16px 0;border-bottom:1px solid var(--ds-line)}.law-source li:last-child{border:0}.law-source li span{color:var(--ds-dim);font:12px/1.4 var(--font-mono);text-align:right}
.law-coda{padding:var(--space-5) 0 clamp(100px,15vw,180px);display:flex;align-items:end;justify-content:space-between;gap:var(--space-4)}.law-coda p{max-width:32rem;font-size:var(--fs-h3);line-height:1.45}.law-coda details{position:relative}.law-coda summary{cursor:pointer;list-style:none;color:#0b0d10;background:var(--ds-accent);padding:14px 18px;border-radius:999px;font-weight:700;white-space:nowrap}.law-coda summary::-webkit-details-marker{display:none}.law-coda details[open]{padding:12px;border:1px solid var(--ds-line);border-radius:16px;background:var(--ds-surface)}.law-coda details[open] summary{margin-bottom:8px}.law-coda a{display:block;padding:9px 10px;border-radius:8px;color:var(--ds-soft);text-decoration:none;font-size:13px}.law-coda a:hover{background:var(--ds-raised);color:var(--ds-accent)}
@media(max-width:760px){.law-source,.law-family{grid-template-columns:1fr;padding:var(--space-4) 0}.law-family>header{position:static}.law-coda{align-items:start;flex-direction:column}.law-principle{grid-template-columns:42px 1fr}}
`;
