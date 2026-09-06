// Claude Web adapter.
export default {
  id: 'claude',
  label: 'Claude Web',
  newUrl: 'https://claude.ai/new',
  urlPattern: /^https:\/\/claude\.ai\/chat\/([0-9a-f-]{36})/i,
  streamPattern: /claude\.ai\/api\/organizations\/[^/]+\/chat_conversations\/[^/]+\/completion/,
  composer: 'div[contenteditable="true"]',
  stopSelector: '[aria-label*="Stop"]',
  // The transcript renders each message in a testid'd row; the assistant's body is the
  // font-claude-response block. Both are matched because Claude ships UI changes often.
  assistantSelector: '.font-claude-response, [data-testid="chat-message-content"]',
  excludeWithin: '[data-testid="thinking-block"], [class*="thinking"], details',
  authProbe: { deniedText: /sign in|log in to claude/i },
  limitText: /message limit|you are out of|usage limit|rate limit/i,
};
