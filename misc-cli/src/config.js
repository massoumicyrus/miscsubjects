// Where misc reads its settings. One file, plain JSON, no hidden state:
//   ~/.misc/config.json   { gateway, token, model, ledger }
//   ~/.misc/sessions/*.json
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const HOME = path.join(os.homedir(), '.misc');
export const SESSIONS = path.join(HOME, 'sessions');

const DEFAULTS = {
  gateway: 'https://miscsubjects.com/api/aig',
  token: '',
  model: 'claude-kimi-k2.7-code',
  ledger: true,
  approve: 'ask', // ask | auto
  owner: { email: process.env.OWNER_EMAIL || '' },
};

export function configPath() { return path.join(HOME, 'config.json'); }

const ANTHROPIC_MODEL_RE = /anthropic|opus|sonnet|haiku|fable|vertex-ai-claude/i;
export function isAnthropicModel(id) {
  const s = String(id || '');
  // gateway aliases are claude-<vendor>-… — only the Anthropic-upstream ones are banned.
  return ANTHROPIC_MODEL_RE.test(s.replace(/^claude-/, ''));
}

export function loadConfig() {
  let file = {};
  try { file = JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch {}
  const cfg = { ...DEFAULTS, ...file };
  if (isAnthropicModel(cfg.model)) cfg.model = DEFAULTS.model;
  cfg.owner = { ...DEFAULTS.owner, ...(file.owner || {}) };
  // The zsh launchers already export the gateway base; honour it so there is one token.
  const envBase = process.env.CF_AIG_CLAUDE_BASE || '';
  if (!file.token && envBase) {
    cfg.gateway = envBase.replace(/\/[^/]+$/, '');
    cfg.token = envBase.split('/').pop();
  }
  if (process.env.MISC_TOKEN) cfg.token = process.env.MISC_TOKEN;
  if (process.env.MISC_MODEL) cfg.model = process.env.MISC_MODEL;
  if (isAnthropicModel(cfg.model)) cfg.model = DEFAULTS.model; // non-Anthropic only, env included
  if (process.env.OWNER_EMAIL) cfg.owner.email = process.env.OWNER_EMAIL;
  return cfg;
}

export function ownerEmail(cfg) {
  return cfg?.owner?.email || '';
}

export function saveConfig(cfg) {
  fs.mkdirSync(HOME, { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
}

export function base(cfg) {
  return cfg.gateway.replace(/\/+$/, '') + '/' + cfg.token;
}
