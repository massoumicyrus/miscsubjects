#!/usr/bin/env node
// Shared POST helper for agent turn hooks. Appends locally, POSTs to /api/agent_log (best-effort).
// Usage: echo '<json>' | node hooks/agent-turn-post.js
//   or:  node hooks/agent-turn-post.js --file /path/to/record.json
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const BASE = process.env.MISC_AGENT_LOG_URL || 'https://miscsubjects.com/api/agent_log';
const LOCAL = os.homedir() + '/.miscsubjects/agent_turns.jsonl';

function readInput() {
  const fi = process.argv.indexOf('--file');
  if (fi > -1) return fs.readFileSync(process.argv[fi + 1], 'utf8');
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

const raw = readInput().trim();
if (!raw) process.exit(0);
let record;
try { record = JSON.parse(raw); } catch { process.exit(1); }
if (!record.agent) process.exit(1);

try { fs.mkdirSync(os.homedir() + '/.miscsubjects', { recursive: true }); } catch {}
try { fs.appendFileSync(LOCAL, JSON.stringify(record) + '\n'); } catch {}

try {
  execSync('curl -s -m 8 -X POST ' + BASE + ' -H "content-type: application/json" --data-binary @-',
    { input: JSON.stringify(record), stdio: ['pipe', 'ignore', 'ignore'] });
} catch {}
process.exit(0);