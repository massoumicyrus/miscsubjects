#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { hostname } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { PROTOCOL_LAWS } from '../functions/_lib/protocol_laws.js';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const MIGRATIONS = join(ROOT, 'migrations');
const KV_NAMESPACE_ID = '58b303e666a8431685624e0cfd2fd63f';
const DEPLOY_LOCK_KEY = 'locks:deploy:miscsubjects-pages';
const LOCK_TTL_SECONDS = 1800;
const env = { ...process.env };
delete env.CLOUDFLARE_API_TOKEN;
delete env.CF_API_TOKEN;
delete env.CF_TOKEN;

if (!env.TERMINAL_KEY) {
  try {
    const vault = readFileSync(join(process.env.HOME || '', '.build-vault.env'), 'utf8');
    const line = vault.split('\n').find((l) => /^\s*(export\s+)?TERMINAL_KEY=/.test(l));
    if (line) {
      const value = line.replace(/^\s*(export\s+)?TERMINAL_KEY=/, '').trim().replace(/^['"]|['"]$/g, '');
      if (value) env.TERMINAL_KEY = value;
    }
  } catch { /* no vault on this machine: the gate will refuse loudly, which is correct */ }
}

function run(cmd, args, cwd = ROOT) {
  console.log('$ ' + [cmd, ...args].join(' '));
  const r = spawnSync(cmd, args, { cwd, env, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} failed with status ${r.status || 1}`);
}

function runCapture(cmd, args, cwd = ROOT) {
  const r = spawnSync(cmd, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    ok: r.status === 0,
    status: r.status || 0,
    stdout: String(r.stdout || '').trim(),
    stderr: String(r.stderr || '').trim(),
  };
}

function gateManifest() {
  return JSON.parse(readFileSync(join(ROOT, 'scripts', 'gates.manifest.json'), 'utf8')).gates || {};
}

function runGatePhase(phase) {
  const gates = gateManifest();
  // invoked_inline gates are called by name elsewhere in this file because they need special env or
  // ordering; running them again here would just double the work.
  const names = Object.entries(gates)
    .filter(([, cfg]) => cfg?.phase === phase && !cfg?.invoked_inline)
    .map(([name]) => name)
    .sort();
  console.log(`— ${phase}-phase gates from manifest: ${names.length} to run`);
  const failed = [];
  // D1 answers 7429 "requests queued for too long" when the suite's own reads stack up, and a
  // gate that cannot read its subject prints its content-violation message anyway — a rate
  // limit arriving as "an article is written in encyclopedia register" sent this deploy chasing
  // prose that was never wrong. Backpressure is retried; every other failure stands on the
  // first run, so nothing about what a gate measures is relaxed here.
  const isBackpressure = (text) => /D1 DB is overloaded|Requests queued for too long|code: 7429|\b429\b/i.test(text);
  // Exit 2 is the shared "could not read my subject" code (scripts/_lib/backpressure.mjs). It is
  // the structured form of the same condition isBackpressure sniffs out of the text, so it is
  // retried the same way — and if it survives the retries it is reported as an unread subject,
  // never as a finding. A gate that could not measure still blocks: silence is not a pass.
  const runGate = (name) => {
    for (let attempt = 1; ; attempt += 1) {
      const r = spawnSync(process.execPath, [join('scripts', name)], { cwd: ROOT, env, encoding: 'utf8' });
      const out = ((r.stdout || '') + (r.stderr || '')).trim();
      const transient = r.status === 2 || isBackpressure(out);
      if (r.status === 0 || attempt >= 3 || !transient) return { r, out, attempts: attempt };
      console.log(`  …    ${name} could not read its subject, re-reading (attempt ${attempt + 1}/3)`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 20000);
    }
  };
  const unread = [];
  for (const name of names) {
    const { r, out, attempts } = runGate(name);
    if (r.status === 2) {
      unread.push(name);
      console.error(`  UNREAD ${name} — could not read its subject in 3 tries; nothing was audited and nothing has been judged\n${out}`);
    } else if (r.status === 0) {
      console.log(`  ok   ${name}${attempts > 1 ? ` (read on attempt ${attempts})` : ''}`);
    } else {
      // A gate that crashes is a gate that failed. It is never a pass and never a skip — that is exactly
      // how check-receipt-adoption.mjs sat broken for weeks.
      failed.push(name);
      console.error(`  FAIL ${name} (exit ${r.status === null ? 'timeout/killed' : r.status})\n${out}`);
    }
  }
  if (failed.length) throw new Error(`${phase}-phase gates failed: ${failed.join(', ')}`);
  if (unread.length) {
    throw new Error(
      `${phase}-phase gates could not read their subject: ${unread.join(', ')}. ` +
        'Nothing was audited and nothing has been judged. Re-run when the read succeeds; do not weaken the gates.',
    );
  }
  console.log(`— ${phase}-phase gates: ${names.length} passed`);
}

function kvArgs(subcmd, key, extra = []) {
  return ['kv', 'key', subcmd, key, '--namespace-id', KV_NAMESPACE_ID, '--remote', ...extra];
}

// The lease lives in the same KV namespace either way. Cloudflare's REST value endpoint began
// rejecting this account's OAuth session with "Authentication error [code: 10000]" even though
// the token carries workers_kv:write and D1 calls on the same session succeed — which blocked
// every deploy at the lock step. The build's own KV binding writes that namespace fine, so the
// lease goes through it and falls back to the CLI when the build is unreachable. Same key, same
// namespace, same lock semantics: only the transport changed.
function kvViaBuild(op, key, value) {
  const token = env.TERMINAL_KEY;
  if (!token) return { ok: false };
  const body = op === 'put' ? `${key}|${value}` : key;
  const r = runCapture('curl', [
    '-s', '--max-time', '25', '-X', 'POST', 'https://miscsubjects.com/api/dispatch',
    '-H', 'x-terminal-key: ' + token, '-H', 'content-type: application/json',
    '-d', JSON.stringify({ key: op === 'put' ? 'KV_PUT' : op === 'del' ? 'KV_DEL' : 'KV_GET', body }),
  ]);
  if (!r.ok || !r.stdout) return { ok: false };
  try {
    const j = JSON.parse(r.stdout);
    const res = typeof j.result === 'string' ? j.result : JSON.stringify(j.result);
    if (typeof res === 'string' && res.startsWith('ERR')) return { ok: false };
    return { ok: true, value: res };
  } catch { return { ok: false }; }
}


// Apply SQL through the build's own D1 binding (dispatch D1_EXEC, one statement per call).
// The CLI's D1 REST endpoints (query and import) intermittently refuse this account
// (codes 7500/10000) while Worker-binding access stays healthy — same story as the
// deploy lease and the ledger receipt. Statements only; comments stripped.
function sqlViaBuild(sqlText) {
  const token = env.TERMINAL_KEY;
  if (!token) return { ok: false, failed: 'no TERMINAL_KEY' };
  const stmts = sqlText
    .split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    .split(';').map(x => x.trim()).filter(Boolean);
  for (const stmt of stmts) {
    const r = runCapture('curl', [
      '-s', '--max-time', '60', '-X', 'POST', 'https://miscsubjects.com/api/dispatch',
      '-H', 'x-terminal-key: ' + token, '-H', 'content-type: application/json',
      '-d', JSON.stringify({ key: 'D1_EXEC', body: stmt }),
    ]);
    let ok = false;
    let why = '';
    const verdict = (out) => {
      try {
        const j = JSON.parse(out);
        const res = typeof j.result === 'string' ? j.result : JSON.stringify(j.result);
        const text = String(res || '');
        // SQLite has no ADD COLUMN IF NOT EXISTS, so a migration that already ran reports a
        // duplicate column. That is the migration having succeeded, not a failure — without
        // this every ship after 0371 would refuse forever on a column that is already there.
        if (/duplicate column name/i.test(text)) return { ok: true, why: '' };
        if (j.ok !== false && !text.startsWith('ERR')) return { ok: true, why: '' };
        return { ok: false, why: text.slice(0, 240) };
      } catch {
        return { ok: false, why: 'unparseable: ' + String(out || '').slice(0, 240) };
      }
    };
    ({ ok, why } = r.ok ? verdict(r.stdout) : { ok: false, why: String(r.stderr || '').slice(0, 240) });
    for (let attempt = 0; !ok && attempt < 4 && /overload|Network connection lost|internal error|7500|fetch failed|unparseable|render error|Requests queued|\b(429|502|503|504)\b/i.test(why); attempt++) {
      const waitMs = 3000 * (attempt + 1);
      spawnSync(process.execPath, ['-e', `setTimeout(()=>{}, ${waitMs})`], { env });
      const again = runCapture('curl', [
        '-s', '--max-time', '90', '-X', 'POST', 'https://miscsubjects.com/api/dispatch',
        '-H', 'x-terminal-key: ' + token, '-H', 'content-type: application/json',
        '-d', JSON.stringify({ key: 'D1_EXEC', body: stmt }),
      ]);
      ({ ok, why } = again.ok ? verdict(again.stdout) : { ok: false, why: String(again.stderr || '').slice(0, 240) });
    }
    if (!ok) return { ok: false, failed: stmt.slice(0, 80) + ' :: ' + why };
  }
  return { ok: true, applied: stmts.length };
}

function readDeployLease() {
  const viaBuild = kvViaBuild('get', DEPLOY_LOCK_KEY);
  if (viaBuild.ok) {
    const v = String(viaBuild.value || '').trim();
    if (!v || v === 'null' || /not found/i.test(v)) return null;
    try { return JSON.parse(v); } catch { return { owner: 'unknown', raw: v }; }
  }
  const r = runCapture('wrangler', kvArgs('get', DEPLOY_LOCK_KEY, ['--text']));
  if (!r.ok || !r.stdout || /not found/i.test(r.stderr)) return null;
  try { return JSON.parse(r.stdout); } catch { return { owner: 'unknown', raw: r.stdout }; }
}

function ledgerLease(action, lease, status = 200) {
  const q = (value) => "'" + String(value == null ? '' : value).replaceAll("'", "''") + "'";
  const id = 'e_deploy_' + randomUUID();
  const ts = new Date().toISOString();
  const nonceFingerprint = lease?.nonce ? createHash('sha256').update(String(lease.nonce)).digest('hex').slice(0, 16) : null;
  const response = JSON.stringify({ action, holder: lease?.owner || null, nonce_fingerprint: nonceFingerprint, expires_at: lease?.expires_at || null });
  const sql = `INSERT INTO events (id,ts,build,source,key,actor,action,direction,status,response_preview,response_size,response_json) VALUES (${q(id)},${q(ts)},'miscsubjects','deploy-lease','DEPLOY_LEASE',${q(lease?.owner)},${q(action)},'IN',${Number(status)},${q(response)},${response.length},${q(response)});`;
  // Same transport story as the lease itself: the CLI's D1 write is being refused for this
  // session. The build's own ingest endpoint writes the identical fact through the LEDGER
  // binding, hash-chained the normal way. The receipt is still written — only the path changed.
  const viaBuild = runCapture('curl', [
    '-s', '--max-time', '25', '-X', 'POST', 'https://miscsubjects.com/api/event_log_ingest',
    '-H', 'x-terminal-key: ' + (env.TERMINAL_KEY || ''), '-H', 'content-type: application/json',
    '-d', JSON.stringify({
      kind: 'DEPLOY_LEASE', action, agent: lease?.owner || null,
      response: { action, holder: lease?.owner || null, nonce_fingerprint: nonceFingerprint, expires_at: lease?.expires_at || null },
      status,
    }),
  ]);
  // The ingest endpoint answers 204 with an empty body on success, so "no error text" is the
  // signal, not a JSON ok flag.
  if (viaBuild.ok && !/error|unauthorized/i.test(viaBuild.stdout || '')) return { ok: true, stdout: 'ingested', stderr: '' };
  return runCapture('wrangler', ['d1', 'execute', 'miscsubjects-events', '--remote', '--command', sql]);
}

async function acquireDeployLease() {
  const existing = readDeployLease();
  const now = Date.now();
  if (existing?.expires_at && Date.parse(existing.expires_at) > now) {
    throw new Error('Deploy lease held by ' + (existing.owner || 'unknown') + ' until ' + existing.expires_at);
  }
  const nonce = now.toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const lease = {
    nonce,
    owner: 'deployer-' + createHash('sha256').update(`${process.env.USER || 'unknown'}@${hostname()}`).digest('hex').slice(0, 10),
    pid: process.pid,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + LOCK_TTL_SECONDS * 1000).toISOString(),
  };
  const viaBuild = kvViaBuild('put', DEPLOY_LOCK_KEY, JSON.stringify(lease));
  const put = viaBuild.ok ? { ok: true } :
    runCapture('wrangler', kvArgs('put', DEPLOY_LOCK_KEY, [JSON.stringify(lease), '--ttl', String(LOCK_TTL_SECONDS)]));
  if (!put.ok) throw new Error('failed to write deploy lease: ' + (put.stderr || put.stdout));
  await new Promise((resolve) => setTimeout(resolve, 500));
  const current = readDeployLease();
  if (!current || current.nonce !== nonce) {
    throw new Error('lost deploy lease to ' + (current?.owner || 'unknown'));
  }
  const logged = ledgerLease('acquire', lease);
  if (!logged.ok) {
    if (!kvViaBuild('del', DEPLOY_LOCK_KEY).ok) runCapture('wrangler', kvArgs('delete', DEPLOY_LOCK_KEY));
    throw new Error('deploy lease acquired but acquire receipt failed: ' + (logged.stderr || logged.stdout));
  }
  return lease;
}

function releaseDeployLease(lease) {
  const current = readDeployLease();
  if (current?.nonce === lease?.nonce) {
    if (!kvViaBuild('del', DEPLOY_LOCK_KEY).ok) runCapture('wrangler', kvArgs('delete', DEPLOY_LOCK_KEY));
    const logged = ledgerLease('release', lease);
    if (!logged.ok) throw new Error('deploy lease released but release receipt failed: ' + (logged.stderr || logged.stdout));
  }
}

function verifyProtocolLawClosure() {
  const source = readFileSync(join(ROOT, 'functions/_lib/oip_conformance.js'), 'utf8');
  const deployed = PROTOCOL_LAWS.filter((law) => law.status === 'deployed');
  const ids = new Set();
  for (const law of deployed) {
    if (!/^L\d+$/.test(law.id) || !/^C\d+$/.test(law.clause)) throw new Error('invalid protocol law registry entry: ' + JSON.stringify(law));
    if (ids.has(law.clause)) throw new Error('protocol laws must not share a conformance clause: ' + law.clause);
    ids.add(law.clause);
    if (!source.includes(`clause("${law.clause}"`)) throw new Error(`${law.id} is marked deployed without ${law.clause} in oip_conformance.js`);
  }
  console.log(`protocol-law closure: ${deployed.length}/${deployed.length} deployed laws have unique conformance clauses`);
}

function verifyProductionLineage() {
  const fetch = runCapture('git', ['fetch', 'origin', 'main']);
  if (!fetch.ok) throw new Error('production lineage fetch failed: ' + (fetch.stderr || fetch.stdout));
  const head = runCapture('git', ['rev-parse', 'HEAD']);
  const main = runCapture('git', ['rev-parse', 'origin/main']);
  if (!head.ok || !main.ok || head.stdout !== main.stdout) {
    throw new Error(`production deploy blocked: HEAD ${head.stdout || 'unknown'} is not origin/main ${main.stdout || 'unknown'}. Merge and push the feature first.`);
  }
  const status = runCapture('git', ['status', '--porcelain', '--untracked-files=all']);
  if (!status.ok) throw new Error('production status check failed: ' + (status.stderr || status.stdout));
  const dirtyRuntime = status.stdout.split('\n').filter(Boolean).filter((line) => {
    const path = line.replace(/^[ MADRCU?!]{1,2}\s+/, '');
    return !path.startsWith('.protected/pending/') && !path.startsWith('.protected/quarantine/');
  });
  if (dirtyRuntime.length) {
    throw new Error('production deploy blocked: uncommitted runtime changes:\n' + dirtyRuntime.join('\n'));
  }
  run(process.execPath, ['scripts/check-protected-features.mjs']);
  runGatePhase('pre');
  console.log('production lineage: HEAD equals origin/main, protected feature contracts pass, pre-phase gates pass');
}

function reportStrandedWork() {
  // Every deploy states what it does NOT carry. A saved line of work that never
  // rejoined the live line is invisible at deploy time otherwise — that silence
  // is how the June/July work stranded. Informational, never blocking.
  const refs = runCapture('git', ['for-each-ref', '--format=%(refname:short)', 'refs/heads/']);
  if (!refs.ok) return;
  const dispositioned = new Set(
    runCapture('git', ['config', '--get-all', 'quadsync.dispositioned']).stdout.split('\n').filter(Boolean)
  );
  const stranded = [];
  for (const branch of refs.stdout.split('\n').filter(Boolean)) {
    if (branch === 'main') continue;
    const tip = runCapture('git', ['rev-parse', branch]).stdout;
    if (!tip || dispositioned.has(`${branch}:${tip}`)) continue;
    const real = runCapture('git', ['log', '--oneline', `main..${branch}`, '--invert-grep', '--grep=quadsync']);
    const count = real.stdout ? real.stdout.split('\n').filter(Boolean).length : 0;
    if (count) stranded.push(`${branch} (${count} change${count === 1 ? '' : 's'})`);
  }
  if (stranded.length) {
    console.log(`stranded-work: this deploy does NOT carry ${stranded.length} saved line(s): ${stranded.join(', ')} — fold or disposition them`);
  } else {
    console.log('stranded-work: none — every saved line is folded into the live line or dispositioned');
  }
}

// Preview deployments bind to the ISOLATED preview DB (miscsubjects-content-preview), which has
// no article data — so any page whose first act is a populated-D1 query 500s on preview even
// when it's perfectly healthy in production. That is a preview-binding artifact, NOT a code bug.
// So we split the smoke set:
//   PREVIEW_SMOKE_PATHS — pages that render from code/tokens without needing populated D1.
//     These catch the real gate target: a build that throws at render time (the /design
//     blank-page ReferenceError class). A module-scope error takes the whole Worker down, so
//     even D1 pages would surface it here as a boot failure.
//   PROD_SMOKE_PATHS — the full set, checked against PRODUCTION after promotion, where the
//     bindings are real. This is the tripwire for anything preview couldn't see.
const PREVIEW_SMOKE_PATHS = ['/design'];
const PROD_SMOKE_PATHS = [
  '/',
  '/design',
  '/a/openai-huggingface-hack-2026',
  '/a/the-canonical-morgh-index',
  '/content',
];
const SMOKE_BAD = /render error|internal server error|cannot read|referenceerror|is not defined|1101 |worker threw/i;

async function smokeCheck(baseUrl, label, paths) {
  const failures = [];
  for (const path of paths) {
    const url = baseUrl.replace(/\/$/, '') + path;
    let res, body = '';
    try {
      res = await fetch(url, { headers: { 'user-agent': 'ship-smoke/1.0' }, redirect: 'manual' });
      body = await res.text();
    } catch (e) {
      failures.push(`${path} → fetch failed: ${e.message}`);
      continue;
    }
    const ok2xx3xx = res.status >= 200 && res.status < 400;
    if (!ok2xx3xx) { failures.push(`${path} → HTTP ${res.status}`); continue; }
    if (body.length < 1500) { failures.push(`${path} → body only ${body.length} bytes (blank?)`); continue; }
    if (SMOKE_BAD.test(body)) {
      const hit = body.match(SMOKE_BAD);
      failures.push(`${path} → error marker in body: "${hit && hit[0]}"`);
    }
  }
  if (failures.length) {
    console.error(`smoke-check FAILED on ${label} (${baseUrl}):\n  - ` + failures.join('\n  - '));
    return false;
  }
  console.log(`smoke-check passed on ${label}: ${paths.length} page(s) render`);
  return true;
}

function deployPagesCapture(branch) {
  const r = runCapture('wrangler', [
    'pages', 'deploy', 'public',
    '--project-name', 'miscsubjects-pages',
    '--branch', branch,
  ]);
  console.log(r.stdout);
  if (r.stderr) console.error(r.stderr);
  if (!r.ok) throw new Error('preview deploy failed: ' + (r.stderr || r.stdout));
  const m = (r.stdout + '\n' + r.stderr).match(/https:\/\/[a-z0-9-]+\.miscsubjects-pages\.pages\.dev/i);
  if (!m) throw new Error('could not parse preview deployment URL from wrangler output');
  return m[0];
}

const args = process.argv.slice(2);
const skipMigrations = args.includes('--no-migrations');
const skipLock = args.includes('--no-lock');
const skipGate = args.includes('--no-gate');
const explicit = args.filter(a => a.endsWith('.sql'));
let files = explicit;

if (!skipMigrations && !files.length) {
  files = readdirSync(MIGRATIONS)
    .filter(f => /^\d+_.*\.sql$/.test(f))
    .map(f => ({ f, mtime: statSync(join(MIGRATIONS, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime || b.f.localeCompare(a.f))
    .slice(0, 1)
    .map(x => join('migrations', x.f));
}

let deployLease = null;
try {
  verifyProductionLineage();
  verifyProtocolLawClosure();
  reportStrandedWork();
  if (!skipLock) deployLease = await acquireDeployLease();
  if (!skipMigrations) {
    const schemaSql = readFileSync(join(ROOT, 'schema.sql'), 'utf8');
    const schemaCli = runCapture('wrangler',
      ['d1', 'execute', 'miscsubjects-content', '--remote', '--command=' + schemaSql]);
    if (!schemaCli.ok) {
      console.log('schema: CLI D1 refused; applying through the build binding');
      const via = sqlViaBuild(schemaSql);
      if (!via.ok) throw new Error('schema apply failed on both transports: ' + via.failed);
      console.log('schema: applied via build (' + via.applied + ' statements)');
    }
    for (const file of files) {
      const mCli = runCapture('wrangler',
        ['d1', 'execute', 'miscsubjects-content', '--remote', '--file', file]);
      if (!mCli.ok) {
        console.log('migration ' + file + ': CLI D1 refused; applying through the build binding');
        const via = sqlViaBuild(readFileSync(join(ROOT, file), 'utf8'));
        if (!via.ok) throw new Error('migration ' + file + ' failed on both transports: ' + via.failed);
        console.log('migration ' + file + ': applied via build (' + via.applied + ' statements)');
      }
    }
  }
  if (skipGate) {
    run('wrangler', [
      'pages', 'deploy', 'public',
      '--project-name', 'miscsubjects-pages',
      '--branch', 'main',
    ]);
  } else {
    // 1) Deploy to a preview alias (NOT production; uses the isolated preview DB).
    console.log('gate: deploying to preview alias for code-health smoke-test before promoting…');
    const previewUrl = deployPagesCapture('ship-gate');
    // 2) Smoke-test the preview for RENDER-THROW health (module/scope errors, the /design
    //    blank-page class). Only code-health pages — D1-data pages can't be validated on the
    //    empty preview DB. A module-scope error takes the whole Worker down, so it surfaces here.
    // Fresh preview deployments 404 for a few seconds while Functions propagate — retry
    // before treating it as a real failure (same tolerance the production check uses).
    // Cloudflare preview-alias Functions can take 60-90s to propagate globally; a fresh
    // preview 404s until then. Retry up to ~2 min before treating it as a real failure.
    let previewOk = false;
    for (let attempt = 1; attempt <= 12 && !previewOk; attempt++) {
      if (attempt > 1) await new Promise((r) => setTimeout(r, 10000));
      previewOk = await smokeCheck(previewUrl, `preview (try ${attempt})`, PREVIEW_SMOKE_PATHS);
    }
    if (!previewOk) {
      throw new Error('PRODUCTION NOT PROMOTED — preview code-health smoke-check failed, so the live site was never touched. Fix the errors above and re-run. Articles stayed up the whole time.');
    }
    // 3) Preview is healthy → promote the identical bundle to production.
    run('wrangler', [
      'pages', 'deploy', 'public',
      '--project-name', 'miscsubjects-pages',
      '--branch', 'main',
    ]);
    // 4) Now smoke-test PRODUCTION (real bindings) across the full critical set — the tripwire
    //    for anything the empty-preview-DB gate couldn't see. Retry briefly for propagation.
    let prodOk = false;
    for (let attempt = 1; attempt <= 5 && !prodOk; attempt++) {
      if (attempt > 1) await new Promise((r) => setTimeout(r, 6000));
      prodOk = await smokeCheck('https://miscsubjects.com', `production (try ${attempt})`, PROD_SMOKE_PATHS);
    }
    if (!prodOk) {
      throw new Error('PRODUCTION SMOKE FAILED after promotion — a page is 500ing with real bindings. Articles on /a/ are still served from last-good cache by the middleware, but investigate now: check `wrangler pages deployment tail` and roll back via the Pages dashboard if needed.');
    }
    run(process.execPath, ['scripts/check-authored-render.mjs']);
    {
      const r = spawnSync(process.execPath, ['scripts/check-owner-name-leak.mjs'], { cwd: ROOT, env: { ...env, NAME_LAW_EGRESS: '1' }, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('OWNER IDENTITY IN PUBLIC EGRESS after promotion — the redaction layer failed. Fix before anything else ships.');
    }
    {
      // Exit 2 means the gate could not READ the corpus (the articles endpoint answers 500 while
      // D1 is overloaded). Printing the verdict below for that sent this deploy hunting prose
      // that had never been fetched. A gate that could not measure its subject is a blocked
      // ship with an infrastructure reason, never a finding about the writing.
      const r = spawnSync(process.execPath, ['scripts/check-plain-language.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status === 2) throw new Error('PLAIN_LANGUAGE_LAW could not read the corpus — see its own message above. Nothing was audited and no article has been judged. Re-run when the read succeeds; do not weaken the gate.');
      if (r.status !== 0) throw new Error('PLAIN_LANGUAGE_LAW FAILED — an article is written in encyclopedia register, hedges instead of rates, names an audience, or repeats another page\'s heading. Rewrite it; do not weaken the gate.');
    }
    {
      const r = spawnSync(process.execPath, ['scripts/check-coding-law.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('CODING_LAW FAILED — a changed file in the executable surface is not covered by a committed lease matching its current contents. Open a lease on what you read and close it with what you are leaving; do not edit the gate.');
    }
    {
      const r = spawnSync(process.execPath, ['scripts/check-one-object.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('ONE_OBJECT_LAW FAILED — a single-object article carries another object\'s frame. Rewrite the page about its own subject; cross-object writing belongs in the combination article whose slug names both.');
    }
    {
      // node --test, not npx vitest: vitest is not installed in this repo and --no-install means
      // npx refuses to fetch it, so this step failed on every ship and reported a broken guard
      // when the guard passes. The test itself now uses node:test.
      const r = spawnSync(process.execPath, ['--test', 'functions/_lib/one_object_guard.test.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('ONE_OBJECT_LAW regression test FAILED — the guard no longer refuses the 2026-08-04 tirzepatide headline. Restore the refusal before shipping.');
    }
    {
      const r = spawnSync(process.execPath, ['--test', 'functions/_lib/source_quote_law.test.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('SOURCE_QUOTE_LAW regression test FAILED — a source card no longer renders the source\'s own words, or the write path no longer refuses a quote-less source. Restore both before shipping.');
    }
    {
      // Exit 2 is the shared "could not read my subject" code (scripts/_lib/backpressure.mjs).
      // The corpus scan goes through D1, and under load it returns 7429 for reasons that have
      // nothing to do with the sources. Reporting that as data repair is how a deploy ends up
      // hunting a defect that does not exist.
      const r = spawnSync(process.execPath, ['scripts/check-source-quotes.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status === 2) throw new Error('SOURCE_QUOTE_LAW could not read the corpus — see its own message above. Nothing was audited and no source has been judged. Re-run when the read succeeds; do not weaken the gate.');
      if (r.status !== 0) throw new Error('SOURCE_QUOTE_LAW FAILED — either a stored source is not an object, the quote-less count rose above the recorded ceiling, or a live card rendered without the quote its source carries. Repair the data; do not raise the ceiling.');
    }
    {
      const r = spawnSync(process.execPath, ['--test', 'functions/_lib/claim_law.test.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('CLAIM_LAW regression test FAILED — a claim-less article can publish again, which makes it a different kind of object from the rest of the corpus. Restore the refusal.');
    }
    {
      const r = spawnSync(process.execPath, ['scripts/check-article-claims.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('CLAIM_LAW FAILED — the number of published articles with no claims rose. Add claims to whatever shipped without them; do not raise the ceiling.');
    }
    {
      const r = spawnSync(process.execPath, ['--test', 'functions/_lib/work_acceptance_law.test.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('WORK_ACCEPTANCE_LAW regression test FAILED — a task can be born unable to pass again, or a refusal has gone back to naming nothing. Restore both halves before shipping.');
    }
    {
      const r = spawnSync(process.execPath, ['scripts/check-work-acceptance.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('WORK_ACCEPTANCE_LAW FAILED — a live task has no acceptance test that could close it. Give it tests that measure the object; do not relax the runner and do not delete the task.');
    }
    {
      const r = spawnSync(process.execPath, ['--test', 'functions/_lib/governed_tables.test.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('GOVERNED_TABLE_LAW regression test FAILED — a raw write to work_tasks, work_actions, articles or article_slots is accepted again. Restore the guard; do not route around it.');
    }
    {
      const r = spawnSync(process.execPath, ['scripts/check-governed-tables.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('GOVERNED_TABLE_LAW FAILED on the live site — the direct-SQL bypass is open in production. Fix it before anything else ships.');
    }
    // 8g) A WRITE IS CONFIRMED BY WHAT IT WROTE. The Apps Script answers an undelivered request
    //    with its health payload — HTTP 200, ok:true, nothing named — and a sheet write that never
    //    happened was reported as success. Closing that surfaced the real cause immediately.
    {
      const r = spawnSync(process.execPath, ['--test', 'functions/_lib/airunner_contract.test.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('AIRUNNER_WRITE_CONTRACT test FAILED — a write response that names nothing is being accepted as a receipt again. A silent pass is worse than an error.');
    }
    {
      const r = spawnSync(process.execPath, ['--test', 'functions/_lib/headline_hero_law.test.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('HEADLINE_HERO_LAW test FAILED — the guard either stopped refusing evidence-state headlines, clickbait reveals, lab-animal heroes and missing featured images, or started refusing headlines that correctly name their subject. Fix the guard, not the test.');
    }
    {
      const r = spawnSync(process.execPath, ['--test', 'functions/_lib/publish_time.test.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('PUBLISH_TIME test FAILED — the homepage stamp or the posted/updated distinction regressed. The card must say which fact it is showing, in Pacific time, to the minute.');
    }
    // 8d) CITATION_IDENTITY_LAW. A source card can carry a real, reachable, correctly-formatted
    //    PubMed link that points at a completely different paper. /a/bpc-157-gut-health cited a
    //    BPC-157 gastrointestinal paper at a PMID belonging to a 1959 paper on eosinophil counts in
    //    acute uremia; /a/semax-tbi-concussion cited a Semax/BDNF paper at a PMID belonging to a
    //    study of a gene variant and suicide risk. Both passed every existing check, because the
    //    link resolves and the existing checks only ask whether it resolves. This looks the record
    //    up and compares its real title against the title the article claims.
    {
      const r = spawnSync(process.execPath, ['scripts/check-citation-identity.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('CITATION_IDENTITY_LAW FAILED — an article cites a paper at an identifier belonging to a different paper. Correct the identifier or remove the source; never leave a citation that resolves to the wrong work.');
    }
    // 8c) The placeholder-title guard, in both directions. It exists because "Kimi Test Article"
    //    reached the top of the homepage journal. It was then written as /\btest(?:ing)?\b/i, which
    //    refused "Spinal stenosis: the shopping trolley test" — a correct clinical title on a health
    //    site, where blood test, nerve conduction testing and the straight leg raise test are
    //    ordinary English. This pins both: placeholder shapes still refused, clinical prose publishes.
    {
      const r = spawnSync(process.execPath, ['--test', 'functions/_lib/test_title_guard.test.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('PLACEHOLDER_TITLE_GUARD test FAILED — the guard either stopped refusing placeholder pages or started refusing legitimate clinical titles again. Fix the pattern, not the test.');
    }
    {
      run(process.execPath, ['scripts/sync_pointer_files.mjs']);
      const r = spawnSync(process.execPath, ['scripts/check-pointer-files.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('POINTER_FILES_LAW FAILED — a pointer file is carrying authority again. Move the rule into the laws table or the canonical write path; the file only points.');
    }
    // 10) The canonical work object must be answering, or agents have no way to obtain work.
    {
      const probes = ['/api/work', '/api/work/bootstrap', '/a/the-work-object', '/a/agent-work-law'];
      for (const path of probes) {
        const r = runCapture('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', 'https://miscsubjects.com' + path]);
        if (r.stdout.trim() !== '200') throw new Error('WORK_OBJECT_UNREACHABLE — ' + path + ' returned ' + r.stdout.trim() + '. Agents cannot lease work; fix before anything else ships.');
      }
      console.log(JSON.stringify({ ok: true, law: 'WORK_OBJECT_REACHABLE', checked: probes }));
    }
    // 11) Every remaining post-phase gate in scripts/gates.manifest.json. The hand-written blocks above
    //     stay where they are because they need particular env and ordering; this catches everything
    //     else, so a gate can never again exist on disk and never run. See check-gates-wired.mjs.
    runGatePhase('post');
  }
} catch (e) {
  console.error(String(e?.message || e));
  process.exitCode = 1;
} finally {
  if (deployLease) releaseDeployLease(deployLease);
}
