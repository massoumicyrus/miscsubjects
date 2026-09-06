// Grok Web adapter.
export default {
  id: 'grok',
  label: 'Grok Web',
  newUrl: 'https://grok.com/',
  urlPattern: /^https:\/\/grok\.com\/c\/([0-9a-f-]{36})/i,
  streamPattern: /grok\.com\/rest\/app-chat\/conversations/,
  composer: 'div[contenteditable="true"]',
  stopSelector: '[aria-label*="Stop"]',
  // Grok renders both sides as .message-bubble; the assistant's carries the markdown body.
  assistantSelector: '.message-bubble:has(.response-content-markdown)',
  excludeWithin: '[class*="thinking"], details',
  authProbe: { deniedText: /sign in|sign up to continue/i },
  limitText: /you've reached your limit|rate limit|out of .*requests/i,
};
