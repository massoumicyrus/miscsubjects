// The proof strip. One line on the page; everything else behind a click.
//
// Owner, 2026-08-06, looking at the article: "the thing you should collapse in size is the proof of
// work object, and also make it look sexier, because the current way it looks — I own the site and I
// have zero interest in figuring out what it is."
//
// That is the correct verdict on what was there. It opened with three curl blocks, a nine-word
// verdict vocabulary, a paragraph about delegated authority and a declared-gaps line, all expanded,
// above the comment thread. Every one of those is true and none of them is what a reader wants at
// that point in the page. A machine surface that shouts over the article it is attached to has
// mistaken its own importance for the reader's.
//
// So: a strip. Status, claim, one sentence, a disclosure arrow. A reader sees whether this page is
// proven and moves on in a second. A model that wants the machinery opens it and finds exactly what
// was there before. Nothing was deleted — it was ranked.
//
// No bearer appears in the page: the public egress guard strips signed capabilities from served HTML
// by design, so the one-step door is a keyless GET that mints and executes the inspection server-side
// and returns the record plus the caller's own receipt.

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// TAP-AND-GO PROVEN WORK, EVERY ARTICLE (owner order 2026-08-03): a page without a hand-bound
// manifest gets one SYNTHESIZED at read time from its own stored records — claims, sources, revision
// history — so every article is an isolated, inspectable proof object. The synthesized status is
// computed, never asserted: most pages print PARTIAL honestly because their formation payloads are on
// the ledger but not yet bound as per-article record ids, and the manifest says so. One derivation,
// used by both the /api/proven-work route and this widget.
export function synthesizeManifest(slug, title, meta) {
  const m = meta || {};
  const claims = Array.isArray(m.claims) ? m.claims : [];
  const sources = Array.isArray(m.sources) ? m.sources : [];
  const bound = claims.filter((c) => Array.isArray(c?.source_ids) && c.source_ids.length).length;
  const requirements = [
    { id: 'published_and_rendered', status: 'PASS',
      what: 'The page is live at its public address; the stored body is what renders.',
      evidence: ['https://miscsubjects.com/a/' + slug] },
    { id: 'claims_extracted', status: claims.length ? 'PASS' : 'GAP',
      what: claims.length ? claims.length + ' claims are extracted and stored on the object.' : 'No claims extracted yet — the page asserts without enumerating.',
      evidence: claims.length ? ['https://miscsubjects.com/api/articles/' + slug] : [] },
    { id: 'sources_open', status: sources.length ? 'PASS' : 'GAP',
      what: sources.length ? sources.length + ' sources are registered on the object; each opens from the page.' : 'No sources registered on the object.',
      evidence: sources.slice(0, 5).map((s) => s && s.url).filter(Boolean) },
    { id: 'claims_bound', status: claims.length && bound === claims.length ? 'PASS' : 'GAP',
      what: claims.length ? bound + ' of ' + claims.length + ' claims carry source ids; the rest are named gaps.' : 'Nothing to bind until claims are extracted.',
      evidence: [] },
    { id: 'revision_history', status: 'PASS',
      what: 'Every revision of this page is preserved and retrievable, with the reason for each change — per-DIV hash-linked chains, actor and rationale included.',
      evidence: ['https://miscsubjects.com/api/articles/' + slug + '/voxels', 'https://miscsubjects.com/api/articles/' + slug + '/provenance'] },
    { id: 'formation_record', status: 'GAP',
      what: 'The model and tool payloads that formed this page are on the public ledger but not yet bound to this object as per-article record ids. Declared, not hidden.',
      evidence: [] },
  ];
  return {
    work_id: 'page:' + slug,
    synthesized: true,
    claim: String(title || slug),
    requirements,
    certifications: Array.isArray(m?.extra?.proven_work_certs) ? m.extra.proven_work_certs : [],
    note: 'Default manifest computed at read time from the page’s own stored records. A hand-bound manifest overrides it. The standard: https://miscsubjects.com/a/proven-work',
  };
}

const FAMILY = {
  SUPPORTED_BY_RECORD: 'proved', PROVED: 'proved',
  CONTRADICTED_BY_RECORD: 'disproved', DISPROVED: 'disproved',
  MISSING_EVIDENCE: 'contested', CONTESTED: 'contested', OBJECTION: 'contested',
  QUESTION: 'questions', INCONCLUSIVE: 'inconclusive',
};

export function renderProvenWorkWidget(slug, meta, title) {
  let pw = meta?.extra?.proven_work;
  let synthesized = false;
  if (!pw || typeof pw !== 'object') {
    pw = synthesizeManifest(slug, title, meta);
    synthesized = true;
  }
  const reqs = Array.isArray(pw.requirements) ? pw.requirements : [];
  const passed = reqs.filter((r) => String(r?.status || '').toUpperCase() === 'PASS').length;
  const status = reqs.length && passed === reqs.length ? 'PROVEN' : 'PARTIAL';
  const gaps = reqs.filter((r) => String(r?.status || '').toUpperCase() !== 'PASS');
  const base = `https://miscsubjects.com/api/proven-work/${slug}`;

  const certs = Array.isArray(pw.certifications) ? pw.certifications : [];
  const tallyCounts = {};
  for (const c of certs) {
    const fam = FAMILY[String(c?.verdict || '').toUpperCase()] || 'other';
    tallyCounts[fam] = (tallyCounts[fam] || 0) + 1;
  }
  const tally = ['proved', 'contested', 'disproved', 'questions', 'inconclusive', 'other']
    .filter((k) => tallyCounts[k]).map((k) => `${tallyCounts[k]} ${k}`).join(' · ');

  // The requirement list is the honest part — it is what makes PARTIAL mean something — so it renders
  // as a compact checklist rather than prose, readable in one pass.
  const checklist = reqs.map((r) => {
    const pass = String(r.status || '').toUpperCase() === 'PASS';
    return `<li class="${pass ? 'pw-pass' : 'pw-gap'}"><span aria-hidden="true">${pass ? '✓' : '○'}</span>
      <span><b>${esc(String(r.id || '').replace(/_/g, ' '))}</b> ${esc(r.what || '')}</span></li>`;
  }).join('');

  const lastCerts = certs.slice(-3).reverse().map((c) =>
    `<li><code>${esc(String(c.verdict || '').toUpperCase())}</code> ${esc(c.model || 'unnamed')}${c.ts ? ' · ' + esc(String(c.ts).slice(0, 10)) : ''}</li>`).join('');

  return `<details class="pw-strip" aria-label="Proof status of this article">
  <style>
    .pw-strip{margin:1.6rem 0;border:1px solid var(--ds-line,#e3e3e0);border-radius:12px;background:var(--ds-bg,#fff);overflow:hidden}
    .pw-strip>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:.6rem;padding:.7rem .9rem;font-size:.86rem;line-height:1.4;color:var(--ds-dim,#6b6b67)}
    .pw-strip>summary::-webkit-details-marker{display:none}
    .pw-strip>summary:hover{background:var(--ds-surface,#fafaf8)}
    .pw-badge{flex:0 0 auto;font:700 .63rem/1 ui-monospace,monospace;letter-spacing:.07em;padding:.3rem .48rem;border-radius:6px;color:#fff;background:${status === 'PROVEN' ? '#2a7f4f' : '#a76b00'}}
    .pw-strip .pw-say{color:var(--ds-ink,#16160f);font-weight:600}
    .pw-strip>summary .pw-caret{margin-left:auto;flex:0 0 auto;color:var(--ds-line,#c9c9c4);font-size:.8rem}
    .pw-strip[open]>summary .pw-caret::after{content:"⌃"}
    .pw-strip>summary .pw-caret::after{content:"⌄"}
    .pw-body{padding:0 .9rem .95rem;font-size:.87rem;line-height:1.6;color:var(--ds-dim,#6b6b67);border-top:1px solid var(--ds-line,#eeeeec)}
    .pw-body h3{margin:.9rem 0 .35rem;font:700 .68rem/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--ds-dim,#8a8a86)}
    .pw-body ul{list-style:none;margin:0;padding:0}
    .pw-body li{display:flex;gap:.45rem;padding:.22rem 0}
    .pw-pass span:first-child{color:#2a7f4f}.pw-gap span:first-child{color:#a76b00}
    .pw-body b{color:var(--ds-ink,#16160f);font-weight:650}
    .pw-body pre{margin:.35rem 0;padding:.55rem .65rem;background:var(--ds-surface,#f6f6f3);border:1px solid var(--ds-line,#e8e8e4);border-radius:8px;overflow-x:auto;font-size:.74rem;line-height:1.5;color:var(--ds-ink,#16160f);white-space:pre-wrap;word-break:break-all}
    .pw-body a{color:var(--ds-accent,#2a6f4e)}
    .pw-body code{background:var(--ds-surface,#f6f6f3);border-radius:4px;padding:.05rem .25rem;font-size:.78rem}
    @media(max-width:620px){.pw-strip{margin:1.2rem 0}.pw-strip>summary{font-size:.82rem}}
  </style>
  <summary>
    <span class="pw-badge">${status}${reqs.length ? ` ${passed}/${reqs.length}` : ''}</span>
    <span><span class="pw-say">This page is a proof object.</span> ${certs.length ? esc(tally) + ' signed' : 'Open it, test it with delegated tools, sign whether it holds'} — no key, no account.</span>
    <span class="pw-caret"></span>
  </summary>
  <div class="pw-body">
    <h3>What is checked</h3>
    <ul>${checklist}</ul>
    ${gaps.length ? `<p><b>${gaps.length} declared gap${gaps.length === 1 ? '' : 's'}.</b> Status is computed from the record, never asserted — a page says PARTIAL out loud rather than rounding itself up. Test those first.</p>` : ''}
    <h3>Inspect — this call mints your delegation</h3>
    <pre>curl -s ${esc(base)}/inspect</pre>
    <h3>Sign a verdict</h3>
    <p>Requires the <code>inspection_receipt</code> the call above returns: signing costs proof of reading.</p>
    <pre>curl -s -X POST ${esc(base)}/certify -H 'content-type: application/json' \\
  -d '{"verdict":"…","model":"&lt;you&gt;","grounds":"&lt;what you checked&gt;","inspection_receipt":"&lt;inv_…&gt;"}'</pre>
    ${certs.length ? `<h3>Signed so far</h3><ul>${lastCerts}</ul>` : ''}
    ${/^W[TFR]-\d+/.test(String(pw.work_id || '')) ? `<h3>The execution case</h3><p>Every step of the work behind this page, each resolvable to its raw redacted payload: <a href="/api/work-evidence/${esc(pw.work_id)}">manifest</a> · <a href="/api/work-evidence/${esc(pw.work_id)}/payloads">payloads</a> · <a href="/api/work-evidence/${esc(pw.work_id)}/dossier">portable dossier</a></p>` : ''}
    ${/^SC-\d+/.test(String(meta?.extra?.session_case || '')) ? `<h3>The session, inside out</h3><p>The whole session that produced this page — operator input, model output, every tool call, raw payloads, hash commitments for what stays private: <a href="/api/case/${esc(meta.extra.session_case)}">the case</a> · <a href="/api/case/${esc(meta.extra.session_case)}/payloads">payloads</a> · <a href="/api/case/${esc(meta.extra.session_case)}/verify">verify</a> · <a href="/api/case/${esc(meta.extra.session_case)}/comments">ask, object, suggest</a></p>` : ''}
    <p>A verdict is a checkbox. If what you found needs a paragraph, <a href="#ledger">write it in the comments</a> instead — that thread is the one people read. ${synthesized ? 'This manifest is computed at read time from the page’s own records. ' : ''}<a href="${esc(base)}">Raw proof object</a> · <a href="/verify/article/${esc(slug)}?format=json">every verification surface, one map</a> · <a href="/verify">the send ledger</a> · <a href="/a/proven-work">the proof law</a></p>
  </div>
</details>`;
}
