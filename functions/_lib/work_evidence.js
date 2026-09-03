// THE EXECUTION-EVIDENCE MANIFEST — oip/work-evidence/1 (SPEC_SKILL_EVIDENCE_GRAPH.md, Phase 2).
//
// THE DEFECT THIS CURES. The evidence already exists — events carry full request/response JSON,
// invocations carry cost and lineage, agent_turns carry per-turn hashes, work_actions carry tests
// and the chain — but nothing binds ONE unit of work into ONE object a cold model can fetch and
// answer: what was attempted, which method governed it, what exact input reached the outside
// system, what came back, why each inclusion/exclusion was made, what cannot be independently
// reconstructed, what tests actually ran, and what the evidence PROVES versus merely ATTESTS.
//
// A MANIFEST, NOT A LEDGER. Every step is a reference (id + stored hash) into an existing record.
// This module never copies payloads and never writes a second log. verifyManifest() re-resolves
// every reference and recomputes every hash — a manifest whose references do not resolve is
// INVALID, which is what upgrades "PARTIAL is honest" into "complete is checkable".
//
// REPLAYABILITY is per step and five-valued, because it is the truth about real work:
//   raw           the exact request is recorded and can be re-issued (a query, an API call)
//   hashed        what was seen is hash-pinned but the source may have changed (a fetched page)
//   witnessed     an external chain row attests it (a send_ledger proof)
//   asserted      only the model's own account exists (a reasoning step)
//   not_replayable  gone by nature (a one-time token, a deleted upstream) — with the reason

import { buildNowIso } from './build_time.js';
import { readEventFull } from './event_log.js';
import { redactProvenWorkValue } from './proven_work_projection.js';

// GRADED CLAIMS — what a record is allowed to say about itself. Raw payloads prove execution
// history, not causation; the grade vocabulary keeps those apart so one lucky run never silently
// becomes "knowledge". Manifests earn the first two; comparisons earn the middle two (from their
// DECLARED design, computed here, never self-declared); replication and generalization are
// computed over multiple comparison rows at read time.
export const CLAIM_GRADES = Object.freeze([
  'EXECUTED',              // the steps happened; references resolve
  'OUTCOME_OBSERVED',      // a measured outcome is attached (opens, clicks, acceptance)
  'ASSOCIATION_OBSERVED',  // A vs B compared, but sequentially/matched — confounders possible
  'CONTROLLED_COMPARISON', // A vs B under a randomized design
  'REPLICATED',            // an independent comparison agreed in direction
  'GENERALIZED',           // ≥3 replications in materially different contexts (projection only)
]);

export function manifestClaimGrade(manifest) {
  return manifest && manifest.outcome ? 'OUTCOME_OBSERVED' : 'EXECUTED';
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const REPLAYABILITY = new Set(['raw', 'hashed', 'witnessed', 'asserted', 'not_replayable']);

/**
 * Assemble the manifest for one task from the records its execution left behind.
 * Called at submit time (the natural chokepoint: lease verified, acceptance about to run) and
 * available retroactively — a retroactive assembly is flagged synthesized:1, same honesty rule
 * as proven-work's synthesizeManifest.
 */
export async function assembleManifest(env, task, {
  actor, evidence, verdict, skill, extra_steps, synthesized = false,
} = {}) {
  const taskId = String(task.id);
  // 1. The task's own action rows — the governed record of what happened.
  const actions = (await env.DB.prepare(
    'SELECT id, ts, action, agent, model, capability, from_state, to_state, result, hash, prev_hash FROM work_actions WHERE task_id=? ORDER BY id ASC',
  ).bind(taskId).all()).results || [];
  // 2. Invocation receipts that named this task. Best-effort: the LEDGER binding may be absent in
  // a test context, and older invocations never carried a task id.
  let receipts = [];
  try {
    const r = await env.LEDGER.prepare(
      "SELECT id, ts, object_id, actor, tokens_in, tokens_out, cost_usd, replay_of FROM invocations WHERE invocation_json LIKE ? ORDER BY ts ASC LIMIT 200",
    ).bind(`%${taskId}%`).all();
    receipts = r.results || [];
  } catch {}
  const steps = [];
  for (const a of actions) {
    steps.push({
      ref: { kind: 'work_action', id: a.id, hash: a.hash },
      role: a.action,
      actor: a.agent, model: a.model || null,
      replayability: 'witnessed', // a chained row the public audit recomputes
      ts: a.ts, result: a.result || null,
    });
  }
  for (const r of receipts) {
    steps.push({
      ref: { kind: 'invocation', id: r.id },
      role: 'invoke:' + String(r.object_id || ''),
      actor: r.actor || null,
      replayability: 'raw', // the receipt carries the request; /api/dispatch?receipt= replays it
      ts: r.ts, cost_usd: r.cost_usd ?? null, replay_of: r.replay_of || null,
    });
  }
  for (const s of Array.isArray(extra_steps) ? extra_steps : []) {
    // Caller-declared steps (an exclusion with its reason, an external fetch with its hash).
    // These are the ASSERTED tier unless the caller can point at a record.
    steps.push({
      ref: s.ref || null,
      role: String(s.role || 'note'),
      replayability: REPLAYABILITY.has(s.replayability) ? s.replayability : 'asserted',
      note: s.note ? String(s.note).slice(0, 2000) : null,
      request_sha256: s.request_sha256 || null,
      response_sha256: s.response_sha256 || null,
    });
  }
  const cost = receipts.reduce((m, r) => ({
    tokens_in: m.tokens_in + Number(r.tokens_in || 0),
    tokens_out: m.tokens_out + Number(r.tokens_out || 0),
    cost_usd: m.cost_usd + Number(r.cost_usd || 0),
  }), { tokens_in: 0, tokens_out: 0, cost_usd: 0 });
  const gaps = [];
  if (!receipts.length) gaps.push({ what: 'no invocation receipts reference this task', why: 'either the work used no OIP capabilities, or its invocations predate task-id tagging' });
  if (synthesized) gaps.push({ what: 'assembled retroactively', why: 'not built at submit time; steps only cover what the records still show' });
  const manifest = {
    schema: 'oip/work-evidence/1',
    work: { task_id: taskId, revision: Number(task.revision || 1), kind: task.kind, task_head_hash: task.hash || null },
    objective: task.objective,
    method: skill && skill.skill ? {
      skill: String(skill.skill), skill_version: skill.skill_version ?? null, skill_hash: skill.skill_hash || null,
    } : null,
    acceptance: verdict ? {
      accepted: !!verdict.accepted, tests_declared: verdict.tests_declared,
      tests_passed: verdict.tests_passed, results: verdict.results,
    } : null,
    evidence_declared: evidence || null,
    steps,
    cost,
    gaps,
    verify: '/api/work-evidence/' + taskId + '/verify',
    audit: '/api/work/task/' + taskId + '/audit',
    assembled_at: buildNowIso(),
    assembled_by: String(actor || 'infrastructure'),
  };
  manifest.claim_grade = manifestClaimGrade(manifest);
  manifest.payloads = '/api/work-evidence/' + taskId + '/payloads';
  return manifest;
}

/**
 * THE CASE FILE, opened (spec: execution-case layer). A cold model holding nothing must be able
 * to see the actual action strings and returned payloads — what went into the Places API, the 100
 * rows that came back, the exact MCP request that placed the ad — not just hashes over them.
 * This resolves one manifest step to its raw record: work_action rows verbatim (already public on
 * the audit surface), invocation receipts plus the full event request/response they logged —
 * including payloads archived to R2, via readEventFull. Everything passes egress redaction; the
 * ingest path (logEvent) already redacted secrets once, this is the second, belt-and-braces pass.
 */
export async function resolveStepPayload(env, step) {
  const ref = step && step.ref;
  if (!ref || !ref.kind) {
    return { step, payload: null, note: 'caller-declared step — no stored record behind it; its tier is ' + (step?.replayability || 'asserted') };
  }
  // DUAL-HASH BINDING. Two hashes relate what is served to what is stored, so a reader can hold
  // the redacted public record and still bind it to the original: stored_sha256 covers the stored
  // record exactly as the database holds it (whose integrity the chain / receipt lineage already
  // pins); public_sha256 covers the exact sanitized bytes served here. The declared relation is
  // public = redact(stored) — a verifier with read access to the store can recompute both and
  // confirm the published record is the original minus redactions, nothing else.
  if (ref.kind === 'work_action') {
    const row = await env.DB.prepare('SELECT * FROM work_actions WHERE id=?').bind(Number(ref.id)).first().catch(() => null);
    if (!row) return { step, payload: null, error: 'work_action not found' };
    const storedText = JSON.stringify({ ts: row.ts, action: row.action, agent: row.agent, model: row.model, input: row.input, output: row.output, changed: row.changed, tests: row.tests, evidence: row.evidence, result: row.result });
    const payload = redactProvenWorkValue({
      kind: 'work_action', id: row.id, ts: row.ts, action: row.action, agent: row.agent, model: row.model,
      input: parseMaybe(row.input), output: parseMaybe(row.output), changed: parseMaybe(row.changed),
      tests: parseMaybe(row.tests), evidence: parseMaybe(row.evidence), result: row.result,
      hash: row.hash, prev_hash: row.prev_hash,
    });
    return {
      step,
      payload,
      binding: {
        stored_sha256: await sha256Hex(storedText),
        public_sha256: await sha256Hex(JSON.stringify(payload)),
        relation: 'public = redact(stored); the stored record itself is pinned by the action chain (row.hash) which /api/work/audit recomputes',
      },
    };
  }
  if (ref.kind === 'invocation') {
    let inv = null;
    try { inv = await env.LEDGER.prepare('SELECT * FROM invocations WHERE id=?').bind(String(ref.id)).first(); } catch {}
    if (!inv) return { step, payload: null, error: 'invocation not found' };
    let event = null;
    if (inv.event_id) event = await readEventFull(env, inv.event_id).catch(() => null);
    const storedText = JSON.stringify({ inv: inv.invocation_json || null, req: event?.request_json || null, res: event?.response_json || null });
    const payload = redactProvenWorkValue({
      kind: 'invocation', id: inv.id, ts: inv.ts, object_id: inv.object_id, actor: inv.actor,
      tokens_in: inv.tokens_in, tokens_out: inv.tokens_out, cost_usd: inv.cost_usd,
      replay_of: inv.replay_of || null, repairs: inv.repairs || null,
      invocation: parseMaybe(inv.invocation_json),
      event: event ? {
        id: event.id, route: event.route, status: event.status,
        request: parseMaybe(event.request_json), response: parseMaybe(event.response_json),
      } : null,
      receipt: '/receipt/' + inv.id,
    });
    return {
      step,
      payload,
      binding: {
        stored_sha256: await sha256Hex(storedText),
        public_sha256: await sha256Hex(JSON.stringify(payload)),
        relation: 'public = redact(stored); note the store itself already redacted secrets once at ingest (logEvent), so no raw secret exists to leak',
      },
    };
  }
  return { step, payload: null, error: 'unknown ref kind ' + String(ref.kind) };
}

function parseMaybe(v) {
  if (v == null) return null;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
}

/**
 * Attach a measured outcome to a task's evidence (append-only: a new manifest revision carrying
 * the outcome, grade recomputed). An outcome is a measurement with its source records — never a
 * conclusion. Conclusions about A vs B live on comparison objects, where the declared design caps
 * the claim grade.
 */
export async function attachOutcome(env, taskId, outcome, { actor } = {}) {
  const stored = await getManifest(env, taskId);
  if (!stored) return { ok: false, status: 404, error: 'no_manifest_yet', how_to_fix: 'POST /api/work-evidence/' + taskId + '/assemble first' };
  if (!outcome || !outcome.metric || outcome.value == null) {
    return { ok: false, status: 400, error: 'outcome_incomplete', required: ['metric', 'value'], optional: ['window_start', 'window_end', 'n', 'source_refs'] };
  }
  const manifest = stored.manifest;
  manifest.outcome = {
    metric: String(outcome.metric), value: Number(outcome.value),
    window_start: outcome.window_start || null, window_end: outcome.window_end || null,
    n: outcome.n != null ? Number(outcome.n) : null,
    source_refs: Array.isArray(outcome.source_refs) ? outcome.source_refs : [],
    measured_at: buildNowIso(), measured_by: String(actor || 'infrastructure'),
    note: 'a measurement, not a conclusion — comparisons decide A-vs-B, and their design caps the grade',
  };
  manifest.claim_grade = manifestClaimGrade(manifest);
  return storeManifest(env, taskId, manifest, { synthesized: !!stored.synthesized, actor });
}

/**
 * The one outcome the build can already measure mechanically: tracked email engagement.
 * email_sends carries opens/clicks per send (pixel + click-wrap, migration 0325); given send ids
 * this recomputes the live numbers — an OUTCOME_OBSERVED source that needs no new integration.
 */
export async function emailOutcome(env, sendIds) {
  const ids = (Array.isArray(sendIds) ? sendIds : []).map(String).filter(Boolean).slice(0, 500);
  if (!ids.length) return { ok: false, error: 'send_ids_required' };
  const marks = ids.map(() => '?').join(',');
  try {
    const r = await env.DB.prepare(
      `SELECT COUNT(*) sends, SUM(CASE WHEN opens>0 THEN 1 ELSE 0 END) opened, SUM(CASE WHEN clicks>0 THEN 1 ELSE 0 END) clicked FROM email_sends WHERE id IN (${marks})`,
    ).bind(...ids).first();
    const sends = Number(r?.sends || 0);
    return {
      ok: true, sends, opened: Number(r?.opened || 0), clicked: Number(r?.clicked || 0),
      open_rate: sends ? Number(r.opened || 0) / sends : null,
      click_rate: sends ? Number(r.clicked || 0) / sends : null,
      source: 'email_sends (live recount, not a stored claim)',
    };
  } catch (e) {
    return { ok: false, error: 'email_sends_unreadable', detail: String(e?.message || e) };
  }
}

/** Store one manifest revision. Append-only: a re-assembly is a new revision, never an overwrite. */
export async function storeManifest(env, taskId, manifest, { synthesized = false, actor, disclosure } = {}) {
  const text = JSON.stringify(manifest);
  const hash = await sha256Hex(text);
  const tier = ['public', 'hash_only', 'private'].includes(String(disclosure)) ? String(disclosure) : 'public';
  try {
    const prev = await env.DB.prepare('SELECT revision r, disclosure d FROM work_evidence WHERE task_id=? ORDER BY revision DESC LIMIT 1').bind(String(taskId)).first();
    const revision = Number(prev?.r || 0) + 1;
    // A new revision never silently widens disclosure: it inherits the narrowest of its own tier
    // and the prior revision's tier. Narrowing is always allowed; widening is a deliberate act
    // done by storing with an explicit disclosure after reviewing the payloads.
    const RANK = { public: 0, hash_only: 1, private: 2 };
    const inherited = disclosure != null ? tier
      : (prev?.d && RANK[prev.d] != null ? prev.d : 'public');
    await env.DB.prepare(
      'INSERT INTO work_evidence (task_id,revision,manifest_json,manifest_hash,synthesized,disclosure,actor,created_at) VALUES (?,?,?,?,?,?,?,?)',
    ).bind(String(taskId), revision, text, hash, synthesized ? 1 : 0, inherited, actor || null, buildNowIso()).run();
    return { ok: true, task_id: String(taskId), revision, manifest_hash: hash, disclosure: inherited };
  } catch (e) {
    // Pre-0357-amendment table without the disclosure column — store without it rather than lose evidence.
    try {
      const prev = await env.DB.prepare('SELECT MAX(revision) r FROM work_evidence WHERE task_id=?').bind(String(taskId)).first();
      const revision = Number(prev?.r || 0) + 1;
      await env.DB.prepare(
        'INSERT INTO work_evidence (task_id,revision,manifest_json,manifest_hash,synthesized,actor,created_at) VALUES (?,?,?,?,?,?,?)',
      ).bind(String(taskId), revision, text, hash, synthesized ? 1 : 0, actor || null, buildNowIso()).run();
      return { ok: true, task_id: String(taskId), revision, manifest_hash: hash, disclosure: 'public' };
    } catch (e2) {
      return { ok: false, error: 'work_evidence_store_unavailable', detail: String(e2?.message || e2), manifest_hash: hash };
    }
  }
}

export async function getManifest(env, taskId, revision) {
  try {
    const row = revision
      ? await env.DB.prepare('SELECT * FROM work_evidence WHERE task_id=? AND revision=?').bind(String(taskId), Number(revision)).first()
      : await env.DB.prepare('SELECT * FROM work_evidence WHERE task_id=? ORDER BY revision DESC LIMIT 1').bind(String(taskId)).first();
    if (!row) return null;
    return { ...row, manifest: JSON.parse(row.manifest_json) };
  } catch {
    return null;
  }
}

/**
 * Re-resolve every reference in a manifest and recompute what can be recomputed.
 * The verdict names each failing step; a manifest with any unresolved reference is invalid.
 */
export async function verifyManifest(env, stored) {
  const m = stored.manifest;
  const failures = [];
  let checked = 0;
  const storedHash = await sha256Hex(stored.manifest_json);
  if (storedHash !== stored.manifest_hash) {
    failures.push({ step: 'manifest', reason: 'manifest_json does not hash to manifest_hash' });
  }
  for (const s of m.steps || []) {
    if (!s.ref || !s.ref.kind) continue; // asserted caller-declared steps carry no reference
    checked += 1;
    if (s.ref.kind === 'work_action') {
      const row = await env.DB.prepare('SELECT id, hash FROM work_actions WHERE id=?').bind(Number(s.ref.id)).first().catch(() => null);
      if (!row) failures.push({ step: s.ref, reason: 'work_action not found' });
      else if (s.ref.hash && String(row.hash) !== String(s.ref.hash)) failures.push({ step: s.ref, reason: 'work_action hash changed — the chain this cites is not the chain that exists' });
    } else if (s.ref.kind === 'invocation') {
      let row = null;
      try { row = await env.LEDGER.prepare('SELECT id FROM invocations WHERE id=?').bind(String(s.ref.id)).first(); } catch {}
      if (!row) failures.push({ step: s.ref, reason: 'invocation receipt not found' });
    }
  }
  return {
    valid: failures.length === 0,
    steps_total: (m.steps || []).length,
    references_checked: checked,
    failures,
    how: 'every referenced work_action re-read and hash-compared; every referenced invocation re-resolved; manifest_json re-hashed against manifest_hash',
  };
}
