// OIP conversation state (v1.2) — durable threads over the stateless envelope. A single signed
// message is an isolated call; a conversation is the diplomatic layer on top: who is talking, what
// state the exchange is in, which message kinds may come next, what has been promised but not yet
// delivered, what was asked but not yet answered, and how it ended (a final result or a cancel).
//
// Every envelope the home node sends or receives is recorded here, keyed by envelope.conversation.
// The store is KV (oipconv:<id>); it is sanitized (kinds, ids, hashes, verdicts — never the raw
// capability or private payload). This turns isolated signed calls into a real agent protocol with
// commitments and open questions you can inspect at GET /oip/conversation?id=<id>.

const KV_PREFIX = 'oipconv:';
const MAX_MESSAGES = 100;
const TTL_SEC = 60 * 60 * 24 * 30; // a thread persists 30 days after its last message

// The FIPA-inspired state machine. A conversation is:
//   open       — live; questions may be asked, proposals made, invocations run
//   proposed   — a proposal is on the table awaiting accept/reject
//   closed     — every request answered and no commitment open; ended by a final result
//   cancelled  — ended by a cancel
export function conversationAllowedKinds(state) {
  switch (state) {
    case 'proposed': return ['accept', 'reject', 'query', 'invoke', 'cancel', 'error'];
    case 'closed': return ['query', 'propose', 'invoke']; // a new turn may reopen it
    case 'cancelled': return [];
    default: return ['query', 'propose', 'invoke', 'result', 'event', 'cancel', 'error'];
  }
}

// accept/reject are not envelope kinds of their own — they arrive as a result/event whose body
// carries {decision:"accept"|"reject"}. We read that to resolve a proposal.
function bodyDecision(envelope) {
  const d = envelope?.body?.decision;
  return d === 'accept' || d === 'reject' ? d : null;
}

function emptyConversation(id, envelope) {
  return {
    id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    participants: [],
    state: 'open',
    messages: [],
    open_commitments: [],       // proposals awaiting a decision: {msg_id, from, summary}
    unresolved_requests: [],    // queries/invokes not yet answered: {msg_id, kind, from, key}
    receipts: [],               // invocation ids produced in this thread
    final: null,                // {kind:'result'|'cancel', msg_id, ts} once ended
  };
}

function addParticipant(conv, agent) {
  if (agent && !conv.participants.includes(agent)) conv.participants.push(agent);
}

/** Record one message (inbound to the home node, or outbound from it) and advance state.
 * meta: { direction:'inbound'|'outbound', verdict, invocation_id } */
export async function recordConversationMessage(env, envelope, meta = {}) {
  if (!env?.KV || !envelope?.conversation) return null;
  const id = String(envelope.conversation);
  let conv = null;
  try { conv = await env.KV.get(KV_PREFIX + id, 'json'); } catch {}
  if (!conv) conv = emptyConversation(id, envelope);

  addParticipant(conv, envelope.from);
  addParticipant(conv, envelope.to);

  const entry = {
    msg_id: envelope.id,
    kind: envelope.kind,
    direction: meta.direction || 'inbound',
    from: envelope.from,
    to: envelope.to,
    ts: new Date().toISOString(),
    in_reply_to: envelope.in_reply_to || null,
    verdict: meta.verdict || null,
    invocation_id: meta.invocation_id || null,
    body_sha256: envelope.body_sha256 || null,
  };
  conv.messages.push(entry);
  if (conv.messages.length > MAX_MESSAGES) conv.messages = conv.messages.slice(-MAX_MESSAGES);
  if (meta.invocation_id) conv.receipts.push(meta.invocation_id);

  // --- advance the state machine ---
  const kind = envelope.kind;
  if (kind === 'cancel') {
    conv.state = 'cancelled';
    conv.final = { kind: 'cancel', msg_id: envelope.id, ts: entry.ts };
    conv.open_commitments = [];
    conv.unresolved_requests = [];
  } else if (kind === 'query' || kind === 'invoke') {
    // a new request that expects an answer
    conv.unresolved_requests.push({ msg_id: envelope.id, kind, from: envelope.from, key: envelope.body?.key || null });
    if (conv.state === 'closed') conv.state = 'open'; // a new turn reopens
  } else if (kind === 'propose') {
    conv.open_commitments.push({ msg_id: envelope.id, from: envelope.from, summary: String(envelope.body?.summary || envelope.body?.text || 'proposal').slice(0, 200) });
    conv.state = 'proposed';
  } else if (kind === 'result' || kind === 'event' || kind === 'error') {
    // an answer: resolve the request it replies to
    if (envelope.in_reply_to) {
      conv.unresolved_requests = conv.unresolved_requests.filter((r) => r.msg_id !== envelope.in_reply_to);
      // a decision on a proposal resolves that commitment
      const decision = bodyDecision(envelope);
      if (decision) {
        conv.open_commitments = conv.open_commitments.filter((c) => c.msg_id !== envelope.in_reply_to);
      }
    }
    // closed when nothing is outstanding
    if (conv.state !== 'cancelled' && conv.unresolved_requests.length === 0 && conv.open_commitments.length === 0) {
      conv.state = 'closed';
      conv.final = { kind: 'result', msg_id: envelope.id, ts: entry.ts };
    }
  }

  conv.updated_at = entry.ts;
  try { await env.KV.put(KV_PREFIX + id, JSON.stringify(conv), { expirationTtl: TTL_SEC }); } catch {}
  return conv;
}

/** Read one conversation, with computed allowed-next kinds. */
export async function getConversation(env, id) {
  if (!env?.KV || !id) return null;
  let conv = null;
  try { conv = await env.KV.get(KV_PREFIX + String(id), 'json'); } catch {}
  if (!conv) return null;
  return { ...conv, allowed_next_kinds: conversationAllowedKinds(conv.state) };
}

/** List recent conversations (ids + summary). Bounded scan. */
export async function listConversations(env, limit = 25) {
  if (!env?.KV) return [];
  const out = [];
  try {
    const list = await env.KV.list({ prefix: KV_PREFIX, limit: Math.max(1, Math.min(limit, 100)) });
    for (const k of list.keys || []) {
      const conv = await env.KV.get(k.name, 'json');
      if (conv) out.push({ id: conv.id, state: conv.state, participants: conv.participants, messages: conv.messages.length, open_commitments: conv.open_commitments.length, unresolved_requests: conv.unresolved_requests.length, updated_at: conv.updated_at });
    }
  } catch {}
  out.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  return out;
}
