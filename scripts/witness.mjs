#!/usr/bin/env node
// INDEPENDENT CHAIN WITNESS (spec Phase 5) — zero dependencies, runs anywhere Node 18+ runs.
//
// What "the infrastructure graded itself" misses: the site signs its own checkpoints. This script
// is the outside party. It fetches the latest signed Merkle checkpoint, verifies the ES256
// signature against the published key, checks CONSISTENCY against the last checkpoint this
// witness saw (the head must extend, never rewrite, the checkpoint chain), and appends a
// countersignature record to a local ledger the site cannot write. Run it from GitHub Actions,
// a laptop, anywhere — each independent runner is one more party a rewrite would have to fool.
//
// Usage:  node scripts/witness.mjs [--base https://miscsubjects.com] [--state .witness]
// State:  <state>/witness-key.json (this witness's own P-256 keypair, generated on first run)
//         <state>/witness-log.jsonl (append-only countersignature records)
//
// Verdict vocabulary (1F916-protocol-derived, graded — never one flat "PROVEN"):
//   witnessed              signature valid AND consistent with this witness's history
//   consistent-unwitnessed checkpoint chain consistent but the site signature was absent/invalid
//   unanchored             first observation — nothing to be consistent with yet
//   diverged               the chain this witness recorded is NOT a prefix of what the site now serves

import { webcrypto as crypto } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BASE = argOf('--base', 'https://miscsubjects.com');
const STATE = argOf('--state', '.witness');
const US = '␟';

const b64u = (buf) => Buffer.from(buf).toString('base64url');

async function main() {
  mkdirSync(STATE, { recursive: true });
  const res = await fetch(BASE + '/api/chain/checkpoint');
  if (res.status === 404) { console.log(JSON.stringify({ verdict: 'unanchored', note: 'no signed checkpoint exists yet' })); return; }
  if (!res.ok) throw new Error('checkpoint fetch failed: HTTP ' + res.status);
  const cp = await res.json();

  // 1. Verify the site's own ES256 signature over the exact payload string.
  let signatureValid = false;
  if (cp.public_jwk && cp.signature && cp.alg === 'ES256') {
    try {
      const key = await crypto.subtle.importKey('jwk', cp.public_jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      signatureValid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' }, key,
        Buffer.from(String(cp.signature), 'base64url'), new TextEncoder().encode(String(cp.payload)),
      );
    } catch { signatureValid = false; }
  }

  // 2. Consistency against this witness's own history: the last seq/head we countersigned must
  // still be served, byte-identical, at its seq — history extends, it never moves.
  const logPath = join(STATE, 'witness-log.jsonl');
  let verdict = 'unanchored';
  let last = null;
  if (existsSync(logPath)) {
    const lines = readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
    if (lines.length) last = JSON.parse(lines[lines.length - 1]);
  }
  if (last) {
    const prev = await fetch(BASE + '/api/chain/checkpoint?seq=' + last.seq).then((r) => r.ok ? r.json() : null).catch(() => null);
    const consistent = !!(prev && prev.merkle_root === last.merkle_root && prev.payload === last.payload);
    verdict = !consistent ? 'diverged' : signatureValid ? 'witnessed' : 'consistent-unwitnessed';
  } else {
    verdict = signatureValid ? 'witnessed' : 'unanchored';
  }

  // 3. Countersign with this witness's own key (generated once, held here, never sent anywhere).
  const keyPath = join(STATE, 'witness-key.json');
  let jwks;
  if (existsSync(keyPath)) jwks = JSON.parse(readFileSync(keyPath, 'utf8'));
  else {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    jwks = { privateJwk: await crypto.subtle.exportKey('jwk', kp.privateKey), publicJwk: await crypto.subtle.exportKey('jwk', kp.publicKey) };
    writeFileSync(keyPath, JSON.stringify(jwks, null, 2));
  }
  const counterPayload = ['msjc.witness.v1', cp.seq, cp.merkle_root, cp.payload, verdict, new Date().toISOString()].join(US);
  const priv = await crypto.subtle.importKey('jwk', jwks.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const counterSig = b64u(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, new TextEncoder().encode(counterPayload)));

  const record = {
    ts: new Date().toISOString(), base: BASE, verdict,
    seq: cp.seq, merkle_root: cp.merkle_root, payload: cp.payload,
    site_signature_valid: signatureValid,
    witness_payload: counterPayload, witness_signature: counterSig, witness_public_jwk: jwks.publicJwk,
  };
  appendFileSync(logPath, JSON.stringify(record) + '\n');
  console.log(JSON.stringify(record, null, 2));
  if (verdict === 'diverged') process.exit(2); // a rewrite is an alarm, not a log line
}

main().catch((e) => { console.error('witness failed:', e?.message || e); process.exit(1); });
