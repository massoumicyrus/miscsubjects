#!/usr/bin/env node
/** Generate 5 sheet rows with a shared prompt; update gen_preview on sheet. No iMessage. */
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SHEET_ID = '<GOOGLE_SHEET_ID>';
const AIRUNNER =
  'https://script.google.com/macros/s/AKfycby4GognkhohBYQmmxy0msYbElqdfW7yvZ4Wewia5RQKX62u4jVj7rLXdPF0JvHGbmR4kQ/exec';
const BASE = 'https://miscsubjects.com';
const NAMES = ['eagle1', 'eagle2', 'eagle3', 'eagle4', 'eagle5'];
const PROMPT =
  'Use the peptide vial in the reference image, redesign another image similar to this one, but, less risky for meta, remove more that might flag as peptide / drug related, make it 9x16 for a meta ad';
const SIZE = '1024x1536';

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
  const raw = j.result ?? j;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw.replace(/^HTTP\s+\d+:/, ''));
    } catch {
      return raw;
    }
  }
  return raw;
}

async function main() {
  const got = await gas('sheets_get', { sheet_id: SHEET_ID, range: 'EAGLE_IMAGES!A1:L100' });
  const values = got.values || [];
  const head = values[0];
  const idx = Object.fromEntries(head.map((h, i) => [h, i]));

  let ok = 0;
  for (const name of NAMES) {
    const r = values.findIndex((row, i) => i > 0 && row[idx.name] === name);
    if (r < 0) {
      console.log(`[skip] ${name} not found`);
      continue;
    }
    const ref = String(values[r][idx.ref_url] || '').trim();
    if (!ref) {
      console.log(`[skip] ${name} no ref_url`);
      continue;
    }

    await gas('eagle_update_row', {
      name,
      variation_prompt: PROMPT,
      status: 'generating…',
    });

    console.log(`[gen] ${name}…`);
    const out = await dispatch('OPENAI_IMAGE_EDIT', `${PROMPT}|${ref}|${SIZE}`);
    const url = typeof out === 'object' && out.url ? out.url : String(out);
    if (url.indexOf('http') !== 0) {
      console.log(`[fail] ${name}: ${url.slice(0, 200)}`);
      await gas('eagle_update_row', { name, status: String(url).slice(0, 200) });
      continue;
    }

    await gas('eagle_update_row', { name, gen_url: url, status: 'done', good: 'y' });
    console.log(`[ok] ${name}: ${url}`);
    ok++;
  }

  console.log(`[done] ${ok}/${NAMES.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});