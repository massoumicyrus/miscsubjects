#!/usr/bin/env node
/** Seed GA + verify lbl viewer after D1 recreate. */
const KEY = process.env.TERMINAL_KEY || process.env.MISC;
if (!KEY) { console.error('TERMINAL_KEY required'); process.exit(1); }
const H = { 'content-type': 'application/json', 'x-terminal-key': KEY };
const BASE = 'https://miscsubjects.com';

await fetch(`${BASE}/api/settings/ga_measurement_id`, {
  method: 'PUT', headers: H,
  body: JSON.stringify({
    value: 'G-TTCENZ3CJY',
    description: 'GA4 measurement ID — miscsubjects + leoresearch funnel (from leoresearch.com/shop)',
  }),
}).then((r) => console.log('ga_measurement_id', r.status));

const probe = await fetch(`${BASE}/a/bpc-157`).then((r) => r.text());
console.log('live_ga', probe.includes('G-TTCENZ3CJY') ? 'YES' : 'NO');
console.log('gtag_script', probe.includes('googletagmanager.com/gtag') ? 'YES' : 'NO');

const lbl = await fetch(`${BASE}/api/marketing/cloaker?limit=3`, { headers: H }).then((r) => r.json().catch(() => ({})));
console.log('lbl_cloaker', lbl.error || `rows:${(lbl.rows || []).length}`);

console.log('done');