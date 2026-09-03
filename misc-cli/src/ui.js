// Monochrome by choice: white on black, brightness as the only accent. Colour in a coding
// tool is noise — the eye should land on the answer, not the chrome.
const ON = process.stdout.isTTY;

const wrap = (code) => (s) => (ON ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const ui = {
  dim: wrap('38;5;245'),
  faint: wrap('38;5;240'),
  white: wrap('38;5;255'),
  bold: wrap('1;38;5;255'),
  rule: (w = 60) => (ON ? `\x1b[38;5;238m${'─'.repeat(w)}\x1b[0m` : '-'.repeat(w)),
};

export const RATES = {
  '@cf/moonshotai/kimi-k2.7-code': { in: 0.95, cached: 0.19, out: 4.00 },
  '@cf/moonshotai/kimi-k2.6': { in: 0.95, cached: 0.16, out: 4.00 },
  '@cf/moonshotai/kimi-k2.5': { in: 0.60, cached: 0.10, out: 3.00 },
  '@cf/zai-org/glm-5.2': { in: 1.40, cached: 0.26, out: 4.40 },
  '@cf/zai-org/glm-4.7-flash': { in: 0.06, cached: 0.06, out: 0.40 },
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b': { in: 0.497, cached: 0.497, out: 4.881 },
  '@cf/google/gemma-4-26b-a4b-it': { in: 0.027, cached: 0.027, out: 0.201 },
  '@cf/zai-org/glm-4.6': { in: 0.051, cached: 0.051, out: 0.335 },
};

// The published id the CLI carries maps back to the model Cloudflare bills for.
export const RAW_OF = {
  'claude-kimi-k2.7-code': '@cf/moonshotai/kimi-k2.7-code',
  'claude-kimi-k2.6': '@cf/moonshotai/kimi-k2.6',
  'claude-glm-5.2': '@cf/zai-org/glm-5.2',
  'claude-glm-flash': '@cf/zai-org/glm-4.7-flash',
};

export function rateFor(modelId) {
  return RATES[modelId] || RATES[RAW_OF[modelId]] || null;
}

// Cost of one turn, in dollars, or null when the model has no published price.
export function turnCost(modelId, usage) {
  const rate = rateFor(modelId);
  if (!rate || !usage) return null;
  const cached = usage.cache_read_input_tokens || 0;
  const fresh = Math.max(0, (usage.input_tokens || 0) - cached);
  return (fresh * rate.in + cached * (rate.cached ?? rate.in) + (usage.output_tokens || 0) * rate.out) / 1e6;
}


const SECRETS = [
  /\baig_[A-Za-z0-9_-]{12,}/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bxai-[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{16,}/g,
  /\bAIza[A-Za-z0-9_-]{20,}/g,
  /("(?:token|api_key|apiKey|secret|password|act_token|terminal_key)"\s*:\s*")[^"]{8,}(")/gi,
  /\b(Bearer|x-api-key:|x-terminal-key:)\s+[A-Za-z0-9._-]{12,}/gi,
];

export function redact(text) {
  let s = String(text ?? '');
  s = s.replace(SECRETS[5], (_m, a, b) => a + '\u2022\u2022\u2022 redacted' + b);
  for (const re of [SECRETS[0], SECRETS[1], SECRETS[2], SECRETS[3], SECRETS[4]]) {
    s = s.replace(re, (m) => m.slice(0, 4) + '\u2022\u2022\u2022 redacted');
  }
  s = s.replace(SECRETS[6], (_m, a) => a + ' \u2022\u2022\u2022 redacted');
  return s;
}

export function fmt(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

export function contextWindow(displayName) {
  const m = String(displayName || '').match(/(\d+)\s*k\b/i);
  return m ? Number(m[1]) * 1000 : 128000;
}

function meter(used, window) {
  const pct = Math.min(100, Math.round((used / window) * 100));
  const filled = Math.round(pct / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  // Green while there is room, amber past two thirds, red when the next big tool result
  // could push the turn over.
  const colour = pct >= 85 ? '38;5;174' : pct >= 66 ? '38;5;180' : '38;5;108';
  return `\x1b[${colour}m${bar} ${pct}%\x1b[0m ${ui.faint(fmt(used) + '/' + fmt(window))}`;
}

export function footer({ label, session, today, perHour, usage, ms, turnCost: turnUsd, contextUsed, window, limits }) {
  const money = (n) => '$' + (n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2));
  const bits = [
    '🤖 ' + ui.white(label),
    session == null ? null
      : '💰 ' + (turnUsd != null ? money(turnUsd) + ' turn / ' : '') + `${money(session)} session / ${money(today)} today`,
    perHour == null ? null : '🔥 ' + money(perHour) + '/hr',
    contextUsed ? '🧠 ' + meter(contextUsed, window || 128000) : null,
    limits ? '🧵 ' + ui.faint(limits) : null,
    '⏱  ' + ui.faint(`${fmt(usage?.output_tokens ?? 0)} out · ${(ms / 1000).toFixed(1)}s`),
  ].filter(Boolean);
  return '  ' + bits.join(ui.faint('  ·  '));
}

// One line of accounting after every turn. Tokens are real — the gateway reports them.
// Dollars appear only when the model's own catalogue entry carries a price; an invented
// cost would be worse than none.
export function costLine(usage, ms, totals) {
  const inTok = usage?.input_tokens ?? 0;
  const outTok = usage?.output_tokens ?? 0;
  const cached = usage?.cache_read_input_tokens ?? 0;
  const bits = [
    `${fmt(inTok)} in`,
    cached ? `${fmt(cached)} cached` : null,
    `${fmt(outTok)} out`,
    `${(ms / 1000).toFixed(1)}s`,
    `session ${fmt(totals.in + totals.out)} tok`,
    totals.usd != null ? `$${totals.usd < 0.01 ? totals.usd.toFixed(5) : totals.usd.toFixed(4)}` : null,
  ].filter(Boolean);
  return ui.faint('  ' + bits.join('  ·  '));
}
