// Owner facts. Source of truth order:
// 1. ~/.misc/config.json owner.email
// 2. OWNER_EMAIL env var (written back to config)
// 3. Ledger events (last non-empty "to" on EMAIL_SEND, or request_preview match)
// When setOwnerEmail is called, it persists to config and the agent stops asking.

import fs from 'node:fs';
import { loadConfig, saveConfig, configPath, ownerEmail } from './config.js';

let cached = null;

export function getOwnerConfig() {
  if (!cached) cached = loadConfig();
  return cached;
}

export function getOwnerEmail() {
  const cfg = getOwnerConfig();
  const env = process.env.OWNER_EMAIL;
  if (env && env !== cfg.owner.email) {
    cfg.owner.email = env;
    saveConfig(cfg);
  }
  return ownerEmail(cfg);
}

export function setOwnerEmail(email) {
  const cfg = loadConfig();
  cfg.owner = cfg.owner || {};
  cfg.owner.email = email;
  saveConfig(cfg);
  cached = cfg;
}
