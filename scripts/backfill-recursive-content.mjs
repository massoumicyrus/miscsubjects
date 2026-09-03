#!/usr/bin/env node
// Losslessly wrap every published article through the guarded Recursive Content API.
// No direct SQL: the same service used by the owner UI owns import IDs, versions, and receipts.

const base = String(process.env.MS_BASE || 'https://miscsubjects.com').replace(/\/$/, '');
const key = String(process.env.TERMINAL_KEY || '');
const limit = Math.min(Math.max(Number(process.env.BACKFILL_BATCH || 50), 1), 100);
if (!key) throw new Error('TERMINAL_KEY is required');

let cursor = '';
let processed = 0;
let changed = 0;
let failed = 0;

for (;;) {
  const response = await fetch(`${base}/api/blocks/backfill`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-terminal-key': key },
    body: JSON.stringify({ cursor, limit }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`backfill HTTP ${response.status}: ${result.error || 'unknown error'}`);
  for (const row of result.results || []) {
    processed++;
    if (!row.ok) failed++;
    else if (!row.idempotent) changed++;
  }
  process.stdout.write(`\rprocessed ${processed} · wrapped ${changed} · failed ${failed}`);
  if (result.done || !result.next_cursor) break;
  cursor = result.next_cursor;
}

process.stdout.write('\n');
if (failed) process.exitCode = 1;
