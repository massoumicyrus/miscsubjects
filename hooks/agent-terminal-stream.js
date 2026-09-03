#!/usr/bin/env node
// Decode kimi --output-format stream-json lines for visible Terminal output.
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', (line) => {
  const s = String(line || '').trim();
  if (!s) return;
  try {
    const j = JSON.parse(s);
    if (j.role === 'assistant' && j.content) {
      process.stdout.write(String(j.content));
      return;
    }
    if (j.type === 'session.resume_hint' && j.content) {
      process.stdout.write('\n' + String(j.content) + '\n');
      return;
    }
    if (j.type && /tool|call|action/i.test(String(j.type))) {
      const label = j.name || j.tool || j.type;
      process.stdout.write(`\n[${label}]\n`);
    }
  } catch {
    process.stdout.write(s + '\n');
  }
});