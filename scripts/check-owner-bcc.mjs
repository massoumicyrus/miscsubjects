#!/usr/bin/env node
// OWNER BCC LAW (owner, 2026-07-30; mechanical 2026-08-03): every outbound build email
// carries bcc to the owner ON THE SEND ITSELF — never an after-the-fact copy. This gate
// fails the deploy if the send route stops injecting the bcc, reintroduces separate owner
// copies, or the sibling stops passing bcc to the Email binding.
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const failures = [];

const send = readFileSync(ROOT + '/functions/api/email/send.js', 'utf8');
if (!/injectOwnerBcc/.test(send) || !/OWNER_BCC\s*=\s*\[/.test(send)) {
  failures.push('functions/api/email/send.js no longer injects the owner bcc on the send itself');
}
// THE GATE MUST MEASURE THE OBJECT, NOT THE PROSE AROUND IT.
//
// This check used to be `/the owner@dsco\.co/.test(send)` — a regex over the WHOLE FILE. On 2026-08-05
// the address was removed from the actual OWNER_BCC array and this gate still passed, because the
// commit that removed it left the string sitting in a comment explaining the removal. A needle that
// can be satisfied by a comment tests nothing. Assert against the parsed array literal instead, so
// only a real entry in the real list can satisfy it.
const OWNERS = ['[OWNER_EMAIL]', '[OWNER_EMAIL]'];
const bccLiteral = send.match(/const OWNER_BCC\s*=\s*\[([^\]]*)\]/);
if (!bccLiteral) {
  failures.push('functions/api/email/send.js: could not find the OWNER_BCC array literal to measure');
} else {
  const listed = [...bccLiteral[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1].toLowerCase());
  for (const o of OWNERS) {
    if (!listed.includes(o)) failures.push(`OWNER_BCC array literal is missing ${o} (found: ${listed.join(', ') || 'nothing'})`);
  }
}
if (/Owner copy — sent to/.test(send) || /EMAIL_OWNER_COPY/.test(send)) {
  failures.push('functions/api/email/send.js reintroduced after-the-fact owner copies — the law is bcc on the SAME send');
}

const sibling = readFileSync(ROOT + '/workers/sibling/src/index.js', 'utf8');
if (!/bcc.*\{\s*bcc\s*\}|\{\s*bcc\s*\}\s*:\s*\{\}/.test(sibling) && !/\.\.\.\(bcc\.length \? \{ bcc \} : \{\}\)/.test(sibling)) {
  failures.push('workers/sibling/src/index.js /email/send no longer passes bcc to the Email binding');
}

// The unit contract: injection adds BOTH owner addresses, dedupes, and skips owner-addressed sends.
const { injectOwnerBcc } = await import(ROOT + '/functions/api/email/send.js').catch(() => ({}));
if (typeof injectOwnerBcc === 'function') {
  const a = injectOwnerBcc({ to: 'x@example.com' });
  for (const o of OWNERS) {
    if (!Array.isArray(a.bcc) || !a.bcc.includes(o)) failures.push(`injectOwnerBcc does not add ${o}`);
  }
  for (const o of OWNERS) {
    const b = injectOwnerBcc({ to: 'x@example.com', bcc: [o] });
    if ((b.bcc || []).filter((x) => x === o).length !== 1) failures.push(`injectOwnerBcc duplicates ${o}`);

    // Addressing a message TO one owner address must not bcc that same address (a duplicate), but MUST
    // still carry every other owner address. The old contract asserted the whole injection was skipped,
    // which meant a message addressed to the primary went out with an empty envelope — and when that
    // primary could not be resolved, he received nothing. That is the failure this gate now prevents.
    const c = injectOwnerBcc({ to: o });
    const got = (c.bcc || []).map((x) => String(x).toLowerCase());
    if (got.includes(o)) failures.push(`injectOwnerBcc bcc'd ${o} on a send already addressed to it`);
    for (const other of OWNERS.filter((x) => x !== o)) {
      if (!got.includes(other)) failures.push(`a send addressed to ${o} dropped the other owner address ${other} — if ${o} cannot be resolved he receives nothing`);
    }
  }
} else {
  failures.push('injectOwnerBcc is not exported/importable from the send route');
}

// THE LAW'S PURPOSE IS THAT HE ACTUALLY RECEIVES THE COPY, SO MEASURE DELIVERABILITY TOO.
//
// Carrying an address whose domain cannot be resolved is what let "the owner was bcc'd" mean nothing
// for weeks. This resolves the MX of every owner domain in the list and fails ONLY when NOT ONE of
// them is deliverable — a single broken primary is reported, not fatal, because the other address
// still satisfies the purpose. It always reports how many domains it examined: zero examined means
// the check itself is broken, and that is a failure rather than a silent pass.
const domains = [...new Set(OWNERS.map((o) => o.split('@')[1]))];
const mx = [];
for (const d of domains) {
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(d)}&type=MX`, {
      headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(6000),
    });
    const j = await r.json();
    const ok = j.Status === 0 && Array.isArray(j.Answer) && j.Answer.length > 0;
    mx.push({ domain: d, deliverable: ok, status: j.Status, note: j.Comment || null });
  } catch (e) {
    // Offline or DNS-over-HTTPS blocked: record it as unknown rather than as a pass or a crash.
    mx.push({ domain: d, deliverable: null, error: String(e?.message || e) });
  }
}
const examined = mx.length;
const known = mx.filter((m) => m.deliverable !== null);
if (examined === 0) {
  failures.push('OWNER_BCC deliverability check examined 0 domains — the check is broken, not passing');
} else if (known.length && !known.some((m) => m.deliverable)) {
  failures.push(`no owner address is deliverable: ${JSON.stringify(mx)} — the owner cannot receive the copy the law exists to give him`);
}
const degraded = mx.filter((m) => m.deliverable === false).map((m) => m.domain);

if (failures.length) {
  console.error(JSON.stringify({ ok: false, law: 'OWNER_BCC_LAW', failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  law: 'OWNER_BCC_LAW',
  checked: 'OWNER_BCC array literal carries both owner addresses; send route injects bcc on the send itself; sibling passes bcc; no after-the-fact copies; unit contract holds',
  owner_domains_examined: examined,
  deliverability: mx,
  ...(degraded.length ? { degraded, warning: `${degraded.join(', ')} cannot be resolved right now — the other owner address is carrying delivery. Repair the delegation; see functions/api/email/send.js` } : {}),
}, null, 2));

// ---------------------------------------------------------------------------
// EMAIL_HTML_LAW (owner order 2026-08-07): no email leaves the build without a
// styled HTML part. The owner received a raw text-only report and named it
// illegible. These assertions pin the gate so a refactor cannot drop it:
//   1. send.js carries ensureHtmlPart and wires it into the send path.
//   2. send.js refuses an email with neither text nor html.
//   3. The LBL daily report composes real HTML tables, not just text.
{
  const sendSrc = readFileSync(new URL('../functions/api/email/send.js', import.meta.url), 'utf8');
  // Pointed at the LIVE template. It used to read lbl_daily_email.js, which nothing has imported
  // since the three report kinds were folded into one family on 2026-08-07 — so the gate was
  // guarding a corpse while the file that actually ships was unguarded.
  const lblSrc = readFileSync(new URL('../functions/_lib/lbl_report_email.js', import.meta.url), 'utf8');
  const htmlFailures = [];
  if (!sendSrc.includes('function ensureHtmlPart')) htmlFailures.push('send.js lost ensureHtmlPart — the unstyled-email gate is gone');
  if (!sendSrc.includes('ensureHtmlPart(payload)')) htmlFailures.push('send.js no longer calls ensureHtmlPart on the send path');
  if (!sendSrc.includes('empty_email_refused')) htmlFailures.push('send.js no longer refuses an email with neither text nor html');
  if (!sendSrc.includes('letterWrapHtml')) htmlFailures.push('send.js lost the letter wrapper that styles text-only sends');
  if (!lblSrc.includes('<table')) htmlFailures.push('lbl_report_email.js no longer composes HTML tables');
  // THE TEAM REPORT CARRIES NO SIGNATURE. Owner order 2026-08-09: "no via loop build, no any of
  // that". It used to close "Yours in Civilization, / The Loop build".
  //
  // The search runs over the source with JAVASCRIPT comments stripped and HTML comments LEFT IN,
  // because those two behave differently and the difference is what went wrong: the first removal
  // put the banned words in an `<!-- ... -->` note inside the template literal, which is invisible
  // on screen but present in every recipient's HTML source. A plain source search calls that a
  // pass; stripping HTML comments too would also call it a pass. What is left after stripping only
  // JS comments is exactly the text that can reach a recipient.
  {
    const emittable = lblSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')          // JS block comments never ship
      .split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n'); // nor line comments
    for (const banned of ['Yours in Civilization', 'The Loop build']) {
      if (emittable.includes(banned)) {
        htmlFailures.push(`the team report can still emit "${banned}" — the owner ordered no signature on it (an HTML comment inside the template counts: it ships)`);
      }
    }
  }
  if (htmlFailures.length) {
    console.error(JSON.stringify({ ok: false, law: 'EMAIL_HTML_LAW', failures: htmlFailures }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, law: 'EMAIL_HTML_LAW', checked: 'send path auto-wraps text-only mail in the letter template, refuses empty mail; LBL daily composes real HTML tables' }));
}
