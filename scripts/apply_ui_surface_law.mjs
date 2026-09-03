#!/usr/bin/env node
/** Seed UI_SURFACE_PROBE + operator_surface_law setting + owner_rules ban. */
const KEY = process.env.TERMINAL_KEY || process.env.MISC;
if (!KEY) { console.error('TERMINAL_KEY required'); process.exit(1); }
const H = { 'content-type': 'application/json', 'x-terminal-key': KEY };
const BASE = 'https://miscsubjects.com';

async function postDirectory(row) {
  const r = await fetch(`${BASE}/api/directory`, { method: 'POST', headers: H, body: JSON.stringify(row) });
  console.log('POST', row.key, r.status, (await r.text()).slice(0, 160));
}

async function putSetting(key, value, description) {
  const r = await fetch(`${BASE}/api/settings/${key}`, {
    method: 'PUT', headers: H, body: JSON.stringify({ value, description }),
  });
  console.log('settings', key, r.status);
}

async function appendRule(kind, content, added_by = 'ui-surface-law') {
  const r = await fetch(`${BASE}/api/rules`, {
    method: 'POST', headers: H, body: JSON.stringify({ kind, content, added_by }),
  });
  console.log('rule', kind, r.status, (await r.text()).slice(0, 120));
}

const law = `OPERATOR SURFACE LAW — binding on every agent that ships or verifies UI.
1. Verified = what the operator sees in browser HTML at the live URL — not terminal-key curl alone.
2. Before claiming done on any user-visible page: run [UI_SURFACE_PROBE]path[/UI_SURFACE_PROBE] or fetch the live HTML without x-terminal-key; mismatch → not done.
3. Admin pages must SSR data the operator sees without waiting on client fetch; JS refresh is additive only.
4. Every marketing/meta/cloaker action writes to LEDGER source=marketing; ground truth is /admin/ledger?source=marketing.
5. Agent-only success (terminal key 200, operator 302/401/blank/loading) is a failure — report mismatch, do not claim ship.`;

await putSetting('operator_surface_law', law, 'Operator-visible HTML is ground truth for verification');

await postDirectory({
  key: 'UI_SURFACE_PROBE',
  type: 'fn',
  target: 'uiSurfaceProbe',
  auth: '',
  category: 'build',
  planner_rank: 5,
  enabled: 1,
  content: `# WHAT: Compare operator-visible fetch (no terminal key) vs agent fetch — ledgered mismatch flag.
# WHEN_TO_USE: Before claiming any admin page or live URL works; after deploy of user-visible UI.
# ARGS: $1=url path or full URL; optional $2=extra|markers|pipe|delimited
# EX: [UI_SURFACE_PROBE]/admin/marketing[/UI_SURFACE_PROBE]
# EX: [UI_SURFACE_PROBE]/api/marketing/accounts|11 accounts[/UI_SURFACE_PROBE]
["$1+"]`,
});

await appendRule('ban', 'Never claim a user-visible page or deploy is done without UI_SURFACE_PROBE or equivalent live HTML check without x-terminal-key. Terminal-key-only verification is not operator verification.');
await appendRule('preference', 'Marketing, Meta, lbl, and cloaker activity must land in LEDGER source=marketing. Operator reads /admin/marketing Ledger tab or /admin/ledger?source=marketing.');

console.log('done');