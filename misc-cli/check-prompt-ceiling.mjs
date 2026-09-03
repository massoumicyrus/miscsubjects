// A FALLING CEILING ON THE SYSTEM PROMPT.
//
// This agent's prompt grew to 25,250 bytes one clause at a time, each clause added after a
// failure, each one bought again on every step of every tool loop. The reference point is
// OpenAI's Codex CLI prompt, which ships in the open at codex-rs/core/gpt_5_codex_prompt.md
// and was 6,621 bytes with zero shouted imperative clauses when read on 2026-08-05.
//
// "Be concise" is not checkable. A number is. This test records today's size as a ceiling
// and fails if it rises. It never rises on its own, so the only way past it is to lower the
// ceiling deliberately, in a commit, having removed something.
//
// Run: node misc-cli/check-prompt-ceiling.mjs
// Lower the ceiling after a genuine cut: node misc-cli/check-prompt-ceiling.mjs --set

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, 'src', 'misc.js');
const CEILING = path.join(here, 'prompt-ceiling.json');

// The reference, for the record. Not a target this agent currently meets.
const CODEX_BYTES = 6621;
const CODEX_SHOUTED_CLAUSES = 0;

const src = fs.readFileSync(SRC, 'utf8');
const open = src.indexOf('const SYSTEM = () => `');
const close = src.indexOf('${CAPS ? ', open);
if (open < 0 || close < 0) {
  console.error('FAIL: could not find the SYSTEM template in src/misc.js — this test is measuring nothing.');
  process.exit(1);
}
const template = src.slice(open + 'const SYSTEM = () => `'.length, close);

const bytes = Buffer.byteLength(template);
// A shouted clause is an ALL-CAPS imperative opening a line: the shape every one of this
// agent's post-incident rules takes, and the shape Codex uses zero of.
const shouted = (template.match(/^[A-Z][A-Z ,'"\-()*.]{14,}[.—:]/gm) || []).length;
// A date inside the prompt means a past incident is being re-litigated at the model, on every
// call, forever. Incidents belong in a sandbox rule, a tool schema, a code path or a test.
const dated = (template.match(/20\d\d-\d\d-\d\d/g) || []).length;

const measured = { bytes, shouted, dated };

if (process.argv.includes('--set')) {
  fs.writeFileSync(CEILING, JSON.stringify({ ...measured, set_at: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
  console.log('ceiling set:', JSON.stringify(measured));
  process.exit(0);
}

let ceiling;
try { ceiling = JSON.parse(fs.readFileSync(CEILING, 'utf8')); } catch {
  console.error('FAIL: no prompt-ceiling.json. Run with --set once to record the current size.');
  process.exit(1);
}

const fails = [];
if (measured.bytes > ceiling.bytes) {
  fails.push(`system prompt grew: ${ceiling.bytes} -> ${measured.bytes} bytes (+${measured.bytes - ceiling.bytes}). `
    + `Every byte here is re-sent on every step of every tool loop. If this is a rule that must be enforced, put it in a `
    + `tool schema, a code path or a sandbox rule. If it is project context, put it in a project file read on demand.`);
}
if (measured.shouted > ceiling.shouted) {
  fails.push(`shouted imperative clauses grew: ${ceiling.shouted} -> ${measured.shouted}. `
    + `Codex CLI carries ${CODEX_SHOUTED_CLAUSES}. A clause added after a failure is an incident clause, and incident `
    + `clauses are the layer this agent is trying to delete, not extend.`);
}
if (measured.dated > ceiling.dated) {
  fails.push(`dated incident references grew: ${ceiling.dated} -> ${measured.dated}. `
    + `A date in a system prompt is a past mistake being re-read by the model on every call.`);
}

const gap = measured.bytes - CODEX_BYTES;
console.log(`system prompt ${measured.bytes} bytes · ${measured.shouted} shouted clauses · ${measured.dated} dated references`);
console.log(`ceiling        ${ceiling.bytes} bytes · ${ceiling.shouted} shouted clauses · ${ceiling.dated} dated references  (set ${ceiling.set_at})`);
console.log(`Codex CLI      ${CODEX_BYTES} bytes · ${CODEX_SHOUTED_CLAUSES} shouted clauses — this agent is ${gap} bytes over the reference`);

if (fails.length) {
  console.error('\nFAIL');
  for (const f of fails) console.error(' - ' + f);
  process.exit(1);
}
console.log('\nOK — nothing grew.');
