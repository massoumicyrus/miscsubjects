// TRAFFIC ENGINE — the inbound-SMS router hook.
//
// Blooio delivers every inbound text to the shared webhook, which routes to agents. A funnel code
// ("JOIN ABC123") is not an agent turn: it is the second half of the SMS squeeze funnel and must go
// to the funnel handler so the visitor's page advances. This hook runs first — if the message is a
// live funnel code it is handled here (identity joined, policy re-run, reply sent, page unblocked)
// and the agent never sees it; anything else falls straight through to normal routing.

import { handleInbound, extractCode } from './funnel.js';
import { logEvent } from '../event_log.js';

/** True when the message was a live funnel code and was handled here. */
export async function maybeFunnelCode(env, m, channel, waitUntil = null) {
  try {
    const text = String(m.messageBody || '');
    if (!extractCode(text)) return false;                       // cheap: no code-shaped token → not ours
    const r = await handleInbound(env, {
      tenant: env.TRAFFIC_TENANT || 't_root', from: m.from, text, channel,
      inboundEventId: m.messageId || m.trace || null, waitUntil,
    });
    // Fall through to the agent only when there was no real funnel code to act on.
    if (!r || r.reason === 'no_code_in_message' || r.reason === 'code_not_found' || r.reason === 'no_sender') return false;
    await logEvent(env, {
      source: channel, direction: 'in', action: 'funnel_code_handled', route: '/api/traffic/sms/inbound', trace_id: m.trace || null,
      request: JSON.stringify({ from: m.from, code: extractCode(text) }),
      response: JSON.stringify({ ok: r.ok, outcome: r.outcome || r.reason || null, profile_id: r.profile_id || null }),
    });
    return true;
  } catch (e) {
    try { await logEvent(env, { source: channel, direction: 'in', action: 'funnel_code_error', route: '/api/traffic/sms/inbound', request: JSON.stringify({ from: m.from }), response: JSON.stringify({ error: String(e && e.message || e) }) }); } catch { /* ignore */ }
    return false; // never let a funnel error swallow a real message
  }
}
