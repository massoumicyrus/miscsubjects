// ChatGPT Web adapter. Everything provider-specific about ChatGPT lives in this file.
export default {
  id: 'chatgpt',
  label: 'ChatGPT Web',
  newUrl: 'https://chatgpt.com/',
  urlPattern: /^https:\/\/chatgpt\.com\/c\/([0-9a-f-]{36})/i,
  // The response whose body finishing means "the model stopped generating".
  streamPattern: /chatgpt\.com\/backend-api\/(f\/)?conversation\b/,
  composer: '#prompt-textarea',
  stopSelector: '[data-testid="stop-button"]',
  assistantSelector: '[data-message-author-role="assistant"]',
  // Reasoning summaries and tool cards are separate nodes from the final answer body.
  excludeWithin: '.text-token-text-secondary, [data-testid="reasoning-summary"], [class*="thinking"]',
  authProbe: { deniedText: /log in|sign up|welcome back/i },
  limitText: /you've (reached|hit) .*limit|usage limit|rate limit|too many requests/i,
};
