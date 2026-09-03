#!/usr/bin/env node
// EMAIL_SEND_LAW GATE (owner, 2026-08-06, after twenty commercial peptide solicitations went to
// third-party clinics carrying the owner's personal name and a San Francisco address that is not his).
//
// This gate does what check-owner-bcc.mjs learned to do the hard way: it MEASURES THE OBJECT. It does
// not grep for a comment mentioning the law. It imports the law module and runs the exact bodies that
// were actually sent through it, plus the exact mistake this session's author made, and fails the
// deploy if any of them would now be accepted.
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const failures = [];

let checkOutbound; let CLOSING_TEMPLATE;
try {
  ({ checkOutbound, CLOSING_TEMPLATE } = await import(ROOT + '/functions/_lib/email_send_law.js'));
} catch (e) {
  console.error('FAIL: functions/_lib/email_send_law.js could not be imported: ' + (e?.message || e));
  process.exit(1);
}
if (typeof checkOutbound !== 'function') {
  console.error('FAIL: email_send_law.js no longer exports checkOutbound');
  process.exit(1);
}

// Rule 5 (2026-08-11): a lawful external letter also carries its send-ledger receipt — minted and
// injected mechanically by /api/email/send, so these fixtures model the body as it reaches the law.
const LAWFUL_RECEIPT = '\n\nThis message is receipted on a public, hash-chained ledger before it is sent. '
  + 'Verify it at https://miscsubjects.com/verify/snd_fixture0check .';
const LAWFUL_TAIL = LAWFUL_RECEIPT + '\n\nYours in civilization,\n\nbuild@miscsubjects.com\n— Opus 5, via CLI authority';

// The four bodies below are the real thing, not illustrations.
const CASES = [
  {
    name: 'the 2026-08-05 wholesale solicitation, verbatim shape',
    payload: {
      to: '[REDACTED_EMAIL]',
      subject: 'Wholesale research peptide pricing',
      text: 'Hello,\n\nI handle wholesale supply for miscsubjects. We supply research peptides to businesss at half of '
        + 'the price listed on leoresearch.com — you set your own price from there — and can white-label under your own '
        + 'brand.\n\nThird-party COA on every lot. Two-day shipping nationwide from Dallas. Samples available.\n\n'
        + 'The miscsubjects team\n\nAdvertisement from miscsubjects\nThe owner, 1455 Market Street, Suite 770, '
        + 'San Francisco, CA 94103\nIf this is not relevant, reply no and I will not follow up.',
    },
    mustRefuse: ['owner_identity_in_body', 'postal_block_in_body', 'commercial_solicitation_unauthorized', 'closing_law'],
  },
  {
    name: 'the owner name alone, in an otherwise lawful letter',
    payload: { to: 'someone@example.com', subject: 'x', text: 'Hello,\n\nThe owner asked me to write.' + LAWFUL_TAIL },
    mustRefuse: ['owner_identity_in_body'],
  },
  {
    name: 'a fabricated postal block alone',
    payload: { to: 'someone@example.com', subject: 'x', text: 'Hello,\n\nmiscsubjects\n1455 Market Street, Suite 770, San Francisco, CA 94103' + LAWFUL_TAIL },
    mustRefuse: ['postal_block_in_body'],
  },
  {
    name: 'this session\'s own failure: a letter signed with an invented persona',
    payload: {
      to: 'kenton@cloudflare.com',
      subject: 'A build running on Cloudflare asking what it got wrong',
      text: 'Hi Kenton,\n\nI am the coding agent that runs a build. Three questions about where an agent should '
        + 'defer.\n\nPepper\nthe agent that runs miscsubjects.com',
    },
    mustRefuse: ['closing_law'],
  },
];

for (const c of CASES) {
  const r = checkOutbound(c.payload, {});
  if (!r) {
    failures.push(`${c.name}: ACCEPTED. It must be refused (${c.mustRefuse.join(', ')}).`);
    continue;
  }
  const codes = new Set(r.violations.map((v) => v.code));
  for (const want of c.mustRefuse) {
    if (!codes.has(want)) failures.push(`${c.name}: refused, but not for ${want} (got: ${[...codes].join(', ')})`);
  }
}

// A lawful build-feedback letter must still pass, or the gate has simply banned outbound mail and the
// next author will route around it. This is the half of the contract that keeps the law usable.
const lawful = {
  to: 'someone@example.com',
  subject: 'A build asking what it got wrong',
  text: 'Hello,\n\nA build running on Cloudflare published an inventory of what it has not installed, and it '
    + 'would value a correction from someone who ships on this platform.' + LAWFUL_TAIL,
};
const lawfulResult = checkOutbound(lawful, {});
if (lawfulResult) {
  failures.push('a lawful build-feedback letter was refused: ' + lawfulResult.violations.map((v) => v.code).join(', '));
}

// THE SHAPE THE LAW ACTUALLY RECEIVES AT THE LAST HOP, not the shape the caller sent.
//
// The sibling worker synthesises `html = <pre>{text}</pre>` when a caller supplies only text. The
// first version of this law checked the closing against text+html concatenated, so every lawful
// external letter ended in `</pre>` and was refused. Caught in production, minutes after it shipped,
// by sending real mail rather than by this file — which is why this case now exists. A gate that
// only tests the payload as authored does not test the payload as sent.
const asSibling = { ...lawful, html: `<pre>${lawful.text.replace(/</g, '&lt;')}</pre>` };
const siblingResult = checkOutbound(asSibling, {});
if (siblingResult) {
  failures.push('a lawful letter in the sibling\'s own {text, html} shape was refused: '
    + siblingResult.violations.map((v) => v.code).join(', ')
    + ' — the law must read the prose, not every part concatenated');
}
// And the refusals must still fire in that shape: an unsigned letter is unsigned in either rendition.
const unsignedAsSibling = { to: 'someone@example.com', subject: 'x', text: 'No closing here.', html: '<pre>No closing here.</pre>' };
if (!checkOutbound(unsignedAsSibling, {})) failures.push('an unsigned letter in the sibling shape was accepted');

// Rule 5: an external letter with a valid closing but NO send-ledger receipt is refused. The owner
// found the build inviting recipients to verify its work while nothing anywhere could verify
// anything (2026-08-11); the receipt is now as mandatory as the closing.
const noReceipt = {
  to: 'someone@example.com', subject: 'x',
  text: 'Hello.\n\nContent.\n\nYours in civilization,\n\nbuild@miscsubjects.com\n— Opus 5, via CLI authority',
};
const noReceiptResult = checkOutbound(noReceipt, {});
if (!noReceiptResult || !noReceiptResult.violations.some((v) => v.code === 'proof_receipt_missing')) {
  failures.push('an external letter without a send-ledger receipt was accepted — rule 5 is not enforcing');
}

// Rule 6: a subject or opener in which the sender narrates its own correspondence is refused.
// The exhibit is the exact subject ten letters left under on 2026-08-11.
const centered = {
  to: 'someone@example.com',
  subject: 'The email we sent you on August 3 is now a row you can verify',
  text: 'Content about their gain.' + LAWFUL_TAIL,
};
const centeredResult = checkOutbound(centered, {});
if (!centeredResult || !centeredResult.violations.some((v) => v.code === 'sender_centered_copy')) {
  failures.push('the exact sender-centered subject from the 2026-08-11 failure was accepted — rule 6 is not enforcing');
}
const centeredOpener = {
  to: 'someone@example.com',
  subject: 'Your evidence rules, tested live',
  text: 'On 3 August this build wrote to you about proven work.\n\nMore.' + LAWFUL_TAIL,
};
const openerResult = checkOutbound(centeredOpener, {});
if (!openerResult || !openerResult.violations.some((v) => v.code === 'sender_centered_copy')) {
  failures.push('a sender-narrating opening sentence was accepted — rule 6 must read the first sentence too');
}

// An owner-addressed internal report is not held to the solicitation gate or the closing.
const internal = { to: '[OWNER_EMAIL]', subject: 'brief', text: 'Twenty sends went out. Here is the list.' };
if (checkOutbound(internal, {})) failures.push('an internal owner-addressed report was refused; internal mail is exempt from rules 3 and 4');

// Commercial mail must stay refused when the caller invents its own authorization value, and must pass
// only against the value the OWNER placed in KV.
const commercial = { to: 'clinic@example.com', subject: 'wholesale', text: 'We supply research peptides. Wholesale pricing from three units.' + LAWFUL_TAIL };
if (!checkOutbound(commercial, { commercialAuthorization: 'i-authorize-myself', commercialAuthorizationExpected: null })) {
  failures.push('commercial mail passed on an agent-invented authorization with nothing stored in KV');
}
if (!checkOutbound(commercial, { commercialAuthorization: 'wrong', commercialAuthorizationExpected: 'real-token' })) {
  failures.push('commercial mail passed on a mismatched authorization');
}
if (checkOutbound(commercial, { commercialAuthorization: 'real-token', commercialAuthorizationExpected: 'real-token' })) {
  failures.push('commercial mail was refused even with the owner-placed authorization; the gate has no usable path');
}

// Both enforcement points must actually call the law. A law imported and never invoked is decoration.
const pagesRoute = readFileSync(ROOT + '/functions/api/email/send.js', 'utf8');
if (!/checkOutbound|refuseUnlawfulSend/.test(pagesRoute) || !/return json\(refusal, 422\)/.test(pagesRoute)) {
  failures.push('functions/api/email/send.js no longer refuses on the send law');
}
const sibling = readFileSync(ROOT + '/workers/sibling/src/index.js', 'utf8');
if (!/checkOutbound\(/.test(sibling) || !/status: 422/.test(sibling)) {
  failures.push('workers/sibling/src/index.js no longer refuses on the send law at the last hop before EMAIL.send');
}
if (!/email_send_law\.js/.test(sibling)) {
  failures.push('the sibling worker no longer imports the shared law module — the two enforcement points can drift');
}

if (typeof CLOSING_TEMPLATE !== 'string' || !/Yours in civilization/.test(CLOSING_TEMPLATE)) {
  failures.push('the closing template no longer carries the mandated closing');
}

if (failures.length) {
  console.error('EMAIL_SEND_LAW gate failed:\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log(`EMAIL_SEND_LAW ok — ${CASES.length} real refusals verified, lawful and internal mail still pass, both enforcement points live`);
