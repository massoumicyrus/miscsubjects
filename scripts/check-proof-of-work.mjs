#!/usr/bin/env node
// PROOF_OF_WORK_LAW (owner, 2026-08-11): every outbound external email carries a receipt that
// resolves on the public hash-chained send ledger, minted BEFORE the message leaves; the send law
// refuses a body without one at both send paths; and the verification door lets any agent verify
// and countersign keylessly. This gate fails the deploy if any link in that chain weakens.
//
// Built from the exact failure: outreach invited recipients to verify the build's work while no
// email carried a token and no surface could verify anything. The regression is any commit that
// would let that state return.
import { readFileSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const failures = [];

// ── 1. The law: rule 5 exists, is exported, and actually refuses. Measured by CALLING it, never
//       by grepping prose — a rule satisfied by a comment tests nothing (the owner-bcc lesson).
const law = await import(ROOT + '/functions/_lib/email_send_law.js').catch(() => null);
if (!law?.VERIFY_RECEIPT_RE || typeof law.checkOutbound !== 'function') {
  failures.push('email_send_law.js no longer exports VERIFY_RECEIPT_RE + checkOutbound — rule 5 is gone');
} else {
  const lawful = 'Hello.\n\nSome content.\n\nYours in civilization,\n\nbuild@miscsubjects.com\n— TestModel, via test authority';
  const noReceipt = law.checkOutbound({ to: 'stranger@example.com', text: lawful });
  if (!noReceipt || !noReceipt.violations?.some((v) => v.code === 'proof_receipt_missing')) {
    failures.push('checkOutbound accepted an external body with NO proof receipt — rule 5 is not enforcing');
  }
  const withReceipt = law.checkOutbound({
    to: 'stranger@example.com',
    text: 'Hello.\n\nVerify: https://miscsubjects.com/verify/snd_abc123def456 .\n\nYours in civilization,\n\nbuild@miscsubjects.com\n— TestModel, via test authority',
  });
  if (withReceipt && withReceipt.violations?.some((v) => v.code === 'proof_receipt_missing')) {
    failures.push('checkOutbound refused a body that DOES carry a receipt — rule 5 would block every lawful send, which is an outage the next author fixes by deleting the gate');
  }
  const internal = law.checkOutbound({ to: '[OWNER_EMAIL]', text: 'internal report, no receipt' });
  if (internal && internal.violations?.some((v) => v.code === 'proof_receipt_missing')) {
    failures.push('rule 5 fired on an INTERNAL send — owner reports must not be receipted onto the public ledger');
  }
}

// ── 2. The send path mints and injects mechanically, above the closing, so the closing law and
//       the receipt law can both hold on the same body.
const send = await import(ROOT + '/functions/api/email/send.js').catch((e) => { failures.push('functions/api/email/send.js failed to import: ' + e.message); return null; });
if (send) {
  for (const fn of ['injectProofReceipt', 'newProofId', 'externalRecipientsOf']) {
    if (typeof send[fn] !== 'function') failures.push(`functions/api/email/send.js no longer exports ${fn} — mechanical injection is gone`);
  }
  if (typeof send.injectProofReceipt === 'function' && law?.CLOSING_RE) {
    const pid = 'snd_gatecheck123';
    const out = send.injectProofReceipt({
      to: 'stranger@example.com',
      text: 'Body.\n\nYours in civilization,\n\nbuild@miscsubjects.com\n— TestModel, via test authority',
    }, pid);
    if (!out.text.includes('https://miscsubjects.com/verify/' + pid)) failures.push('injectProofReceipt did not put the receipt in the text part');
    if (!law.CLOSING_RE.test(out.text.trimEnd())) failures.push('injectProofReceipt broke the closing — the receipt must sit ABOVE the signature, not after it');
  }
  if (typeof send.externalRecipientsOf === 'function') {
    if (send.externalRecipientsOf({ to: '[OWNER_EMAIL]' }).length !== 0) failures.push('externalRecipientsOf treats the owner as external — internal reports would leak onto the public ledger');
    if (send.externalRecipientsOf({ to: '[REDACTED_EMAIL]' }).length !== 1) failures.push('externalRecipientsOf misses a plain external recipient');
  }
}
const sendSrc = readFileSync(ROOT + '/functions/api/email/send.js', 'utf8');
if (!/mintSendProof\(/.test(sendSrc)) failures.push('functions/api/email/send.js no longer mints the ledger row before the sibling hop');

// ── 3. Both send paths run the same law file, so a caller cannot route around rule 5.
const sibling = readFileSync(ROOT + '/workers/sibling/src/index.js', 'utf8');
if (!/email_send_law\.js/.test(sibling) || !/checkOutbound\(/.test(sibling)) {
  failures.push('workers/sibling/src/index.js no longer runs checkOutbound — the second send path is ungated');
}

// ── 4. The verification door exists: ledger API, witness signing, human pages.
for (const f of ['functions/api/verify/[[path]].js', 'functions/_lib/send_proof.js', 'functions/verify.js', 'functions/verify/[id].js']) {
  if (!existsSync(ROOT + '/' + f)) failures.push(f + ' is missing — the receipt in every sent email would 404');
}
const proofLib = readFileSync(ROOT + '/functions/_lib/send_proof.js', 'utf8');
for (const needle of ['verifyChain', 'witnessSign', 'mintSendProof']) {
  if (!proofLib.includes('export async function ' + needle)) failures.push('send_proof.js lost ' + needle);
}

// ── 5. Live: the door on production must answer and its chain must recompute valid. Tolerates
//       only the pre-first-deploy 404; any other state fails. Reachability failures fail loudly —
//       a gate that skips on network error is decorative.
try {
  const r = await fetch('https://miscsubjects.com/api/verify', { signal: AbortSignal.timeout(15000) });
  const text = await r.text();
  let j = null;
  try { j = JSON.parse(text); } catch { j = null; }
  if (r.status === 200 && j) {
    if (!j?.chain?.valid) failures.push(`LIVE: /api/verify chain is not valid — ${JSON.stringify(j?.chain)}`);
    else console.log(`live: send-ledger chain valid over ${j.chain.checked} rows`);
  } else if (r.status === 404 || (r.status === 200 && !j)) {
    // Non-JSON at 200 is the static shell Pages serves when the route is not deployed yet. Once
    // deployed the route answers JSON even on internal error, and deleting the route file is
    // already a static failure above — so this branch can only mean first-ship pending.
    console.log('live: /api/verify not deployed yet (first ship) — static and unit contracts only');
  } else {
    failures.push(`LIVE: /api/verify answered HTTP ${r.status}: ${text.slice(0, 120)}`);
  }
} catch (e) {
  failures.push('LIVE: /api/verify unreachable: ' + String(e?.message || e));
}

if (failures.length) {
  console.error('PROOF_OF_WORK_LAW violations:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('proof-of-work law holds: rule 5 refuses, injection is mechanical, the door verifies and countersigns');
