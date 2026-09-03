#!/usr/bin/env node
/**
 * eagle1–25 originals + GPT 1x1 remakes as eagle26–50.
 * Prompt (verbatim): remake this image in 1x1
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';

const OUT = join(homedir(), 'Downloads', 'eagle-1-50');
const BASE = 'https://miscsubjects.com';
const PROMPT = 'remake this image in 1x1';
const PHONE = '[OWNER_PHONE]';

function terminalKey() {
  if (process.env.TERMINAL_KEY) return process.env.TERMINAL_KEY;
  const txt = readFileSync(join(homedir(), '.config/grok-bridge.env'), 'utf8');
  const m = txt.match(/^TERMINAL_KEY=(.+)$/m);
  if (!m) throw new Error('TERMINAL_KEY missing');
  return m[1].trim();
}

async function dispatch(key, body) {
  const r = await fetch(`${BASE}/api/dispatch`, {
    method: 'POST',
    headers: { 'x-terminal-key': terminalKey(), 'content-type': 'application/json' },
    body: JSON.stringify({ key, body }),
  });
  const j = await r.json();
  let raw = j.result ?? j;
  if (typeof raw === 'string') {
    if (raw.startsWith('HTTP 202:')) {
      try {
        return JSON.parse(raw.replace(/^HTTP 202:/, ''));
      } catch {
        return { status: 'queued' };
      }
    }
    try {
      raw = JSON.parse(raw.replace(/^HTTP\s+\d+:/, ''));
    } catch {
      if (raw.startsWith('ERR:')) throw new Error(raw.slice(0, 300));
      if (raw.startsWith('http')) return raw;
    }
  }
  if (typeof raw === 'object' && raw?.url) return raw.url;
  if (typeof raw === 'string' && raw.startsWith('http')) return raw;
  if (typeof raw === 'object' && (raw?.status === 'queued' || raw?.message_id)) return raw;
  throw new Error(String(typeof raw === 'object' ? JSON.stringify(raw) : raw).slice(0, 300));
}

async function textImage(label, url) {
  await dispatch('SEND_IMAGE_BLOOIO', `${PHONE}|${label} — Grok Build|${url}`);
}

async function fetchPng(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function resize1x1(src, dst) {
  writeFileSync(dst, readFileSync(src));
  execFileSync('sips', ['-z', '1080', '1080', dst], { stdio: 'pipe' });
}

function seedOriginals() {
  mkdirSync(OUT, { recursive: true });
  for (let n = 1; n <= 25; n++) {
    const src = join(homedir(), 'Downloads', `eagle${n}.png`);
    const dst = join(OUT, `eagle${n}.png`);
    if (!existsSync(src)) throw new Error(`missing ${src}`);
    copyFileSync(src, dst);
  }
  console.log('[seed] eagle1–eagle25 in', OUT);
}

async function main() {
  const start = parseInt(process.argv.find((a) => a.startsWith('--from='))?.split('=')[1] || '1', 10);
  seedOriginals();

  for (let n = start; n <= 25; n++) {
    const outNum = n + 25;
    const outPath = join(OUT, `eagle${outNum}.png`);
    if (existsSync(outPath) && !process.argv.includes('--force')) {
      console.log(`[skip] eagle${outNum} exists`);
      continue;
    }
    const ref = `${BASE}/img/up/eagle${n}.png`;
    process.stdout.write(`[gen] eagle${n} → eagle${outNum}… `);
    let rawUrl;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        rawUrl = await dispatch('OPENAI_IMAGE_EDIT', `${PROMPT}|${ref}|1024x1024`);
        break;
      } catch (e) {
        if (attempt === 5) throw e;
        console.log(`retry ${attempt}…`);
        await new Promise((r) => setTimeout(r, 8000 * attempt));
      }
    }
    const tmp = join(OUT, `.tmp_eagle${outNum}.png`);
    writeFileSync(tmp, await fetchPng(rawUrl));
    resize1x1(tmp, outPath);
    console.log('ok');
    await textImage(`eagle${outNum} (remake of eagle${n})`, rawUrl);
  }

  const count = [...Array(50)].filter((_, i) => existsSync(join(OUT, `eagle${i + 1}.png`))).length;
  await dispatch('SEND_BY_CHANNEL', `blooio|${PHONE}|eagle-1-50 folder: ${count}/50 images in ~/Downloads/eagle-1-50 — Grok Build`);
  console.log(`[done] ${count}/50 in ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});