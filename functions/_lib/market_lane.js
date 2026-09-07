// THE PAID LANE — a sender whose profile holds a live paid capability runs that capability's row and
// only that row, by text. Runs at the webhook entry, before the shared router, like the funnel hook.
// A sender with no purchase is left to the existing routing untouched (this lane never replies to a
// stranger who has not bought); a buyer whose uses are gone is told what ran and where to buy more.
import { dispatch } from '../api/dispatch.js';
import { sendBlooio } from '../blooio.js';
import { logEvent } from './event_log.js';
import { buildNowIso } from './build_time.js';
import { getContext, bindContext } from './capability_context.js';

const PROTECTED_NUMBERS = ['[OWNER_PHONE]', '[BUILD_PHONE]', '12065711028', '13104069604'];

const ORIGIN = 'https://miscsubjects.com';

export function parseInbound(raw) {
  let p; try { p = JSON.parse(raw); } catch { return null; }
  if (!p || typeof p !== 'object') return null;
  const d = (p.data && typeof p.data === 'object') ? p.data : {};
  const event = String(p.event || p.type || d.kind || '').toLowerCase();
  if (event && (!/received|inbound|incoming|message/.test(event) || /sent|deliver|read|typing|reaction|status/.test(event))) return null;
  if ((p.direction || d.direction) && String(p.direction || d.direction).toLowerCase() === 'outbound') return null;
  const from = p.external_id || p.from || p.sender || d.sender || d.from || (d.contact && d.contact.identifier) || '';
  const text = p.text || p.body || p.message || d.text || '';
  const chat = p.chat_id || d.chat_id || from;
  const messageId = p.message_id || d.message_id || p.id || '';
  const isGroup = !!(p.is_group || d.is_group);
  if (!from || !text) return null;
  return { from, messageBody: String(text), chat, messageId, isGroup };
}

function parseOut(r) { let v = r?.result ?? r; if (typeof v === 'string') { const s = v.replace(/^ERR:[A-Z_]+ /, ''); try { return JSON.parse(s); } catch { return { raw: v }; } } return v || {}; }

/** True when the message belonged to a paying sender and was handled here. */
export async function paidLanePreRoute(env, raw, waitUntil = null) {
  const m = parseInbound(raw);
  if (!m || m.isGroup) return false;
  const digits = String(m.from).replace(/\D/g, '');
  if (PROTECTED_NUMBERS.some((n) => digits.endsWith(n))) return false;
  let look;
  try { look = parseOut(await dispatch(env, 'PAID_LANE_LOOKUP', m.from, { actor: 'market:lane' })); } catch { return false; }
  if (!look || !look.profile_id) return false;                       // never bought: not this lane's message
  const caps = Array.isArray(look.capabilities) ? look.capabilities : [];
  const bg = (p) => { try { if (waitUntil) waitUntil(p); } catch {} };
  if (!caps.length) {
    // A buyer whose token is spent or expired: say what they had and where to buy more. Named failure.
    let last = null; try { last = await env.DB.prepare('SELECT row_key, units, created_at FROM market_sales WHERE profile_id = ? ORDER BY created_at DESC LIMIT 1').bind(look.profile_id).first(); } catch {}
    const msg = last ? `USES_EXHAUSTED: your ${last.row_key} token (${last.units} uses, bought ${String(last.created_at).slice(0, 10)}) is spent or expired. Buy more: ${ORIGIN}/api/dispatch?key=${encodeURIComponent(last.row_key)}` : `No live token on this number. Prices: ${ORIGIN}/api/dispatch?registry=1`;
    bg(sendBlooio(env, m.chat, msg));
    await logEvent(env, { source: 'market', key: 'PAID_LANE', action: 'uses_exhausted', direction: 'in', status: 429, request: { profile_id: look.profile_id, preview: m.messageBody.slice(0, 200) }, response: { replied: true } });
    return true;
  }
  // One live capability runs; if several, the first word of the message may name the row.
  const first = m.messageBody.trim().split(/\s+/)[0].toUpperCase().replace(/[^A-Z0-9_]/g, '');
  const cap = caps.find((c) => c.row_key === first) || caps[0];
  const body = cap.row_key === first ? m.messageBody.trim().slice(first.length).trim() : m.messageBody.trim();
  // Session binding: the first paid text binds the token's context to this chat; a later text from a
  // different chat is refused by name. A stolen token cannot be spent from a stranger's phone.
  try {
    const got = await getContext(env, cap.fingerprint);
    const ctx = got?.ctx || null;
    const chatId = String(m.chat || m.from);
    if (ctx && Array.isArray(ctx.session_ids) && ctx.session_ids.length && !ctx.session_ids.includes(chatId)) {
      bg(sendBlooio(env, m.chat, `SESSION_NOT_APPROVED: this token is bound to another conversation.`));
      await logEvent(env, { source: 'market', key: 'PAID_LANE', action: 'session_not_approved', direction: 'in', status: 401, request: { profile_id: look.profile_id, fingerprint: cap.fingerprint, chat: chatId }, response: { replied: true } });
      return true;
    }
    if (ctx && (!Array.isArray(ctx.session_ids) || !ctx.session_ids.length)) await bindContext(env, cap.fingerprint, { profile_id: look.profile_id, session_ids: [chatId] }, { by: 'market:lane' }).catch(() => {});
  } catch { /* a context read failure never blocks the paid run; the profile match already holds */ }
  const started = buildNowIso();
  let out; try { out = await dispatch(env, cap.row_key, body, { actor: 'cap:' + cap.fingerprint }); } catch (e) { out = { ok: false, error: e.message }; }
  const invId = out?.invocation?.id || out?.proof?.invocation_id || null;
  // Metering: one use consumed on the capability record, whatever the row answered.
  try { await env.LEDGER.prepare('UPDATE capabilities SET uses_consumed = COALESCE(uses_consumed, 0) + 1 WHERE fingerprint = ?').bind(cap.fingerprint).run(); } catch {}
  let answer = out?.result ?? out; if (typeof answer !== 'string') answer = JSON.stringify(answer);
  answer = String(answer).replace(/^HTTP \d+:/, '').trim();
  if (answer.length > 1400) answer = answer.slice(0, 1400) + ' …';
  const left = cap.uses_left === 'unlimited' ? 'unlimited' : Math.max(0, Number(cap.uses_left) - 1);
  const reply = `${answer}\n\nReceipt: ${invId ? ORIGIN + '/api/dispatch?confirm=' + invId : 'pending'}\n${cap.row_key} uses left: ${left}`;
  bg(sendBlooio(env, m.chat, reply));
  await logEvent(env, { source: 'market', key: 'PAID_LANE', action: 'paid_message_ran', direction: 'in', status: out?.ok === false ? 502 : 200, request: { profile_id: look.profile_id, row_key: cap.row_key, fingerprint: cap.fingerprint, body_chars: body.length, started }, response: { invocation_id: invId, uses_left: left, answer_chars: answer.length } });
  return true;
}
