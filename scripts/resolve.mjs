#!/usr/bin/env node
/**
 * E2E close: grok/kimi fix (bridge first, CLI fallback) → push → merge main → close.
 */
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

const REPO = '[OWNER_HANDLE]/miscsubjects-pages';
const ROOT = '/Users/owner/miscsubjects-pages';
const BASE = 'https://miscsubjects.com';
const GH = execSync('gh auth token').toString().trim();
const GHH = { Authorization: 'Bearer ' + GH, Accept: 'application/vnd.github+json', 'User-Agent': 'miscsubjects-resolve', 'X-GitHub-Api-Version': '2022-11-28' };

const KEY = (() => {
  const r = readFileSync(join(homedir(), '.config/grok-bridge.env'), 'utf8');
  const l = r.split('\n').filter((x) => !x.trim().startsWith('#') && x.includes('TERMINAL_KEY='));
  return l[0].split('TERMINAL_KEY=')[1].trim().replace(/^["']|["']$/g, '');
})();

const MODELS = [
  { n: 'grok', k: 'XAI_CHAT', c: (t) => `${process.env.HOME}/.grok/bin/grok -p ${JSON.stringify(t)} </dev/null` },
  { n: 'kimi', k: 'ASK_KIMI', c: (t) => `kimi -p ${JSON.stringify(t)} </dev/null` },
];

function closerChain(issue) {
  const opener = (String(issue.title || '').toLowerCase().match(/\(via (\w+)\)/) || [])[1] || '';
  const first = opener === 'grok' ? 'kimi' : 'grok';
  const second = first === 'grok' ? 'kimi' : 'grok';
  return [first, second].map((n) => MODELS.find((m) => m.n === n)).filter(Boolean);
}

async function disp(key, body) {
  for (let i = 0; i < 2; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    try {
      const r = await fetch(BASE + '/api/dispatch', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-terminal-key': KEY },
        body: JSON.stringify({ key, body }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const j = await r.json();
      if (j?.ok || j?.result != null) return String(j.result || '');
    } catch { clearTimeout(t); }
    await new Promise((s) => setTimeout(s, 400));
  }
  return '';
}

function extractDiff(text) {
  const t = String(text || '');
  const fence = t.match(/```(?:diff)?\s*([\s\S]*?)```/);
  if (fence && fence[1].includes('--- ')) return fence[1].trim();
  const i = t.indexOf('--- ');
  if (i >= 0) return t.slice(i).trim();
  return '';
}

async function ghreq(path, opts = {}) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch('https://api.github.com/repos/' + REPO + path, { headers: GHH, ...opts });
      const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
      return { status: r.status, body: j };
    } catch (e) { if (i === 3) return { status: 0, body: String(e && e.message || e) }; await new Promise((s) => setTimeout(s, 800)); }
  }
}
function run(cmd, cwd, timeout = 30000) {
  try { return execSync(cmd, { cwd, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (e) { return (((e.stdout || '') + (e.stderr || '')).trim() || String(e.message || 'err')) + ' [ERR]'; }
}
function parseJson(text) {
  for (const line of String(text || '').split('\n').map((s) => s.trim()).filter((s) => s.startsWith('{'))) {
    try { return JSON.parse(line); } catch {}
  }
  return null;
}

async function pickIssue() {
  if (process.argv[2]) return parseInt(process.argv[2], 10);
  const l = await ghreq('/issues?state=open&per_page=50');
  const cand = (Array.isArray(l.body) ? l.body : []).filter((i) => /^\[auto\]/i.test(i.title || ''));
  return cand.length ? cand[0].number : null;
}

async function tryBridge(M, task, WT) {
  const prompt = task + '\n\nReturn ONLY a unified diff (--- a/path +++ b/path). No explanation.';
  const raw = await disp(M.k, prompt);
  const diff = extractDiff(raw);
  if (!diff) return { ok: false, via: 'bridge', raw: (raw || '').slice(0, 200) };
  const patch = join(WT, '.patch-' + Date.now());
  writeFileSync(patch, diff);
  const ap = run(`git apply --check ${JSON.stringify(patch)}`, WT, 20000);
  if (/\[ERR\]|error:/i.test(ap)) {
    try { unlinkSync(patch); } catch {}
    return { ok: false, via: 'bridge', raw: ap.slice(0, 200) };
  }
  run(`git apply ${JSON.stringify(patch)}`, WT, 20000);
  try { unlinkSync(patch); } catch {}
  return { ok: true, via: 'bridge' };
}

async function main() {
  const N = await pickIssue();
  if (!N) { console.log(JSON.stringify({ skip: 'no open [auto] issue' })); return; }
  const iss = await ghreq('/issues/' + N);
  const title = iss.body.title || '';
  const ibody = String(iss.body.body || '').slice(0, 600);
  const chain = closerChain(iss.body);
  const WT = '/tmp/resolve-' + N;
  const task = `Fix GitHub issue #${N}: ${title}\n\n${ibody}\n\nRepo: miscsubjects-pages. Skip PROTECTED_WIDGETS.md / PROTECTED_FEATURES.md paths. Smallest patch.`;

  run(`git worktree remove ${WT} --force`, ROOT, 20000);
  run(`git worktree add -f ${WT} HEAD`, ROOT, 120000);

  let M = chain[0];
  let BR = `bot/${M.n}-issue-${N}`;
  let changed = false;
  let diffstat = '';
  let via = '';

  for (const cand of chain) {
    M = cand;
    BR = `bot/${M.n}-issue-${N}`;
    run(`git checkout -B ${BR}`, WT, 20000);
    run(`git reset --hard HEAD`, WT, 20000);

    const br = await tryBridge(M, task, WT);
    if (!br.ok) continue;
    via = br.via;

    run(`git add -A`, WT, 20000);
    const commit = run(`git commit -m ${JSON.stringify('bot(' + M.n + '): #' + N)}`, WT, 20000);
    changed = !/nothing to commit|\[ERR\]/.test(commit);
    if (changed) {
      diffstat = run(`git diff HEAD~1 --stat`, WT, 20000);
      const push = run(`git push -u origin ${BR} --force`, WT, 60000);
      if (/\[ERR\]/.test(push)) { changed = false; continue; }
      break;
    }
  }

  let merged = false;
  let mergeDetail = null;
  if (changed) {
    mergeDetail = parseJson(run(`node scripts/merge.mjs ${BR} ${N}`, ROOT, 120000));
    merged = !!(mergeDetail && mergeDetail.merged);
  }

  run(`git worktree remove ${WT} --force`, ROOT, 20000);

  if (changed && merged) {
    const receipt = `**E2E** — ${M.n} (${via || 'cli'}) → \`main\` via \`${BR}\`.\n\n\`\`\`\n${diffstat.slice(0, 1200)}\n\`\`\``;
    await ghreq('/issues/' + N + '/comments', { method: 'POST', body: JSON.stringify({ body: receipt }) });
    await ghreq('/issues/' + N, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) });
  } else if (changed && !merged) {
    const receipt = `Patch on \`${BR}\` — merge blocked: ${mergeDetail?.skip || mergeDetail?.error || '?'}. Stays open.\n\n\`\`\`\n${diffstat.slice(0, 600)}\n\`\`\``;
    await ghreq('/issues/' + N + '/comments', { method: 'POST', body: JSON.stringify({ body: receipt }) });
  }

  console.log(JSON.stringify({ issue: N, model: M.n, via, branch: BR, changed, merged, merge: mergeDetail, diffstat: diffstat.slice(0, 400) }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });