// Gemini Web adapter.
export default {
  id: 'gemini',
  label: 'Gemini Web',
  newUrl: 'https://gemini.google.com/app',
  urlPattern: /^https:\/\/gemini\.google\.com\/app\/([0-9a-f]+)/i,
  streamPattern: /gemini\.google\.com\/_\/BardChatUi\/data\/assistant/,
  composer: 'rich-textarea div[contenteditable="true"]',
  stopSelector: '[aria-label*="Stop"]',
  assistantSelector: 'model-response message-content',
  excludeWithin: '[class*="thoughts"], [class*="thinking"]',
  authProbe: { deniedText: /sign in/i },
  signedOutProbe: 'a[href*="ServiceLogin"]',
  limitText: /you've reached your limit|quota|rate limit/i,
};
