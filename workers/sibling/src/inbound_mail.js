/**
 * inbound_mail.js — the reply half of outreach.
 *
 * Until this existed the build could send 58 letters, watch 39 of them open, count 180 clicks,
 * and still not know whether a single human answered: replies forwarded to a personal inbox and
 * left no record. Every claim about outreach quality was therefore unfalsifiable.
 *
 * Every message to an address routed at this worker is stored in `lead_replies`, matched to the
 * lead and to the exact send it answers, ledgered, and then forwarded to the owner so nothing
 * he used to receive stops arriving.
 *
 * No dependency: the parser here reads only what a reply needs — the headers that identify the
 * thread and the first text/plain part. A part it cannot decode is stored raw rather than dropped,
 * because a reply recorded badly is recoverable and a reply lost is not.
 */

// FORWARD TO THE ADDRESS THAT RESOLVES TODAY. THE PRIMARY ADDRESS IS NOT WRONG, ITS DNS IS BROKEN.
//
// This was [OWNER_EMAIL] until 2026-08-05, and the commit that changed it said dsco.co "has no DNS at
// all — no MX, no A, no NS, no SOA, it does not exist." That was wrong about the cause. Measured:
//
//   - The .co registry DOES delegate dsco.co, to ns1.dnsimple.com and ns2.dnsimple.com.
//   - Both nameservers are reachable and answer REFUSED for dsco.co — they no longer serve the zone.
//     That is a lame delegation. Resolvers convert it to SERVFAIL; Cloudflare surfaced it to us as
//     "invalid recipient domain: NXDOMAIN", which is what produced the wrong conclusion.
//   - [OWNER_EMAIL] was verified as a destination at 2026-06-02T21:37:16Z. Verification requires
//     clicking a link in a message that ARRIVED, so that mailbox was real and mail did reach it.
//     The owner is right that the build's mail was reaching him. The delegation broke afterwards.
//   - [OWNER_EMAIL] is NOT the owner's address — created 2026-08-05 on a guess, never verified.
//
// So: forward to theloopway.com, which is verified and resolves, because a forward has ONE destination
// and it must be one that works. dsco.co stays the primary in the outbound BCC envelope (see
// functions/api/email/send.js) and becomes the forward target again once its delegation is repaired.
const OWNER = '[OWNER_EMAIL]';
const OWNER_PRIMARY_PENDING_DNS = '[OWNER_EMAIL]';  // real address; restore as OWNER when dig MX dsco.co answers
const MAX_BODY = 60000;

// Quoted-printable decodes to BYTES, and those bytes are usually UTF-8. Decoding straight to
// charCodes turns every non-ASCII character into mojibake ("â" for an em dash), which is how the
// first captured reply arrived before this was fixed.
function decodeQuotedPrintable(s) {
  const unfolded = s.replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < unfolded.length; i++) {
    if (unfolded[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(unfolded.slice(i + 1, i + 3))) {
      bytes.push(parseInt(unfolded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      const cp = unfolded.charCodeAt(i);
      if (cp < 128) bytes.push(cp);
      else for (const b of new TextEncoder().encode(unfolded[i])) bytes.push(b);
    }
  }
  try { return new TextDecoder('utf-8').decode(new Uint8Array(bytes)); }
  catch { return unfolded; }
}

function decodeBase64(s) {
  try {
    const bin = atob(s.replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch { return s; }
}

/** Unfold headers into a lower-cased map; a repeated header keeps its first value. */
function parseHeaders(block) {
  const out = {};
  const lines = block.replace(/\r\n[ \t]+/g, ' ').split(/\r?\n/);
  for (const line of lines) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    if (!(k in out)) out[k] = line.slice(i + 1).trim();
  }
  return out;
}

function splitHeadersBody(raw) {
  const i = raw.search(/\r?\n\r?\n/);
  if (i < 0) return [raw, ''];
  const gap = raw.slice(i).match(/^\r?\n\r?\n/)[0].length;
  return [raw.slice(0, i), raw.slice(i + gap)];
}

function decodePart(headers, body) {
  const enc = String(headers['content-transfer-encoding'] || '').toLowerCase();
  if (enc.indexOf('quoted-printable') >= 0) return decodeQuotedPrintable(body);
  if (enc.indexOf('base64') >= 0) return decodeBase64(body);
  return body;
}

/** The first text/plain part of a message, walking multipart boundaries one level deep. */
function textBody(raw) {
  const [head, body] = splitHeadersBody(raw);
  const h = parseHeaders(head);
  const ctype = String(h['content-type'] || 'text/plain');
  const boundary = (ctype.match(/boundary="?([^";]+)"?/i) || [])[1];
  if (!boundary) return { text: decodePart(h, body), headers: h };
  const parts = body.split('--' + boundary);
  let firstAny = '';
  for (const part of parts) {
    const [ph, pb] = splitHeadersBody(part.replace(/^\r?\n/, ''));
    if (!pb) continue;
    const p = parseHeaders(ph);
    const pct = String(p['content-type'] || '');
    const decoded = decodePart(p, pb);
    if (/text\/plain/i.test(pct)) return { text: decoded, headers: h };
    if (/text\/html/i.test(pct) && !firstAny) firstAny = decoded.replace(/<[^>]+>/g, ' ');
  }
  return { text: firstAny || body, headers: h };
}

/** Everything above the first quoted line — what the person actually typed back. */
function newTextOnly(text) {
  const lines = String(text).split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (/^>/.test(line)) break;
    if (/^On .{10,80}wrote:$/.test(line.trim())) break;
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim())) break;
    if (/^From:\s.+<.+@.+>/.test(line.trim()) && out.length) break;
    out.push(line);
  }
  return out.join('\n').trim();
}

function addressOf(s) {
  const m = String(s || '').match(/<([^>]+)>/);
  return String(m ? m[1] : s || '').trim().toLowerCase();
}

/** A bounce or vacation notice is not a human answering. Classified, never counted as a reply. */
function classify(headers, from, subject) {
  const auto = String(headers['auto-submitted'] || '').toLowerCase();
  const precedence = String(headers['precedence'] || '').toLowerCase();
  if (/mailer-daemon|postmaster/.test(from)) return 'bounce';
  if (String(headers['content-type'] || '').indexOf('report-type=delivery-status') >= 0) return 'bounce';
  if (auto && auto !== 'no') return 'auto';
  if (headers['x-autoreply'] || headers['x-autorespond']) return 'auto';
  if (/^(auto(matic)?[- ]?reply|out of (the )?office|away|vacation)/i.test(String(subject || ''))) return 'auto';
  if (precedence === 'bulk' || precedence === 'junk') return 'bulk';
  return 'reply';
}

export async function handleInboundEmail(message, env, ctx, opts) {
  const started = Date.now();
  // The caller has usually already drained message.raw (a stream reads once) and passes it in.
  let raw = String((opts && opts.raw) || '');
  if (!raw) {
    try { raw = await new Response(message.raw).text(); } catch (e) { raw = ''; }
  }

  const { text, headers } = raw ? textBody(raw) : { text: '', headers: {} };
  // The From: HEADER is the person. message.from is the SMTP envelope sender, which for mail
  // relayed by a provider is a bounce mailbox (bounces@cf-bounce.…) and matches no lead.
  const from = addressOf(headers.from || message.from);
  const to = addressOf(message.to || headers.to);
  const subject = String(headers.subject || '').slice(0, 500);
  const messageId = String(headers['message-id'] || '').slice(0, 300);
  const inReplyTo = String(headers['in-reply-to'] || headers.references || '').slice(0, 300);
  const kind = classify(headers, from, subject);
  const full = String(text || '').slice(0, MAX_BODY);
  const reply = newTextOnly(full).slice(0, MAX_BODY);

  // Which send does this answer? The from address is the strong signal: a lead has one address
  // and the sends table records exactly what went to it. Newest send wins when several exist.
  let leadId = null, sendId = null;
  try {
    const send = await env.DB.prepare(
      'SELECT id, lead_id FROM email_sends WHERE lower(to_email) = ? ORDER BY sent_at DESC LIMIT 1'
    ).bind(from).first();
    if (send) { sendId = send.id; leadId = send.lead_id; }
    if (leadId == null) {
      const lead = await env.DB.prepare('SELECT id FROM leads WHERE lower(email) = ? LIMIT 1').bind(from).first();
      if (lead) leadId = lead.id;
    }
  } catch { /* matching is best effort; the reply is stored either way */ }

  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO lead_replies
         (received_at, from_email, to_email, subject, kind, reply_text, full_text,
          message_id, in_reply_to, lead_id, send_id, raw_bytes, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'new')`
    ).bind(now, from, to, subject, kind, reply, full, messageId, inReplyTo, leadId, sendId, raw.length).run();
  } catch (e) {
    // A schema fault must not swallow a human reply: keep it in KV until the table accepts it.
    try {
      await env.KV.put('inbound:unstored:' + now + ':' + from,
        JSON.stringify({ from, to, subject, kind, reply, error: String(e && e.message || e) }),
        { expirationTtl: 60 * 60 * 24 * 30 });
    } catch { /* nothing further to try */ }
  }

  // A reply from a lead is a state change on that lead. `sent` -> `replied` so the pipeline
  // and every count derived from it stop reporting a silence that ended.
  if (leadId != null && kind === 'reply') {
    try {
      await env.DB.prepare(
        "UPDATE leads SET status = 'replied', notes = TRIM(COALESCE(notes,'') || ' replied:' || ?) WHERE id = ? AND status IN ('sent','drafted','enriched','new')"
      ).bind(now.slice(0, 10), leadId).run();
    } catch { /* status is derived data; the reply row is the record */ }
  }

  // Ledger it through the same door every other payload uses, so an inbound reply is visible
  // beside the send it answers instead of only in its own table.
  try {
    await fetch('https://miscsubjects.com/api/dispatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY || '' },
      body: JSON.stringify({
        key: 'LEDGER_EXEC',
        body: [
          'INSERT INTO events (id, ts, source, key, action, direction, status, request_preview, response_preview, request_json, response_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          'in_' + Date.now(), now, 'email', 'EMAIL_INBOUND', kind, 'in', '200',
          (subject || '(no subject)').slice(0, 180),
          kind + ' lead:' + (leadId == null ? 'none' : leadId) + ' send:' + (sendId || 'none'),
          JSON.stringify({ from, to, subject, message_id: messageId, in_reply_to: inReplyTo, raw_bytes: raw.length }).slice(0, 4000),
          JSON.stringify({ kind, lead_id: leadId, send_id: sendId, reply_chars: reply.length, ms: Date.now() - started }).slice(0, 4000),
        ].join('|'),
      }),
    });
  } catch { /* the ledger mirror is not the record of truth for this */ }

  // A FORWARD THAT FAILED IS NOT A FORWARD THAT HAPPENED.
  //
  // This was `try { await message.forward(...) } catch { }`. An empty catch, on the only step that
  // actually delivers anything to the owner.
  //
  // What that cost, 2026-08-05: message.forward() throws when the destination is not a VERIFIED
  // destination address in Cloudflare Email Routing. [OWNER_EMAIL] was never in that list at
  // all. So the forward threw, the error was discarded, the ledger row was written anyway — and an
  // agent then read that ledger row and reported to the owner three separate times that the message
  // was "witnessed". It witnessed this worker running. It never witnessed delivery. He told us three
  // times he had received nothing while we quoted a row id back at him as proof.
  //
  // The row is still written first and the forward still cannot lose it — that part was right. But the
  // failure is now recorded as its own ledger event, so the next reader can tell a message that
  // reached the owner from one that reached this function. A delivery step whose failure is invisible
  // is not a delivery step, it is a claim.
  const dest = (opts && opts.dest) || env.EMAIL_FORWARD || OWNER;
  // The destination IS the owner's address, and owner identity never enters a ledger event — the
  // anonymity gate blocked the first version of this for exactly that, correctly, before promotion.
  // The domain and the error carry all the diagnostic value; the local part carries none.
  const destSafe = 'owner mailbox @' + String(dest).split('@')[1] || 'owner mailbox';
  try {
    await message.forward(dest);
  } catch (e) {
    const detail = String((e && e.message) || e).replace(String(dest), destSafe);
    try {
      // Same door the inbound row above goes through, so the failure sits beside the arrival it
      // contradicts rather than in a place nobody reads.
      await fetch('https://miscsubjects.com/api/dispatch', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY || '' },
        body: JSON.stringify({
          key: 'LEDGER_EXEC',
          body: [
            'INSERT INTO events (id, ts, source, key, action, direction, status, request_preview, response_preview, request_json, response_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            'fwdfail_' + Date.now(), new Date().toISOString(), 'email', 'EMAIL_FORWARD_FAILED',
            'forward_failed', 'out', '502',
            ('forward to the ' + destSafe + ' FAILED: ' + detail).slice(0, 180),
            'the inbound row was stored; the owner did NOT receive this message',
            JSON.stringify({ dest: destSafe, from, to, subject, message_id: messageId }).slice(0, 4000),
            JSON.stringify({ error: detail, remedy: 'message.forward() and an unrestricted send_email binding can only reach addresses VERIFIED as destinations in Cloudflare Email Routing. Check GET /accounts/<id>/email/routing/addresses and verify the address before treating any send to it as delivered.' }).slice(0, 4000),
          ].join('|'),
        }),
      });
    } catch { /* if even the failure cannot be logged, the throw below is the last signal */ }
    throw new Error('forward_failed:' + destSafe + ':' + detail);
  }
}
