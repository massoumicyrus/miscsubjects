#!/usr/bin/env node
// LAW: there is no such thing as owner-approved copy. He approves STYLE.
//
// On 2026-07-24 a model wrote an "Approved plain description (owner-accepted)" clause into
// .claude/skills/writing-law/SKILL.md containing the sentence "A working prototype of a
// different way to organize AI systems." No such approval existed. A second session shipped
// that sentence to the homepage citing the file as authority; a third kept it because the
// file said approved. One model's preference had become law for every model after it, which
// the Laws of Skills forbid: a model-written rule binds others only with a failing exhibit
// or the owner's recorded acceptance.
//
// This gate blocks the reintroduction. It scans governance-bearing files for any claim that
// specific copy is owner-approved, and for the banned sentence itself.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

// Where fabricated authority does damage: the files models read as law.
const SCAN_DIRS = ['.claude/skills', '.agents/skills', 'functions/_lib', 'functions', 'public'];
const SCAN_EXT = /\.(md|js|mjs|html|txt|json)$/i;
const SKIP = /node_modules|\.git\/|_worker\.bundle|\/archive\//;

// An approval-of-copy claim: "approved" / "accepted" / "blessed" / "canonical" sitting next
// to a word meaning the words themselves. Deliberately narrow — approving a STYLE, a law, a
// plan, or a deploy is legitimate and must not trip.
// "description" and "canonical" are ordinary words here (canonical object, machine
// description), so they are NOT approval triggers — only words that mean the wording itself.
const COPY_NOUN = '(copy|wording|phrasing|tagline|headline|hero line|blurb|plain description)';
const APPROVAL_CLAIM = new RegExp(
  '\\b(owner[- ]?(approved|accepted)|approved|pre[- ]approved|blessed)\\b[^.\\n]{0,40}\\b' + COPY_NOUN + '\\b',
  'i',
);
const REVERSE_CLAIM = new RegExp(
  '\\b' + COPY_NOUN + '\\b[^.\\n]{0,40}\\b(is|was|has been)\\b[^.\\n]{0,20}\\b(owner[- ]?)?(approved|accepted|blessed)\\b',
  'i',
);

// The specific sentence the owner rejected verbatim.
// Tolerate any whitespace entity between words — the homepage h1 shipped it as
// "AI&nbsp;systems", which a literal-space pattern misses.
const BANNED_SENTENCE =
  /working(?:\s|&nbsp;|&#160;)+prototype(?:\s|&nbsp;|&#160;)+of(?:\s|&nbsp;|&#160;)+a(?:\s|&nbsp;|&#160;)+different(?:\s|&nbsp;|&#160;)+way(?:\s|&nbsp;|&#160;)+to(?:\s|&nbsp;|&#160;)+organize(?:\s|&nbsp;|&#160;)+AI(?:\s|&nbsp;|&#160;)+systems/i;

// This file documents the pattern in order to ban it, and the writing-law skill states the
// prohibition using the same words. Both are allowed to name it.
const SELF = new Set([
  'scripts/check-approved-copy.mjs',
  '.claude/skills/writing-law/SKILL.md',
  '.agents/skills/writing-law/SKILL.md',
]);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (SKIP.test(p + '/')) continue;
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out);
    else if (SCAN_EXT.test(p)) out.push(p);
  }
  return out;
}

const violations = [];
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file);
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isSelf = SELF.has(rel);
      if (!isSelf && (APPROVAL_CLAIM.test(line) || REVERSE_CLAIM.test(line))) {
        violations.push({ file: rel, line: i + 1, kind: 'approved_copy_claim', text: line.trim().slice(0, 160) });
      }
      if (!isSelf && BANNED_SENTENCE.test(line)) {
        violations.push({ file: rel, line: i + 1, kind: 'banned_sentence', text: line.trim().slice(0, 160) });
      }
    }
  }
}

if (violations.length) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        law: 'NO_APPROVED_COPY',
        error:
          'A file claims specific copy is owner-approved, or reuses the sentence he rejected. He approves STYLE, never copy. Delete the claim; state a fact or an action instead.',
        violations,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, law: 'NO_APPROVED_COPY', checked: SCAN_DIRS.join(', ') }));
