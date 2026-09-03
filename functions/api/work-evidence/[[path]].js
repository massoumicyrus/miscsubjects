// THE EXECUTION-EVIDENCE MANIFEST, public surface (spec Phase 2).
//
//   GET  /api/work-evidence/<task_id>              latest manifest (?revision=n for an earlier one)
//   GET  /api/work-evidence/<task_id>/verify       re-resolve every reference, recompute every hash
//   POST /api/work-evidence/<task_id>/assemble     retroactive assembly (owner / act scope) — flagged synthesized
//
// Reads are public and keyless — an evidence object nobody can inspect proves nothing. The only
// automatic writer is submitEvidence() in work_object.js, at the chokepoint where the lease is
// verified and the verdict exists. Retroactive assembly is honest about itself: synthesized:1,
// with the gap recorded inside the manifest.

import { isBuildAuthed, verifyShareToken, verifyShareTokenValue } from '../../_lib/admin_session.js';
import { getTask } from '../../_lib/work_object.js';
import { assembleManifest, storeManifest, getManifest, verifyManifest, resolveStepPayload, attachOutcome, emailOutcome } from '../../_lib/work_evidence.js';

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean).slice(2); // task_id, leaf?
  const taskId = parts[0] || '';
  const leaf = (parts[1] || '').toLowerCase();
  const method = request.method.toUpperCase();

  if (!taskId) {
    return json({
      _self: {
        schema: 'oip/work-evidence/1',
        what: 'One manifest per unit of work: what was attempted, which method governed it, every step as a reference into existing records (work_actions, invocations), per-step replayability (raw|hashed|witnessed|asserted|not_replayable), the acceptance verdict, cost, and the honest gaps.',
        read: 'GET /api/work-evidence/<task_id>',
        verify: 'GET /api/work-evidence/<task_id>/verify — every reference re-resolved, every hash recomputed, failures named',
        reproduce: 'POST /api/work/task/<task_id>/reproduce — open an independent re-execution',
        spec: 'SPEC_SKILL_EVIDENCE_GRAPH.md (repo) — Phase 2',
      },
    });
  }

  try {
    if (method === 'GET') {
      const stored = await getManifest(env, taskId, url.searchParams.get('revision'));
      // DISCLOSURE IS ENFORCED HERE, NOT DESCRIBED. public: everything below is keyless.
      // hash_only: existence, hashes and the verify verdict stay public; manifest body and
      // payloads require a capability. private: every read requires one. Unknown tier = private.
      if (stored) {
        const tier = ['public', 'hash_only', 'private'].includes(String(stored.disclosure)) ? String(stored.disclosure) : (stored.disclosure == null ? 'public' : 'private');
        if (tier !== 'public') {
          let authed = await isBuildAuthed(request, env);
          if (!authed) {
            const tok = (await verifyShareToken(request, env))
              || (request.headers.get('x-work-token') ? await verifyShareTokenValue(env, request.headers.get('x-work-token')) : null);
            authed = !!(tok && /^(act|row:|rows:|pfx:)/.test(String(tok.scope || '')));
          }
          if (!authed) {
            if (tier === 'hash_only' && (leaf === 'verify' || leaf === '')) {
              if (leaf === 'verify') {
                const v = await verifyManifest(env, stored);
                return json({ task_id: taskId, revision: stored.revision, manifest_hash: stored.manifest_hash, disclosure: tier, ...v });
              }
              return json({
                task_id: taskId, revision: stored.revision, manifest_hash: stored.manifest_hash,
                disclosure: tier, created_at: stored.created_at,
                note: 'hash_only: this evidence exists, hashes to the value above, and verifies at /verify. Its body and payloads require a capability.',
              });
            }
            return json({ error: 'capability_required', disclosure: tier, task_id: taskId }, 401);
          }
        }
      }
      if (!stored) {
        const task = await getTask(env, taskId);
        if (!task) return json({ error: 'task_not_found', task_id: taskId }, 404);
        return json({
          error: 'no_manifest_yet', task_id: taskId, state: task.state,
          why: 'Manifests are assembled when evidence is submitted. This task has not submitted since manifests existed.',
          assemble_retroactively: 'POST /api/work-evidence/' + taskId + '/assemble (owner or act-scope token) — the result is flagged synthesized',
        }, 404);
      }
      if (leaf === 'verify') {
        const v = await verifyManifest(env, stored);
        return json({ task_id: taskId, revision: stored.revision, manifest_hash: stored.manifest_hash, synthesized: !!stored.synthesized, ...v });
      }
      // THE PORTABLE DOSSIER (spec Phase 5): one bundle a verifier can take away and check with
      // no further access — manifest, its live verification, the signed Merkle checkpoint and
      // chain head, external anchors, and a GRADED verdict (1F916 vocabulary): witnessed /
      // consistent-unwitnessed / unanchored — never one flat PROVEN.
      if (leaf === 'dossier') {
        const v = await verifyManifest(env, stored);
        let checkpoint = null, anchor = null;
        try { checkpoint = await env.LEDGER.prepare('SELECT * FROM chain_checkpoint_signatures ORDER BY seq DESC LIMIT 1').first(); } catch {}
        try { anchor = await env.LEDGER.prepare('SELECT anchor_id, created_at FROM anchors ORDER BY created_at DESC LIMIT 1').first(); } catch {}
        const verdict = !v.valid ? 'diverged'
          : checkpoint && checkpoint.signature ? 'witnessed'
          : anchor ? 'consistent-unwitnessed'
          : 'unanchored';
        return json({
          schema: 'oip/work-evidence-dossier/1',
          verdict,
          verdict_meaning: {
            witnessed: 'manifest references resolve AND a signed Merkle checkpoint covers the chain (verify its signature offline, countersignatures in the repo .witness/ log)',
            'consistent-unwitnessed': 'references resolve and external anchors exist, but no signed checkpoint yet',
            unanchored: 'references resolve; nothing external pins the chain head yet',
            diverged: 'one or more references failed to resolve or re-hash — the named failures are the finding',
          },
          task_id: taskId, revision: stored.revision, manifest_hash: stored.manifest_hash,
          synthesized: !!stored.synthesized,
          verification: v,
          signed_checkpoint: checkpoint ? { seq: checkpoint.seq, merkle_root: checkpoint.merkle_root, payload: checkpoint.payload, alg: checkpoint.alg, signature: checkpoint.signature, verify_at: '/api/chain/checkpoint?seq=' + checkpoint.seq } : null,
          external_anchor: anchor || null,
          manifest: stored.manifest,
          how_to_verify_offline: 'recompute sha256(manifest JSON) against manifest_hash; verify the checkpoint payload signature against the public key at /api/chain/checkpoint; for any step, /payloads serves the redacted record with its dual-hash binding',
        });
      }
      // OTEL-SHAPED EXPORT: the manifest's steps as span-like records so OTel-tooling users can
      // ingest the case. An export shape, not a replacement — spans carry no acceptance verdicts,
      // replayability tiers, or chain bindings, which is why the manifest stays canonical.
      if (url.searchParams.get('format') === 'otel' && !leaf) {
        const m = stored.manifest;
        const spans = (m.steps || []).map((s, i) => ({
          traceId: taskId, spanId: (s.ref ? s.ref.kind + ':' + s.ref.id : 'step:' + i),
          name: s.role || 'step', startTimeUnixNano: s.ts ? Date.parse(s.ts) * 1e6 : null,
          attributes: {
            'miscsubjects.replayability': s.replayability,
            'miscsubjects.record_hash': s.ref?.hash || null,
            'gen_ai.usage.cost_usd': s.cost_usd ?? null,
            'miscsubjects.actor': s.actor || null,
          },
        }));
        return json({ resource: { 'service.name': 'miscsubjects-work', 'miscsubjects.task_id': taskId, 'miscsubjects.claim_grade': m.claim_grade || 'EXECUTED' }, spans, canonical: '/api/work-evidence/' + taskId });
      }
      // THE CASE FILE, opened. Every step resolved to its actual redacted record — the exact
      // action string that went out, the exact payload that came back (R2-archived payloads
      // included). ?step=<n> for one; paged 20 at a time for all, so a 50-tool loop is readable.
      if (leaf === 'payloads') {
        const steps = stored.manifest.steps || [];
        const stepParam = url.searchParams.get('step');
        if (stepParam != null) {
          const i = Number(stepParam);
          if (!(i >= 0 && i < steps.length)) return json({ error: 'step_out_of_range', steps: steps.length }, 404);
          return json({ task_id: taskId, step: i, ...(await resolveStepPayload(env, steps[i])) });
        }
        const page = Math.max(1, Number(url.searchParams.get('page') || 1));
        const per = 20;
        const slice = steps.slice((page - 1) * per, page * per);
        const resolved = [];
        for (let i = 0; i < slice.length; i++) resolved.push({ step_index: (page - 1) * per + i, ...(await resolveStepPayload(env, slice[i])) });
        return json({
          task_id: taskId, revision: stored.revision, claim_grade: stored.manifest.claim_grade || 'EXECUTED',
          steps_total: steps.length, page, pages: Math.max(1, Math.ceil(steps.length / per)),
          note: 'Raw records behind each manifest step, redacted at egress. What this proves: these calls happened with these payloads. What it does not prove by itself: that they caused any outcome — see /api/comparisons.',
          payloads: resolved,
        });
      }
      return json({
        task_id: taskId, revision: stored.revision, manifest_hash: stored.manifest_hash,
        synthesized: !!stored.synthesized, created_at: stored.created_at,
        manifest: stored.manifest,
      });
    }

    if (method === 'POST' && leaf === 'assemble') {
      let authed = await isBuildAuthed(request, env);
      if (!authed) {
        const tok = (await verifyShareToken(request, env))
          || (request.headers.get('x-work-token') ? await verifyShareTokenValue(env, request.headers.get('x-work-token')) : null);
        authed = !!(tok && /^(act|row:|rows:|pfx:)/.test(String(tok.scope || '')));
      }
      if (!authed) return json({ error: 'capability_required' }, 401);
      const task = await getTask(env, taskId);
      if (!task) return json({ error: 'task_not_found', task_id: taskId }, 404);
      const body = await request.json().catch(() => ({}));
      const manifest = await assembleManifest(env, task, {
        actor: String(body.agent || 'retro-assembler'), evidence: null, verdict: null,
        skill: body.skill || null, extra_steps: body.evidence_steps || null, synthesized: true,
      });
      const stored = await storeManifest(env, taskId, manifest, { synthesized: true, actor: String(body.agent || 'retro-assembler'), disclosure: body.disclosure });
      return json(stored, stored.ok ? 201 : 503);
    }

    // Attach a measured outcome (a measurement with sources, never a conclusion). For tracked
    // email the measurement is computed live from email_sends when send_ids are given — the one
    // outcome source the build already has; ad-platform metrics join the same shape when an ads
    // integration exists to read them from.
    if (method === 'POST' && leaf === 'outcome') {
      let authed = await isBuildAuthed(request, env);
      if (!authed) {
        const tok = (await verifyShareToken(request, env))
          || (request.headers.get('x-work-token') ? await verifyShareTokenValue(env, request.headers.get('x-work-token')) : null);
        authed = !!(tok && /^(act|row:|rows:|pfx:)/.test(String(tok.scope || '')));
      }
      if (!authed) return json({ error: 'capability_required' }, 401);
      const body = await request.json().catch(() => ({}));
      let outcome = body.outcome || null;
      if (!outcome && Array.isArray(body.send_ids)) {
        const m = await emailOutcome(env, body.send_ids);
        if (!m.ok) return json(m, 400);
        const metric = String(body.metric || 'email_click_rate');
        outcome = {
          metric,
          value: metric === 'email_open_rate' ? m.open_rate : m.click_rate,
          n: m.sends,
          source_refs: body.send_ids.map((s) => ({ kind: 'email_sends', ref: String(s) })),
        };
      }
      const r = await attachOutcome(env, taskId, outcome, { actor: String(body.agent || 'owner') });
      return json(r, r.ok ? 201 : (r.status || 400));
    }

    return json({ error: 'no_such_route', method, path: url.pathname }, 404);
  } catch (e) {
    return json({ error: 'work_evidence_route_threw', detail: String(e?.message || e) }, 500);
  }
}
