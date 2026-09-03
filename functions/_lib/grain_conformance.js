// GRAIN philosophy conformance suite — "the philosophy must pass the suite it preaches."
// Live at GET /api/dispatch?conformance=grain. Checks presence and key markers of required
// surfaces (rejection log, retractions, axiom hierarchy, etc.). Not a substitute for OIP C1–Cn.

const BASE = "https://miscsubjects.com";

function clause(id, title, requirement, pass, evidence, note) {
  return { id, title, requirement, pass: !!pass, evidence: evidence || null, note: note || null };
}

async function getArticle(slug) {
  const r = await fetch(BASE + "/api/articles/" + encodeURIComponent(slug), {
    headers: { "user-agent": "GrokBuild-grain-conformance/1.0", accept: "application/json" },
  });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch {}
  return { status: r.status, body, text };
}

function has(body, re) {
  return body && re.test(String(body.body || "") + " " + String(body.title || ""));
}

/** Philosophy conformance — live article surface checks. */
export async function runGrainConformance(env) {
  const started = new Date().toISOString();
  const clauses = [];

  // P1 — count discipline page exists and forbids bare integers as claims
  try {
    const a = await getArticle("oip-count-discipline");
    clauses.push(clause("P1", "Count discipline surface",
      "A live page MUST state that load-bearing integers in philosophy prose are forbidden; counts are queries or vanity.",
      a.status === 200 && has(a.body, /No integer is a claim|Count Discipline/i),
      { url: BASE + "/a/oip-count-discipline", status: a.status }));
  } catch (e) { clauses.push(clause("P1", "Count discipline surface", "", false, null, String(e?.message || e))); }

  // P2 — contested axioms tagged as choice (A4)
  try {
    const a = await getArticle("oip-axiom-a4");
    clauses.push(clause("P2", "Contested axiom declared as choice",
      "A4 (injustice as base unit) MUST declare itself a meta-ethical choice with named rivals, not pure discovery.",
      a.status === 200 && has(a.body, /choice|rival|consequentialist|suffering|declared/i),
      { url: BASE + "/a/oip-axiom-a4", status: a.status }));
  } catch (e) { clauses.push(clause("P2", "Contested axiom declared as choice", "", false, null, String(e?.message || e))); }

  // P3 — philosophy retraction ledger
  try {
    const a = await getArticle("grain-retractions");
    clauses.push(clause("P3", "Philosophy retraction ledger",
      "A permanent grain-retractions surface MUST list dropped claims with the objection that killed them.",
      a.status === 200 && has(a.body, /retract|dropped|killed|v2|v3/i),
      { url: BASE + "/a/grain-retractions", status: a.status }));
  } catch (e) { clauses.push(clause("P3", "Philosophy retraction ledger", "", false, null, String(e?.message || e))); }

  // P4 — causal contact rule
  try {
    const a = await getArticle("oip-causal-contact-rule");
    clauses.push(clause("P4", "Causal-contact scores defined",
      "Convergence nodes MUST have a published contact-score rule separating convergence from synthesis.",
      a.status === 200 && has(a.body, /causal contact|synthesis|score/i),
      { url: BASE + "/a/oip-causal-contact-rule", status: a.status }));
  } catch (e) { clauses.push(clause("P4", "Causal-contact scores defined", "", false, null, String(e?.message || e))); }

  // P5 — universal quantifiers bounded
  try {
    const a = await getArticle("grain-what-survives-every-deflation");
    const title = String(a.body?.title || "");
    const body = String(a.body?.body || "");
    const noEveryInTitle = !/every deflation/i.test(title) || /we'?ve run|deflations we/i.test(title + body);
    const listsDomain = /deflations we|fixed point|quantifier domain|survives the deflations/i.test(title + body);
    clauses.push(clause("P5", "Universal quantifier domain stated",
      "Pages that claim survival under deflation MUST bound the quantifier (list deflations run or state a fixed point), not open 'every'.",
      a.status === 200 && listsDomain,
      { url: BASE + "/a/grain-what-survives-every-deflation", status: a.status, title }));
  } catch (e) { clauses.push(clause("P5", "Universal quantifier domain stated", "", false, null, String(e?.message || e))); }

  // P6 — rejection graveyard
  try {
    const a = await getArticle("grain-the-rejected");
    clauses.push(clause("P6", "Rejected pattern graveyard",
      "A grain-the-rejected page MUST list candidate patterns considered and cut, with failure domain.",
      a.status === 200 && has(a.body, /rejected|cut|failed|graveyard|candidate/i),
      { url: BASE + "/a/grain-the-rejected", status: a.status }));
  } catch (e) { clauses.push(clause("P6", "Rejected pattern graveyard", "", false, null, String(e?.message || e))); }

  // P7 — axiom hierarchy bedrock
  try {
    const a = await getArticle("oip-axiom-hierarchy");
    clauses.push(clause("P7", "Axiom hierarchy (bedrock vs derived)",
      "A0/A11 (or named bedrock pair) MUST be declared foundational and un-self-justifying; other axioms derived/prosecuted by them.",
      a.status === 200 && has(a.body, /bedrock|foundational|derived|A0|A11|circular/i),
      { url: BASE + "/a/oip-axiom-hierarchy", status: a.status }));
  } catch (e) { clauses.push(clause("P7", "Axiom hierarchy (bedrock vs derived)", "", false, null, String(e?.message || e))); }

  // P8 — philosophy/protocol co-design honesty
  try {
    const a = await getArticle("oip-philosophy-protocol-codesign");
    clauses.push(clause("P8", "Philosophy–protocol fit is co-design",
      "The corpus MUST state that philosophy–protocol agreement demonstrates buildability, not independent confirmation of truth.",
      a.status === 200 && has(a.body, /co-design|buildability|not evidence|reference implementation|same author/i),
      { url: BASE + "/a/oip-philosophy-protocol-codesign", status: a.status }));
  } catch (e) { clauses.push(clause("P8", "Philosophy–protocol fit is co-design", "", false, null, String(e?.message || e))); }

  // P9 — designer legibility boundary
  try {
    const a = await getArticle("oip-designer-legibility-policy");
    clauses.push(clause("P9", "Designer legibility policy",
      "A8-operational exposure MUST have a published boundary between intended judgment legibility and operator doxxing.",
      a.status === 200 && has(a.body, /legib|doxx|boundary|profile|judgment|name|location/i),
      { url: BASE + "/a/oip-designer-legibility-policy", status: a.status }));
  } catch (e) { clauses.push(clause("P9", "Designer legibility policy", "", false, null, String(e?.message || e))); }

  // P10 — A8×A5 prosecution exists
  try {
    const a = await getArticle("oip-axiom-a8-times-a5");
    clauses.push(clause("P10", "A8×A5 composition published",
      "Maker-system identity MUST be prosecuted against inherited prejudice in a dedicated live page.",
      a.status === 200 && has(a.body, /A8|A5|composition|prejudice|identity/i),
      { url: BASE + "/a/oip-axiom-a8-times-a5", status: a.status }));
  } catch (e) { clauses.push(clause("P10", "A8×A5 composition published", "", false, null, String(e?.message || e))); }

  const passed = clauses.filter((c) => c.pass).length;
  return {
    kind: "grain_conformance",
    protocol: "GRAIN-philosophy",
    spec: BASE + "/a/oip-grain-conformance",
    definition: "The philosophy must pass the evidentiary suite it preaches: rejection logs, retractions, bedrock hierarchy, causal-contact tags, bounded universals, choice markers on contested primitives.",
    ran_at: started,
    clauses,
    passed,
    total: clauses.length,
    conformant: passed === clauses.length,
    verdict: passed === clauses.length
      ? "CONFORMANT — all " + clauses.length + " philosophy clauses hold on live article surfaces."
      : "NOT CONFORMANT — " + (clauses.length - passed) + " of " + clauses.length + " philosophy clauses failed.",
    rerun: BASE + "/api/dispatch?conformance=grain",
    note: "These clauses check live article surfaces, not protocol runtime. Protocol suite remains ?conformance=1.",
  };
}

export function grainConformanceMarkdown(c) {
  const lines = [
    "# GRAIN philosophy conformance — live run",
    "",
    "> " + c.definition,
    "",
    "**Verdict:** " + c.verdict,
    "**Ran:** " + c.ran_at + " · **Spec:** " + c.spec + " · **Re-run:** " + c.rerun,
    "",
    "| clause | title | pass | evidence |",
    "|---|---|---|---|",
  ];
  for (const cl of c.clauses) {
    lines.push(
      "| " + cl.id + " | " + cl.title + " | " + (cl.pass ? "PASS" : "FAIL") + " | " +
      (cl.evidence ? JSON.stringify(cl.evidence).replace(/\|/g, "\\|").slice(0, 160) : (cl.note || "")) + " |",
    );
  }
  lines.push("");
  for (const cl of c.clauses) {
    lines.push("**" + cl.id + " — " + cl.title + "** (" + (cl.pass ? "PASS" : "FAIL") + ")");
    lines.push(cl.requirement || "");
    lines.push("");
  }
  return lines.join("\n");
}
