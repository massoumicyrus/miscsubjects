
import { buildNowIso } from './build_time.js';
import { logEvent } from './event_log.js';
import { assembleManifest, storeManifest } from './work_evidence.js';

export const WORK_STATES = Object.freeze([
  'open',               // eligible once dependencies are completed
  'leased',             // an agent holds it, lease has not expired
  'in_progress',        // agent reported starting real work
  'evidence_submitted', // evidence is in, acceptance not yet run (transient)
  'accepted',           // acceptance tests passed mechanically
  'refused',            // acceptance tests failed; returns to open with failure_count+1
  'failed',             // agent or infrastructure recorded a failure; child failure task exists
  'repair_required',    // a failure object is open against this task
  'completed',          // accepted and closed; nothing further is eligible on it
  'superseded',         // withdrawn by a later revision that names it; never eligible, never deleted
]);

// Which transitions the code allows, keyed by from-state.
// A task is never deleted. Work that should not have been created, or that a later decision
// withdraws, moves to `superseded` — which is terminal, never eligible, and carries the reason and
// the replacement in the audit row that made the move.
const TRANSITIONS = Object.freeze({
  open: ['leased', 'superseded'],
  leased: ['in_progress', 'evidence_submitted', 'failed', 'open'],
  in_progress: ['evidence_submitted', 'failed', 'open'],
  evidence_submitted: ['accepted', 'refused', 'failed'],
  accepted: ['completed', 'repair_required'],
  refused: ['open', 'leased', 'failed', 'superseded'],
  failed: ['repair_required', 'open', 'superseded'],
  repair_required: ['open', 'leased', 'superseded'],
  completed: ['repair_required'],
  superseded: [],
});

export const LEASE_SECONDS = 3600;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}

/** One task row → the bounded object an agent receives. Nothing else is needed to do the work. */
export function taskObject(row) {
  if (!row) return null;
  return {
    task_id: row.id,
    kind: row.kind,
    objective: row.objective,
    detail: row.detail || '',
    state: row.state,
    priority: row.priority,
    revision: row.revision,
    depends_on: parseJson(row.depends_on, []),
    permitted_capabilities: parseJson(row.capabilities, []),
    acceptance_tests: parseJson(row.acceptance, []),
    required_evidence: parseJson(row.evidence_required, []),
    parent_task: row.parent_id || null,
    supersedes: row.supersedes || null,
    failure: parseJson(row.failure, null),
    failure_count: row.failure_count,
    last_result: parseJson(row.last_result, null),
    lease: row.lease_holder
      ? { holder: row.lease_holder, model: row.lease_model || null, expires_at: row.lease_expires_at }
      : null,
    completed_at: row.completed_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    audit: `/api/work/task/${row.id}/audit`,
    submit_to: `/api/work/task/${row.id}/submit`,
  };
}

/** Append one audit row, chained to the previous one. The only way anything is recorded. */
export async function appendAction(env, entry) {
  const db = env.DB;
  const now = buildNowIso();
  const prev = await db.prepare('SELECT hash FROM work_actions ORDER BY id DESC LIMIT 1').first();
  const prevHash = prev?.hash || 'genesis';
  const payload = {
    ts: now,
    task_id: String(entry.task_id || ''),
    action: String(entry.action || ''),
    agent: entry.agent == null ? null : String(entry.agent),
    model: entry.model == null ? null : String(entry.model),
    capability: entry.capability == null ? null : String(entry.capability),
    task_revision: entry.task_revision == null ? null : Number(entry.task_revision),
    from_state: entry.from_state == null ? null : String(entry.from_state),
    to_state: entry.to_state == null ? null : String(entry.to_state),
    input: entry.input == null ? null : JSON.stringify(entry.input),
    output: entry.output == null ? null : JSON.stringify(entry.output),
    changed: entry.changed == null ? null : JSON.stringify(entry.changed),
    tests: entry.tests == null ? null : JSON.stringify(entry.tests),
    evidence: entry.evidence == null ? null : JSON.stringify(entry.evidence),
    result: entry.result == null ? null : String(entry.result),
    parent_action: entry.parent_action == null ? null : Number(entry.parent_action),
  };
  const hash = await sha256(prevHash + '|' + JSON.stringify(payload));
  // ONE LEDGER, NOT TWO. Every work action also lands in the build's existing event ledger, so
  // the audit surfaces that already exist (/api/events, the ledger view, quadsync mirrors) carry
  // work actions without a second log to reconcile.
  await logEvent(env, {
    kind: 'work_action', service: 'work', status: payload.result || 'recorded',
    summary: `${payload.action} ${payload.task_id}` + (payload.to_state ? ` → ${payload.to_state}` : ''),
    payload: { ...payload, hash, prev_hash: prevHash },
  }).catch(() => {});
  await db.prepare(
    `INSERT INTO work_actions
       (ts,task_id,action,agent,model,capability,task_revision,from_state,to_state,input,output,changed,tests,evidence,result,parent_action,prev_hash,hash)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    payload.ts, payload.task_id, payload.action, payload.agent, payload.model, payload.capability,
    payload.task_revision, payload.from_state, payload.to_state, payload.input, payload.output,
    payload.changed, payload.tests, payload.evidence, payload.result, payload.parent_action,
    prevHash, hash,
  ).run();
  // TASK HEAD HASH (spec Phase 0.2). Migration 0341 declared work_tasks.prev_hash/hash and nothing
  // ever wrote them — the table advertised a chain it did not have. The honest meaning, recorded
  // here: a task's hash is the hash of the LATEST chained action that touched it (its head), and
  // prev_hash is that action's predecessor in the one global chain. Evidence manifests cite it.
  // Best-effort: an action about a task id that has no row (never true today) must not fail the append.
  if (payload.task_id) {
    await db.prepare('UPDATE work_tasks SET prev_hash=?, hash=? WHERE id=?')
      .bind(prevHash, hash, payload.task_id).run().catch(() => {});
  }
  return { hash, prev_hash: prevHash, ts: now };
}

/**
 * Recompute the audit chain from the stored rows and report whether it holds.
 *
 * An "append-only, hash-chained" claim that nobody recomputes is a sentence, not a proof — the
 * exact defect class this whole object exists to remove. This runs the same hash over the same
 * field order appendAction() used, in id order, and names the first row that breaks if one does.
 * Anyone can run it: it is on the public audit surface, keyless.
 */
export async function verifyActionChain(rows) {
  const ordered = [...rows].sort((a, b) => Number(a.id) - Number(b.id));
  let prevHash = null;
  let firstBreak = null;
  let verified = 0;
  for (const r of ordered) {
    const payload = {
      ts: r.ts,
      task_id: String(r.task_id || ''),
      action: String(r.action || ''),
      agent: r.agent == null ? null : String(r.agent),
      model: r.model == null ? null : String(r.model),
      capability: r.capability == null ? null : String(r.capability),
      task_revision: r.task_revision == null ? null : Number(r.task_revision),
      from_state: r.from_state == null ? null : String(r.from_state),
      to_state: r.to_state == null ? null : String(r.to_state),
      input: r.input == null ? null : String(r.input),
      output: r.output == null ? null : String(r.output),
      changed: r.changed == null ? null : String(r.changed),
      tests: r.tests == null ? null : String(r.tests),
      evidence: r.evidence == null ? null : String(r.evidence),
      result: r.result == null ? null : String(r.result),
      parent_action: r.parent_action == null ? null : Number(r.parent_action),
    };
    const expected = await sha256(String(r.prev_hash || 'genesis') + '|' + JSON.stringify(payload));
    const linkOk = prevHash === null || String(r.prev_hash) === prevHash;
    const hashOk = expected === String(r.hash);
    if (!linkOk || !hashOk) {
      if (!firstBreak) {
        firstBreak = {
          action_id: Number(r.id), task_id: r.task_id, action: r.action,
          reason: !linkOk ? 'prev_hash_does_not_match_previous_row' : 'row_hash_does_not_match_its_payload',
          stored_hash: String(r.hash || ''), recomputed_hash: expected,
        };
      }
    } else {
      verified += 1;
    }
    prevHash = String(r.hash);
  }
  return {
    valid: firstBreak === null,
    rows_checked: ordered.length,
    rows_verified: verified,
    head_hash: ordered.length ? String(ordered[ordered.length - 1].hash) : 'genesis',
    first_break: firstBreak,
    how: 'sha256(prev_hash + "|" + JSON.stringify(payload)) over the same field order appendAction() writes, in id order',
  };
}

async function setState(env, row, to, patch = {}) {
  const allowed = TRANSITIONS[row.state] || [];
  if (!allowed.includes(to)) {
    return { ok: false, status: 409, error: 'invalid_transition', from: row.state, to, allowed };
  }
  const now = buildNowIso();
  const fields = { state: to, updated_at: now, ...patch };
  const keys = Object.keys(fields);
  const sql = `UPDATE work_tasks SET ${keys.map((k) => `${k}=?`).join(',')}, revision=revision+1 WHERE id=? AND state=?`;
  const res = await env.DB.prepare(sql).bind(...keys.map((k) => fields[k]), row.id, row.state).run();
  if (!res?.meta?.changes) return { ok: false, status: 409, error: 'state_moved_under_you', from: row.state, to };
  return { ok: true };
}

export async function getTask(env, id) {
  if (!id) return null;
  return env.DB.prepare('SELECT * FROM work_tasks WHERE id=?').bind(String(id)).first();
}

/** Dependency + priority resolution. Computed here so no model decides what is next. */
export async function eligibleTasks(env, limit = 25) {
  const rows = (await env.DB.prepare(
    `SELECT * FROM work_tasks WHERE state IN ('open','refused','repair_required') ORDER BY priority ASC, created_at ASC`,
  ).all()).results || [];
  const completed = new Set(
    ((await env.DB.prepare(`SELECT id FROM work_tasks WHERE state='completed'`).all()).results || []).map((r) => r.id),
  );
  const out = [];
  for (const row of rows) {
    const deps = parseJson(row.depends_on, []);
    const blocked = deps.filter((d) => !completed.has(d));
    if (blocked.length) continue;
    // A lease that has expired frees the task; a live one does not.
    if (row.lease_expires_at && row.lease_expires_at > buildNowIso()) continue;
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

/** Lease the next eligible task, atomically. The agent does not choose. */
export async function leaseNext(env, { agent, model, capability, task_id }) {
  if (!agent) return { ok: false, status: 400, error: 'agent_required' };
  const now = buildNowIso();
  await releaseExpiredLeases(env);
  const candidates = task_id ? [await getTask(env, task_id)].filter(Boolean) : await eligibleTasks(env, 10);
  for (const row of candidates) {
    if (!['open', 'refused', 'repair_required'].includes(row.state)) continue;
    const token = 'lease_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    const expires = new Date(Date.now() + LEASE_SECONDS * 1000).toISOString();
    const res = await env.DB.prepare(
      `UPDATE work_tasks SET state='leased', lease_holder=?, lease_model=?, lease_token=?, lease_expires_at=?, updated_at=?, revision=revision+1
         WHERE id=? AND state=? AND (lease_expires_at IS NULL OR unixepoch(lease_expires_at)<=unixepoch(?))`,
    ).bind(String(agent), model ? String(model) : null, token, expires, now, row.id, row.state, now).run();
    if (!res?.meta?.changes) continue; // somebody else took it; try the next one
    const fresh = await getTask(env, row.id);
    await appendAction(env, {
      task_id: row.id, action: 'lease', agent, model, capability,
      task_revision: fresh.revision, from_state: row.state, to_state: 'leased',
      output: { lease_expires_at: expires }, result: 'recorded',
    });
    return { ok: true, lease_token: token, lease_expires_at: expires, task: taskObject(fresh) };
  }
  return { ok: false, status: 404, error: 'no_eligible_task', hint: 'Every open task is blocked by a dependency or already leased. GET /api/work to see the graph.' };
}

export async function releaseExpiredLeases(env) {
  const now = buildNowIso();
  const stale = (await env.DB.prepare(
    `SELECT * FROM work_tasks WHERE state IN ('leased','in_progress') AND lease_expires_at IS NOT NULL
       AND unixepoch(lease_expires_at)<=unixepoch(?)`,
  ).bind(now).all()).results || [];
  for (const row of stale) {
    await env.DB.prepare(
      `UPDATE work_tasks SET state='open', lease_holder=NULL, lease_model=NULL, lease_token=NULL, lease_expires_at=NULL, updated_at=?, revision=revision+1 WHERE id=?`,
    ).bind(now, row.id).run();
    await appendAction(env, {
      task_id: row.id, action: 'lease_expired', agent: row.lease_holder, model: row.lease_model,
      from_state: row.state, to_state: 'open', task_revision: row.revision, result: 'recorded',
      output: { reason: 'lease expired without submitted evidence' },
    });
  }
  return stale.length;
}

// ─────────────────────────── acceptance tests, run by the infrastructure ───────────────────────────
// Every test is a fetch against the live site or a query against the canonical tables. An agent's
// claim that it did the work is never an input. Unknown test types FAIL — a test the runner cannot
// execute is not a test that passed.

async function runOneTest(env, test, base) {
  const t = String(test?.type || '').toLowerCase();
  const url = test?.url ? (String(test.url).startsWith('http') ? String(test.url) : base + String(test.url)) : null;
  const fetchText = async (u) => {
    const r = await fetch(u, { headers: { 'user-agent': 'work-object-acceptance/1' } });
    return { status: r.status, text: await r.text() };
  };
  try {
    if (t === 'http_ok') {
      const r = await fetchText(url);
      return { id: test.id || t, ok: r.status === 200, detail: `HTTP ${r.status} ${url}` };
    }
    if (t === 'contains' || t === 'not_contains') {
      const r = await fetchText(url);
      const scope = String(test.scope || 'content').toLowerCase();
      let hay = r.text;
      if (scope !== 'raw') {
        hay = hay
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
        const start = hay.search(/<[a-z]+[^>]*class="[^"]*\bcontent\b[^"]*"/i);
        if (start >= 0) hay = hay.slice(start);
      }
      const has = hay.includes(String(test.needle));
      const ok = t === 'contains' ? has : !has;
      return {
        id: test.id || t, ok,
        detail: `${t} ${JSON.stringify(String(test.needle).slice(0, 60))} in ${url} (scope=${scope}) → ${has}`,
      };
    }
    if (t === 'article_exists' || t === 'article_min_words' || t === 'article_min_sources' || t === 'article_published' || t === 'article_has_hero') {
      const r = await fetch(`${base}/api/articles/${encodeURIComponent(String(test.slug))}`);
      if (r.status !== 200) return { id: test.id || t, ok: false, detail: `article ${test.slug} not readable (HTTP ${r.status})` };
      const j = await r.json();
      const body = String(j.body || '');
      const words = body.split(/\s+/).filter(Boolean).length;
      const sources = Array.isArray(j.sources) ? j.sources.length : 0;
      if (t === 'article_exists') return { id: test.id || t, ok: !!j.slug, detail: `article ${test.slug} exists` };
      if (t === 'article_min_words') return { id: test.id || t, ok: words >= Number(test.min || 0), detail: `${words} words (need ${test.min})` };
      if (t === 'article_min_sources') return { id: test.id || t, ok: sources >= Number(test.min || 0), detail: `${sources} sources (need ${test.min})` };
      if (t === 'article_published') return { id: test.id || t, ok: String(j.status || '') !== 'draft', detail: `status=${j.status || 'published'}` };
      if (t === 'article_has_hero') {
        const hero = j.hero || (j.meta && j.meta.hero) || '';
        return { id: test.id || t, ok: !!hero, detail: hero ? 'hero present' : 'no hero' };
      }
    }
    if (t === 'sql_count_at_least') {
      const row = await env.DB.prepare(String(test.sql)).first();
      const n = Number(Object.values(row || { n: 0 })[0] || 0);
      return { id: test.id || t, ok: n >= Number(test.min || 1), detail: `count=${n} (need ${test.min})` };
    }
    if (t === 'evidence_present') {
      return { id: test.id || t, ok: true, detail: 'checked against required_evidence', evidence_field: test.field };
    }
    return { id: test.id || t || 'unknown', ok: false, detail: `unknown test type ${JSON.stringify(t)} — a test the runner cannot execute never passes` };
  } catch (e) {
    return { id: test?.id || t, ok: false, detail: 'test threw: ' + String(e?.message || e) };
  }
}

async function effectiveTests(env, row) {
  const own = parseJson(row.acceptance, []);
  if (own.length) return { tests: own, inherited_from: null };
  if (row.parent_id) {
    const parent = await getTask(env, row.parent_id);
    const inherited = parseJson(parent?.acceptance, []);
    if (inherited.length) return { tests: inherited, inherited_from: row.parent_id };
  }
  return { tests: [], inherited_from: null };
}

export async function runAcceptance(env, row, evidence, base) {
  const { tests, inherited_from } = await effectiveTests(env, row);
  const required = parseJson(row.evidence_required, []);
  const missing = required.filter((k) => {
    const v = evidence && evidence[k];
    return v == null || String(v).trim() === '';
  });
  const results = [];
  for (const test of tests) results.push(await runOneTest(env, test, base));
  // Name the unsatisfiable case instead of returning a blank refusal. A verdict that reports nothing
  // wrong and still refuses is unreadable, and it is what made this defect invisible.
  if (!tests.length) {
    results.push({
      id: 'no_acceptance_tests',
      ok: false,
      detail: `task ${row.id} declares no acceptance tests and inherits none from a parent, so no evidence can ever close it — the task object is the defect. Give it tests via its parent or a new task object.`,
    });
  }
  const testsPassed = results.every((r) => r.ok) && results.length > 0;
  return {
    accepted: testsPassed && missing.length === 0,
    tests_declared: tests.length,
    tests_passed: results.filter((r) => r.ok).length,
    tests_inherited_from: inherited_from,
    results,
    missing_evidence: missing,
  };
}

/** Evidence submission. The infrastructure decides; the agent's assertion is not consulted. */
export async function submitEvidence(env, id, { agent, model, capability, lease_token, evidence, changed, output, skill, evidence_steps }, base) {
  const row = await getTask(env, id);
  if (!row) return { ok: false, status: 404, error: 'task_not_found' };
  if (row.lease_token && lease_token !== row.lease_token) {
    return { ok: false, status: 403, error: 'lease_token_mismatch', hint: 'Lease the task first: POST /api/work/lease' };
  }
  if (!['leased', 'in_progress', 'evidence_submitted'].includes(row.state)) {
    return { ok: false, status: 409, error: 'not_in_a_submittable_state', state: row.state };
  }
  const verdict = await runAcceptance(env, row, evidence || {}, base);
  const to = verdict.accepted ? 'accepted' : 'refused';
  await env.DB.prepare(
    `UPDATE work_tasks SET state='evidence_submitted', updated_at=?, revision=revision+1 WHERE id=?`,
  ).bind(buildNowIso(), row.id).run();
  const mid = await getTask(env, row.id);
  const moved = await setState(env, mid, to, {
    last_result: JSON.stringify(verdict),
    failure_count: verdict.accepted ? row.failure_count : row.failure_count + 1,
    lease_holder: verdict.accepted ? row.lease_holder : null,
    lease_token: verdict.accepted ? row.lease_token : null,
    lease_expires_at: verdict.accepted ? row.lease_expires_at : null,
    completed_at: verdict.accepted ? buildNowIso() : null,
  });
  const action = await appendAction(env, {
    task_id: row.id, action: 'submit', agent, model, capability,
    task_revision: mid.revision, from_state: row.state, to_state: to,
    // The method pin (spec Phase 1): {skill, skill_version, skill_hash} rides inside the action's
    // input JSON, so an execution can be traced to the exact method text that governed it without
    // a schema change and without touching historical chain rows.
    input: { evidence: evidence || {}, ...(skill && skill.skill ? { skill: String(skill.skill), skill_version: skill.skill_version ?? null, skill_hash: skill.skill_hash || null } : {}) },
    output: output || null, changed: changed || null,
    tests: verdict.results, evidence: evidence || {}, result: verdict.accepted ? 'accepted' : 'refused',
  });
  // Acceptance closes the task. Refusal returns it to the queue with its failure recorded.
  if (verdict.accepted) {
    const acc = await getTask(env, row.id);
    await setState(env, acc, 'completed', { completed_at: buildNowIso(), lease_holder: null, lease_token: null, lease_expires_at: null });
    await appendAction(env, {
      task_id: row.id, action: 'accept', agent: 'infrastructure', model: null,
      from_state: 'accepted', to_state: 'completed', tests: verdict.results, result: 'accepted',
      task_revision: acc.revision + 1,
    });
  } else {
    const ref = await getTask(env, row.id);
    await setState(env, ref, 'open', { lease_holder: null, lease_token: null, lease_expires_at: null });
    await appendAction(env, {
      task_id: row.id, action: 'refuse', agent: 'infrastructure', model: null,
      from_state: 'refused', to_state: 'open', tests: verdict.results, result: 'refused',
      task_revision: ref.revision + 1,
      output: { why: verdict.results.filter((r) => !r.ok).map((r) => r.detail), missing_evidence: verdict.missing_evidence },
    });
  }
  // REPRODUCTION VERDICT (spec Phase 3). On a reproduction task the infrastructure — never the
  // reproducing agent — assigns the result state from the same acceptance run. A counterexample is
  // an agent's claim carried in evidence.counterexample; it is recorded as the result but its
  // consequence (the parent flipping to repair_required) still happens mechanically here.
  let reproduction = null;
  if (row.kind === 'reproduction') {
    const declared = Number(verdict.tests_declared || 0);
    const counterexample = evidence && String(evidence.counterexample || '').trim();
    reproduction = counterexample ? 'COUNTEREXAMPLE_FOUND'
      : declared === 0 ? 'NOT_REPLAYABLE'
      : verdict.accepted ? 'REPRODUCED'
      : Number(verdict.tests_passed || 0) > 0 ? 'PARTIALLY_REPRODUCED'
      : 'FAILED_TO_REPRODUCE';
    await appendAction(env, {
      task_id: row.id, action: 'reproduction_result', agent: 'infrastructure',
      input: { of: row.parent_id || null }, output: { result: reproduction, counterexample: counterexample || null },
      tests: verdict.results, result: reproduction, task_revision: mid.revision + 1,
    });
    // A completed original that failed to reproduce, or that a counterexample stands against, is
    // not "still completed": it moves to repair_required and re-enters the queue.
    if (row.parent_id && (reproduction === 'COUNTEREXAMPLE_FOUND' || reproduction === 'FAILED_TO_REPRODUCE')) {
      const parent = await getTask(env, row.parent_id);
      if (parent && (TRANSITIONS[parent.state] || []).includes('repair_required')) {
        await setState(env, parent, 'repair_required');
        await appendAction(env, {
          task_id: parent.id, action: 'reproduction_contested', agent: 'infrastructure',
          from_state: parent.state, to_state: 'repair_required',
          input: { reproduction_task: row.id, result: reproduction }, result: 'recorded',
          task_revision: Number(parent.revision || 1) + 1,
        });
      }
    }
  }
  // THE EVIDENCE MANIFEST (spec Phase 2), assembled at the one chokepoint where the lease is
  // verified and the verdict exists. Best-effort by design: a manifest failure must never change
  // the acceptance outcome, and the store degrades gracefully until migration 0357 is applied.
  let manifest_ref = null;
  try {
    const finalRow = await getTask(env, row.id);
    const manifest = await assembleManifest(env, finalRow, {
      actor: agent, evidence: evidence || {}, verdict, skill: skill || null,
      extra_steps: evidence_steps, synthesized: false,
    });
    if (reproduction) manifest.reproduction = { of: row.parent_id || null, result: reproduction };
    const stored = await storeManifest(env, row.id, manifest, { synthesized: false, actor: agent });
    if (stored.ok) manifest_ref = { url: `/api/work-evidence/${row.id}`, revision: stored.revision, manifest_hash: stored.manifest_hash };
  } catch {}
  return {
    ok: true,
    accepted: verdict.accepted,
    state: verdict.accepted ? 'completed' : 'open',
    ...(reproduction ? { reproduction_result: reproduction, of: row.parent_id || null } : {}),
    verdict,
    evidence_manifest: manifest_ref,
    audit_hash: action.hash,
    audit: `/api/work/task/${row.id}/audit`,
    moved: moved.ok,
  };
}

export async function recheckCompleted(env, base, { limit = 10, task_id = null } = {}) {
  const rows = task_id
    ? [await getTask(env, task_id)].filter((r) => r && r.state === 'completed')
    : (await env.DB.prepare(
        `SELECT * FROM work_tasks WHERE state='completed' ORDER BY completed_at DESC LIMIT ?`,
      ).bind(Math.min(50, Math.max(1, Number(limit)))).all()).results || [];
  const results = [];
  for (const row of rows) {
    const verdict = await runAcceptance(env, row, parseJson(row.last_result, {})?.evidence || {}, base);
    // A completed task with no runnable tests is a known population (no_acceptance_tests) —
    // re-checking cannot say anything new about it, so it is reported, not flipped.
    const noTests = verdict.results.some((r) => r.id === 'no_acceptance_tests');
    if (verdict.accepted || noTests) {
      results.push({ task_id: row.id, still_passing: verdict.accepted, no_tests: noTests });
      continue;
    }
    const fresh = await getTask(env, row.id);
    const moved = await setState(env, fresh, 'repair_required', { last_result: JSON.stringify(verdict) });
    await appendAction(env, {
      task_id: row.id, action: 'recheck_failed', agent: 'infrastructure',
      from_state: 'completed', to_state: moved.ok ? 'repair_required' : fresh.state,
      tests: verdict.results, result: 'refused',
      output: { why: verdict.results.filter((r) => !r.ok).map((r) => r.detail) },
      task_revision: Number(fresh.revision || 1) + 1,
    });
    results.push({ task_id: row.id, still_passing: false, moved_to: moved.ok ? 'repair_required' : fresh.state, failing: verdict.results.filter((r) => !r.ok).map((r) => r.id) });
  }
  return { checked: results.length, results };
}

/**
 * Open a reproduction of a task (spec Phase 3). A reproduction IS a work task — no new execution
 * machinery. It inherits the original's acceptance tests (the definition of "reproduced" is "the
 * same tests pass again for me"), records what it reproduces in parent_id, and is leased, worked
 * and submitted through the exact machinery every task uses. The result state is assigned by the
 * infrastructure in submitEvidence, never self-declared.
 */
export async function reproduceTask(env, originalId, { agent, model, capability, note } = {}) {
  const original = await getTask(env, originalId);
  if (!original) return { ok: false, status: 404, error: 'task_not_found' };
  if (original.kind === 'reproduction') {
    return { ok: false, status: 409, error: 'reproduction_of_a_reproduction', why: 'Reproduce the original; chains of copies prove nothing new. Original: ' + (original.parent_id || 'unknown') };
  }
  const tests = parseJson(original.acceptance, []);
  const id = await nextTaskId(env, 'WR');
  const now = buildNowIso();
  await env.DB.prepare(
    `INSERT INTO work_tasks (id,created_at,updated_at,kind,objective,detail,state,priority,depends_on,capabilities,acceptance,evidence_required,parent_id)
     VALUES (?,?,?,'reproduction',?,?,'open',3,'[]',?,?,?,?)`,
  ).bind(
    id, now, now,
    'Reproduce ' + originalId + ': ' + String(original.objective).slice(0, 160),
    'Independently re-execute ' + originalId + ' and let the infrastructure grade the result. '
      + 'Read its evidence first: /api/work-evidence/' + originalId + ' and /api/work/task/' + originalId + '/audit. '
      + 'Replay raw steps, re-fetch hashed steps and diff, re-perform asserted steps on outcome. '
      + 'If you find inputs where the original method fails, put them in evidence.counterexample with the record that shows it. '
      + (note ? 'Requester note: ' + String(note).slice(0, 300) : ''),
    original.capabilities || '[]',
    JSON.stringify(tests),
    JSON.stringify(['what_was_replayed', 'what_diverged', 'runtime_evidence']),
    originalId,
  ).run();
  await appendAction(env, {
    task_id: id, action: 'create', agent: agent || 'infrastructure', model, capability,
    to_state: 'open', input: { reproduction_of: originalId }, result: 'recorded', task_revision: 1,
  });
  await appendAction(env, {
    task_id: originalId, action: 'reproduction_opened', agent: agent || 'infrastructure',
    input: { reproduction_task: id }, result: 'recorded', task_revision: Number(original.revision || 1),
  });
  return {
    ok: true, reproduction_task: id, of: originalId,
    result_states: ['REPRODUCED', 'PARTIALLY_REPRODUCED', 'FAILED_TO_REPRODUCE', 'NOT_REPLAYABLE', 'COUNTEREXAMPLE_FOUND'],
    next: 'POST /api/work/lease {"agent":"<you>","task_id":"' + id + '"}',
    task: taskObject(await getTask(env, id)),
  };
}

/** A failure becomes a child task. The parent cannot complete while it is open. */
export async function recordFailure(env, parentId, { agent, model, capability, failure }) {
  const parent = await getTask(env, parentId);
  if (!parent) return { ok: false, status: 404, error: 'task_not_found' };
  const required = ['failure_class', 'layer', 'missing_invariant'];
  const missing = required.filter((k) => !failure || !String(failure[k] || '').trim());
  if (missing.length) return { ok: false, status: 422, error: 'failure_object_incomplete', missing };
  const id = await nextTaskId(env, 'WF');
  const now = buildNowIso();
  // The repair inherits the tests that caught the failure. Without this the child is born with '[]'
  // and can never be accepted, no matter how complete the repair — see effectiveTests above.
  const acceptance = (Array.isArray(failure.acceptance) && failure.acceptance.length)
    ? failure.acceptance
    : parseJson(parent.acceptance, []);
  await env.DB.prepare(
    `INSERT INTO work_tasks (id,created_at,updated_at,kind,objective,detail,state,priority,depends_on,capabilities,acceptance,evidence_required,parent_id,failure)
     VALUES (?,?,?,'failure',?,?,'open',1,'[]',?,?,?,?,?)`,
  ).bind(
    id, now, now,
    'Repair: ' + String(failure.failure_class).slice(0, 200),
    'A failure object attached to ' + parentId + '. Close it by enforcing the missing invariant at the shared layer, repairing every affected object, adding the regression test and the deploy blocker, then submitting runtime evidence.',
    parent.capabilities || '[]',
    JSON.stringify(acceptance),
    JSON.stringify(['repair', 'regression_test', 'deploy_blocker', 'repaired_objects', 'runtime_evidence']),
    parentId,
    JSON.stringify(failure),
  ).run();
  const p = await getTask(env, parentId);
  if ((TRANSITIONS[p.state] || []).includes('repair_required')) await setState(env, p, 'repair_required');
  await appendAction(env, {
    task_id: parentId, action: 'fail', agent, model, capability,
    from_state: parent.state, to_state: 'repair_required', input: { failure },
    output: { child_task: id }, result: 'recorded', task_revision: p.revision,
  });
  await appendAction(env, {
    task_id: id, action: 'create', agent: 'infrastructure', to_state: 'open',
    input: { failure, parent: parentId }, result: 'recorded', task_revision: 1,
  });
  return { ok: true, failure_task: id, parent_state: 'repair_required' };
}

export async function nextTaskId(env, prefix = 'WT') {
  const row = await env.DB.prepare(
    `SELECT id FROM work_tasks WHERE id LIKE ? ORDER BY id DESC LIMIT 1`,
  ).bind(prefix + '-%').first();
  const n = row ? Number(String(row.id).split('-')[1] || 0) + 1 : 1;
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

// Exactly the fields a task is made of, plus the actor fields every write carries. Anything else in
// the body is a misunderstanding about what this route does, and it must not be answered by silently
// creating a row.
const CREATE_FIELDS = new Set([
  'id', 'kind', 'objective', 'detail', 'state', 'priority', 'depends_on', 'capabilities',
  'acceptance', 'evidence_required', 'parent_id', 'supersedes',
  'agent', 'model', 'capability_token',
]);

export async function createTask(env, t, actor = 'owner') {
  if (!t?.objective) return { ok: false, status: 400, error: 'objective_required' };
  const unknown = Object.keys(t).filter((k) => !CREATE_FIELDS.has(k));
  if (unknown.length) {
    return {
      ok: false, status: 400, error: 'unknown_fields',
      unknown,
      accepted_fields: [...CREATE_FIELDS],
      why: 'This route creates a real task in the canonical object. It has no dry-run mode and no '
        + 'ignored fields: a request it does not fully understand is refused rather than half-honoured.',
    };
  }
  const id = t.id || (await nextTaskId(env, t.kind === 'failure' ? 'WF' : 'WT'));
  const now = buildNowIso();
  await env.DB.prepare(
    `INSERT INTO work_tasks (id,created_at,updated_at,kind,objective,detail,state,priority,depends_on,capabilities,acceptance,evidence_required,parent_id,supersedes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    id, now, now, t.kind || 'work', String(t.objective), t.detail || '', t.state || 'open',
    Number(t.priority || 5), JSON.stringify(t.depends_on || []), JSON.stringify(t.capabilities || []),
    JSON.stringify(t.acceptance || []), JSON.stringify(t.evidence_required || []),
    t.parent_id || null, t.supersedes || null,
  ).run();
  await appendAction(env, { task_id: id, action: 'create', agent: actor, to_state: t.state || 'open', input: t, result: 'recorded', task_revision: 1 });
  return { ok: true, task: taskObject(await getTask(env, id)) };
}

/**
 * Change a task's priority, with the reason on the record.
 *
 * Priority is one of the obligations this object took over from a supervising session, so it has to
 * be changeable — and the only way to change it was direct SQL, which is the bypass the object
 * exists to remove. Ordering work is a decision; a decision with no recorded reason is indistinct
 * from a mistake, so the reason is required and the old value is kept in the audit row.
 */
export async function reprioritiseTask(env, id, { agent, priority, reason } = {}) {
  const row = await getTask(env, id);
  if (!row) return { ok: false, status: 404, error: 'task_not_found' };
  const p = Number(priority);
  if (!Number.isInteger(p) || p < 1 || p > 9) {
    return { ok: false, status: 400, error: 'priority_out_of_range', given: priority, allowed: '1 (first) to 9 (last)' };
  }
  if (!reason) return { ok: false, status: 400, error: 'reason_required', why: 'Reordering work without a stated reason cannot be reviewed later.' };
  if (['completed', 'superseded'].includes(row.state)) {
    return { ok: false, status: 409, error: 'task_is_closed', state: row.state };
  }
  const before = Number(row.priority);
  if (before === p) return { ok: true, task: taskObject(row), unchanged: true };
  await env.DB.prepare(
    'UPDATE work_tasks SET priority=?, updated_at=?, revision=revision+1 WHERE id=?',
  ).bind(p, buildNowIso(), row.id).run();
  await appendAction(env, {
    task_id: id, action: 'reprioritise', agent: agent || 'owner',
    input: { from: before, to: p, reason },
    output: { priority: p },
    result: 'recorded', task_revision: Number(row.revision || 1) + 1,
  });
  return { ok: true, task: taskObject(await getTask(env, id)), from: before, to: p, reason };
}

export async function supersedeTask(env, id, { agent, reason, replaced_by } = {}) {
  const row = await getTask(env, id);
  if (!row) return { ok: false, status: 404, error: 'task_not_found' };
  if (!reason) return { ok: false, status: 400, error: 'reason_required', why: 'A withdrawal without a stated reason is indistinguishable from a deletion.' };
  if (!(TRANSITIONS[row.state] || []).includes('superseded')) {
    return {
      ok: false, status: 409, error: 'illegal_transition',
      from: row.state, to: 'superseded', allowed: TRANSITIONS[row.state] || [],
      why: 'A task in this state cannot be withdrawn. Completed work stays completed; leased work is released first.',
    };
  }
  if (replaced_by) {
    const other = await getTask(env, replaced_by);
    if (!other) return { ok: false, status: 400, error: 'replacement_not_found', replaced_by };
  }
  await setState(env, row, 'superseded', {
    supersedes: row.supersedes || null,
    last_result: 'superseded' + (replaced_by ? ' by ' + replaced_by : ''),
  });
  await appendAction(env, {
    task_id: id, action: 'supersede', agent: agent || 'owner',
    from_state: row.state, to_state: 'superseded',
    input: { reason, replaced_by: replaced_by || null },
    output: { note: 'row retained; withdrawal recorded as a revision' },
    result: 'superseded', task_revision: Number(row.revision || 1) + 1,
  });
  return { ok: true, task: taskObject(await getTask(env, id)), reason, replaced_by: replaced_by || null };
}

// ─────────────────────────────── the projection both surfaces read ───────────────────────────────

export async function buildWorkProjection(env, { base = 'https://miscsubjects.com' } = {}) {
  const tasks = (await env.DB.prepare('SELECT * FROM work_tasks ORDER BY priority ASC, id ASC').all()).results || [];
  const laws = (await env.DB.prepare(
    `SELECT key, level, category, rule, rationale FROM laws WHERE enabled=1 ORDER BY level DESC, category, key`,
  ).all()).results || [];
  const actions = (await env.DB.prepare(
    'SELECT id, ts, task_id, action, agent, model, result, hash FROM work_actions ORDER BY id DESC LIMIT 50',
  ).all()).results || [];
  const head = await env.DB.prepare('SELECT hash, id FROM work_actions ORDER BY id DESC LIMIT 1').first();
  const counts = {};
  for (const s of WORK_STATES) counts[s] = tasks.filter((t) => t.state === s).length;
  const eligible = await eligibleTasks(env, 5);
  return {
    _self: {
      schema: 'miscsubjects/work-object/1',
      what: 'The canonical operating object of this build. Every task, rule, acceptance test, piece of evidence and failure lives here. Markdown files in the repository are pointers to this object and carry no authority.',
      human_projection: base + '/a/the-work-object',
      machine_projection: base + '/api/work',
      bootstrap: base + '/api/work/bootstrap',
      append_only: 'work_actions is hash-chained; nothing is updated or deleted. A correction appends a revision that names what it supersedes.',
    },
    objective: 'Operate and improve miscsubjects.com through leased task objects whose completion is decided by the infrastructure, never by an agent\'s claim.',
    state_machine: { states: WORK_STATES, transitions: TRANSITIONS, lease_seconds: LEASE_SECONDS },
    counts,
    next_eligible_action: eligible.length
      ? { lease: base + '/api/work/lease', task_id: eligible[0].id, objective: eligible[0].objective, priority: eligible[0].priority }
      : { lease: base + '/api/work/lease', task_id: null, note: 'nothing eligible: every open task is blocked or leased' },
    governing_invariants: laws.map((l) => ({ key: l.key, level: l.level, category: l.category, rule: l.rule, why: l.rationale })),
    tasks: tasks.map(taskObject),
    audit: { head_hash: head?.hash || 'genesis', head_action: head?.id || 0, recent: actions, full: base + '/api/work/audit' },
    unresolved_bypasses: UNRESOLVED_BYPASSES,
  };
}

// Every path that can still change state or content without passing this object. Kept in the
// object itself so it is never a claim in a chat message.
export const UNRESOLVED_BYPASSES = Object.freeze([
  {
    path: 'D1_EXEC / D1_QUERY direct SQL via /api/dispatch',
    effect: 'wrote to articles, article_slots, work_tasks and work_actions without running acceptance tests or appending an audit row — an UPDATE could close a task, and a DELETE could edit the hash chain that is supposed to prove nothing was edited',
    status: 'closed 2026-08-05 (WT-0039) — functions/_lib/governed_tables.js refuses a raw write to any of those four tables and names the path that does the work instead. Repair is still possible and no longer silent: D1_REPAIR runs the same statement, requires a stated reason, and appends a work_actions row. Pinned by functions/_lib/governed_tables.test.mjs and by a deploy gate that proves the refusal live.',
  },
  {
    path: 'PUT/PATCH /api/articles/<slug> outside a leased task',
    effect: 'article content can change without a task object recording why',
    status: 'recorded since 2026-08-28 — every article mutate logs an ARTICLE_WRITE_LINKAGE event (declared task_id with lease verification, a declared no_task reason, or "undeclared"), so an unlinked write is findable on the ledger. Hard refusal remains off deliberately: it would break the owner\'s own flows.',
  },
  {
    path: 'wrangler pages deploy run by hand instead of scripts/ship.mjs',
    effect: 'skips every deploy gate',
    status: 'open — convention only',
  },
]);
