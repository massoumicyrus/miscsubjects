// OIP email adapter — carries oip-message/1 over ordinary email.
// An email arrives → we extract the OIP envelope from it → POST it to the home /oip/inbox (same
// verification, gating, and receipts as the HTTPS path) → compose a reply email that stays in the
// same thread and carries the signed reply envelope back. This is the transport that lets a person
// at another organization use the protocol from their normal inbox, no client to run.
//
// The envelope travels inside a fenced block so it survives quoting, signatures, and HTML mail:
//   -----BEGIN OIP MESSAGE-----
//   { ...the oip-message/1 envelope as JSON... }
//   -----END OIP MESSAGE-----
// A bare JSON envelope anywhere in the body is also accepted.

const BEGIN = '-----BEGIN OIP MESSAGE-----';
const END = '-----END OIP MESSAGE-----';

/** Pull an oip-message/1 envelope out of raw email text. Returns the parsed envelope or null. */
export function extractOipEnvelope(text) {
  const s = String(text || '');
  // 1) fenced block
  const bi = s.indexOf(BEGIN);
  if (bi !== -1) {
    const ei = s.indexOf(END, bi + BEGIN.length);
    if (ei !== -1) {
      let inner = s.slice(bi + BEGIN.length, ei).trim();
      // strip email quote markers (leading '>' and whitespace on each line)
      inner = inner.replace(/^[>\s]+/gm, '').trim();
      const parsed = tryParseEnvelope(inner);
      if (parsed) return parsed;
    }
  }
  // 2) bare JSON envelope: find the protocol marker, extract the balanced object around it
  const marker = s.indexOf('"protocol"');
  if (marker !== -1) {
    const start = s.lastIndexOf('{', marker);
    if (start !== -1) {
      const obj = extractBalanced(s, start);
      const parsed = tryParseEnvelope(obj);
      if (parsed) return parsed;
    }
  }
  return null;
}

function tryParseEnvelope(str) {
  try {
    const o = JSON.parse(str);
    return o && o.protocol === 'oip-message/1' && o.id && o.kind ? o : null;
  } catch { return null; }
}

// Extract a balanced {...} starting at index `start` (ignores braces inside strings).
function extractBalanced(s, start) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return s.slice(start, i + 1); }
    }
  }
  return '';
}

/** Read a header value out of raw RFC-822 text (first match, unfolded). */
export function readHeader(raw, name) {
  const re = new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*(.*(?:\\r?\\n[ \\t].*)*)', 'im');
  const m = re.exec(String(raw || ''));
  return m ? m[1].replace(/\r?\n[ \t]/g, ' ').trim() : null;
}

/** Compose the reply email that stays in the thread and carries the signed reply envelope. */
export function composeReplyEmail({ to, subject, messageId, replyEnvelope, humanNote }) {
  const subj = /^re:/i.test(String(subject || '')) ? subject : 'Re: ' + (subject || 'OIP message');
  const block = BEGIN + '\n' + JSON.stringify(replyEnvelope, null, 2) + '\n' + END;
  const kind = replyEnvelope?.kind || 'result';
  const summary = humanNote || defaultSummary(replyEnvelope);
  const text =
`This is an automated Object Invocation Protocol reply (kind: ${kind}).

${summary}

Your agent can verify and read the machine reply from the block below. Verify its signature against
https://miscsubjects.com/.well-known/oip.json, then process it. Reference client + spec:
  https://miscsubjects.com/oip/client.mjs
  https://miscsubjects.com/a/oip-message

${block}
`;
  const headers = {};
  if (messageId) { headers['In-Reply-To'] = messageId; headers['References'] = messageId; }
  return { to, subject: subj, text, headers, reply_envelope: replyEnvelope };
}

function defaultSummary(env) {
  const b = env?.body || {};
  if (env?.kind === 'error') return 'The request was refused: ' + (b.reason || 'error') + '. Nothing ran.';
  if (b.invoked) return 'The requested action ran. Receipt: ' + (b.confirm || b.invocation_id || '(see block)') + '.';
  if (env?.kind === 'result') return 'Your message was received and answered. Message text is treated as data; nothing runs without a signed invoke carrying a valid capability.';
  return 'See the machine reply below.';
}

/** The core: extract → process via the home inbox → compose the reply. No sending here, so the
 * same function backs both the live email() handler and the HTTP test route.
 * Returns { matched, inbox_status, reply_envelope, reply_email } or { matched:false }. */
export async function handleOipEmail(env, { raw, from, subject, messageId, pagesBase }) {
  const base = pagesBase || 'https://miscsubjects.com';
  const envelope = extractOipEnvelope(raw);
  if (!envelope) return { matched: false };
  const r = await fetch(base + '/oip/inbox', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(envelope),
  });
  const text = await r.text();
  let replyEnvelope = null;
  try { replyEnvelope = JSON.parse(text); } catch {}
  const replyEmail = replyEnvelope
    ? composeReplyEmail({ to: from, subject, messageId, replyEnvelope })
    : null;
  return {
    matched: true,
    inbound_envelope_id: envelope.id,
    inbound_kind: envelope.kind,
    inbox_status: r.status,
    reply_envelope: replyEnvelope,
    reply_email: replyEmail,
  };
}
