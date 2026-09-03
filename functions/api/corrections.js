// THE CORRECTIONS RECORD — memorialized owner corrections and their measured consequences.
//
//   GET /api/corrections
//
// The owner's articulation (2026-08-28): "ALL the time you as Claude disregard my instructions —
// this is a way for me to record: you did this, I changed such-and-such, it increased the
// results." A correction's canonical form is three existing objects linked, never a new ledger:
//
//   1. THE OBSERVATION — a case comment with stance 'correction' on the session case where the
//      violation is visible (POST /api/case/<id>/comments), or the failure task that recorded it.
//   2. THE CHANGE — the skill version the correction produced, carrying the link in its
//      formation_json: {"correction": {"observed": "<SC-…|WT-…|comment id>", "owner_change": "…"}}.
//   3. THE CONSEQUENCE — the comparison (CMP-…) measuring before vs after, whose declared design
//      caps what the correction may claim.
//
// This route is the projection that walks those links. Nothing here is stored; a correction with
// no measured consequence prints exactly that, because "I changed it and it felt better" is the
// claim-grade ladder's bottom rung, not its top.

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
  });
}

export async function onRequestGet({ env }) {
  const out = [];
  try {
    const versions = (await env.DB.prepare(
      `SELECT name, version, change_reason, formation_json, actor, ts FROM skill_versions
        WHERE formation_json LIKE '%"correction"%' ORDER BY ts DESC LIMIT 100`,
    ).all()).results || [];
    for (const v of versions) {
      let formation = null;
      try { formation = JSON.parse(v.formation_json); } catch {}
      const c = formation?.correction || {};
      let comparisons = [];
      try {
        const ref = `skill:${v.name}@${v.version}`;
        comparisons = ((await env.DB.prepare(
          'SELECT id, metric, design, delta, superseded_by FROM comparisons WHERE (baseline_ref=? OR variant_ref=?) ORDER BY created_at DESC LIMIT 5',
        ).bind(ref, ref).all()).results || []).map((r) => ({ id: r.id, metric: r.metric, design: r.design, delta: r.delta, url: '/api/comparisons/' + r.id }));
      } catch {}
      out.push({
        observed: c.observed || null,
        owner_change: c.owner_change || v.change_reason,
        change: { skill: v.name, version: v.version, url: `/api/skills/${v.name}/v/${v.version}` },
        consequence: comparisons.length ? comparisons : 'not yet measured — the correction is recorded, its effect is not; record one at POST /api/comparisons',
        actor: v.actor, ts: v.ts,
      });
    }
  } catch {}
  let open_observations = [];
  try {
    open_observations = ((await env.DB.prepare(
      "SELECT id, case_id, body, actor, ts FROM case_comments WHERE stance='correction' AND status='open' ORDER BY id DESC LIMIT 50",
    ).all()).results || []).map((r) => ({
      comment_id: r.id, case: '/api/case/' + r.case_id, observation: String(r.body).slice(0, 300), actor: r.actor, ts: r.ts,
      next: 'turn it into a skill version whose formation_json.correction.observed names this comment',
    }));
  } catch {}
  return json({
    _self: {
      schema: 'miscsubjects/corrections/1',
      what: 'Owner corrections memorialized as linked objects: the observed violation (case comment / failure task) → the rule change (skill version) → the measured consequence (comparison). Recomputed at read; nothing stored here.',
      record_one: '1) POST /api/case/<id>/comments {stance:"correction", body:"what was disregarded"}  2) POST /api/skills/<name>/versions with formation:{correction:{observed:"…", owner_change:"…"}}  3) POST /api/comparisons measuring before vs after',
    },
    corrections: out,
    open_observations,
    note: 'A correction without a comparison is an anecdote on the record — visible, but graded EXECUTED, not knowledge.',
  });
}
