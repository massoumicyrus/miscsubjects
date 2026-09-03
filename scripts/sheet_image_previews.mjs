#!/usr/bin/env node
/**
 * Set =IMAGE() preview formulas on EAGLE_IMAGES (source + generated columns).
 */
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SHEET_ID = '<GOOGLE_SHEET_ID>';
const TAB = 'EAGLE_IMAGES';

function claspTokens() {
  return JSON.parse(readFileSync(join(homedir(), '.clasprc.json'), 'utf8')).tokens.default;
}

async function accessToken() {
  const t = claspTokens();
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: t.client_id,
      client_secret: t.client_secret,
      refresh_token: t.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('oauth refresh failed: ' + JSON.stringify(j));
  return j.access_token;
}

async function sheets(path, opts = {}, token) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`, {
    ...opts,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`sheets ${path}: ${r.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

function imgFormula(url) {
  if (!url || !String(url).startsWith('http')) return '';
  return `=IMAGE("${String(url).replace(/"/g, '')}",1)`;
}

async function main() {
  const token = await accessToken();
  const meta = await sheets('', {}, token);
  const sh = meta.sheets?.find((s) => s.properties.title === TAB);
  if (!sh) throw new Error(`tab ${TAB} not found`);
  const sheetId = sh.properties.sheetId;

  const vals = await sheets(`/values/${encodeURIComponent(TAB + '!A1:L100')}`, {}, token);
  const rows = vals.values || [];
  if (rows.length < 2) {
    console.log('no data rows');
    return;
  }

  const head = rows[0].map((h) => String(h).trim());
  const col = (name) => head.indexOf(name);
  const refI = col('ref_url');
  const genI = col('gen_url');
  let srcI = col('source_preview');
  let genPrevI = col('gen_preview');

  // Ensure preview columns exist
  if (srcI < 0 || genPrevI < 0) {
    const newHead = [...head];
    if (srcI < 0) {
      const refPos = col('ref_url');
      newHead.splice(refPos >= 0 ? refPos : 1, 0, 'source_preview');
      srcI = refPos >= 0 ? refPos : 1;
    }
    if (genPrevI < 0) {
      const genPos = col('gen_url');
      const pos = genPos >= 0 ? genPos : newHead.length;
      newHead.splice(pos, 0, 'gen_preview');
      genPrevI = pos;
    }
    await sheets('/values:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [{ range: `${TAB}!A1`, values: [newHead] }],
      }),
    }, token);
    const refreshed = await sheets(`/values/${encodeURIComponent(TAB + '!A1:L100')}`, {}, token);
    rows.splice(0, rows.length, ...(refreshed.values || []));
    head.length = 0;
    head.push(...rows[0].map((h) => String(h).trim()));
  }

  const data = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const ref = refI >= 0 ? String(row[refI] || '').trim() : '';
    const gen = genI >= 0 ? String(row[genI] || '').trim() : '';
    if (ref) {
      data.push({
        range: `${TAB}!${colLetter(srcI)}${r + 1}`,
        values: [[imgFormula(ref)]],
      });
    }
    if (gen) {
      data.push({
        range: `${TAB}!${colLetter(genPrevI)}${r + 1}`,
        values: [[imgFormula(gen)]],
      });
    }
  }

  if (data.length) {
    await sheets('/values:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
    }, token);
    console.log(`set ${data.length} preview formula(s)`);
  }

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: rows.length },
            properties: { pixelSize: 140 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: srcI, endIndex: srcI + 1 },
            properties: { pixelSize: 160 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: genPrevI, endIndex: genPrevI + 1 },
            properties: { pixelSize: 160 },
            fields: 'pixelSize',
          },
        },
      ],
    }),
  });

  console.log('done');
}

function colLetter(i) {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});