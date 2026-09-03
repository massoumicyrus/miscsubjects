import { injectOwnerBcc } from './email/send.js';
import { logEvent } from '../_lib/event_log.js';

const SIBLING = 'https://loop-safe-sibling.owner-account.workers.dev';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), { status, headers: { 'content-type': 'application/json' } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let p = {};
  const ct = request.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) p = await request.json();
    else p = Object.fromEntries((await request.formData()).entries());
  } catch { return json({ error: 'body_unreadable' }, 400); }

  if (String(p.website || '').trim() !== '') return json({ ok: true }); // honeypot: pretend success
  const name = String(p.name || '').trim().slice(0, 200);
  const email = String(p.email || '').trim().slice(0, 200);
  const organization = String(p.organization || '').trim().slice(0, 300);
  const message = String(p.message || '').trim().slice(0, 4000);
  if (!name || !EMAIL_RE.test(email)) return json({ error: 'name_and_valid_email_required' }, 400);
  if (message.length < 10) return json({ error: 'message_too_short', hint: 'describe the work in at least one sentence' }, 400);

  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS inquiries (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, organization TEXT, message TEXT, page TEXT, created_at TEXT DEFAULT (datetime('now')))"
  ).run();
  const page = String(p.page || request.headers.get('referer') || '').slice(0, 500);
  const ins = await env.DB.prepare(
    'INSERT INTO inquiries (name, email, organization, message, page) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, email, organization, message, page).run();
  const inquiryId = ins.meta?.last_row_id || null;

  const payload = injectOwnerBcc({
    to: 'build@miscsubjects.com',
    from: 'build@miscsubjects.com',
    from_name: 'miscsubjects inquiries',
    reply_to: email,
    subject: `INQUIRY #${inquiryId}: ${name}${organization ? ' — ' + organization : ''}`,
    text: `New inquiry through /inquire\n\nName: ${name}\nEmail: ${email}\nOrganization: ${organization || '(none given)'}\nPage: ${page || '(direct)'}\n\n${message}\n\nReply goes straight to the inquirer (reply_to is set). Row: inquiries #${inquiryId}.`,
  });
  const r = await fetch(SIBLING + '/email/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY || '' },
    body: JSON.stringify(payload),
  });
  const resText = await r.text();
  await logEvent(env, {
    source: 'inquiry', key: 'INQUIRE', action: 'inquiry_received', direction: 'in', status: r.status,
    request: { name, email, organization, page, message_chars: message.length },
    response: resText,
  });
  return json({ ok: true, inquiry_id: inquiryId, note: 'Received. A reply comes to the address you gave.' });
}

export async function onRequestGet() {
  return json({
    endpoint: 'POST /api/inquire',
    auth: 'none — public',
    body: { name: 'string (required)', email: 'string (required)', organization: 'string (optional)', message: 'string (required, what work you want run)' },
    what_happens: 'The inquiry is stored and reaches the operator inbox in the same send; replies go to your email. Human form at https://miscsubjects.com/inquire',
  });
}
