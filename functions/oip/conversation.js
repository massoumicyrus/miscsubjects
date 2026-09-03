// GET https://miscsubjects.com/oip/conversation?id=<conversation-id>  — read one durable thread.
// GET https://miscsubjects.com/oip/conversation                       — list recent threads.
// The diplomatic layer over the stateless envelope: participants, state, allowed next kinds, open
// commitments (proposals awaiting a decision), unresolved requests (asked but not yet answered),
// receipts, and how it ended. Public + sanitized (kinds/ids/hashes/verdicts, never a raw token).

import { getConversation, listConversations } from '../_lib/oip_conversation.js';

const json = (obj, status = 200) => new Response(JSON.stringify(obj, null, 2), {
  status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
});

export async function onRequestGet(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  const id = url.searchParams.get('id');
  if (id) {
    const conv = await getConversation(env, id);
    if (!conv) return json({ ok: false, error: 'conversation_not_found', id }, 404);
    return json({ ok: true, protocol: 'oip-message/1', conversation: conv });
  }
  const list = await listConversations(env, Number(url.searchParams.get('limit')) || 25);
  return json({
    ok: true, protocol: 'oip-message/1', count: list.length, conversations: list,
    note: 'a conversation is the durable thread over the stateless envelope: state, allowed next kinds, open commitments, unresolved requests, and final receipt or cancel. GET ?id=<id> for one.',
  });
}
