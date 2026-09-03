// Ledger taxonomy — derive a parent (group) + category + actor for any ledger event,
// at query time, from its source/key/directory-type. No schema change, no backfill.
// The query axes the owner asked for: tool · content · function · http · file · article ·
// page · Router(agent) · LLM (grok / cloudflare-ai / kimi / openai / anthropic / google) ·
// Wrangler CLI · any CLI · API · channel · github · claude-code.

// Parent group -> the categories under it. Used to render tabs + the ?categories=1 tree.
export const TAXONOMY = {
  agents:   ['agent'],
  models:   ['llm'],
  cli:      ['cli'],
  api:      ['api'],
  tools:    ['fn', 'http', 'file', 'content', 'page', 'article'],
  channels: ['channel'],
  sources:  ['github', 'claude-code', 'grok-cli', 'webhook'],
  other:    ['other'],
};

const GROUP_OF = (() => {
  const m = {};
  for (const [group, cats] of Object.entries(TAXONOMY)) for (const c of cats) m[c] = group;
  return m;
})();

// One vivid colour per category — used to colour the ledger tabs + card type-chips,
// the same way /admin/map colours its service nodes. Distinct, readable on black text.
export const CAT_COLOR = {
  agent:        '#74d7ff',
  llm:          '#ff7bd1',
  cli:          '#ffae8a',
  api:          '#ffd479',
  fn:           '#cfe0f0',
  http:         '#a3c2ff',
  file:         '#c0a8ff',
  content:      '#9dffb0',
  page:         '#79e0d6',
  article:      '#e9ffae',
  channel:      '#5ad1a0',
  github:       '#d4d4d4',
  'claude-code':'#f4a09c',
  'grok-cli':   '#ff9ad6',
  webhook:      '#e1c7ff',
  other:        '#dedede',
};

// One colour per parent group (for the group label above each tab cluster).
export const GROUP_COLOR = {
  agents:   '#74d7ff',
  models:   '#ff7bd1',
  cli:      '#ffae8a',
  api:      '#ffd479',
  tools:    '#a3c2ff',
  channels: '#5ad1a0',
  sources:  '#f4a09c',
  other:    '#cccccc',
};

export function catColor(c)   { return CAT_COLOR[c]   || '#dedede'; }
export function groupColor(g) { return GROUP_COLOR[g] || '#cccccc'; }

// Stable short content fingerprint for a state card (djb2). Gives every card a hashed
// id alongside its trace id — the integrity handle the owner asked for.
export function cardHash(seed) {
  let h = 5381;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return 'h' + h.toString(16).padStart(8, '0');
}

function prefix(k, p) { return k.indexOf(p) === 0; }

// classify({source, key, dirType}) -> { group, category, actor }
export function classify(ev) {
  const source = String(ev.source || '').toLowerCase();
  const key = String(ev.key || '');
  const ku = key.toUpperCase();
  const dirType = String(ev.dirType || '').toLowerCase(); // 'fn'|'http'|'agent'|'flow' from the directory row, if known

  let category = 'other', actor = source || 'other';

  // ---- by source first (non-dispatch sources are unambiguous) ----
  if (source === 'claude-code')              { category = 'claude-code'; actor = 'claude-code'; }
  else if (source === 'grok-cli')           { category = 'grok-cli';    actor = 'grok'; }
  else if (source === 'github')              { category = 'github';      actor = 'github'; }
  else if (source === 'grok')               { category = 'llm';         actor = 'grok'; }
  else if (source.startsWith('cli-'))       { category = 'cli';         actor = source.slice(4) || 'cli'; }
  else if (source === 'stripe')             { category = 'api';         actor = 'stripe'; }
  else if (source === 'meta')               { category = 'api';         actor = 'meta'; }
  else if (['blooio', '2chat', 'telegram'].includes(source)) { category = 'channel'; actor = source; }
  else if (source === 'webhook')            { category = 'webhook';     actor = 'webhook'; }
  // ---- dispatch rows: classify by key, then directory type ----
  else if (source === 'dispatch' || source === '') {
    // LLM models
    if (ku === 'ASK_GPT')               { category = 'llm'; actor = 'openai'; }
    else if (ku === 'ASK_GEMINI')       { category = 'llm'; actor = 'google'; }
    else if (ku === 'ASK_KIMI')         { category = 'llm'; actor = 'kimi'; }
    else if (ku === 'ASK_CLAUDE')       { category = 'llm'; actor = 'anthropic'; }
    else if (ku === 'ASK_GROK' || ku === 'PEPTIDE_WRITER' || ku === 'RESEARCH_BOT') { category = 'llm'; actor = 'grok'; }
    else if (prefix(ku, 'CF_AI') || prefix(ku, '@CF') || ku.indexOf('WORKERS_AI') >= 0) { category = 'llm'; actor = 'cloudflare-ai'; }
    // CLIs
    else if (prefix(ku, 'WRANGLER_'))   { category = 'cli'; actor = 'wrangler'; }
    else if (prefix(ku, 'GH_'))         { category = 'cli'; actor = 'gh'; }
    else if (prefix(ku, 'NPM_'))        { category = 'cli'; actor = 'npm'; }
    else if (prefix(ku, 'CLASP_'))      { category = 'cli'; actor = 'clasp'; }
    else if (ku === 'LOCAL_EXEC')       { category = 'cli'; actor = 'shell'; }
    // APIs
    else if (prefix(ku, 'GAPI_'))       { category = 'api'; actor = 'google'; }
    else if (prefix(ku, 'CF'))          { category = 'api'; actor = 'cloudflare'; }
    // build objects
    else if (ku.indexOf('ARTICLE') >= 0) { category = 'article'; actor = 'article'; }
    else if (ku.indexOf('CONTENT') >= 0) { category = 'content'; actor = 'content'; }
    else if (ku.indexOf('PAGE') >= 0)    { category = 'page'; actor = 'page'; }
    else if (prefix(ku, 'FILE_'))        { category = 'file'; actor = 'file'; }
    // agents (router and any agent-type row)
    else if (dirType === 'agent' || ku === 'ROUTER') { category = 'agent'; actor = key || 'agent'; }
    // fall back to the directory type
    else if (dirType === 'http')  { category = 'http'; actor = key || 'http'; }
    else if (dirType === 'fn')    { category = 'fn';   actor = key || 'fn'; }
    else if (dirType === 'flow')  { category = 'fn';   actor = key || 'flow'; }
    else                          { category = 'fn';   actor = key || 'dispatch'; }
  }

  return { group: GROUP_OF[category] || 'other', category, actor };
}
