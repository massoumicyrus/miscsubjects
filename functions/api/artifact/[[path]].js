import { verifyShareTokenValue, capFingerprint, isBuildAuthed } from '../../_lib/admin_session.js';
import { recordDiscourse, findDuplicate, readDiscourse, familyOf } from '../../_lib/discourse_widgets.js';
import { logEvent } from '../../_lib/event_log.js';

const KINDS = ['collapse', 'redundant', 'rewrite', 'split', 'merge', 'simplify', 'bug', 'dead_code', 'consolidate'];
const TARGET_RE = /^(code|tool|file):[\w./\-\[\]]+$/;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Read a target's current bytes so a proposal can CAS against what it actually read.
async function targetSnapshot(env, target) {
  const [kind, ...rest] = target.split(':');
  const ref = rest.join(':');
  if (kind === 'tool') {
    const row = await env.DB.prepare('SELECT key, type, target AS impl, content FROM directory WHERE key=?').bind(ref).first();
    if (!row) return null;
    const body = String(row.content || row.impl || '');
    return { kind, ref, exists: true, bytes: body.length, hash: await sha256(body), preview: body.slice(0, 400) };
  }
  // code / file — read from the live GitHub tree via the file API's backing (metadata only here).
  if (env.GITHUB_TOKEN && (kind === 'code' || kind === 'file')) {
    try {
      const r = await fetch('https://api.github.com/repos/[OWNER_HANDLE]/miscsubjects-pages/contents/' + ref,
        { headers: { Authorization: 'Bearer ' + env.GITHUB_TOKEN, 'User-Agent': 'miscsubjects-build', Accept: 'application/vnd.github+json' } });
      if (r.ok) { const j = await r.json(); return { kind, ref, exists: true, bytes: j.size, hash: j.sha, url: '/api/file/' + ref }; }
      if (r.status === 404) return { kind, ref, exists: false };
    } catch { /* metadata optional */ }
  }
  return { kind, ref, exists: null, note: 'snapshot unavailable (no GITHUB_TOKEN or unknown kind) — proposal still accepted' };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  // GET — read proposals for a target, or the whole artifact queue.
  if (method === 'GET') {
    const target = url.searchParams.get('target');
    if (target) {
      const feed = await readDiscourse(env, target, 200);
      const snap = TARGET_RE.test(target) ? await targetSnapshot(env, target) : null;
      return json({
        _self: {
          what: 'Artifact recursion — proposals to collapse/merge/simplify this code, tool, or file. Same propose→ratify loop as content, pointed at the build itself.',
          target, snapshot: snap,
          file_propose: 'POST /api/artifact {target:"code:<path>|tool:<KEY>|file:<path>", kind:"' + KINDS.join('|') + '", body, actor, expected_hash?, key?}',
          ratify: 'POST /api/protocol/voxel-ratify {vote_id, decision, key:"owner or rows:VOXEL_RATIFY master token"} — a MASTER edit token canonizes; the coding agent then executes the approved change.',
        },
        target, snapshot: snap,
        open: feed.counts.open, proposals: feed.entries,
      });
    }
    // whole queue: every artifact-namespaced proposal
    let rows = [];
    try {
      rows = (await env.DB.prepare(
        "SELECT id, slug, stance, status, claimed_model, actor_cap, body, filed_at, source_ref FROM discourse WHERE slug LIKE 'code:%' OR slug LIKE 'tool:%' OR slug LIKE 'file:%' ORDER BY filed_at DESC LIMIT 300",
      ).all()).results || [];
    } catch { rows = []; }
    const byStatus = {};
    for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    return json({
      _self: { what: 'The artifact recursion queue — every open proposal to collapse/merge/simplify the build. Ratify with a master token; the coding agent executes.', read_target: '/api/artifact?target=code:<path>', file: 'POST /api/artifact' },
      count: rows.length, by_status: byStatus, proposals: rows,
    });
  }

  if (method !== 'POST') return json({ error: 'GET (read) or POST (propose)' }, 405);

  const b = await request.json().catch(() => ({}));
  const target = String(b.target || '').trim().slice(0, 200);
  if (!TARGET_RE.test(target)) {
    return json({ error: 'target must match code:<path> | tool:<KEY> | file:<path>', example: 'code:functions/api/dispatch.js' }, 400);
  }
  const kind = String(b.kind || '').toLowerCase();
  if (!KINDS.includes(kind)) return json({ error: 'kind must be one of: ' + KINDS.join('|') }, 400);
  const body = String(b.body || '').trim().slice(0, 6000);
  if (body.length < 20) return json({ error: 'body required — the concrete proposal (what to collapse/merge/simplify and why, ideally with the replacement)' }, 400);
  const claimed = String(b.actor || 'anonymous').slice(0, 120);

  // Optional key → capability attribution (filing is open, like content challenges).
  let actorCap = null;
  const rawKey = String(b.key || b.share || '').trim() || ((request.headers.get('authorization') || '').replace(/^bearer\s+/i, '').trim());
  if (rawKey) { const t = await verifyShareTokenValue(env, rawKey); if (t) actorCap = 'cap:' + (await capFingerprint(rawKey)); }

  // Snapshot + optional CAS: prove you read the bytes you propose to change.
  const snap = await targetSnapshot(env, target);
  if (snap && snap.exists === false) return json({ error: 'target does not exist: ' + target + ' — check the directory at /api/directory', snapshot: snap }, 404);
  if (b.expected_hash && snap && snap.hash && String(b.expected_hash) !== String(snap.hash)) {
    return json({ error: 'hash_stale', note: 'the artifact changed since you read it — re-read /api/artifact?target=' + encodeURIComponent(target) + ' and retry', current_hash: snap.hash, snapshot: snap }, 409);
  }

  // Duplicate gate — same target, near-identical proposal collapses to the canonical entry.
  const dup = await findDuplicate(env, target, body);
  if (dup) {
    return json({ error: 'duplicate_match', ...dup, how_to_proceed: 'This collapse was already proposed. Add independent weight by re-filing with duplicate_of:"' + dup.obj_id + '", or sharpen what distinguishes yours.' }, 409);
  }

  const id = 'art-' + (await sha256(target + '|' + kind + '|' + body + '|' + claimed)).slice(0, 12);
  await recordDiscourse(env, {
    id, slug: target, target_div: null, claimed_model: claimed, actor_cap: actorCap,
    stance: 'upgrade', body: '[' + kind + '] ' + body, status: 'proposed',
    content_hash: snap && snap.hash ? snap.hash : null, source_ref: 'artifact:' + kind,
  });
  await logEvent(env, {
    source: 'artifact', key: 'ARTIFACT_PROPOSE', action: 'propose_' + kind,
    direction: 'in', status: 200, actor: actorCap || claimed,
    request: { target, kind, body: body.slice(0, 500), claimed_model: claimed },
    response: { id, status: 'proposed' },
  });
  return json({
    ok: true, id, target, kind, status: 'proposed', actor: actorCap, claimed_model: claimed, family: familyOf(claimed),
    snapshot: snap,
    link: 'https://miscsubjects.com/i/discourse/' + id,
    ratify: 'POST /api/protocol/voxel-ratify {"vote_id":"' + id + '","decision":"approve|reject","key":"<master token>"} — then the coding agent executes the approved change.',
    say_to_user: 'Proposal on the ledger for ' + target + '. Ratify link: https://miscsubjects.com/i/discourse/' + id,
  });
}
