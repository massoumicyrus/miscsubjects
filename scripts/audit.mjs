#!/usr/bin/env node
/**
 * Grok + Kimi code audit — bloat, dead code, redundancy, consolidation.
 * Grok files → Kimi closes (and vice versa). Consensus when both flag same target.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join, basename } from 'path';
import { execSync } from 'child_process';

const REPO = '[OWNER_HANDLE]/miscsubjects-pages';
const ROOT = '/Users/owner/miscsubjects-pages';
const BASE = 'https://miscsubjects.com';
const CURSOR = join(homedir(), '.miscsubjects', 'audit-cursor');
const CONSENSUS = join(homedir(), '.miscsubjects', 'audit-consensus.json');
const FINDINGS = join(homedir(), '.miscsubjects', 'audit-findings.jsonl');
const MANIFESTS = ['PROTECTED_WIDGETS.md', 'PROTECTED_FEATURES.md'];
const MAX_SNIP = 1200;
const MAX_OPEN_AUTO = 3;

const KEY = (() => {
  const r = readFileSync(join(homedir(), '.config/grok-bridge.env'), 'utf8');
  const l = r.split('\n').filter((x) => !x.trim().startsWith('#') && x.includes('TERMINAL_KEY='));
  return l[0].split('TERMINAL_KEY=')[1].trim().replace(/^["']|["']$/g, '');
})();
const GH = execSync('gh auth token').toString().trim();
const GHH = {
  Authorization: 'Bearer ' + GH,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'miscsubjects-audit',
  'X-GitHub-Api-Version': '2022-11-28',
};

const MODELS = [{ n: 'grok', k: 'XAI_CHAT' }, { n: 'kimi', k: 'ASK_KIMI' }];

function run(cmd, cwd = ROOT, timeout = 120000) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return (((e.stdout || '') + (e.stderr || '')).trim() || String(e.message || 'err')) + ' [ERR]';
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

function auditableFiles() {
  const locked = lockedSet();
  const raw = run("git ls-files 'functions/**' 'scripts/**' 'bridge/**' | rg '\\.(js|mjs|ts)$' || true");
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter((p) => p && !locked.has(p))
    .map((path) => {
      const lines = parseInt(run(`wc -l < ${JSON.stringify(path)}`), 10) || 0;
      return { path, lines };
    })
    .filter((f) => f.lines > 0)
    .sort((a, b) => b.lines - a.lines);
}

function refEvidence(path) {
  const sym = basename(path).replace(/\.(js|mjs|ts)$/, '');
  const importers = run(`git grep -l ${JSON.stringify(sym)} -- '*.js' '*.mjs' '*.ts' 2>/dev/null | rg -v '^${path}$' | head -12 || true`);
  const importCount = importers ? importers.split('\n').filter(Boolean).length : 0;
  return { sym, importCount, importers: importers || '(none)' };
}

function bundle(file) {
  const refs = refEvidence(file.path);
  let content = '';
  try { content = readFileSync(join(ROOT, file.path), 'utf8'); } catch {}
  const snip = content.slice(0, MAX_SNIP);
  const tail = content.length > MAX_SNIP ? `\n… [truncated ${content.length - MAX_SNIP} chars]` : '';
  return [
    `path: ${file.path}`,
    `lines: ${file.lines}`,
    `symbol: ${refs.sym}`,
    `grep_hits_elsewhere: ${refs.importCount}`,
    `importers:\n${refs.importers}`,
    `---`,
    snip + tail,
  ].join('\n');
}

async function ghreq(path, opts = {}) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch('https://api.github.com/repos/' + REPO + path, { headers: GHH, ...opts });
      const t = await r.text();
      let j;
      try { j = JSON.parse(t); } catch { j = t; }
      return { status: r.status, body: j };
    } catch (e) {
      if (i === 3) return { status: 0, body: String((e && e.message) || e) };
      await new Promise((s) => setTimeout(s, 800));
    }
  }
}

async function listIssues(state = 'all', maxPages = 5) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = state.includes('?') ? '&' : '?';
    const r = await ghreq('/issues' + sep + 'state=' + state + '&per_page=100&page=' + page);
    if (!Array.isArray(r.body) || !r.body.length) break;
    out.push(...r.body.filter((i) => !i.pull_request));
    if (r.body.length < 100) break;
  }
  return out;
}

async function disp(key, body) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(BASE + '/api/dispatch', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-terminal-key': KEY },
        body: JSON.stringify({ key, body }),
      });
      const j = await r.json();
      if (j && (j.ok || j.result != null)) return String(j.result || '');
    } catch {}
    await new Promise((s) => setTimeout(s, 700));
  }
  return '';
}

async function ask(M, prompt) {
  return disp(M.k, prompt);
}

function loadConsensus() {
  try { return JSON.parse(readFileSync(CONSENSUS, 'utf8')); } catch { return {}; }
}

function saveConsensus(obj) {
  try { writeFileSync(CONSENSUS, JSON.stringify(obj, null, 2)); } catch {}
}

function logFinding(row) {
  try { writeFileSync(FINDINGS, JSON.stringify(row) + '\n', { flag: 'a' }); } catch {}
}

function parseFinding(raw) {
  const line = (raw || '')
    .split('\n')
    .map((s) => s.trim())
    .find((s) => s.includes('::')) || '';
  const [t, ...rest] = line.split('::');
  const title = (t || '').replace(/^[-*#>\s]+/, '').trim();
  const body = rest.join('::').trim();
  if (!title || /^clean$/i.test(title)) return null;
  const target = (body.match(/`?([a-zA-Z0-9_./-]+\.(?:js|mjs|ts))`?/) || [])[1] || '';
  const category = (() => {
    const s = (title + ' ' + body).toLowerCase();
    if (/dead|unused|orphan/.test(s)) return 'dead_code';
    if (/bloat|verbose|trim|shrink/.test(s)) return 'bloat';
    if (/redundan|dup|overlap/.test(s)) return 'redundancy';
    if (/consolidat|merge|extract|unify/.test(s)) return 'consolidate';
    return 'audit';
  })();
  return { title: title.slice(0, 90), body: body.slice(0, 1200), target, category };
}

async function main() {
  const files = auditableFiles();
  if (!files.length) {
    console.log(JSON.stringify({ skip: 'no auditable files' }));
    return;
  }

  let cur = 0;
  try { cur = parseInt(readFileSync(CURSOR, 'utf8'), 10) || 0; } catch {}
  const M = MODELS[cur % MODELS.length];
  const file = files[Math.floor(cur / MODELS.length) % files.length];
  try { writeFileSync(CURSOR, String(cur + 1)); } catch {}

  const issues = await listIssues('all');
  const openAuto = issues.filter((i) => i.state === 'open' && /^\[auto\]/i.test(i.title || ''));
  if (openAuto.length >= MAX_OPEN_AUTO) {
    console.log(JSON.stringify({ skip: 'open-auto-cap', open_auto: openAuto.length, max: MAX_OPEN_AUTO }, null, 2));
    return;
  }
  const have = new Set(issues.map((i) => String(i.title || '').toLowerCase()));

  const prompt = [
    `You are ${M.n} — code auditor for miscsubjects-pages (Cloudflare Workers + Mac bridge).`,
    `Audit this file for: bloat, dead code, unused exports, redundancy, duplicate logic, design consolidation.`,
    `Use the grep evidence. Propose; do not edit. One finding only.`,
    ``,
    bundle(file),
    ``,
    `Output exactly one line: TITLE :: BODY`,
    `TITLE = short fix (max 80 chars). BODY = target paths + grep/import evidence + exact action (delete/merge/extract/disable).`,
    `If nothing actionable: CLEAN :: no finding`,
  ].join('\n');

  const raw = await ask(M, prompt);
  const finding = parseFinding(raw);
  const row = {
    ts: new Date().toISOString(),
    model: M.n,
    file: file.path,
    lines: file.lines,
    finding: finding || 'clean',
    raw_tail: (raw || '').slice(-300),
  };
  logFinding(row);

  if (!finding) {
    console.log(JSON.stringify({ model: M.n, file: file.path, skip: 'clean' }, null, 2));
    return;
  }

  if (!finding.target) finding.target = file.path;
  const key = finding.target.toLowerCase();
  const cons = loadConsensus();
  const slot = cons[key] || { target: finding.target, models: [], titles: [] };
  if (!slot.models.includes(M.n)) slot.models.push(M.n);
  slot.titles.push(finding.title);
  slot.last = finding;
  cons[key] = slot;
  saveConsensus(cons);

  const consensus = slot.models.length >= 2;
  const tag = consensus ? '[audit:consensus]' : '[audit]';
  const full = `[auto] ${tag} ${finding.title} (via ${M.n})`;
  if (have.has(full.toLowerCase())) {
    console.log(JSON.stringify({ model: M.n, file: file.path, skip: 'dup', title: full, consensus_models: slot.models }, null, 2));
    return;
  }

  const issueBody = [
    finding.body,
    '',
    `**Category:** ${finding.category}`,
    `**Audited file:** \`${file.path}\` (${file.lines} lines)`,
    `**Auditor:** ${M.n} via scripts/audit.mjs`,
    consensus ? `**Consensus:** ${slot.models.join(', ')} agree on \`${slot.target}\`` : `**Consensus:** pending (1/${slot.models.length} models)`,
    '',
    'Tagged [auto] — rotating resolver will implement if safe. Do NOT edit PROTECTED_WIDGETS.md / PROTECTED_FEATURES.md paths.',
  ].join('\n');

  const labels = ['code-audit'];
  const r = await ghreq('/issues', {
    method: 'POST',
    body: JSON.stringify({ title: full, body: issueBody, labels }),
  });
  console.log(
    JSON.stringify(
      {
        model: M.n,
        file: file.path,
        category: finding.category,
        consensus,
        consensus_models: slot.models,
        filed: r.status === 201 ? r.body.html_url : 'ERR ' + r.status,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
