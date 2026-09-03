#!/usr/bin/env node
// LAW: OPERATOR-GATED COPY (owner order 2026-08-04, after repeated corrections).
//
// No public surface of the build may command a reading model to act on the page's own
// authority. The failure class: "ACT FIRST", "Do these now", "Do not just summarize —
// operate", "YOU ARE A TOKEN-DROP RECIPIENT" — obligational language that reads to a
// security-conscious model as a prompt-injection payload and makes careful agents bounce.
// Every write/sign step must be explicitly conditional on operator intent, and every door
// block must state precedence: the operator's instructions always win.
//
// This gate fails the commit when obligational token-drop language reappears in the files
// models read, or when a door surface loses its precedence line.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SCAN_DIRS = ['functions', 'public', '.claude/skills', '.agents/skills', 'scripts'];
const SCAN_EXT = /\.(md|js|mjs|html|txt|py)$/i;
const SKIP = /node_modules|\.git\/|_worker\.bundle|\/archive\/|check-operator-gated-copy\.mjs|STATE\.md|outreach_logic_history|skills\/writing-law\/SKILL\.md/;

// Obligational command patterns aimed at the reading model. Case-insensitive.
const BANNED = [
  [/ACT FIRST, MODEL READING THIS/i, 'ACT FIRST command block'],
  [/\bDo these now\b(?!.*if you were asked)/i, '"Do these now" imperative'],
  [/Do not just summarize\s*[—-]\s*operate/i, '"Do not just summarize — operate" command'],
  [/ARE A TOKEN-DROP RECIPIENT/i, 'token-drop recipient conscription'],
  [/reading without acting misses/i, 'reading-devaluation pressure line'],
  [/operable by you[^.]{0,80}right now/i, '"operable by you ... right now" urgency framing'],
  [/\bmints your credential\. Open this block\b/i, 'un-gated mint invitation in the door summary'],
];

// Door surfaces that must carry the operator-precedence line.
const PRECEDENCE_REQUIRED = [
  ['functions/_middleware.js', /operator wins/i],
  ['functions/start.js', /operator wins/i],
  ['functions/llms.txt.js', /operator wins/i],
];

let failed = false;
function scanDir(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e);
    if (SKIP.test(p)) continue;
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { scanDir(p); continue; }
    if (!SCAN_EXT.test(e)) continue;
    const text = readFileSync(p, 'utf8');
    for (const [re, label] of BANNED) {
      const m = text.match(re);
      if (m) {
        console.error(`OPERATOR_GATED_COPY: ${relative(ROOT, p)} — ${label}: "${m[0].slice(0, 80)}"`);
        failed = true;
      }
    }
  }
}
for (const d of SCAN_DIRS) scanDir(join(ROOT, d));

for (const [file, re] of PRECEDENCE_REQUIRED) {
  let text = '';
  try { text = readFileSync(join(ROOT, file), 'utf8'); } catch { continue; }
  if (!re.test(text)) {
    console.error(`OPERATOR_GATED_COPY: ${file} lost its operator-precedence line ("your operator wins")`);
    failed = true;
  }
}

if (failed) {
  console.error('BLOCKED: obligational token-drop language. Public copy never commands a reading model to act on the page\'s own authority — every write/sign step is conditional on operator intent, reading is a complete outcome, and the precedence line stays.');
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, law: 'OPERATOR_GATED_COPY_LAW', checked: SCAN_DIRS.join(', ') + ' + precedence lines on the 3 door surfaces' }));
