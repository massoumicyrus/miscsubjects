
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const HOME = os.homedir();
export const ROOT = path.join(HOME, '.miscsubjects', 'webmodel');
export const PROFILE_ROOT = path.join(HOME, '.miscsubjects', 'webmodel-chrome');
export const CDP_PORT = parseInt(process.env.WEBMODEL_CDP_PORT || '9222', 10);

const SOURCE_ROOT = path.join(HOME, 'Library', 'Application Support', 'Google', 'Chrome');

export function ensureDirs() {
  for (const d of [ROOT, path.join(ROOT, 'raw'), path.join(ROOT, 'idem')]) fs.mkdirSync(d, { recursive: true });
}

export function liveOwnerProfile() {
  let best = null;
  for (const name of fs.readdirSync(SOURCE_ROOT)) {
    const c = path.join(SOURCE_ROOT, name, 'Cookies');
    if (!fs.existsSync(c)) continue;
    const st = fs.statSync(c);
    if (!best || st.mtimeMs > best.mtimeMs) best = { name, mtimeMs: st.mtimeMs, size: st.size };
  }
  return best;
}

// Seed only on first creation. A reseed would throw away every provider session the gateway has
// established since, so it never happens implicitly.
export function seedProfileIfMissing() {
  if (fs.existsSync(path.join(PROFILE_ROOT, 'Default', 'Cookies'))) return { seeded: false, reason: 'already_present' };
  const src = liveOwnerProfile();
  if (!src) return { seeded: false, reason: 'no_owner_profile' };
  const from = path.join(SOURCE_ROOT, src.name);
  fs.mkdirSync(path.join(PROFILE_ROOT, 'Default'), { recursive: true });
  fs.copyFileSync(path.join(SOURCE_ROOT, 'Local State'), path.join(PROFILE_ROOT, 'Local State'));
  fs.writeFileSync(path.join(PROFILE_ROOT, 'First Run'), '');
  // sqlite3 .backup, not cp: the live cookie jar can be mid-write.
  execFileSync('/usr/bin/sqlite3', [path.join(from, 'Cookies'), `.backup '${path.join(PROFILE_ROOT, 'Default', 'Cookies')}'`]);
  for (const f of ['Preferences', 'Secure Preferences', 'Web Data', 'Login Data']) {
    try { fs.copyFileSync(path.join(from, f), path.join(PROFILE_ROOT, 'Default', f)); } catch {}
  }
  for (const d of ['Local Storage', 'IndexedDB']) {
    try { fs.cpSync(path.join(from, d), path.join(PROFILE_ROOT, 'Default', d), { recursive: true }); } catch {}
  }
  return { seeded: true, from: src.name };
}

export async function cdpAlive(port = CDP_PORT) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export async function ensureChrome() {
  let v = await cdpAlive();
  if (v) return { launched: false, version: v };
  const seed = seedProfileIfMissing();
  // --disable-extensions is load-bearing: Playwright's CDP attach asserts on extension
  // service-worker targets and throws before a single page is opened.
  const child = spawn(CHROME_BIN, [
    `--user-data-dir=${PROFILE_ROOT}`,
    `--remote-debugging-port=${CDP_PORT}`,
    '--remote-allow-origins=*',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    '--profile-directory=Default',
    'about:blank',
  ], { detached: true, stdio: 'ignore' });
  child.unref();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    v = await cdpAlive();
    if (v) return { launched: true, version: v, seed };
  }
  return { launched: false, error: 'BROWSER_WORKER_OFFLINE', detail: 'chrome did not expose CDP within 20s', seed };
}
