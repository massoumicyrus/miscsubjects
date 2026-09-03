#!/usr/bin/env node
// Builds functions/_lib/outreach_logic_history.json — every version, with dates, of the logic that
// decides what a lead outreach email says. The worker cannot read git, so the history is extracted
// here and committed as data. Re-run after any change to a source below.
//
//   node scripts/build_logic_history.mjs
//
// Sources: the drafting instruction block inside leadsDraftAI (the rules the model is given plus
// the validators that reject a draft), and the outreach skills that state the law behind them.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const SOURCES = [
  {
    id: 'draft_rules',
    label: 'The drafting instructions — what the writer is told to write, and what gets a draft thrown away',
    path: 'functions/_lib/fn_runners.js',
    slice: (text) => {
      const start = text.indexOf('async leadsDraftAI(');
      if (start < 0) return '';
      const end = text.indexOf('async leadsFollowups(', start);
      return text.slice(start, end > 0 ? end : Math.min(text.length, start + 20000));
    },
  },
  { id: 'outreach_law', label: 'Outreach law — the first-contact law the drafting rules answer to', path: '.claude/skills/outreach-law/SKILL.md' },
  { id: 'cold_outreach_craft', label: 'Cold outreach craft skill', path: '.claude/skills/cold-outreach-craft/SKILL.md' },
  { id: 'write_human', label: 'Write-human skill — the sentence-level register', path: '.claude/skills/write-human/SKILL.md' },
];

function diffStat(prev, next) {
  const a = new Set(String(prev || '').split('\n').map((s) => s.trim()).filter(Boolean));
  const b = new Set(String(next || '').split('\n').map((s) => s.trim()).filter(Boolean));
  const added = [...b].filter((l) => !a.has(l));
  const removed = [...a].filter((l) => !b.has(l));
  return { added, removed };
}

const out = { generated_at: new Date().toISOString(), sources: [] };

for (const src of SOURCES) {
  let log = '';
  try {
    log = git('log', '--follow', '--format=%H%aI%s', '--', src.path);
  } catch {
    continue;
  }
  const commits = log.split('\n').filter(Boolean).map((l) => {
    const [hash, date, subject] = l.split('');
    return { hash, date, subject };
  }).reverse(); // oldest first

  const versions = [];
  let prevText = '';
  for (const c of commits) {
    let raw = '';
    try { raw = git('show', c.hash + ':' + src.path); } catch { continue; }
    const text = src.slice ? src.slice(raw) : raw;
    if (!text || text === prevText) continue;
    const { added, removed } = diffStat(prevText, text);
    if (versions.length && !added.length && !removed.length) continue;
    versions.push({
      commit: c.hash.slice(0, 9),
      date: c.date,
      what_changed: c.subject,
      chars: text.length,
      added,
      removed,
      text,
    });
    prevText = text;
  }
  versions.reverse(); // newest first
  versions.forEach((v, i) => { v.version = versions.length - i; v.of = versions.length; });
  out.sources.push({ id: src.id, label: src.label, path: src.path, versions });
}

const dest = 'functions/_lib/outreach_logic_history.json';
writeFileSync(dest, JSON.stringify(out));
const summary = out.sources.map((s) => s.id + ': ' + s.versions.length + ' versions').join(' · ');
console.log('wrote ' + dest + ' — ' + summary);
