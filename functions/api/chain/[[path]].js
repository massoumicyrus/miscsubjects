import { isBuildAuthed } from '../../_lib/admin_session.js';
import { homePrivateJwk } from '../../_lib/oip_federation.js';
import { publicJwkFromPrivate } from '../../_lib/oip_envelope.js';

const BASE = 'https://miscsubjects.com';
const US = '␟'; // unit separator — canonical field delimiter, cannot appear in the data

// ---- MERKLE LAYER (spec Phase 5, migration 0359) ----
// The linear chain proves append-only history but forces a verifier to re-hash EVERYTHING to
// check ANYTHING. Each v2 seal now also builds an RFC-6962-STYLE Merkle tree over that batch's
// leaf digests (domain-separated hashing, "leaf␟"/"node␟" prefixes — deterministic and printed in
// the recipe, not byte-compatible with RFC 6962's 0x00/0x01), stores the leaves, signs the
// checkpoint with the home ES256 key, and serves O(log n) inclusion proofs. Consistency ACROSS
// checkpoints is the checkpoint chain itself (each binds prev_head), verified at /verify.
async function merkleParents(level) {
  const out = [];
  for (let i = 0; i < level.length; i += 2) {
    out.push(i + 1 < level.length ? await sha256('node' + US + level[i] + US + level[i + 1]) : level[i]);
  }
  return out;
}
async function merkleRoot(leafDigests) {
  if (!leafDigests.length) return 'empty';
  let level = [];
  for (const d of leafDigests) level.push(await sha256('leaf' + US + d));
  while (level.length > 1) level = await merkleParents(level);
  return level[0];
}
async function merkleProof(leafDigests, idx) {
  let level = [];
  for (const d of leafDigests) level.push(await sha256('leaf' + US + d));
  const path = [];
  let i = idx;
  while (level.length > 1) {
    const sib = i % 2 === 0 ? i + 1 : i - 1;
    if (sib < level.length) path.push({ side: sib < i ? 'left' : 'right', hash: level[sib] });
    level = await merkleParents(level);
    i = Math.floor(i / 2);
  }
  return { path, root: level[0] };
}
function checkpointSigningPayload(seq, treeSize, root, head, sealedAt) {
  return ['msjc.checkpoint.v1', seq, treeSize, root, head, sealedAt].join(US);
}
function b64u(bytes) {
  let s = ''; const u = new Uint8Array(bytes);
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function signCheckpoint(env, seq, treeSize, root, head, sealedAt) {
  const jwk = homePrivateJwk(env);
  if (!jwk) return null;
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const payload = checkpointSigningPayload(seq, treeSize, root, head, sealedAt);
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(payload));
    return { payload, alg: 'ES256', kid: 'oip-home', signature: b64u(sig), public_jwk: publicJwkFromPrivate(jwk) };
  } catch { return null; }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=15' },
  });
}
async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Canonical content commitment for one event — the digest the leaf binds to. Uses full stored
// JSON when present, else the preview. Never served raw; only its digest travels.
async function contentDigest(e) {
  const req = e.request_json != null ? e.request_json : (e.request_preview || '');
  const res = e.response_json != null ? e.response_json : (e.response_preview || '');
  return sha256(String(req) + US + String(res));
}
// Canonical leaf digest — binds identity + metadata + content commitment. Reproducible by any
// verifier from the fields the /leaves endpoint serves.
async function leafDigest(e, cd) {
  const line = [
    e.id, e.ts, e.source || '', e.key || '', e.actor || '', e.action || '',
    e.direction || '', e.status == null ? '' : e.status,
    e.request_size == null ? '' : e.request_size, e.response_size == null ? '' : e.response_size,
    e.trace_id || '', cd,
  ].join(US);
  return sha256(line);
}
async function checkpointHash(prevHead, cutoffTs, cutoffId, count, head) {
  return sha256([prevHead, cutoffTs, cutoffId, count, head].join(US));
}
async function checkpointHashV2(prevHead, cutoffEpoch, cutoffId, count, head) {
  return sha256(['v2', prevHead, cutoffEpoch, cutoffId, count, head].join(US));
}

async function latestCheckpoint(env) {
  return env.LEDGER.prepare('SELECT * FROM chain_checkpoints ORDER BY seq DESC LIMIT 1').first();
}
async function latestCheckpointV2(env) {
  return env.LEDGER.prepare('SELECT * FROM chain_v2_checkpoints ORDER BY seq DESC LIMIT 1').first();
}

const RECIPE = {
  order: 'V1 legacy order: events sorted by raw (ts asc, id asc). V1 remains published for historical-head verification only.',
  leaf: 'leaf_digest = SHA256( id ␟ ts ␟ source ␟ key ␟ actor ␟ action ␟ direction ␟ status ␟ request_size ␟ response_size ␟ trace_id ␟ content_digest ) where ␟ is U+241F and content_digest = SHA256(request ␟ response)',
  head: 'head_0 = "genesis"; head_i = SHA256( head_(i-1) ␟ leaf_digest_i ); head = head_n',
  checkpoint: 'checkpoint_hash = SHA256( prev_head ␟ cutoff_ts ␟ cutoff_id ␟ event_count ␟ head )',
  verify: 'fetch /api/chain/leaves (paginate with after_ts/after_id), recompute head; fetch the DKIM-anchored email, verify its signature against the archived selector public key, compare its head to the recomputed head byte-for-byte',
};
const RECIPE_V2 = {
  order: 'events sorted by (COALESCE(unixepoch(ts),0) asc, id asc) — Z and explicit-offset ISO timestamps represent the same instant',
  leaf: RECIPE.leaf,
  head: RECIPE.head,
  checkpoint: 'checkpoint_hash = SHA256( "v2" ␟ prev_head ␟ cutoff_epoch ␟ cutoff_id ␟ event_count ␟ head )',
  verify: 'fetch /api/chain/leaves?version=2 (paginate with after_epoch/after_id), recompute the head, then compare it byte-for-byte with /api/chain/head?version=2',
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const seg = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean)[2] || '';
  const requestedVersion = url.searchParams.get('version');
  const version = requestedVersion === '1' ? 1 : requestedVersion === '2' ? 2 : ((await latestCheckpointV2(env)) ? 2 : 1);
  const recipe = version === 1 ? RECIPE : RECIPE_V2;

  if (method === 'GET' && seg === 'head') {
    const cp = version === 1 ? await latestCheckpoint(env) : await latestCheckpointV2(env);
    if (!cp) return json({ error: 'unsealed', note: 'no checkpoint yet — POST /api/chain/seal (owner) to establish the genesis head' }, 404);
    return json({
      _self: { what: 'The current ledger chain head for this version. A separately published copy of this exact string is the external anchor.', anchor_body: cp.head, recipe: recipe.head },
      version,
      head: cp.head, checkpoint_hash: cp.checkpoint_hash, seq: cp.seq,
      event_count: cp.event_count, cutoff_ts: cp.cutoff_ts, sealed_at: cp.sealed_at,
      anchor_instructions: 'Email this head string (or the full JSON) from an account whose domain publishes a DKIM key. Archive the selector public key at send time. Anchor through >=2 independent domains. Then this head is externally immutable: rewriting the ledger would require forging every anchoring provider\'s signature.',
    });
  }

  // Latest (or ?seq=) signed checkpoint: Merkle root + ES256 signature + the exact signed payload
  // and public key, so a witness or any third party can verify offline. Unsigned rows say so.
  if (method === 'GET' && seg === 'checkpoint') {
    try {
      const seqParam = url.searchParams.get('seq');
      const sig = seqParam
        ? await env.LEDGER.prepare('SELECT * FROM chain_checkpoint_signatures WHERE seq=?').bind(Number(seqParam)).first()
        : await env.LEDGER.prepare('SELECT * FROM chain_checkpoint_signatures ORDER BY seq DESC LIMIT 1').first();
      if (!sig) return json({ error: 'no_signed_checkpoint_yet', note: 'Merkle coverage begins at the first v2 seal after migration 0359. The linear chain remains verifiable at /api/chain/verify.' }, 404);
      const cp = await env.LEDGER.prepare('SELECT seq, head, event_count, leaves_added, sealed_at FROM chain_v2_checkpoints WHERE seq=?').bind(sig.seq).first();
      const jwk = homePrivateJwk(env);
      return json({
        _self: {
          what: 'A signed Merkle checkpoint over one seal batch. Verify: recompute the payload string, verify the ES256 signature against public_jwk, then check any leaf via /api/chain/proof.',
          payload_recipe: 'msjc.checkpoint.v1 ␟ seq ␟ tree_size ␟ merkle_root ␟ head ␟ sealed_at (␟ = U+241F)',
          tree_recipe: 'leaf_i = SHA256("leaf" ␟ leaf_digest_i); parent = SHA256("node" ␟ left ␟ right); odd node promotes',
        },
        seq: sig.seq, merkle_root: sig.merkle_root, payload: sig.payload,
        alg: sig.alg, kid: sig.kid, signature: sig.signature, signed_at: sig.signed_at,
        public_jwk: jwk ? publicJwkFromPrivate(jwk) : null,
        checkpoint: cp || null,
        consistency: 'across checkpoints, each row binds prev_head — recomputed at /api/chain/verify',
      });
    } catch (e) { return json({ error: 'checkpoint_unavailable', detail: String(e?.message || e) }, 503); }
  }

  // O(log n) inclusion proof for one event within its sealed batch.
  if (method === 'GET' && seg === 'proof') {
    try {
      const eventId = String(url.searchParams.get('event_id') || '').trim();
      const leaf = String(url.searchParams.get('leaf') || '').trim();
      const row = eventId
        ? await env.LEDGER.prepare('SELECT * FROM chain_merkle_leaves WHERE event_id=?').bind(eventId).first()
        : leaf ? await env.LEDGER.prepare('SELECT * FROM chain_merkle_leaves WHERE leaf_digest=?').bind(leaf).first() : null;
      if (!row) return json({ error: 'leaf_not_in_merkle_coverage', note: 'pass ?event_id= or ?leaf=<leaf_digest>. Coverage begins at the first v2 seal after migration 0359; earlier events verify via the linear chain (/api/chain/leaves + /verify).' }, 404);
      const all = (await env.LEDGER.prepare('SELECT leaf_digest FROM chain_merkle_leaves WHERE seq=? ORDER BY idx ASC').bind(row.seq).all()).results || [];
      const { path, root } = await merkleProof(all.map((r) => r.leaf_digest), Number(row.idx));
      const sig = await env.LEDGER.prepare('SELECT * FROM chain_checkpoint_signatures WHERE seq=?').bind(row.seq).first();
      return json({
        _self: { what: 'Inclusion proof: fold the leaf up the path (leaf-hash first, then node-hashes per side) and compare to merkle_root; then verify the signed checkpoint at /api/chain/checkpoint?seq=' + row.seq },
        event_id: row.event_id, leaf_digest: row.leaf_digest, seq: row.seq, idx: row.idx,
        tree_size: all.length, path, merkle_root: root,
        root_matches_signed: sig ? sig.merkle_root === root : null,
        signed_checkpoint: BASE + '/api/chain/checkpoint?seq=' + row.seq,
      });
    } catch (e) { return json({ error: 'proof_unavailable', detail: String(e?.message || e) }, 503); }
  }

  if (method === 'GET' && seg === 'leaves') {
    const afterId = url.searchParams.get('after_id') || '';
    const limit = Math.min(2000, Math.max(1, parseInt(url.searchParams.get('limit') || '1000', 10)));
    const afterTs = url.searchParams.get('after_ts') || '';
    const afterEpoch = parseInt(url.searchParams.get('after_epoch') || '0', 10) || 0;
    const baseSelect = `SELECT id, ts, source, key, actor, action, direction, status, trace_id, request_size, response_size,
              request_json, response_json, request_preview, response_preview`;
    const rows = version === 1
      ? (await env.LEDGER.prepare(
          `${baseSelect} FROM events WHERE (ts > ?1) OR (ts = ?1 AND id > ?2) ORDER BY ts ASC, id ASC LIMIT ?3`,
        ).bind(afterTs, afterId, limit).all()).results || []
      : (await env.LEDGER.prepare(
          `${baseSelect}, COALESCE(unixepoch(ts),0) chain_epoch FROM events
           WHERE COALESCE(unixepoch(ts),0) > ?1 OR (COALESCE(unixepoch(ts),0) = ?1 AND id > ?2)
           ORDER BY chain_epoch ASC, id ASC LIMIT ?3`,
        ).bind(afterEpoch, afterId, limit).all()).results || [];
    const leaves = [];
    for (const e of rows) {
      const cd = await contentDigest(e);
      leaves.push({ id: e.id, ts: e.ts, chain_epoch: version === 2 ? e.chain_epoch : undefined, source: e.source, key: e.key, actor: e.actor, action: e.action, direction: e.direction, status: e.status, request_size: e.request_size, response_size: e.response_size, trace_id: e.trace_id, content_digest: cd, leaf_digest: await leafDigest(e, cd) });
    }
    const last = leaves[leaves.length - 1];
    return json({
      _self: { what: 'Canonical leaves in chain order — recompute the head by folding leaf_digest with head_i = SHA256(head_(i-1) ␟ leaf_digest_i). Content travels as a digest only; raw payloads are never exposed.', recipe },
      version,
      count: leaves.length,
      next_cursor: last ? (version === 2 ? { after_epoch: last.chain_epoch, after_id: last.id } : { after_ts: last.ts, after_id: last.id }) : null,
      more: leaves.length === limit,
      leaves,
    });
  }

  if (method === 'GET' && seg === 'verify') {
    const claimed = String(url.searchParams.get('head') || '').trim();
    const table = version === 1 ? 'chain_checkpoints' : 'chain_v2_checkpoints';
    const chain = (await env.LEDGER.prepare(`SELECT * FROM ${table} ORDER BY seq ASC`).all()).results || [];
    let prev = 'genesis', ok = true, brokeAt = null;
    for (const cp of chain) {
      const h = version === 1
        ? await checkpointHash(cp.prev_head, cp.cutoff_ts, cp.cutoff_id, cp.event_count, cp.head)
        : await checkpointHashV2(cp.prev_head, cp.cutoff_epoch, cp.cutoff_id, cp.event_count, cp.head);
      if (cp.prev_head !== prev || h !== cp.checkpoint_hash) { ok = false; brokeAt = cp.seq; break; }
      prev = cp.head;
    }
    const head = chain.length ? chain[chain.length - 1].head : 'genesis';
    const claimedKnown = claimed ? chain.some((cp) => cp.head === claimed) : null;
    return json({
      _self: { what: 'Recomputes the checkpoint chain from stored fields and confirms each link. To verify the LEAVES too, pull the same version of /api/chain/leaves and fold them yourself.', recipe },
      version,
      checkpoint_chain_valid: ok, broke_at_seq: brokeAt, checkpoints: chain.length, head,
      claimed_head_matches: claimed ? claimed === head : null,
      claimed_head_known: claimedKnown,
      note: claimed && claimedKnown && claimed !== head ? 'claimed head is a valid historical checkpoint in this preserved chain version; it is not the current head' : null,
    });
  }

  if (method === 'POST' && seg === 'seal') {
    if (!(await isBuildAuthed(request, env))) return json({ error: 'unauthorized — the owner or a master token seals the chain' }, 401);
    const b = await request.json().catch(() => ({}));
    const batch = Math.min(20000, Math.max(100, parseInt(b.batch || '10000', 10)));
    const sealVersion = b.version === 1 ? 1 : 2;
    const cp = sealVersion === 1 ? await latestCheckpoint(env) : await latestCheckpointV2(env);
    let head = cp ? cp.head : 'genesis';
    let afterTs = cp ? cp.cutoff_ts : '';
    let afterId = cp ? cp.cutoff_id : '';
    let afterEpoch = cp && sealVersion === 2 ? Number(cp.cutoff_epoch) : 0;
    const startCount = cp ? cp.event_count : 0;
    const baseSelect = `SELECT id, ts, source, key, actor, action, direction, status, trace_id, request_size, response_size,
              request_json, response_json, request_preview, response_preview`;
    const rows = sealVersion === 1
      ? (await env.LEDGER.prepare(
          `${baseSelect} FROM events WHERE (ts > ?1) OR (ts = ?1 AND id > ?2) ORDER BY ts ASC, id ASC LIMIT ?3`,
        ).bind(afterTs, afterId, batch).all()).results || []
      : (await env.LEDGER.prepare(
          `${baseSelect}, COALESCE(unixepoch(ts),0) chain_epoch FROM events
           WHERE COALESCE(unixepoch(ts),0) > ?1 OR (COALESCE(unixepoch(ts),0) = ?1 AND id > ?2)
           ORDER BY chain_epoch ASC, id ASC LIMIT ?3`,
        ).bind(afterEpoch, afterId, batch).all()).results || [];
    if (!rows.length) {
      return json({ ok: true, sealed: false, version: sealVersion, note: 'chain already current — no new events', head, event_count: startCount, seq: cp ? cp.seq : 0 });
    }
    let lastTs = afterTs, lastId = afterId;
    const batchLeaves = []; // [event_id, leaf_digest] for the Merkle layer (v2 seals)
    for (const e of rows) {
      const cd = await contentDigest(e);
      const ld = await leafDigest(e, cd);
      head = await sha256(head + US + ld);
      if (sealVersion === 2) batchLeaves.push([e.id, ld]);
      lastTs = e.ts; lastId = e.id; if (sealVersion === 2) afterEpoch = Number(e.chain_epoch);
    }
    const newCount = startCount + rows.length;
    const prevHead = cp ? cp.head : 'genesis';
    const chHash = sealVersion === 1
      ? await checkpointHash(prevHead, lastTs, lastId, newCount, head)
      : await checkpointHashV2(prevHead, afterEpoch, lastId, newCount, head);
    let merkleStatus = null;
    if (sealVersion === 1) {
      await env.LEDGER.prepare(
        'INSERT INTO chain_checkpoints (cutoff_ts, cutoff_id, event_count, leaves_added, head, prev_head, checkpoint_hash, sealed_at, sealed_by) VALUES (?,?,?,?,?,?,?,?,?)',
      ).bind(lastTs, lastId, newCount, rows.length, head, prevHead, chHash, new Date().toISOString(), b.actor || 'owner').run();
    } else {
      const sealedAt = new Date().toISOString();
      await env.LEDGER.prepare(
        'INSERT INTO chain_v2_checkpoints (cutoff_epoch, cutoff_ts, cutoff_id, event_count, leaves_added, head, prev_head, checkpoint_hash, sealed_at, sealed_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
      ).bind(afterEpoch, lastTs, lastId, newCount, rows.length, head, prevHead, chHash, sealedAt, b.actor || 'owner').run();
      // Merkle layer. Since 0359 shipped, multi-row leaf inserts silently threw on every seal, so
      // the leaves table and every signature sat empty across 255 checkpoints. The multi-row insert
      // bound 80–160 params and the D1 Workers binding rejected it; single-row inserts (4 binds) are
      // proven safe, so leaves go in one row at a time via batch(). The error is no longer swallowed
      // blind — merkle_status/sign_status ride back on the response so a failure is visible, and a
      // signing failure still records an 'unsigned' row so a checkpoint always exists.
      try {
        const cp2 = await latestCheckpointV2(env);
        const seq = Number(cp2.seq);
        const stmts = batchLeaves.map(([eid, ld], j) => env.LEDGER
          .prepare('INSERT INTO chain_merkle_leaves (seq, idx, event_id, leaf_digest) VALUES (?,?,?,?)')
          .bind(seq, j, eid, ld));
        for (let i = 0; i < stmts.length; i += 20) await env.LEDGER.batch(stmts.slice(i, i + 20));
        const root = await merkleRoot(batchLeaves.map(([, ld]) => ld));
        let signed = null;
        try { signed = await signCheckpoint(env, seq, batchLeaves.length, root, head, sealedAt); } catch { signed = null; }
        await env.LEDGER.prepare(
          'INSERT INTO chain_checkpoint_signatures (seq, merkle_root, payload, alg, kid, signature, signed_at) VALUES (?,?,?,?,?,?,?)',
        ).bind(seq, root, signed ? signed.payload : checkpointSigningPayload(seq, batchLeaves.length, root, head, sealedAt), signed ? signed.alg : 'unsigned', signed ? signed.kid : null, signed ? signed.signature : '', sealedAt).run();
        merkleStatus = { ok: true, leaves: batchLeaves.length, root, signed: !!signed, alg: signed ? signed.alg : 'unsigned' };
      } catch (e) { merkleStatus = { ok: false, error: String(e?.message || e).slice(0, 200) }; }
    }
    return json({
      merkle: merkleStatus,
      ok: true, sealed: true, version: sealVersion, leaves_added: rows.length, event_count: newCount, head, checkpoint_hash: chHash,
      more: rows.length === batch, cursor: sealVersion === 2 ? { after_epoch: afterEpoch, after_id: lastId } : { after_ts: lastTs, after_id: lastId },
      note: rows.length === batch ? 'batch full — POST /api/chain/seal again to continue folding history' : 'chain current through this seal',
    });
  }

  // default: the chain overview
  const [cpV1, cpV2] = await Promise.all([latestCheckpoint(env), latestCheckpointV2(env)]);
  const cp = cpV2 || cpV1;
  const activeVersion = cpV2 ? 2 : 1;
  const chain = (await env.LEDGER.prepare(`SELECT seq, cutoff_ts, event_count, leaves_added, head, prev_head, checkpoint_hash, sealed_at FROM ${activeVersion === 2 ? 'chain_v2_checkpoints' : 'chain_checkpoints'} ORDER BY seq DESC LIMIT 50`).all()).results || [];
  return json({
    _self: {
      what: 'The miscsubjects ledger transparency chain. V2 normalizes timestamp offsets before ordering; V1 remains readable so previously published heads never disappear.',
      why: 'A hash chain proves tamper only when a head is independently published. The API distinguishes a valid internal chain from an externally anchored head.',
      head: cp ? cp.head : null,
      head_url: BASE + '/api/chain/head',
      leaves_url: BASE + '/api/chain/leaves?version=' + activeVersion + '&limit=1000 (paginate with next_cursor)',
      verify_url: BASE + '/api/chain/verify?version=' + activeVersion + '&head=<claimed>',
      recipe: activeVersion === 2 ? RECIPE_V2 : RECIPE,
    },
    version: activeVersion, sealed: !!cp,
    event_count: cp ? cp.event_count : 0,
    head: cp ? cp.head : null,
    checkpoints: chain,
    preserved_v1: cpV1 ? { head: cpV1.head, event_count: cpV1.event_count, verify: BASE + '/api/chain/verify?version=1&head=' + cpV1.head } : null,
  });
}
