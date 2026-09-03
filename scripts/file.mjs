#!/usr/bin/env node
/**
 * Rotating filer — every model opens tickets. Each run a different model audits the build and
 * files ONE [auto] GitHub issue; the resolver (rotating too) then closes it. Together = the loop.
 * Rotation persisted in ~/.miscsubjects/file-cursor. Deduped by title.
 */
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

const REPO = '[OWNER_HANDLE]/miscsubjects-pages';
const BASE = 'https://miscsubjects.com';
const CURSOR = join(homedir(), '.miscsubjects', 'file-cursor');
const KEY = (() => {
  const r = readFileSync(join(homedir(), '.config/grok-bridge.env'), 'utf8');
  const l = r.split('\n').filter((x) => !x.trim().startsWith('#') && x.includes('TERMINAL_KEY='));
  return l[0].split('TERMINAL_KEY=')[1].trim().replace(/^["']|["']$/g, '');
})();
const GH = execSync('gh auth token').toString().trim();
const GHH = { Authorization: 'Bearer ' + GH, Accept: 'application/vnd.github+json', 'User-Agent': 'miscsubjects-file', 'X-GitHub-Api-Version': '2022-11-28' };
const MODELS = [{ n: 'grok', k: 'XAI_CHAT' }, { n: 'kimi', k: 'ASK_KIMI' }];
const MAX_OPEN_AUTO = 3;

async function ghreq(path, opts = {}) {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch('https://api.github.com/repos/' + REPO + path, { headers: GHH, ...opts }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j }; }
    catch (e) { if (i === 3) return { status: 0, body: String(e && e.message || e) }; await new Promise((s) => setTimeout(s, 800)); }
  }
}
async function listIssues(state = 'all', maxPages = 5) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const r = await ghreq('/issues?state=' + state + '&per_page=100&page=' + page);
    if (!Array.isArray(r.body) || !r.body.length) break;
    out.push(...r.body.filter((i) => !i.pull_request));
    if (r.body.length < 100) break;
  }
  return out;
}
async function disp(key, body) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(BASE + '/api/dispatch', { method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-key': KEY }, body: JSON.stringify({ key, body }) }); const j = await r.json(); if (j && (j.ok || j.result != null)) return String(j.result || ''); } catch {}
    await new Promise((s) => setTimeout(s, 700));
  }
  return '';
}

async function main() {
  let cur = 0;
  try { cur = parseInt(readFileSync(CURSOR, 'utf8'), 10) || 0; } catch {}
  const M = MODELS[cur % MODELS.length];
  try { writeFileSync(CURSOR, String(cur + 1)); } catch {}

  const issues = await listIssues('all');
  const openAuto = issues.filter((i) => i.state === 'open' && /^\[auto\]/i.test(i.title || ''));
  if (openAuto.length >= MAX_OPEN_AUTO) {
    console.log(JSON.stringify({ model: M.n, skip: 'open-auto-cap', open_auto: openAuto.length, max: MAX_OPEN_AUTO }, null, 2));
    return;
  }
  const have = new Set(issues.map((i) => String(i.title || '').toLowerCase()));

  const prompt = `You are auditing the miscsubjects build — a self-operating multi-agent system on Cloudflare (D1/KV/R2) plus a Mac bridge. Give ONE concrete, real, actionable build issue on a single line as: TITLE :: BODY. Terse, specific, no preamble.`;
  const out = await disp(M.k, prompt);
  const line = (out || '').split('\n').map((s) => s.trim()).find((s) => s.includes('::')) || (out || '').split('\n').find(Boolean) || '';
  let [t, b] = line.split('::');
  const title = (t || '').replace(/^[-*#>\s]+/, '').trim().slice(0, 90);
  const body = (b || '').trim().slice(0, 500);
  if (!title) { console.log(JSON.stringify({ model: M.n, skip: 'no title', raw: (out || '').slice(0, 140) })); return; }

  const full = `[auto] ${title} (via ${M.n})`;
  if (have.has(full.toLowerCase())) { console.log(JSON.stringify({ model: M.n, skip: 'dup', title: full })); return; }
  const r = await ghreq('/issues', { method: 'POST', body: JSON.stringify({ title: full, body: (body || title) + `\n\nFiled by ${M.n} via scripts/file.mjs. Tagged [auto] — the rotating resolver will pick it up.` }) });
  console.log(JSON.stringify({ model: M.n, filed: r.status === 201 ? r.body.html_url : ('ERR ' + r.status) }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
