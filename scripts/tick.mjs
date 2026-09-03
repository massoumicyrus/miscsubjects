#!/usr/bin/env node
/**
 * E2E github loop tick:
 *   1) close+merge oldest [auto] (resolve.mjs)
 *   2) open new audit ticket ONLY if close merged OR nothing to close
 *   3) sync tasks + ledger
 */
import { readFileSync, openSync, closeSync, unlinkSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

const ROOT = '/Users/owner/miscsubjects-pages';
const BASE = 'https://miscsubjects.com';
const LOCK = join(homedir(), '.miscsubjects', 'tick.lock');
const MAX_OPEN = 3;

const KEY = (() => {
  const r = readFileSync(join(homedir(), '.config/grok-bridge.env'), 'utf8');
  const l = r.split('\n').filter((x) => !x.trim().startsWith('#') && x.includes('TERMINAL_KEY='));
  return l[0].split('TERMINAL_KEY=')[1].trim().replace(/^["']|["']$/g, '');
})();

function parseLastJson(text) {
  const lines = String(text || '').split('\n').map((s) => s.trim()).filter((s) => s.startsWith('{') && s.endsWith('}'));
  for (let i = lines.length - 1; i >= 0; i--) {
    try { return JSON.parse(lines[i]); } catch {}
  }
  return null;
}

function run(script, timeout = 360000) {
  try {
    const out = execSync(`node scripts/${script}`, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, HOME: homedir(), PATH: process.env.PATH },
    });
    return parseLastJson(out) || { raw: out.slice(-500) };
  } catch (e) {
    const txt = ((e.stdout || '') + (e.stderr || '')).trim() || String(e.message || 'err');
    return parseLastJson(txt) || { error: txt.slice(-600) };
  }
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
      if (j?.ok || j?.result != null) return j;
    } catch {}
    await new Promise((s) => setTimeout(s, 500));
  }
  return null;
}

async function main() {
  try {
    const fd = openSync(LOCK, 'wx');
    closeSync(fd);
  } catch {
    console.log(JSON.stringify({ skip: 'tick already running' }));
    return;
  }
  try {
    const close = run('resolve.mjs');

    let open = { skip: 'drain-first' };
    const drained = close.skip === 'no open [auto] issue';
    const shipped = close.merged === true && close.changed === true;

    if (drained) {
      open = run('audit.mjs', 120000);
    } else if (shipped) {
      const stats = await fetch(BASE + '/api/github-loop?stats=1', {
        headers: { 'x-terminal-key': KEY },
      }).then((r) => r.json()).catch(() => ({}));
      const n = stats?.github?.auto_open ?? MAX_OPEN;
      open = n < MAX_OPEN ? run('audit.mjs', 120000) : { skip: 'open-cap', open: n, max: MAX_OPEN };
    }

    let sync = null;
    try {
      const r = await fetch(BASE + '/api/github-loop/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-terminal-key': KEY },
      });
      sync = await r.json();
    } catch (e) {
      sync = { error: String(e?.message || e) };
    }

    const summary = { ts: new Date().toISOString(), close, open, sync };
    const prev = JSON.stringify(summary).slice(0, 3500);
    await disp(
      'LEDGER_EXEC',
      [
        'INSERT INTO events (id, ts, source, key, action, direction, status, request_preview, response_preview, request_json, response_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'gh_tick_' + Date.now(),
        summary.ts,
        'github-loop',
        'GITHUB_TICK',
        'internal',
        shipped ? '200' : '202',
        close.issue ? '#' + close.issue : String(close.skip || 'close'),
        shipped ? 'merged+closed' : String(open.skip || open.filed || 'open'),
        prev.slice(0, 4000),
        prev.slice(0, 4000),
      ].join('|'),
    );

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    try { if (existsSync(LOCK)) unlinkSync(LOCK); } catch {}
  }
}

main().catch((e) => {
  try { if (existsSync(LOCK)) unlinkSync(LOCK); } catch {}
  console.error(e);
  process.exit(1);
});