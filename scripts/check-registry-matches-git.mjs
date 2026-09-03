import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

const BASE = process.env.BUILD_BASE || 'https://miscsubjects.com';
const KEY = process.env.TERMINAL_KEY || '';
const SCOPE = ['functions/', 'scripts/', 'migrations/', 'workers/', 'apps-script/', 'public/',
  '.claude/skills/', '.agents/skills/', 'schema.sql', 'wrangler.toml'];

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const gitShow = (rev, path) => {
  const r = spawnSync('git', ['show', `${rev}:${path}`], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? sha(r.stdout) : null;
};

if (!KEY) {
  console.error('CODE_LEASE_REGISTRY_LAW needs TERMINAL_KEY to read the lease chain. It was not set, so the registry was not checked — that is a skipped check, not a pass.');
  process.exit(2);
}

let chain = null;
let why = '';
for (let attempt = 1; attempt <= 4; attempt += 1) {
  const r = await fetch(`${BASE}/api/coding-law/leases?limit=200`, { headers: { 'x-terminal-key': KEY } })
    .catch((e) => ({ ok: false, status: 0, _err: e }));
  const j = r.ok ? await r.json().catch(() => null) : null;
  if (j && Array.isArray(j.leases)) { chain = j.leases; break; }
  why = (j && (j.error || j.message)) || (r._err && String(r._err.message)) || `HTTP ${r.status}`;
  if (attempt < 4) await new Promise((res) => setTimeout(res, attempt * 4000));
}
if (!chain) {
  console.error(`CODE_LEASE_REGISTRY_LAW could not read the lease chain after 4 tries: ${why}. The registry was not checked.`);
  process.exit(2);
}

// Newest committed new_sha per path, by committed_at — the chain's own order is not guaranteed
// to be newest-first, and trusting it picked a superseded reconcile row over the real head.
const committed = chain
  .filter((l) => l.state === 'committed')
  .sort((a, b) => String(b.committed_at || '').localeCompare(String(a.committed_at || '')));
const heads = new Map();
for (const lease of committed) {
  for (const f of lease.files || []) {
    const path = String(f.path || '');
    const declared = String(f.new_sha || '').toLowerCase();
    if (!path || !/^[0-9a-f]{64}$/.test(declared)) continue;
    if (!SCOPE.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p))) continue;
    if (!heads.has(path)) heads.set(path, { declared, by: lease.agent, at: lease.committed_at, lease: lease.id });
  }
}

// Only a path that fails the cheap three-way check pays for a history walk.
const historyMatch = (path, want) => {
  const log = spawnSync('git', ['log', '--format=%H', '-100', '--', path], { encoding: 'utf8' });
  if (log.status !== 0) return null;
  for (const commit of log.stdout.split('\n').filter(Boolean)) {
    if (gitShow(commit, path) === want) return commit.slice(0, 12);
  }
  return null;
};

const phantom = [];
const behind = [];
const gone = [];
for (const [path, rec] of heads) {
  const candidates = new Set();
  for (const rev of ['origin/main', 'HEAD']) {
    const h = gitShow(rev, path);
    if (h) candidates.add(h);
  }
  if (existsSync(path)) candidates.add(sha(readFileSync(path)));
  if (!candidates.size) { gone.push({ path, ...rec }); continue; }
  if (candidates.has(rec.declared)) continue;
  const at = historyMatch(path, rec.declared);
  const real = [...candidates].map((h) => h.slice(0, 12));
  if (at) behind.push({ path, ...rec, at_commit: at, real });
  else phantom.push({ path, ...rec, real });
}

for (const b of behind) {
  console.error(`CODE_LEASE_REGISTRY_LAW note — head behind git: ${b.path} head ${b.declared.slice(0, 12)} (by ${b.by}) is commit ${b.at_commit}; git now has ${b.real.join(' / ')}. A later commit did not register. Leases on it will report stale.`);
}

if (phantom.length) {
  console.error('CODE_LEASE_REGISTRY_LAW violations — the registry head names content that exists nowhere in git:');
  for (const p of phantom) {
    console.error(`- ${p.path}\n    registry head ${p.declared.slice(0, 16)} (by ${p.by}, ${p.at}, ${p.lease})\n    git has        ${p.real.join(' / ')}`);
  }
  console.error('Every lease on these paths will report stale until the head is reconciled. POST /api/coding-law/reconcile with the hash you actually read and the reason. Do not widen this gate.');
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  law: 'CODE_LEASE_REGISTRY_LAW',
  examined: heads.size,
  heads_behind_git: behind.length,
  paths_no_longer_in_git: gone.length,
  checked: `${heads.size} registry heads in the newest ${chain.length} leases compared against origin/main, HEAD, the worktree, then each path's history`,
}));
