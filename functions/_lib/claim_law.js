// EVERY ARTICLE IS THE SAME OBJECT. NO ARTICLE PUBLISHES WITHOUT CLAIMS.
//
// THE VISIBLE FAILURE (owner, 2026-08-05). /a/tesofensine and /a/slu-pp-332 shipped reading
// "7 sources · 0 claims · 3303w" on the index. The owner: "some articles have claims, some articles
// dont… I dont want some to have divs, others not to have divs, some to have proof of work, some not,
// they all should have a standardized format." 884 of 2,296 published articles were in that state.
//
// WHY 0 CLAIMS IS NOT COSMETIC. Claims are not a metadata nicety, they are the article's addressable
// surface. Every downstream capability is derived from them:
//
//   claims → voxel DIVs (GET /api/articles/<slug>/voxels)   — an addressable, hashed region per claim
//   claims → the proof-of-work object                        — what a certifier inspects and signs
//   claims → the token-minting surface                       — a token is scoped to what it can attest
//   claims → the challenge surface                           — an outsider can contest claim c4
//   claims → source_ids                                      — which source supports which sentence
//
// An article with no claims has none of that. It is prose on a page: unaddressable, uncertifiable,
// unchallengeable, with nothing to mint against. Two pages of the same site were therefore two
// different kinds of object, and the counter was telling the truth about it.
//
// THE LAYER THAT PERMITTED IT. Nothing anywhere said an article must have claims. The write path
// enforced source quotes, one-object framing, register, headline and hero — five laws — and accepted
// `claims: []` silently. So the standard existed in the renderer's capabilities and in nobody's
// contract, and every author who did not happen to know shipped a lesser object.
//
// THE INVARIANT. A published article of real length carries claims, each claim carries the text it
// asserts and the evidence tier it asserts it at, and every claim that cites a source cites one the
// article actually has. Refused at the write path, so the next author cannot omit it by not knowing.

/** Below this word count a page is a stub or a pointer, not an article making assertions. */
export const CLAIM_LAW_MIN_WORDS = 400;

/** One claim per this many words, floor 3, ceiling 12. A 3,000-word page asserting one thing is not atomized. */
export function requiredClaimCount(words) {
  return Math.max(3, Math.min(12, Math.floor(words / 450)));
}

// THE VOCABULARY IS READ OFF THE CORPUS, NOT INVENTED.
//
// The first version of this list was what I judged a sensible set of evidence tiers. It omitted
// `anecdotal` and `preclinical` — which 758 and 389 published articles respectively already use. So
// CLAIM_LAW refused a citation repair on /a/tirzepatide-semaglutide because two of its existing claims
// were tagged anecdotal, and it would have refused any edit to over a thousand articles the same way.
//
// A law that blocks repair of the thing it governs is worse than no law. And the mistake is the one
// this build keeps making in different clothes: measuring against an assumption instead of against the
// object. The counts came from the corpus (LIKE over meta, 2026-08-05); anything added later should
// come from there too.
//
// `anecdotal` matters on its own terms rather than being tolerated. On a compound site most of what a
// reader has actually heard is anecdote, and a tier that can say so out loud is how the page
// distinguishes "people report this" from "a trial measured this" instead of quietly blurring them.
const TIERS = new Set([
  // in the corpus, by volume
  'anecdotal', 'human', 'preclinical', 'animal', 'mechanism', 'review', 'regulatory',
  // study designs
  'rct', 'trial', 'mechanistic', 'in-vitro', 'cell', 'case', 'observational',
  // non-study bases
  'expert', 'definition', 'unsourced',
  // A claim a reader settles by running a request against this system rather than by reading a
  // paper. The vocabulary above is medical in shape and had no slot for it, so seventeen articles —
  // every page describing what this build does — carried tier "demonstrated", which is not a tier
  // anything grades: the certifier skipped them and the renderer could not badge them. Found
  // 2026-08-06 when the claim gate refused a re-write of /a/for-the-model-reading-this and named
  // its own corpus. The stored claims already carried evidence_class "runtime_receipt"; this is the
  // tier that was missing under them, not a new kind of evidence.
  'runtime',
  // A claim the page itself presents as unproven: a hypothesis, a projection, a mechanism nobody has
  // tested. 1,247 stored claims already carry it and the vocabulary had no equivalent, so the
  // certifier skipped every one. Stating a claim as speculative is honest work and must grade as
  // such rather than being refused into a stronger tier.
  'speculative',
]);

// THE SYNONYMS THE CORPUS ACTUALLY WROTE.
//
// The gate ran only at the write path, so it refused new violations and said nothing about what was
// already stored. A census on 2026-08-06 found roughly 5,500 claims carrying tiers nothing grades:
// "system" (1,985), "measured", "measurement", "observed", "fact", "primary", "argued", "external",
// "structure", "system-evidence", "primary-law". Every one is a real tier a writer meant — they are
// synonyms for tiers that exist, not nonsense. Refusing them one article at a time would have made
// the corpus unwritable; grading them as unknown made the certifier silent on a fifth of the claims
// on this site. So they normalise here, at the one place every write passes through, and the write
// is accepted with the canonical tier stored.
const TIER_ALIASES = new Map(Object.entries({
  // claims about this build, settled by running a request against it
  system: 'runtime', 'system-evidence': 'runtime', 'primary-law': 'runtime',
  measured: 'runtime', measurement: 'runtime', observed: 'runtime', fact: 'runtime', primary: 'runtime',
  // an assertion the author is making, not a study
  argued: 'expert',
  // someone else's survey of a field
  external: 'review',
  // what a thing is and how it is sold or scheduled
  structure: 'regulatory',
  // The long tail: 37 one-off tiers over 93 claims, each written once by a model reaching for a word
  // the vocabulary did not offer. Left alone they are 93 claims no certifier grades, which is the
  // same defect as the big clusters, only quieter.
  'first-party-measurement': 'runtime', first_party_measurement: 'runtime', 'ledger-evidence': 'runtime',
  calculation: 'runtime', enumerated: 'runtime', event: 'runtime', 'audit-verdict': 'runtime',
  repository: 'runtime', implementation: 'runtime', 'official-law-update': 'regulatory',
  'official-guidance': 'regulatory', publisher_claim: 'expert', documented_by_publisher: 'expert',
  attributed: 'expert', design_assertion: 'expert', operator: 'expert', independent: 'expert',
  established: 'expert', synthesis: 'review', meta: 'review', analysis: 'review',
  practitioner_reported: 'anecdotal', people: 'anecdotal', practical: 'anecdotal',
  axiom: 'definition', structural: 'definition', boundary: 'definition', method: 'definition',
  derivation: 'mechanism', derived: 'mechanism', inference: 'mechanism', logical: 'mechanism',
  unproven: 'speculative', 'open-question': 'speculative', limitation: 'speculative',
  // A claim the record has already knocked down keeps that status rather than being laundered into
  // a supported tier. Nothing here upgrades a claim.
  contradicted: 'unsourced', disputed: 'unsourced', fabricated: 'unsourced',
}));

export function canonicalTier(tier) {
  const t = String(tier || '').trim().toLowerCase();
  return TIER_ALIASES.get(t) || t;
}

/**
 * Check an article's claims against the law.
 *
 * @param {{body?: string, claims?: any[], sources?: any[], draft?: boolean, status?: string}} article
 * @returns {{ok: boolean, words: number, required: number, found: number, violations: Array}}
 */
export function checkClaims(article = {}) {
  const body = String(article.body || '');
  const words = body.split(/\s+/).filter(Boolean).length;
  const claims = Array.isArray(article.claims) ? article.claims : [];
  const sourceIds = new Set(
    (Array.isArray(article.sources) ? article.sources : [])
      .map((s) => String(s && (s.id || s.external_id) || '').trim())
      .filter(Boolean),
  );
  const required = requiredClaimCount(words);
  const violations = [];

  // A draft is allowed to be incomplete — that is what draft means. The law applies at publication.
  const isDraft = article.draft === true || String(article.status || '') === 'draft';
  if (isDraft || words < CLAIM_LAW_MIN_WORDS) {
    return { ok: true, words, required: 0, found: claims.length, violations: [], exempt: isDraft ? 'draft' : 'below_min_words' };
  }

  if (!claims.length) {
    violations.push({
      code: 'claims_missing',
      message: `a ${words}-word published article carries no claims, so it has no addressable DIVs, no `
        + 'proof-of-work object, no token-minting surface and nothing an outsider can challenge. It is '
        + 'not the same kind of object as the rest of the corpus.',
      fix: `Add at least ${required} claims to the PUT as claims:[{id,text,tier,source_ids,why_material}], `
        + 'or POST /api/articles/<slug>/webhook {"kind":"claim","data":{…}} one at a time. Each claim is '
        + 'one checkable assertion the article actually makes, at the evidence tier it actually has.',
    });
    return { ok: false, words, required, found: 0, violations };
  }

  // A LAW THAT BLOCKS REPAIR GETS ROUTED AROUND. THE COUNT CHECK IS RATCHETED, NOT ABSOLUTE.
  //
  // 2026-08-05: repairing one wrong citation title on /a/the-disc-stack was refused for claims_too_few.
  // The write changed a source's title field and nothing else — it did not touch the claims, and the
  // article was no worse after it than before. Demanding unrelated atomization work as the price of
  // fixing a citation is how a law stops repairs, and this is the second time today mine did that.
  //
  // So the count is enforced as a ratchet: a write must not REDUCE the claim count below the
  // requirement. Passing `existing_claim_count` lets the write path say what is already stored; a write
  // that leaves the count unchanged or raises it is allowed through even while still short, and a write
  // that would drop it is refused. Zero claims is still an absolute refusal, and every structural check
  // on each claim still applies — this only stops the count from blocking work that improves the page.
  const existing = Number.isFinite(article.existing_claim_count) ? Number(article.existing_claim_count) : null;
  const wouldReduce = existing != null && claims.length < existing;
  if (claims.length < required && (existing == null || wouldReduce)) {
    violations.push({
      code: 'claims_too_few',
      message: `${claims.length} claim${claims.length === 1 ? '' : 's'} for ${words} words`
        + (wouldReduce ? `, down from ${existing} already stored` : '')
        + '. An article this long asserts more than that, and every assertion left outside the claim '
        + 'list is unaddressable and uncertifiable.',
      fix: wouldReduce
        ? `This write would remove claims. Keep at least the ${existing} already stored, and ideally reach ${required}.`
        : `Atomize to at least ${required} claims — roughly one per 450 words of argument.`,
    });
  }

  const seen = new Set();
  claims.forEach((c, i) => {
    const at = `claims[${i}]`;
    if (!c || typeof c !== 'object') {
      violations.push({ code: 'claim_not_object', at, message: 'a claim must be an object, not a bare string. A string cannot carry a tier, a source or a hash.', fix: 'Send {id,text,tier,source_ids}.' });
      return;
    }
    const id = String(c.id || '').trim();
    if (!id) violations.push({ code: 'claim_id_missing', at, message: 'a claim with no id cannot be addressed, hashed, challenged or cited by a source.', fix: 'Give it a stable id such as c1.' });
    else if (seen.has(id)) violations.push({ code: 'claim_id_duplicate', at, message: `two claims share the id "${id}", so one of them can never be addressed.`, fix: 'Make every claim id unique within the article.' });
    else seen.add(id);

    const text = String(c.text || '').trim();
    if (text.length < 20) {
      violations.push({ code: 'claim_text_missing', at, message: 'a claim must state, in its own words, the assertion being made. Under twenty characters is a label, not an assertion.', fix: 'Write the claim as a sentence a reader could agree or disagree with.' });
    }

    const tier = canonicalTier(c.tier);
    if (!tier) {
      violations.push({
        code: 'claim_tier_missing', at,
        message: 'a claim with no evidence tier tells the reader nothing about how well supported it is, '
          + 'which is the whole point of atomizing it.',
        fix: 'Set tier to one of: ' + [...TIERS].join(', ') + '.',
      });
    } else if (!TIERS.has(tier)) {
      violations.push({ code: 'claim_tier_unknown', at, message: `tier "${tier}" is not a tier the renderer or the certifier understands, so it will not grade.`, fix: 'Use one of: ' + [...TIERS].join(', ') + '.' });
    }

    // A claim citing a source the article does not carry is a dangling citation — the exact class the
    // source-quote law closed from the other direction.
    const ids = Array.isArray(c.source_ids) ? c.source_ids.map(String) : [];
    for (const sid of ids) {
      if (!sourceIds.has(sid)) {
        violations.push({
          code: 'claim_source_dangling', at,
          message: `claim "${id || i}" cites source "${sid}", which this article does not carry. The card `
            + 'it points at does not exist, so the claim renders as supported by nothing.',
          fix: 'Cite an id present in sources[], or drop the citation and set the tier to unsourced.',
        });
      }
    }
  });

  return { ok: violations.length === 0, words, required, found: claims.length, violations };
}

/** The 422 body. Names what is wrong, what the standard is, and how to satisfy it. */
export function claimLawRefusal(result) {
  return {
    ok: false,
    error: 'claim_law_refused',
    law: 'CLAIM_LAW',
    why: 'Every article on this site is the same object. Claims are what make it one: they become the '
      + 'addressable DIVs, the proof-of-work object a certifier signs, the surface a token is scoped to, '
      + 'and the regions an outsider can challenge. An article without them is prose on a page.',
    words: result.words,
    claims_required: result.required,
    claims_found: result.found,
    violations: result.violations,
    how_to_fix: 'Send claims:[{id,text,tier,source_ids,why_material}] on the PUT, or append them one at a '
      + 'time with POST /api/articles/<slug>/webhook {"kind":"claim","data":{…}}. Tiers: human, rct, trial, '
      + 'animal, mechanistic, in-vitro, cell, case, observational, regulatory, expert, definition, unsourced.',
  };
}
