// THE WORK OBJECT — machine projection and the only path that moves task state.
//
//   GET  /api/work                        the canonical object: objective, invariants, tasks, next action, bypasses
//   GET  /api/work/bootstrap              the cold-start contract. A fresh agent needs this and a token, nothing else.
//   GET  /api/work/audit                  the append-only, hash-chained action log
//   GET  /api/work/task/<id>              one task object
//   GET  /api/work/task/<id>/audit        that task's actions
//   POST /api/work/lease                  { agent, model } → leases the next eligible task
//   POST /api/work/task/<id>/progress     { agent, lease_token, note }
//   POST /api/work/task/<id>/submit       { agent, lease_token, evidence, changed } → infra runs acceptance
//   POST /api/work/task/<id>/fail         { agent, failure:{failure_class,layer,missing_invariant,...} }
//   POST /api/work/task/<id>/reprioritise { priority, reason } → reorder, with the reason recorded
//   POST /api/work/task/<id>/supersede    { reason, replaced_by? } → withdraw without deleting
//   POST /api/work/task/<id>/reproduce    { note? } → open an independent re-execution (kind: reproduction)
//   POST /api/work/task                   { objective, ... } → create (owner / act scope)
//
// Reads are public: an operating object nobody can inspect is not auditable. Writes require the
// terminal key, an admin cookie, or an act-scope share token — the token identity is recorded on
// every action, never the secret.

import { isBuildAuthed, verifyShareToken, verifyShareTokenValue } from '../../_lib/admin_session.js';
import {
  buildWorkProjection, createTask, getTask, leaseNext, recordFailure, releaseExpiredLeases,
  submitEvidence, supersedeTask, reprioritiseTask, reproduceTask, recheckCompleted, taskObject, appendAction, verifyActionChain, WORK_STATES,
  UNRESOLVED_BYPASSES,
} from '../../_lib/work_object.js';

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    },
  });
}

async function capability(request, env, body) {
  if (await isBuildAuthed(request, env)) return { ok: true, identity: 'owner-key' };
  const fromUrl = await verifyShareToken(request, env);
  if (fromUrl && /^(act|row:|rows:|pfx:)/.test(String(fromUrl.scope || ''))) {
    return { ok: true, identity: 'share:' + fromUrl.scope + ':' + String(fromUrl.nonce || '').slice(0, 8) };
  }
  const raw = body?.capability_token || request.headers.get('x-work-token') || '';
  if (raw) {
    const tok = await verifyShareTokenValue(env, raw);
    if (tok && /^(act|row:|rows:|pfx:)/.test(String(tok.scope || ''))) {
      return { ok: true, identity: 'share:' + tok.scope + ':' + String(tok.nonce || '').slice(0, 8) };
    }
  }
  return { ok: false };
}

const BOOTSTRAP = (base) => ({
  _self: {
    schema: 'miscsubjects/work-bootstrap/1',
    what: 'Everything an agent needs to start working on this build with no prior conversation, no CLAUDE.md, no STATE.md, no AGENTS.md and no previous agent\'s report.',
  },
  read_this_first: [
    'This object is the authority. Markdown files in the repository are pointers to it and carry no rules, no state and no priorities.',
    'You do not choose what to work on. You lease a task and the task tells you the objective, the permitted capabilities, the acceptance tests and the evidence required.',
    'You cannot complete a task by saying you completed it. You submit evidence; this infrastructure runs the task\'s acceptance tests and decides.',
    'If you discover a failure, record it as a failure object against the task. It must name the failure class, the infrastructure layer that permitted it, and the invariant that should have prevented it.',
  ],
  step_1_read_the_object: { method: 'GET', url: base + '/api/work' },
  step_2_lease_a_task: {
    method: 'POST', url: base + '/api/work/lease',
    body: { agent: '<your name>', model: '<your model id>', capability_token: '<scoped token>' },
    returns: 'one bounded task object plus a lease_token',
  },
  step_3_do_the_work: {
    note: 'Use only the capabilities the task lists. Article writes go through PUT/PATCH /api/articles/<slug>, which runs the content guards server-side and will refuse a violation with a 422 that explains the fix.',
  },
  step_4_submit_evidence: {
    method: 'POST', url: base + '/api/work/task/<task_id>/submit',
    body: { agent: '<your name>', lease_token: '<from step 2>', evidence: { '<required field>': '<value>' }, changed: ['<files, rows or objects you changed>'] },
    returns: 'accepted:true and state:completed, or accepted:false with the exact failing test',
  },
  step_5_if_you_found_a_defect: {
    method: 'POST', url: base + '/api/work/task/<task_id>/fail',
    body: { agent: '<your name>', failure: { failure_class: '', layer: '', missing_invariant: '', repair: '', regression_test: '', deploy_blocker: '', repaired_objects: [], runtime_evidence: '' } },
  },
  audit: base + '/api/work/audit',
  human_projection: base + '/a/the-work-object',
  unresolved_bypasses: UNRESOLVED_BYPASSES,
});

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean); // api, work, ...
  const seg = parts.slice(2);
  const method = request.method.toUpperCase();
  const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await request.json().catch(() => ({})) : {};
  const base = url.origin;

  try {
    if (method === 'GET' && seg.length === 0) {
      await releaseExpiredLeases(env);
      return json(await buildWorkProjection(env, { base }));
    }
    if (method === 'GET' && seg[0] === 'bootstrap') return json(BOOTSTRAP(base));
    if (method === 'GET' && seg[0] === 'states') return json({ states: WORK_STATES });

    if (method === 'GET' && seg[0] === 'audit') {
      const limit = Math.min(Number(url.searchParams.get('limit') || 200), 1000);
      // Verification always runs over the WHOLE chain from row 1, never over the page being
      // displayed. Verifying only the last N rows would report "valid" while an overwritten row
      // sat below the window — which is the failure this surface exists to make impossible.
      const all = (await env.DB.prepare(
        'SELECT * FROM work_actions ORDER BY id ASC',
      ).all()).results || [];
      const verification = await verifyActionChain(all);
      const rows = (await env.DB.prepare(
        'SELECT * FROM work_actions ORDER BY id DESC LIMIT ?',
      ).bind(limit).all()).results || [];
      const head = rows[0] || null;
      return json({
        _self: { schema: 'miscsubjects/work-audit/1', append_only: true, chain: 'each row hashes prev_hash + its payload' },
        verification,
        head_hash: head?.hash || 'genesis',
        total_actions: all.length,
        count: rows.length,
        actions: rows,
      });
    }

    if (seg[0] === 'task' && seg[1] && method === 'GET') {
      const row = await getTask(env, seg[1]);
      if (!row) return json({ ok: false, error: 'task_not_found' }, 404);
      if (seg[2] === 'audit') {
        const rows = (await env.DB.prepare(
          'SELECT * FROM work_actions WHERE task_id=? ORDER BY id ASC',
        ).bind(seg[1]).all()).results || [];
        // These rows are a slice of one chain: their prev_hash values point at rows belonging to
        // other tasks, so linkage cannot be checked here without misreporting. Linkage is verified
        // over the whole chain at /api/work/audit, and this says so rather than implying otherwise.
        return json({
          task_id: seg[1],
          count: rows.length,
          chain: {
            slice: true,
            linkage_verified_at: base + '/api/work/audit',
            note: 'each row below carries its own prev_hash and hash; the full chain is recomputed at the audit URL above',
          },
          actions: rows,
        });
      }
      return json({ task: taskObject(row) });
    }

    // ---- mutations ----
    const cap = await capability(request, env, body);
    if (!cap.ok) {
      return json({
        ok: false, error: 'capability_required',
        how_to_fix: 'Present the terminal key (x-terminal-key), an admin cookie, or an act-scope share token as ?share=, x-work-token, or body.capability_token. Reads are public; state changes are not.',
      }, 401);
    }
    const actor = { agent: String(body.agent || cap.identity), model: body.model ? String(body.model) : null, capability: cap.identity };

    if (method === 'POST' && seg[0] === 'lease') {
      const r = await leaseNext(env, { ...actor, task_id: body.task_id || null });
      return json(r, r.ok ? 200 : (r.status || 400));
    }

    // Re-run acceptance on completed tasks (spec Phase 0.5): completed is no longer permanent by
    // default — a task whose tests fail today moves to repair_required with the failing test named.
    if (method === 'POST' && seg[0] === 'recheck') {
      const r = await recheckCompleted(env, base, { limit: body.limit, task_id: body.task_id || null });
      return json({ ok: true, ...r });
    }

    if (method === 'POST' && seg[0] === 'task' && !seg[1]) {
      const r = await createTask(env, body, actor.agent);
      return json(r, r.ok ? 201 : (r.status || 400));
    }

    if (method === 'POST' && seg[0] === 'task' && seg[1]) {
      const id = seg[1];
      const row = await getTask(env, id);
      if (!row) return json({ ok: false, error: 'task_not_found' }, 404);

      if (seg[2] === 'progress') {
        if (row.lease_token && body.lease_token !== row.lease_token) {
          return json({ ok: false, error: 'lease_token_mismatch' }, 403);
        }
        if (row.state === 'leased') {
          await env.DB.prepare(`UPDATE work_tasks SET state='in_progress', updated_at=?, revision=revision+1 WHERE id=? AND state='leased'`)
            .bind(new Date().toISOString(), id).run();
        }
        const a = await appendAction(env, {
          task_id: id, action: 'progress', ...actor, from_state: row.state,
          to_state: 'in_progress', input: { note: String(body.note || '') }, result: 'recorded',
          task_revision: row.revision,
        });
        return json({ ok: true, state: 'in_progress', audit_hash: a.hash });
      }

      // Withdraw a task without deleting it. The row stays, the reason is recorded, and the audit
      // chain carries the revision that made the move.
      if (seg[2] === 'reprioritise' || seg[2] === 'reprioritize') {
        const r = await reprioritiseTask(env, id, {
          agent: actor.agent, priority: body.priority, reason: body.reason,
        });
        return json(r, r.ok ? 200 : (r.status || 400));
      }
      if (seg[2] === 'supersede') {
        const r = await supersedeTask(env, id, {
          agent: actor.agent, reason: body.reason, replaced_by: body.replaced_by,
        });
        return json(r, r.ok ? 200 : (r.status || 400));
      }
      if (seg[2] === 'release') {
        // An agent that cannot finish hands the task back. Without this the only way out of a lease
        // was to wait an hour for expiry, and the only fast alternative was direct SQL — a bypass.
        if (row.lease_token && body.lease_token !== row.lease_token) {
          return json({ ok: false, error: 'lease_token_mismatch' }, 403);
        }
        if (!['leased', 'in_progress'].includes(row.state)) {
          return json({ ok: false, error: 'not_leased', state: row.state }, 409);
        }
        await env.DB.prepare(
          `UPDATE work_tasks SET state='open', lease_holder=NULL, lease_model=NULL, lease_token=NULL, lease_expires_at=NULL, updated_at=?, revision=revision+1 WHERE id=?`,
        ).bind(new Date().toISOString(), id).run();
        const a = await appendAction(env, {
          task_id: id, action: 'release', ...actor, from_state: row.state, to_state: 'open',
          input: { reason: String(body.reason || '') }, result: 'recorded', task_revision: row.revision,
        });
        return json({ ok: true, state: 'open', audit_hash: a.hash });
      }

      if (seg[2] === 'submit') {
        const r = await submitEvidence(env, id, {
          ...actor, lease_token: body.lease_token, evidence: body.evidence,
          changed: body.changed, output: body.output,
          skill: body.skill || null, evidence_steps: body.evidence_steps || null,
        }, base);
        return json(r, r.ok ? 200 : (r.status || 400));
      }

      if (seg[2] === 'fail') {
        const r = await recordFailure(env, id, { ...actor, failure: body.failure });
        return json(r, r.ok ? 201 : (r.status || 400));
      }

      // Reproduction (spec Phase 3): open an independent re-execution of this task. The result
      // state is assigned by the infrastructure when the reproduction submits its own evidence.
      if (seg[2] === 'reproduce') {
        const r = await reproduceTask(env, id, { ...actor, note: body.note });
        return json(r, r.ok ? 201 : (r.status || 400));
      }
    }

    return json({ ok: false, error: 'no_such_route', method, path: url.pathname, see: base + '/api/work/bootstrap' }, 404);
  } catch (e) {
    return json({ ok: false, error: 'work_route_threw', detail: String(e?.message || e) }, 500);
  }
}
