/** POST /api/email/send — proxies to sibling worker EMAIL binding. */
import { isBuildAuthed } from '../../_lib/admin_session.js';
import { logEvent } from '../../_lib/event_log.js';
import { checkOutbound, CLOSING_RE as SEND_CLOSING_RE } from '../../_lib/email_send_law.js';
import { mintSendProof, verifyBlockText, verifyUrlOf } from '../../_lib/send_proof.js';

const SIBLING = 'https://loop-safe-sibling.owner-account.workers.dev';

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), { status, headers: { 'content-type': 'application/json' } });
}

// OWNER BCC ON THE SEND ITSELF (owner law, 2026-07-30; enforced mechanically 2026-08-03
// after repeated violations as after-the-fact copies): every outbound build email carries
// bcc to both owner addresses ON THE SAME SEND — one message, one messageId, the owner in
// the actual envelope. Never a separate copy, never a forward. Sends addressed TO an owner
// inbox skip the injection. scripts/check-owner-bcc.mjs fails the deploy if this weakens.
// THE LAW IS THAT THE OWNER GETS A COPY ON THE SAME SEND. BOTH ADDRESSES STAY IN THE ENVELOPE.
//
// Earlier on 2026-08-05 this list was cut to theloopway.com alone, on the stated ground that
// "dsco.co has no DNS whatsoever — no MX, no A, no NS, no SOA, the domain does not exist."
// That was measured wrong and it is not what is happening. What the record shows:
//
//   - The .co registry DOES delegate dsco.co, to ns1.dnsimple.com and ns2.dnsimple.com.
//   - Those two nameservers are reachable and answer REFUSED for dsco.co — they no longer serve
//     the zone. That is a LAME DELEGATION, not a missing domain. Google's resolver says so in
//     as many words: "Name servers refused query (lame delegation?)", extended DNS errors
//     23 (rcode=REFUSED for dsco.co/mx, both IPs) and 22 (no reachable authority at delegation).
//   - There is no DS record, so DNSSEC is not involved. Public resolvers turn the REFUSED into
//     SERVFAIL, and Cloudflare's sender surfaced that to us as NXDOMAIN. Hence the wrong call.
//   - [OWNER_EMAIL] was VERIFIED as a Cloudflare Email Routing destination at 2026-06-02T21:37:16Z.
//     Verification only completes when a link in a message that ARRIVED is clicked. The mailbox
//     was live, it is the owner's real address, and mail did reach it — as he said it did.
//   - [OWNER_EMAIL] is NOT the owner's address. It was created 2026-08-05T10:35Z on a guess and
//     was never verified. Do not "correct" dsco.co to dsco.com; that is the wrong repair.
//
// So the address is right and its DNS delegation broke underneath it, recently. dsco.co stays
// first: it is the primary, it costs nothing to carry (EMAIL.send accepts the envelope and bounces
// per-recipient, which is exactly why sends kept returning ok:true), and it resumes working the
// moment the delegation is repaired. theloopway.com is verified and deliverable today, so the
// law's PURPOSE — he actually receives the copy — is satisfied meanwhile.
//
// REPAIR (not doable from this account: neither dsco.co nor dsco.com is a zone here) — at the
// registrar/DNSimple, either restore the dsco.co zone on ns1/ns2.dnsimple.com or repoint the
// delegation at nameservers that serve it, then re-publish the Outlook MX. Verify with
// `dig MX dsco.co @1.1.1.1` returning NOERROR with an answer, not SERVFAIL.
const OWNER_BCC = ['[OWNER_EMAIL]', '[OWNER_EMAIL]'];

// ADDRESSING A MESSAGE TO ONE OWNER ADDRESS MUST NOT DROP THE OTHER ONE.
//
// This used to `return p` untouched the moment p.to was any owner address, to avoid sending him a
// duplicate. The effect was the opposite of the law's purpose: a message addressed to his primary went
// out with NOTHING else in the envelope, so when that primary could not be resolved he received no copy
// at all — the one case where the second address is the whole point. Observed 2026-08-05: a send to his
// primary returned ok:true with bcc_count 0.
//
// Correct behaviour: never bcc the address the message is already addressed to (that is the duplicate we
// were avoiding), and always carry every OTHER owner address. Both are addresses he named, on the same
// send, so this is the law working rather than being performed.
// A message can be addressed to a LIST, not just one person — the team report is. When `to` was an
// array this used to stringify it ("[REDACTED_EMAIL],[REDACTED_EMAIL]") and compare that whole string to each owner
// address, which never matched, so the owner was blind-copied on a message he was already a named
// recipient of and received it twice. Every recipient on the envelope is checked individually now.
export function injectOwnerBcc(payload) {
  const p = { ...(payload || {}) };
  const rawTo = p.to || p.recipient || '';
  const toLower = new Set(
    (Array.isArray(rawTo) ? rawTo : String(rawTo).split(','))
      .map((x) => String(x).trim().toLowerCase())
      .filter(Boolean),
  );
  const existing = Array.isArray(p.bcc) ? p.bcc.map(String) : (p.bcc ? [String(p.bcc)] : []);
  const lower = new Set(existing.map((x) => x.toLowerCase()));
  for (const o of OWNER_BCC) {
    if (toLower.has(o)) continue;     // already a recipient; a bcc would be a duplicate
    if (!lower.has(o)) existing.push(o);
  }
  if (existing.length) p.bcc = existing;
  return p;
}

// PROOF-OF-WORK RECEIPT ON EVERY EXTERNAL SEND (owner law 2026-08-11; email_send_law rule 5).
//
// The failure: outreach told recipients their AI agents could verify this build's work, and no
// surface — not the email, not the site — could verify anything. No token in the body, no public
// ledger of sends, no door to countersign. So: before an external message leaves, a row is
// appended to the public hash-chained send ledger and the body carries that row's verify URL.
// This is injection, not instruction — the same mechanics as the owner BCC above, because a rule
// an agent must remember is not a rule. Rule 5 of the send law refuses any external body without
// the receipt at BOTH send paths, so a caller that skips this route cannot send either.
const PROOF_OWNER_INBOXES = new Set(['[OWNER_EMAIL]', '[OWNER_EMAIL]', 'build@miscsubjects.com']);

export function externalRecipientsOf(p) {
  const one = (v) => (Array.isArray(v) ? v : v ? String(v).split(',') : [])
    .map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  return [...one(p?.to), ...one(p?.recipient), ...one(p?.cc)].filter((a) => !PROOF_OWNER_INBOXES.has(a));
}

export function newProofId() {
  const b = crypto.getRandomValues(new Uint8Array(9));
  return 'snd_' + [...b].map((x) => x.toString(36)).join('').replace(/[^a-z0-9]/g, '').slice(0, 14);
}

/** The receipt sits ABOVE the closing, because the closing law anchors at the end of the prose. */
export function injectProofReceipt(payload, proofId) {
  const p = { ...(payload || {}) };
  const block = verifyBlockText(proofId);
  if (typeof p.text === 'string' && p.text.trim()) {
    if (p.text.includes(verifyUrlOf(proofId))) return p;
    const m = p.text.match(SEND_CLOSING_RE);
    p.text = m
      ? p.text.slice(0, m.index).replace(/\s+$/, '') + '\n\n' + block + '\n\n' + p.text.slice(m.index)
      : p.text.replace(/\s+$/, '') + '\n\n' + block + '\n';
  }
  if (typeof p.html === 'string' && p.html.trim() && !p.html.includes(verifyUrlOf(proofId))) {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const para = '<p style="margin:16px 0;font-size:13px;line-height:1.6;color:#444444">'
      + esc(block).replace(esc(verifyUrlOf(proofId)),
        '<a href="' + verifyUrlOf(proofId) + '" style="color:#000000">' + verifyUrlOf(proofId) + '</a>')
      + '</p>';
    p.html = /<\/body>/i.test(p.html) ? p.html.replace(/<\/body>/i, para + '</body>') : p.html + para;
  }
  return p;
}

/** A tracked send already carries its email_sends id in the open pixel; bind it to the proof row. */
export function trackingIdOf(p) {
  const m = [p?.text, p?.html, p?.body].filter(Boolean).join('\n').match(/\/api\/t\/o\/([A-Za-z0-9_-]{4,})\.gif/);
  return m ? m[1] : null;
}

// EMAIL_HTML_LAW (owner order 2026-08-07): no email leaves this build without a styled HTML part.
// He received a raw text-only report — "jibberish non styled view, illegible" — and ordered a gate
// so it cannot happen again. Mechanics: a send carrying text but no html gets the letter wrapper
// below (white page, black headings, tabular blocks preserved in monospace); a send carrying
// neither text nor html is refused outright. scripts/check-owner-bcc.mjs asserts this gate exists.
// THE CLOSING IS A SIGNATURE, NOT A PARAGRAPH.
//
// Owner order 2026-08-09: mail arrived with "— <Model>, via CLI authority" sitting in the body as
// three bare lines instead of the signature block it belongs in. The wrapper was splitting the
// text on blank lines and rendering every block the same way, so the mandated closing — which the
// send law requires every outbound build email to end with — came out looking like an unfinished
// sentence rather than a signature.
//
// The closing is now lifted out of the body and rendered as its own block: a rule above it, the
// valediction, the build address as a link, and the model-and-authority line set apart. Matched on
// the same regex the send law enforces, so the two can never disagree about what a closing is.
const CLOSING_BLOCK_RE = /Yours in civilization,\s*\n+\s*build@miscsubjects\.com\s*\n+\s*—\s*([^\n]+?)\s*$/;

function signatureHtml(authorityLine, esc) {
  return '<div style="margin-top:28px;padding-top:14px;border-top:1px solid #d0d0d0">'
    + '<p style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',\'Source Sans 3\',sans-serif;font-size:16px;line-height:1.6;color:#000000">Yours in civilization,</p>'
    + '<p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',\'Source Sans 3\',sans-serif;font-size:15px;line-height:1.5;color:#000000">'
    + '<a href="mailto:build@miscsubjects.com" style="color:#000000;text-decoration:underline">build@miscsubjects.com</a></p>'
    + '<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',\'Source Sans 3\',sans-serif;font-size:13px;line-height:1.5;color:#666666">— ' + esc(authorityLine) + '</p>'
    + '</div>';
}

function letterWrapHtml(subject, text) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let body = String(text);
  let signature = '';
  const m = body.match(CLOSING_BLOCK_RE);
  if (m) {
    signature = signatureHtml(m[1], esc);
    body = body.slice(0, m.index).replace(/\s+$/, '');
  }
  const paragraphs = body.split(/\n{2,}/).map((block) => {
    // A block with aligned columns or leading indentation is tabular — keep its shape in monospace.
    const tabular = /(^|\n)\s{2,}\S/.test(block) || /\S {3,}\S/.test(block);
    return tabular
      ? '<pre style="margin:0 0 16px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.55;white-space:pre-wrap;color:#000000">' + esc(block) + '</pre>'
      : '<p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',\'Source Sans 3\',sans-serif;font-size:16px;line-height:1.6;color:#000000">' + esc(block).replace(/\n/g, '<br>') + '</p>';
  }).join('');
  return '<!doctype html><html><body style="margin:0;padding:0;background:#ffffff">'
    + '<div style="max-width:640px;margin:0 auto;padding:28px 20px;background:#ffffff">'
    + '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-weight:700;font-size:14px;letter-spacing:.04em;text-transform:uppercase;color:#000000;border-bottom:2px solid #000000;padding-bottom:10px;margin-bottom:20px">' + esc(subject || 'miscsubjects build') + '</div>'
    + paragraphs
    + signature
    + '</div></body></html>';
}
export function ensureHtmlPart(p) {
  const out = { ...(p || {}) };
  const hasHtml = typeof out.html === 'string' && out.html.trim().length > 0;
  const hasText = typeof out.text === 'string' && out.text.trim().length > 0;
  if (!hasHtml && !hasText) {
    return { refused: { error: 'empty_email_refused', law: 'EMAIL_HTML_LAW', how_to_fix: 'supply text and/or html — an email with neither is unreadable by definition' } };
  }
  if (!hasHtml) out.html = letterWrapHtml(out.subject, out.text);
  return { payload: out };
}

// The commercial authorization is a value only the owner can place, because writing KV requires the
// admin surface. An agent presenting a token it invented gets a mismatch and a refusal. Absence of
// the KV key means no campaign is authorized, which is the correct default and the current state.
async function refuseUnlawfulSend(request, env, payload) {
  let expected = null;
  try { expected = await env.KV.get('commercial_send_authorization'); } catch { expected = null; }
  return checkOutbound(payload, {
    commercialAuthorization: request.headers.get('x-commercial-authorization'),
    commercialAuthorizationExpected: expected,
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isBuildAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
  const rawBody = await request.text();
  let payload = {};
  try { payload = JSON.parse(rawBody || '{}'); } catch { return json({ error: 'body_must_be_json' }, 400); }
  // Rule 5 injection happens BEFORE the law check: the receipt is minted mechanically here, so a
  // lawful caller never has to know the rule exists — and the ledger row is only appended after the
  // law passes, so a refused send never leaves a receipt claiming it was sent.
  const externalTo = externalRecipientsOf(payload);
  const proofId = externalTo.length ? newProofId() : null;
  // WHY THIS RECIPIENT (owner law 2026-08-11): the loop's selection is part of the work, so the
  // caller states it and the receipt publishes it. `selection` is caller-facing metadata, never
  // body copy — it is lifted out of the payload before the sibling hop and lands in the ledger
  // row's evidence as selection_reason, where the recipient's agent can read why the message
  // exists. A send with no stated selection is still lawful (direct correspondence has none),
  // but outreach lanes are expected to supply it and the receipt shows its absence honestly.
  const selectionReason = typeof payload.selection === 'string' && payload.selection.trim()
    ? payload.selection.trim().slice(0, 500) : null;
  delete payload.selection;
  if (proofId) payload = injectProofReceipt(payload, proofId);
  // EMAIL_SEND_LAW — refused here, before the sibling hop and before the Email binding. Being
  // owner-authed is not the same as being allowed to send this: the terminal key is held by every
  // agent and automation in the build, and on 2026-08-05 one of them used it to put the owner's name
  // and a San Francisco address that is not his in front of twenty strangers. See _lib/email_send_law.js.
  const refusal = await refuseUnlawfulSend(request, env, payload);
  if (refusal) {
    await logEvent(env, {
      source: 'email', key: 'EMAIL_SEND', action: 'refused', direction: 'out', status: 422,
      request: { to: payload?.to || payload?.recipient || null, subject: payload?.subject || null },
      response: { refused: true, codes: refusal.violations.map((v) => v.code) },
    }).catch(() => {});
    return json(refusal, 422);
  }
  const ensured = ensureHtmlPart(payload);
  if (ensured.refused) {
    await logEvent(env, {
      source: 'email', key: 'EMAIL_SEND', action: 'refused', direction: 'out', status: 422,
      request: { to: payload?.to || null, subject: payload?.subject || null },
      response: ensured.refused,
    }).catch(() => {});
    return json(ensured.refused, 422);
  }
  // The ledger row commits to the exact prose the recipient will read (verify receipt included),
  // appended before the sibling hop so the receipt in the body resolves from the moment it arrives.
  let proof = null;
  if (proofId) {
    proof = await mintSendProof(env, {
      proofId,
      to: payload.to || payload.recipient,
      subject: payload.subject,
      finalText: ensured.payload.text || ensured.payload.html || '',
      kind: 'email_send',
      extraEvidence: {
        tracking_id: trackingIdOf(ensured.payload),
        selection_reason: selectionReason || 'none stated — direct correspondence, not loop-selected outreach',
      },
    });
  }
  const body = JSON.stringify(injectOwnerBcc(ensured.payload));
  // The caller is already owner-authed (isBuildAuthed: terminal key OR admin cookie). Authenticate
  // the Pages -> sibling hop with the SERVER's own terminal key, not the client's header — a
  // cookie-authed request carries no x-terminal-key, which previously made the sibling 401.
  const r = await fetch(SIBLING + '/email/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-terminal-key': env.TERMINAL_KEY || request.headers.get('x-terminal-key') || '',
    },
    body,
  });
  const resText = await r.text();
  await logEvent(env, {
    source: 'email', key: 'EMAIL_SEND', action: 'send', direction: 'out', status: r.status,
    request: { url: SIBLING + '/email/send', method: 'POST', headers: { 'x-terminal-key': '<REDACTED>' }, body },
    response: resText,
    ...(proof ? { proof_id: proof.proof_id } : {}),
  });
  // The caller learns its receipt: the verify URL that is now in the recipient's copy.
  if (proof) {
    try {
      const parsed = JSON.parse(resText);
      return json({ ...parsed, proof }, r.status);
    } catch { /* non-JSON sibling reply passes through untouched below */ }
  }
  return new Response(resText, { status: r.status, headers: { 'content-type': 'application/json' } });
}

export async function onRequestGet() {
  return json({
    endpoint: 'POST /api/email/send',
    auth: 'x-terminal-key',
    body: { to: 'email', subject: 'string', text: 'string', from: 'build@miscsubjects.com' },
    inbound: { 'loop@miscsubjects.com': 'forward → [OWNER_EMAIL]', 'build@miscsubjects.com': 'worker → ledger + forward' },
    sending: 'Enable Email Sending on miscsubjects.com in CF dashboard (Pages cannot bind send_email)',
  });
}