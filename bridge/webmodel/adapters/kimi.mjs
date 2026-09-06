// Kimi Web adapter.
//
// Kimi renders a full composer on the SIGNED-OUT landing page, so the composer cannot be the
// auth signal. The login control is.
export default {
  id: 'kimi',
  label: 'Kimi Web',
  newUrl: 'https://www.kimi.com/',
  urlPattern: /^https:\/\/www\.kimi\.com\/chat\/([\w-]+)/i,
  streamPattern: /kimi\.com\/api\/chat\/[^/]+\/completion\/stream/,
  composer: 'div[contenteditable="true"], textarea',
  stopSelector: '[class*="stop"]',
  assistantSelector: '[class*="segment-assistant"], .markdown',
  excludeWithin: '[class*="thinking"], [class*="reasoning"]',
  authProbe: { deniedText: /log in to sync|log in$/i },
  signedOutProbe: 'button:has-text("Log in"), a:has-text("Log in")',
  limitText: /limit|too many requests/i,
};
