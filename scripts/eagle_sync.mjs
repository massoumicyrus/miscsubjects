#!/usr/bin/env node
/**
 * Upload eagle1–eagle25 from ~/Downloads → miscsubjects R2 → EAGLE_IMAGES sheet + previews.
 */
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SHEET_ID = '<GOOGLE_SHEET_ID>';
const AIRUNNER =
  'https://script.google.com/macros/s/AKfycby4GognkhohBYQmmxy0msYbElqdfW7yvZ4Wewia5RQKX62u4jVj7rLXdPF0JvHGbmR4kQ/exec';
const BASE = 'https://miscsubjects.com';
const DEFAULT_PROMPT =
  'Create a new creative variation of this eagle image. Keep the same subject, pose, and overall style. Apply subtle but meaningful changes in lighting, background, or detail.';

const HEADERS = [
  'name', 'source_preview', 'ref_url', 'good', 'what_it_is', 'variation_prompt',
  'gen_preview', 'gen_url', 'run', 'text_me', 'status',
];

function terminalKey() {
  const env = process.env.TERMINAL_KEY;
  if (env) return env;
  try {
    const txt = readFileSync(join(homedir(), '.config/grok-bridge.env'), 'utf8');
    const m = txt.match(/^TERMINAL_KEY=(.+)$/m);
    if (m) return m[1].trim();
  } catch {}
  throw new Error('TERMINAL_KEY not found');
}

async function uploadPng(name, bytes, key) {
  const r = await fetch(`${BASE}/api/file_upload?key=${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'x-terminal-key': terminalKey(), 'content-type': 'image/png' },
    body: bytes,
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`upload ${name}: ${JSON.stringify(j)}`);
  return j.url;
}

async function gas(action, args = {}) {
  const r = await fetch(AIRUNNER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args }),
    redirect: 'follow',
  });
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return { ok: false, raw: t.slice(0, 500) };
  }
}

async function main() {
  const dl = join(homedir(), 'Downloads');
  const rows = [];

  for (let n = 1; n <= 25; n++) {
    const name = `eagle${n}`;
    const path = join(dl, `${name}.png`);
    if (!existsSync(path)) {
      rows.push([name, '', '', 'n', '', DEFAULT_PROMPT, '', '', '', '', 'missing']);
      continue;
    }
    const bytes = readFileSync(path);
    process.stdout.write(`[eagle] ${name} → R2… `);
    const url = await uploadPng(name, bytes, `${name}.png`);
    console.log(url);
    rows.push([name, '', url, 'n', '', DEFAULT_PROMPT, '', '', '', '', 'synced']);
  }

  console.log('[eagle] writing EAGLE_IMAGES…');
  const res = await gas('sheets_replace_tab', {
    sheet_id: SHEET_ID,
    tab: 'EAGLE_IMAGES',
    headers: HEADERS,
    rows,
  });
  console.log('[eagle] sheet:', JSON.stringify(res));

  const prev = await gas('eagle_set_previews', { sheet_id: SHEET_ID });
  console.log('[eagle] previews:', JSON.stringify(prev));

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
  console.log('[eagle] open:', sheetUrl);
  return sheetUrl;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});