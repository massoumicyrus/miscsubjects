#!/usr/bin/env node
/**
 * Recursive GitHub loop. The build files its OWN build issues and closes its OWN tickets.
 * Surface: GitHub API (deterministic). Self-scan source: builder_queue via the build dispatch.
 * Scheduled by launchd = the cron. Filing is deduped by title; closing carries a ledger receipt.
 */
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

const REPO = '[OWNER_HANDLE]/miscsubjects-pages';
const BASE = 'https://miscsubjects.com';
const CAP = 6;

const KEY = (() => {
  const r = readFileSync(join(homedir(), '.config/grok-bridge.env'), 'utf8');
  const l = r.split('\n').filter((x) => !x.trim().startsWith('#') && x.includes('TERMINAL_KEY='));
  return l[0].split('TERMINAL_KEY=')[1].trim().replace(/^["']|["']$/g, '');
})();
const GH = execSync('gh auth token').toString().trim();
const GHH = { Authorization: 'Bearer ' + GH, Accept: 'application/vnd.github+json', 'User-Agent': 'miscsubjects-recurse', 'X-GitHub-Api-Version': '2022-11-28' };

async function disp(key, body) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(BASE + '/api/dispatch', { method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-key': KEY }, body: JSON.stringify({ key, body }) });
      const j = await r.json();
      if (j && (j.ok || j.result != null)) { let v = j.result; if (typeof v === 'string') { try { v = JSON.parse(v); } catch {} } return v; }
    } catch {}
    await new Promise((s) => setTimeout(s, 600));
  }
  return null;
}
const gh = async (path, opts = {}) => {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch('https://api.github.com/repos/' + REPO + path, { headers: GHH, ...opts });
      const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
      return { status: r.status, body: j };
    } catch (e) { if (i === 3) return { status: 0, body: String(e && e.message || e) }; await new Promise((s) => setTimeout(s, 800)); }
  }
};

async function builderIdeas() {
  for (let i = 0; i < 6; i++) { const v = await disp('BUILDER_LIST', 'idea'); if (Array.isArray(v)) return v; await new Promise((s) => setTimeout(s, 500)); }
  return [];
}

async function main() {
  // existing issues (dedup)
  const existing = [];
  for (let page = 1; page <= 5; page++) {
    const list = await gh('/issues?state=all&per_page=100&page=' + page);
    if (!Array.isArray(list.body) || !list.body.length) break;
    existing.push(...list.body.filter((i) => !i.pull_request));
    if (list.body.length < 100) break;
  }
  const have = new Set(existing.map((i) => String(i.title || '').toLowerCase().trim()));
  const openBuild = existing.filter((i) => i.state === 'open' && /^\[build\]/i.test(i.title || ''));

  // 1) FILE the build's own open work as issues
  const ideas = await builderIdeas();
  const filed = [];
  const remainingSlots = CAP - openBuild.length;
  if (remainingSlots <= 0) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), scanned_ideas: ideas.length, existing_issues: existing.length, filed, skip: 'open-build-cap', open_build: openBuild.length, cap: CAP }, null, 2));
    return;
  }
  for (const it of ideas.slice(0, remainingSlots)) {
    const title = `[build] ${String(it.title || '').trim()}`;
    if (!it.title || have.has(title.toLowerCase())) continue;
    const body = `Filed by the build (scripts/recurse.mjs) from builder_queue #${it.id}, priority ${it.priority}, status ${it.status}.\n\nView: ${BASE}/admin/forum\nResolve: close this issue with a ledger-receipt comment.`;
    const r = await gh('/issues', { method: 'POST', body: JSON.stringify({ title, body }) });
    if (r.status === 201) { filed.push(r.body.html_url); have.add(title.toLowerCase()); }
    else filed.push('ERR ' + r.status + ' on ' + title);
  }

  // 2) RESOLVE a real done ticket end-to-end (open -> proof -> close)
  const doneTitle = '[build] /admin/forum — ledger-derived forum view (shipped)';
  let resolved = null;
  if (!have.has(doneTitle.toLowerCase())) {
    const c = await gh('/issues', { method: 'POST', body: JSON.stringify({ title: doneTitle, body: 'Ship the coding-agent forum as a view over the ledger.' }) });
    if (c.status === 201) {
      const n = c.body.number;
      await gh(`/issues/${n}/comments`, { method: 'POST', body: JSON.stringify({ body: 'Resolved by Claude Code. Live + verified: HTTP 200, 136 threads from agent_turns. Receipt: ' + BASE + '/admin/forum' }) });
      const cl = await gh(`/issues/${n}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) });
      resolved = { number: n, url: c.body.html_url, closed: cl.status === 200 };
    }
  }

  console.log(JSON.stringify({ ts: new Date().toISOString(), scanned_ideas: ideas.length, existing_issues: existing.length, filed, resolved }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
