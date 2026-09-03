#!/usr/bin/env node
// LAW: every edit to a shared file must be claimed via FILE_CLAIM before commit.
// This script enforces the AGENTS.md WRITE LAW at commit time by checking that
// each staged file under shared paths has a recent FILE_CLAIM claim record in
// the ledger by the committing agent/session.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const OWNER_EMAILS = [
  '[OWNER_EMAIL]',
  '[REDACTED_EMAIL]',
  '45312202+[OWNER_HANDLE]@users.noreply.github.com',
];
const CLAIM_WINDOW_HOURS = 6;
const BASE = 'https://miscsubjects.com';
const FCLAIM_PREFIX = 'fclaim:';
const REPO_DIR = ROOT.split('/').pop() || 'repo';

function loadKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  try {
    const raw = readFileSync(join(homedir(), '.config/grok-bridge.env'), 'utf8');
    return (raw.match(/^(?:export\s+)?TERMINAL_KEY=["']?([^"'\n]+)/m) || [])[1] || '';
  } catch { return ''; }
}
const KEY = loadKey();

function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return String(r.stdout || '').trim();
}

function gitConfig(key) {
  return git(['config', '--get', key]) || '';
}

function isOwnerCommit() {
  const candidates = [
    gitConfig('user.email'),
    git(['log', '-1', '--format=%ae']),
    git(['log', '-1', '--format=%ce']),
  ].map((s) => String(s || '').toLowerCase());
  return candidates.some((e) => OWNER_EMAILS.includes(e));
}

function isSharedPath(p) {
  return (
    p.startsWith('functions/') ||
    p.startsWith('scripts/') ||
    p.startsWith('public/') ||
    p.startsWith('docs/') ||
    p.startsWith('migrations/') ||
    p.startsWith('.claude/') ||
    p.startsWith('.agents/') ||
    p === 'AGENTS.md' ||
    p === 'PROTECTED_FEATURES.md' ||
    p === 'PROTECTED_WIDGETS.md'
  );
}

async function dispatch(key, body, ms = 22000) {
  for (let i = 0; i < 3; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(BASE + '/api/dispatch', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-terminal-key': KEY },
        body: JSON.stringify({ key, body }),
        signal: ctrl.signal,
      });
      const j = await r.json();
      clearTimeout(t);
      if (j && (j.ok || j.result != null)) {
        if (typeof j.result === 'string') {
          try { return JSON.parse(j.result); } catch { return j.result; }
        }
        return j.result;
      }
    } catch { clearTimeout(t); }
    await new Promise((s) => setTimeout(s, 500));
  }
  return null;
}

async function kvGet(key) {
  const value = await dispatch('KV_GET', key);
  if (value == null || String(value).trim() === '') return null;
  // KV_GET returns the raw string value: '<holder> since <ISO date>'
  const m = String(value).match(/^([^\s]+)\s+since\s+(\S+)/);
  if (!m) return { holder: String(value).trim(), ts: null };
  return { holder: m[1], ts: m[2] };
}

function claimExpired(ts) {
  if (!ts) return true;
  const claimedAt = new Date(ts).getTime();
  return Number.isNaN(claimedAt) || (Date.now() - claimedAt > CLAIM_WINDOW_HOURS * 60 * 60 * 1000);
}

function currentHolder() {
  if (process.env.FILE_CLAIM_HOLDER) return process.env.FILE_CLAIM_HOLDER;
  const session =
    process.env.KIMI_SESSION_ID ||
    process.env.CLAUDE_SESSION_ID ||
    process.env.CODEX_SESSION_ID ||
    process.env.GROK_SESSION_ID ||
    '';
  if (session) {
    const agent =
      process.env.KIMI_SESSION_ID ? 'kimi' :
      process.env.CLAUDE_SESSION_ID ? 'claude' :
      process.env.CODEX_SESSION_ID ? 'codex' :
      process.env.GROK_SESSION_ID ? 'grok' : 'agent';
    return `${agent}:${session.slice(0, 12)}`;
  }
  return '';
}

async function main() {
  if (process.env.WRITE_LAW_BYPASS) {
    console.log(JSON.stringify({ ok: true, law: 'WRITE_LAW', bypass: process.env.WRITE_LAW_BYPASS }));
    return;
  }
  if (isOwnerCommit()) {
    console.log(JSON.stringify({ ok: true, law: 'WRITE_LAW', committer: 'owner' }));
    return;
  }
  if (!KEY) {
    // No ledger key in this environment (CI, or any machine without the bridge env). FILE_CLAIM
    // is a LOCAL pre-commit coordination gate verified against the ledger; it cannot run here and
    // must not fail the vault workflow. The commit already passed the local hook; CI enforces the
    // content contracts (goldens, nav, etc.) separately. Best-effort skip, not a hard failure.
    console.log(JSON.stringify({ ok: true, law: 'WRITE_LAW', skipped: 'no ledger key in this environment (CI / best-effort)' }));
    return;
  }

  const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACM'])
    .split('\n')
    .filter(Boolean)
    .filter(isSharedPath);

  if (!staged.length) {
    console.log(JSON.stringify({ ok: true, law: 'WRITE_LAW', shared_files: 0 }));
    return;
  }

  const holder = currentHolder();
  if (!holder) {
    console.error(JSON.stringify({ ok: false, law: 'WRITE_LAW', error: 'cannot determine agent/session; set FILE_CLAIM_HOLDER or agent SESSION_ID env var, or commit as owner' }));
    process.exit(1);
  }

  const unclaimed = [];
  for (const file of staged) {
    let claim = await kvGet(FCLAIM_PREFIX + file);
    if (!claim) claim = await kvGet(FCLAIM_PREFIX + REPO_DIR + '/' + file);
    if (!claim || claimExpired(claim.ts)) {
      unclaimed.push({ file, reason: 'no_claim' });
      continue;
    }
    if (!claim.holder.startsWith(holder.split(':')[0] + ':')) {
      unclaimed.push({ file, reason: 'held_by_other_agent', held_by: claim.holder });
    }
  }

  if (unclaimed.length) {
    console.error(JSON.stringify({ ok: false, law: 'WRITE_LAW', holder, unclaimed, help: 'claim each file before editing: FILE_CLAIM|claim|<path>|' + holder + '|90' }));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, law: 'WRITE_LAW', holder, claimed_files: staged.length }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, law: 'WRITE_LAW', error: e.message }));
  process.exit(1);
});
