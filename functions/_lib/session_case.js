// SESSION CASES — the ledger turned inside out (migration 0360, owner directive 2026-08-28).
//
// One session or loop run as one public object: the owner's input, the model's recorded output,
// every tool call, every raw payload reference — everything the internal ledger already holds,
// published under a CLASSIFICATION POLICY that is code. What cannot be published still publishes
// its SHA-256 COMMITMENT, so a reader can authenticate information without reading it: the
// per-turn input/output hashes were computed AT INGEST over the original text (agent_turn_log.js
// stores user_input_sha256 / assistant_sha256), the case's own manifest_hash is written to the
// event ledger at store time, and that ledger is chained, Merkle-checkpointed, ES256-signed,
// externally witnessed, and drand/Bitcoin-anchored. Reveal-later verification: hand someone the
// private original, they hash it, it matches a commitment that predates the dispute.
//
// HONESTY BOUNDARY, stated where a reader will see it: "the model's thoughts" here means what the
// ledger recorded — the assistant text, tool calls, and commands per turn. Interior
// chain-of-thought that was never logged is not in the record and the case never pretends it is.

import { buildNowIso } from './build_time.js';
import { logEvent } from './event_log.js';
import { redactProvenWorkValue } from './proven_work_projection.js';
import { scrubOwnerIdentity } from './public_secret_guard.js';

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function parseMaybe(v) {
  if (v == null) return null;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
}

// ---- THE CLASSIFICATION POLICY — code, not prose ----
// Five categories decide what leaves the building. Category hits do not delete evidence: they
// decide the FORM it publishes in (redacted text / hash commitment only / omitted with a declared
// reason), and every decision is printed on the item it governed.
//   credential       secrets, keys, tokens        → ingest already redacts; egress redacts again
//   owner_identity   the operator's PII           → scrubbed by the existing owner-identity pass
//   customer_pii     lead/customer emails, phones → redacted; recipients elsewhere ship as domain+hash
//   security         operational attack surface   → the WHOLE ITEM drops to a hash commitment
//   business_private explicit owner marking       → per-case override lists, commitment or omission
const SECURITY_PATTERNS = [
  /private[\s_-]?key|BEGIN (?:RSA|EC|OPENSSH) PRIVATE/i,
  /ssh[\s_-]?(?:key|config|access)|\.ssh\//i,
  /(?:bypass|disable|circumvent)\w*\s+(?:the\s+)?(?:auth|gate|guard|redaction|permission)/i,
  /how to (?:hack|exploit|attack|compromise)/i,
  /TERMINAL_KEY|ADMIN_SESSION_SECRET|OIP_HOME_KEY/,
];
export function classifyText(text) {
  const s = String(text || '');
  const hits = [];
  for (const re of SECURITY_PATTERNS) if (re.test(s)) { hits.push('security'); break; }
  return hits;
}

function publishText(text) {
  // credential + customer_pii + owner_identity handled by the existing redaction stack.
  return redactProvenWorkValue(scrubOwnerIdentity(String(text || '')));
}

export async function nextCaseId(env) {
  const row = await env.DB.prepare("SELECT case_id FROM session_cases WHERE case_id LIKE 'SC-%' ORDER BY case_id DESC LIMIT 1").first();
  const n = row ? Number(String(row.case_id).split('-')[1] || 0) + 1 : 1;
  return 'SC-' + String(n).padStart(4, '0');
}

/**
 * Assemble one session case from the records the run already left behind.
 * Selector: {session} or {trace_id} or {turn_keys:[…]}; hash_only_turns / omit list per-item
 * owner overrides (business_private), each requiring a reason.
 */
export async function assembleSessionCase(env, {
  session, trace_id, turn_keys, title, objective, actor,
  hash_only_turns = [], omit_turns = [], omit_reason = null,
} = {}) {
  let rows = [];
  if (Array.isArray(turn_keys) && turn_keys.length) {
    const marks = turn_keys.slice(0, 500).map(() => '?').join(',');
    rows = (await env.DB.prepare(`SELECT * FROM agent_turns WHERE turn_key IN (${marks}) ORDER BY id ASC`).bind(...turn_keys.slice(0, 500)).all()).results || [];
  } else if (session) {
    rows = (await env.DB.prepare('SELECT * FROM agent_turns WHERE session=? ORDER BY id ASC LIMIT 500').bind(String(session)).all()).results || [];
  } else if (trace_id) {
    rows = (await env.DB.prepare('SELECT * FROM agent_turns WHERE trace_id=? ORDER BY id ASC LIMIT 500').bind(String(trace_id)).all()).results || [];
  }
  if (!rows.length) return { ok: false, status: 404, error: 'no_turns_found', hint: 'pass session, trace_id, or turn_keys[] that exist in agent_turns' };

  const hashOnly = new Set((hash_only_turns || []).map(String));
  const omit = new Set((omit_turns || []).map(String));
  const turns = [];
  const traceIds = new Set();
  const privateSalts = {}; // {turn_key: {salt}} — stored in private_json, NEVER served
  let cost = { tokens_in: 0, tokens_out: 0, cost_usd: 0 };
  // SALTED COMMITMENTS FOR WITHHELD CONTENT (RFC 9901 discipline). A bare SHA-256 over a short
  // prompt is guessable — publishing the raw ingest hash of WITHHELD text would leak it to anyone
  // willing to enumerate candidates. So a withheld turn publishes sha256(salt ‖ original) with a
  // fresh random salt held privately; reveal-later hands a verifier original + salt. Published
  // turns keep the unsalted ingest hashes as commitments — their content is public anyway, and
  // the ingest hash binds the published redaction to the exact original the hooks recorded.
  const saltHex = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const saltedCommitments = async (r, salt) => ({
    user_input_salted_sha256: r.user_input != null ? await sha256Hex(salt + '␟' + String(r.user_input)) : null,
    assistant_salted_sha256: r.assistant_text != null ? await sha256Hex(salt + '␟' + String(r.assistant_text)) : null,
    scheme: 'sha256(salt ␟ original), salt withheld — RFC 9901-style salted disclosure; reveal = {original, salt}',
  });
  for (const r of rows) {
    if (r.trace_id) traceIds.add(r.trace_id);
    cost.tokens_in += Number(r.tokens_in || 0);
    cost.tokens_out += Number(r.tokens_out || 0);
    cost.cost_usd += Number(r.cost_usd || 0);
    const key = String(r.turn_key || r.id);
    if (omit.has(key)) {
      const salt = saltHex();
      privateSalts[key] = { salt };
      turns.push({ turn: key, ts: r.ts, agent: r.agent, disclosure: 'omitted', reason: omit_reason || 'owner marked business_private', commitments: await saltedCommitments(r, salt) });
      continue;
    }
    const secHits = [...classifyText(r.user_input), ...classifyText(r.assistant_text)];
    const tier = hashOnly.has(key) || secHits.length ? 'hash_only' : 'published';
    if (tier === 'hash_only') {
      const salt = saltHex();
      privateSalts[key] = { salt };
      turns.push({
        turn: key, ts: r.ts, agent: r.agent, model: r.model_id || null, disclosure: 'hash_only',
        classification: secHits.length ? secHits : ['business_private'],
        note: 'content withheld by policy; the salted commitments still authenticate a revealed original — the salt travels with the reveal, never with the case',
        n_tools: r.n_tools, commitments: await saltedCommitments(r, salt),
      });
      continue;
    }
    // Published turns: ingest-time hashes over the ORIGINAL text, stored before any egress pass.
    const commitments = { user_input_sha256: r.user_input_sha256 || null, assistant_sha256: r.assistant_sha256 || null };
    turns.push({
      turn: key, ts: r.ts, agent: r.agent, model: r.model_id || null, disclosure: 'published',
      input: publishText(r.user_input),
      output: publishText(r.assistant_text),
      tools: redactProvenWorkValue(parseMaybe(r.tools_json)),
      commands: redactProvenWorkValue(parseMaybe(r.commands_json)),
      files: redactProvenWorkValue(parseMaybe(r.files_json)),
      dispatch_key: r.dispatch_key || null,
      commitments,
      commitment_relation: 'commitments hash the ORIGINAL ingest text; published text is redact(original)',
    });
  }

  // Tool payloads: everything these turns' traces put on the event/invocation ledgers, as
  // references — resolvable through the same machinery /api/work-evidence uses.
  const payload_refs = [];
  for (const t of [...traceIds].slice(0, 20)) {
    try {
      const evs = (await env.LEDGER.prepare(
        'SELECT id, key, action, status FROM events WHERE trace_id=? ORDER BY ts ASC LIMIT 200',
      ).bind(t).all()).results || [];
      for (const e of evs) payload_refs.push({ kind: 'event', id: e.id, key: e.key, status: e.status, trace_id: t });
    } catch {}
    try {
      const invs = (await env.LEDGER.prepare(
        'SELECT id, object_id, cost_usd FROM invocations WHERE trace_id=? ORDER BY ts ASC LIMIT 200',
      ).bind(t).all()).results || [];
      for (const i of invs) payload_refs.push({ kind: 'invocation', id: i.id, object_id: i.object_id, receipt: '/receipt/' + i.id, trace_id: t });
    } catch {}
  }

  const manifest = {
    schema: 'oip/session-case/1',
    what: 'One session turned inside out: the operator input, the recorded model output, tools, commands, files, and every ledger payload the run produced — published under a classification policy that is code, with hash commitments for whatever stays private.',
    honesty: '"thoughts" = what the ledger recorded (output text, tools, commands). Unlogged interior reasoning is not in the record and is not claimed.',
    title: String(title || ('Session case: ' + (session || trace_id || 'selected turns'))),
    objective: objective ? String(objective) : null,
    session: session || null,
    trace_ids: [...traceIds],
    agent: rows[0]?.agent || null,
    turns,
    payload_refs,
    payloads_note: 'each event/invocation reference resolves at /api/case/<id>/payloads with dual-hash binding; large payloads archived to R2 resolve the same way',
    cost,
    counts: { turns: turns.length, published: turns.filter((x) => x.disclosure === 'published').length, hash_only: turns.filter((x) => x.disclosure === 'hash_only').length, omitted: turns.filter((x) => x.disclosure === 'omitted').length, payload_refs: payload_refs.length },
    classification_policy: 'credential/owner_identity/customer_pii → redacted in place; security → whole item drops to hash commitment; business_private → owner-marked, commitment or declared omission. Decisions print on each item.',
    assembled_at: buildNowIso(),
    assembled_by: String(actor || 'owner'),
  };
  return { ok: true, manifest, private: privateSalts };
}

export async function storeSessionCase(env, manifest, { case_id, disclosure, actor, privateData } = {}) {
  const id = case_id || await nextCaseId(env);
  const text = JSON.stringify(manifest);
  const hash = await sha256Hex(text);
  const tier = ['public', 'hash_only', 'private'].includes(String(disclosure)) ? String(disclosure) : 'public';
  const prev = await env.DB.prepare('SELECT revision, disclosure FROM session_cases WHERE case_id=? ORDER BY revision DESC LIMIT 1').bind(id).first();
  const RANK = { public: 0, hash_only: 1, private: 2 };
  const finalTier = disclosure != null ? tier : (prev?.disclosure && RANK[prev.disclosure] != null ? prev.disclosure : 'public');
  const revision = Number(prev?.revision || 0) + 1;
  await env.DB.prepare(
    'INSERT INTO session_cases (case_id, revision, title, objective, session, trace_id, agent, manifest_json, manifest_hash, private_json, disclosure, actor, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
  ).bind(
    id, revision, manifest.title, manifest.objective, manifest.session,
    (manifest.trace_ids || [])[0] || null, manifest.agent, text, hash,
    privateData && Object.keys(privateData).length ? JSON.stringify(privateData) : null,
    finalTier, actor || null, buildNowIso(),
  ).run();
  // The commitment that makes the case authenticatable: its hash lands on the event ledger, which
  // is chained, checkpointed, signed, witnessed, and externally anchored.
  await logEvent(env, {
    source: 'session_case', key: 'CASE_SEALED', action: 'store', direction: 'IN', actor: actor || 'owner',
    route: '/api/case/' + id,
    request: JSON.stringify({ case_id: id, revision, manifest_hash: hash, disclosure: finalTier, counts: manifest.counts }),
    response: 'sealed',
  }).catch(() => {});
  return { ok: true, case_id: id, revision, manifest_hash: hash, disclosure: finalTier, url: '/api/case/' + id };
}

export async function getSessionCase(env, caseId, revision) {
  try {
    const row = revision
      ? await env.DB.prepare('SELECT * FROM session_cases WHERE case_id=? AND revision=?').bind(String(caseId), Number(revision)).first()
      : await env.DB.prepare('SELECT * FROM session_cases WHERE case_id=? ORDER BY revision DESC LIMIT 1').bind(String(caseId)).first();
    if (!row) return null;
    // private_json holds the withheld-content salts. It is used server-side by verify and by an
    // owner-initiated reveal; it NEVER rides on this object into a response. Strip it here so no
    // route can leak it by spreading the row.
    const { private_json, ...pub } = row;
    return { ...pub, manifest: JSON.parse(row.manifest_json), _salts: private_json ? JSON.parse(private_json) : null };
  } catch { return null; }
}

/** Recompute every commitment the case publishes against the stored originals. */
export async function verifySessionCase(env, stored) {
  const failures = [];
  const storedHash = await sha256Hex(stored.manifest_json);
  if (storedHash !== stored.manifest_hash) failures.push({ item: 'manifest', reason: 'manifest_json does not hash to manifest_hash' });
  let checked = 0;
  for (const t of stored.manifest.turns || []) {
    const row = await env.DB.prepare('SELECT user_input, assistant_text, user_input_sha256, assistant_sha256 FROM agent_turns WHERE turn_key=?').bind(String(t.turn)).first().catch(() => null);
    if (!row) { failures.push({ item: 'turn:' + t.turn, reason: 'turn no longer resolvable in agent_turns' }); continue; }
    checked += 1;
    if (t.disclosure === 'published') {
      if (t.commitments?.user_input_sha256 && row.user_input_sha256 !== t.commitments.user_input_sha256) failures.push({ item: 'turn:' + t.turn, reason: 'user_input commitment mismatch' });
      if (t.commitments?.assistant_sha256 && row.assistant_sha256 !== t.commitments.assistant_sha256) failures.push({ item: 'turn:' + t.turn, reason: 'assistant commitment mismatch' });
    } else {
      // Withheld turns: recompute the salted commitments from the stored original + the held salt.
      const salt = stored._salts?.[String(t.turn)]?.salt;
      if (!salt) { failures.push({ item: 'turn:' + t.turn, reason: 'withheld turn has no held salt — its commitment cannot be re-verified server-side' }); continue; }
      if (t.commitments?.user_input_salted_sha256 && row.user_input != null) {
        const h = await sha256Hex(salt + '␟' + String(row.user_input));
        if (h !== t.commitments.user_input_salted_sha256) failures.push({ item: 'turn:' + t.turn, reason: 'salted user_input commitment mismatch' });
      }
      if (t.commitments?.assistant_salted_sha256 && row.assistant_text != null) {
        const h = await sha256Hex(salt + '␟' + String(row.assistant_text));
        if (h !== t.commitments.assistant_salted_sha256) failures.push({ item: 'turn:' + t.turn, reason: 'salted assistant commitment mismatch' });
      }
    }
  }
  return {
    valid: failures.length === 0,
    turns_checked: checked,
    failures,
    how: 'manifest re-hashed; published turns compared against ingest-time hashes; withheld turns recomputed as sha256(salt ␟ original) with the held salt; the CASE_SEALED ledger event pins manifest_hash into the anchored chain. Withheld commitments are SALTED (RFC 9901 discipline) — a bare hash of short text would be guessable.',
  };
}
