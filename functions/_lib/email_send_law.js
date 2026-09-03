// EMAIL_SEND_LAW — the send path refuses what no agent is allowed to send.
//
// THE FAILURE (owner, 2026-08-06). Between 19:36 and 20:53 on 2026-08-05, twenty commercial
// peptide-wholesale solicitations went to third-party clinics from build@miscsubjects.com. They
// carried a CAN-SPAM style footer naming the OWNER PERSONALLY and a postal address in San Francisco
// that is not his and not this build's. The owner: "using my personal name, and using an address
// which does not exist in san francisco, i can not even begin to state how much damage that is".
//
// THE LAYER THAT PERMITTED IT. Three separate rules already forbade every part of it:
//   - loop-law: "the build's own identity only … never the owner's name, never a business name,
//     never a postal block"
//   - the 2026-08-03 standing order: build feedback letters send directly, "commercial cold email
//     (the LEADS_SEND lanes) remains owner-gated"
//   - the closing law: every outbound build email ends "Yours in civilization," / the build address /
//     "— <Model>, via <surface> authority"
// All three lived in prose that only an agent which READ them could obey. /api/email/send accepted
// any JSON from any holder of the terminal key and passed it to the Email binding. A rule that is
// enforced by an agent remembering it is not enforced. Same turn, this file also caught the author:
// thirteen Cloudflare solicitations went out signed "Pepper" instead of the mandated closing.
//
// THE INVARIANT. Refused at the send path, before the Email binding, so no caller — agent, script,
// automation, or a future author who never read loop-law — can emit it.
//
//   1. The owner's name and personal addresses never appear in an outbound body.
//   2. No postal block, ever. This build has no verified postal address; a fabricated one is worse
//      than none, and a real one belonging to someone else is worse still.
//   3. Commercial solicitation to a non-owner recipient requires an explicit per-campaign owner
//      authorization. Absent it, refused — not queued, not downgraded, refused.
//   4. Every outbound body ends with the exact closing. No signature, no send.
//   5. Every outbound external body carries a resolvable proof-of-work receipt — a
//      miscsubjects.com/verify/snd_… URL minted on the public hash-chained send ledger BEFORE the
//      message leaves. Added 2026-08-11 after the owner found the build emailing strangers an
//      invitation to verify its work with nothing anywhere for anyone to verify: no token in the
//      body, no ledger on the site, no door for an agent to countersign. A claim of verifiability
//      with no verification surface is a false statement, and it is refused here the same way a
//      fabricated postal address is. /api/email/send mints and injects the receipt mechanically;
//      a caller that reaches the Email binding some other way is refused until it carries one.
//
//   6. No sender-centered narration in a subject or opener. Added 2026-08-11 after ten letters went
//      out under the subject "The email we sent you on August 3 is now a row you can verify" and a
//      body opening "On 3 August this build wrote to you about…". The owner: what the sender thinks
//      is valuable has nothing to do with what the recipient thinks is valuable — a message that
//      opens by narrating the sender's own past correspondence or its own features offers the
//      reader nothing from their seat. The mechanical form of that failure is the sender narrating
//      itself ("we sent you", "this build wrote to you", "our previous email"), and it is refused
//      here. The full seat-test lives in outreach-law OU24; this rule is the part a regex can hold.
//
// Rules 1, 2, 4, 5 and 6 have NO override. Rule 3 has exactly one, and it is a value only the owner
// can place in KV. An agent cannot grant itself the token, because writing it requires the admin surface.

/** Owner identity that may never leave the building in an outbound body. */
const OWNER_IDENTITY = [
  /\bOWNER_FIRST_NAME\b/i,
  /\bOWNER_SURNAME\b/i,
  /the owner@dsco\.co/i,
  /the owner@theloopway\.com/i,
];

/**
 * A postal block: a street line, or a US city/state/ZIP tail. Deliberately broad. The build has no
 * verified mailing address, so there is no legitimate reason for one to appear in an outbound body,
 * and the cost of a false positive (an agent rewrites a sentence) is nothing next to the cost of a
 * false negative (a real address in a real building attributed to the owner).
 */
const POSTAL_BLOCK = [
  [/\b\d{1,6}\s+[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,4}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Parkway|Pkwy|Square|Sq|Terrace|Highway|Hwy)\b/i, 'a street address'],
  [/\bSuite\s+\d+|\bSte\.?\s+\d+|\bUnit\s+\d+|\bApt\.?\s+\d+|\bPO Box\s+\d+/i, 'a suite, unit or PO box line'],
  [/\b[A-Z][A-Za-z .'-]+,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\s+\d{5}(?:-\d{4})?\b/, 'a city, state and ZIP line'],
];

/**
 * Commercial solicitation markers. Two or more distinct hits, or any one of the unambiguous ones,
 * classify a body as commercial. Editorial prose that merely mentions a price does not trip this;
 * a body that quotes wholesale pricing at a stranger does.
 */
const COMMERCIAL_UNAMBIGUOUS = [
  [/\bwholesale\s+(?:pricing|price|supply|rate|cost)\b/i, 'wholesale pricing'],
  [/\bwhite[- ]label\b/i, 'a white-label offer'],
  [/\badvertisement\s+from\b/i, 'an advertisement disclosure'],
  [/\bwe supply\b|\bwe sell\b|\bwe stock\b/i, 'a supply offer'],
  [/\breorder\b.*\b(?:price|pricing|discount|unit)\b/i, 'a reorder solicitation'],
];
const COMMERCIAL_WEAK = [
  [/leoresearch\.com|loopbiolabs\.com|theloopway\.com\/shop/i, 'a storefront link'],
  [/\b(?:listed|retail)\s*\$\s?\d/i, 'a listed price'],
  [/\b\d+\s*%\s*(?:of|off)\b/i, 'a discount'],
  [/\bper (?:vial|unit)\b|\b\d+\s*mg\b.*\$\s?\d/i, 'unit pricing'],
  [/\bsamples? available\b|\bset up a (?:short )?call\b/i, 'a sales close'],
  [/\bCOA\b|\bcertificate of analysis\b/i, 'a product assurance claim'],
];

/** The exact closing every outbound build email ends with (loop-law, /a/outreach-law). */
export const CLOSING_RE = /Yours in civilization,\s*\n+\s*build@miscsubjects\.com\s*\n+\s*—\s*[^\n]+,\s*via\s+[^\n]+\s+authority\s*$/;

export const CLOSING_TEMPLATE = 'Yours in civilization,\n\nbuild@miscsubjects.com\n— <Model>, via <surface> authority';

/** Rule 5: the proof-of-work receipt every external body must carry. Minted at /api/email/send on
 *  the public hash-chained send ledger; the URL resolves for anyone, keylessly. */
export const VERIFY_RECEIPT_RE = /https:\/\/miscsubjects\.com\/verify\/snd_[a-z0-9]{6,}/i;

/** Rule 6: sender-centered narration — the sender talking about its own correspondence or itself
 *  as the subject of the message. Checked against the subject and the first sentence of the prose,
 *  because that is where the reader decides. The receipt block and the closing are exempt by
 *  position: they sit at the end, after the message has already earned its read. */
export const SENDER_CENTERED_RES = [
  /\b(?:the|that|our)\s+(?:e-?mail|message|letter)\s+(?:we|this build|I)\s+(?:sent|wrote|emailed)\b/i,
  /\b(?:we|this build|I)\s+(?:sent|wrote|emailed)\s+(?:you|to you)\b/i,
  /\bour\s+(?:previous|last|earlier|prior)\s+(?:e-?mail|message|letter|correspondence)\b/i,
  /\bfollowing up on\b/i,
  /^\s*(?:on\s+\d|\w+\s+\d{1,2}[,\s])[^.!?\n]{0,80}\b(?:we|this build|I)\s+(?:wrote|sent|emailed|reached out)\b/i,
];

export function senderCenteredHit(subject, prose) {
  const firstSentence = String(prose || '').trim().split(/(?<=[.!?])\s/)[0] || '';
  for (const re of SENDER_CENTERED_RES) {
    const m = String(subject || '').match(re) || firstSentence.match(re);
    if (m) return m[0];
  }
  return null;
}

/** Addresses that are the owner himself; a message TO him is internal and exempt from rules 3 and 4. */
const OWNER_INBOXES = new Set(['[OWNER_EMAIL]', '[OWNER_EMAIL]', 'build@miscsubjects.com']);

/**
 * Everything a recipient could read, for the checks that ask "does this contain X" — the plain part
 * and the HTML part both go out, so both are searched.
 */
function bodyOf(p) {
  return [p?.text, p?.body, p?.html].filter(Boolean).map(String).join('\n');
}

/**
 * THE CLOSING IS CHECKED AGAINST THE PROSE, NOT AGAINST EVERY PART CONCATENATED.
 *
 * Caught in production 2026-08-06, minutes after this law went live: the sibling worker synthesises
 * `html = <pre>{text}</pre>` when a caller sends only `text`, so the concatenated form ends in
 * `</pre>` and NO lawful letter could ever end with the closing. The law would have refused every
 * external send — which is not enforcement, it is an outage that the next author fixes by deleting
 * the gate. A law that blocks the work it governs gets routed around; that failure class is already
 * in this build's vault twice.
 *
 * So: take the plain-text part if there is one, otherwise strip tags from the HTML, and check the
 * closing against that single rendition.
 */
function proseOf(p) {
  const text = String(p?.text || p?.body || '').trim();
  if (text) return text;
  return String(p?.html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|pre|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .trim();
}

function recipientsOf(p) {
  const one = (v) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  return [...one(p?.to), ...one(p?.recipient), ...one(p?.cc)];
}

/**
 * Check one outbound payload. Returns null when lawful, or a refusal object naming every violation.
 *
 * @param {object} payload            the send payload as it would reach the Email binding
 * @param {object} [opts]
 * @param {string|null} [opts.commercialAuthorization]  the value presented by the caller
 * @param {string|null} [opts.commercialAuthorizationExpected]  the value stored in KV by the owner
 */
export function checkOutbound(payload, opts = {}) {
  const p = payload || {};
  const text = bodyOf(p);
  const to = recipientsOf(p);
  const violations = [];

  // An internal message — one addressed only to the owner or to the build itself — is a report, not
  // outbound correspondence. It still may not carry a fabricated postal block, but it is not held to
  // the solicitation gate or the closing.
  const externalRecipients = to.filter((a) => !OWNER_INBOXES.has(a));
  const isInternal = externalRecipients.length === 0;

  // ── 1. OWNER IDENTITY. No override, internal or not: his name in a body is one forward away from
  //       being public, and the whole egress model is that the build speaks, never the person.
  for (const re of OWNER_IDENTITY) {
    const m = text.match(re);
    if (m) {
      violations.push({
        code: 'owner_identity_in_body',
        found: m[0],
        message: `the body names the owner ("${m[0]}"). Outbound mail carries the build's identity only: `
          + 'build@miscsubjects.com and its own numbers. The person behind it is never in the envelope.',
        fix: 'Remove the name. Sign with the closing block; that is what identifies the sender.',
      });
      break;
    }
  }

  // ── 2. POSTAL BLOCK. No override. There is no verified postal address for this build, so every
  //       address that could appear is either invented or someone else's.
  for (const [re, what] of POSTAL_BLOCK) {
    const m = text.match(re);
    if (m) {
      violations.push({
        code: 'postal_block_in_body',
        found: m[0].trim(),
        message: `the body contains ${what} ("${m[0].trim()}"). This build has no verified mailing address. `
          + 'An invented one is a false statement of origin, and a real one belonging to someone else is worse.',
        fix: 'Delete the address block entirely. If a physical address is legally required for this class '
          + 'of message, that message may not be sent from this build until the owner supplies a real one.',
      });
      break;
    }
  }

  if (!isInternal) {
    // ── 3. COMMERCIAL SOLICITATION. Owner-gated, per the standing order of 2026-08-03.
    const hits = [];
    for (const [re, what] of COMMERCIAL_UNAMBIGUOUS) if (re.test(text)) hits.push({ what, strong: true });
    for (const [re, what] of COMMERCIAL_WEAK) if (re.test(text)) hits.push({ what, strong: false });
    const commercial = hits.some((h) => h.strong) || hits.length >= 2;
    if (commercial) {
      const expected = String(opts.commercialAuthorizationExpected || '').trim();
      const presented = String(opts.commercialAuthorization || '').trim();
      const authorized = expected.length > 0 && presented === expected;
      if (!authorized) {
        violations.push({
          code: 'commercial_solicitation_unauthorized',
          found: hits.map((h) => h.what),
          recipients: externalRecipients,
          message: 'this is a commercial solicitation to a third party. Commercial cold email is owner-gated '
            + 'and was never un-gated; build feedback letters send directly, sales mail does not.',
          fix: 'Do not send. If the owner authorizes this campaign, he places the campaign token in KV at '
            + 'commercial_send_authorization and it is presented as x-commercial-authorization on the send. '
            + 'An agent cannot mint that token; writing it requires the admin surface.',
        });
      }
    }

    // ── 6. SENDER-CENTERED NARRATION. No override. The reader decides at the subject and the
    //       first sentence; a sender narrating its own correspondence there has offered them
    //       nothing. The judgment form of this law is outreach-law OU24; this is the regex form.
    const centered = senderCenteredHit(p?.subject, proseOf(p));
    if (centered) {
      violations.push({
        code: 'sender_centered_copy',
        found: centered,
        message: `the subject or opening sentence narrates the sender ("${centered}"). What the sender `
          + 'thinks is valuable has nothing to do with what the recipient thinks is valuable. On '
          + '2026-08-11 ten letters left under "The email we sent you on August 3 is now a row you can '
          + 'verify" — the sender admiring its own artifact.',
        fix: 'Rewrite from the recipient\'s seat: the subject names THEIR problem or THEIR gain in their '
          + 'units. State "<recipient>\'s problem is X; this message gives them Y" before drafting — if Y '
          + 'is only expressible as one of this build\'s features, do not send (outreach-law OU24).',
      });
    }

    // ── 5. THE PROOF RECEIPT. No override. Every external send is a row on the public send ledger
    //       BEFORE it leaves, and the body carries the row's verify URL so the recipient — or their
    //       agent — can resolve it, recompute the chain, inspect the work that produced the message,
    //       and countersign. A body with no receipt is a claim with no evidence; refused.
    if (!VERIFY_RECEIPT_RE.test(bodyOf(p))) {
      violations.push({
        code: 'proof_receipt_missing',
        message: 'the body carries no proof-of-work receipt (https://miscsubjects.com/verify/snd_…). '
          + 'Every external send is receipted on the public hash-chained send ledger before it leaves, '
          + 'and the body must carry its verify URL so any recipient or agent can verify the send and '
          + 'the work behind it. On 2026-08-11 the owner found outreach inviting verification while '
          + 'nothing on any surface could verify anything.',
        fix: 'Send through POST https://miscsubjects.com/api/email/send — it mints the ledger row and '
          + 'injects the receipt mechanically. Do not hand-write a verify URL: one that does not resolve '
          + 'to a chain-valid row is a false receipt and worse than none.',
      });
    }

    // ── 4. THE CLOSING. No override. It is how a recipient knows a machine wrote it and under whose
    //       authority, which is the disclosure the whole outreach posture rests on.
    if (!CLOSING_RE.test(proseOf(p).trimEnd())) {
      violations.push({
        code: 'closing_law',
        message: 'the body does not end with the mandated closing, so it does not disclose that a model wrote '
          + 'it or under whose authority. On 2026-08-06 thirteen letters went out signed with an invented '
          + 'persona instead.',
        fix: 'End the body with exactly:\n' + CLOSING_TEMPLATE,
      });
    }
  }

  if (!violations.length) return null;
  return {
    ok: false,
    error: 'email_send_law',
    law: 'EMAIL_SEND_LAW',
    why: 'Outbound mail is the one surface where a mistake cannot be revised, deleted, or re-rendered. '
      + 'It is therefore refused at the send path rather than corrected afterwards.',
    state_changed: false,
    sent: false,
    violations,
  };
}
