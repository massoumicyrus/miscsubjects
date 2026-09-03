#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../functions/admin/ledger/index.js', import.meta.url), 'utf8');
const active = source.match(/\.vbig\.on,\.svc-filter\.on,[\s\S]*?\n\}/)?.[0] || '';
const children = source.match(/\.vbig\.on \.vt,[\s\S]*?\n/)?.[0] || '';
const failed = [];
if (!active.includes('background:var(--accent)!important')) failed.push('ACTIVE_BACKGROUND_MISSING');
if (!active.includes('color:#fff!important')) failed.push('ACTIVE_TEXT_NOT_WHITE');
if (!children.includes('color:#fff!important')) failed.push('ACTIVE_CHILD_TEXT_NOT_WHITE');
if (/color:#090c10!important/.test(active + children)) failed.push('BLACK_TEXT_ON_BLACK_ACTIVE_CONTROL');
if (failed.length) { console.error(JSON.stringify({ ok: false, failed })); process.exit(1); }
console.log(JSON.stringify({ ok: true, active_background: 'black', active_text: 'white', surfaces: ['ledger-view','service-filter','download-format'] }));
