import { verifyShareTokenValue, capFingerprint } from '../../_lib/admin_session.js';
import { logEvent } from '../../_lib/event_log.js';

const BASE = 'https://miscsubjects.com';
const US = '␟';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}
async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function fetchJson(url, ms = 4000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': 'miscsubjects-anchor' } }); return r.ok ? await r.json() : null; }
  catch { return null; } finally { clearTimeout(t); }
}
async function fetchText(url, ms = 4000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': 'miscsubjects-anchor' } }); return r.ok ? (await r.text()).trim() : null; }
  catch { return null; } finally { clearTimeout(t); }
}

// Capture the public surfaces live. Whatever succeeds is bound; each carries its own verify URL.
async function captureSurfaces(env) {
  const surfaces = {};
  // drand — Cloudflare's node first (same infra, reliable), then the League endpoint.
  let dr = await fetchJson('https://drand.cloudflare.com/public/latest');
  if (!dr) dr = await fetchJson('https://api.drand.sh/public/latest');
  if (dr && dr.round != null) {
    surfaces.drand = {
      round: dr.round, randomness: dr.randomness, signature: dr.signature,
      verify: 'https://api.drand.sh/public/' + dr.round,
      note: 'unpredictable before its cadence time; BLS-signed by the League of Entropy — verifiable forever',
    };
  }
  // bitcoin — latest block height + hash (public, unpredictable, timestamped by the network).
  const h = await fetchText('https://mempool.space/api/blocks/tip/height');
  const bh = h && /^\d+$/.test(h) ? await fetchText('https://mempool.space/api/block-height/' + h) : null;
  if (h && bh && /^\d+$/.test(h) && /^[0-9a-f]{64}$/.test(bh)) {
    surfaces.bitcoin = { height: Number(h), hash: bh, verify: 'https://mempool.space/api/block-height/' + h, note: 'a block hash cannot be known before the block is mined — proves the anchor is no older than this block' };
  }
  // This ledger's current chain head. Prefer normalized-time V2 once it has a checkpoint;
  // preserve V1 forever because an older anchor may already cite that published head.
  try {
    let version = 2;
    let cp = await env.LEDGER.prepare('SELECT head, event_count, seq FROM chain_v2_checkpoints ORDER BY seq DESC LIMIT 1').first();
    if (!cp) { version = 1; cp = await env.LEDGER.prepare('SELECT head, event_count, seq FROM chain_checkpoints ORDER BY seq DESC LIMIT 1').first(); }
    if (cp) surfaces.miscsubjects_chain = { version, head: cp.head, event_count: cp.event_count, seq: cp.seq, verify: BASE + '/api/chain/verify?version=' + version + '&head=' + cp.head };
  } catch { /* chain optional */ }
  return surfaces;
}

// The exact sha256 preimage — explicit so any verifier recomputes without ambiguity. Fixed field
// order; a missing surface contributes an empty value but keeps its slot so the recipe is stable.
function canonicalPreimage(packetHash, anchoredAt, s) {
  return [
    'anchor.v1',
    'packet=' + packetHash,
    'at=' + anchoredAt,
    'drand.round=' + (s.drand ? s.drand.round : ''),
    'drand.randomness=' + (s.drand ? s.drand.randomness : ''),
    'btc.height=' + (s.bitcoin ? s.bitcoin.height : ''),
    'btc.hash=' + (s.bitcoin ? s.bitcoin.hash : ''),
    'ms.head=' + (s.miscsubjects_chain ? s.miscsubjects_chain.head : ''),
  ].join(US);
}

const RECIPE = {
  anchor_id: 'anchor_id = SHA256(canonical) where canonical is the exact preimage string returned with the anchor (fields joined by U+241F, fixed order)',
  what_it_proves: 'The packet_hash was bound to a drand round + Bitcoin block that could not be known before they existed — so the anchor cannot have been backdated. Posting the anchor to any external ledger/timestamp gives anteriority. Any change to the source data changes packet_hash, changes anchor_id — tamper is proven.',
  no_data: 'Only the hash (opaque commitment) is ever published. The underlying data never leaves the holder.',
  verify: [
    'recompute anchor_id = SHA256(canonical) and confirm it matches',
    'GET the drand verify URL and confirm round/randomness/signature (BLS, verifiable against the drand group key)',
    'GET the bitcoin verify URL and confirm the block hash at that height',
    'GET the miscsubjects chain verify URL and confirm the head',
    'cross-ledger: any other ledger holding this anchor runs the same steps — no operator trust required',
  ],
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const id = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean)[2] || '';

  if (method === 'GET' && id && id !== 'verify') {
    const row = await env.LEDGER.prepare('SELECT * FROM anchors WHERE anchor_id=?').bind(id).first();
    if (!row) return json({ error: 'anchor not found: ' + id }, 404);
    const [event, cpV2] = await Promise.all([
      row.event_id ? env.LEDGER.prepare('SELECT id,ts,COALESCE(unixepoch(ts),0) chain_epoch FROM events WHERE id=?').bind(row.event_id).first() : null,
      env.LEDGER.prepare('SELECT seq,cutoff_epoch,cutoff_id,event_count,head,sealed_at FROM chain_v2_checkpoints ORDER BY seq DESC LIMIT 1').first(),
    ]);
    const included = !!(event && cpV2 && (Number(cpV2.cutoff_epoch) > Number(event.chain_epoch)
      || (Number(cpV2.cutoff_epoch) === Number(event.chain_epoch) && String(cpV2.cutoff_id) >= String(event.id))));
    return json({
      _self: { what: 'A portable immutability anchor — an opaque packet hash bound to public surfaces. Verify it anywhere; no operator trust.', recipe: RECIPE },
      anchor_id: row.anchor_id, packet_hash: row.packet_hash, label: row.label, anchored_at: row.anchored_at,
      actor: row.actor_cap || row.actor, canonical: row.canonical, surfaces: JSON.parse(row.surfaces_json || '{}'),
      ledger_event: row.event_id,
      chain_inclusion: {
        status: included ? 'PROVEN_INCLUDED_V2' : 'NOT_YET_PROVEN_INCLUDED',
        event_ts: event?.ts || null,
        event_epoch: event?.chain_epoch ?? null,
        checkpoint_seq: cpV2?.seq || null,
        checkpoint_head: cpV2?.head || null,
        proof: cpV2 ? BASE + '/api/chain/verify?version=2&head=' + cpV2.head : BASE + '/api/chain?version=2',
        law: 'V2 starts at genesis and seals in (unixepoch(ts),id) order; an event tuple at or before the latest cutoff is included.',
      },
      chain: BASE + '/api/chain',
    });
  }

  if (method === 'GET' && (id === 'verify' || url.searchParams.get('verify'))) {
    const canonical = url.searchParams.get('canonical');
    const claimed = url.searchParams.get('anchor_id');
    if (!canonical || !claimed) return json({ error: 'verify needs ?canonical=<preimage>&anchor_id=<id>' }, 400);
    const recomputed = await sha256(canonical);
    return json({ _self: { what: 'Recompute an anchor_id from its canonical preimage. Then independently re-fetch each surface URL in the anchor to confirm the bound public values.', recipe: RECIPE }, anchor_id_recomputed: recomputed, matches: recomputed === claimed });
  }

  if (method === 'GET') {
    const rows = (await env.LEDGER.prepare('SELECT anchor_id, packet_hash, label, anchored_at, actor_cap, actor, surfaces_json FROM anchors ORDER BY anchored_at DESC LIMIT 20').all()).results || [];
    const recent = rows.map((r) => {
      let surfaces = null;
      try { surfaces = JSON.parse(r.surfaces_json || 'null'); } catch {}
      const out = { anchor_id: r.anchor_id, packet_hash: r.packet_hash, label: r.label, anchored_at: r.anchored_at, actor_cap: r.actor_cap, actor: r.actor };
      if (surfaces) {
        out.drand_round = surfaces.drand?.round ?? null;
        out.drand_randomness = surfaces.drand?.randomness ?? null;
        out.btc_block_height = surfaces.bitcoin?.height ?? null;
        out.btc_block_hash = surfaces.bitcoin?.hash ?? null;
        out.verify_yourself = {
          drand: surfaces.drand?.verify || null,
          bitcoin: surfaces.bitcoin?.verify || null,
          recipe: 'GET ' + BASE + '/api/anchor/' + r.anchor_id + ' for the canonical preimage, recompute sha256, then re-fetch both public surfaces and compare the bound values.',
        };
      }
      return out;
    });
    return json({
      _self: {
        what: 'Portable immutability anchors. A model hashes a packet (opaque — no data leaves), POSTs the hash, and the server binds it to public surfaces it does not control (drand beacon, Bitcoin block, this ledger head, wall-clock). The anchor is verifiable by anyone on any ledger.',
        file: 'POST /api/anchor {"packet_hash":"<sha256 of your data>", "label":"<optional what-this-is>", "actor":"<model>", "key":"<optional token for attribution>"}',
        read: BASE + '/api/anchor/<anchor_id>',
        verify: BASE + '/api/anchor/verify?canonical=<preimage>&anchor_id=<id>',
        recipe: RECIPE,
      },
      count: recent.length, recent,
    });
  }

  if (method !== 'POST') return json({ error: 'POST to anchor, GET to read/verify' }, 405);

  const b = await request.json().catch(() => ({}));
  const packetHash = String(b.packet_hash || b.hash || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(packetHash)) {
    return json({ error: 'packet_hash must be a 64-hex sha256 of your data (the data itself is never sent — hash it yourself and post only the hash)' }, 400);
  }
  const label = String(b.label || '').slice(0, 200) || null;
  const actor = String(b.actor || 'anonymous').slice(0, 120);
  let actorCap = null;
  const rawKey = String(b.key || b.share || '').trim() || ((request.headers.get('authorization') || '').replace(/^bearer\s+/i, '').trim());
  if (rawKey) { const t = await verifyShareTokenValue(env, rawKey); if (t) actorCap = 'cap:' + (await capFingerprint(rawKey)); }

  const anchoredAt = new Date().toISOString();
  const surfaces = await captureSurfaces(env);
  if (!surfaces.drand && !surfaces.bitcoin) {
    return json({ error: 'no public surface reachable right now (drand + bitcoin both failed) — an anchor with no external surface would be operator-only; retry', surfaces }, 503);
  }
  const canonical = canonicalPreimage(packetHash, anchoredAt, surfaces);
  const anchorId = await sha256(canonical);

  // Log the anchor as a ledger event. Inclusion is true only after a later V2 seal covers its
  // normalized (epoch,id) tuple; GET /api/anchor/<id> reports that state rather than promising it.
  const eventId = await logEvent(env, {
    source: 'anchor', key: 'IMMUTABILITY_ANCHOR', action: 'anchor',
    direction: 'in', status: 200, actor: actorCap || actor,
    request: { packet_hash: packetHash, label }, response: { anchor_id: anchorId, surfaces },
  });
  try {
    await env.LEDGER.prepare(
      'INSERT INTO anchors (anchor_id, packet_hash, label, anchored_at, actor, actor_cap, canonical, surfaces_json, event_id) VALUES (?,?,?,?,?,?,?,?,?)',
    ).bind(anchorId, packetHash, label, anchoredAt, actor, actorCap, canonical, JSON.stringify(surfaces), eventId || null).run();
  } catch (e) {
    // idempotent: same packet + same surfaces in the same instant → same anchor_id
    const existing = await env.LEDGER.prepare('SELECT anchor_id FROM anchors WHERE anchor_id=?').bind(anchorId).first();
    if (!existing) return json({ error: 'anchor_write_failed: ' + (e && e.message) }, 500);
  }

  return json({
    ok: true, anchor_id: anchorId, packet_hash: packetHash, label, anchored_at: anchoredAt,
    actor: actorCap, claimed_model: actor,
    surfaces, canonical,
    recipe: RECIPE,
    read: BASE + '/api/anchor/' + anchorId,
    verify: BASE + '/api/anchor/verify?anchor_id=' + anchorId + '&canonical=' + encodeURIComponent(canonical),
    portable: 'Post this whole record to any other ledger. Anyone recomputes anchor_id = SHA256(canonical) and re-checks the drand/bitcoin/chain URLs. The anchor event is ' + (eventId || 'unavailable') + '; seal V2, then read this anchor again and require chain_inclusion.status=PROVEN_INCLUDED_V2 before claiming it folded into this ledger.',
    say_to_user: 'Immutability anchor ' + anchorId.slice(0, 16) + '… bound to ' + Object.keys(surfaces).join(' + ') + '. Verify: ' + BASE + '/api/anchor/' + anchorId,
  });
}
