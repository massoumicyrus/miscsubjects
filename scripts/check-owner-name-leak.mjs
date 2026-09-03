#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const FORBIDDEN = /\b(the owner|[OWNER_SURNAME]|[OWNER_HANDLE])\b/gi;
const PRODUCTION_ORIGIN = 'https://miscsubjects.com';

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const s = statSync(path);
    if (s.isDirectory()) {
      walk(path, files);
    } else if (s.isFile()) {
      files.push(path);
    }
  }
  return files;
}

function localFiles() {
  const globs = [
    '.claude/skills/**/SKILL.md',
    '.agents/skills/**/SKILL.md',
    'docs/superpowers/**/*.md',
  ];
  const files = [];
  for (const pattern of globs) {
    const [base, ...rest] = pattern.split('/');
    const recurse = (dir, segs) => {
      if (!segs.length) return;
      const [seg, ...next] = segs;
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        const s = statSync(path);
        if (seg === '**') {
          if (s.isDirectory()) recurse(path, segs);
          else if (next.length === 0 && entry === 'SKILL.md') files.push(path);
          else if (next.length === 0 && entry.endsWith('.md')) files.push(path);
        } else if (seg === '*.md') {
          if (s.isFile() && entry.endsWith('.md')) files.push(path);
        } else if (seg === entry) {
          if (next.length === 0) {
            if (s.isFile()) files.push(path);
          } else if (s.isDirectory()) {
            recurse(path, next);
          }
        }
      }
    };
    recurse(join(ROOT, base), rest);
  }
  return [...new Set(files)];
}

const failures = [];

for (const path of localFiles()) {
  const text = readFileSync(path, 'utf8');
  const rel = path.replace(ROOT + '/', '');
  for (const match of text.matchAll(FORBIDDEN)) {
    const line = text.slice(0, match.index).split('\n').length;
    failures.push({ where: rel, line, match: match[0] });
  }
}

const productionUrls = [
  '/a/skill-shared-write-law',
  '/a/skill-shared-rule-capture',
  '/a/skill-the owner-write-law',
  '/a/skill-the owner-rule-capture',
];

for (const path of productionUrls) {
  try {
    const res = await fetch(PRODUCTION_ORIGIN + path);
    const text = await res.text();
    if (FORBIDDEN.test(text)) {
      failures.push({ where: PRODUCTION_ORIGIN + path, line: 0, match: 'owner name in rendered HTML' });
    }
  } catch (e) {
    failures.push({ where: PRODUCTION_ORIGIN + path, line: 0, match: 'fetch failed: ' + e.message });
  }
}

// OWNER PRIVACY BAR — these public endpoints must NEVER expose the owner's identity, inputs, machine
// paths, or private CLI turns. A deploy that reintroduces a leak here fails the gate.
const LEAK_TOKENS = /\bOWNER_FIRST_NAME\b|[OWNER_SURNAME]|[OWNER_HANDLE]|\/Users\/|\/home\/user|claude-code|"turn_in"|"turn_out"|CLI_CLAUDE_CODE|agent_turns|user_input|input_kind|[OWNER_MACHINE]|JNEVER|LOOKS LIKE TRASH|turn_key/i;
const privacyUrls = [
  '/api/articles/the-canonical-morgh-index/ledger',
  '/api/ledger?format=json&limit=50',
  '/blooio?inbound=1',
  '/blooio?data=1',
  // Admin-gate bypass regressions: case-variant and double-slash paths must NOT serve owner data.
  '/ADMIN/ledger?data=1',
  '//admin/ledger?data=1',
  '/admin/./ledger?data=1',
];
for (const path of privacyUrls) {
  try {
    const res = await fetch(PRODUCTION_ORIGIN + path);
    const text = await res.text();
    if (LEAK_TOKENS.test(text)) {
      failures.push({ where: PRODUCTION_ORIGIN + path, line: 0, match: 'OWNER PRIVACY LEAK: identity/input/path/CLI-turn in public response' });
    }
  } catch (e) {
    failures.push({ where: PRODUCTION_ORIGIN + path, line: 0, match: 'privacy probe fetch failed: ' + e.message });
  }
}

// WHOLE-CORPUS SCAN (owner order 2026-08-03 — the fixed URL list above missed 17 live
// articles carrying the name; a sample is not a gate). Scan the ENTIRE stored corpus for
// identity tokens via the remote database. Any stored hit fails the deploy: content must
// never store the identity, independent of the egress scrubber.
const IDENTITY_SQL = "SELECT slug FROM articles WHERE lower(body) LIKE '%the owner%' OR lower(meta) LIKE '%the owner%' OR lower(body) LIKE '%[OWNER_SURNAME]%' OR lower(meta) LIKE '%[OWNER_SURNAME]%' OR lower(body) LIKE '%dsco.co%' OR lower(meta) LIKE '%dsco.co%' OR lower(body) LIKE '%theloopway%' OR lower(meta) LIKE '%theloopway%' OR body LIKE '%[OWNER_PHONE]%' OR meta LIKE '%[OWNER_PHONE]%' OR body LIKE '%Metric Marketing%' OR meta LIKE '%Metric Marketing%' LIMIT 20";
if (process.env.GITHUB_ACTIONS) {
  // CI has no Cloudflare auth: the remote corpus scan runs only on the owner's machine,
  // where every deploy actually originates (ship.mjs). CI still runs the URL probes below.
  console.error(JSON.stringify({ note: 'corpus D1 identity scan skipped in CI (no Cloudflare auth); runs on every owner-side deploy' }));
} else {
  const { spawnSync } = await import('node:child_process');
  const scanEnv = { ...process.env };
  delete scanEnv.CLOUDFLARE_API_TOKEN; delete scanEnv.CF_API_TOKEN; delete scanEnv.CF_TOKEN;
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'loop-content-spine', '--remote', '--json', '--command', IDENTITY_SQL], { cwd: ROOT, encoding: 'utf8', env: scanEnv, shell: process.platform === 'win32' });
  const raw = String(r.stdout || '');
  const jsonStart = raw.indexOf('[');
  const jsonEnd = raw.lastIndexOf(']');
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    failures.push({ where: 'd1:loop-content-spine', line: 0, match: 'corpus identity scan could not run: ' + (String(r.stderr || '').slice(0, 200) || 'no JSON output') });
  } else {
    try {
      // wrangler may append update notices after the JSON; take the outermost array only.
      const rows = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))?.[0]?.results || [];
      for (const row of rows) failures.push({ where: 'd1:articles/' + row.slug, line: 0, match: 'OWNER IDENTITY STORED IN LIVE CORPUS' });
    } catch (e) {
      failures.push({ where: 'd1:loop-content-spine', line: 0, match: 'corpus scan unparsable: ' + e.message });
    }
  }

  // LEDGER DATABASE SCAN (owner order 2026-08-04) — runs in the POST-PROMOTION phase only
  // (NAME_LAW_EGRESS=1): it proves the DEPLOYED ingest scrub holds on fresh rows. Running it
  // at commit time deadlocked: pre-fix rows blocked the very commit that fixed the writer.
  if (process.env.NAME_LAW_EGRESS === '1') {
  // (owner order 2026-08-04 — 11,223 ledger events carried the owner's
  // name because email sends log the owner BCC, GitHub webhooks log commit authorship, and
  // terminal mirrors log local paths; the corpus-only scan missed the entire lane). The
  // ingest scrub in public_secret_guard.js is the fix; this scan is the proof it holds.
  // Only NEW rows fail the gate (last 24h): the historical backfill was scrubbed 2026-08-04,
  // and a fresh hit means the ingest scrub regressed.
  const LEDGER_SQL = "SELECT id, key, source FROM events WHERE ts >= datetime('now','-1 day') AND (request_json LIKE '%[OWNER_SURNAME]%' OR response_json LIKE '%[OWNER_SURNAME]%' OR request_preview LIKE '%[OWNER_SURNAME]%' OR response_preview LIKE '%[OWNER_SURNAME]%' OR request_json LIKE '%the owner@dsco%' OR response_json LIKE '%the owner@dsco%' OR request_json LIKE '%the owner@theloopway%' OR response_json LIKE '%the owner@theloopway%' OR actor LIKE '%[OWNER_SURNAME]%' OR actor LIKE '%[OWNER_MACHINE]%') LIMIT 20";
  const lr = spawnSync('npx', ['wrangler', 'd1', 'execute', 'loop-shared-events', '--remote', '--json', '--command', LEDGER_SQL], { cwd: ROOT, encoding: 'utf8', env: scanEnv, shell: process.platform === 'win32' });
  const lraw = String(lr.stdout || '');
  const ls = lraw.indexOf('['); const le = lraw.lastIndexOf(']');
  if (ls < 0 || le <= ls) {
    failures.push({ where: 'd1:loop-shared-events', line: 0, match: 'ledger identity scan could not run: ' + (String(lr.stderr || '').slice(0, 200) || 'no JSON output') });
  } else {
    try {
      const rows = JSON.parse(lraw.slice(ls, le + 1))?.[0]?.results || [];
      for (const row of rows) failures.push({ where: 'd1:ledger/' + row.id, line: 0, match: 'OWNER IDENTITY IN FRESH LEDGER EVENT (' + row.source + '/' + row.key + ') — ingest scrub regressed' });
    } catch (e) {
      failures.push({ where: 'd1:loop-shared-events', line: 0, match: 'ledger scan unparsable: ' + e.message });
    }
  }

  // LIVE CREDENTIAL SCAN: the deploy fails if the CURRENT terminal key appears anywhere in
  // fresh ledger payloads (a leaked master credential is a page-one incident, not a warning).
  const liveKey = process.env.TERMINAL_KEY || '';
  if (liveKey.length >= 32) {
    const KEY_SQL = "SELECT id, key, source FROM events WHERE ts >= datetime('now','-1 day') AND (request_json LIKE '%" + liveKey + "%' OR response_json LIKE '%" + liveKey + "%') LIMIT 5";
    const kr = spawnSync('npx', ['wrangler', 'd1', 'execute', 'loop-shared-events', '--remote', '--json', '--command', KEY_SQL], { cwd: ROOT, encoding: 'utf8', env: scanEnv, shell: process.platform === 'win32' });
    const kraw = String(kr.stdout || '');
    const ks = kraw.indexOf('['); const ke = kraw.lastIndexOf(']');
    if (ks >= 0 && ke > ks) {
      try {
        const rows = JSON.parse(kraw.slice(ks, ke + 1))?.[0]?.results || [];
        for (const row of rows) failures.push({ where: 'd1:ledger/' + row.id, line: 0, match: 'LIVE TERMINAL KEY IN LEDGER PAYLOAD (' + row.source + '/' + row.key + ') — rotate immediately' });
      } catch { /* key scan best-effort; identity scan above is unconditional */ }
    }
  }
  }
}

// EGRESS PROBES — surfaces that leaked on 2026-08-03 plus the machine views models read.
// The middleware identity scrubber must hold on every one of these. These probes assert on
// the DEPLOYED code, so they run post-deploy (ship.mjs sets NAME_LAW_EGRESS=1 after the
// Functions bundle is live); pre-deploy they are skipped — the corpus scan above still
// guards stored content unconditionally.
const egressProbes = process.env.NAME_LAW_EGRESS !== '1' ? [] : [
  '/a/the-build-end-to-end',
  '/a/claude-code-on-cloudflare-ai-gateway',
  '/a/outreach-machinery',
  '/api/articles/mcp-as-a-projection',
  '/api/articles/tooling-as-data/bundle?format=markdown',
  '/api/directory/CLI_GH',
  '/a/directory/CLI_CLAUDE_CODE',
  '/api/workspace/ad-operations-q3',
  '/api/workspace',
];
const IDENTITY_EGRESS = /the owner|[OWNER_SURNAME]|dsco\.co|theloopway|[OWNER_PHONE]|metric marketing/i;
for (const path of egressProbes) {
  try {
    const res = await fetch(PRODUCTION_ORIGIN + path);
    const text = await res.text();
    const m = text.match(IDENTITY_EGRESS);
    if (m) failures.push({ where: PRODUCTION_ORIGIN + path, line: 0, match: 'OWNER IDENTITY IN PUBLIC EGRESS: ' + m[0] });
  } catch (e) {
    failures.push({ where: PRODUCTION_ORIGIN + path, line: 0, match: 'egress probe fetch failed: ' + e.message });
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, law: 'NAME_LAW', failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, law: 'NAME_LAW', checked: productionUrls.length + ' name URLs + ' + privacyUrls.length + ' privacy URLs + full-corpus D1 identity scan + ' + egressProbes.length + ' egress probes, local skill/docs files' }));
