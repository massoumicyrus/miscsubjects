#!/usr/bin/env node
/** Seed EAGLE_IMAGES with all 25 refs + 5 prior gens, named eagle01–eagle25. */
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SHEET_ID = '<GOOGLE_SHEET_ID>';
const AIRUNNER =
  'https://script.google.com/macros/s/AKfycby4GognkhohBYQmmxy0msYbElqdfW7yvZ4Wewia5RQKX62u4jVj7rLXdPF0JvHGbmR4kQ/exec';
const BASE = 'https://miscsubjects.com';

const PROMPT =
  'Use the peptide vial in the reference image. Redesign a similar image, less risky for Meta ads — remove or soften anything that might flag as peptide, drug, injection, syringe, or medical product. Keep it clean and brand-safe.';

const PRIOR_916 = {
  eagle01: 'https://miscsubjects.com/img/gen/openai-7fd38180-56ff-45de-95da-4dcf74143b7f.png',
  eagle02: 'https://miscsubjects.com/img/gen/openai-56649787-3061-4c84-a7a1-cf3b63ba3255.png',
  eagle03: 'https://miscsubjects.com/img/gen/openai-3d00ea97-a0ad-4e25-94c1-a8564fd781db.png',
  eagle04: 'https://miscsubjects.com/img/gen/openai-48b4e693-15a8-45ae-86dc-1433600e9671.png',
  eagle05: 'https://miscsubjects.com/img/gen/openai-39c6e318-e9e4-4c85-bb9a-efb1981baa5f.png',
};

const HEADERS = [
  'name', 'source_preview', 'ref_url', 'variation_prompt',
  'preview_916', 'url_916', 'good_916',
  'preview_1x1', 'url_1x1', 'good_1x1', 'status',
];

async function gas(action, args = {}) {
  const r = await fetch(AIRUNNER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args }),
    redirect: 'follow',
  });
  return JSON.parse(await r.text());
}

const rows = [];
for (let n = 1; n <= 25; n++) {
  const name = `eagle${String(n).padStart(2, '0')}`;
  const refNum = n;
  rows.push([
    name,
    '',
    `${BASE}/img/up/eagle${refNum}.png`,
    PROMPT,
    '',
    PRIOR_916[name] || '',
    '',
    '',
    '',
    '',
    PRIOR_916[name] ? 'v0 gen (wrong aspect) — regen pending' : 'pending',
  ]);
}

const res = await gas('sheets_replace_tab', {
  sheet_id: SHEET_ID,
  tab: 'EAGLE_IMAGES',
  headers: HEADERS,
  rows,
});
console.log(JSON.stringify(res));
await gas('eagle_set_previews', { sheet_id: SHEET_ID, tab: 'EAGLE_IMAGES' });
console.log('previews set');