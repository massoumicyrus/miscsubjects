// SEND PROOF — mint, verify and countersign the proof-of-work behind every outbound email.
//
// THE FAILURE (owner, 2026-08-11): the build emailed strangers telling them their AI agents could
// verify its work, and there was nothing to verify — no token in the email, no public ledger of
// sends, no door for an agent to check the machinery and sign what it found. "There is no actual
// way for anyone to verify the work that you do."
//
// THE MECHANISM, in one pass:
//   1. The send path calls mintSendProof() BEFORE the message leaves. That appends one hash-chained
//      row to send_ledger and returns a verify URL the body must carry.
//   2. email_send_law rule 5 refuses any external body without that URL, at both send paths, so a
//      caller that skips the mint cannot send.
//   3. Any agent GETs the verify URL (public, keyless), recomputes the chain, inspects the evidence
//      — how the recipient was found, what was sent, the sha256 of the exact body — then POSTs a
//      witness: a token is minted for it keylessly, and its countersignature is appended to the
//      same chain. Verification is an action on the ledger, never a claim in prose.
//
// The chain style is the same as work_actions (functions/_lib/work_object.js): each row's hash is
// sha256(prev_hash + '|' + canonical JSON payload). Rows are never updated; corrections append.

import { mintShareToken, saveCapability, capFingerprint } from './admin_session.js';
import { logEvent } from './event_log.js';

const BASE = 'https://miscsubjects.com';

export const WITNESS_ROW_KEY = 'SEND_WITNESS';
export const WITNESS_VERDICTS = ['VERIFIED', 'CONTRADICTED', 'INCONCLUSIVE'];
const WITNESS_TOKEN_TTL_SEC = 60 * 60 * 24 * 7;
const MAX_NOTE = 2000;
const MAX_ACTOR = 120;

export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str ?? '')));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randId(prefix) {
  const buf = crypto.getRandomValues(new Uint8Array(9));
  return prefix + [...buf].map((b) => b.toString(36)).join('').replace(/[^a-z0-9]/g, '').slice(0, 14);
}

/** The canonical payload a row's hash commits to. Field order is fixed; changing it breaks every
 *  verifier, so it never changes — extensions go inside `evidence`. */
function chainPayload(row) {
  return JSON.stringify({
    proof_id: row.proof_id, kind: row.kind, parent_proof: row.parent_proof ?? null, ts: row.ts,
    recipient_domain: row.recipient_domain ?? null, recipient_sha256: row.recipient_sha256 ?? null,
    subject: row.subject ?? null, body_sha256: row.body_sha256 ?? null, evidence: row.evidence ?? null,
    agent: row.agent ?? null, model: row.model ?? null, verdict: row.verdict ?? null,
    note: row.note ?? null, capability: row.capability ?? null,
  });
}

async function appendRow(env, row) {
  const prev = await env.DB.prepare('SELECT hash FROM send_ledger ORDER BY id DESC LIMIT 1').first();
  const prev_hash = prev?.hash || 'genesis';
  const hash = await sha256Hex(prev_hash + '|' + chainPayload(row));
  await env.DB.prepare(
    `INSERT INTO send_ledger
       (proof_id,kind,parent_proof,ts,recipient_domain,recipient_sha256,subject,body_sha256,evidence,agent,model,verdict,note,capability,prev_hash,hash)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    row.proof_id, row.kind, row.parent_proof ?? null, row.ts,
    row.recipient_domain ?? null, row.recipient_sha256 ?? null, row.subject ?? null,
    row.body_sha256 ?? null, row.evidence ?? null, row.agent ?? null, row.model ?? null,
    row.verdict ?? null, row.note ?? null, row.capability ?? null, prev_hash, hash,
  ).run();
  await logEvent(env, {
    kind: 'send_proof', service: 'verify', status: 'recorded',
    summary: `${row.kind} ${row.proof_id}` + (row.parent_proof ? ` → ${row.parent_proof}` : ''),
    payload: { proof_id: row.proof_id, kind: row.kind, hash, prev_hash },
  }).catch(() => {});
  return { hash, prev_hash };
}

/** Recompute the whole chain. Returns { valid, checked, broken_at }. */
export async function verifyChain(env) {
  const rows = (await env.DB.prepare('SELECT * FROM send_ledger ORDER BY id ASC').all()).results || [];
  let prev = 'genesis';
  for (const r of rows) {
    if (r.prev_hash !== prev) return { valid: false, checked: rows.length, broken_at: r.proof_id, why: 'prev_hash does not point at the preceding row' };
    const expect = await sha256Hex(prev + '|' + chainPayload(r));
    if (expect !== r.hash) return { valid: false, checked: rows.length, broken_at: r.proof_id, why: 'row hash does not match its payload' };
    prev = r.hash;
  }
  return { valid: true, checked: rows.length, head: prev };
}

function domainOf(email) {
  const at = String(email || '').lastIndexOf('@');
  return at > 0 ? String(email).slice(at + 1).toLowerCase() : null;
}

/** Look up how a recipient was found — the lead-scraping provenance the recipient's agent can
 *  check. Absent a lead row, the evidence says so honestly rather than inventing provenance. */
async function leadProvenance(env, email) {
  try {
    const lead = await env.DB.prepare(
      'SELECT id, created_at, name, segment, city, source, status FROM leads WHERE lower(email)=? ORDER BY id DESC LIMIT 1',
    ).bind(String(email).toLowerCase()).first();
    if (!lead) return { found_via: 'not a scraped lead — direct correspondence' };
    return {
      found_via: 'lead discovery',
      lead_id: lead.id,
      discovered_at: lead.created_at,
      business: lead.name,
      segment: lead.segment,
      city: lead.city,
      source: lead.source,
      machinery: BASE + '/api/directory/LEADS_DISCOVER',
    };
  } catch {
    return { found_via: 'unknown — leads table unreadable at mint time' };
  }
}

export function verifyUrlOf(proofId) {
  return BASE + '/verify/' + proofId;
}

/** The paragraph injected into every outbound body. Plain text; the HTML wrapper renders it. */
export function verifyBlockText(proofId) {
  return 'This message is receipted on a public, hash-chained ledger before it is sent. '
    + 'Verify it — and the work behind it — at ' + verifyUrlOf(proofId) + ' . '
    + 'An AI agent can open that address, recompute the chain, mint its own witness token (no key, '
    + 'no account) and countersign the ledger. A message without a resolvable receipt at that '
    + 'address was not sent by this build.';
}

/**
 * Mint the proof row for one outbound send. Called by /api/email/send AFTER the verify block is in
 * the body (body_sha256 commits to the exact text a recipient sees) and after the send law passes.
 *
 * @returns {Promise<{proof_id, verify_url, hash}>}
 */
export async function mintSendProof(env, { proofId, to, subject, finalText, kind, extraEvidence } = {}) {
  const recipients = (Array.isArray(to) ? to : String(to || '').split(','))
    .map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  const first = recipients[0] || null;
  const evidence = {
    recipients: recipients.length,
    provenance: first ? await leadProvenance(env, first) : null,
    sent_via: BASE + '/api/email/send',
    send_law: BASE + '/a/outreach-law',
    ...(extraEvidence || {}),
  };
  const row = {
    proof_id: proofId || randId('snd_'),
    kind: kind || 'email_send',
    parent_proof: null,
    ts: new Date().toISOString(),
    recipient_domain: first ? domainOf(first) : null,
    recipient_sha256: first ? await sha256Hex(first) : null,
    subject: String(subject || '').slice(0, 300),
    body_sha256: finalText ? await sha256Hex(String(finalText)) : null,
    evidence: JSON.stringify(evidence),
  };
  const { hash } = await appendRow(env, row);
  return { proof_id: row.proof_id, verify_url: verifyUrlOf(row.proof_id), hash };
}

/** One proof row plus its witnesses, engagement, and chain head — everything a verifier needs. */
export async function getProof(env, proofId) {
  const row = await env.DB.prepare('SELECT * FROM send_ledger WHERE proof_id=?').bind(String(proofId)).first();
  if (!row) return null;
  const witnesses = (await env.DB.prepare(
    'SELECT proof_id, ts, agent, model, verdict, note, capability, prev_hash, hash FROM send_ledger WHERE parent_proof=? ORDER BY id ASC',
  ).bind(row.proof_id).all()).results || [];
  let engagement = null;
  try {
    const ev = JSON.parse(row.evidence || '{}');
    if (ev.tracking_id) {
      const t = await env.DB.prepare(
        'SELECT sent_at, send_status, opens, clicks, first_open_at FROM email_sends WHERE id=?',
      ).bind(String(ev.tracking_id)).first();
      if (t) engagement = t;
    }
  } catch { /* evidence is display data; a parse failure never hides the row */ }
  return { row, witnesses, engagement };
}

/**
 * Countersign one send: keyless. The caller names itself, a token is minted FOR it (the same
 * self-minted-credential door the article comment ledger uses), and the witness row is appended
 * to the chain carrying that token's fingerprint. Returns the row and the token so the agent can
 * hold what signed on its behalf.
 */
export async function witnessSign(env, proofId, { agent, model, verdict, note } = {}) {
  const parent = await env.DB.prepare('SELECT proof_id, kind FROM send_ledger WHERE proof_id=?').bind(String(proofId)).first();
  if (!parent) return { ok: false, status: 404, error: 'no_such_proof', how_to_fix: 'GET ' + BASE + '/api/verify for the ledger; witness an existing snd_ row.' };
  if (parent.kind === 'witness') return { ok: false, status: 422, error: 'cannot_witness_a_witness', how_to_fix: 'Countersign the send row (snd_…), not another signature.' };
  const who = String(agent || '').trim().slice(0, MAX_ACTOR);
  if (!who) return { ok: false, status: 422, error: 'agent_required', how_to_fix: 'Name yourself. A countersignature from nobody attests nothing.' };
  const v = String(verdict || 'VERIFIED').trim().toUpperCase();
  if (!WITNESS_VERDICTS.includes(v)) {
    return { ok: false, status: 422, error: 'unknown_verdict', allowed: WITNESS_VERDICTS };
  }
  // Idempotence over ceremony: the same agent re-signing the same send with the same verdict is a
  // client retry, not a second attestation. Return the existing row instead of chaining a duplicate.
  const dup = await env.DB.prepare(
    'SELECT proof_id, hash FROM send_ledger WHERE parent_proof=? AND agent=? AND verdict=? LIMIT 1',
  ).bind(parent.proof_id, who, v).first();
  if (dup) return { ok: true, duplicate: true, witness_id: dup.proof_id, hash: dup.hash };

  const minted = await mintShareToken(env, { ttlSec: WITNESS_TOKEN_TTL_SEC, scope: 'row:' + WITNESS_ROW_KEY, maxUses: 0 });
  const fingerprint = minted?.token ? await capFingerprint(minted.token) : null;
  if (minted?.token) {
    await saveCapability(env, {
      fingerprint, nonce: minted.nonce, ts: new Date().toISOString(),
      expires_at: new Date(minted.exp * 1000).toISOString(),
      scope: 'row', row_key: WITNESS_ROW_KEY, max_uses: 0,
      purpose: 'countersign send proof ' + parent.proof_id,
      actor: who, issuer: 'send-verify-door', risk_ceiling: 'low',
    }).catch(() => {});
  }
  const row = {
    proof_id: randId('wit_'),
    kind: 'witness',
    parent_proof: parent.proof_id,
    ts: new Date().toISOString(),
    agent: who,
    model: model ? String(model).slice(0, MAX_ACTOR) : null,
    verdict: v,
    note: note ? String(note).slice(0, MAX_NOTE) : null,
    capability: fingerprint,
  };
  const { hash, prev_hash } = await appendRow(env, row);
  return {
    ok: true, witness_id: row.proof_id, parent_proof: parent.proof_id, verdict: v,
    hash, prev_hash, token_fingerprint: fingerprint,
    your_row: BASE + '/api/verify/' + parent.proof_id,
  };
}

/**
 * Backfill: every email already in email_sends gets a proof row (kind email_send_backfill), so the
 * ledger covers the sends that went out before this existed. Repairing every object of the class,
 * not only the ones created after the repair. Idempotent — rows already covered are skipped.
 */
export async function backfillFromEmailSends(env, limit = 500) {
  const rows = (await env.DB.prepare(
    `SELECT e.id, e.to_email, e.subject, e.body, e.kind, e.sent_at, e.lead_id
       FROM email_sends e
      WHERE NOT EXISTS (SELECT 1 FROM send_ledger s WHERE s.evidence LIKE '%"tracking_id":"' || e.id || '"%')
      ORDER BY e.sent_at ASC LIMIT ?`,
  ).bind(Math.max(1, Math.min(Number(limit) || 500, 500))).all()).results || [];
  let done = 0;
  for (const e of rows) {
    const first = String(e.to_email || '').split(',')[0].trim().toLowerCase();
    const evidence = {
      tracking_id: String(e.id),
      backfilled: true,
      note: 'This send predates the ledger. Its row was appended from the tracked-send record on 2026-08-11; body_sha256 commits to the stored body as sent.',
      provenance: first ? await leadProvenance(env, first) : null,
      send_kind: e.kind || null,
      lead_id: e.lead_id ?? null,
    };
    await appendRow(env, {
      proof_id: randId('snd_'),
      kind: 'email_send_backfill',
      parent_proof: null,
      ts: e.sent_at || new Date().toISOString(),
      recipient_domain: first ? domainOf(first) : null,
      recipient_sha256: first ? await sha256Hex(first) : null,
      subject: String(e.subject || '').slice(0, 300),
      body_sha256: e.body ? await sha256Hex(String(e.body)) : null,
      evidence: JSON.stringify(evidence),
    });
    done += 1;
  }
  return { backfilled: done, remaining_hint: rows.length === 0 ? 0 : null };
}
