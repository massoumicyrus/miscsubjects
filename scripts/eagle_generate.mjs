#!/usr/bin/env node
/**
 * Read EAGLE_IMAGES sheet; for rows with good=y and run=x, OPENAI_IMAGE_EDIT + update sheet + text the owner.
 */
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SHEET_ID = '<GOOGLE_SHEET_ID>';
const AIRUNNER =
  'https://script.google.com/macros/s/AKfycby4GognkhohBYQmmxy0msYbElqdfW7yvZ4Wewia5RQKX62u4jVj7rLXdPF0JvHGbmR4kQ/exec';
const BASE = 'https://miscsubjects.com';
const PHONE = '[OWNER_PHONE]';

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

async function text(msg) {
  await dispatch('SEND_BY_CHANNEL', `blooio|${PHONE}|${msg}`);
}

async function main() {
  const got = await gas('sheets_get', { sheet_id: SHEET_ID, range: 'EAGLE_IMAGES!A1:L100' });
  const values = got.values || [];
  if (values.length < 2) {
    console.log('no rows');
    return;
  }
  const head = values[0];
  const idx = Object.fromEntries(head.map((h, i) => [h, i]));
  let n = 0;

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[idx.run] || '').toLowerCase() !== 'x') continue;
    if (String(row[idx.good] || '').toLowerCase() !== 'y') continue;
    const name = row[idx.name];
    const ref = String(row[idx.ref_url] || '').trim();
    if (!ref) continue;
    let prompt = String(row[idx.variation_prompt] || '').trim();
    const what = String(row[idx.what_it_is] || '').trim();
    if (what) prompt = `${what}. ${prompt}`;

    console.log(`[gen] ${name}…`);
    const out = await dispatch('OPENAI_IMAGE_EDIT', `${prompt}|${ref}|1024x1024`);
    const url = typeof out === 'object' && out.url ? out.url : String(out);
    row[idx.gen_url] = url.indexOf('http') === 0 ? url : '';
    row[idx.status] = url.indexOf('http') === 0 ? 'done' : String(url).slice(0, 200);
    row[idx.run] = '';
    if (url.indexOf('http') === 0) {
      await text(`${name} variation: ${url}`);
      n++;
    }
    values[r] = row;
  }

  if (n > 0) {
    await gas('sheets_replace_tab', {
      sheet_id: SHEET_ID,
      tab: 'EAGLE_IMAGES',
      headers: values[0],
      rows: values.slice(1),
    });
  }
  console.log(`[gen] ${n} variation(s)`);
  if (n === 0) await text('No eagle rows flagged (need good=y and run=x in EAGLE_IMAGES).');
}

main().catch(async (e) => {
  console.error(e);
  try {
    await text(`eagle generate error: ${String(e).slice(0, 120)}`);
  } catch {}
  process.exit(1);
});