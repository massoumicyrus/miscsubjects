// THE CODING LAW, ENFORCED. Where a hash taken at the start and a hash taken at the commit meet.
//
//   GET  /api/coding-law            what the law is and the two calls, in the first read
//   POST /api/coding-law/start      {agent, intent, files:[{path, base_sha}]}  -> {lease_id, start_hash}
//   POST /api/coding-law/commit     {lease_id, files:[{path, new_sha}]}        -> 200 committed | 409 refused
//   GET  /api/coding-law/leases     the chain — who committed what path, from what base, when
//   GET  /api/coding-law/head?path= the newest committed hash for one path
//
// The refusal is the product. A 409 means the caller's declared base is not the newest committed
// version of that path, which means another agent committed it after the caller read it, which means
// this commit was about to erase that agent's work. Everything else here exists to make that one
// check possible.
//
// Both verbs accept the same fields, the GET forms included, for the same reason the comment door
// does: an agent whose transport cannot POST is still an agent that must not overwrite anyone.

import { inCodingLawScope, CODING_LAW_SCOPE } from '../../_lib/coding_law_object.js';
import { logEvent } from '../../_lib/event_log.js';
import { isBuildAuthed } from '../../_lib/admin_session.js';

// TWO BOUNDS THE LAW SHIPPED WITHOUT, BOTH REPORTED BY MODELS READING THE PAGE.
//
// MAX_LEASE_FILES: the start endpoint validated only that the files array was non-empty, so there
// was no documented or enforced ceiling on an atomic commit.
//
// LEASE_TTL_SEC: there was no expiry, no heartbeat and no release, so a lease opened by a session
// that then crashed stayed open forever. The objection overstated the damage and the correction is
// worth keeping: an open lease is advisory, not exclusive — a second agent leasing the same path is
// warned and proceeds, and the refusal that bites is the 409 at commit against a moved base. So a
// dead session never blocked work; it corrupted the answer to "who holds this path", which is the
// question the lease table exists to answer. An expired lease is now reported as expired and can no
// longer be committed, and an agent that finishes without committing can say so.
const MAX_LEASE_FILES = 25;
const LEASE_TTL_SEC = 60 * 60 * 6;

function leaseAge(openedAt) {
  const t = Date.parse(openedAt || '');
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 1000) : null;
}
function leaseExpired(openedAt) {
  const age = leaseAge(openedAt);
  return age !== null && age > LEASE_TTL_SEC;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, authorization, x-terminal-key',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    },
  });
}

function parts(params) {
  const raw = params?.path;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return String(raw || '').split('/').filter(Boolean);
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str ?? '')));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const SHA_RE = /^[a-f0-9]{64}$/i;

/** The hash over a sorted path:sha list. One string that names an exact multi-file state. */
async function stateHash(files, field) {
  const line = (files || [])
    .map((f) => `${f.path}:${String(f[field] || '').toLowerCase()}`)
    .sort()
    .join('\n');
  return sha256Hex(line);
}

function normalizeFiles(raw, field) {
  const out = [];
  const seen = new Set();
  for (const f of Array.isArray(raw) ? raw : []) {
    const path = String(f?.path || '').trim().replace(/^\.\//, '');
    const sha = String(f?.[field] || f?.sha || '').trim().toLowerCase();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push({ path, sha, valid: SHA_RE.test(sha) });
  }
  return out;
}

const DOOR = (origin) => ({
  schema: 'miscsubjects/coding-law/1',
  law: 'A hash when the work starts, a hash when the work commits.',
  why: 'Two agents read the same file at the same version, both edit from it, and the second commit erases the first. Each commit is individually valid, so nothing notices. Declaring the version you read is what makes the collision detectable.',
  start: `POST ${origin}/api/coding-law/start {"agent":"<yours>","intent":"<one line>","files":[{"path":"functions/x.js","base_sha":"<sha256 of the file as you read it>"}]}`,
  commit: `POST ${origin}/api/coding-law/commit {"lease_id":"lease_…","files":[{"path":"functions/x.js","new_sha":"<sha256 as you are leaving it>"}]}`,
  the_refusal: '409 overwrite_refused names the lease that committed your file after you read it. Re-read the file, redo the edit on the new text, open a fresh lease. Never force, never retry the same body.',
  chain: `${origin}/api/coding-law/leases`,
  head: `${origin}/api/coding-law/head?path=functions/x.js — the newest committed hash for one path`,
  scope: CODING_LAW_SCOPE,
  obligation: 'scripts/check-coding-law.mjs runs in the pre phase of every deploy. A changed code file with no committed lease matching its current contents fails the ship.',
  the_law: `${origin}/a/coding-law`,
  skill: `${origin}/api/articles/coding-law/skill`,
});

export async function onRequestOptions() { return json({ ok: true }); }

export async function onRequestGet({ request, env, params }) {
  const p = parts(params);
  const url = new URL(request.url);
  const origin = url.origin;

  if (!p.length) return json(DOOR(origin));

  if (p[0] === 'head') {
    const path = String(url.searchParams.get('path') || '').replace(/^\.\//, '');
    if (!path) return json({ error: 'path_required' }, 422);
    const row = await newestCommitted(env, path);
    return json({
      path,
      in_scope: inCodingLawScope(path),
      newest_committed_sha: row?.new_sha || null,
      by: row?.agent || null,
      at: row?.committed_at || null,
      note: row ? 'Your base_sha must equal this, or your commit is refused.' : 'No committed lease for this path yet — any base clears.',
    });
  }

  if (p[0] === 'leases') {
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') || 50)), 200);
    const state = url.searchParams.get('state');
    const rows = state
      ? (await env.DB.prepare('SELECT id,agent,intent,start_hash,commit_hash,state,refused_reason,opened_at,committed_at,files_json FROM code_leases WHERE state=? ORDER BY opened_at DESC LIMIT ?').bind(state, limit).all()).results
      : (await env.DB.prepare('SELECT id,agent,intent,start_hash,commit_hash,state,refused_reason,opened_at,committed_at,files_json FROM code_leases ORDER BY opened_at DESC LIMIT ?').bind(limit).all()).results;
    return json({
      schema: 'miscsubjects/coding-law-chain/1',
      count: (rows || []).length,
      ttl_seconds: LEASE_TTL_SEC,
      leases: (rows || []).map((r) => {
        let files = []; try { files = JSON.parse(r.files_json || '[]'); } catch {}
        // An open row whose age is past the ttl is reported as expired rather than as held. Without
        // this the chain answers "who holds this path" with every session that ever crashed.
        const expired = r.state === 'open' && leaseExpired(r.opened_at);
        return {
          ...r,
          files_json: undefined,
          files,
          state: expired ? 'expired' : r.state,
          age_seconds: leaseAge(r.opened_at),
          expired_from_state: expired ? 'open' : undefined,
        };
      }),
    });
  }

  // GET forms of both lanes, for agents whose transport cannot POST.
  if (p[0] === 'start' || p[0] === 'commit') {
    let files = [];
    try { files = JSON.parse(url.searchParams.get('files') || '[]'); } catch {
      return json({ error: 'files_must_be_json_array', example: '[{"path":"functions/x.js","base_sha":"<sha256>"}]' }, 422);
    }
    const body = p[0] === 'start'
      ? { agent: url.searchParams.get('agent') || '', intent: url.searchParams.get('intent') || '', files }
      : { lease_id: url.searchParams.get('lease_id') || '', files };
    return p[0] === 'start' ? startLease(env, body, origin) : commitLease(env, body, origin);
  }

  return json({ error: 'unknown_route', door: `${origin}/api/coding-law` }, 404);
}

export async function onRequestPost({ request, env, params }) {
  const p = parts(params);
  const origin = new URL(request.url).origin;
  let b = {};
  try { b = await request.json(); } catch { return json({ error: 'body_must_be_json', door: `${origin}/api/coding-law` }, 400); }
  if (p[0] === 'start') return startLease(env, b, origin);
  if (p[0] === 'commit') return commitLease(env, b, origin);
  if (p[0] === 'release') return releaseLease(env, b, origin);
  if (p[0] === 'reconcile') return reconcilePath(request, env, b, origin);
  return json({ error: 'unknown_route', door: `${origin}/api/coding-law` }, 404);
}

async function reconcilePath(request, env, b, origin) {
  if (!(await isBuildAuthed(request, env))) {
    return json({ error: 'unauthorized', note: 'Re-baselining a path is an owner action: it edits the record the law is checked against.' }, 401);
  }
  const path = String(b.path || '').trim();
  const currentSha = String(b.current_sha || '').trim().toLowerCase();
  const why = String(b.why || '').trim();
  if (!path) return json({ error: 'path_required' }, 422);
  if (!SHA_RE.test(currentSha)) return json({ error: 'current_sha_must_be_sha256' }, 422);
  if (!why) {
    return json({ error: 'why_required', note: 'Name what made the record stale. A re-baseline with no reason is indistinguishable from a force.' }, 422);
  }

  const head = await newestCommitted(env, path);
  if (!head?.new_sha) {
    return json({
      error: 'nothing_to_reconcile',
      path,
      note: 'This registry has no committed record for that path, so a normal lease will already succeed. Open one.',
    }, 409);
  }
  if (head.new_sha === currentSha) {
    return json({ state: 'ALREADY_CURRENT', path, head_sha: head.new_sha, note: 'The record already matches the content you read.' });
  }

  const leaseId = 'reconcile_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const now = new Date().toISOString();
  const agent = String(b.agent || 'owner').slice(0, 120);
  // Both tables carry NOT NULL columns a normal lease fills on the way through (start_hash,
  // files_json, agent on the file row). A reconciliation writes the same shape so the row is
  // indistinguishable from any other committed lease when the chain is read back.
  const filesJson = JSON.stringify([{ path, base_sha: head.new_sha, new_sha: currentSha }]);
  const startHash = await sha256Hex(path + ':' + head.new_sha);
  const commitHash = await sha256Hex(path + ':' + currentSha);
  try {
    await env.DB.prepare(
      "INSERT INTO code_leases (id, agent, intent, start_hash, commit_hash, files_json, state, opened_at, committed_at) " +
      "VALUES (?,?,?,?,?,?,'committed',?,?)"
    ).bind(leaseId, agent, ('RECONCILE: ' + why).slice(0, 400), startHash, commitHash, filesJson, now, now).run();
    await env.DB.prepare(
      "INSERT INTO code_lease_files (lease_id, path, base_sha, new_sha, agent, committed_at) VALUES (?,?,?,?,?,?)"
    ).bind(leaseId, path, head.new_sha, currentSha, agent, now).run();
  } catch (e) {
    return json({ error: 'reconcile_write_failed', detail: String(e && e.message || e).slice(0, 300) }, 500);
  }

  await logEvent(env, {
    source: 'coding-law', key: 'CODE_LEASE_RECONCILE', action: 'reconcile', direction: 'in', status: 200,
    request: { path, superseded_sha: head.new_sha, superseded_at: head.committed_at, superseded_by_agent: head.agent, current_sha: currentSha, why, agent },
    response: { lease_id: leaseId, state: 'reconciled' },
  });

  return json({
    state: 'RECONCILED',
    path,
    superseded: { sha: head.new_sha, agent: head.agent, committed_at: head.committed_at },
    now_head: currentSha,
    lease_id: leaseId,
    note: 'The registry head for this path is the content you read. Open a normal lease and commit; nothing about the check changed for any other path.',
  });
}

async function releaseLease(env, b, origin) {
  const leaseId = String(b.lease_id || '').trim();
  if (!leaseId) return json({ error: 'lease_id_required', start_one: `POST ${origin}/api/coding-law/start` }, 422);
  const lease = await env.DB.prepare('SELECT id,agent,state,opened_at FROM code_leases WHERE id=?').bind(leaseId).first();
  if (!lease) return json({ error: 'lease_not_found', lease_id: leaseId }, 404);
  if (lease.state === 'committed') return json({ error: 'lease_already_committed', lease_id: leaseId, note: 'A committed lease is part of the chain and is never withdrawn.' }, 409);
  const reason = String(b.reason || '').slice(0, 400).trim();
  await env.DB.prepare("UPDATE code_leases SET state='released', refused_reason=? WHERE id=?").bind(reason || 'released by the holding agent', leaseId).run();
  await env.DB.prepare('DELETE FROM code_lease_files WHERE lease_id=? AND new_sha IS NULL').bind(leaseId).run();
  await logEvent(env, {
    source: 'coding-law', key: 'CODE_LEASE_RELEASE', action: 'release', direction: 'in', status: 200,
    request: { lease_id: leaseId, agent: lease.agent, reason },
    response: { state: 'RELEASED' },
  });
  return json({
    state: 'RELEASED',
    lease_id: leaseId,
    note: 'The lease is closed without a commit and no longer appears as held. Nothing you wrote is recorded, because a release says you wrote nothing.',
  });
}

async function newestCommitted(env, path) {
  try {
    return await env.DB.prepare(
      "SELECT lease_id, new_sha, agent, committed_at FROM code_lease_files WHERE path=? AND new_sha IS NOT NULL ORDER BY committed_at DESC LIMIT 1"
    ).bind(path).first();
  } catch { return null; }
}

async function startLease(env, b, origin) {
  const agent = String(b.agent || '').slice(0, 120).trim();
  const intent = String(b.intent || '').slice(0, 400).trim();
  const files = normalizeFiles(b.files, 'base_sha');
  if (!agent) return json({ error: 'agent_required', note: 'Name yourself — the chain is signed. e.g. "claude:7d88e44e".' }, 422);
  if (!files.length) return json({ error: 'files_required', example: '[{"path":"functions/x.js","base_sha":"<sha256 of the file as you read it>"}]' }, 422);
  // A model asked what the maximum was and there was none: the handler checked only that the array
  // was non-empty, so an oversized atomic commit was attempted rather than refused, and the failure
  // would have arrived as a timeout instead of an answer. Refusing is the kinder contract.
  if (files.length > MAX_LEASE_FILES) {
    return json({
      error: 'too_many_files',
      given: files.length,
      max: MAX_LEASE_FILES,
      note: `A lease is a unit of work you can hold in your head and commit at once. Split this into leases of at most ${MAX_LEASE_FILES} files; nothing prevents holding several.`,
    }, 422);
  }
  const bad = files.filter((f) => !f.valid);
  if (bad.length) {
    return json({
      error: 'base_sha_must_be_sha256',
      bad: bad.map((f) => f.path),
      how: 'shasum -a 256 <path> — the file as you just read it, before any edit.',
    }, 422);
  }

  // Report the state of every path at lease time so the caller knows immediately whether it is
  // already behind. This is advisory at start (the enforcing check runs at commit) but an agent
  // that sees "stale at lease" here knows to re-read before it writes a single line.
  const heads = [];
  for (const f of files) {
    const head = await newestCommitted(env, f.path);
    heads.push({
      path: f.path,
      base_sha: f.sha,
      in_scope: inCodingLawScope(f.path),
      newest_committed_sha: head?.new_sha || null,
      stale: !!(head?.new_sha && head.new_sha !== f.sha),
      last_committed_by: head?.agent || null,
    });
  }
  const stale = heads.filter((h) => h.stale);

  const id = 'lease_' + (await sha256Hex(agent + ':' + Date.now() + ':' + Math.random())).slice(0, 16);
  const start_hash = await stateHash(files.map((f) => ({ path: f.path, base_sha: f.sha })), 'base_sha');
  const opened_at = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO code_leases (id, agent, intent, start_hash, files_json, state, opened_at) VALUES (?,?,?,?,?,?,?)'
  ).bind(id, agent, intent, start_hash, JSON.stringify(files.map((f) => ({ path: f.path, base_sha: f.sha }))), 'open', opened_at).run();
  for (const f of files) {
    await env.DB.prepare(
      'INSERT OR REPLACE INTO code_lease_files (lease_id, path, base_sha, new_sha, agent, committed_at) VALUES (?,?,?,NULL,?,NULL)'
    ).bind(id, f.path, f.sha, agent).run();
  }
  await logEvent(env, {
    source: 'coding-law', key: 'CODE_LEASE_START', action: 'lease', direction: 'in', status: 200,
    request: { agent, intent, files: files.map((f) => ({ path: f.path, base_sha: f.sha })) },
    response: { lease_id: id, start_hash, stale_at_lease: stale.map((s) => s.path) },
  });

  return json({
    state: 'LEASED',
    lease_id: id,
    start_hash,
    opened_at,
    files: heads,
    stale_at_lease: stale.length
      ? { count: stale.length, paths: stale.map((s) => s.path), note: 'You are already editing from a version that is not the newest committed one. Re-read these files now — the commit will be refused otherwise.' }
      : null,
    commit_with: `POST ${origin}/api/coding-law/commit {"lease_id":"${id}","files":[{"path":"…","new_sha":"<sha256 as you leave it>"}]}`,
    rule: 'Call commit immediately before git commit. 200 means commit. 409 means another agent committed your file after you read it — re-read, redo, re-lease. Never force.',
  });
}

async function commitLease(env, b, origin) {
  const leaseId = String(b.lease_id || '').trim();
  if (!leaseId) return json({ error: 'lease_id_required', start_one: `POST ${origin}/api/coding-law/start` }, 422);
  const lease = await env.DB.prepare('SELECT id,agent,intent,start_hash,files_json,state,opened_at FROM code_leases WHERE id=?').bind(leaseId).first();
  if (!lease) return json({ error: 'lease_not_found', lease_id: leaseId }, 404);
  if (lease.state === 'committed') return json({ error: 'lease_already_committed', lease_id: leaseId, note: 'Open a fresh lease for new work — a lease covers one commit.' }, 409);
  if (lease.state === 'released') return json({ error: 'lease_released', lease_id: leaseId, note: 'This lease was released without committing. Open a fresh one and re-read the files first.' }, 409);
  if (leaseExpired(lease.opened_at)) {
    return json({
      error: 'lease_expired',
      lease_id: leaseId,
      opened_at: lease.opened_at,
      age_seconds: leaseAge(lease.opened_at),
      ttl_seconds: LEASE_TTL_SEC,
      note: 'The base versions you recorded are hours old, so committing against them would be a guess rather than a check. Re-read the files, take fresh hashes, open a new lease.',
    }, 409);
  }

  let leased = []; try { leased = JSON.parse(lease.files_json || '[]'); } catch {}
  const baseByPath = new Map(leased.map((f) => [f.path, String(f.base_sha || '').toLowerCase()]));
  const files = normalizeFiles(b.files, 'new_sha');
  if (!files.length) return json({ error: 'files_required', example: '[{"path":"functions/x.js","new_sha":"<sha256 as you are leaving it>"}]' }, 422);
  const badSha = files.filter((f) => !f.valid);
  if (badSha.length) return json({ error: 'new_sha_must_be_sha256', bad: badSha.map((f) => f.path), how: 'shasum -a 256 <path>' }, 422);
  const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const unchanged = files.filter((f) => f.valid
    && baseByPath.get(f.path) !== EMPTY_SHA256
    && baseByPath.get(f.path) === String(f.sha || '').toLowerCase());
  if (unchanged.length) {
    return json({
      error: 'base_equals_result',
      law: 'CODING_LAW',
      paths: unchanged.map((f) => f.path),
      why: 'The base_sha you declared is identical to the new_sha you are committing, so this lease records '
        + 'no change and no prior version. Either the file did not belong in the lease, or the base was taken '
        + 'after the edit — which records a version nobody ever read.',
      how_to_fix: 'Take base_sha BEFORE the first edit (shasum -a 256 <path> on the file as you read it), open '
        + 'the lease, then edit. Drop from the lease any file you did not change. For a file you are '
        + 'CREATING, the base is the sha256 of nothing: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.',
      state_changed: false,
    }, 422);
  }

  const unleased = files.filter((f) => !baseByPath.has(f.path));
  if (unleased.length) {
    return json({
      error: 'file_not_in_lease',
      paths: unleased.map((f) => f.path),
      note: 'A file you never declared has no base version on the record, so nothing can be checked for it. Open a lease that includes it.',
    }, 422);
  }

  // THE CHECK. For each path: is the base this agent declared still the newest committed version?
  const conflicts = [];
  for (const f of files) {
    const head = await newestCommitted(env, f.path);
    if (!head?.new_sha) continue;                       // nobody has committed this path yet
    if (head.lease_id === leaseId) continue;            // our own earlier row
    if (head.new_sha === baseByPath.get(f.path)) continue; // we read exactly what they left
    conflicts.push({
      path: f.path,
      your_base_sha: baseByPath.get(f.path),
      newest_committed_sha: head.new_sha,
      committed_by: head.agent,
      committed_at: head.committed_at,
      conflicting_lease: head.lease_id,
    });
  }

  if (conflicts.length) {
    await env.DB.prepare("UPDATE code_leases SET state='refused', refused_reason=? WHERE id=?")
      .bind(JSON.stringify(conflicts).slice(0, 1500), leaseId).run();
    await logEvent(env, {
      source: 'coding-law', key: 'CODE_LEASE_COMMIT', action: 'refuse', direction: 'in', status: 409,
      request: { lease_id: leaseId, agent: lease.agent, files: files.map((f) => f.path) },
      response: { conflicts },
    });
    return json({
      state: 'REFUSED',
      error: 'overwrite_refused',
      lease_id: leaseId,
      conflicts,
      what_this_means: 'Another agent committed these files after you read them. Committing yours would have erased their work, and nothing in git would have shown it.',
      what_to_do: 'Re-read each named file as it now stands, redo your edit on that text, open a fresh lease, and commit again. Do not force. Do not retry this body.',
      re_read: conflicts.map((c) => c.path),
      fresh_lease: `POST ${origin}/api/coding-law/start`,
    }, 409);
  }

  const commit_hash = await stateHash(files.map((f) => ({ path: f.path, new_sha: f.sha })), 'new_sha');
  const committed_at = new Date().toISOString();
  const merged = leased.map((f) => {
    const now = files.find((x) => x.path === f.path);
    return { path: f.path, base_sha: f.base_sha, new_sha: now ? now.sha : null };
  });
  await env.DB.prepare("UPDATE code_leases SET state='committed', commit_hash=?, committed_at=?, files_json=? WHERE id=?")
    .bind(commit_hash, committed_at, JSON.stringify(merged), leaseId).run();
  for (const f of files) {
    await env.DB.prepare('UPDATE code_lease_files SET new_sha=?, committed_at=? WHERE lease_id=? AND path=?')
      .bind(f.sha, committed_at, leaseId, f.path).run();
  }
  await logEvent(env, {
    source: 'coding-law', key: 'CODE_LEASE_COMMIT', action: 'commit', direction: 'in', status: 200,
    request: { lease_id: leaseId, agent: lease.agent, files: merged },
    response: { commit_hash, committed_at },
  });

  return json({
    state: 'COMMITTED',
    lease_id: leaseId,
    start_hash: lease.start_hash,
    commit_hash,
    committed_at,
    files: merged,
    note: 'Cleared. Every file you leased is still at the version you read. git commit now.',
    chain: `${origin}/api/coding-law/leases`,
  });
}
