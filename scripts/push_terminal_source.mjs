#!/usr/bin/env node
/** Push terminal_source manifest to miscsubjects settings so models know ~/.mm_keys.env */
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const KEY = process.env.TERMINAL_KEY || process.env.MISC;
if (!KEY) { console.error('TERMINAL_KEY required'); process.exit(1); }

const mm = readFileSync(join(homedir(), '.mm_keys.env'), 'utf8');
const exports = [...mm.matchAll(/^export ([A-Z_][A-Z0-9_]*)=/gm)].map((m) => m[1]);
const funcs = [...mm.matchAll(/^([a-z_]+)\(\)/gm)].map((m) => m[1]);

const manifest = {
  file: '~/.mm_keys.env',
  loaded_by: '~/.zshrc',
  zsh_plugins: ['zsh-autosuggestions', 'zsh-syntax-highlighting', 'fzf'],
  wrangler_oauth: 'wro() — unset CF token, use OAuth for secrets_store',
  exports,
  helpers: funcs,
  lbl_viewer_pass_location: 'LBL_VIEWER_PASS in mm_keys + CF VIEWER_ADMIN_PASS + Pages LBL_VIEWER_PASS',
  notes: 'Live Meta API works without lbl. lbl D1 may be empty if loop-data-platform D1 was deleted.',
};

const r = await fetch('https://miscsubjects.com/api/settings/terminal_source', {
  method: 'PUT',
  headers: { 'content-type': 'application/json', 'x-terminal-key': KEY },
  body: JSON.stringify({ value: JSON.stringify(manifest, null, 2), description: 'the owner terminal source inventory for models' }),
});
console.log('terminal_source', r.status, (await r.text()).slice(0, 120));

await fetch('https://miscsubjects.com/api/settings/marketing_state', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json', 'x-terminal-key': KEY },
  body: JSON.stringify({ value: { terminal_source: '~/.mm_keys.env', lbl_viewer_pass_reset: '2026-07-05' } }),
}).then((r) => console.log('marketing_state patch', r.status));