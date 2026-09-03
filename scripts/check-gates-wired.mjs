#!/usr/bin/env node
// GATES_ARE_WIRED — a law expressed as a gate that nobody runs is not enforcement, it is a comment.
//
// Found 2026-08-05: 20 of 31 scripts/check-*.mjs were never invoked by ship.mjs or by CI. Among them
// was check-owner-bcc.mjs, so the commit that changed the owner's address and said "the gate asserts
// the new list and passes" was describing a gate that had never run on a single deploy. And
// check-receipt-adoption.mjs had been throwing ERR_ASSERTION on a field that was deliberately removed
// — it crashed instead of checking, and nothing noticed, because it never ran either.
//
// This gate closes the whole class. Every check-*.mjs on disk must appear in scripts/gates.manifest.json
// with a phase. ship.mjs runs the pre and post phases straight out of that manifest, so listing a gate
// is what invokes it — the wiring cannot drift from the declaration. Gates that ship.mjs still calls by
// name (they need special env or ordering) are marked invoked_inline and this gate verifies that literal
// call is still present in ship.mjs.
import { readFileSync, readdirSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const failures = [];

const manifest = JSON.parse(readFileSync(ROOT + '/scripts/gates.manifest.json', 'utf8'));
const declared = manifest.gates || {};
const ship = readFileSync(ROOT + '/scripts/ship.mjs', 'utf8');

const onDisk = readdirSync(ROOT + '/scripts').filter((f) => /^check-.*\.mjs$/.test(f)).sort();

// 1. Nothing on disk may be undeclared. This is the check that would have caught all 20.
for (const f of onDisk) {
  if (!declared[f]) failures.push(`${f} exists but is not in gates.manifest.json — it would never run. Add it with a phase (pre|post) or phase "exempt" plus a reason.`);
}

// 2. Nothing declared may be missing from disk — a stale entry makes the manifest lie about coverage.
for (const f of Object.keys(declared)) {
  if (!onDisk.includes(f)) failures.push(`gates.manifest.json declares ${f} but no such file exists`);
}

// 3. Every declaration needs a real phase; exempt must justify itself in writing.
const VALID = new Set(['pre', 'post', 'exempt']);
for (const [f, cfg] of Object.entries(declared)) {
  if (!VALID.has(cfg?.phase)) failures.push(`${f} has phase ${JSON.stringify(cfg?.phase)}; must be one of pre, post, exempt`);
  if (cfg?.phase === 'exempt' && !String(cfg.reason || '').trim()) failures.push(`${f} is exempt from every deploy but gives no reason`);
}

// 4. An invoked_inline gate must still be called by name in ship.mjs. If someone deletes that call the
//    manifest would otherwise keep claiming the gate is enforced.
for (const [f, cfg] of Object.entries(declared)) {
  if (cfg?.invoked_inline && !ship.includes(f)) {
    failures.push(`${f} is marked invoked_inline but ship.mjs no longer mentions it — it is now unenforced`);
  }
}

// 5. ship.mjs must actually read this manifest and run both phases. Without that the manifest is
//    decoration and we are back to hand-wiring.
if (!ship.includes('gates.manifest.json')) failures.push('ship.mjs does not read scripts/gates.manifest.json — the manifest is not driving anything');
for (const phase of ['pre', 'post']) {
  if (!new RegExp(`runGatePhase\\(\\s*['"]${phase}['"]`).test(ship)) {
    failures.push(`ship.mjs never calls runGatePhase('${phase}') — every ${phase}-phase gate is unenforced`);
  }
}

const counts = { pre: 0, post: 0, exempt: 0 };
for (const cfg of Object.values(declared)) if (counts[cfg?.phase] !== undefined) counts[cfg.phase]++;
if (onDisk.length === 0) failures.push('examined 0 gate files — this check is broken, not passing');

if (failures.length) {
  console.error(JSON.stringify({ ok: false, law: 'GATES_ARE_WIRED', gates_on_disk: onDisk.length, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, law: 'GATES_ARE_WIRED', gates_on_disk: onDisk.length, declared: Object.keys(declared).length, by_phase: counts }));
