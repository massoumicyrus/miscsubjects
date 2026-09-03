#!/usr/bin/env node
// Mechanical gate for the Model Call Law (migrations/0338, .claude/skills/model-call-law).
//
// A system prompt belongs in the `directory` table, reachable at /admin/prompts and
// invocable through POST /api/invoke. This fails the build when a new one shows up as a
// string literal in a Worker instead.
//
//   node scripts/check-prompts-not-in-code.mjs          # fail on any new offender
//   node scripts/check-prompts-not-in-code.mjs --list   # print every hit, exit 0
//
// KNOWN holds the offenders that predate the law. The list may shrink, never grow: adding
// to it is how "we'll move it later" becomes permanent.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ROOTS = ['functions'];
const MIN_INLINE_SYSTEM = 200; // chars of literal attached to a system role
const MIN_PERSONA = 400;       // chars of a literal that opens like a persona prompt

// Pre-law offenders, inventoried 2026-07-30 when the gate was written. Each one still has
// a prompt in code and each one has to move to a directory row. Shrink this list; never
// extend it. The gate exists to stop the seventh, not to bless the six.
const KNOWN = new Set([
  'functions/_lib/pipeline_prompts.js',
  'functions/api/council.js',
  'functions/api/dispatch.js',
  'functions/api/protocol/[[path]].js',
  'functions/blooio.js',
  'functions/grok/audit.js',
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (name.endsWith('.js') && !name.endsWith('.test.mjs')) out.push(p);
  }
  return out;
}

// Every quoted literal in the file, with the line it starts on. Deliberately simple: a
// missed exotic literal is better than a checker nobody trusts.
//
// THIS RAN AS A REGEX UNTIL IT STOPPED TERMINATING. The pattern was
//   /(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g
// which backtracks catastrophically whenever a quote character opens a run that never closes —
// an apostrophe in prose inside a file with an odd number of them is enough. On 2026-08-07 it
// hit functions/_lib/outreach_law_object.js and ran for twenty minutes without returning,
// blocking the pre-phase of every deploy for every agent. A gate that hangs is worse than no
// gate: it stops all work and names no offender.
//
// This scanner walks the source once. Same rule, same hits, linear time, always terminates.
// An unterminated literal is skipped rather than swallowing the rest of the file.
function literals(src) {
  const out = [];
  // Precomputed line starts: the old version rebuilt the prefix for every match, which was
  // quadratic on top of the backtracking.
  const lineAt = (i) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= i) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);

  for (let i = 0; i < src.length; i++) {
    const q = src[i];
    if (q !== '"' && q !== "'" && q !== '`') continue;
    let j = i + 1;
    let closed = false;
    while (j < src.length) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (c === q) { closed = true; break; }
      j++;
    }
    if (!closed) continue;               // unterminated: skip the opener, do not consume the file
    out.push({ text: src.slice(i + 1, j), index: i, line: lineAt(i) });
    i = j;                               // resume after the closing quote
  }
  return out;
}

const hits = [];
for (const r of ROOTS) {
  for (const file of walk(join(ROOT, r))) {
    const rel = relative(ROOT, file);
    const src = readFileSync(file, 'utf8');
    const lits = literals(src);

    for (const lit of lits) {
      const t = lit.text;
      if (t.length >= MIN_PERSONA && /^\s*(You are|Your job is|You will act as)\b/i.test(t)) {
        hits.push({ rel, line: lit.line, chars: t.length, why: 'persona prompt as a string literal' });
        continue;
      }
      // role:'system' followed closely by a long inline literal
      const before = src.slice(Math.max(0, lit.index - 120), lit.index);
      if (/role\s*:\s*['"`]system['"`][\s\S]{0,80}$/.test(before) && t.length >= MIN_INLINE_SYSTEM) {
        hits.push({ rel, line: lit.line, chars: t.length, why: 'inline system message' });
      }
    }
  }
}

const listMode = process.argv.includes('--list');
const fresh = hits.filter((h) => !KNOWN.has(h.rel));

if (listMode) {
  for (const h of hits) console.log(`${h.rel}:${h.line}  ${h.chars} chars  ${h.why}${KNOWN.has(h.rel) ? '  [known]' : ''}`);
  console.log(JSON.stringify({ ok: true, total: hits.length, known: hits.length - fresh.length, fresh: fresh.length }));
  process.exit(0);
}

if (fresh.length) {
  console.error('MODEL CALL LAW violation — a system prompt is a directory row, not a string in code.\n');
  for (const h of fresh) console.error(`  ${h.rel}:${h.line}  ${h.chars} chars  ${h.why}`);
  console.error(`\nFix: POST /api/directory {"key":"<NAME>","type":"agent","target":"<model>","content":"<the prompt>"}`);
  console.error(`then call it with POST /api/invoke {"key":"<NAME>","input":"..."} — see /admin/prompts.`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, scanned: ROOTS, offenders: 0, known: KNOWN.size }));
