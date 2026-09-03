#!/usr/bin/env node
/**
 * Bulk Meta creatives: eagle01–eagle25 × (9:16 + 1:1) = 50 images.
 * Saves to ~/Downloads/meta-creatives/generated + miscsubjects.com/meta/.
 * Texts the owner each image. Signs Grok Build.
 *
 * Usage: node meta_bulk_gen.mjs [--force]
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';

const FORCE = process.argv.includes('--force');
const SHEET_ID = '<GOOGLE_SHEET_ID>';
const AIRUNNER =
  'https://script.google.com/macros/s/AKfycby4GognkhohBYQmmxy0msYbElqdfW7yvZ4Wewia5RQKX62u4jVj7rLXdPF0JvHGbmR4kQ/exec';
const BASE = 'https://miscsubjects.com';
const PHONE = '[OWNER_PHONE]';
const DL = join(homedir(), 'Downloads', 'meta-creatives');
const GEN = join(DL, 'outputs');
const SRC = join(DL, 'sources');
const COUNT = 25;
const RETRIES = 3;

const PROMPTS_FILE = join(homedir(), 'Downloads', 'meta-creatives', '01-PROMPTS.txt');

function loadPrompts() {
  const txt = readFileSync(PROMPTS_FILE, 'utf8');
  const get = (key) => {
    const m = txt.match(new RegExp(`^${key}=(.+)$`, 'm'));
    if (!m) throw new Error(`missing ${key} in 01-PROMPTS.txt`);
    return m[1].trim();
  };
  return {
    p916: get('PROMPT_9x16'),
    p1x1: get('PROMPT_1x1'),
    exactAddon: (txt.match(/^# PROMPT_EXACT_VIAL_ADDON=(.+)$/m) || [])[1]?.trim() || '',
  };
}

function promptsFor(n, loaded) {
  const keepExact = n % 2 === 1 && loaded.exactAddon;
  const base916 = keepExact ? loaded.p916.replace(/, make it 9x16.*/, '') + loaded.exactAddon + ', make it 9x16 for a meta ad' : loaded.p916;
  const base1x1 = keepExact ? loaded.p1x1.replace(/, make it 1x1.*/, '') + loaded.exactAddon + ', make it 1x1 for a meta ad' : loaded.p1x1;
  const tag = keepExact ? 'exact-vial' : 'standard';
  return { tag, p916: base916, p1x1: base1x1, variation: base916.replace(/, make it 9x16.*/, '') };
}

function nameFor(n) {
  return `eagle${String(n).padStart(2, '0')}`;
}

function terminalKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const txt = readFileSync(join(homedir(), '.config/grok-bridge.env'), 'utf8');
  const m = txt.match(/^TERMINAL_KEY=(.+)$/m);
  if (!m) throw new Error('TERMINAL_KEY missing');
  return m[1].trim();
}

async function gas(action, args = {}) {
  const r = await fetch(AIRUNNER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args }),
    redirect: 'follow',
  });
  return JSON.parse(await r.text());
}

async function dispatch(key, body) {
  const r = await fetch(`${BASE}/api/dispatch`, {
    method: 'POST',
    headers: {
      'x-terminal-key': terminalKey(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ key, body }),
  });
  const j = await r.json();
  if (!j.ok && j.error) throw new Error(String(j.error).slice(0, 300));
  let raw = j.result ?? j;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw.replace(/^HTTP\s+\d+:/, ''));
    } catch {
      if (raw.startsWith('ERR:')) throw new Error(raw.slice(0, 300));
      return raw;
    }
  }
  if (raw && typeof raw === 'object' && raw.url) return raw;
  if (typeof raw === 'string' && raw.startsWith('ERR:')) throw new Error(raw.slice(0, 300));
  return raw;
}

function errMsg(e) {
  if (!e) return 'unknown';
  if (typeof e === 'string') return e;
  return e.message || JSON.stringify(e).slice(0, 300);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function textImage(label, url) {
  await dispatch('SEND_IMAGE_BLOOIO', `${PHONE}|${label} — Grok Build|${url}`);
  await sleep(2000);
}

function parseFromArg() {
  const a = process.argv.find((x) => x.startsWith('--from='));
  return a ? parseInt(a.split('=')[1], 10) : 1;
}

async function uploadNamed(name, bytes) {
  const r = await fetch(`${BASE}/api/file_upload?key=${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'x-terminal-key': terminalKey(), 'content-type': 'image/png' },
    body: bytes,
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`upload ${name}: ${JSON.stringify(j)}`);
  return j.url;
}

function sipsCrop916(src, dst) {
  const mid = join(DL, '.tmp');
  mkdirSync(mid, { recursive: true });
  const cropped = join(mid, 'crop.png');
  writeFileSync(cropped, readFileSync(src));
  execFileSync('sips', ['-c', '1536', '864', cropped], { stdio: 'pipe' });
  execFileSync('sips', ['-z', '1920', '1080', cropped], { stdio: 'pipe' });
  writeFileSync(dst, readFileSync(cropped));
}

function sipsResize1x1(src, dst) {
  writeFileSync(dst, readFileSync(src));
  execFileSync('sips', ['-z', '1080', '1080', dst], { stdio: 'pipe' });
}

async function fetchPng(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function genEdit(prompt, ref, apiSize) {
  let last;
  for (let i = 0; i < RETRIES; i++) {
    try {
      const out = await dispatch('OPENAI_IMAGE_EDIT', `${prompt}|${ref}|${apiSize}`);
      const url = typeof out === 'object' && out.url ? out.url : String(out);
      if (url.indexOf('http') === 0) return url;
      last = new Error(url.slice(0, 300));
    } catch (e) {
      last = e;
    }
    await sleep(5000 * (i + 1));
  }
  throw last;
}

function seedSources() {
  mkdirSync(SRC, { recursive: true });
  mkdirSync(GEN, { recursive: true });
  for (let n = 1; n <= COUNT; n++) {
    const name = nameFor(n);
    const src = join(homedir(), 'Downloads', `eagle${n}.png`);
    const dst = join(SRC, `${name}-ref.png`);
    if (existsSync(src)) copyFileSync(src, dst);
  }
}

async function make916(name, ref, prompt) {
  const rawUrl = await genEdit(prompt, ref, '1024x1536');
  const outPath = join(GEN, `${name}_9x16.png`);
  const rawPath = join(GEN, `${name}_916_raw.png`);
  writeFileSync(rawPath, await fetchPng(rawUrl));
  sipsCrop916(rawPath, outPath);
  const url = await uploadNamed(`meta/${name}_9x16.png`, readFileSync(outPath));
  await textImage(`${name} 9:16`, url);
  return url;
}

async function make1x1(name, ref, prompt) {
  const rawUrl = await genEdit(prompt, ref, '1024x1024');
  const outPath = join(GEN, `${name}_1x1.png`);
  const rawPath = join(GEN, `${name}_1x1_raw.png`);
  writeFileSync(rawPath, await fetchPng(rawUrl));
  sipsResize1x1(rawPath, outPath);
  const url = await uploadNamed(`meta/${name}_1x1.png`, readFileSync(outPath));
  await textImage(`${name} 1:1`, url);
  return url;
}

async function main() {
  const loaded = loadPrompts();
  seedSources();
  let made916 = 0;
  let made1x1 = 0;
  const fromArg = process.argv.find((a) => a.startsWith('--from='));
  const startN = fromArg ? parseInt(fromArg.split('=')[1], 10) : 1;

  for (let n = startN; n <= COUNT; n++) {
    const name = nameFor(n);
    const ref = `${BASE}/img/up/eagle${n}.png`;
    const { tag, p916, p1x1, variation } = promptsFor(n, loaded);
    let url916 = '';
    let url1x1 = '';
    const parts = [tag];

    await gas('eagle_update_row', { name, variation_prompt: variation, status: `generating… (${tag})` });

    process.stdout.write(`[916] ${name} (${tag})… `);
    try {
      url916 = await make916(name, ref, p916);
      made916++;
      parts.push('9:16 ok');
      console.log(url916);
    } catch (e) {
      parts.push(`9:16 fail: ${errMsg(e).slice(0, 80)}`);
      console.log('FAIL', errMsg(e));
    }

    process.stdout.write(`[1x1] ${name} (${tag})… `);
    try {
      url1x1 = await make1x1(name, ref, p1x1);
      made1x1++;
      parts.push('1:1 ok');
      console.log(url1x1);
    } catch (e) {
      parts.push(`1:1 fail: ${errMsg(e).slice(0, 80)}`);
      console.log('FAIL', errMsg(e));
    }

    const upd = { name, variation_prompt: variation, status: parts.join(' | ') };
    if (url916) upd.url_916 = url916;
    if (url1x1) upd.url_1x1 = url1x1;
    await gas('eagle_update_row', upd);
    console.log(`[row] ${name} ${parts.join(' | ')}`);
  }

  await dispatch('SEND_BY_CHANNEL', `blooio|${PHONE}|50-image run done: ${made916}/25 9:16 + ${made1x1}/25 1:1 in ~/Downloads/meta-creatives/outputs — Grok Build`);
  console.log(`\n[done] 9:16=${made916} 1x1=${made1x1} folder=${GEN}`);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await dispatch('SEND_BY_CHANNEL', `blooio|${PHONE}|meta bulk gen error: ${errMsg(e).slice(0, 120)} — Grok Build`);
  } catch {}
  process.exit(1);
});