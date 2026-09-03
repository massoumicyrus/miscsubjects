// /a/outreach-law — the human page for the Outreach Law.
//
// Same composition as the other law pages (hero, mandate, clause families, traverse) with two
// additions this law needs: an exhibit board that puts an accepted sentence beside the rejected one
// it replaced, dated, so taste is auditable rather than asserted; and a reading card for the one
// book behind the register.
import {
  designLawHeader,
  designLawFooter,
  designLawStyles,
} from "./_lib/design_law.js";
import { OUTREACH_LAW_OBJECT } from "./_lib/outreach_law_object.js";
import { KNOWLEDGE_ACTION_FACETS } from "./_lib/knowledge_action_object.js";
import { getActiveProfile, cssVarOverride } from "./_lib/design/tokens/runtime.js";
// EVERY PAGE A READER CALLS AN ARTICLE CARRIES THE THREAD (owner order 2026-08-05). The law pages
// are read as articles and are linked from the footer as articles, so exempting them would have made
// "every article" mean "every article except the ones stating the rules".
import { renderLedgerThread, listComments } from "./_lib/article_ledger.js";

const HERO =
  "https://miscsubjects.com/img/gen/arcads-law-outreach-e72e29d4-c382-4598-8fcf-de1675accfc2.png";

// Every exhibit is real: accepted lines were sent or approved, rejected lines were produced by the
// build and refused by the owner. Dates are the dates they occurred.
const EXHIBITS = [
  {
    clause: "OU07",
    subject: "The opener",
    good: "You use Healthie for booking — we supply research peptides wholesale.",
    goodNote: "Sent 2026-07-24. A fact from their own page, then the mechanism. Nothing else.",
    bad: "It looks like Coral Gables Wellness is positioned perfectly to expand into new wellness offerings, especially with your focus on hormone health and TRT.",
    badNote: "Refused 2026-07-23. Inference dressed as comprehension: positioned, perfectly, focus on, expand into.",
  },
  {
    clause: "OU16",
    subject: "The first step",
    good: "Initial orders can be as small as three units, sufficient to evaluate supply, documentation, and fulfillment.",
    goodNote: "Professional evaluation. The smallness is their convenience.",
    bad: "Want to try three units for $75?",
    badNote: "Refused 2026-07-25. Same quantity, consumer register — it casts a clinic as a bargain shopper and prices the correspondence at $75.",
  },
  {
    clause: "OU21",
    subject: "The whole corpus",
    good: "We supply research peptides wholesale to businesses in Stamford and Greenwich.",
    goodNote: "Weak, but it is at least about them.",
    bad: "We supply research peptides wholesale.",
    badNote: "121 drafts, 2026-07-25. The identical sentence under the identical four-word subject, because the rule in force banned every fact their sites actually contained. Interchangeable mail is spam no matter how strict the rule that produced it.",
  },
];

export async function onRequestGet(context) {
  const prof = await getActiveProfile(context && context.env);
  const fontLinks = (prof.fontLinks || [])
    .map((u) => `<link rel="stylesheet" href="${u}">`)
    .join("");
  const families = new Map();
  for (const clause of OUTREACH_LAW_OBJECT.content.clauses) {
    if (!families.has(clause.family)) families.set(clause.family, []);
    families.get(clause.family).push(clause);
  }
  const laws = [...families.entries()]
    .map(
      ([family, clauses]) =>
        `<section class="law-family"><header><p class="eyebrow">${family}</p><h2>${family}</h2><p class="fam-count">${clauses.length} ${clauses.length === 1 ? "clause" : "clauses"}</p></header><div>${clauses
          .map(
            (clause) =>
              `<article class="law-principle" id="${clause.id}"><span>${clause.id}</span><div><h3>${clause.title}</h3><p>${clause.law}</p></div></article>`,
          )
          .join("")}</div></section>`,
    )
    .join("");
  const exhibits = EXHIBITS.map(
    (e) => `<article class="exhibit">
      <header><p class="eyebrow">${e.subject}</p><a href="#${e.clause}">${e.clause}</a></header>
      <div class="ex-pair">
        <div class="ex ex-good"><p class="ex-tag">Acceptable</p><blockquote>${e.good}</blockquote><p class="ex-note">${e.goodNote}</p></div>
        <div class="ex ex-bad"><p class="ex-tag">Refused</p><blockquote>${e.bad}</blockquote><p class="ex-note">${e.badNote}</p></div>
      </div>
    </article>`,
  ).join("");
  const facets = KNOWLEDGE_ACTION_FACETS.map(
    (facet) => `<li><b>${facet}</b><span>${facetMeaning(facet)}</span></li>`,
  ).join("");
  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    name: OUTREACH_LAW_OBJECT.identity.title,
    headline: OUTREACH_LAW_OBJECT.identity.title,
    description: OUTREACH_LAW_OBJECT.content.summary,
    image: HERO,
    url: "https://miscsubjects.com/a/outreach-law",
    isPartOf: { "@type": "WebSite", name: "miscsubjects" },
    about: OUTREACH_LAW_OBJECT.content.clauses.map((clause) => clause.title),
  }).replace(/</g, "\\u003c");
  const ledgerThread = renderLedgerThread(
    "outreach-law",
    await listComments(context.env, "outreach-law", 200),
    {},
  );
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${OUTREACH_LAW_OBJECT.identity.title} — miscsubjects</title><meta name="description" content="${OUTREACH_LAW_OBJECT.content.summary}">
  <meta property="og:title" content="${OUTREACH_LAW_OBJECT.identity.title}"><meta property="og:description" content="${OUTREACH_LAW_OBJECT.content.summary}"><meta property="og:image" content="${HERO}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${HERO}">
  <link rel="canonical" href="https://miscsubjects.com/a/outreach-law"><link rel="alternate" type="application/json" href="https://miscsubjects.com/api/articles/outreach-law"><link rel="alternate" type="text/markdown" href="https://miscsubjects.com/api/articles/outreach-law?format=markdown"><script type="application/ld+json">${structured}</script>${fontLinks}<style>${designLawStyles()}${cssVarOverride(prof)}${PAGE_STYLE}</style></head><body>
  ${designLawHeader("outreach-law")}
  <main>
    <figure class="law-plate"><img src="${HERO}" alt="A single sheet of cream laid paper, a folded letter and a fountain pen on a dark walnut desk in low raking light" width="1536" height="1024" fetchpriority="high"><figcaption>First contact is one page on someone else's desk. It is read in thirty seconds, from their chair, cold.</figcaption></figure>
    <header class="law-hero"><p class="eyebrow">Canonical Knowledge-Action Object · ${OUTREACH_LAW_OBJECT.version.current}</p><h1>Their inattention<br>has standing.</h1><p class="lead">${OUTREACH_LAW_OBJECT.content.thesis}</p></header>
    <section class="law-mandate"><p class="eyebrow">Resolve before sending</p>${OUTREACH_LAW_OBJECT.instructions.decision_mandate.map((line) => `<p>${line}</p>`).join("")}</section>
    <section class="law-test"><p class="eyebrow">The test</p><h2>Read it from their chair, cold, thirty seconds.</h2><ol><li><b>What did they gain by reading it?</b><span>Something concrete</span></li><li><b>What would they risk by replying?</b><span>Almost nothing</span></li><li><b>What are they obligated to do?</b><span>Almost nothing</span></li></ol><p class="law-test-foot">Any other three answers and the draft fails. The principle is radical asymmetry, not literal zero — never fabricate a guarantee to reach zero.</p></section>
    <section class="law-sequence" aria-label="The complete outreach law">${laws}</section>
    <section class="law-exhibits"><header><p class="eyebrow">Memorialized taste</p><h2>The same content at two registers. One was sent; one was refused.</h2><p>Taste asserted is worthless, so it is recorded here as pairs. Every line below is real — the accepted ones went out or were approved, the refused ones were produced by this build and rejected, on the dates shown.</p></header>${exhibits}</section>
    <section class="law-reading"><div class="book" aria-hidden="true"><span class="book-spine"></span><span class="book-face"><b>The Machiavellian's<br>Guide to Charm</b><i>Nick Casanova</i></span></div><div><p class="eyebrow">Behind the register</p><h2>Charm is preparation, not performance.</h2><p>The register in this law is not politeness and it is not warmth. It is the position of someone who arrived already useful and needs nothing from the room — attention earned by having done the work in advance, and the discipline never to announce it. The book is here because it treats charm as a mechanism with parameters rather than a personality trait, which is the only frame in which it can be written into a rule.</p><p class="reading-note">Recommended by the owner as genuinely good, and read here for one idea only: charm is structural. The offer carries the argument; the sentence merely describes the architecture.</p></div></section>
    <section class="law-parallel"><p class="eyebrow">Where this sits</p><h2>Logic decides whether to move. Writing decides whether the sentence lives. This law decides what a stranger is owed.</h2><p><a href="/a/logic-law">Operational Logic</a> governs whether the change earns its existence. The <a href="/a/writing-law">Writing Law</a> governs whether the sentence earns its place. The <a href="/a/design-law">Design Law</a> governs whether the element earns the pixel. This law governs the one case where the reader never asked to hear from you at all — and therefore the only case where the entire burden of justification sits on the sender.</p></section>
    <section class="law-source"><div><p class="eyebrow">One identity, many expressions</p><h2>The page becomes a Skill.</h2><p>The page explains the law to a person. The <a href="/api/articles/outreach-law?format=skill">Skill</a> tells a model how to decide. The directory row exposes the live contract. Each expression uses the language its audience needs while preserving identity, meaning, version, relationships, and proof.</p></div><ol>${facets}</ol></section>
    <section class="law-coda"><p>One identity. Many typed expressions. Each optimized for its audience and role.</p><details><summary>Traverse this object</summary>${Object.entries(
      OUTREACH_LAW_OBJECT.representations,
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
main{width:min(78rem,calc(100% - 40px));margin:auto}
.law-plate{margin:var(--space-4) 0 0;position:relative;border-radius:20px;overflow:hidden;border:1px solid var(--ds-line);background:var(--ds-surface)}
.law-plate img{display:block;width:100%;height:clamp(240px,38vw,520px);object-fit:cover;object-position:center}
.law-plate figcaption{padding:16px 20px;color:var(--ds-soft);font-size:var(--fs-small,14px);line-height:1.5;border-top:1px solid var(--ds-line);max-width:62ch}
.law-hero{padding:var(--space-5) 0 var(--space-5);border-bottom:1px solid var(--ds-line)}
.eyebrow{font:700 var(--fs-eye)/1 var(--font-mono);letter-spacing:var(--track-eye);text-transform:uppercase;color:var(--ds-accent)}
.law-hero h1{max-width:14ch;margin:var(--space-3) 0;font-size:var(--fs-display);line-height:var(--lh-display)}
.lead{max-width:48rem;font-size:var(--fs-lead);line-height:1.55;color:var(--ds-soft)}
.law-mandate{margin:var(--space-5) 0;padding:var(--space-4);border:1px solid var(--ds-line);border-radius:18px;background:var(--ds-surface)}
.law-mandate p:not(.eyebrow){max-width:44rem;margin:8px 0;color:var(--ds-soft);font-size:var(--fs-lead)}
.law-test{margin:var(--space-5) 0;padding:var(--space-5);border:1px solid var(--ds-accent);border-radius:18px;background:var(--ds-surface)}
.law-test h2{margin:var(--space-2) 0 var(--space-4);font-size:var(--fs-h2);max-width:30ch}
.law-test ol{list-style:none;margin:0;padding:0;display:grid;gap:0}
.law-test li{display:flex;justify-content:space-between;align-items:baseline;gap:24px;padding:16px 0;border-top:1px solid var(--ds-line)}
.law-test li b{font-weight:600;font-size:var(--fs-body)}
.law-test li span{color:var(--ds-accent);font:700 13px/1 var(--font-mono);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}
.law-test-foot{margin:var(--space-3) 0 0;color:var(--ds-dim);font-size:14px;max-width:60ch;line-height:1.6}
.law-sequence{padding:var(--space-4) 0 var(--space-5)}
.law-family{display:grid;grid-template-columns:minmax(160px,.618fr) minmax(0,1.618fr);gap:var(--space-5);padding:var(--space-5) 0;border-top:1px solid var(--ds-line)}
.law-family>header{position:sticky;top:100px;align-self:start}
.law-family>header h2{margin:10px 0;font-size:var(--fs-h2)}
.fam-count{margin:0;color:var(--ds-dim);font:12px/1 var(--font-mono)}
.law-principle{display:grid;grid-template-columns:54px 1fr;gap:var(--space-3);padding:0 0 var(--space-4);scroll-margin-top:120px}
.law-principle+.law-principle{padding-top:var(--space-4);border-top:1px solid var(--ds-line)}
.law-principle>span{font:700 11px/1 var(--font-mono);color:var(--ds-accent)}
.law-principle h3{margin:0 0 10px;font-size:var(--fs-h3)}
.law-principle p{max-width:42rem;margin:0;color:var(--ds-soft);font-size:var(--fs-body);line-height:var(--lh-body)}
.law-exhibits{padding:var(--space-5) 0;border-top:1px solid var(--ds-line)}
.law-exhibits>header{max-width:62rem;margin-bottom:var(--space-4)}
.law-exhibits>header h2{font-size:var(--fs-h2);max-width:34ch;margin:var(--space-2) 0}
.law-exhibits>header p{max-width:46rem;color:var(--ds-soft);line-height:var(--lh-body)}
.exhibit{padding:var(--space-4) 0;border-top:1px solid var(--ds-line)}
.exhibit>header{display:flex;align-items:baseline;justify-content:space-between;gap:20px;margin-bottom:var(--space-3)}
.exhibit>header a{color:var(--ds-dim);font:700 11px/1 var(--font-mono);text-decoration:none}
.exhibit>header a:hover{color:var(--ds-accent)}
.ex-pair{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)}
.ex{padding:var(--space-4);border:1px solid var(--ds-line);border-radius:16px;background:var(--ds-surface)}
.ex-good{border-left:3px solid var(--ds-accent)}
.ex-bad{border-left:3px solid var(--ds-dim);opacity:.92}
.ex-tag{margin:0 0 12px;font:700 11px/1 var(--font-mono);text-transform:uppercase;letter-spacing:.08em;color:var(--ds-dim)}
.ex-good .ex-tag{color:var(--ds-accent)}
.ex blockquote{margin:0;padding:0;border:0;font-size:var(--fs-lead);line-height:1.5}
.ex-bad blockquote{color:var(--ds-soft);text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--ds-dim) 60%,transparent);text-decoration-thickness:1px}
.ex-note{margin:14px 0 0;color:var(--ds-dim);font-size:14px;line-height:1.6}
.law-reading{display:grid;grid-template-columns:minmax(200px,.5fr) minmax(0,1.5fr);gap:var(--space-5);align-items:center;padding:var(--space-5);margin:var(--space-5) 0;border:1px solid var(--ds-line);border-radius:18px;background:var(--ds-surface)}
.book{position:relative;aspect-ratio:2/3;width:min(100%,220px);border-radius:4px 12px 12px 4px;background:linear-gradient(135deg,color-mix(in srgb,var(--ds-accent) 22%,var(--ds-void)) 0%,var(--ds-void) 70%);box-shadow:0 24px 48px -20px rgba(0,0,0,.65),inset -1px 0 0 rgba(255,255,255,.06);display:flex;align-items:flex-end;transform:rotate(-2deg)}
.book-spine{position:absolute;inset:0 auto 0 0;width:14px;border-radius:4px 0 0 4px;background:linear-gradient(90deg,rgba(0,0,0,.55),rgba(255,255,255,.05))}
.book-face{padding:22px 20px 26px 30px;display:block;color:#f3ede2}
.book-face b{display:block;font-size:19px;line-height:1.25;letter-spacing:.01em}
.book-face i{display:block;margin-top:12px;font-style:normal;color:#c9a227;font:700 11px/1 var(--font-mono);text-transform:uppercase;letter-spacing:.08em}
.law-reading h2{font-size:var(--fs-h2);max-width:26ch;margin:var(--space-2) 0}
.law-reading p:not(.eyebrow){max-width:46rem;color:var(--ds-soft);line-height:var(--lh-body)}
.reading-note{color:var(--ds-dim)!important;font-size:14px;border-top:1px solid var(--ds-line);padding-top:16px;margin-top:18px}
.law-parallel{padding:var(--space-5) 0;border-top:1px solid var(--ds-line)}
.law-parallel h2{font-size:var(--fs-h2);max-width:34ch;margin:var(--space-2) 0}
.law-parallel p:not(.eyebrow){max-width:46rem;color:var(--ds-soft);line-height:var(--lh-body)}
.law-parallel a{color:var(--ds-accent)}
.law-source{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-5);padding:var(--space-5);background:var(--ds-surface);border:1px solid var(--ds-line);border-radius:18px}
.law-source h2{font-size:var(--fs-h2);margin:var(--space-2) 0}
.law-source p:not(.eyebrow){color:var(--ds-soft);line-height:var(--lh-body)}
.law-source a{color:var(--ds-accent)}
.law-source ol{list-style:none;margin:0;padding:0}
.law-source li{display:flex;justify-content:space-between;gap:20px;padding:16px 0;border-bottom:1px solid var(--ds-line)}
.law-source li:last-child{border:0}
.law-source li span{color:var(--ds-dim);font:12px/1.4 var(--font-mono);text-align:right}
.law-coda{padding:var(--space-5) 0 clamp(100px,15vw,180px);display:flex;align-items:end;justify-content:space-between;gap:var(--space-4)}
.law-coda p{max-width:32rem;font-size:var(--fs-h3);line-height:1.45}
.law-coda details{position:relative}
.law-coda summary{cursor:pointer;list-style:none;color:#0b0d10;background:var(--ds-accent);padding:14px 18px;border-radius:999px;font-weight:700;white-space:nowrap}
.law-coda summary::-webkit-details-marker{display:none}
.law-coda details[open]{padding:12px;border:1px solid var(--ds-line);border-radius:16px;background:var(--ds-surface)}
.law-coda details[open] summary{margin-bottom:8px}
.law-coda a{display:block;padding:9px 10px;border-radius:8px;color:var(--ds-soft);text-decoration:none;font-size:13px}
.law-coda a:hover{background:var(--ds-raised);color:var(--ds-accent)}
@media(max-width:900px){.ex-pair{grid-template-columns:1fr}.law-reading{grid-template-columns:1fr}.book{margin:auto}}
@media(max-width:760px){.law-source,.law-family{grid-template-columns:1fr;padding:var(--space-4) 0}.law-family>header{position:static}.law-coda{align-items:start;flex-direction:column}.law-principle{grid-template-columns:42px 1fr}.law-test li{flex-direction:column;gap:6px}}
`;
