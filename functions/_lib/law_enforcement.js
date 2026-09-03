// LAW_ENFORCEMENT — a clause with no enforcement is a suggestion.
//
// The owner directed that these are laws rather than guidance: a clause without enforcement is a
// suggestion, and a suggestion becomes one more thing a model ignores. Every clause must therefore
// declare whether it is enforceable, and by what.
//
// The occasion: a full session in which the writing law was fetched, quoted, and violated clause by
// clause — W47 and W56 (the article about BPC-157 carried a disc as its frame), W51 (framing
// language), and a length criterion invented outright that no clause contains. Every one of those
// clauses was live and readable at the moment it was broken.
//
// scripts/check-gates-wired.mjs already closed this class one level up: no check-*.mjs may exist
// without being declared in the manifest that invokes it. This is the same gate one level down.
// There are 262 clauses across seven law objects and 42 deploy gates, and until now nothing
// connected them, so "is this clause enforced?" had no answer at all — which is the condition in
// which a clause quietly becomes decoration.
//
// THE RULE. Every clause in every law object carries a declaration here: either the named check
// that enforces it and where that check runs, or `unenforced` with a written reason. A clause with
// neither fails the deploy. Adding a clause to any law therefore forces the author to say how it
// binds — and the count of unenforced clauses becomes a published number that can only be argued
// down with real checks.

import { WRITING_LAW_OBJECT } from './writing_law_object.js';
import { DESIGN_LAW_OBJECT } from './design_law_object.js';
import { LOOP_LAW_OBJECT } from './loop_law_object.js';
import { LOGIC_LAW_OBJECT } from './logic_law_object.js';
import { SKILL_LAW_OBJECT } from './skill_law_object.js';
import { CODING_LAW_OBJECT } from './coding_law_object.js';
import { OUTREACH_LAW_OBJECT } from './outreach_law_object.js';

export const LAW_OBJECTS = {
  writing: WRITING_LAW_OBJECT,
  design: DESIGN_LAW_OBJECT,
  loop: LOOP_LAW_OBJECT,
  logic: LOGIC_LAW_OBJECT,
  skill: SKILL_LAW_OBJECT,
  coding: CODING_LAW_OBJECT,
  outreach: OUTREACH_LAW_OBJECT,
};

// Where a check can run. A clause enforced at the write path can never be violated by any client;
// one enforced at deploy can be violated in the store and is caught before it reaches production;
// one enforced only in the audit is reported but not prevented, and that is stated, not blurred.
export const SURFACES = ['write-path', 'deploy', 'audit'];

// ── The declarations. Keyed by "<law>:<clause title>" because clause ids are positional and shift
// when a clause is inserted; the title is what a person recognises and what survives a renumber.
// enforced_by names a real function or script. Nothing is marked enforced without one.
export const DECLARATIONS = {
  // ---- writing law, enforced ----
  'writing:The title names subject and deliverable':
    { enforced_by: 'title_hero_gate.checkTitle', surface: 'write-path' },
  'writing:The hero image makes one story-specific editorial idea visible':
    { enforced_by: 'title_hero_gate.editorialPreflight (runs checkHeroBrief)', surface: 'write-path' },
  'writing:Headlines and heroes pass a preflight and a continuous editor':
    { enforced_by: 'title_hero_gate.auditEditorialArticle', surface: 'audit' },
  'writing:Headings state findings':
    { enforced_by: 'title_hero_gate.FILING_LABEL', surface: 'audit' },
  'writing:One subject, one article':
    { enforced_by: 'subject_gate.checkSubjectBoundary + one_object_guard.crossObjectViolations', surface: 'write-path' },
  'writing:Never name an audience':
    { enforced_by: 'subject_gate.checkSubjectBoundary', surface: 'write-path' },
  'writing:No framing language':
    { enforced_by: 'subject_gate.newWritingLawViolation (ratchet; runs the W51 framing test)', surface: 'write-path' },
  'writing:Never pre-argue':
    { enforced_by: 'subject_gate.newWritingLawViolation (ratchet; runs the W52 pre-argued test)', surface: 'write-path' },
  'writing:Never hedge':
    { enforced_by: 'subject_gate.newWritingLawViolation (ratchet; runs the W63 hedge test)', surface: 'write-path' },
  'writing:Tag the evidence tier on every substantive claim, and match the verb to the tier':
    { enforced_by: 'subject_gate.newWritingLawViolation (ratchet; runs the W87 outcome-verb test)', surface: 'write-path' },
  'writing:No invented grammar':
    { enforced_by: 'subject_gate.newWritingLawViolation (ratchet; runs the W87 tier-label test)', surface: 'write-path' },
  'writing:Source cards beside the claim':
    { enforced_by: 'check-source-quotes.mjs', surface: 'deploy' },
  'writing:A citation supports its own sentence':
    { enforced_by: 'check-citation-identity.mjs', surface: 'deploy' },
  'writing:Anecdotes are labelled cards':
    { enforced_by: 'source_law.checkSources', surface: 'write-path' },
  'writing:Label the claim type':
    { enforced_by: 'claim_law.checkClaims + check-article-claims.mjs', surface: 'write-path' },
  'writing:Plain word beats technical word':
    { enforced_by: 'check-plain-language.mjs', surface: 'deploy' },
  'writing:The model is never the subject':
    { enforced_by: 'articles.BODY_SIGNATURE_RE', surface: 'write-path' },
  // The six clauses added 2026-08-08. Only the half of W111 that its own text states as a NEVER is
  // machine-testable; the ALWAYS half, and W113/W114 entirely, need a reader and stay uncounted.
  // W115 and W116 govern how an agent answers the owner, not what an article contains, so no
  // article surface can hold them and claiming one would be the same lie this file just carried.
  'writing:State the benefit in the first five sentences':
    { enforced_by: 'subject_gate.newWritingLawViolation (ratchet; runs the W111 study-inventory-opening test, the NEVER half only)', surface: 'write-path' },
  // The four clauses added 2026-08-08 from the inverted paragraph on /a/bpc-157-vs-nsaids. W118's
  // NEVER states its own test — an opening framed on something that never happened — so it gets a
  // check. The other three each require reading a whole page against itself and are declared
  // unenforced rather than given a regex that would pass the pages that break them.
  'writing:Never characterise a thing by what it has not claimed':
    { enforced_by: 'subject_gate.newWritingLawViolation (ratchet; runs the W118 absence-as-frame test on the page opening and each section opening)', surface: 'write-path' },
  'writing:One evidentiary standard across a comparison':
    { unenforced: 'The test is whether two sides of a comparison were held to the same standard, which needs both sides read against each other and weighed by length and placement. The nearest mechanical proxy — counting absence language per side — would pass a page stating one missing trial for each side at wildly different prominence, which is exactly the failure this clause exists for.' },
  'writing:Relief is never reported as repair':
    { unenforced: 'Requires knowing whether a named drug impairs the specific repair the page is about, which is a fact about the pharmacology and the tissue rather than a string in the body. A word-list check would fire on every page correctly reporting that a drug relieves pain, and stay silent on the one that omits the harm.' },
  // The three clauses added later the same day. All three need a reader: each is about a relation
  // between two statements on a page — a chain and its links, a speed claim and a structural
  // measurement, a harm's conditions and a benefit's — and none is a string a body either does or
  // does not contain.
  'writing:Follow the effect to the reader\'s problem':
    { unenforced: 'Requires knowing the causal chain from a measured endpoint to a condition — that lower body weight means lower joint load, that lower joint load reaches a degenerating disc. That is pharmacology and anatomy, not text. A check that demanded some minimum number of downstream conditions per page would be satisfied by listing them and saying nothing about any.' },
  'writing:Report the repaired tissue, not only the speed':
    { unenforced: 'Requires knowing whether a structural measurement exists for the intervention the page is discussing, so that a speed claim standing in its place can be recognised as a substitution. The absence being tested for is an absence in the literature, not in the body.' },
  'writing:A qualifier that rescues one side is applied to both':
    { unenforced: 'Requires deciding whether two qualifiers govern the same mechanism, and whether the reader\'s situation falls inside a stated window. Both are judgments about meaning. A symmetry check on qualifier counts would pass a page that qualifies the harm heavily and the benefit trivially.' },
  'writing:A counted record is evidence about the exposure people run':
    { unenforced: 'Requires comparing the dose and duration used in the trials against the dose and duration in the counted accounts, then judging whether that record reached the page answer. Both figures are prose. A check that merely asserted an anecdote section exists would be satisfied by the burial this clause forbids.' },
  'writing:A claim about people is a claim':
    { unenforced: 'Requires deciding whether prose makes a material generalisation about a group of people and whether the named record actually supports that generalisation. A people-word regex would flag descriptions and quotations that make no claim, while missing a generalisation written without a collective noun.' },
  'writing:No sentence announces the next block':
    { unenforced: 'Requires reading a sentence in relation to the block that follows and deciding whether it carries substance of its own. A transition-word or next-section regex would reject literal navigation where it is useful and would pass empty throat-clearing written without those phrases.' },
};

/** Every clause across every law, with its declared enforcement. */
export function enforcementReport() {
  const rows = [];
  for (const [lawKey, law] of Object.entries(LAW_OBJECTS)) {
    const clauses = law?.content?.clauses || [];
    for (const c of clauses) {
      const key = `${lawKey}:${c.title}`;
      const d = DECLARATIONS[key] || null;
      rows.push({
        law: lawKey,
        id: c.id,
        title: c.title,
        family: c.family,
        key,
        declared: !!d,
        enforced: !!(d && d.enforced_by),
        enforced_by: d?.enforced_by || null,
        surface: d?.surface || null,
        unenforced_reason: d?.unenforced || null,
      });
    }
  }
  return rows;
}

export function enforcementSummary() {
  const rows = enforcementReport();
  const by = {};
  for (const r of rows) {
    by[r.law] = by[r.law] || { total: 0, enforced: 0, declared_unenforced: 0, undeclared: 0 };
    by[r.law].total += 1;
    if (r.enforced) by[r.law].enforced += 1;
    else if (r.declared) by[r.law].declared_unenforced += 1;
    else by[r.law].undeclared += 1;
  }
  const total = rows.length;
  const enforced = rows.filter((r) => r.enforced).length;
  const undeclared = rows.filter((r) => !r.declared).length;
  return {
    total_clauses: total,
    enforced,
    declared_unenforced: rows.filter((r) => r.declared && !r.enforced).length,
    undeclared,
    enforced_share: total ? Number(((enforced / total) * 100).toFixed(1)) : 0,
    by_law: by,
    note: undeclared
      ? `${undeclared} clauses have no enforcement declaration. Until each one names a check or a `
        + 'written reason it cannot have one, those clauses are suggestions.'
      : 'every clause declares how it binds',
  };
}

// ── ANTI-REDUNDANCY, ANTI-SPRAWL ────────────────────────────────────────────────────────────────
//
// The owner directed anti-redundancy and anti-sprawl in the law itself, with a guard: several
// clauses that could be one clause are merged, applied only where the enforcement of every merged
// clause still holds.
//
// THE RULE. Where two or more clauses are enforced by one and the same check, they are one clause
// wearing several titles and are merged into the shortest wording that still says everything.
// THE GUARD. A merge happens only when every check covering either clause still covers the merged
// clause. Where two clauses share a check but each also carries enforcement the other lacks, they
// are not redundant and are left alone — losing an enforcement to save words is sprawl traded for
// a hole, which is worse than the sprawl.
//
// A law that grows without this becomes long enough that nobody holds it, and a clause nobody holds
// is the same as a clause nobody enforces.

export const LAW_HYGIENE = {
  rule: 'Two clauses enforced by the same check are one clause; merge them into the shortest wording '
    + 'that still says everything.',
  guard: 'Merge only when every check covering either clause still covers the merged clause. If a '
    + 'merge would drop any enforcement, do not merge.',
};

// Pairs examined and found genuinely distinct despite sharing a check. Each needs a written reason,
// the same standard gates.manifest.json applies to an exempt gate.
export const ACCEPTED_DISTINCT = {};

/** Groups of clauses that share one check, with the guard applied to each group. */
export function redundancyReport() {
  const rows = enforcementReport().filter((r) => r.enforced);
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.law}::${r.enforced_by}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const out = [];
  for (const [k, members] of groups) {
    if (members.length < 2) continue;
    const key = members.map((m) => m.id).sort().join('+');
    // The guard: a merge is safe when one check covers every member, so nothing is lost by merging.
    out.push({
      key,
      law: members[0].law,
      shared_check: members[0].enforced_by,
      clauses: members.map((m) => ({ id: m.id, title: m.title })),
      merge_preserves_enforcement: true,
      accepted_distinct: ACCEPTED_DISTINCT[key] || null,
      finding: `${members.length} clauses are enforced by the one check ${members[0].enforced_by}. `
        + 'Merge them into the shortest wording that still says everything, or record them in '
        + 'ACCEPTED_DISTINCT with the reason they must stay apart.',
    });
  }
  return out;
}
