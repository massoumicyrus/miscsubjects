#!/usr/bin/env node
/**
 * Squash-merge a bot/ branch to main and delete the branch. Protected-path gate.
 * Usage: node scripts/merge.mjs <branch> [issueNumber]
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const ROOT = '/Users/owner/miscsubjects-pages';
const REPO = '[OWNER_HANDLE]/miscsubjects-pages';
const MAX_LINES = 80;
const MANIFESTS = ['PROTECTED_WIDGETS.md', 'PROTECTED_FEATURES.md'];

function run(cmd, cwd = ROOT, timeout = 120000) {
  try {
    return { ok: true, out: execSync(cmd, { cwd, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] }).trim() };
  } catch (e) {
    return { ok: false, out: (((e.stdout || '') + (e.stderr || '')).trim() || String(e.message || 'err')) };
  }
}

function lockedSet() {
  const set = new Set();
  for (const mf of MANIFESTS) {
    let txt = '';
    try { txt = readFileSync(join(ROOT, mf), 'utf8'); } catch { continue; }
    for (const m of txt.matchAll(/`([^`]+\.(?:js|mjs|ts))`/g)) {
      const p = m[1].trim();
      if (p.includes('/') && existsSync(join(ROOT, p))) set.add(p);
    }
  }
  return set;
}

async function main() {
  const BR = process.argv[2];
  const N = process.argv[3] || '';
  if (!BR || !BR.startsWith('bot/')) {
    console.log(JSON.stringify({ skip: 'need bot/ branch' }));
    return;
  }

  run('git fetch origin main', ROOT, 60000);
  const stat = run(`git diff --stat origin/main...origin/${BR}`);
  if (!stat.ok || !stat.out || /fatal:|not a valid object/.test(stat.out)) {
    console.log(JSON.stringify({ skip: 'no diff vs main', branch: BR, detail: stat.out?.slice(0, 200) }));
    return;
  }

  const names = run(`git diff --name-only origin/main...origin/${BR}`);
  const files = (names.ok ? names.out : '').split('\n').map((s) => s.trim()).filter(Boolean);
  const locked = lockedSet();
  const blocked = files.filter((f) => locked.has(f));
  if (blocked.length) {
    console.log(JSON.stringify({ skip: 'protected', branch: BR, blocked }));
    return;
  }

  const lines = run(`git diff --numstat origin/main...origin/${BR}`);
  let churn = 0;
  if (lines.ok) {
    for (const row of lines.out.split('\n')) {
      const p = row.trim().split(/\s+/);
      if (p.length >= 2) churn += (parseInt(p[0], 10) || 0) + (parseInt(p[1], 10) || 0);
    }
  }
  if (churn > MAX_LINES) {
    console.log(JSON.stringify({ skip: 'diff too large', branch: BR, churn, max: MAX_LINES }));
    return;
  }

  const title = `bot: ${BR}${N ? ' (#' + N + ')' : ''}`;
  const pr = run(
    `gh pr create --repo ${REPO} --head ${BR} --base main --title ${JSON.stringify(title)} --body "Auto-merge from github-loop. Issue ${N || 'n/a'}."`,
    ROOT,
    60000,
  );
  let prNum = '';
  if (!pr.ok) {
    const existing = run(`gh pr list --repo ${REPO} --head ${BR} --json number --jq '.[0].number'`, ROOT, 30000);
    if (!existing.ok || !existing.out) {
      console.log(JSON.stringify({ merged: false, branch: BR, error: pr.out.slice(0, 400) }));
      return;
    }
    prNum = existing.out.trim();
  } else {
    const m = pr.out.match(/pull\/(\d+)/);
    prNum = m ? m[1] : pr.out.trim();
  }

  const mg = run(`gh pr merge ${prNum} --repo ${REPO} --squash --delete-branch`, ROOT, 90000);
  if (!mg.ok) {
    console.log(JSON.stringify({ merged: false, branch: BR, pr: prNum, error: mg.out.slice(0, 400) }));
    return;
  }

  run('git checkout main', ROOT, 20000);
  run('git pull origin main', ROOT, 60000);

  console.log(JSON.stringify({ merged: true, branch: BR, pr: prNum, issue: N || null, stat: stat.out.slice(0, 300) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});