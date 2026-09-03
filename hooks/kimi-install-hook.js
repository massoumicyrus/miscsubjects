#!/usr/bin/env node
// Append Kimi Stop → kimi-turn-log.js hook to config.toml (user + project). Idempotent.
const fs = require('fs');
const os = require('os');
const path = require('path');

const repo = path.dirname(path.dirname(__filename));
const hookScript = path.join(repo, 'hooks/kimi-turn-log.js');
const hookCmd = `node "${hookScript}"`;
const block = [
  '',
  '[[hooks]]',
  'event = "Stop"',
  'matcher = ""',
  `command = 'node "${hookScript}"'`,
  'timeout = 30',
  '',
].join('\n');

function ensure(configPath) {
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, 'default_model = "kimi-code/kimi-for-coding"\n' + block);
    return { path: configPath, added: true, created: true };
  }
  const txt = fs.readFileSync(configPath, 'utf8');
  if (txt.includes('kimi-turn-log.js')) return { path: configPath, added: false, created: false };
  fs.writeFileSync(configPath, txt.trimEnd() + block);
  return { path: configPath, added: true, created: false };
}

const targets = [
  path.join(os.homedir(), '.kimi-code', 'config.toml'),
  path.join(repo, '.kimi-code', 'config.toml'),
];
const report = targets.map(ensure);
console.log(JSON.stringify({ ok: true, hook: hookCmd, report }));