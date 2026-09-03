// COMPARISONS — the experiment object (migration 0358, spec: execution-case layer).
//
//   GET  /api/comparisons                      list (newest first; ?metric=, ?ref= filter)
//   GET  /api/comparisons/<id>                 one comparison, grade computed, replications listed
//   POST /api/comparisons                      create (owner / act-scope token), append-only
//   POST /api/comparisons/<id>/supersede       mark superseded by a later row (reason required)
//
// THE RULE THE GRADE ENFORCES. A comparison's claim grade is computed from its DECLARED design and
// its replication record — never stored as an opinion, never higher than the design supports:
//   randomized → CONTROLLED_COMPARISON · matched/sequential → ASSOCIATION_OBSERVED ·
//   unknown → OUTCOME_OBSERVED · +REPLICATED when an independent row names this one in
//   `replicates` and agrees in direction. GENERALIZED is never a row — only a projection.

import { isBuildAuthed, verifyShareToken, verifyShareTokenValue } from '../../_lib/admin_session.js';
import { logEvent } from '../../_lib/event_log.js';

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
  });
}

const DESIGNS = new Set(['randomized', 'matched', 'sequential', 'unknown']);

function baseGrade(design) {
  if (design === 'randomized') return 'CONTROLLED_COMPARISON';
  if (design === 'matched' || design === 'sequential') return 'ASSOCIATION_OBSERVED';
  return 'OUTCOME_OBSERVED';
}

function direction(row) {
  if (row.delta == null) return null;
  return row.delta > 0 ? 'up' : row.delta < 0 ? 'down' : 'flat';
}

async function gradeWithReplication(env, row) {
  const grade = baseGrade(row.design);
  let replications = [];
  try {
    replications = (await env.DB.prepare(
      'SELECT id, actor, delta, design, created_at FROM comparisons WHERE replicates=? AND superseded_by IS NULL',
    ).bind(row.id).all()).results || [];
  } catch {}
  const agreeing = replications.filter((r) => r.actor !== row.actor && direction(r) === direction(row));
  return {
    grade: agreeing.length ? 'REPLICATED' : grade,
    grade_basis: agreeing.length
      ? `design ${row.design} + ${agreeing.length} independent replication(s) agreeing in direction`
      : `declared design: ${row.design} — the grade is capped by the design, not by the size of the delta`,
    replications: replications.map((r) => ({ id: r.id, actor: r.actor, delta: r.delta, direction: direction(r), agrees: direction(r) === direction(row) })),
  };
}

function publicRow(row, graded) {
  return {
    id: row.id, created_at: row.created_at, objective: row.objective, metric: row.metric,
    design: row.design, baseline_ref: row.baseline_ref, variant_ref: row.variant_ref,
    baseline_value: row.baseline_value, variant_value: row.variant_value, delta: row.delta,
    direction: direction(row),
    window: { start: row.window_start, end: row.window_end },
    n: { baseline: row.n_baseline, variant: row.n_variant },
    confounders: safeParse(row.confounders_json, []),
    evidence: safeParse(row.evidence_json, []),
    replicates: row.replicates || null,
    superseded_by: row.superseded_by || null,
    actor: row.actor,
    ...graded,
  };
}

function safeParse(v, fb) { try { return v == null ? fb : JSON.parse(v); } catch { return fb; } }

async function authedIdentity(request, env) {
  if (await isBuildAuthed(request, env)) return 'owner-key';
  const tok = (await verifyShareToken(request, env))
    || (request.headers.get('x-work-token') ? await verifyShareTokenValue(env, request.headers.get('x-work-token')) : null);
  if (tok && /^(act|row:|rows:|pfx:)/.test(String(tok.scope || ''))) {
    return 'share:' + tok.scope + ':' + String(tok.nonce || '').slice(0, 8);
  }
  return null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean).slice(2); // id?, leaf?
  const id = parts[0] || '';
  const leaf = (parts[1] || '').toLowerCase();
  const method = request.method.toUpperCase();

  try {
    if (method === 'GET' && !id) {
      const metric = url.searchParams.get('metric');
      const ref = url.searchParams.get('ref');
      let sql = 'SELECT * FROM comparisons';
      const conds = [], binds = [];
      if (metric) { conds.push('metric=?'); binds.push(metric); }
      if (ref) { conds.push('(baseline_ref=? OR variant_ref=?)'); binds.push(ref, ref); }
      if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
      sql += ' ORDER BY created_at DESC LIMIT 100';
      const rows = (await env.DB.prepare(sql).bind(...binds).all()).results || [];
      const out = [];
      for (const r of rows) out.push(publicRow(r, await gradeWithReplication(env, r)));
      return json({
        _self: {
          schema: 'miscsubjects/comparison/1',
          what: 'A vs B on one metric in one window under a DECLARED design. The claim grade is computed from the design and replication record — never self-declared. One execution is testimony; this object is how testimony becomes (or fails to become) knowledge.',
          grades: ['OUTCOME_OBSERVED', 'ASSOCIATION_OBSERVED', 'CONTROLLED_COMPARISON', 'REPLICATED'],
          create: 'POST /api/comparisons {objective, metric, design, baseline_ref, variant_ref, baseline_value, variant_value, evidence, confounders?, window_start?, window_end?, n_baseline?, n_variant?, replicates?}',
        },
        count: out.length, comparisons: out,
      });
    }

    if (method === 'GET' && id) {
      const row = await env.DB.prepare('SELECT * FROM comparisons WHERE id=?').bind(id).first();
      if (!row) return json({ error: 'comparison_not_found', id }, 404);
      return json(publicRow(row, await gradeWithReplication(env, row)));
    }

    // ---- writes ----
    const identity = await authedIdentity(request, env);
    if (!identity) return json({ error: 'capability_required', why: 'Reads are public; recording an experiment is not.' }, 401);
    const b = await request.json().catch(() => null);
    if (!b) return json({ error: 'invalid json' }, 400);

    if (method === 'POST' && !id) {
      const missing = ['objective', 'metric', 'design', 'baseline_ref', 'variant_ref', 'evidence'].filter((k) => b[k] == null || (typeof b[k] === 'string' && !b[k].trim()));
      if (missing.length) return json({ error: 'fields_required', missing }, 400);
      if (!DESIGNS.has(String(b.design))) return json({ error: 'bad_design', allowed: [...DESIGNS], why: 'The design caps the claim grade; an undeclared design is design "unknown", not a blank.' }, 400);
      if (!Array.isArray(b.evidence) || !b.evidence.length) {
        return json({ error: 'evidence_required', shape: '[{kind: "manifest"|"invocation"|"event"|"email_sends"|"url", ref: "..."}]', why: 'A comparison with no records behind it is an opinion with numbers on it.' }, 400);
      }
      if (b.replicates) {
        const orig = await env.DB.prepare('SELECT id FROM comparisons WHERE id=?').bind(String(b.replicates)).first();
        if (!orig) return json({ error: 'replicates_not_found', replicates: b.replicates }, 400);
      }
      const last = await env.DB.prepare("SELECT id FROM comparisons WHERE id LIKE 'CMP-%' ORDER BY id DESC LIMIT 1").first();
      const n = last ? Number(String(last.id).split('-')[1] || 0) + 1 : 1;
      const cid = 'CMP-' + String(n).padStart(4, '0');
      const now = new Date().toISOString();
      const bv = b.baseline_value != null ? Number(b.baseline_value) : null;
      const vv = b.variant_value != null ? Number(b.variant_value) : null;
      const delta = bv != null && vv != null ? vv - bv : null;
      await env.DB.prepare(
        `INSERT INTO comparisons (id,created_at,objective,metric,design,baseline_ref,variant_ref,baseline_value,variant_value,delta,window_start,window_end,n_baseline,n_variant,confounders_json,evidence_json,replicates,actor,fingerprint)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(
        cid, now, String(b.objective), String(b.metric), String(b.design),
        String(b.baseline_ref), String(b.variant_ref), bv, vv, delta,
        b.window_start || null, b.window_end || null,
        b.n_baseline != null ? Number(b.n_baseline) : null,
        b.n_variant != null ? Number(b.n_variant) : null,
        JSON.stringify(Array.isArray(b.confounders) ? b.confounders : []),
        JSON.stringify(b.evidence),
        b.replicates ? String(b.replicates) : null,
        String(b.agent || identity), null,
      ).run();
      await logEvent(env, {
        source: 'comparisons', key: 'COMPARISON_CREATE', action: 'create', direction: 'IN',
        route: '/api/comparisons', actor: String(b.agent || identity),
        request: JSON.stringify({ id: cid, metric: b.metric, design: b.design, baseline_ref: b.baseline_ref, variant_ref: b.variant_ref, delta }),
        response: 'ok',
      }).catch(() => {});
      const row = await env.DB.prepare('SELECT * FROM comparisons WHERE id=?').bind(cid).first();
      return json(publicRow(row, await gradeWithReplication(env, row)), 201);
    }

    if (method === 'POST' && id && leaf === 'supersede') {
      const row = await env.DB.prepare('SELECT * FROM comparisons WHERE id=?').bind(id).first();
      if (!row) return json({ error: 'comparison_not_found', id }, 404);
      if (!b.replaced_by || !b.reason) return json({ error: 'fields_required', missing: ['replaced_by', 'reason'] }, 400);
      const rep = await env.DB.prepare('SELECT id FROM comparisons WHERE id=?').bind(String(b.replaced_by)).first();
      if (!rep) return json({ error: 'replacement_not_found', replaced_by: b.replaced_by }, 400);
      await env.DB.prepare('UPDATE comparisons SET superseded_by=? WHERE id=? AND superseded_by IS NULL').bind(String(b.replaced_by), id).run();
      await logEvent(env, {
        source: 'comparisons', key: 'COMPARISON_SUPERSEDE', action: 'supersede', direction: 'IN',
        route: '/api/comparisons/' + id, actor: String(b.agent || identity),
        request: JSON.stringify({ id, replaced_by: b.replaced_by, reason: b.reason }), response: 'ok',
      }).catch(() => {});
      return json({ ok: true, id, superseded_by: String(b.replaced_by), note: 'row retained; a superseded comparison stays readable with its supersession on it' });
    }

    return json({ error: 'no_such_route', method, path: url.pathname }, 404);
  } catch (e) {
    return json({ error: 'comparisons_route_threw', detail: String(e?.message || e) }, 500);
  }
}
