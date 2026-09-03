#!/usr/bin/env node
// OWNER_DESTINATION_LAW — mail goes to an address the owner named. Never to one the build chose.
//
// Owner, 2026-08-05, verbatim: "WHERE DID I EVER ASK TO BE SENT ANYTHING TO MY GMAIL" and "YOU KEEP
// HALLUCINATING THAT YOU HAVE AUTHORITY TO DO THINGS OTHER THAN WHAT WAS ASKED".
//
// What happened: he asked, repeatedly, to be sent something. It never arrived, because his address had
// stopped resolving. Instead of reporting that one fact, the build reached for addresses he had never
// given — [REDACTED_EMAIL], because it was verified and convenient — and treated "he receives
// it somewhere" as equivalent to "he receives it where he asked". It is not. Choosing the destination
// was never delegated. A convenient substitute is still a substitute.
//
// Earlier the same day, the same reflex produced the worse version: [OWNER_EMAIL] was invented as a
// one-character "correction" of his real address and added as a Cloudflare destination on a guess.
//
// The law: every owner destination that appears in a delivery path must be listed in
// owner-addresses.json, which records addresses THE OWNER HIMSELF NAMED and where he named them. Adding
// an address to that file is an assertion that he asked for it. Nothing else may be a destination —
// not an address that is merely verified, merely resolving, or merely handy.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const failures = [];

const roster = JSON.parse(readFileSync(ROOT + '/owner-addresses.json', 'utf8'));
const named = new Set(Object.keys(roster.owner_named || {}).map((a) => a.toLowerCase()));
if (named.size === 0) failures.push('owner-addresses.json names no owner address — this check would pass vacuously');

// Every entry has to say where he named it, or the file becomes a place to launder invented addresses.
for (const [addr, cfg] of Object.entries(roster.owner_named || {})) {
  if (!String(cfg?.owner_said || '').trim()) failures.push(`${addr} is listed as owner-named but records no owner_said — say where he named it`);
}

// Walk the delivery paths and collect every literal owner-ish address in code.
const SCAN = ['functions', 'workers', 'scripts'];
const files = [];
function walk(dir) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.git') continue;
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p);
    else if (/\.(js|mjs)$/.test(e)) files.push(p);
  }
}
for (const d of SCAN) walk(join(ROOT, d));

// "the owner" or "owner" at any domain, plus the owner's known personal mailboxes.
const OWNERISH = /\b(?:the owner|owner|[OWNER_SURNAME][._]the owner)[A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;

// Only DELIVERY paths are in scope. An owner address can legitimately appear as an identity rather than
// a destination — check-write-law.mjs lists the owner's git committer emails, and route tests use
// owner@example.com as a fixture. Flagging those would train the next agent to silence this gate instead
// of obeying it, so scope it to files that actually touch a mail primitive, and skip reserved test
// domains and test files outright.
const DELIVERS = /EMAIL\.send|message\.forward|\/email\/send|OWNER_BCC|EMAIL_FORWARD|sendByChannel|notifyOwner|NOTIFY_OWNER|injectOwnerBcc|EMAIL_SEND/;
const RESERVED = /@(?:example\.(?:com|org|net|test)|test|invalid|local|localhost)$/i;
const found = new Map();
for (const f of new Set(files)) {
  if (/\.test\.mjs$/.test(f)) continue;
  const src = readFileSync(f, 'utf8');
  if (!DELIVERS.test(src)) continue;
  for (const line of src.split('\n')) {
    // A commented line is documentation, not a destination. Only live code binds an address.
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of code.matchAll(OWNERISH)) {
      const addr = m[0].toLowerCase();
      if (RESERVED.test(addr)) continue;
      if (!found.has(addr)) found.set(addr, []);
      found.get(addr).push(f.replace(ROOT + '/', ''));
    }
  }
}

const scanned = found.size;
for (const [addr, where] of found) {
  if (!named.has(addr)) {
    failures.push(`${addr} is used as an owner destination in ${[...new Set(where)].slice(0, 4).join(', ')} but the owner never named it. Either he asked for it — then add it to owner-addresses.json with owner_said — or remove it. A verified, resolving or convenient address is not a permitted substitute.`);
  }
}

if (scanned === 0) failures.push('found 0 owner addresses in functions/, workers/ or scripts/ — the scan is broken, not clean');

if (failures.length) {
  console.error(JSON.stringify({ ok: false, law: 'OWNER_DESTINATION_LAW', addresses_found: scanned, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true, law: 'OWNER_DESTINATION_LAW',
  addresses_found: scanned, owner_named: [...named],
  checked: 'every owner address bound in functions/, workers/ and scripts/ was named by the owner himself',
}));
