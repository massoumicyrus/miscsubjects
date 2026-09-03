#!/usr/bin/env node
/**
 * Eagle workflow from iMessage / Pepper / ROUTER.
 * Usage: node scripts/eagle_imessage.mjs "<message>"
 *
 * Commands:
 *   show eagles | list eagles     — text image previews for all synced eagles
 *   eagle3 good <what> [prompt]   — mark good + notes
 *   generate eagle3 | generate all — GPT variation(s)
 *   open sheet                    — return sheet URL
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
    headers: { 'x-terminal-key': terminalKey(), 'content-type': 'application/json' },
    body: JSON.stringify({ key, body }),
  });
  const j = await r.json();
  let raw = j.result ?? j;
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

async function textImage(caption, url) {
  await dispatch('SEND_IMAGE_BLOOIO', `${PHONE}|${caption}|${url}`);
}

async function getRows() {
  const got = await gas('eagle_get_rows', {});
  if (got.ok && got.rows) return got;
  const legacy = await gas('sheets_get', { sheet_id: SHEET_ID, range: 'EAGLE_IMAGES!A1:L100' });
  const values = legacy.values || [];
  if (values.length < 2) return { ok: true, rows: [], sheet_url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit` };
  const head = values[0];
  const rows = values.slice(1).map((row) => {
    const o = {};
    head.forEach((h, i) => {
      o[h] = row[i];
    });
    return o;
  });
  return { ok: true, rows, sheet_url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit` };
}

async function updateRow(name, patch) {
  try {
    return await gas('eagle_update_row', { name, ...patch });
  } catch {
    return { ok: false };
  }
}

async function generateOne(row) {
  const ref = String(row.ref_url || '').trim();
  if (!ref) throw new Error(`${row.name}: no ref_url`);
  let prompt = String(row.variation_prompt || '').trim();
  const what = String(row.what_it_is || '').trim();
  if (what) prompt = `${what}. ${prompt}`;
  const out = await dispatch('OPENAI_IMAGE_EDIT', `${prompt}|${ref}|1024x1024`);
  const url = typeof out === 'object' && out.url ? out.url : String(out);
  if (url.indexOf('http') !== 0) throw new Error(url.slice(0, 200));
  await updateRow(row.name, { gen_url: url, status: 'done' });
  await textImage(`${row.name} variation`, url);
  return url;
}

function parseEagleGood(msg) {
  const m = msg.match(/\b(eagle\d+)\s+good\b\s*(.*)/i);
  if (!m) return null;
  const rest = m[2].trim();
  const parts = rest.split(/\s+prompt\s+/i);
  return {
    name: m[1].toLowerCase(),
    what: parts[0]?.trim() || '',
    prompt: parts[1]?.trim() || '',
  };
}

async function main() {
  const msg = (process.argv.slice(2).join(' ') || '').trim();
  if (!msg) {
    await text('Eagle commands: show eagles | eagle3 good <what> prompt <...> | generate eagle3 | generate all | open sheet');
    return;
  }

  const lower = msg.toLowerCase();

  if (/open\s+sheet/.test(lower)) {
    const got = await getRows();
    await text(`Eagle sheet: ${got.sheet_url}`);
    return;
  }

  if (/^(show|list)\s+eagles?/.test(lower) || lower === 'eagles') {
    const got = await getRows();
    const synced = got.rows.filter((r) => r.ref_url);
    if (!synced.length) {
      await text('No eagles synced yet. Run eagle sync first.');
      return;
    }
    await text(`Eagle previews (${synced.length}). Sheet: ${got.sheet_url}`);
    for (const row of synced.slice(0, 25)) {
      await textImage(`${row.name}${row.good === 'y' ? ' ✓' : ''}`, row.ref_url);
    }
    return;
  }

  const genAll = /\bgenerate\s+all\b/.test(lower);
  const genOne = msg.match(/\bgenerate\s+(eagle\d+)\b/i);
  if (genAll || genOne) {
    const got = await getRows();
    let targets = got.rows.filter((r) => r.good === 'y' && r.ref_url);
    if (genOne) targets = targets.filter((r) => r.name === genOne[1].toLowerCase());
    if (!targets.length) {
      await text('No good=y eagles with ref_url. Say: eagle3 good <what it is>');
      return;
    }
    await text(`Generating ${targets.length} variation(s)…`);
    let ok = 0;
    for (const row of targets) {
      try {
        await generateOne(row);
        ok++;
      } catch (e) {
        await text(`${row.name} failed: ${String(e).slice(0, 100)}`);
      }
    }
    await text(`Done: ${ok}/${targets.length} variations. Sheet: ${got.sheet_url}`);
    try {
      await gas('eagle_set_previews', { sheet_id: SHEET_ID });
    } catch {}
    return;
  }

  const good = parseEagleGood(msg);
  if (good) {
    const patch = { good: 'y', what_it_is: good.what, run: 'x' };
    if (good.prompt) patch.variation_prompt = good.prompt;
    const res = await updateRow(good.name, patch);
    if (res.ok) {
      await text(`Got ${good.name} as good. Text "generate ${good.name}" when ready.`);
    } else {
      const got = await getRows();
      const row = got.rows.find((r) => r.name === good.name);
      if (row?.ref_url) {
        await text(`${good.name} noted (sheet row update pending clasp push). generate ${good.name} still works.`);
      } else {
        await text(`Unknown ${good.name} — run eagle sync first.`);
      }
    }
    return;
  }

  const mark = msg.match(/\b(eagle\d+)\b/i);
  if (mark) {
    await text(`For ${mark[1]}: say "${mark[1]} good <what the image is>" or "generate ${mark[1]}". Sheet: https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`);
    const got = await getRows();
    const row = got.rows.find((r) => r.name === mark[1].toLowerCase());
    if (row?.ref_url) await textImage(mark[1], row.ref_url);
    return;
  }

  await text('Eagle help: show eagles | eagle5 good fierce landing golden hour | generate eagle5 | generate all');
}

main().catch(async (e) => {
  console.error(e);
  try {
    await text(`eagle error: ${String(e).slice(0, 120)}`);
  } catch {}
  process.exit(1);
});