const ENV_SECRET_NAMES = [
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'MCP_TOKEN',
  'TERMINAL_KEY',
  'ADMIN_SESSION_SECRET',
  'CLOUDFLARE_API_TOKEN',
  'CF_API_TOKEN',
  'CF_TOKEN',
  'KIMI_API_KEY',
  'MOONSHOT_API_KEY',
  'GROK_API_KEY',
  'XAI_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
];

const SHAPED_CREDENTIALS = [
  /sk-ant-(?:api\d+-)?[A-Za-z0-9_-]{20,}/g,
  /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/g,
  /(?:github_pat_[A-Za-z0-9_]{20,}|gh[oprsu]_[A-Za-z0-9]{30,})/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];

export function redactMirrorPreview(value, env = {}) {
  let text = String(value == null ? '' : value);
  for (const name of ENV_SECRET_NAMES) {
    const secret = String(env?.[name] || '');
    if (secret.length >= 16 && text.includes(secret)) text = text.split(secret).join(`[REDACTED:${name}]`);
  }
  for (const pattern of SHAPED_CREDENTIALS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, '[REDACTED:credential]');
  }
  return text;
}
