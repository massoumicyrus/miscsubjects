// WRITING-LAW LEASE — you cannot touch an article until you have read the law and attested against
// it, clause by clause, with the sentences you are about to publish.
//
// THE FAILURE THIS EXISTS FOR (owner, 2026-08-08, after three rewrites of one page):
//   "At some point, a fucking prompt is a fucking prompt. It isn't a prompt because it's goddamn
//    code. Not every goddamn gate has to be code solutions. It's just here are the fucking rules.
//    All you do is ignore the rules… maybe the way to do it is to have a goddamn hash where you
//    have to read the fucking prompt as your fucking instruction in order to write an article. In
//    order to write an article, you have to literally hash against the fucking rule. You can't
//    fucking touch an article until you literally read the fucking article, reiterate your
//    compliance, and then lease the fucking token to go write."
//
// WHY THE REGEX GATES WERE NOT ENOUGH. Nineteen of 124 writing clauses have a machine test. The
// other hundred are judgments — is the benefit stated before the study tally, is the comparison
// held to one standard, would a person with no context understand this. Every one of those was
// live, fetched, quoted and then disobeyed across three consecutive rewrites of the same page. A
// clause a model can read and skip is a suggestion however loudly it is written.
//
// WHAT THIS DOES INSTEAD. It makes reading the law a precondition with a receipt:
//
//   1. The agent GETs the law and computes its sha256. A stale hash is refused — you attested
//      against a law that is no longer the law.
//   2. The agent POSTs one attestation per judgment clause, each naming HOW THIS ARTICLE satisfies
//      it, and each QUOTING A SPAN OF THE BODY IT IS ABOUT TO WRITE. The quote must actually appear
//      in that body. You cannot attest to a sentence you have not written.
//   3. The server returns a token scoped to one slug, for one write, for fifteen minutes.
//   4. The article write path refuses a body write with no valid token.
//
// The third step is what makes it a lease rather than a checkbox: the attestation is checked
// against the body, so an agent that has not done the work cannot produce one, and an agent that
// has done the work produces it as a by-product of having done it.

/** The clauses no regex can hold, each of which must be attested per article. */
export const ATTESTED_CLAUSES = [
  ['W21', 'Zero context: what does the opening tell a reader who knows nothing? Quote it.'],
  ['W22', 'Premise to conclusion, in that order. Quote the sentence where the mechanism is explained, and confirm no verdict precedes it.'],
  ['W111', 'The benefit, in the first five sentences, with its tier. Quote the sentence.'],
  ['W112', 'One benefit written as effect + species + dose + count. Quote it.'],
  ['W113', 'Standard care, with what it does to the repair beside what it does to the symptom. Quote it.'],
  ['W114', 'What the evidence supports doing, led with. Quote the line that says it.'],
  ['W118', 'The first thing said about the substance is an effect, not an absence. Quote it.'],
  ['W119', 'One standard both sides. Quote the sentence that holds the comparator to the same test.'],
  ['W120', 'Relief is not reported as repair. Quote where the drug\'s effect on the tissue is stated.'],
  ['W121', 'The counted record at the real exposure, with its denominator. Quote it.'],
  ['W122', 'The effect followed to the reader\'s problem. Quote the furthest link stated.'],
  ['W123', 'What the repaired tissue is like, not only how fast. Quote it.'],
  ['W124', 'No qualifier narrowing a harm that is not also applied to the benefit. Quote or state none.'],
];

const TTL_SECONDS = 900;
const MIN_ATTESTATION = 40;
const MIN_QUOTE = 24;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The canonical hash of the law as it stands right now. */
export async function currentLawHash(lawObject) {
  const clauses = lawObject?.content?.clauses || [];
  return sha256(clauses.map((c) => `${c.id}${c.title}${c.law}`).join('\n'));
}

function normalise(s) {
  return String(s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}

/**
 * Check one lease request. Returns { ok, issues[] } — every issue at once, so an agent fixes the
 * whole set in one pass instead of discovering them one refusal at a time.
 */
export function checkAttestations({ law_hash, expected_hash, slug, body, attestations }) {
  const issues = [];
  if (!slug) issues.push({ code: 'slug_required', message: 'A lease is scoped to one article slug.' });
  if (!body || String(body).length < 200) {
    issues.push({
      code: 'body_required',
      message: 'Send the exact body you are about to write. Every attestation is checked against it, '
        + 'so the lease cannot be taken before the work is done.',
    });
  }
  if (!law_hash) {
    issues.push({ code: 'law_hash_required', message: 'GET /api/writing-law/lease for the current law and its hash, read it, then send the hash back.' });
  } else if (law_hash !== expected_hash) {
    issues.push({
      code: 'stale_law_hash',
      message: `You attested against a law that is not the law. Current hash ${expected_hash}, you sent ${law_hash}. `
        + 'Re-read GET /api/writing-law/lease — a clause changed since you last read it.',
    });
  }

  const hay = normalise(body);
  const given = attestations && typeof attestations === 'object' ? attestations : {};
  for (const [id, ask] of ATTESTED_CLAUSES) {
    const a = given[id];
    if (!a || typeof a !== 'object') {
      issues.push({ code: 'missing_attestation', clause: id, message: `${id} — ${ask} Send {how, quote}.` });
      continue;
    }
    const how = String(a.how || '').trim();
    const quote = String(a.quote || '').trim();
    if (how.length < MIN_ATTESTATION) {
      issues.push({ code: 'thin_attestation', clause: id, message: `${id}: "how" must say how THIS article satisfies the clause, in your own words. ${ask}` });
    }
    // W124 is the one clause a page can satisfy by absence, so it may attest "none".
    if (id === 'W124' && /^none\b/i.test(quote)) continue;
    if (quote.length < MIN_QUOTE) {
      issues.push({ code: 'thin_quote', clause: id, message: `${id}: quote at least ${MIN_QUOTE} characters of the body you are writing.` });
      continue;
    }
    if (!hay.includes(normalise(quote))) {
      issues.push({
        code: 'quote_not_in_body',
        clause: id,
        message: `${id}: the quote you attested is not in the body you sent. You cannot attest to a `
          + `sentence you have not written. Quote given: "${quote.slice(0, 90)}"`,
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

export async function mintToken(env, { slug, body, agent }) {
  const nonce = crypto.randomUUID();
  const token = 'wlt_' + (await sha256(nonce + slug)).slice(0, 32);
  await env.KV.put(
    'writing_law_token:' + token,
    JSON.stringify({ slug, body_hash: await sha256(body), agent: agent || null, minted_at: new Date().toISOString() }),
    { expirationTtl: TTL_SECONDS },
  );
  return { token, expires_in_seconds: TTL_SECONDS };
}

/**
 * Redeem at the write path. Single use: the key is deleted on success, so one lease is one write.
 * The body hash must match, so a lease taken over an attested body cannot be spent on another.
 */
export async function redeemToken(env, { token, slug, body }) {
  if (!token) return { ok: false, code: 'writing_law_token_required' };
  const raw = await env.KV.get('writing_law_token:' + token);
  if (!raw) return { ok: false, code: 'writing_law_token_unknown_or_expired' };
  let rec;
  try { rec = JSON.parse(raw); } catch { return { ok: false, code: 'writing_law_token_corrupt' }; }
  if (rec.slug !== slug) return { ok: false, code: 'writing_law_token_wrong_slug', expected: rec.slug };
  if (rec.body_hash !== (await sha256(body))) return { ok: false, code: 'writing_law_token_body_changed' };
  await env.KV.delete('writing_law_token:' + token);
  return { ok: true, record: rec };
}
