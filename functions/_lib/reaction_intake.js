// Blooio / iMessage tapback + emoji reaction → semantic turn for ROUTER.

const EMOJI = /\p{Extended_Pictographic}/u;

/** Pull nested Blooio v2 payload (flat or data-wrapped). */
export function unwrapBlooioPayload(parsed) {
  if (!parsed || typeof parsed !== 'object') return {};
  return parsed.data && typeof parsed.data === 'object' ? { ...parsed, ...parsed.data } : parsed;
}

/** Extract emoji glyphs from any reaction string. */
export function extractEmojis(s) {
  try { return [...String(s || '').matchAll(/\p{Extended_Pictographic}/gu)].map((m) => m[0]); }
  catch { return []; }
}

/**
 * Classify a reaction into a small intent vocabulary.
 * Unknown emojis still return kind=emoji with the glyph — ROUTER interprets from context.
 */
export function classifyReaction(raw) {
  const s = String(raw || '').trim();
  const low = s.toLowerCase();

  // Blooio human-readable: Reacted 😂 to “…”
  const reacted = low.match(/reacted\s+(.+?)\s+to\s+/i);
  const token = reacted ? reacted[1].trim() : s;

  const tap = token.replace(/[^a-z0-9_+-]/gi, '').toLowerCase() || low.replace(/[^a-z0-9_+-]/gi, '').toLowerCase();

  if (/^(dislike|thumbsdown|thumbdown|downvote|-1)$/.test(tap) || /👎|🖕|💩/.test(token)) {
    return { kind: 'reject', signal: token, emojis: extractEmojis(token) };
  }
  if (/^(like|love|emphasize|thumbsup|thumbup|upvote|\+1)$/.test(tap) || /👍|❤️|♥️|💯|🔥|✅/.test(token)) {
    return { kind: 'approve', signal: token, emojis: extractEmojis(token) };
  }
  if (/^(question|\?)$/.test(tap) || /❓|⁉️/.test(token)) {
    return { kind: 'explain', signal: token, emojis: extractEmojis(token) };
  }
  if (/^(laugh|ha|haha|lol)$/.test(tap) || /😂|🤣|😆|💀/.test(token)) {
    return { kind: 'amused', signal: token, emojis: extractEmojis(token) };
  }
  if (/^(exclaim|emphasis|!!)$/.test(tap) || /‼️|❗|⚠️|🚨/.test(token)) {
    return { kind: 'urgent', signal: token, emojis: extractEmojis(token) };
  }
  if (/^(sad|cry)$/.test(tap) || /😢|😭|💔/.test(token)) {
    return { kind: 'disappointed', signal: token, emojis: extractEmojis(token) };
  }
  if (/^(angry|mad)$/.test(tap) || /😡|🤬|💢/.test(token)) {
    return { kind: 'reject', signal: token, emojis: extractEmojis(token) };
  }

  const emojis = extractEmojis(token);
  if (emojis.length) return { kind: 'emoji', signal: token, emojis };

  if (token) return { kind: 'unknown', signal: token, emojis: [] };
  return { kind: 'unknown', signal: s, emojis: [] };
}

const INSTRUCTIONS = {
  reject: 'the owner rejected your answer to the reacted_to message. That answer failed. Read the ledger/trace for that turn, name the exact failure, fix it or escalate via CLI_SPAWN/CLI_REFLEX with a scoped brief. Reply with what was wrong and what you changed — no apology theater.',
  explain: 'the owner wants a clearer explanation of your answer to the reacted_to message. Re-read context and ledger. Explain step by step what you did and why — concrete paths, rows, traces.',
  approve: 'the owner approved your answer to the reacted_to message. Short ack only (one line). Optionally [REMEMBER] if you learned a durable preference. Do not re-explain the whole answer.',
  amused: 'the owner reacted with humor to the reacted_to message. If the answer was a mistake or absurd, treat as soft reject and troubleshoot. If it was intentionally funny, brief ack. Read context.',
  urgent: 'the owner flagged urgency on the reacted_to message. Prioritize: read ledger, act immediately, reply with the fix or next step — no preamble.',
  disappointed: 'the owner is disappointed in your answer. Same as reject: diagnose, fix or escalate, report what broke.',
  emoji: 'the owner sent an emoji reaction — treat emojis as a language. Infer intent from the glyph + reacted_to message + recent convo (approve / reject / explain / humor / urgency / emphasis). Act on the strongest read; if ambiguous, ask one direct question.',
  unknown: 'the owner sent a reaction signal you have not seen before. Infer intent from the raw signal + reacted_to text + ledger. Act; do not ask what the emoji means unless truly ambiguous.',
};

export function reactionInstruction(kind) {
  return INSTRUCTIONS[kind] || INSTRUCTIONS.unknown;
}

/** Build the ROUTER turn body for a reaction event. */
export function formatReactionTurn({ kind, signal, emojis, targetText, reactedMsgId, action, rawReaction }) {
  const emojiPart = emojis.length ? ` emojis=${emojis.join('')}` : '';
  const lines = [
    `reaction: ${kind} signal=${signal || rawReaction || '?'}${emojiPart}`,
    `action: ${action || 'add'}`,
    reactedMsgId ? `reacted_message_id: ${reactedMsgId}` : '',
    targetText ? `reacted_to: ${String(targetText).slice(0, 1200)}` : 'reacted_to: (unknown — fetch chat history or ledger)',
    '',
    reactionInstruction(kind),
  ].filter(Boolean);
  return lines.join('\n');
}

/** Parse a Blooio message.reaction webhook into a routable message or null. */
export function parseBlooioReaction(parsed) {
  const p = unwrapBlooioPayload(parsed);
  const event = String(p.event || parsed.event || '').toLowerCase();
  if (!event.includes('reaction')) return null;

  const action = String(p.action || parsed.action || 'add').toLowerCase();
  if (action === 'remove') return null;

  const from = p.external_id || p.from || p.sender || '';
  const toNumber = p.internal_id || p.to || p.receiver || p.destination || p.channel_phone_number || '';
  const chat = p.group_id || p.external_id || p.chat_id || from;
  const protocol = p.protocol || 'imessage';
  const isGroup = p.is_group ? 1 : 0;
  const targetText = p.text || p.message_text || p.body || '';
  const reactedMsgId = p.target_message_id || p.reacted_message_id || p.message_id || '';
  const rawReaction = p.reaction || '';
  const messageId = p.reaction_id || p.id || `rx_${reactedMsgId}_${rawReaction}_${Date.now()}`;

  const { kind, signal, emojis } = classifyReaction(rawReaction);
  const messageBody = formatReactionTurn({
    kind, signal, emojis, targetText, reactedMsgId, action, rawReaction,
  });

  return {
    from,
    chat,
    protocol,
    isGroup,
    messageBody,
    mediaUrls: [],
    messageId,
    toNumber,
    reactionMeta: { kind, signal, emojis, targetText, reactedMsgId, rawReaction, action },
  };
}

export function shouldAutoEscalateReaction(meta) {
  if (!meta) return false;
  return meta.kind === 'reject' || meta.kind === 'disappointed' || meta.kind === 'urgent';
}